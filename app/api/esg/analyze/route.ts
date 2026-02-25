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
import { getQuestionsForPrompt } from '@/lib/esg/questions';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

// Textract is NOT available in eu-north-1
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
const MAX_FILES = 10;
// Textract DetectDocumentText has a 5 MB limit per call (bytes)
const TEXTRACT_MAX_BYTES = 5 * 1024 * 1024;
// Characters per chunk sent to Claude (roughly ~25k tokens)
const CHUNK_CHARS = 100_000;
// Minimum text length from pdf-parse to consider it successful
const MIN_PDF_TEXT_LENGTH = 200;

let mammoth: typeof import('mammoth') | null = null;
let pdfParse: ((buffer: Buffer) => Promise<{ text: string; numpages?: number }>) | null = null;

// ---------------------------------------------------------------------------
// PDF text extraction with Textract OCR fallback
// ---------------------------------------------------------------------------

async function extractFromPdfWithOCR(buffer: Buffer): Promise<string> {
  // First try pdf-parse (fast, works for digital PDFs)
  let text = '';
  try {
    if (!pdfParse) {
      const mod = await import('pdf-parse');
      pdfParse = mod.default;
    }
    const data = await pdfParse(buffer);
    text = (data?.text || '').trim();
  } catch (e) {
    console.warn('[ESG Analyze] pdf-parse failed, will try Textract:', e);
  }

  if (text.length >= MIN_PDF_TEXT_LENGTH) {
    return text;
  }

  // Fallback: use Textract OCR for scanned PDFs
  console.log('[ESG Analyze] pdf-parse gave too little text, trying Textract OCR...');
  try {
    if (buffer.length > TEXTRACT_MAX_BYTES) {
      // Textract DetectDocumentText only supports up to 5 MB per call.
      // For very large scanned PDFs we'd need async Textract (S3-based).
      // For now, return what we got + a note.
      console.warn('[ESG Analyze] PDF too large for Textract sync API, using partial text');
      return text || '[PDF:en är för stor för OCR (>5 MB). Ladda upp en mindre fil eller en digital PDF.]';
    }

    const response = await textractClient.send(
      new DetectDocumentTextCommand({
        Document: { Bytes: buffer },
      })
    );

    const ocrLines: string[] = [];
    for (const block of response.Blocks || []) {
      if (block.BlockType === 'LINE' && block.Text) {
        ocrLines.push(block.Text);
      }
    }
    const ocrText = ocrLines.join('\n').trim();

    if (ocrText.length >= MIN_PDF_TEXT_LENGTH) {
      console.log(`[ESG Analyze] Textract OCR extracted ${ocrText.length} chars`);
      return ocrText;
    }

    return text || '[PDF gav för lite text. Filen kan vara skannad utan tillräcklig text.]';
  } catch (e) {
    console.error('[ESG Analyze] Textract OCR failed:', e);
    return text || '[Kunde inte läsa PDF-filen (varken digital eller via OCR).]';
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    if (!mammoth) {
      mammoth = await import('mammoth');
    }
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value || '').trim();
    return text.length > 50 ? text : '[Word-dokument verkar tomt.]';
  } catch (e) {
    console.error('[ESG Analyze] DOCX error:', e);
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
    console.error('[ESG Analyze] Excel error:', e);
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
// Chunking: split large text into manageable pieces
// ---------------------------------------------------------------------------

function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length);
    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      if (lastParagraph > offset + maxChars * 0.6) {
        end = lastParagraph;
      } else {
        const lastNewline = text.lastIndexOf('\n', end);
        if (lastNewline > offset + maxChars * 0.6) {
          end = lastNewline;
        }
      }
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Claude analysis helpers
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
        messages: [
          {
            role: 'user',
            content: [{ text: userMessage }],
          },
        ],
        inferenceConfig: { maxTokens },
      });
      const response = await bedrockClient.send(command);
      const outputContent = response.output?.message?.content;
      if (outputContent?.[0] && 'text' in outputContent[0]) {
        return outputContent[0].text ?? null;
      }
      return null;
    } catch (err) {
      console.warn(`[ESG Analyze] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  let cleaned = text;

  // Strip markdown code fences — use indexOf for reliability on large strings
  const fenceStart = cleaned.indexOf('```');
  if (fenceStart !== -1) {
    const afterFence = cleaned.indexOf('\n', fenceStart);
    if (afterFence !== -1) {
      const fenceEnd = cleaned.lastIndexOf('```');
      if (fenceEnd > afterFence) {
        cleaned = cleaned.slice(afterFence + 1, fenceEnd);
      } else {
        cleaned = cleaned.slice(afterFence + 1);
      }
    }
  }

  // Find the outermost JSON object by brace matching
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
      const repaired = jsonStr.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-screening (early rejection) – fast sector/industry check with Haiku
// ---------------------------------------------------------------------------

const PRESCREEN_CHARS = 10_000;
const HAIKU_MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

export interface PreScreenResult {
  companyName: string;
  sector: string;
  industry: string;
  involvements: {
    weapons?: boolean;
    controversialWeapons?: boolean;
    nuclear?: boolean;
    tobacco?: boolean;
    fossilFuels?: boolean;
    gambling?: boolean;
    alcohol?: boolean;
  };
}

async function callClaudeHaiku(systemPrompt: string, userMessage: string, maxTokens: number = 2000): Promise<string | null> {
  try {
    const command = new ConverseCommand({
      modelId: HAIKU_MODEL,
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
    console.warn('[ESG Analyze] Haiku pre-screen failed:', err);
    return null;
  }
}

const PRESCREEN_SYSTEM = `Du är en assistent som identifierar bolag och deras branschexponering från ESG-/hållbarhetsrapporter. Svara ENDAST med ett giltigt JSON-objekt, inga kommentarer.

Returnera detta format:
{
  "companyName": "Bolagets namn enligt rapporten",
  "sector": "t.ex. Industri, Energi, Försvarsindustri",
  "industry": "t.ex. Aerospace & Defense, Olja & gas",
  "involvements": {
    "weapons": true/false,
    "controversialWeapons": true/false,
    "nuclear": true/false,
    "tobacco": true/false,
    "fossilFuels": true/false,
    "gambling": true/false,
    "alcohol": true/false
  }
}

Regler: weapons = vapen/försvar/krigsmateriel. controversialWeapons = klusterammunition, landminor, kemiska vapen etc. Om rapporten nämner försvarsindustri, vapen, militär, SAAB, BAE, Lockheed, så sätt weapons eller relevant involvement till true. Om osäkert, sätt false.`;

async function preScreenDocument(documentText: string): Promise<PreScreenResult | null> {
  const excerpt = documentText.slice(0, PRESCREEN_CHARS);
  if (excerpt.length < 100) return null;

  const userMessage = `Analysera följande utdrag från en ESG-/hållbarhetsrapport och identifiera bolagsnamn, sektor, bransch samt om bolaget har exponering mot vapen/försvar, kontroversiella vapen, kärnvapen, tobak, fossila bränslen, spel, alkohol. Svara endast med JSON-objektet.

UTDRAG:
${excerpt}

Sluta här. Ge nu JSON med companyName, sector, industry och involvements.`;

  const raw = await callClaudeHaiku(PRESCREEN_SYSTEM, userMessage, 1500);
  if (!raw) return null;

  const parsed = parseJsonFromText(raw);
  if (!parsed || typeof parsed.companyName !== 'string') return null;

  const inv = (parsed.involvements as Record<string, boolean>) || {};
  return {
    companyName: String(parsed.companyName).trim() || 'Okänt bolag',
    sector: String(parsed.sector ?? '').trim(),
    industry: String(parsed.industry ?? '').trim(),
    involvements: {
      weapons: Boolean(inv.weapons),
      controversialWeapons: Boolean(inv.controversialWeapons),
      nuclear: Boolean(inv.nuclear),
      tobacco: Boolean(inv.tobacco),
      fossilFuels: Boolean(inv.fossilFuels),
      gambling: Boolean(inv.gambling),
      alcohol: Boolean(inv.alcohol),
    },
  };
}

// ---------------------------------------------------------------------------
// Early rejection check – per SFDR article
// ---------------------------------------------------------------------------

export interface EarlyRejection {
  rejected: boolean;
  reason: string;
  category: string;
  companyName: string;
}

function checkEarlyRejection(preScreen: PreScreenResult, sfdrArticle: string): EarlyRejection | null {
  const { companyName, sector, industry, involvements } = preScreen;
  const sectorLower = (sector + ' ' + industry).toLowerCase();

  // Helper: match defense/weapons
  const isWeapons = involvements.weapons || involvements.controversialWeapons
    || /försvar|defense|military|vapen|weapon|aerospace\s*&\s*defense|krigsmateriel/i.test(sectorLower);

  if (sfdrArticle === '9') {
    // Article 9: zero tolerance – weapons, controversial weapons, nuclear, tobacco, fossil fuels
    if (isWeapons || involvements.controversialWeapons) {
      return {
        rejected: true,
        reason: `${companyName} är verksamt inom försvarsindustrin eller har exponering mot kontroversiella vapen och kan inte godkännas under SFDR Artikel 9.`,
        category: 'weapons',
        companyName,
      };
    }
    if (involvements.nuclear) {
      return {
        rejected: true,
        reason: `${companyName} har exponering mot kärnvapen och kan inte godkännas under SFDR Artikel 9.`,
        category: 'nuclear',
        companyName,
      };
    }
    if (involvements.tobacco) {
      return {
        rejected: true,
        reason: `${companyName} har exponering mot tobaksproduktion och kan inte godkännas under SFDR Artikel 9.`,
        category: 'tobacco',
        companyName,
      };
    }
    if (involvements.fossilFuels) {
      return {
        rejected: true,
        reason: `${companyName} har exponering mot fossila bränslen och kan inte godkännas under SFDR Artikel 9.`,
        category: 'fossilFuels',
        companyName,
      };
    }
  }

  if (sfdrArticle === '8') {
    // Article 8: zero tolerance only for controversial weapons
    if (involvements.controversialWeapons) {
      return {
        rejected: true,
        reason: `${companyName} har exponering mot kontroversiella vapen och kan inte godkännas under SFDR Artikel 8.`,
        category: 'controversialWeapons',
        companyName,
      };
    }
  }

  // Article 6: no automatic rejection
  return null;
}

// ---------------------------------------------------------------------------
// Build prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(questionsBlock: string, sfdrArticle?: string): string {
  const sfdrLabel =
    sfdrArticle === '9' ? 'Artikel 9 (hållbart investeringsmål)'
      : sfdrArticle === '8' ? 'Artikel 8 (främjar miljö-/sociala egenskaper)'
        : sfdrArticle === '6' ? 'Artikel 6 (grundläggande krav)'
          : 'Artikel 8';

  const sfdrRequirements =
    sfdrArticle === '9'
      ? `SFDR Artikel 9 kräver:
- Tydligt definierat hållbart investeringsmål (miljö och/eller socialt)
- 100% av investeringarna ska bidra till det hållbara målet (exkl. kassa/hedging)
- Fullständig PAI-redovisning med kvantitativa indikatorer (Tabell 1-3 i RTS)
- DNSH-analys mot ALLA 14 obligatoriska PAI-indikatorer
- God styrning (governance) verifierad mot SFDR Art. 2(17)
- EU-taxonomianpassning ska kvantifieras
- Referensindex om tillämpligt, annars förklaring av metodik`
      : sfdrArticle === '6'
        ? `SFDR Artikel 6 kräver:
- Integration av hållbarhetsrisker i investeringsprocessen
- Beskrivning av hur hållbarhetsrisker beaktas
- Bedömning av sannolika effekter av hållbarhetsrisker på avkastning`
        : `SFDR Artikel 8 kräver:
- Beskrivning av de miljö- och/eller sociala egenskaper som främjas
- Metodik för hur egenskaperna uppnås (screening, exkludering, engagemang, ESG-integration)
- Andel investeringar som uppfyller egenskaperna (kvantifierat i %)
- PAI-redovisning: Beaktande av huvudsakliga negativa konsekvenser med kvantitativa indikatorer
- DNSH-princip: Hur investeringarna inte väsentligt skadar något av de sex EU-taxonomimålen
- God styrning: Verifiering att investeringsobjekten har god styrning (SFDR Art. 2(17)) avseende sund ledningsstruktur, personalrelationer, ersättning, skatteefterlevnad
- Referensindex eller förklaring av metodik om inget index används
- Screening- och engagemangspolicys ska beskrivas
- KPI:er ska vara mätbara och jämförbara`;

  return `Du är en senior ESG-analytiker med djup expertis inom SFDR-förordningen (EU 2019/2088), RTS (delegerade förordningar), EU-taxonomin och ESA:s tillsynsvägledning. Du analyserar uppladdade ESG-rapporter för AIFM Capital AB.

REGULATORISK KONTEXT:
Produktklassificering: SFDR ${sfdrLabel}
${sfdrRequirements}
${sfdrArticle === '9' ? `
KRITISKT FÖR ARTIKEL 9:
Om bolaget har NÅGON exponering mot försvarsindustri, kontroversiella vapen, kärnvapen, tobaksproduktion eller fossila bränslen (oavsett intäktsandel), MÅSTE esgDecision vara "rejected" och esgSummaryExclusion vara "rejected". Försvarsindustri (t.ex. SAAB, BAE Systems, Lockheed Martin) kan ALDRIG godkännas under Artikel 9.` : ''}

DIN UPPGIFT:
Analysera dokumenten och producera en SFDR-komplett ESG-analys. Du ska:
1. Besvara ALLA frågor i formuläret med data från dokumenten
2. Producera en SFDR-komplett "executiveSummary" som sammanfattar hela analysen
3. Producera en "methodology" som beskriver analysmetodik
4. Producera en "dnshAnalysis" med DNSH-bedömning mot alla sex EU-taxonomimål
5. Producera "paiTable" med kvantitativa PAI-indikatorer i tabellformat

INSTRUKTIONER PER SEKTION:

1. NORMBASERAD SCREENING (fråga 1-7):
   Bedöm efterlevnad av internationella normer. Referera till specifika ramverk (UNGC:s 10 principer, OECD:s riktlinjer för multinationella företag, FN:s vägledande principer för företag och mänskliga rättigheter). Ange alltid vilka principer/riktlinjer som är relevanta.

2. EXKLUDERINGSKONTROLL (fråga 8-14):
   Bedöm exponering mot kontroversiella sektorer. Ange intäktsandel (%) om tillgängligt. Om rapporten inte nämner en sektor, ange "no" med motivering att ingen exponering identifierats. Beskriv exkluderingspolicyn.

3. GOOD GOVERNANCE (fråga 15-21):
   Bedöm enligt SFDR Art. 2(17): sund ledningsstruktur, personalrelationer, ersättning till personal, skatteefterlevnad. Var specifik om styrelsesammansättning, oberoende ledamöter, revisionsutskott etc.

4. ESG-RISKANALYS (fråga 22-30):
   Kvantifiera risker där möjligt. Extrahera GHG-data per scope separat med enheter. Ange SBTi-status (validerat/åtagande/inget). Beräkna fossilexponering i procent.

5. PAI-INDIKATORER (fråga 31-42):
   Extrahera ALLA kvantitativa data: ton CO2e per scope, koldioxidintensitet (tCO2e/M€), vattenförbrukning (m³), avfall (ton), lönegap (%), styrelsediversitet (% kvinnor). I paiTable: använd årsvisa kolumner (2022, 2023, 2024) för GHG-indikatorer; för år utan data ange null eller "Not Covered". Om exakta siffror saknas, ange "Data saknas" och beskriv kvalitativ information.

6. EU TAXONOMI (fråga 43-45):
   Ange taxonomianpassning i %. Gör DNSH-bedömning mot alla sex miljömål. Beskriv minimigarantier (minimum safeguards).

7. SAMMANFATTNING (fråga 46-53):
   Ge välmotiverade sammanfattningar. Beslutsmotiveringen ska referera till specifika SFDR-krav och hur de uppfylls/inte uppfylls.

SVARSFORMAT:
- ja/nej-frågor: "yes" eller "no" i answers, ALLTID motivering i details
- select-frågor: exakt värde (low, medium, high, approved, rejected, meets, does_not_meet, decreasing, stable, increasing, not_available)
- tal: siffror
- text: koncist på svenska med styckeindelning (\\n\\n)
- Om du kan härleda svar från kontext, gör det och förklara i details

Frågelista:
${questionsBlock}

Returnera ETT JSON-objekt:
{
  "answers": {
    "normScreeningUNGC": "yes",
    "envRiskLevel": "medium",
    ...
  },
  "details": {
    "normScreeningUNGC": "Företaget rapporterar efterlevnad av FN Global Compact sedan 2018...",
    ...
  },
  "executiveSummary": "En sammanhängande sammanfattning (3-5 stycken) som täcker: (1) Bolagets hållbarhetsprofil och SFDR-klassificering, (2) Huvudsakliga miljö- och sociala egenskaper som främjas, (3) Metodik för screening/exkludering/engagemang, (4) Kvantitativa nyckeltal (GHG, ESG-score, taxonomianpassning), (5) Slutsats med eventuella brister och rekommendationer. Skriv som en professionell analysrapport.",
  "methodology": "Beskrivning av analysmetodik (2-3 stycken): Vilka datakällor som använts, screeningkriterier, exkluderingspolicy, engagemangsprocess, ESG-integrationsmetod, och hur SFDR-kraven verifierats.",
  "dnshAnalysis": {
    "climateMitigation": "Bedömning mot klimatmål (begränsning av klimatförändringar)",
    "climateAdaptation": "Bedömning mot klimatanpassning",
    "waterResources": "Bedömning mot vatten och marina resurser",
    "circularEconomy": "Bedömning mot cirkulär ekonomi",
    "pollution": "Bedömning mot förebyggande av föroreningar",
    "biodiversity": "Bedömning mot biologisk mångfald och ekosystem",
    "overallDnsh": "Sammanfattande DNSH-bedömning"
  },
  "paiTable": [
    {"indicator": "Scope 1 GHG emissions", "isHeader": true},
    {"indicator": "Gross Scope 1 GHG emissions", "2022": "siffra eller null", "2023": "siffra eller null", "2024": "siffra eller null", "unit": "tCO2e", "source": "Hållbarhetsrapport"},
    {"indicator": "Scope 2 GHG emissions", "isHeader": true},
    {"indicator": "Gross location-based Scope 2", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "Gross market-based Scope 2", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "Scope 3 GHG emissions", "isHeader": true},
    {"indicator": "Total Scope 3 (indirect)", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "1 Purchased goods and services", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "2 Capital goods", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "4 Upstream transport & distrib.", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "6 Business travelling", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "11 Use of sold products", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "Total GHG emissions (location)", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "isBold": true},
    {"indicator": "Total GHG emissions (market)", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "isBold": true},
    {"indicator": "Carbon footprint", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e", "source": ""},
    {"indicator": "Carbon intensity", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e/MEUR", "source": ""},
    {"indicator": "GHG intensity", "2022": "siffra", "2023": "siffra", "2024": "siffra", "unit": "tCO2e/MSEK", "source": ""},
    {"indicator": "Revenue from fossil fuels", "2022": "Yes/No", "2023": "Yes/No", "2024": "Yes/No", "unit": "", "source": ""}
  ],
  "goodGovernanceAssessment": "Bedömning av god styrning enligt SFDR Art. 2(17): (1) Sund ledningsstruktur, (2) Personalrelationer, (3) Ersättning till personal, (4) Skatteefterlevnad. Var specifik."
}

VIKTIGT: Besvara ALLA frågor. Fyll ALLTID i executiveSummary, methodology, dnshAnalysis, paiTable och goodGovernanceAssessment – dessa är kritiska för SFDR-efterlevnad. Skriv som en professionell regulatorisk rapport.`;
}

function buildMergePrompt(): string {
  return `Du är en assistent som slår ihop ESG-analysresultat. Du får flera JSON-objekt med "answers" och "details" från olika delar av samma dokument. Slå ihop dem till ett enda JSON-objekt.

Regler:
- Om samma fråge-id har svar i flera chunks, välj det mest specifika/detaljerade svaret (föredra siffror och konkreta uppgifter framför vaga formuleringar).
- Konflikthantering: Om en chunk har "yes" och en annan "no" för samma fråga, behåll "yes" om "details" innehåller tydlig motivering; annars välj det svar som har längre eller mer specifik motivering i "details".
- Deduplicering: Om två chunks ger samma slutsats med nästan identisk "details"-text, behåll en version och ta bort duplikat.
- Slå ihop alla unika nycklar från alla chunks. Saknas ett fråge-id i en chunk men finns i en annan, använd det som finns.
- Slå ihop "executiveSummary", "methodology", "dnshAnalysis", "paiTable" och "goodGovernanceAssessment" – välj den mest kompletta versionen.
- Svara ENDAST med ett giltigt JSON-objekt med "answers", "details", "executiveSummary", "methodology", "dnshAnalysis", "paiTable" och "goodGovernanceAssessment". Inga kommentarer utanför JSON.`;
}

// ---------------------------------------------------------------------------
// Merge multiple chunk results
// ---------------------------------------------------------------------------

interface AnalysisResult {
  answers: Record<string, string>;
  details: Record<string, string>;
  executiveSummary?: string;
  methodology?: string;
  dnshAnalysis?: Record<string, string>;
  paiTable?: Array<Record<string, string>>;
  goodGovernanceAssessment?: string;
}

function mergeResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 1) return results[0];

  const merged: AnalysisResult = {
    answers: {},
    details: {},
  };

  for (const result of results) {
    for (const [key, value] of Object.entries(result.answers || {})) {
      if (value != null && String(value).trim() !== '') {
        const existing = merged.answers[key];
        if (!existing || existing === '' || existing === 'null') {
          merged.answers[key] = String(value);
        } else if (String(value).length > existing.length) {
          merged.answers[key] = String(value);
        }
      }
    }
    for (const [key, value] of Object.entries(result.details || {})) {
      if (value != null && String(value).trim() !== '') {
        const existing = merged.details[key];
        if (!existing || existing === '' || existing === 'null') {
          merged.details[key] = String(value);
        } else {
          merged.details[key] = existing + ' | ' + String(value);
        }
      }
    }

    if (result.executiveSummary && (!merged.executiveSummary || result.executiveSummary.length > merged.executiveSummary.length)) {
      merged.executiveSummary = result.executiveSummary;
    }
    if (result.methodology && (!merged.methodology || result.methodology.length > merged.methodology.length)) {
      merged.methodology = result.methodology;
    }
    if (result.dnshAnalysis && Object.keys(result.dnshAnalysis).length > 0) {
      merged.dnshAnalysis = { ...(merged.dnshAnalysis || {}), ...result.dnshAnalysis };
    }
    if (result.paiTable && result.paiTable.length > (merged.paiTable?.length || 0)) {
      merged.paiTable = result.paiTable;
    }
    if (result.goodGovernanceAssessment && (!merged.goodGovernanceAssessment || result.goodGovernanceAssessment.length > merged.goodGovernanceAssessment.length)) {
      merged.goodGovernanceAssessment = result.goodGovernanceAssessment;
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// SSE streaming helpers
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
      console.error('[ESG Analyze] FormData parse error:', parseErr);
      return NextResponse.json(
        {
          error: 'Kunde inte läsa uppladdade filer. Kontrollera att filerna inte är för stora (max 50 MB per fil).',
        },
        { status: 400 }
      );
    }
    const files = formData.getAll('files') as File[];
    if (!files?.length) {
      return NextResponse.json({ error: 'Inga filer skickades.' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Max ${MAX_FILES} filer tillåtna.` },
        { status: 400 }
      );
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

    // Check if client wants streaming (SSE) or regular JSON
    const acceptHeader = request.headers.get('accept') || '';
    const wantsStream = acceptHeader.includes('text/event-stream');

    // Extract text from all files
    const combinedParts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      combinedParts.push(`\n\n=== Dokument ${i + 1}: ${f.name} ===\n\n`);
      combinedParts.push(await extractTextFromFile(f));
    }
    const documentText = combinedParts.join('');

    const sfdrArticle = (formData.get('sfdrArticle') as string) || undefined;
    const forceFullAnalysis = formData.get('forceFullAnalysis') === 'true';

    console.log(`[ESG Analyze] Total extracted text: ${documentText.length} chars from ${files.length} file(s)${sfdrArticle ? `, SFDR Art. ${sfdrArticle}` : ''}`);

    // Pre-screening for early rejection (forbidden sectors under Art 8/9), unless client requested full analysis anyway
    if (!forceFullAnalysis) {
      const preScreen = await preScreenDocument(documentText);
      if (preScreen && sfdrArticle) {
        const rejection = checkEarlyRejection(preScreen, sfdrArticle);
        if (rejection?.rejected) {
          console.log(`[ESG Analyze] Early rejection: ${rejection.category} – ${rejection.companyName}`);
          if (wantsStream) {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(encoder.encode(sseEncode('rejection', rejection)));
                controller.close();
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
          return NextResponse.json({ earlyRejection: rejection });
        }
      }
    }

    const questionsForPrompt = getQuestionsForPrompt();
    const questionsBlock = questionsForPrompt
      .map((q) => `- ${q.id}: (${q.number}) ${q.text}`)
      .join('\n');

    const systemPrompt = buildSystemPrompt(questionsBlock, sfdrArticle);

    // Split into chunks if document is large
    const chunks = splitIntoChunks(documentText, CHUNK_CHARS);
    console.log(`[ESG Analyze] Split into ${chunks.length} chunk(s)`);

    if (wantsStream) {
      return handleStreaming(chunks, systemPrompt, questionsBlock);
    } else {
      return handleRegular(chunks, systemPrompt, questionsBlock);
    }
  } catch (err) {
    console.error('[ESG Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Serverfel' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Regular (non-streaming) handler - analyzes chunks and returns merged JSON
// ---------------------------------------------------------------------------

async function handleRegular(
  chunks: string[],
  systemPrompt: string,
  _questionsBlock: string,
): Promise<NextResponse> {
  const chunkResults: AnalysisResult[] = [];

  if (chunks.length === 1) {
    // Single chunk - simple case
    const userMessage = `Analysera följande ESG-dokument och fyll i svaren på frågorna. Svara endast med JSON-objektet (inga markdown-kodblock, inga kommentarer).

DOKUMENT:

${chunks[0]}

Sluta här. Ge nu JSON med "answers" och "details".`;

    const rawText = await callClaude(systemPrompt, userMessage, 16000);
    if (!rawText) {
      return NextResponse.json(
        { error: 'AI-analysen kunde inte genomföras. Kontrollera Bedrock-åtkomst.' },
        { status: 502 }
      );
    }

    const parsed = parseJsonFromText(rawText);
    if (!parsed) {
      return NextResponse.json(
        { error: 'AI returnerade inte giltig JSON.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      answers: (parsed.answers as Record<string, string>) || {},
      details: (parsed.details as Record<string, string>) || {},
      executiveSummary: parsed.executiveSummary as string | undefined,
      methodology: parsed.methodology as string | undefined,
      dnshAnalysis: parsed.dnshAnalysis as Record<string, string> | undefined,
      paiTable: parsed.paiTable as Array<Record<string, string>> | undefined,
      goodGovernanceAssessment: parsed.goodGovernanceAssessment as string | undefined,
      meta: { chunks: 1, totalChars: chunks[0].length },
    });
  }

  // Multiple chunks - analyze in parallel (max 3 concurrent to avoid throttling)
  const CONCURRENCY = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const promises = batch.map((chunk, batchIdx) => {
      const chunkIdx = i + batchIdx;
      const userMessage = `Analysera följande ESG-dokument (del ${chunkIdx + 1} av ${chunks.length}) och fyll i svaren på frågorna. Svara endast med JSON-objektet (inga markdown-kodblock, inga kommentarer).

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Sluta här. Ge nu JSON med "answers" och "details" för den information du hittar i denna del.`;

      return callClaude(systemPrompt, userMessage, 16000);
    });

    const results = await Promise.all(promises);
    for (const rawText of results) {
      if (rawText) {
        const parsed = parseJsonFromText(rawText);
        if (parsed) {
          chunkResults.push({
            answers: (parsed.answers as Record<string, string>) || {},
            details: (parsed.details as Record<string, string>) || {},
            executiveSummary: parsed.executiveSummary as string | undefined,
            methodology: parsed.methodology as string | undefined,
            dnshAnalysis: parsed.dnshAnalysis as Record<string, string> | undefined,
            paiTable: parsed.paiTable as Array<Record<string, string>> | undefined,
            goodGovernanceAssessment: parsed.goodGovernanceAssessment as string | undefined,
          });
        }
      }
    }
  }

  if (chunkResults.length === 0) {
    return NextResponse.json(
      { error: 'AI-analysen kunde inte genomföras för någon del av dokumentet.' },
      { status: 502 }
    );
  }

  // Merge results from all chunks
  let merged = mergeResults(chunkResults);

  // If we had many chunks, do a final AI merge pass for consistency
  if (chunkResults.length > 2) {
    const mergeInput = JSON.stringify(chunkResults, null, 2);
    if (mergeInput.length < 150_000) {
      const mergeResponse = await callClaude(
        buildMergePrompt(),
        `Slå ihop dessa ${chunkResults.length} analysresultat till ett enda JSON-objekt:\n\n${mergeInput}`,
        8000,
      );
      if (mergeResponse) {
        const mergedParsed = parseJsonFromText(mergeResponse);
        if (mergedParsed) {
          merged = {
            answers: (mergedParsed.answers as Record<string, string>) || merged.answers,
            details: (mergedParsed.details as Record<string, string>) || merged.details,
            executiveSummary: (mergedParsed.executiveSummary as string) || merged.executiveSummary,
            methodology: (mergedParsed.methodology as string) || merged.methodology,
            dnshAnalysis: (mergedParsed.dnshAnalysis as Record<string, string>) || merged.dnshAnalysis,
            paiTable: (mergedParsed.paiTable as Array<Record<string, string>>) || merged.paiTable,
            goodGovernanceAssessment: (mergedParsed.goodGovernanceAssessment as string) || merged.goodGovernanceAssessment,
          };
        }
      }
    }
  }

  return NextResponse.json({
    answers: merged.answers,
    details: merged.details,
    executiveSummary: merged.executiveSummary,
    methodology: merged.methodology,
    dnshAnalysis: merged.dnshAnalysis,
    paiTable: merged.paiTable,
    goodGovernanceAssessment: merged.goodGovernanceAssessment,
    meta: {
      chunks: chunks.length,
      totalChars: chunks.reduce((sum, c) => sum + c.length, 0),
      chunkResults: chunkResults.length,
    },
  });
}

// ---------------------------------------------------------------------------
// Streaming (SSE) handler - sends progress events as chunks are analyzed
// ---------------------------------------------------------------------------

async function handleStreaming(
  chunks: string[],
  systemPrompt: string,
  _questionsBlock: string,
): Promise<Response> {
  const encoder = new TextEncoder();
  const KEEPALIVE_INTERVAL_MS = 15_000; // Send keepalive every 15s to prevent ALB/CloudFront timeout

  const stream = new ReadableStream({
    async start(controller) {
      // Keepalive: send SSE comments periodically to keep the connection alive
      // during long-running Claude calls. SSE comments (lines starting with ':')
      // are ignored by EventSource clients but keep the TCP connection active.
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      function startKeepalive() {
        stopKeepalive();
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            // stream may have closed
            stopKeepalive();
          }
        }, KEEPALIVE_INTERVAL_MS);
      }

      function stopKeepalive() {
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
          keepaliveTimer = null;
        }
      }

      try {
        startKeepalive();

        controller.enqueue(
          encoder.encode(
            sseEncode('progress', {
              step: 'start',
              message: `Analyserar ${chunks.length} del(ar) av dokumentet...`,
              total: chunks.length,
              completed: 0,
            })
          )
        );

        const chunkResults: AnalysisResult[] = [];
        const CONCURRENCY = 3;
        let hadClaudeResponse = false;

        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
          const batch = chunks.slice(i, i + CONCURRENCY);
          const promises = batch.map((chunk, batchIdx) => {
            const chunkIdx = i + batchIdx;
            const userMessage = `Analysera följande ESG-dokument (del ${chunkIdx + 1} av ${chunks.length}) och fyll i svaren på frågorna. Svara endast med JSON-objektet (inga markdown-kodblock, inga kommentarer).

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Sluta här. Ge nu JSON med "answers" och "details" för den information du hittar i denna del.`;

            return callClaude(systemPrompt, userMessage, 16000);
          });

          const results = await Promise.all(promises);
          for (const rawText of results) {
            if (rawText) {
              hadClaudeResponse = true;
              const parsed = parseJsonFromText(rawText);
              if (parsed) {
                chunkResults.push({
                  answers: (parsed.answers as Record<string, string>) || {},
                  details: (parsed.details as Record<string, string>) || {},
                  executiveSummary: parsed.executiveSummary as string | undefined,
                  methodology: parsed.methodology as string | undefined,
                  dnshAnalysis: parsed.dnshAnalysis as Record<string, string> | undefined,
                  paiTable: parsed.paiTable as Array<Record<string, string>> | undefined,
                  goodGovernanceAssessment: parsed.goodGovernanceAssessment as string | undefined,
                });
              } else {
                console.warn('[ESG Analyze] Claude returned text but JSON parse failed. Length:', rawText.length, 'Preview:', rawText.slice(0, 300));
              }
            }
          }

          controller.enqueue(
            encoder.encode(
              sseEncode('progress', {
                step: 'chunk',
                message: `Analyserat ${Math.min(i + CONCURRENCY, chunks.length)} av ${chunks.length} delar...`,
                total: chunks.length,
                completed: Math.min(i + CONCURRENCY, chunks.length),
              })
            )
          );
        }

        if (chunkResults.length === 0) {
          stopKeepalive();
          const errorMsg = hadClaudeResponse
            ? 'AI svarade men svaret kunde inte tolkas. Försök med ett mindre dokument eller kontakta support.'
            : 'AI-analysen kunde inte genomföras. Kontrollera nätverk och Bedrock-åtkomst.';
          controller.enqueue(
            encoder.encode(sseEncode('error', { error: errorMsg }))
          );
          controller.close();
          return;
        }

        // Merge
        controller.enqueue(
          encoder.encode(
            sseEncode('progress', {
              step: 'merge',
              message: 'Slår ihop resultat...',
              total: chunks.length,
              completed: chunks.length,
            })
          )
        );

        let merged = mergeResults(chunkResults);

        if (chunkResults.length > 2) {
          const mergeInput = JSON.stringify(chunkResults, null, 2);
          if (mergeInput.length < 150_000) {
            const mergeResponse = await callClaude(
              buildMergePrompt(),
              `Slå ihop dessa ${chunkResults.length} analysresultat till ett enda JSON-objekt:\n\n${mergeInput}`,
              8000,
            );
            if (mergeResponse) {
              const mergedParsed = parseJsonFromText(mergeResponse);
              if (mergedParsed) {
                merged = {
                  answers: (mergedParsed.answers as Record<string, string>) || merged.answers,
                  details: (mergedParsed.details as Record<string, string>) || merged.details,
                  executiveSummary: (mergedParsed.executiveSummary as string) || merged.executiveSummary,
                  methodology: (mergedParsed.methodology as string) || merged.methodology,
                  dnshAnalysis: (mergedParsed.dnshAnalysis as Record<string, string>) || merged.dnshAnalysis,
                  paiTable: (mergedParsed.paiTable as Array<Record<string, string>>) || merged.paiTable,
                  goodGovernanceAssessment: (mergedParsed.goodGovernanceAssessment as string) || merged.goodGovernanceAssessment,
                };
              }
            }
          }
        }

        stopKeepalive();

        controller.enqueue(
          encoder.encode(
            sseEncode('result', {
              answers: merged.answers,
              details: merged.details,
              executiveSummary: merged.executiveSummary,
              methodology: merged.methodology,
              dnshAnalysis: merged.dnshAnalysis,
              paiTable: merged.paiTable,
              goodGovernanceAssessment: merged.goodGovernanceAssessment,
              meta: {
                chunks: chunks.length,
                totalChars: chunks.reduce((sum, c) => sum + c.length, 0),
                chunkResults: chunkResults.length,
              },
            })
          )
        );

        controller.close();
      } catch (err) {
        stopKeepalive();
        console.error('[ESG Analyze] Streaming error:', err);
        controller.enqueue(
          encoder.encode(
            sseEncode('error', {
              error: err instanceof Error ? err.message : 'Serverfel',
            })
          )
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
