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
import { getQuestionsForPrompt } from '@/lib/delegation/questions';
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
const MAX_FILES = 10;
const TEXTRACT_MAX_BYTES = 5 * 1024 * 1024;
const CHUNK_CHARS = 100_000;
const MIN_PDF_TEXT_LENGTH = 200;

let mammoth: typeof import('mammoth') | null = null;
let pdfParse: ((buffer: Buffer) => Promise<{ text: string; numpages?: number }>) | null = null;

// ---------------------------------------------------------------------------
// Text extraction (with Textract OCR fallback for scanned PDFs)
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
    console.warn('[Delegation Analyze] pdf-parse failed, will try Textract:', e);
  }

  if (text.length >= MIN_PDF_TEXT_LENGTH) return text;

  console.log('[Delegation Analyze] pdf-parse gave too little text, trying Textract OCR...');
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
    if (ocrText.length >= MIN_PDF_TEXT_LENGTH) {
      console.log(`[Delegation Analyze] Textract OCR extracted ${ocrText.length} chars`);
      return ocrText;
    }
    return text || '[PDF gav för lite text. Filen kan vara skannad utan tillräcklig text.]';
  } catch (e) {
    console.error('[Delegation Analyze] Textract OCR failed:', e);
    return text || '[Kunde inte läsa PDF-filen (varken digital eller via OCR).]';
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    if (!mammoth) mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = (result?.value || '').trim();
    return text.length > 50 ? text : '[Word-dokument verkar tomt.]';
  } catch (e) {
    console.error('[Delegation Analyze] DOCX error:', e);
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
    console.error('[Delegation Analyze] Excel error:', e);
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
      console.warn(`[Delegation Analyze] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const repaired = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(questionsBlock: string, sfdrArticle?: string, fundTermsBlock?: string): string {
  const sfdrNote =
    sfdrArticle === '6'
      ? 'Analysen gäller för SFDR Artikel 6 (inga särskilda hållbarhetskrav). Bedöm enligt grundläggande krav.'
      : sfdrArticle === '8'
        ? 'Analysen gäller för SFDR Artikel 8 (fond som främjar miljö- eller sociala egenskaper). Kräv tydlig hållbarhetsprofil.'
        : sfdrArticle === '9'
          ? 'Analysen gäller för SFDR Artikel 9 (fond med hållbart investeringsmål). Kräv starka hållbarhetsmål och PAI/transparens.'
          : '';

  const fundTermsNote = fundTermsBlock
    ? `\nFONDVILLKOR OCH EXKLUDERINGSPOLICY:
Använd fondvillkoren nedan som referens när du besvarar frågorna, särskilt hållbarhetsfrågorna (39-44) och riskhanteringsfrågorna (15-22).
Bedöm hur den delegerade verksamheten uppfyller fondens specifika krav.
Exponering UNDER gränsvärdet = GODKÄND. Exponering ÖVER = UNDERKÄND. 0% = nolltolerans.

${fundTermsBlock}\n`
    : '';

  return `Du är en expert-analytiker som analyserar uppladdade dokument (PDF, Word, Excel) från ett företag som ska fylla i ett delegationsövervakningsformulär för AIFM Capital AB.
${sfdrNote ? `\nSFDR-KONTEXT: ${sfdrNote}\n` : ''}${fundTermsNote}

Din uppgift: Utifrån dokumentens innehåll ska du extrahera och fylla i svar på VARJE fråga. Du ska vara grundlig och besvara så många frågor som möjligt.

VIKTIGA INSTRUKTIONER FÖR ATT MAXIMERA ANTAL BESVARADE FRÅGOR:

1. EKONOMISK STÄLLNING (fråga 1-5): Sök efter information om betalningsanmärkningar, ägarstruktur, organisationsförändringar, verksamhetsförändringar och samarbetspartners. Om dokumentet beskriver en stabil organisation utan nämnda problem, svara "no" på fråga 1 (inga betalningsanmärkningar) och beskriv strukturen i textfrågor.

2. REGELEFTERLEVNAD (fråga 6-14): Sök efter information om tillstånd, tillsynsbeslut, sanktioner, klagomål, AML/KYC-rutiner, intressekonflikter och incidenthantering. Om rapporten beskriver fungerande compliance-rutiner utan anmärkningar, svara "no" på frågor om negativa händelser.

3. RISKHANTERING (fråga 15-22): Sök efter information om riskhanteringsprocesser, stresstester, likviditetsrisker, operativa risker, cybersäkerhet och beredskapsplaner. Beskriv vad som framgår av dokumenten.

4. PORTFÖLJFÖRVALTNING (fråga 23-33): Sök efter information om investeringsprocesser, investeringsmandat, avkastning, benchmark, derivat, värdepapperslån, motpartsrisker och NAV-beräkning. Extrahera specifika siffror och processbeskrivningar.

5. PERSONAL & KOMPETENS (fråga 34-38): Sök efter information om nyckelpersoner, personalförändringar, utbildning och kompetens.

6. HÅLLBARHET (fråga 39-44): Sök efter ESG-policyer, hållbarhetsindikatorer, SFDR-klassificering och hållbarhetsrisker.

Regler:
- För ja/nej-frågor: svara med "yes" eller "no" (på engelska) i "answers". Ge ALLTID en motivering i "details".
- För textfrågor: skriv ett koncist svar på svenska i "answers". Använd styckeindelning (\\n\\n) i längre svar för läsbarhet.
- FORMATERING: I "details"-fälten, dela upp längre motiveringar i separata stycken med \\n\\n mellan dem. Undvik att skriva en enda lång textmassa.
- Om du kan härleda ett svar från kontexten, gör det och förklara i details.
- Svara ENDAST med ett giltigt JSON-objekt. Inga förklaringar utanför JSON.

Frågelista (id, nummer och frågetext):
${questionsBlock}

Returnera ett enda JSON-objekt med format:
{
  "answers": {
    "q1": "no",
    "q2": "Företaget ägs till 100% av...",
    ...
  },
  "details": {
    "q1": "Inga betalningsanmärkningar nämns i rapporten.",
    "q2": "Se sidan 3 i årsredovisningen.",
    ...
  }
}

VIKTIGT: Besvara ALLA frågor du kan. Ju fler frågor du besvarar, desto bättre.`;
}

function buildMergePrompt(): string {
  return `Du är en assistent som slår ihop analysresultat från delegationsövervakning. Du får flera JSON-objekt med "answers" och "details" från olika delar av samma dokument. Slå ihop dem till ett enda JSON-objekt.

Regler:
- Om samma fråge-id har svar i flera chunks, välj det mest specifika/detaljerade svaret (föredra konkreta uppgifter framför vaga formuleringar).
- Konflikthantering: Om en chunk har "yes" och en annan "no" för samma fråga, behåll "yes" om "details" innehåller tydlig motivering; annars välj det svar som har längre eller mer specifik motivering i "details".
- Deduplicering: Om två chunks ger samma slutsats med nästan identisk "details"-text, behåll en version.
- Slå ihop alla unika nycklar från alla chunks. Saknas ett fråge-id i en chunk men finns i en annan, använd det som finns.
- Svara ENDAST med ett giltigt JSON-objekt med "answers" och "details". Inga kommentarer utanför JSON.`;
}

// ---------------------------------------------------------------------------
// Merge results
// ---------------------------------------------------------------------------

function mergeResults(
  results: Array<{ answers: Record<string, string>; details: Record<string, string> }>
): { answers: Record<string, string>; details: Record<string, string> } {
  if (results.length === 1) return results[0];
  const merged: { answers: Record<string, string>; details: Record<string, string> } = {
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
      console.error('[Delegation Analyze] FormData parse error:', parseErr);
      return NextResponse.json(
        { error: 'Kunde inte läsa uppladdade filer. Kontrollera att filerna inte är för stora (max 50 MB per fil).' },
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

    const combinedParts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      combinedParts.push(`\n\n=== Dokument ${i + 1}: ${f.name} ===\n\n`);
      combinedParts.push(await extractTextFromFile(f));
    }
    const documentText = combinedParts.join('');
    const sfdrArticle = (formData.get('sfdrArticle') as string) || undefined;
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
            parts.push('EXKLUDERINGSKRITERIER:');
            for (const ex of fundConfig.exclusions) {
              parts.push(`  - ${ex.label || ex.category}: max ${ex.threshold}% (0% = nolltolerans)`);
            }
          }
          if (fundConfig.promotedCharacteristics?.length) {
            parts.push(`FRÄMJADE EGENSKAPER: ${fundConfig.promotedCharacteristics.join(', ')}`);
          }
          if (fundConfig.normScreening) {
            const ns = fundConfig.normScreening;
            parts.push(`NORMSCREENING: UNGC=${ns.ungc ? 'Ja' : 'Nej'}, OECD=${ns.oecd ? 'Ja' : 'Nej'}`);
          }
        }
        if (fundDocText) {
          const trimmed = fundDocText.length > 6000 ? fundDocText.slice(0, 6000) + '\n... (förkortat)' : fundDocText;
          parts.push(`\nFONDVILLKOR (utdrag):\n${trimmed}`);
        }
        if (parts.length > 0) {
          fundTermsBlock = parts.join('\n');
        }
      } catch (e) {
        console.warn('[Delegation Analyze] Fund terms fetch failed:', e);
      }
    }

    console.log(`[Delegation Analyze] Total extracted text: ${documentText.length} chars from ${files.length} file(s)${sfdrArticle ? `, SFDR Art. ${sfdrArticle}` : ''}${fundId ? `, Fund: ${fundId}` : ''}`);

    const questionsForPrompt = getQuestionsForPrompt();
    const questionsBlock = questionsForPrompt
      .map((q) => `- ${q.id}: (${q.number}) ${q.text}`)
      .join('\n');

    const systemPrompt = buildSystemPrompt(questionsBlock, sfdrArticle, fundTermsBlock);
    const chunks = splitIntoChunks(documentText, CHUNK_CHARS);
    console.log(`[Delegation Analyze] Split into ${chunks.length} chunk(s)`);

    if (wantsStream) {
      return handleStreaming(chunks, systemPrompt);
    } else {
      return handleRegular(chunks, systemPrompt);
    }
  } catch (err) {
    console.error('[Delegation Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Serverfel' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Regular handler
// ---------------------------------------------------------------------------

async function handleRegular(chunks: string[], systemPrompt: string): Promise<NextResponse> {
  const chunkResults: Array<{ answers: Record<string, string>; details: Record<string, string> }> = [];
  const CONCURRENCY = 3;

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const promises = batch.map((chunk, batchIdx) => {
      const chunkIdx = i + batchIdx;
      const userMessage = `Analysera följande dokument (del ${chunkIdx + 1} av ${chunks.length}) och fyll i svaren på frågorna. Svara endast med JSON-objektet (inga markdown-kodblock, inga kommentarer).

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Sluta här. Ge nu JSON med "answers" och "details" för den information du hittar i denna del.`;
      return callClaude(systemPrompt, userMessage);
    });

    const results = await Promise.all(promises);
    for (const rawText of results) {
      if (rawText) {
        const parsed = parseJsonFromText(rawText);
        if (parsed) {
          chunkResults.push({
            answers: (parsed.answers as Record<string, string>) || {},
            details: (parsed.details as Record<string, string>) || {},
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
          };
        }
      }
    }
  }

  return NextResponse.json({
    answers: merged.answers,
    details: merged.details,
    meta: { chunks: chunks.length, totalChars: chunks.reduce((sum, c) => sum + c.length, 0), chunkResults: chunkResults.length },
  });
}

// ---------------------------------------------------------------------------
// Streaming (SSE) handler
// ---------------------------------------------------------------------------

async function handleStreaming(chunks: string[], systemPrompt: string): Promise<Response> {
  const encoder = new TextEncoder();
  const KEEPALIVE_INTERVAL_MS = 15_000;

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      function startKeepalive() {
        stopKeepalive();
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
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

        controller.enqueue(encoder.encode(sseEncode('progress', {
          step: 'start',
          message: `Analyserar ${chunks.length} del(ar) av dokumentet...`,
          total: chunks.length,
          completed: 0,
        })));

        const chunkResults: Array<{ answers: Record<string, string>; details: Record<string, string> }> = [];
        const CONCURRENCY = 3;

        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
          const batch = chunks.slice(i, i + CONCURRENCY);
          const promises = batch.map((chunk, batchIdx) => {
            const chunkIdx = i + batchIdx;
            const userMessage = `Analysera följande dokument (del ${chunkIdx + 1} av ${chunks.length}) och fyll i svaren på frågorna. Svara endast med JSON-objektet (inga markdown-kodblock, inga kommentarer).

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Sluta här. Ge nu JSON med "answers" och "details" för den information du hittar i denna del.`;
            return callClaude(systemPrompt, userMessage);
          });

          const results = await Promise.all(promises);
          for (const rawText of results) {
            if (rawText) {
              const parsed = parseJsonFromText(rawText);
              if (parsed) {
                chunkResults.push({
                  answers: (parsed.answers as Record<string, string>) || {},
                  details: (parsed.details as Record<string, string>) || {},
                });
              }
            }
          }

          controller.enqueue(encoder.encode(sseEncode('progress', {
            step: 'chunk',
            message: `Analyserat ${Math.min(i + CONCURRENCY, chunks.length)} av ${chunks.length} delar...`,
            total: chunks.length,
            completed: Math.min(i + CONCURRENCY, chunks.length),
          })));
        }

        if (chunkResults.length === 0) {
          stopKeepalive();
          controller.enqueue(encoder.encode(sseEncode('error', { error: 'AI-analysen kunde inte genomföras.' })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(sseEncode('progress', {
          step: 'merge',
          message: 'Slår ihop resultat...',
          total: chunks.length,
          completed: chunks.length,
        })));

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
                };
              }
            }
          }
        }

        stopKeepalive();

        controller.enqueue(encoder.encode(sseEncode('result', {
          answers: merged.answers,
          details: merged.details,
          meta: {
            chunks: chunks.length,
            totalChars: chunks.reduce((sum, c) => sum + c.length, 0),
            chunkResults: chunkResults.length,
          },
        })));

        controller.close();
      } catch (err) {
        stopKeepalive();
        console.error('[Delegation Analyze] Streaming error:', err);
        controller.enqueue(encoder.encode(sseEncode('error', {
          error: err instanceof Error ? err.message : 'Serverfel',
        })));
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
