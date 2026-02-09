import { NextRequest } from 'next/server';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { 
  retrieveFromKnowledgeBase, 
  isKnowledgeBaseConfigured,
  type RetrievalResult 
} from '@/lib/compliance/bedrockKnowledgeBase';
import { getMarketDataClient } from '@/lib/integrations/market-data';
import { findRelevantKnowledge, formatKnowledgeForContext } from '@/lib/knowledge';
import { trackAIUsage, createUsageTimer } from '@/lib/analytics/aiUsageTracker';
import { checkRateLimit, getClientId } from '@/lib/security/rateLimiter';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

// Max content for context - increased for streaming
const MAX_CONTENT_LENGTH = 150000; // ~150k characters with streaming

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  
  let truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > MAX_CONTENT_LENGTH * 0.8) {
    truncated = truncated.slice(0, lastParagraph);
  }
  
  return truncated + '\n\n[... dokumentet är mycket långt (' + Math.round(content.length/1000) + 'k tecken). Första ' + Math.round(truncated.length/1000) + 'k analyseras. Ställ frågor om specifika delar för mer detaljer ...]';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ImageAttachment {
  name: string;
  type: string;
  data: string; // base64 encoded image data
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

/** Template-specific system prompt additions for conversation templates */
const TEMPLATE_SYSTEM_ADDITIONS: Record<string, string> = {
  'nav': `
MALL: NAV-beräkning steg-för-steg
Fokus: Gå igenom NAV-beräkning metodiskt. Förklara komponenter (tillgångar, skulder, antal andelar), beräkningssteg, rapportering och vanliga fallgropar. Var pedagogisk och stegvis.`,
  'compliance': `
MALL: Compliance-granskning
Fokus: Strukturera svar som en granskning. Ta upp krav (regelverk, policyer), kontrollpunkter, dokumentation och rekommendationer. Referera till FFFS, AIFMD, UCITS och interna policyer där relevant.`,
  'dokument': `
MALL: Dokumentanalys
Fokus: Analysera bifogade eller nämnda dokument systematiskt. Sammanfatta innehåll, identifiera nyckelpunktet, risker eller åtgärdsbehov. Citera från kunskapsbasen med källhänvisning.`,
  'regulatorisk': `
MALL: Regulatorisk fråga
Fokus: Svara med tydlig källhänvisning till lagar och föreskrifter (LAIF, FFFS, AIFMD, UCITS). Skilj mellan krav och rekommendationer. Nämn eventuella dispens eller undantag.`,
};

interface ChatRequest {
  message: string;
  question?: string;
  history?: ChatMessage[];
  mode?: string;
  stream?: boolean;
  skipKnowledgeBase?: boolean; // For general questions that don't need KB search
  hasAttachments?: boolean; // Indicates if the message includes file content
  images?: ImageAttachment[]; // Image attachments for vision API
  templateId?: string; // Conversation template (nav, compliance, dokument, regulatorisk)
}

/**
 * Format knowledge base results into context for the AI
 */
function formatKnowledgeBaseContext(results: RetrievalResult[]): string {
  if (results.length === 0) return '';

  const formattedResults = results.map((result, index) => {
    const meta = result.metadata;
    // Create a clean reference name for the document
    const docName = meta.title || meta.document_number || meta.source_label || `Dokument ${index + 1}`;
    const docNumber = meta.document_number ? ` (${meta.document_number})` : '';
    const sourceInfo = [
      meta.title,
      meta.document_number,
      meta.source_label,
      meta.effective_date ? `(gäller från ${meta.effective_date})` : '',
    ].filter(Boolean).join(' | ');

    return `
═══════════════════════════════════════════════════════════════
📄 DOKUMENT: "${docName}"${docNumber}
   Fullständig källa: ${sourceInfo}
   Relevans: ${Math.round(result.score * 100)}%
   ${meta.url ? `URL: ${meta.url}` : ''}
═══════════════════════════════════════════════════════════════

${result.content}
`;
  }).join('\n');

  // Create a list of document names for reference
  const documentList = results.map((result, index) => {
    const meta = result.metadata;
    const docName = meta.title || meta.document_number || meta.source_label || `Dokument ${index + 1}`;
    const docNumber = meta.document_number ? ` (${meta.document_number})` : '';
    return `  • "${docName}"${docNumber}`;
  }).join('\n');

  return `
╔═══════════════════════════════════════════════════════════════╗
║         RESULTAT FRÅN KUNSKAPSBASEN (SÖK FÖRST HÄR!)         ║
╚═══════════════════════════════════════════════════════════════╝

Följande ${results.length} dokument hittades som är relevanta för frågan:
${documentList}

DU MÅSTE basera ditt svar på dessa källor FÖRST innan du använder generell kunskap.

${formattedResults}

═══════════════════════════════════════════════════════════════
🚨 VIKTIGT - HUR DU REFERERAR TILL KÄLLOR:
═══════════════════════════════════════════════════════════════

❌ ANVÄND INTE: "[Källa 1]", "[Källa 7]", eller liknande numrering
✅ ANVÄND ISTÄLLET: Dokumentets faktiska namn/titel

EXEMPEL på korrekta referenser:
• "Enligt FFFS 2013:10 om AIF-förvaltare..."
• "I dokumentet 'Personalhandbok 2024' framgår att..."
• "AIFMD artikel 7 stadgar..."
• "Baserat på 'Compliance Policy Q1 2026'..."

Om du citerar specifikt innehåll, formatera så här:
> "Exakt citat från dokumentet" - [Dokumentnamn]

Om informationen INTE finns i källorna, säg det TYDLIGT:
"Information om [ämne] saknas i kunskapsbasen. Baserat på 
generell kunskap om området..."
═══════════════════════════════════════════════════════════════
`;
}

export async function POST(request: NextRequest) {
  // Start usage timer
  const usageTimer = createUsageTimer();
  let userId = 'anonymous';
  
  // Try to get user ID for tracking
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (token) {
      const payload = await verifyIdToken(token);
      userId = payload.sub as string;
    }
  } catch {
    // Continue without user ID
  }

  // Rate limit: 30 requests per minute per user/IP
  const clientId = userId !== 'anonymous' ? `user:${userId}` : await getClientId();
  const rateLimitResult = await checkRateLimit(clientId, 'ai-chat');
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Du har gjort för många förfrågningar. Vänta innan du försöker igen.',
        retryAfter: rateLimitResult.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter ?? 60),
        },
      }
    );
  }
  
  try {
    const body: ChatRequest = await request.json();
    const userMessage = body.message || body.question;
    
    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build conversation history
    const conversationHistory = body.history?.map(msg => ({
      role: msg.role,
      content: truncateContent(msg.content),
    })) || [];

    // Get current date for context
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    const currentYear = today.getFullYear();

    // =========================================================================
    // KNOWLEDGE BASE SEARCH - ALWAYS SEARCH FIRST!
    // =========================================================================
    let knowledgeBaseContext = '';
    let kbSearchPerformed = false;
    let kbResultsCount = 0;

    // Check if we should search the knowledge base
    const shouldSearchKB = !body.skipKnowledgeBase && isKnowledgeBaseConfigured();
    
    if (shouldSearchKB) {
      try {
        console.log('[AI Chat] Searching knowledge base for:', userMessage.substring(0, 100));
        
        // Search with the user's question
        const kbResults = await retrieveFromKnowledgeBase(userMessage, 8);
        kbSearchPerformed = true;
        kbResultsCount = kbResults.length;
        
        // Filter results with relevance score > 0.25
        const relevantResults = kbResults.filter(r => r.score >= 0.25);
        
        if (relevantResults.length > 0) {
          knowledgeBaseContext = formatKnowledgeBaseContext(relevantResults);
          console.log(`[AI Chat] Found ${relevantResults.length} relevant KB documents`);
        } else {
          console.log('[AI Chat] No relevant KB documents found (below threshold)');
        }
      } catch (kbError) {
        console.error('[AI Chat] Knowledge base search failed:', kbError);
        // Continue without KB results - don't fail the whole request
      }
    }

    // =========================================================================
    // INTERNAL KNOWLEDGE BASE - Search team's shared knowledge
    // =========================================================================
    let internalKnowledgeContext = '';
    let internalKBResultsCount = 0;
    let internalKnowledgeSources: Array<{
      id: string;
      title: string;
      category: string;
      sharedBy: string;
      sharedAt: string;
    }> = [];
    
    try {
      console.log('[AI Chat] Searching internal knowledge base...');
      const internalResults = await findRelevantKnowledge(userMessage, 5);
      internalKBResultsCount = internalResults.length;
      
      if (internalResults.length > 0) {
        internalKnowledgeContext = formatKnowledgeForContext(internalResults);
        internalKnowledgeSources = internalResults.map(item => ({
          id: item.knowledgeId,
          title: item.title,
          category: item.category,
          sharedBy: item.sharedByName || item.sharedByEmail || item.sharedByUserId,
          sharedAt: item.createdAt,
        }));
        console.log(`[AI Chat] Found ${internalResults.length} relevant internal knowledge items`);
      }
    } catch (internalKBError) {
      console.error('[AI Chat] Internal knowledge base search failed:', internalKBError);
      // Continue without internal KB results
    }

    // =========================================================================
    // MARKET DATA - Fetch if question relates to prices/market
    // =========================================================================
    let marketDataContext = '';
    const marketKeywords = ['pris', 'guld', 'silver', 'kurs', 'valuta', 'marknad', 'nyhet', 'gold', 'price', 'market'];
    const needsMarketData = marketKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    
    if (needsMarketData) {
      try {
        const marketClient = getMarketDataClient();
        const prices = await marketClient.getCommodityPrices();
        
        marketDataContext = `
═══════════════════════════════════════════════════════════════
📈 AKTUELLA MARKNADSDATA (${currentDate})
═══════════════════════════════════════════════════════════════
${prices.map(p => `• ${p.name}: ${p.price.toFixed(2)} ${p.currency} (${p.change >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%)`).join('\n')}
═══════════════════════════════════════════════════════════════
`;
        console.log('[AI Chat] Added market data context');
      } catch (marketError) {
        console.error('[AI Chat] Market data fetch failed:', marketError);
      }
    }

    // =========================================================================
    // ESG DATA - Fetch if question relates to ESG / sustainability / specific security
    // =========================================================================
    let esgDataContext = '';
    const esgKeywords = [
      'esg', 'hållbarhet', 'hållbar', 'sustainability', 'sustainable',
      'exkludering', 'exkludera', 'exclusion', 'exclude',
      'artikel 8', 'artikel 9', 'article 8', 'article 9',
      'sfdr', 'pai', 'taxonomi', 'taxonomy',
      'koldioxid', 'carbon', 'co2', 'klimat', 'climate',
      'kontrovers', 'controversy',
      'miljö', 'environment', 'social', 'governance', 'styrning',
    ];
    const msgLower = userMessage.toLowerCase();
    const needsESGData = esgKeywords.some(kw => msgLower.includes(kw));

    // Also detect ISIN patterns (e.g. SE0000108656) or ticker-like references
    const isinPattern = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/;
    const isinMatch = userMessage.match(isinPattern);
    // Simple ticker detection: uppercase word 2-5 chars preceded by context
    const tickerPattern = /\b(?:ticker|aktie|aktien|stock|värdepapper)\s+([A-Z]{2,6})\b/i;
    const tickerMatch = userMessage.match(tickerPattern);
    const securityIdentifier = isinMatch?.[0] || tickerMatch?.[1] || null;

    if (needsESGData || securityIdentifier) {
      try {
        const { getESGServiceClient } = await import('@/lib/integrations/esg/esg-service');
        const esgClient = getESGServiceClient();
        const providerName = esgClient.getActiveProviderName();

        if (securityIdentifier && providerName) {
          // Fetch ESG data for the specific security
          const esgData = await esgClient.getESGData(securityIdentifier);

          if (esgData) {
            esgDataContext = `
═══════════════════════════════════════════════════════════════
🌱 ESG-DATA FÖR ${securityIdentifier} (Källa: ${esgData.provider}, ${esgData.fetchedAt.split('T')[0]})
═══════════════════════════════════════════════════════════════
${esgData.totalScore !== null ? `• Total ESG-score: ${esgData.totalScore.toFixed(1)}/100` : '• Total ESG-score: Ej tillgänglig'}
${esgData.environmentScore !== null ? `• Miljö (E): ${esgData.environmentScore.toFixed(1)}/100` : ''}
${esgData.socialScore !== null ? `• Socialt (S): ${esgData.socialScore.toFixed(1)}/100` : ''}
${esgData.governanceScore !== null ? `• Styrning (G): ${esgData.governanceScore.toFixed(1)}/100` : ''}
${esgData.controversyLevel !== null ? `• Kontroversialitetsnivå: ${esgData.controversyLevel}/5` : ''}
${esgData.percentile !== null ? `• Percentil i peer group: ${esgData.percentile}%` : ''}
${esgData.peerGroup ? `• Peer group: ${esgData.peerGroup}` : ''}
${esgData.sfdrAlignment ? `• SFDR-klassificering: ${esgData.sfdrAlignment}` : ''}
${esgData.taxonomyAlignmentPercent !== null && esgData.taxonomyAlignmentPercent !== undefined ? `• EU Taxonomi-anpassning: ${esgData.taxonomyAlignmentPercent}%` : ''}
${esgData.carbonIntensity !== null && esgData.carbonIntensity !== undefined ? `• Koldioxidintensitet: ${esgData.carbonIntensity} ${esgData.carbonIntensityUnit || 'tCO2e/MEUR'}` : ''}
${esgData.exclusionFlags && esgData.exclusionFlags.length > 0 ? `• Exkluderingsflaggor:\n${esgData.exclusionFlags.map(f => `  - ${f.categoryDescription}${f.revenuePercent !== undefined ? ` (${f.revenuePercent}% av intäkter)` : ''}: ${f.involvementLevel || 'flaggad'}`).join('\n')}` : ''}
═══════════════════════════════════════════════════════════════
OBS: Presentera ESG-data med källhänvisning. Notera om data saknas.
Tolka ESG-scores: >70 = starkt, 50-70 = medel, <50 = svagt.
Kontroversialitet: 0-1 = låg, 2-3 = medel, 4-5 = allvarlig.
═══════════════════════════════════════════════════════════════
`;
            console.log(`[AI Chat] Added ESG data context for ${securityIdentifier} from ${esgData.provider}`);
          }
        } else if (needsESGData && !securityIdentifier) {
          // General ESG question without specific security
          esgDataContext = `
═══════════════════════════════════════════════════════════════
🌱 ESG-KONTEXT
═══════════════════════════════════════════════════════════════
Användaren frågar om ESG/hållbarhet. Du har tillgång till ESG-datatjänsten.
Om användaren nämner ett specifikt värdepapper (ISIN, ticker eller namn),
kan ESG-data hämtas automatiskt. Be användaren specificera om inget
värdepapper nämnts och frågan kräver specifik data.

Tillgänglig ESG-leverantör: ${providerName || 'Ingen konfigurerad'}

Nyckelbegrepp:
• SFDR Artikel 6/8/9: Hållbarhetsklassificering av fonder
• PAI: Principal Adverse Impact-indikatorer
• EU Taxonomi: Klassificering av miljömässigt hållbara aktiviteter
• Exkluderingskriterier: Vapen, tobak, fossila bränslen, spel m.m.
═══════════════════════════════════════════════════════════════
`;
          console.log('[AI Chat] Added general ESG context (no specific security)');
        }
      } catch (esgError) {
        console.error('[AI Chat] ESG data fetch failed:', esgError);
      }
    }

    // =========================================================================
    // BUILD SYSTEM PROMPT
    // =========================================================================
    const systemPrompt = `Du är en expert AI-assistent för AIFM Group, ett svenskt fondbolag med alla nödvändiga tillstånd från Finansinspektionen.

═══════════════════════════════════════════════════════════════
DAGENS DATUM: ${currentDate}
AKTUELLT ÅR: ${currentYear}
═══════════════════════════════════════════════════════════════

SPRÅK: Matcha användarens språk (svensk fråga = svenskt svar, engelsk fråga = engelskt svar).

ROLL: Du är en komplett AI-assistent för hela AIFM Group. Du kan hjälpa med:

📊 FONDFÖRVALTNING:
- NAV-beräkningar och rapporter
- Portföljanalys och positioner
- Investerardata och AUM

📋 COMPLIANCE & REGELVERK:
- Regulatoriska frågor (LAIF, FFFS, AIFMD, UCITS)
- Compliancekontroller
- Policyer och riktlinjer

📁 DOKUMENT:
- Hitta interna dokument (synkade från Dropbox)
- HR-policyer och personalhandbok
- Avtal och kontrakt
- Generera nya dokument från mallar

📈 MARKNADSDATA:
- Guld- och silverpriser i realtid
- Valutakurser (SEK/USD, SEK/EUR)
- Finansnyheter och marknadsutveckling
- Regulatoriska uppdateringar från FI

🌱 ESG & HÅLLBARHET:
- ESG-scores (E/S/G) för enskilda värdepapper
- Exkluderingskontroll (vapen, tobak, fossilt m.m.)
- SFDR Artikel 8/9-klassificering
- PAI-indikatorer och EU Taxonomi
- Kontroversialitetsbedömning

📅 PRODUKTIVITET (om M365 är kopplat):
- Kalenderhändelser och möten
- Email-sammanfattningar
- Boka möten och kontrollera tillgänglighet

💬 KOMMUNIKATION (om Slack är kopplat):
- Skicka meddelanden till kanaler
- Notifiera kollegor
- Hitta kontaktinfo

╔═══════════════════════════════════════════════════════════════╗
║   🔴 KRITISK REGEL: SÖK I FÖRETAGETS DOKUMENT FÖRST! 🔴      ║
╚═══════════════════════════════════════════════════════════════╝

${kbSearchPerformed 
  ? `✅ Kunskapsbasen har sökts och ${kbResultsCount} dokument hittades.`
  : '⚠️ Kunskapsbasen kunde inte sökas - använd generell kunskap med försiktighet.'}

📁 DOKUMENTSÖKNING:
Du har tillgång till företagets kompletta dokumentarkiv via kunskapsbasen.
När användaren frågar om specifika dokument, policyer eller riktlinjer:
1. Sök ALLTID i kunskapsbasen först
2. Om dokumentet hittas, citera relevant innehåll
3. Om användaren vill ha hela dokumentet, informera att det finns i systemet
4. Var specifik om var informationen kommer från

PRIORITERINGSORDNING FÖR SVAR:

1️⃣ HÖGSTA PRIORITET - Kunskapsbasens dokument:
   Om relevant information finns i kunskapsbasen (se nedan), ANVÄND DEN FÖRST.
   Referera ALLTID med dokumentets faktiska namn, t.ex. "Enligt FFFS 2013:10..."

2️⃣ ANDRA PRIORITET - Primära externa källor:
   Om kunskapsbasen inte har svaret, hänvisa till officiella källor:
   • Riksdagens lagtexter (SFS)
   • Finansinspektionens föreskrifter (FFFS)
   • EU-förordningar och direktiv

3️⃣ TREDJE PRIORITET - Generell kunskap:
   ENDAST om varken kunskapsbasen eller primära källor har svaret.
   Markera ALLTID tydligt: "Baserat på generell kunskap (ej från kunskapsbasen)..."

⚠️ VARNINGAR:
• GISSA ALDRIG paragrafnummer - om osäker, citera bara lagnamnet
• HITTA ALDRIG PÅ information som inte finns i källorna
• Om du inte vet, SÄG DET TYDLIGT
• Rekommendera alltid att användaren verifierar mot originalkällor för juridiskt bindande tolkningar

${knowledgeBaseContext}
${internalKnowledgeContext}
${marketDataContext}
${esgDataContext}
═══════════════════════════════════════════════════════════════
REFERENSLÄNKAR (använd endast om kunskapsbasen saknar info):
═══════════════════════════════════════════════════════════════

SVENSK LAGSTIFTNING:
• [LAIF (2013:561)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2013561-om-forvaltare-av-alternativa_sfs-2013-561/)
• [Lagen om värdepappersfonder (2004:46)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-200446-om-vardepappersfonder_sfs-2004-46/)
• [Penningtvättslagen (2017:630)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2017630-om-atgarder-mot-penningtvatt-och_sfs-2017-630/)

FI FÖRESKRIFTER (FFFS):
• [FFFS 2013:10](https://www.fi.se/contentassets/b0c0d859e4b3440b9876f5f68561db0f/fs1310k-250221.pdf) - AIF-förvaltare
• [FFFS 2013:9](https://www.fi.se/contentassets/aee63096054746a19acebb1e2c4f1536/fs1309k-250221.pdf) - Värdepappersfonder
• [FFFS 2017:11](https://www.fi.se/contentassets/6448574afbb74c5ab19f74e00a275b98/fs1711k.pdf) - Penningtvätt

EU REGELVERK:
• [AIFMD](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32011L0061)
• [UCITS](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32009L0065)
• [SFDR](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32019R2088)
• [MiFID II](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32014L0065)

═══════════════════════════════════════════════════════════════
SVARSFORMAT:
═══════════════════════════════════════════════════════════════

När du svarar:
1. Börja med en kort sammanfattning av svaret
2. Ge detaljerad information med källhänvisningar
3. Referera ALLTID med dokumentets/regelverkets faktiska namn:
   ✅ "Enligt FFFS 2013:10 om AIF-förvaltare..."
   ✅ "I Personalhandboken framgår att..."
   ✅ "AIFMD artikel 7 stadgar..."
   ❌ ANVÄND ALDRIG "[Källa 1]", "[Källa 7]" eller liknande!
4. Om du använder generell kunskap, markera det tydligt
5. Avsluta med praktiska rekommendationer om relevant
6. Lägg till disclaimer om juridisk rådgivning vid behov

PDF/EXCEL EXPORT:
Användaren kan exportera ditt svar. Strukturera med ## rubriker och | tabeller |.

DIAGRAM:
När det hjälper (fondstrukturer, NAV-flöden, organisationsscheman, processer) kan du inkludera Mermaid-diagram i ett kodblock:
\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
Använd flowchart, sequenceDiagram eller liknande för att visualisera samband. Håll diagrammen enkla och läsbara.

FÖLJDFRÅGOR:
Efter varje svar, lägg till en sektion med föreslagna följdfrågor som användaren kan ställa för att fördjupa sig i ämnet. Formatera så här:

---
**Följdfrågor du kan ställa:**
• [Relevant följdfråga 1 baserad på svaret]
• [Relevant följdfråga 2 baserad på svaret]
• [Relevant följdfråga 3 baserad på svaret]

${body.templateId && TEMPLATE_SYSTEM_ADDITIONS[body.templateId] ? TEMPLATE_SYSTEM_ADDITIONS[body.templateId] : ''}

SÄKERHET: All data stannar inom AWS-kontot via Bedrock.`;

    // Truncate user message if needed
    const truncatedUserMessage = truncateContent(userMessage);
    
    // Check for image attachments
    const imageAttachments: ImageAttachment[] = body.images || [];
    const hasImages = imageAttachments.length > 0;
    
    // Format messages for Claude - with multimodal support for images
    type ContentBlock = { type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };
    
    const messages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }> = [
      ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];
    
    // Build the user message with images if present
    if (hasImages) {
      console.log(`[AI Chat] Processing ${imageAttachments.length} images for vision analysis`);
      
      // Create multimodal content array with images first, then text
      const contentBlocks: ContentBlock[] = [];
      
      // Add each image as a content block
      for (const img of imageAttachments) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType,
            data: img.data,
          },
        });
        console.log(`[AI Chat] Added image: ${img.name} (${img.mediaType})`);
      }
      
      // Add the text message
      contentBlocks.push({
        type: 'text',
        text: truncatedUserMessage || 'Vad visar denna bild?',
      });
      
      messages.push({ role: 'user', content: contentBlocks });
    } else {
      // No images - just text message
      messages.push({ role: 'user', content: truncatedUserMessage });
    }
    
    console.log(`[AI Chat] Sending to Claude: ${truncatedUserMessage.length} chars, KB context: ${knowledgeBaseContext.length} chars, images: ${imageAttachments.length}`);

    // Claude Opus 4.6 - best reasoning and analysis
    const modelId = 'eu.anthropic.claude-opus-4-6-v1';
    
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 16384,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    // Use streaming
    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await bedrockClient.send(command);
    
    // Build citations array from KB results for frontend
    let kbCitations: Array<{
      documentTitle: string;
      documentNumber?: string;
      section?: string;
      excerpt: string;
      sourceUrl: string;
    }> = [];

    if (shouldSearchKB && kbResultsCount > 0) {
      try {
        const kbResults = await retrieveFromKnowledgeBase(userMessage, 8);
        const relevantResults = kbResults.filter(r => r.score >= 0.25);
        
        kbCitations = relevantResults
          .filter(result => {
            // Only include citations that have meaningful metadata
            const hasTitle = result.metadata.title && result.metadata.title.length > 3;
            const hasDocNumber = result.metadata.document_number && result.metadata.document_number.length > 0;
            const hasUrl = result.metadata.url && result.metadata.url !== '#';
            return hasTitle || hasDocNumber || hasUrl;
          })
          .map((result) => ({
            documentTitle: result.metadata.title || result.metadata.document_number || result.metadata.source_label || '',
            documentNumber: result.metadata.document_number || '',
            section: result.metadata.category_label || '',
            excerpt: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
            sourceUrl: result.metadata.url || '#',
          }))
          .filter(citation => citation.documentTitle.length > 0); // Remove empty titles
      } catch {
        // Citations already logged above, just continue
      }
    }

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First, send metadata about KB search including citations and internal sources
          const metadata = JSON.stringify({ 
            kbSearched: kbSearchPerformed,
            kbResultsCount,
            internalKBResultsCount,
            citations: kbCitations,
            internalSources: internalKnowledgeSources,
            meta: true 
          });
          controller.enqueue(encoder.encode(`data: ${metadata}\n\n`));

          if (response.body) {
            for await (const event of response.body) {
              if (event.chunk?.bytes) {
                const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
                
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  // Send the text chunk as SSE
                  const data = JSON.stringify({ text: chunk.delta.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
                
                if (chunk.type === 'message_stop') {
                  // Send final message with citations
                  const doneData = JSON.stringify({ 
                    done: true,
                    citations: kbCitations,
                  });
                  controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              }
            }
          }
          controller.close();
          
          // Track successful AI usage
          trackAIUsage({
            userId,
            timestamp: new Date().toISOString(),
            requestType: 'chat',
            modelId,
            responseTimeMs: usageTimer.getElapsedMs(),
            success: true,
          });
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({ error: 'Streaming error' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
          
          // Track failed AI usage
          trackAIUsage({
            userId,
            timestamp: new Date().toISOString(),
            requestType: 'chat',
            modelId,
            responseTimeMs: usageTimer.getElapsedMs(),
            success: false,
            errorMessage: 'Streaming error',
          });
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const errorMessage = (error as Error).message || '';
    const errorName = (error as Error).name || '';
    console.error('AI Chat error:', errorName, errorMessage.slice(0, 200));
    
    // Track error
    trackAIUsage({
      userId,
      timestamp: new Date().toISOString(),
      requestType: 'chat',
      modelId: 'unknown',
      responseTimeMs: usageTimer.getElapsedMs(),
      success: false,
      errorMessage: errorMessage.slice(0, 200),
    });
    
    // Handle configuration errors
    if (errorMessage.includes('credentials') || 
        errorMessage.includes('region') ||
        errorMessage.includes('Could not load credentials') ||
        errorName === 'CredentialsProviderError' ||
        errorName === 'AccessDeniedException') {
      
      return new Response(JSON.stringify({
        error: 'Bedrock not configured',
        response: 'AWS Bedrock är inte konfigurerad. Kontakta administratören.',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({
      error: errorMessage,
      response: 'Ett fel uppstod. Försök igen.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
