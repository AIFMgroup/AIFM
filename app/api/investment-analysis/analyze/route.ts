import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  TextractClient,
  DetectDocumentTextCommand,
} from '@aws-sdk/client-textract';
import * as XLSX from 'xlsx';
import { getESGFundConfig } from '@/lib/integrations/securities/esg-fund-configs';
import { getFundDocumentText } from '@/lib/fund-documents/fund-document-store';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const TEXTRACT_REGION = 'eu-west-1';
const textractClient = new TextractClient({
  region: TEXTRACT_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const MAX_FILE_SIZE_MB = 50;
const MAX_FILES = 20;
const TEXTRACT_MAX_BYTES = 5 * 1024 * 1024;
const CHUNK_CHARS = 100_000;
const MIN_PDF_TEXT_LENGTH = 200;

let mammoth: typeof import('mammoth') | null = null;
let pdfParse: ((buffer: Buffer) => Promise<{ text: string; numpages?: number }>) | null = null;

// ---------------------------------------------------------------------------
// Document extraction (reused from ESG pattern)
// ---------------------------------------------------------------------------

async function extractFromPdfWithOCR(buffer: Buffer): Promise<string> {
  let text = '';
  try {
    if (!pdfParse) {
      const mod = await import('pdf-parse');
      pdfParse = mod.default;
    }
    const data = await pdfParse(buffer);
    text = (data?.text || '').trim();
  } catch (e) {
    console.warn('[InvestmentAnalysis] pdf-parse failed, will try Textract:', e);
  }

  if (text.length >= MIN_PDF_TEXT_LENGTH) return text;

  console.log('[InvestmentAnalysis] pdf-parse gave too little text, trying Textract OCR...');
  try {
    if (buffer.length > TEXTRACT_MAX_BYTES) {
      return text || '[PDF:en är för stor för OCR (>5 MB). Ladda upp en mindre fil eller en digital PDF.]';
    }
    const response = await textractClient.send(
      new DetectDocumentTextCommand({ Document: { Bytes: buffer } })
    );
    const ocrLines: string[] = [];
    for (const block of response.Blocks || []) {
      if (block.BlockType === 'LINE' && block.Text) ocrLines.push(block.Text);
    }
    const ocrText = ocrLines.join('\n').trim();
    if (ocrText.length >= MIN_PDF_TEXT_LENGTH) return ocrText;
    return text || '[PDF gav för lite text.]';
  } catch (e) {
    console.error('[InvestmentAnalysis] Textract OCR failed:', e);
    return text || '[Kunde inte läsa PDF-filen.]';
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    if (!mammoth) mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value || '').trim();
    return text.length > 50 ? text : '[Word-dokument verkar tomt.]';
  } catch (e) {
    console.error('[InvestmentAnalysis] DOCX error:', e);
    return '[Kunde inte läsa Word-filen.]';
  }
}

async function extractFromExcel(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const lines: string[] = [`Excel: ${fileName}`, `Flikar: ${workbook.SheetNames.join(', ')}`, ''];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      lines.push(`--- ${name} ---`);
      json.slice(0, 500).forEach((row, i) => {
        const cells = (row as unknown[]).map((c) =>
          c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? '')
        );
        if (cells.some(Boolean)) lines.push(`[${i + 1}] ${cells.join(' | ')}`);
      });
      if (json.length > 500) lines.push(`... (${json.length - 500} fler rader)`);
    }
    return lines.join('\n');
  } catch (e) {
    console.error('[InvestmentAnalysis] Excel error:', e);
    return '[Kunde inte läsa Excel-filen.]';
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return extractFromPdfWithOCR(buffer);
  if (name.endsWith('.docx') || name.endsWith('.doc')) return extractFromDocx(buffer);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return extractFromExcel(buffer, file.name || '');
  return '[Filtypen stöds inte. Använd PDF, Word eller Excel.]';
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length);
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      if (lastParagraph > offset + maxChars * 0.6) {
        end = lastParagraph;
      } else {
        const lastNewline = text.lastIndexOf('\n', end);
        if (lastNewline > offset + maxChars * 0.6) end = lastNewline;
      }
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Claude helpers
// ---------------------------------------------------------------------------

const MODEL_CANDIDATES = [
  'eu.anthropic.claude-opus-4-6-v1',
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 50000,
): Promise<string | null> {
  for (const modelId of MODEL_CANDIDATES) {
    try {
      const command = new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        inferenceConfig: { maxTokens },
      });
      const response = await bedrockClient.send(command);
      const outputContent = response.output?.message?.content;
      if (outputContent?.[0] && 'text' in outputContent[0]) {
        return outputContent[0].text ?? null;
      }
      return null;
    } catch (err) {
      console.warn(`[InvestmentAnalysis] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  let cleaned = text;
  const fenceStart = cleaned.indexOf('```');
  if (fenceStart !== -1) {
    const afterFence = cleaned.indexOf('\n', fenceStart);
    if (afterFence !== -1) {
      const fenceEnd = cleaned.lastIndexOf('```');
      cleaned = fenceEnd > afterFence ? cleaned.slice(afterFence + 1, fenceEnd) : cleaned.slice(afterFence + 1);
    }
  }
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,\s*([\]}])/g, '$1'));
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Analysis sections definition
// ---------------------------------------------------------------------------

const ANALYSIS_SECTIONS = [
  'executiveSummary',
  'companyOverview',
  'businessModel',
  'marketPosition',
  'financialAnalysis',
  'valuationMetrics',
  'managementGovernance',
  'esgAssessment',
  'riskAnalysis',
  'swotAnalysis',
  'investmentThesis',
  'prosAndCons',
  'conclusion',
] as const;

// ---------------------------------------------------------------------------
// Build prompt
// ---------------------------------------------------------------------------

function formatApiData(lookupData?: Record<string, unknown>, esgData?: Record<string, unknown>): string {
  const parts: string[] = [];

  if (lookupData && Object.keys(lookupData).length > 0) {
    parts.push('=== DATA FRÅN INTERNA API:ER (Securities Lookup) ===');
    const fields: Array<[string, string]> = [
      ['Namn', String(lookupData.name || '')],
      ['Ticker', String(lookupData.ticker || '')],
      ['ISIN', String(lookupData.isin || '')],
      ['MIC/Börs', `${lookupData.mic || ''} ${lookupData.exchangeName || ''}`],
      ['Typ', String(lookupData.securityType || lookupData.type || '')],
      ['Kategori', String(lookupData.category || '')],
      ['Sektor (GICS)', String(lookupData.gicsSector || '')],
      ['Bransch', String(lookupData.industry || '')],
      ['Land', `${lookupData.countryName || lookupData.country || ''}`],
      ['Valuta', String(lookupData.currency || '')],
      ['Emittent', String(lookupData.emitter || '')],
      ['LEI', String(lookupData.emitterLEI || '')],
      ['Börsvärde', lookupData.marketCap ? String(lookupData.marketCap) : ''],
      ['Aktuell kurs', lookupData.currentPrice ? String(lookupData.currentPrice) : ''],
      ['Snittvolym/dag', lookupData.averageDailyVolume ? String(lookupData.averageDailyVolume) : ''],
      ['Snittvolym/dag (SEK)', lookupData.averageDailyValueSEK ? String(lookupData.averageDailyValueSEK) : ''],
      ['Reglerad marknad', lookupData.isRegulatedMarket != null ? String(lookupData.isRegulatedMarket) : ''],
      ['Noteringstyp', String(lookupData.listingType || '')],
      ['Uppfyller likviditetspresumtion', lookupData.meetsLiquidityPresumption != null ? String(lookupData.meetsLiquidityPresumption) : ''],
    ];
    for (const [label, val] of fields) {
      if (val && val !== 'undefined' && val !== 'null' && val.trim()) {
        parts.push(`${label}: ${val.trim()}`);
      }
    }
  }

  if (esgData && Object.keys(esgData).length > 0) {
    parts.push('');
    parts.push('=== ESG-DATA FRÅN API ===');
    const esgFields: Array<[string, string]> = [
      ['ESG-leverantör', String(esgData.provider || '')],
      ['Total ESG-poäng', esgData.totalScore != null ? String(esgData.totalScore) : ''],
      ['Miljö (E)', esgData.environmentScore != null ? String(esgData.environmentScore) : ''],
      ['Socialt (S)', esgData.socialScore != null ? String(esgData.socialScore) : ''],
      ['Styrning (G)', esgData.governanceScore != null ? String(esgData.governanceScore) : ''],
      ['Kontroversnivå', esgData.controversyLevel != null ? String(esgData.controversyLevel) : ''],
      ['SFDR-klassificering', String(esgData.sfdrAlignment || '')],
      ['Taxonomianpassning (%)', esgData.taxonomyAlignmentPercent != null ? String(esgData.taxonomyAlignmentPercent) : ''],
      ['Koldioxidintensitet', esgData.carbonIntensity != null ? `${esgData.carbonIntensity} ${esgData.carbonIntensityUnit || ''}` : ''],
      ['Uppfyller exkluderingskriterier', esgData.meetsExclusionCriteria != null ? String(esgData.meetsExclusionCriteria) : ''],
    ];
    for (const [label, val] of esgFields) {
      if (val && val !== 'undefined' && val !== 'null' && val.trim()) {
        parts.push(`${label}: ${val.trim()}`);
      }
    }

    if (esgData.exclusionFlags && typeof esgData.exclusionFlags === 'object') {
      const flags = esgData.exclusionFlags as Record<string, boolean>;
      const flagged = Object.entries(flags).filter(([, v]) => v).map(([k]) => k);
      if (flagged.length > 0) {
        parts.push(`Exkluderingsflaggor: ${flagged.join(', ')}`);
      }
    }

    if (esgData.ghgScopes && typeof esgData.ghgScopes === 'object') {
      const scopes = esgData.ghgScopes as Record<string, unknown>;
      parts.push(`GHG Scope 1: ${scopes.scope1 ?? 'N/A'}, Scope 2: ${scopes.scope2 ?? 'N/A'}, Scope 3: ${scopes.scope3 ?? 'N/A'}`);
    }

    if (Array.isArray(esgData.paiIndicators) && esgData.paiIndicators.length > 0) {
      parts.push('PAI-indikatorer:');
      for (const pai of esgData.paiIndicators.slice(0, 20)) {
        const p = pai as Record<string, unknown>;
        parts.push(`  - ${p.name || p.id}: ${p.value ?? 'N/A'} ${p.unit || ''}`);
      }
    }
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

function buildSystemPrompt(sfdrArticle?: string, investmentStrategy?: string, fundTermsBlock?: string): string {
  const sfdrNote =
    sfdrArticle === '6'
      ? 'Fonden klassificeras som SFDR Artikel 6 (inga särskilda hållbarhetskrav). ESG-bedömningen ska fokusera på grundläggande risker.'
      : sfdrArticle === '8'
        ? 'Fonden klassificeras som SFDR Artikel 8 (främjar miljö-/sociala egenskaper). ESG-bedömningen ska vara mer krävande — bolaget måste aktivt främja E/S-egenskaper.'
        : sfdrArticle === '9'
          ? 'Fonden klassificeras som SFDR Artikel 9 (hållbart investeringsmål). ESG-bedömningen ska vara STRIKT — bolaget MÅSTE ha verifierbart hållbart investeringsmål, låg koldioxidintensitet och hög taxonomianpassning.'
          : '';

  const strategyNote = investmentStrategy
    ? `\nINVESTERINGSSTRATEGI: ${investmentStrategy}\nAnpassa analysen efter denna strategi. Bedöm specifikt hur bolaget passar in i denna strategi.`
    : '';

  const fundTermsNote = fundTermsBlock
    ? `\n\nKRITISKT – FONDVILLKOR OCH EXKLUDERINGSPOLICY:
Du MÅSTE läsa igenom och beakta fondvillkoren nedan i hela analysen.
1. EXKLUDERINGSKRITERIER: Varje kategori har ett gränsvärde (%). Exponering UNDER gränsvärdet = GODKÄND. Exponering ÖVER = UNDERKÄND. 0% = nolltolerans.
2. PLACERINGSSTRATEGIN: Bedöm hur bolaget passar fondens syfte och placeringsstrategi.
3. I esgAssessment-sektionen: Utvärdera varje exkluderingskategori specifikt mot fondens gränsvärden med siffror.
4. I conclusion-sektionen: Inkludera en fondvillkorkontroll med tydligt godkänd/underkänd.

${fundTermsBlock}`
    : '';

  return `Du är en av världens främsta investeringsanalytiker med 25+ års erfarenhet av institutionell kapitalförvaltning. Du arbetar på AIFM Capital AB och producerar investeringsanalyser som håller samma kvalitet som Goldman Sachs, Morgan Stanley och JP Morgan.

${sfdrNote ? `SFDR-KONTEXT: ${sfdrNote}` : ''}${strategyNote}${fundTermsNote}

DIN ANALYTISKA FILOSOFI:
- Var KONTRÄR — ifrågasätt konsensus och leta efter vad marknaden missar
- Var KVANTITATIV — varje påstående ska stödjas av siffror
- Var ÄRLIG — en bra analys identifierar lika många risker som möjligheter
- Var FRAMÅTBLICKANDE — historik är intressant men framtiden avgör investeringsbeslutet
- Var SPECIFIK — undvik generiska fraser som "stark marknadsposition" utan att kvantifiera

Du ska returnera ett JSON-objekt med följande sektioner. Varje sektion ska innehålla rik, detaljerad text (minst 5-8 meningar per sektion). Skriv på svenska.

SEKTIONER:

1. "executiveSummary" – Sammanfattning med tydlig rekommendation (STARK KÖP / KÖP / AVVAKTA / SÄLJ / STARK SÄLJ). Inkludera: (a) kärnargumentet i en mening, (b) 2-3 avgörande faktorer, (c) den viktigaste risken, (d) rekommenderad portföljvikt och tidshorisont. Max 6-8 meningar.

2. "companyOverview" – Bolagsbeskrivning: namn, bransch, grundat, huvudkontor, antal anställda, marknader, börslista, ägarstruktur. Beskriv bolagets "DNA" — vad gör det unikt?

3. "businessModel" – Affärsmodell: intäktsströmmar (med ungefärlig fördelning i %), kundsegment, konkurrensfördelar (moats), skalbarhet, recurring revenue-andel, kundkoncentration. Bedöm affärsmodellens KVALITET på en skala.

4. "marketPosition" – Marknadsposition: marknadsandel (kvantifiera!), topp-3 konkurrenter med jämförelse, adresserbar marknad (TAM/SAM/SOM), strukturella trender, tillväxtpotential. Var specifik med marknadsstorlek och tillväxttakt.

5. "financialAnalysis" – Finansiell analys: omsättning och tillväxt (3-5 år trend), EBITDA-marginal (trend), nettomarginal, FCF-marginal, skuldsättning (nettoskuld/EBITDA), räntetäckningsgrad, ROE, ROIC, capex/omsättning. JÄMFÖR med branschsnitt och bästa peers. Identifiera den viktigaste finansiella trenden.

6. "valuationMetrics" – Värdering: P/E (trailing + forward om möjligt), EV/EBITDA, EV/Sales, P/FCF, utdelning och utdelningsandel, jämförelse med 3-5 peers. Historisk värderingsrange. ÄR AKTIEN DYR ELLER BILLIG? Ge ett tydligt svar med motivering. Uppskatta fair value om möjligt.

7. "managementGovernance" – Ledning & styrning: VD (bakgrund, tid i rollen, track record), styrelseordförande, ägarstruktur (topp-5 ägare med %), insiderägande, ersättningsnivåer vs bransch, eventuella kontroverser. Bedöm management-kvalitet.

8. "esgAssessment" – ESG-bedömning: miljöpåverkan (koldioxidintensitet, scope 1/2/3 om tillgängligt), socialt ansvar (anställda, leverantörskedja), bolagsstyrning (oberoende, mångfald), kontroverser, hållbarhetsrapportering (GRI/TCFD/CSRD), taxonomianpassning. Bedöm STRIKT utifrån fondens SFDR-klass. Om API-data finns, integrera ESG-scores och PAI-indikatorer.

9. "riskAnalysis" – Riskanalys med KVANTIFIERING: regulatoriska risker (sannolikhet + påverkan), marknadsrisker (beta, cykliskhet), operativa risker (leverantörsberoende, nyckelpersoner), finansiella risker (refinansiering, valuta), geopolitiska risker. Rangordna riskerna efter allvarlighetsgrad.

10. "swotAnalysis" – SWOT-analys som JSON-objekt med fyra arrayer: "strengths", "weaknesses", "opportunities", "threats". Minst 4-5 punkter per kategori. Varje punkt ska vara en specifik, kvantifierad mening — inte generisk.

11. "investmentThesis" – Investeringstes: (a) Bull case — vad händer om allt går rätt? Kvantifiera uppsida. (b) Base case — mest sannolikt scenario. (c) Bear case — vad kan gå fel? Kvantifiera nedsida. Ange sannolikheter om möjligt.

12. "prosAndCons" – JSON-objekt med två arrayer: "pros" och "cons". Minst 5-6 punkter vardera. Varje punkt ska vara en specifik, kvantifierad mening med källhänvisning.

13. "conclusion" – Slutsats: sammanfattande rekommendation med (a) rating, (b) rekommenderad portföljvikt, (c) tidshorisont, (d) entry/exit-kriterier, (e) vad som skulle ändra rekommendationen, (f) nästa uppföljningspunkt.

EXTRA FÄLT:
- "companyName" – Bolagets namn
- "ticker" – Ticker/börsnotering
- "sector" – Bransch/sektor
- "overallRating" – En av: "strong_buy", "buy", "hold", "sell", "strong_sell"
- "riskLevel" – En av: "low", "medium", "high", "very_high"
- "esgRating" – En av: "excellent", "good", "adequate", "poor", "critical"

REGLER:
- Svara ENDAST med ett giltigt JSON-objekt. Inga förklaringar utanför JSON.
- Alla textsektioner ska vara strängar med rik text.
- VIKTIGT FÖR FORMATERING: Använd styckeindelning (\\n\\n) mellan logiska avsnitt i varje textsektion. Varje sektion ska ha tydliga stycken — inte en enda lång textmassa. Dela upp i 2-4 stycken per sektion.
- swotAnalysis och prosAndCons ska vara objekt med arrayer av strängar.
- Om information saknas i dokumenten, skriv TYDLIGT vad som saknas och gör rimliga antaganden baserat på bransch. Markera antaganden med "[Antagande]".
- Var SPECIFIK med siffror, procent och trender — varje påstående ska ha ett datapunkt.
- Källhänvisning: Vid viktiga siffror, ange källa (t.ex. "Enligt årsredovisning 2024..." eller "API-data visar...").
- VIKTIGT: Om API-data (Securities Lookup, ESG-data, Yahoo Finance) medföljer, ANVÄND den aktivt. Integrera siffror, betyg och fakta från API:erna med dokumentdata för en komplett helhetsbild. API-data ger realtidsinformation som kompletterar dokumenten.
- KONTRÄR ANALYS: Identifiera minst 1 aspekt där du INTE håller med konsensus och motivera varför.`;
}

function buildMergePrompt(): string {
  return `Du är en investeringsanalytiker som slår ihop analysresultat. Du får flera JSON-objekt från olika delar av samma dokumentsamling. Slå ihop dem till ett enda sammanhängande JSON-objekt.

Regler:
- Per sektion: Välj det mest detaljerade och specifika innehållet. Föredra siffror, datum och konkreta fakta framför vaga formuleringar.
- Konflikthantering: Vid motstridiga uppgifter (t.ex. olika siffror), behåll den som har bättre källhänvisning eller som kommer från tydligt mer relevant dokument (t.ex. årsredovisning före pressmeddelande).
- Deduplicering: Ta bort upprepade meningar eller punkter. För swotAnalysis och prosAndCons, slå ihop till unika punkter utan dubbletter.
- Slå ihop information från olika chunks till sammanhängande text med styckeindelning (\\n\\n). Behåll alla viktiga siffror och fakta.
- Svara ENDAST med ett giltigt JSON-objekt. Inga kommentarer utanför JSON.`;
}

// ---------------------------------------------------------------------------
// Merge results
// ---------------------------------------------------------------------------

function mergeResults(
  results: Array<Record<string, unknown>>
): Record<string, unknown> {
  if (results.length === 1) return results[0];

  const merged: Record<string, unknown> = {};

  for (const result of results) {
    for (const [key, value] of Object.entries(result)) {
      if (value == null || value === '') continue;

      if (key === 'swotAnalysis' || key === 'prosAndCons') {
        const existing = merged[key] as Record<string, string[]> | undefined;
        const incoming = value as Record<string, string[]>;
        if (!existing) {
          merged[key] = incoming;
        } else {
          for (const [subKey, arr] of Object.entries(incoming)) {
            if (Array.isArray(arr)) {
              const existingArr = existing[subKey] || [];
              existing[subKey] = [...new Set([...existingArr, ...arr])];
            }
          }
        }
        continue;
      }

      const existingVal = merged[key];
      if (!existingVal || existingVal === '') {
        merged[key] = value;
      } else if (typeof value === 'string' && typeof existingVal === 'string' && value.length > existingVal.length) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      console.error('[InvestmentAnalysis] FormData parse error:', parseErr);
      return NextResponse.json(
        { error: 'Kunde inte läsa uppladdade filer.' },
        { status: 400 }
      );
    }

    const files = formData.getAll('files') as File[];
    if (!files?.length) {
      return NextResponse.json({ error: 'Inga filer skickades.' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Max ${MAX_FILES} filer tillåtna.` }, { status: 400 });
    }

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxBytes) {
        return NextResponse.json(
          { error: `Filen ${f.name} är för stor. Max ${MAX_FILE_SIZE_MB} MB.` },
          { status: 400 }
        );
      }
    }

    const acceptHeader = request.headers.get('accept') || '';
    const wantsStream = acceptHeader.includes('text/event-stream');

    let fileCategories: Array<{ name: string; category: string }> = [];
    const rawCategories = formData.get('fileCategories') as string;
    if (rawCategories) {
      try {
        fileCategories = JSON.parse(rawCategories);
      } catch { /* ignore */ }
    }

    const combinedParts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fc = fileCategories.find((c) => c.name === f.name);
      const categoryLabel = fc?.category || 'Övrigt';
      combinedParts.push(`\n\n=== Dokument ${i + 1} (${categoryLabel}): ${f.name} ===\n\n`);
      combinedParts.push(await extractTextFromFile(f));
    }
    const documentText = combinedParts.join('');

    const sfdrArticle = (formData.get('sfdrArticle') as string) || undefined;
    const investmentStrategy = (formData.get('investmentStrategy') as string) || undefined;
    const companyName = (formData.get('companyName') as string) || undefined;
    const isinCode = (formData.get('isin') as string) || undefined;
    const micCode = (formData.get('mic') as string) || undefined;
    const fundId = (formData.get('fundId') as string) || undefined;

    let fundTermsBlock: string | undefined;
    if (fundId) {
      try {
        const fundConfig = getESGFundConfig(fundId);
        const fundDocText = await getFundDocumentText(fundId);

        const parts: string[] = [];
        if (fundConfig) {
          parts.push(`FOND: ${fundConfig.fundName} (SFDR Artikel ${fundConfig.sfdrArticle})`);
          if (fundConfig.exclusions?.length) {
            parts.push('\nEXKLUDERINGSKRITERIER (fond-specifika):');
            for (const ex of fundConfig.exclusions) {
              parts.push(`  - ${ex.label || ex.category}: max ${ex.threshold}% av omsättning (0% = nolltolerans)`);
            }
          }
          if (fundConfig.promotedCharacteristics?.length) {
            parts.push(`\nFRÄMJADE EGENSKAPER: ${fundConfig.promotedCharacteristics.join(', ')}`);
          }
        }
        if (fundDocText) {
          const trimmed = fundDocText.length > 8000 ? fundDocText.slice(0, 8000) + '\n... (förkortat)' : fundDocText;
          parts.push(`\nFONDVILLKOR (utdrag):\n${trimmed}`);
        }
        if (parts.length > 0) {
          fundTermsBlock = parts.join('\n');
        }
      } catch (e) {
        console.warn('[InvestmentAnalysis] Fund terms fetch failed:', e);
      }
    }

    let lookupData: Record<string, unknown> | undefined;
    let esgApiData: Record<string, unknown> | undefined;

    const rawLookup = formData.get('lookupData') as string;
    if (rawLookup) {
      try { lookupData = JSON.parse(rawLookup); } catch { /* ignore */ }
    }
    const rawEsg = formData.get('esgData') as string;
    if (rawEsg) {
      try { esgApiData = JSON.parse(rawEsg); } catch { /* ignore */ }
    }

    // If we have ISIN but no lookup data yet, fetch it server-side
    if (isinCode && !lookupData) {
      try {
        const baseUrl = request.headers.get('x-forwarded-proto')
          ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
          : `http://${request.headers.get('host') || 'localhost:3000'}`;
        const lookupRes = await fetch(`${baseUrl}/api/securities/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isin: isinCode, mic: micCode }),
        });
        if (lookupRes.ok) {
          const json = await lookupRes.json();
          if (json.success && json.data) {
            lookupData = json.data;
            if (json.esgSummary) esgApiData = json.esgSummary;
          }
        }
      } catch (e) {
        console.warn('[InvestmentAnalysis] Server-side lookup failed:', e);
      }
    }

    if (isinCode && !esgApiData) {
      try {
        const baseUrl = request.headers.get('x-forwarded-proto')
          ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`
          : `http://${request.headers.get('host') || 'localhost:3000'}`;
        const esgRes = await fetch(`${baseUrl}/api/securities/esg?identifier=${encodeURIComponent(isinCode)}`);
        if (esgRes.ok) {
          const json = await esgRes.json();
          if (json.success && json.esgSummary) esgApiData = json.esgSummary;
        }
      } catch (e) {
        console.warn('[InvestmentAnalysis] Server-side ESG fetch failed:', e);
      }
    }

    const apiDataBlock = formatApiData(lookupData, esgApiData);

    console.log(`[InvestmentAnalysis] Total text: ${documentText.length} chars from ${files.length} file(s)${sfdrArticle ? `, SFDR Art. ${sfdrArticle}` : ''}${companyName ? `, Company: ${companyName}` : ''}${isinCode ? `, ISIN: ${isinCode}` : ''}${apiDataBlock ? ', API data included' : ''}`);

    const systemPrompt = buildSystemPrompt(sfdrArticle, investmentStrategy, fundTermsBlock);
    const chunks = splitIntoChunks(documentText, CHUNK_CHARS);
    console.log(`[InvestmentAnalysis] Split into ${chunks.length} chunk(s)`);

    if (wantsStream) {
      return handleStreaming(chunks, systemPrompt, companyName, apiDataBlock);
    } else {
      return handleRegular(chunks, systemPrompt, companyName, apiDataBlock);
    }
  } catch (err) {
    console.error('[InvestmentAnalysis] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Serverfel' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Regular handler
// ---------------------------------------------------------------------------

async function handleRegular(
  chunks: string[],
  systemPrompt: string,
  companyName?: string,
  apiDataBlock?: string,
): Promise<NextResponse> {
  const chunkResults: Array<Record<string, unknown>> = [];
  const companyHint = companyName ? `\nBolaget som analyseras: ${companyName}\n` : '';
  const apiSection = apiDataBlock ? `\n\n${apiDataBlock}\n` : '';

  for (let i = 0; i < chunks.length; i++) {
    const userMessage = `Analysera följande dokument${chunks.length > 1 ? ` (del ${i + 1} av ${chunks.length})` : ''} och producera en investeringsanalys. Svara ENDAST med JSON-objektet.${companyHint}${i === 0 ? apiSection : ''}

DOKUMENT${chunks.length > 1 ? ` (del ${i + 1}/${chunks.length})` : ''}:

${chunks[i]}

Ge nu JSON med alla analysavsnitt.`;

    const rawText = await callClaude(systemPrompt, userMessage);
    if (rawText) {
      const parsed = parseJsonFromText(rawText);
      if (parsed) chunkResults.push(parsed);
    }
  }

  if (chunkResults.length === 0) {
    return NextResponse.json(
      { error: 'AI-analysen kunde inte genomföras.' },
      { status: 502 }
    );
  }

  const merged = mergeResults(chunkResults);
  return NextResponse.json({ analysis: merged });
}

// ---------------------------------------------------------------------------
// Streaming handler
// ---------------------------------------------------------------------------

async function handleStreaming(
  chunks: string[],
  systemPrompt: string,
  companyName?: string,
  apiDataBlock?: string,
): Promise<Response> {
  const encoder = new TextEncoder();
  const KEEPALIVE_INTERVAL_MS = 15_000;

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      function startKeepalive() {
        stopKeepalive();
        keepaliveTimer = setInterval(() => {
          try { controller.enqueue(encoder.encode(': keepalive\n\n')); } catch { stopKeepalive(); }
        }, KEEPALIVE_INTERVAL_MS);
      }

      function stopKeepalive() {
        if (keepaliveTimer) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
      }

      try {
        startKeepalive();
        const companyHint = companyName ? `\nBolaget som analyseras: ${companyName}\n` : '';
        const apiSection = apiDataBlock ? `\n\n${apiDataBlock}\n` : '';

        controller.enqueue(
          encoder.encode(sseEncode('progress', {
            step: 'start',
            message: `Analyserar ${chunks.length} del(ar) av dokumenten...`,
            total: chunks.length,
            completed: 0,
          }))
        );

        const chunkResults: Array<Record<string, unknown>> = [];
        const CONCURRENCY = 2;

        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
          const batch = chunks.slice(i, i + CONCURRENCY);
          const promises = batch.map((chunk, batchIdx) => {
            const chunkIdx = i + batchIdx;
            const includeApi = chunkIdx === 0 ? apiSection : '';
            const userMessage = `Analysera följande dokument (del ${chunkIdx + 1} av ${chunks.length}) och producera en investeringsanalys. Svara ENDAST med JSON-objektet.${companyHint}${includeApi}

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Ge nu JSON med alla analysavsnitt.`;
            return callClaude(systemPrompt, userMessage);
          });

          const results = await Promise.all(promises);
          for (const rawText of results) {
            if (rawText) {
              const parsed = parseJsonFromText(rawText);
              if (parsed) chunkResults.push(parsed);
            }
          }

          controller.enqueue(
            encoder.encode(sseEncode('progress', {
              step: 'chunk',
              message: `Analyserat ${Math.min(i + CONCURRENCY, chunks.length)} av ${chunks.length} delar...`,
              total: chunks.length,
              completed: Math.min(i + CONCURRENCY, chunks.length),
            }))
          );
        }

        if (chunkResults.length === 0) {
          stopKeepalive();
          controller.enqueue(encoder.encode(sseEncode('error', { error: 'AI-analysen kunde inte genomföras.' })));
          controller.close();
          return;
        }

        controller.enqueue(
          encoder.encode(sseEncode('progress', {
            step: 'merge',
            message: 'Sammanställer investeringsanalys...',
            total: chunks.length,
            completed: chunks.length,
          }))
        );

        let merged = mergeResults(chunkResults);

        if (chunkResults.length > 1) {
          const mergeInput = JSON.stringify(chunkResults, null, 2);
          if (mergeInput.length < 150_000) {
            const mergeResponse = await callClaude(
              buildMergePrompt(),
              `Slå ihop dessa ${chunkResults.length} analysresultat till en sammanhängande investeringsanalys:\n\n${mergeInput}`,
              16000,
            );
            if (mergeResponse) {
              const mergedParsed = parseJsonFromText(mergeResponse);
              if (mergedParsed) merged = mergedParsed;
            }
          }
        }

        stopKeepalive();

        controller.enqueue(
          encoder.encode(sseEncode('result', { analysis: merged }))
        );
        controller.close();
      } catch (err) {
        stopKeepalive();
        console.error('[InvestmentAnalysis] Streaming error:', err);
        controller.enqueue(
          encoder.encode(sseEncode('error', { error: err instanceof Error ? err.message : 'Serverfel' }))
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
