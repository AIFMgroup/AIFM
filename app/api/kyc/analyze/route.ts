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
import { getKycQuestionsForPrompt } from '@/lib/kyc/questions';

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
    console.warn('[KYC Analyze] pdf-parse failed, will try Textract:', e);
  }

  if (text.length >= MIN_PDF_TEXT_LENGTH) return text;

  console.log('[KYC Analyze] pdf-parse gave too little text, trying Textract OCR...');
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
      console.log(`[KYC Analyze] Textract OCR extracted ${ocrText.length} chars`);
      return ocrText;
    }
    return text || '[PDF gav för lite text. Filen kan vara skannad utan tillräcklig text.]';
  } catch (e) {
    console.error('[KYC Analyze] Textract OCR failed:', e);
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
    console.error('[KYC Analyze] DOCX error:', e);
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
    console.error('[KYC Analyze] Excel error:', e);
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

function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    let end = Math.min(offset + maxChars, text.length);
    if (end < text.length) {
      const lastParagraph = text.lastIndexOf('\n\n', end);
      if (lastParagraph > offset + maxChars * 0.6) end = lastParagraph;
      else {
        const lastNewline = text.lastIndexOf('\n', end);
        if (lastNewline > offset + maxChars * 0.6) end = lastNewline;
      }
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

const MODEL_CANDIDATES = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 8000,
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
      console.warn(`[KYC Analyze] Model ${modelId} failed:`, err);
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

function buildSystemPrompt(questionsBlock: string): string {
  return `Du är en KYC/AML-expert som analyserar uppladdade kunddokument (årsredovisning, bolagsregistreringsbevis, UBO-deklarationer, PDF/Word/Excel) för att fylla i en KYC-checklista för AIFM Capital AB.

Din uppgift: Utifrån dokumentens innehåll ska du för varje checklistpunkt extrahera relevant information och ange om dokumentet stöder att punkten kan anses uppfylld ("yes"), delvis ("partial") eller om information saknas ("no").

Checklistpunkter (id, nummer, text – vad du ska leta efter):
${questionsBlock}

Regler:
- För varje id: ange i "answers" antingen "yes", "no" eller "partial".
- "yes" = dokumentet innehåller tydlig information som stöder att kravet är uppfyllt.
- "partial" = viss information finns men komplett verifiering krävs fortfarande.
- "no" = information saknas eller dokumentet nämner inte ämnet.
- I "details" ska du alltid skriva en kort sammanfattning på svenska av vad du hittat (t.ex. namngivna ägare, adresser, PEP-kopplingar, verksamhetsbeskrivning). Detta visas som "notes" i checklistan.
- Extrahera konkreta uppgifter: namn, procent, adresser, datum där det finns.
- Svara ENDAST med ett giltigt JSON-objekt. Inga förklaringar utanför JSON.

Returnera ett enda JSON-objekt med format:
{
  "answers": {
    "c1": "yes",
    "c2": "partial",
    "c3": "yes",
    "c4": "no",
    "c5": "no",
    "c6": "yes",
    "c7": "partial",
    "edd": "no"
  },
  "details": {
    "c1": "Bolaget har angivit verklig huvudman: Anna Andersson (35%), Bertil Berg (40%).",
    "c2": "Personuppgifter finns i bilaga 2, verifieringsdatum saknas.",
    "c3": "Registrerad adress: Storgatan 1, 111 22 Stockholm.",
    "c4": "Inga styrelseledamöter eller ägare med offentliga uppdrag nämnda.",
    "c5": "Ingen information om sanktionslistekontroll i dokumentet.",
    "c6": "Verksamhet: IT-konsult, omsättning 12 Mkr, 15 anställda.",
    "c7": "Finansiering från aktieägarinsatser nämnd, detaljer saknas.",
    "edd": "Ej tillämpligt (läg risk)."
  }
}`;
}

function buildMergePrompt(): string {
  return `Du är en assistent som slår ihop KYC-analysresultat. Du får flera JSON-objekt med "answers" och "details" från olika delar av samma dokument. Slå ihop dem till ett enda JSON-objekt.

Regler:
- Om samma checklist-id har svar i flera chunks, välj "yes" om någon chunk har "yes", annars "partial", annars "no".
- Slå ihop "details"-texter: konkatenera med " | " om flera chunks har info för samma id.
- Svara ENDAST med ett giltigt JSON-objekt med "answers" och "details".`;
}

function mergeResults(
  results: Array<{ answers: Record<string, string>; details: Record<string, string> }>
): { answers: Record<string, string>; details: Record<string, string> } {
  if (results.length === 1) return results[0];
  const merged: { answers: Record<string, string>; details: Record<string, string> } = {
    answers: {},
    details: {},
  };
  const order: Record<string, number> = { yes: 2, partial: 1, no: 0 };
  for (const result of results) {
    for (const [key, value] of Object.entries(result.answers || {})) {
      if (value != null && String(value).trim() !== '') {
        const v = String(value).toLowerCase();
        const existing = merged.answers[key];
        const existingOrder = order[existing?.toLowerCase() ?? ''] ?? -1;
        const newOrder = order[v] ?? 0;
        if (existingOrder < newOrder) merged.answers[key] = String(value);
        else if (!existing) merged.answers[key] = String(value);
      }
    }
    for (const [key, value] of Object.entries(result.details || {})) {
      if (value != null && String(value).trim() !== '') {
        const existing = merged.details[key];
        merged.details[key] = existing ? existing + ' | ' + String(value) : String(value);
      }
    }
  }
  return merged;
}

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const maxDuration = 300;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      console.error('[KYC Analyze] FormData parse error:', parseErr);
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

    const acceptHeader = request.headers.get('accept') || '';
    const wantsStream = acceptHeader.includes('text/event-stream');

    const combinedParts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      combinedParts.push(`\n\n=== Dokument ${i + 1}: ${f.name} ===\n\n`);
      combinedParts.push(await extractTextFromFile(f));
    }
    const documentText = combinedParts.join('');

    console.log(`[KYC Analyze] Total extracted text: ${documentText.length} chars from ${files.length} file(s)`);

    const questionsForPrompt = getKycQuestionsForPrompt();
    const questionsBlock = questionsForPrompt
      .map((q) => `- ${q.id}: (${q.number}) ${q.text}. Leta efter: ${q.extractHint ?? 'relevant KYC-info'}`)
      .join('\n');

    const systemPrompt = buildSystemPrompt(questionsBlock);
    const chunks = splitIntoChunks(documentText, CHUNK_CHARS);
    console.log(`[KYC Analyze] Split into ${chunks.length} chunk(s)`);

    if (wantsStream) {
      return handleStreaming(chunks, systemPrompt);
    } else {
      return handleRegular(chunks, systemPrompt);
    }
  } catch (err) {
    console.error('[KYC Analyze] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Serverfel' },
      { status: 500 }
    );
  }
}

async function handleRegular(
  chunks: string[],
  systemPrompt: string,
): Promise<NextResponse> {
  const chunkResults: Array<{ answers: Record<string, string>; details: Record<string, string> }> = [];

  if (chunks.length === 1) {
    const userMessage = `Analysera följande KYC-dokument och fyll i checklistan. Svara endast med JSON-objektet (inga markdown-kodblock, inga kommentarer).

DOKUMENT:

${chunks[0]}

Sluta här. Ge nu JSON med "answers" och "details".`;

    const rawText = await callClaude(systemPrompt, userMessage);
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
      meta: { chunks: 1, totalChars: chunks[0].length },
    });
  }

  const CONCURRENCY = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const promises = batch.map((chunk, batchIdx) => {
      const chunkIdx = i + batchIdx;
      const userMessage = `Analysera följande KYC-dokument (del ${chunkIdx + 1} av ${chunks.length}). Svara endast med JSON (inga markdown-kodblock).

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Sluta här. Ge JSON med "answers" och "details" för den information du hittar i denna del.`;
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
        `Slå ihop dessa ${chunkResults.length} KYC-analysresultat till ett enda JSON-objekt:\n\n${mergeInput}`,
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
    meta: {
      chunks: chunks.length,
      totalChars: chunks.reduce((sum, c) => sum + c.length, 0),
      chunkResults: chunkResults.length,
    },
  });
}

async function handleStreaming(
  chunks: string[],
  systemPrompt: string,
): Promise<Response> {
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

        const chunkResults: Array<{ answers: Record<string, string>; details: Record<string, string> }> = [];
        const CONCURRENCY = 3;

        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
          const batch = chunks.slice(i, i + CONCURRENCY);
          const promises = batch.map((chunk, batchIdx) => {
            const chunkIdx = i + batchIdx;
            const userMessage = `Analysera följande KYC-dokument (del ${chunkIdx + 1} av ${chunks.length}). Svara endast med JSON.

DOKUMENT (del ${chunkIdx + 1}/${chunks.length}):

${chunk}

Sluta här. Ge JSON med "answers" och "details" för denna del.`;
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
          controller.enqueue(encoder.encode(sseEncode('error', { error: 'AI-analysen kunde inte genomföras.' })));
          controller.close();
          return;
        }

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
              `Slå ihop dessa ${chunkResults.length} KYC-analysresultat:\n\n${mergeInput}`,
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
        controller.enqueue(
          encoder.encode(
            sseEncode('result', {
              answers: merged.answers,
              details: merged.details,
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
        console.error('[KYC Analyze] Streaming error:', err);
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
