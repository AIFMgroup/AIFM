import { NextRequest } from 'next/server';
import { 
  BedrockRuntimeClient, 
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type ToolConfiguration,
  type ToolResultContentBlock,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';
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

// Max content for context
const MAX_CONTENT_LENGTH = 150000;

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  let truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > MAX_CONTENT_LENGTH * 0.8) {
    truncated = truncated.slice(0, lastParagraph);
  }
  return truncated + '\n\n[... dokumentet är mycket långt (' + Math.round(content.length/1000) + 'k tecken). Första ' + Math.round(truncated.length/1000) + 'k analyseras ...]';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ImageAttachment {
  name: string;
  type: string;
  data: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
}

/** Template-specific system prompt additions */
const TEMPLATE_SYSTEM_ADDITIONS: Record<string, string> = {
  'nav': `\nMALL: NAV-beräkning steg-för-steg\nFokus: Gå igenom NAV-beräkning metodiskt. Förklara komponenter (tillgångar, skulder, antal andelar), beräkningssteg, rapportering och vanliga fallgropar.`,
  'compliance': `\nMALL: Compliance-granskning\nFokus: Strukturera svar som en granskning. Ta upp krav (regelverk, policyer), kontrollpunkter, dokumentation och rekommendationer.`,
  'dokument': `\nMALL: Dokumentanalys\nFokus: Analysera bifogade eller nämnda dokument systematiskt. Sammanfatta innehåll, identifiera nyckelpunkter, risker eller åtgärdsbehov.`,
  'regulatorisk': `\nMALL: Regulatorisk fråga\nFokus: Svara med tydlig källhänvisning till lagar och föreskrifter (LAIF, FFFS, AIFMD, UCITS). Skilj mellan krav och rekommendationer.`,
};

interface DocxAttachmentContext {
  rawBase64: string;
  fileName: string;
  documentText: string;
  paragraphs?: string[];
}

interface ChatRequest {
  message: string;
  question?: string;
  history?: ChatMessage[];
  mode?: string;
  stream?: boolean;
  skipKnowledgeBase?: boolean;
  hasAttachments?: boolean;
  images?: ImageAttachment[];
  templateId?: string;
  docxAttachment?: DocxAttachmentContext;
  /** When set, instruct model to aim for shorter/medium/longer response. Omit = unchanged behaviour. */
  responseLength?: 'short' | 'medium' | 'long';
}

// =============================================================================
// TOOL DEFINITIONS - What Claude can call during conversation
// =============================================================================

const TOOL_DEFINITIONS: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: 'get_esg_data',
        description: 'Hämtar ESG-data (miljö, social, styrning) för ett värdepapper via ISIN eller ticker. Returnerar ESG-scores, SFDR-klassificering, koldioxidintensitet, taxonomianpassning och kontroversialitetsnivå. Använd detta verktyg när användaren frågar om ESG, hållbarhet, miljöpåverkan, eller specifika värdepappers hållbarhetsdata.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              identifier: {
                type: 'string',
                description: 'ISIN-nummer (t.ex. SE0000108656) eller ticker-symbol (t.ex. VOLV-B) för värdepappret',
              },
            },
            required: ['identifier'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'get_exclusion_screening',
        description: 'Kontrollerar om ett värdepapper uppfyller exkluderingskriterier (vapen, tobak, fossila bränslen, gambling, etc.). Returnerar om värdepappret är flaggat, orsaker, varningar och detaljerad involvering per kategori. Använd detta när användaren frågar om exkludering, kontroversiella verksamheter, eller om ett värdepapper får finnas i en fond.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              identifier: {
                type: 'string',
                description: 'ISIN-nummer eller ticker-symbol',
              },
            },
            required: ['identifier'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'get_pai_indicators',
        description: 'Hämtar PAI-indikatorer (Principal Adverse Impact) för ett värdepapper. Inkluderar klimatdata (GHG-utsläpp, koldioxidintensitet, fossilt bränsle-exponering), sociala indikatorer (könsfördelning, UNGC-efterlevnad) och styrningsindikatorer. Använd detta för detaljerade hållbarhetsmätningar och SFDR-rapportering.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              identifier: {
                type: 'string',
                description: 'ISIN-nummer eller ticker-symbol',
              },
            },
            required: ['identifier'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'search_knowledge_base',
        description: 'Söker i företagets kunskapsbas med compliance-dokument, policyer, regelverk (FFFS, AIFMD, UCITS, LAIF), personalhandbok och interna riktlinjer. Använd detta för att hitta specifik information i företagets dokumentarkiv.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Sökfråga - beskriv vad du letar efter',
              },
              numberOfResults: {
                type: 'number',
                description: 'Antal resultat att returnera (1-10, standard 5)',
              },
            },
            required: ['query'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'get_market_data',
        description: 'Hämtar aktuella marknadsdata: råvarupriser (guld, silver), valutakurser och marknadsöversikt. Använd detta när användaren frågar om aktuella priser, marknadsläge eller valutakurser.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['commodity_prices', 'market_summary', 'financial_news', 'regulatory_news'],
                description: 'Typ av marknadsdata att hämta',
              },
            },
            required: ['type'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'lookup_security',
        description: 'Slår upp detaljerad information om ett värdepapper via ISIN, ticker eller namn. Returnerar namn, typ, börs, sektor, bransch, börsvärde, likviditet och mer. Använd detta för att identifiera värdepapper eller hämta grundläggande information.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              isin: {
                type: 'string',
                description: 'ISIN-nummer (t.ex. SE0000108656)',
              },
              ticker: {
                type: 'string',
                description: 'Ticker-symbol (t.ex. VOLV-B)',
              },
            },
            required: [],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'search_internal_knowledge',
        description: 'Söker i teamets delade kunskapsbas med interna anteckningar, best practices, FAQ och arbetsrutiner som kollegor har delat. Använd detta för att hitta intern kunskap som inte finns i formella dokument.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Sökfråga',
              },
            },
            required: ['query'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'review_document',
        description: 'Granskar ett bifogat Word-dokument (.docx) och applicerar spårändringar samt kommentarer direkt i filen. Använd ENDAST när användaren har bifogat ett Word-dokument och ber om granskning, revidering eller ändringar i dokumentet. Returnerar den modifierade filen med track changes och kommentarer som kan öppnas i Word.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              instructions: {
                type: 'string',
                description: 'Användarens instruktioner för granskningen, t.ex. "Granska avtalet ur AIFM-perspektiv" eller "Föreslå förtydliganden i klausul 3"',
              },
            },
            required: ['instructions'],
          },
        },
      },
    },
  ],
};

// =============================================================================
// TOOL EXECUTION HANDLERS
// =============================================================================

async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  options?: { docxAttachment?: DocxAttachmentContext }
): Promise<string> {
  console.log(`[AI Chat Tool] Executing: ${toolName}`, JSON.stringify(toolInput).substring(0, 200));
  
  try {
    switch (toolName) {
      case 'get_esg_data': {
        const { getESGServiceClient } = await import('@/lib/integrations/esg/esg-service');
        const esgClient = getESGServiceClient();
        const data = await esgClient.getESGData(toolInput.identifier);
        
        if (!data) {
          return JSON.stringify({ error: `Ingen ESG-data hittades för ${toolInput.identifier}` });
        }
        
        return JSON.stringify({
          identifier: data.identifier,
          provider: data.provider,
          fetchedAt: data.fetchedAt,
          totalScore: data.totalScore,
          environmentScore: data.environmentScore,
          socialScore: data.socialScore,
          governanceScore: data.governanceScore,
          controversyLevel: data.controversyLevel,
          sfdrAlignment: data.sfdrAlignment,
          taxonomyAlignmentPercent: data.taxonomyAlignmentPercent,
          carbonIntensity: data.carbonIntensity,
          carbonIntensityUnit: data.carbonIntensityUnit,
          meetsExclusionCriteria: data.meetsExclusionCriteria,
          exclusionFlags: data.exclusionFlags?.filter(f => f.revenuePercent && f.revenuePercent > 0),
          interpretation: {
            scoreGuide: 'Skala 0-100: >70 = starkt, 50-70 = medel, <50 = svagt',
            controversyGuide: 'Skala 0-5: 0-1 = låg, 2-3 = medel, 4-5 = allvarlig',
            sfdrGuide: 'Artikel 9 = starkast hållbarhetsfokus, Artikel 8 = främjar hållbarhet, Artikel 6 = inga hållbarhetskrav',
          },
        });
      }

      case 'get_exclusion_screening': {
        const { getESGServiceClient } = await import('@/lib/integrations/esg/esg-service');
        const esgClient = getESGServiceClient();
        const screening = await esgClient.getExclusionScreening(toolInput.identifier);
        
        if (!screening) {
          return JSON.stringify({ error: `Ingen exkluderingsdata hittades för ${toolInput.identifier}` });
        }
        
        return JSON.stringify({
          identifier: screening.identifier,
          excluded: screening.excluded,
          reasons: screening.reasons,
          warnings: screening.warnings,
          involvement: screening.involvement?.filter(i => i.revenuePercent !== undefined && i.revenuePercent > 0),
          source: screening.source,
          fetchedAt: screening.fetchedAt,
        });
      }

      case 'get_pai_indicators': {
        const { getESGServiceClient } = await import('@/lib/integrations/esg/esg-service');
        const esgClient = getESGServiceClient();
        const paiData = await esgClient.getPAIIndicators(toolInput.identifier);
        
        if (!paiData || paiData.length === 0) {
          return JSON.stringify({ error: `Inga PAI-indikatorer hittades för ${toolInput.identifier}` });
        }
        
        return JSON.stringify({
          identifier: toolInput.identifier,
          indicatorCount: paiData.length,
          indicators: paiData.map(p => ({
            name: p.name,
            value: p.value,
            unit: p.unit || null,
            description: p.description || null,
          })),
        });
      }

      case 'search_knowledge_base': {
        if (!isKnowledgeBaseConfigured()) {
          return JSON.stringify({ error: 'Kunskapsbasen är inte konfigurerad' });
        }
        
        const results = await retrieveFromKnowledgeBase(
          toolInput.query, 
          toolInput.numberOfResults || 5
        );
        const relevant = results.filter(r => r.score >= 0.25);
        
        if (relevant.length === 0) {
          return JSON.stringify({ 
            results: [],
            message: `Inga relevanta dokument hittades för: "${toolInput.query}"` 
          });
        }
        
        return JSON.stringify({
          resultCount: relevant.length,
          results: relevant.map(r => ({
            title: r.metadata.title || r.metadata.document_number || 'Okänt dokument',
            documentNumber: r.metadata.document_number || null,
            category: r.metadata.category_label || null,
            relevance: Math.round(r.score * 100) + '%',
            url: r.metadata.url || null,
            content: r.content.substring(0, 2000),
          })),
        });
      }

      case 'get_market_data': {
        const marketClient = getMarketDataClient();
        
        switch (toolInput.type) {
          case 'commodity_prices': {
            const prices = await marketClient.getCommodityPrices();
            return JSON.stringify({
              date: new Date().toISOString().split('T')[0],
              prices: prices.map(p => ({
                name: p.name,
                price: p.price,
                change: p.change,
                changePercent: p.changePercent,
                currency: p.currency,
              })),
            });
          }
          case 'market_summary': {
            const summary = await marketClient.getMarketSummary();
            return JSON.stringify({ summary });
          }
          case 'financial_news': {
            const news = await marketClient.getFinancialNews(undefined, 5);
            return JSON.stringify({
              articles: news.map(n => ({
                title: n.title,
                summary: n.summary,
                source: n.source,
                publishedAt: n.publishedAt,
                url: n.url,
              })),
            });
          }
          case 'regulatory_news': {
            const updates = await marketClient.getRegulatoryNews();
            return JSON.stringify({
              updates: updates.slice(0, 5).map(u => ({
                title: u.title,
                summary: u.summary,
                source: u.source,
                publishedAt: u.publishedAt,
                url: u.url,
              })),
            });
          }
          default:
            return JSON.stringify({ error: `Okänd marknadsdata-typ: ${toolInput.type}` });
        }
      }

      case 'lookup_security': {
        const { performEnrichedLookup } = await import('@/lib/integrations/securities');
        
        if (!toolInput.isin && !toolInput.ticker) {
          return JSON.stringify({ error: 'Ange antingen ISIN eller ticker' });
        }
        
        const result = await performEnrichedLookup(
          toolInput.isin || '',
          toolInput.ticker || '',
        );
        
        if (!result.success || !result.data) {
          return JSON.stringify({ 
            error: `Kunde inte hitta värdepappret`,
            errors: result.errors,
          });
        }
        
        const d = result.data;
        return JSON.stringify({
          name: d.name?.value,
          isin: d.isin?.value,
          ticker: d.ticker?.value,
          type: d.type?.value,
          category: d.category?.value,
          securityType: d.securityType?.value,
          exchange: d.exchangeName?.value,
          isRegulatedMarket: d.isRegulatedMarket?.value,
          country: d.countryName?.value || d.country?.value,
          currency: d.currency?.value,
          gicsSector: d.gicsSector?.value,
          industry: d.industry?.value,
          marketCap: d.marketCap?.value,
          currentPrice: d.currentPrice?.value,
          averageDailyVolume: d.averageDailyVolume?.value,
          averageDailyValueSEK: d.averageDailyValueSEK?.value,
          meetsLiquidityPresumption: d.meetsLiquidityPresumption?.value,
          sourcesUsed: result.sourcesUsed,
        });
      }

      case 'search_internal_knowledge': {
        const results = await findRelevantKnowledge(toolInput.query, 5);
        
        if (results.length === 0) {
          return JSON.stringify({ 
            results: [],
            message: `Ingen intern kunskap hittades för: "${toolInput.query}"` 
          });
        }
        
        return JSON.stringify({
          resultCount: results.length,
          results: results.map(r => ({
            title: r.title,
            category: r.category,
            content: r.content?.substring(0, 2000) || '',
            sharedBy: r.sharedByName || r.sharedByEmail || 'Okänd',
            createdAt: r.createdAt,
          })),
        });
      }

      case 'review_document': {
        const docx = options?.docxAttachment;
        if (!docx) {
          return JSON.stringify({
            success: false,
            error: 'Inget Word-dokument är bifogat. Bifoga en .docx-fil och be användaren granska den.',
          });
        }
        try {
          const { runReviewDocx } = await import('@/lib/docx/review-docx');
          const result = await runReviewDocx({
            fileBufferBase64: docx.rawBase64,
            fileName: docx.fileName,
            instructions: toolInput.instructions || 'Granska dokumentet och föreslå ändringar.',
            documentText: docx.documentText,
            paragraphs: docx.paragraphs,
          });
          return JSON.stringify(result);
        } catch (err) {
          console.error('[AI Chat Tool] review_document error:', err);
          return JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : 'Kunde inte granska dokumentet.',
          });
        }
      }

      default:
        return JSON.stringify({ error: `Okänt verktyg: ${toolName}` });
    }
  } catch (error) {
    console.error(`[AI Chat Tool] Error executing ${toolName}:`, error);
    return JSON.stringify({ 
      error: `Fel vid anrop av ${toolName}: ${error instanceof Error ? error.message : 'Okänt fel'}` 
    });
  }
}

// =============================================================================
// MAIN API HANDLER
// =============================================================================

export const maxDuration = 300; // 5 min – document review (review_document) can exceed 2 min

export async function POST(request: NextRequest) {
  const usageTimer = createUsageTimer();
  let userId = 'anonymous';
  
  // Auth
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

  // Rate limit
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

    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    const currentYear = today.getFullYear();

    // =========================================================================
    // BUILD SYSTEM PROMPT (slimmer - tools handle data fetching now)
    // =========================================================================
    const systemPrompt = `Du är en expert AI-assistent för AIFM Group, ett svenskt fondbolag med alla nödvändiga tillstånd från Finansinspektionen.

DAGENS DATUM: ${currentDate}
AKTUELLT ÅR: ${currentYear}

SPRÅK: Matcha användarens språk (svensk fråga = svenskt svar, engelsk fråga = engelskt svar).

ROLL: Du är en komplett AI-assistent för hela AIFM Group med tillgång till verktyg som du kan använda för att hämta data i realtid.

DU HAR TILLGÅNG TILL FÖLJANDE VERKTYG:

🌱 ESG & HÅLLBARHET (via Datia API):
- get_esg_data: Hämta ESG-scores, SFDR-klassificering, koldioxidintensitet m.m.
- get_exclusion_screening: Kontrollera exkluderingskriterier (vapen, tobak, fossilt etc.)
- get_pai_indicators: Hämta PAI-indikatorer (GHG, biodiversitet, sociala faktorer etc.)

📋 KUNSKAPSBAS & DOKUMENT:
- search_knowledge_base: Sök i compliance-dokument, regelverk (FFFS, AIFMD, UCITS), policyer
- search_internal_knowledge: Sök i teamets delade kunskap och best practices

📈 MARKNADSDATA:
- get_market_data: Aktuella priser (guld, silver, valutor), nyheter, regulatoriska uppdateringar

🔍 VÄRDEPAPPER:
- lookup_security: Slå upp värdepapper via ISIN/ticker (namn, börs, sektor, likviditet etc.)

VIKTIGA REGLER FÖR VERKTYGSANVÄNDNING:

1. ANVÄND ALLTID verktyg när du behöver specifik data. Gissa ALDRIG information som kan hämtas.
2. Om användaren nämner ett värdepapper (ISIN, ticker eller namn), ANVÄND get_esg_data och/eller lookup_security.
3. Om användaren frågar om regelverk eller policyer, ANVÄND search_knowledge_base.
4. Du kan använda FLERA verktyg i samma svar om det behövs.
5. Om användaren har bifogat ett Word-dokument (.docx) och ber om granskning, revidering eller ändringar i dokumentet, använd verktyget review_document med användarens instruktioner. Det returnerar en modifierad fil med spårändringar och kommentarer.
6. Om ett verktyg returnerar ett fel, informera användaren och föreslå alternativ.
7. Presentera ALLTID data med källhänvisning (t.ex. "Enligt data från Datia..." eller "Enligt FFFS 2013:10...").

PRIORITERINGSORDNING FÖR SVAR:

1️⃣ HÖGSTA PRIORITET - Data från verktyg (realtidsdata, kunskapsbas)
2️⃣ ANDRA PRIORITET - Officiella källor (Riksdagen, FI, EU)
3️⃣ TREDJE PRIORITET - Generell kunskap (markera tydligt)

⚠️ VARNINGAR:
• GISSA ALDRIG paragrafnummer - sök i kunskapsbasen istället
• HITTA ALDRIG PÅ information
• Om du inte vet, SÄG DET TYDLIGT
• Rekommendera alltid verifiering mot originalkällor för juridiska tolkningar

REFERENSLÄNKAR (använd om kunskapsbasen saknar info):
• LAIF (2013:561): https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2013561-om-forvaltare-av-alternativa_sfs-2013-561/
• LVF (2004:46): https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-200446-om-vardepappersfonder_sfs-2004-46/
• FFFS 2013:10: https://www.fi.se/contentassets/b0c0d859e4b3440b9876f5f68561db0f/fs1310k-250221.pdf
• FFFS 2013:9: https://www.fi.se/contentassets/aee63096054746a19acebb1e2c4f1536/fs1309k-250221.pdf
• SFDR: https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32019R2088

SVARSFORMAT - ANPASSA EFTER FRÅGAN:

KORT FRÅGA (hälsning, enkel fråga, bekräftelse, test):
- Svara kort och naturligt, som i en vanlig konversation
- INGEN formatering, INGA bullet points, INGA rubriker, INGA emojis
- INGA följdfrågor
- Max 1-3 meningar

MEDELLÅNG FRÅGA (specifik fråga om ett ämne):
- Svara koncist med relevant information
- Använd formatering BARA om det verkligen hjälper läsbarheten
- Lägg till 2-3 följdfrågor om relevant

KOMPLEX FRÅGA (djupgående analys, regelverk, jämförelser):
1. Börja med en kort sammanfattning
2. Ge detaljerad information med källhänvisningar
3. Referera med dokumentets faktiska namn (ALDRIG "[Källa 1]")
4. Avsluta med praktiska rekommendationer om relevant
5. Lägg till följdfrågor

GENERELLA REGLER:
- Använd ALDRIG emojis i bullet points (skriv inte "🌱 ESG" utan bara "ESG")
- Överformatera ALDRIG - om svaret kan ges i löpande text, gör det
- Bullet points BARA när det finns 3+ jämförbara punkter
- Rubriker BARA för längre svar med tydliga sektioner

PDF/EXCEL EXPORT: Strukturera med ## rubriker och | tabeller |.

DIAGRAM: Använd Mermaid-diagram i kodblock när det hjälper visualisera samband.

${body.templateId && TEMPLATE_SYSTEM_ADDITIONS[body.templateId] ? TEMPLATE_SYSTEM_ADDITIONS[body.templateId] : ''}
${body.responseLength ? `\nSVARSLÄNGD: Användaren önskar ett ${body.responseLength === 'short' ? 'kort' : body.responseLength === 'medium' ? 'medellångt' : 'långt'} svar. Anpassa omfattningen därefter (kort = koncis, medel = balanserat, långt = utförligt med förklaringar).` : ''}

SÄKERHET: All data stannar inom AWS-kontot via Bedrock.`;

    // =========================================================================
    // BUILD MESSAGES for Converse API
    // =========================================================================
    const truncatedUserMessage = truncateContent(userMessage);
    const imageAttachments: ImageAttachment[] = body.images || [];
    const hasImages = imageAttachments.length > 0;

    // Convert history to Converse API format
    const converseMessages: Message[] = [];
    
    for (const msg of (body.history || [])) {
      const text = truncateContent(msg.content);
      // Bedrock rejects empty text fields – skip messages with no content
      if (!text) continue;
      // Bedrock requires alternating user/assistant – skip if same role as previous
      const prevRole = converseMessages.length > 0 ? converseMessages[converseMessages.length - 1].role : undefined;
      if (prevRole === msg.role) continue;
      const contentBlocks: ContentBlock[] = [{ text }];
      converseMessages.push({
        role: msg.role,
        content: contentBlocks,
      });
    }
    // Ensure history ends with a user message (trim trailing assistant messages)
    while (converseMessages.length > 0 && converseMessages[converseMessages.length - 1].role === 'assistant') {
      converseMessages.pop();
    }

    // Build current user message
    const userContentBlocks: ContentBlock[] = [];
    
    if (hasImages) {
      for (const img of imageAttachments) {
        userContentBlocks.push({
          image: {
            format: img.mediaType.split('/')[1] as 'png' | 'jpeg' | 'gif' | 'webp',
            source: {
              bytes: Buffer.from(img.data, 'base64'),
            },
          },
        });
      }
    }
    
    userContentBlocks.push({ text: truncatedUserMessage });
    converseMessages.push({ role: 'user', content: userContentBlocks });

    console.log(`[AI Chat] Starting tool-calling conversation: ${truncatedUserMessage.substring(0, 100)}...`);

    const modelId = 'eu.anthropic.claude-opus-4-6-v1';
    const MAX_TOOL_ROUNDS = 8;
    const encoder = new TextEncoder();
    const streamHeaders = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' as const };

    const stream = new ReadableStream({
      async start(controller) {
        const push = (o: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`));
        let toolRound = 0;
        let toolsUsed: string[] = [];
        let reviewedDocxResult: { fileBase64: string; fileName: string; summary: string } | null = null;
        const kbCitations: Array<{ documentTitle: string; documentNumber?: string; section?: string; excerpt: string; sourceUrl: string }> = [];
        const systemBlocks: SystemContentBlock[] = [{ text: systemPrompt }];
        let messages = [...converseMessages];

        const progressLabels: Record<string, string> = {
          get_esg_data: 'Hämtar ESG-data...',
          get_exclusion_screening: 'Kontrollerar exkluderingskriterier...',
          get_pai_indicators: 'Hämtar PAI-indikatorer...',
          search_knowledge_base: 'Söker i regelverk och kunskapsbas...',
          get_market_data: 'Hämtar marknadsdata...',
          lookup_security: 'Slår upp värdepapper...',
          search_internal_knowledge: 'Söker i intern kunskap...',
          review_document: 'Granskar dokument...',
        };

        try {
          push({ progress: 'Förbereder...', meta: true });

          while (toolRound < MAX_TOOL_ROUNDS) {
            toolRound++;
            push({ progress: toolRound === 1 ? 'Tänker...' : 'Analyserar...' });
            console.log(`[AI Chat] Tool round ${toolRound}/${MAX_TOOL_ROUNDS}, messages: ${messages.length}`);

            // ── Stream the Bedrock response token-by-token ──
            // We always stream; text tokens are pushed to the client live.
            // If Claude decides to call a tool, we send a clearText event so the
            // client resets the displayed text (the "thinking" text before a tool
            // call is not the final answer).
            const streamResponse = await withRetry(() =>
              bedrockClient.send(new ConverseStreamCommand({
                modelId,
                system: systemBlocks,
                messages,
                toolConfig: TOOL_DEFINITIONS,
                inferenceConfig: { maxTokens: 16384 },
              }))
            );

            // Collect the full output so we can add it to `messages` for tool loops
            const outputContentBlocks: ContentBlock[] = [];
            let currentTextBlock = '';
            let stopReason: string | undefined;
            let currentToolUseId: string | undefined;
            let currentToolName: string | undefined;
            let currentToolInputJson = '';
            let textPushedThisRound = false;

            if (streamResponse.stream) {
              for await (const event of streamResponse.stream) {
                // New content block starting
                if (event.contentBlockStart) {
                  const startBlock = event.contentBlockStart.start;
                  if (startBlock?.toolUse) {
                    if (currentTextBlock) {
                      outputContentBlocks.push({ text: currentTextBlock });
                      currentTextBlock = '';
                    }
                    currentToolUseId = startBlock.toolUse.toolUseId;
                    currentToolName = startBlock.toolUse.name;
                    currentToolInputJson = '';
                    const label = progressLabels[currentToolName || ''] ?? 'Arbetar...';
                    // If we already pushed text this round, clear it – it was just
                    // Claude's reasoning before deciding to call a tool.
                    if (textPushedThisRound) {
                      push({ clearText: true });
                      textPushedThisRound = false;
                    }
                    push({ progress: label });
                  }
                }

                // Incremental delta for current block
                if (event.contentBlockDelta?.delta) {
                  const delta = event.contentBlockDelta.delta;
                  if (delta.text) {
                    currentTextBlock += delta.text;
                    push({ text: delta.text });
                    textPushedThisRound = true;
                  }
                  if (delta.toolUse) {
                    currentToolInputJson += delta.toolUse.input ?? '';
                  }
                }

                // Content block finished
                if (event.contentBlockStop !== undefined) {
                  if (currentToolUseId && currentToolName) {
                    let parsedInput = {};
                    try { parsedInput = JSON.parse(currentToolInputJson || '{}'); } catch { /* ignore */ }
                    outputContentBlocks.push({
                      toolUse: {
                        toolUseId: currentToolUseId,
                        name: currentToolName,
                        input: parsedInput,
                      },
                    });
                    currentToolUseId = undefined;
                    currentToolName = undefined;
                    currentToolInputJson = '';
                  } else if (currentTextBlock) {
                    outputContentBlocks.push({ text: currentTextBlock });
                    currentTextBlock = '';
                  }
                }

                if (event.messageStop) {
                  stopReason = event.messageStop.stopReason;
                }
              }
            }

            if (currentTextBlock) {
              outputContentBlocks.push({ text: currentTextBlock });
              currentTextBlock = '';
            }

            // Filter out any empty text blocks – Bedrock rejects blank text fields
            const cleanedBlocks = outputContentBlocks.filter(b => {
              if ('text' in b && typeof b.text === 'string' && b.text === '') return false;
              return true;
            });

            const outputMessage: Message = { role: 'assistant', content: cleanedBlocks.length > 0 ? cleanedBlocks : [{ text: '...' }] };
            messages.push(outputMessage);

            // ── Handle tool_use if Claude requested tools ──
            if (stopReason === 'tool_use') {
              // Clear any streamed text – it was mid-thought, not the final answer
              if (textPushedThisRound) {
                push({ clearText: true });
              }

              const toolUseBlocks = outputContentBlocks.filter(
                (block): block is ContentBlock & { toolUse: NonNullable<ContentBlock['toolUse']> } =>
                  block.toolUse !== undefined
              );

              if (toolUseBlocks.length === 0) {
                console.warn('[AI Chat] tool_use stop reason but no tool blocks found');
                break;
              }

              const toolResults = await Promise.all(
                toolUseBlocks.map(async (block) => {
                  const toolName = block.toolUse.name!;
                  const toolInput = (block.toolUse.input || {}) as Record<string, any>;
                  const toolUseId = block.toolUse.toolUseId!;

                  toolsUsed.push(toolName);
                  const toolLabel = progressLabels[toolName] ?? 'Arbetar...';
                  // Build a short summary of what the tool was called with
                  const toolInputSummary = toolInput.query || toolInput.identifier || toolInput.isin || toolInput.ticker || toolInput.type || '';
                  push({ progress: toolLabel });
                  push({ toolCall: { name: toolName, label: toolLabel, input: String(toolInputSummary).slice(0, 200) } });
                  console.log(`[AI Chat] Calling tool: ${toolName} (id: ${toolUseId})`);

                  const startMs = Date.now();
                  const resultStr = await executeTool(toolName, toolInput, { docxAttachment: body.docxAttachment });
                  const durationMs = Date.now() - startMs;
                  push({ toolCallDone: { name: toolName, durationMs } });

                  // Build the tool result for Claude's context (strip large binary data)
                  let toolResultForClaude: Record<string, unknown> = JSON.parse(resultStr);

                  if (toolName === 'review_document') {
                    try {
                      if (toolResultForClaude.success && toolResultForClaude.fileBase64) {
                        // Capture the full result for the frontend download
                        reviewedDocxResult = {
                          fileBase64: toolResultForClaude.fileBase64 as string,
                          fileName: (toolResultForClaude.fileName as string) || 'document_reviewed.docx',
                          summary: (toolResultForClaude.summary as string) || '',
                        };
                        // Remove the huge base64 blob before sending back to Claude
                        // (305k+ tokens otherwise, exceeding 200k limit)
                        toolResultForClaude = {
                          success: true,
                          fileName: reviewedDocxResult.fileName,
                          summary: reviewedDocxResult.summary,
                          note: 'Dokumentet har granskats och modifierats med spårändringar och kommentarer. Filen levereras till användaren separat.',
                        };
                      }
                    } catch { /* ignore */ }
                  }

                  if (toolName === 'search_knowledge_base') {
                    try {
                      const parsed = toolResultForClaude as Record<string, unknown>;
                      if (Array.isArray(parsed.results)) {
                        for (const r of parsed.results as Array<Record<string, string>>) {
                          if (r.title) {
                            kbCitations.push({
                              documentTitle: r.title,
                              documentNumber: r.documentNumber || '',
                              section: r.category || '',
                              excerpt: r.content?.substring(0, 200) || '',
                              sourceUrl: r.url || '#',
                            });
                          }
                        }
                      }
                    } catch { /* ignore parse errors */ }
                  }

                  const toolResultContent: ToolResultContentBlock[] = [{ json: toolResultForClaude }];
                  return { toolUseId, content: toolResultContent };
                })
              );

              const toolResultBlocks: ContentBlock[] = toolResults.map(tr => ({
                toolResult: {
                  toolUseId: tr.toolUseId,
                  content: tr.content,
                },
              }));

              messages.push({ role: 'user', content: toolResultBlocks });
              continue;
            }

            // No more tools – final response already streamed live to the client
            console.log(`[AI Chat] Tool loop complete. Tools used: ${toolsUsed.join(', ') || 'none'}`);
            break;
          }

          push({
            meta: true,
            kbSearched: kbCitations.length > 0,
            kbResultsCount: kbCitations.length,
            internalKBResultsCount: 0,
            citations: kbCitations,
            internalSources: [],
            toolsUsed,
            reviewedDocx: reviewedDocxResult,
          });

          push({ done: true, citations: kbCitations, toolsUsed });
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();

          trackAIUsage({
            userId,
            timestamp: new Date().toISOString(),
            requestType: 'chat',
            modelId,
            responseTimeMs: usageTimer.getElapsedMs(),
            success: true,
          });
        } catch (err) {
          console.error('[AI Chat] Stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Streaming error' })}\n\n`));
          controller.close();
          trackAIUsage({
            userId,
            timestamp: new Date().toISOString(),
            requestType: 'chat',
            modelId,
            responseTimeMs: usageTimer.getElapsedMs(),
            success: false,
            errorMessage: err instanceof Error ? err.message : 'Streaming error',
          });
        }
  },
});

    return new Response(stream, { headers: streamHeaders });

  } catch (error) {
    const errorMessage = (error as Error).message || '';
    const errorName = (error as Error).name || '';
    console.error('[AI Chat] Error:', errorName, errorMessage.slice(0, 300));
    
    trackAIUsage({
      userId,
      timestamp: new Date().toISOString(),
      requestType: 'chat',
      modelId: 'unknown',
      responseTimeMs: usageTimer.getElapsedMs(),
      success: false,
      errorMessage: errorMessage.slice(0, 200),
    });
    
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

    if (errorName === 'ThrottlingException' || errorMessage.toLowerCase().includes('throttl')) {
      return new Response(JSON.stringify({
        error: errorMessage,
        response: 'AI-tjänsten är tillfälligt överbelastad. Försök igen om en minut.',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (errorMessage.includes('ValidationException') || errorMessage.includes('text field is blank')) {
      return new Response(JSON.stringify({
        error: errorMessage,
        response: 'Ogiltig eller tom konversation. Skriv en ny fråga och försök igen.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: errorMessage,
      response: 'Ett fel uppstod. Försök igen; om felet kvarstår, kontakta support.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
