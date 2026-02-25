/**
 * Excel Review – Analyse an Excel file and add cell comments (notes) with
 * AI-generated feedback directly in the file.  Uses exceljs for manipulation
 * and Claude (Bedrock) for the actual review.
 *
 * Strategy:
 *   1. Read the workbook with exceljs and extract text per sheet/cell.
 *   2. Send structured text + user instructions to Claude → get comments.
 *   3. Add notes to the relevant cells via exceljs.
 *   4. Return the modified Excel buffer.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 240_000,
    connectionTimeout: 10_000,
  }),
});

const MODEL_IDS = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

const AUTHOR = 'AIFM Agent';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ExcelComment {
  sheet: string;       // Sheet name
  cell: string;        // Cell reference, e.g. "B5"
  comment: string;     // The note content
  type: 'comment' | 'suggestion' | 'issue';
}

export interface ExcelReviewEdits {
  summary: string;
  comments: ExcelComment[];
}

export interface ReviewExcelInput {
  fileBufferBase64: string;
  fileName?: string;
  instructions: string;
  documentText: string;
}

export interface ReviewExcelResult {
  success: true;
  fileBase64: string;
  fileName: string;
  summary: string;
  fileType: 'excel';
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du är en finansiell analytiker och compliance-medarbetare som granskar Excel-filer. Du ska returnera ett strukturerat JSON-objekt med kommentarer som ska läggas till som cellanteckningar (notes) i Excel-filen.

VIKTIGT:
- sheet ska vara det exakta fliknamnet (sheet name) som anges i dokumentet.
- cell ska vara en giltig cellreferens som "A1", "B5", "C12" etc.
- comment ska vara din kommentar/förslag/anmärkning.
- type ska vara "comment" (allmän kommentar), "suggestion" (förbättringsförslag) eller "issue" (problem/risk).
- Svara ENDAST med giltig JSON. Inga markdown-kodblock.

PRECISION:
- Referera till specifika celler med korrekt cellreferens.
- Ge korta, tydliga kommentarer.
- Om du kommenterar en formel eller beräkning, förklara vad som kan vara fel.
- Om du kommenterar data, referera till det specifika värdet.

JSON-format:
{
  "summary": "Kort sammanfattning av granskningen (1-3 meningar).",
  "comments": [
    {
      "sheet": "Fliknamn",
      "cell": "B5",
      "comment": "Din kommentar här",
      "type": "comment"
    }
  ]
}

Om du inte har några kommentarer, använd tom array []. summary ska alltid fyllas i.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJsonFromResponse(text: string): ExcelReviewEdits {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Ingen JSON hittades i AI-svar');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    const repaired = jsonMatch[0]
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/(?<=:\s*")((?:[^"\\]|\\.)*)(?=")/gs, (m: string) =>
        m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'),
      );
    parsed = JSON.parse(repaired) as Record<string, unknown>;
  }
  return {
    summary: (parsed.summary as string) ?? '',
    comments: Array.isArray(parsed.comments)
      ? (parsed.comments as ExcelComment[]).filter(
          (c) => typeof c.sheet === 'string' && typeof c.cell === 'string' && typeof c.comment === 'string',
        )
      : [],
  };
}

/** Extract structured text from an Excel workbook for the AI prompt */
async function extractExcelStructure(buffer: Buffer): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const parts: string[] = [];

  for (const worksheet of workbook.worksheets) {
    parts.push(`\n=== FLIK: ${worksheet.name} ===`);
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;
    parts.push(`Rader: ${rowCount}, Kolumner: ${colCount}`);

    // Extract up to 200 rows per sheet
    const maxRows = Math.min(rowCount, 200);
    for (let r = 1; r <= maxRows; r++) {
      const row = worksheet.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= Math.min(colCount, 30); c++) {
        const cell = row.getCell(c);
        const addr = cell.address; // e.g. "A1"
        let val = '';
        if (cell.formula) {
          val = `=${cell.formula}`;
        } else if (cell.value !== null && cell.value !== undefined) {
          if (cell.value instanceof Date) {
            val = cell.value.toISOString().split('T')[0];
          } else if (typeof cell.value === 'object' && 'richText' in cell.value) {
            val = (cell.value as { richText: Array<{ text: string }> }).richText.map((rt) => rt.text).join('');
          } else {
            val = String(cell.value);
          }
        }
        if (val) {
          cells.push(`${addr}=${val}`);
        }
      }
      if (cells.length > 0) {
        parts.push(`[Rad ${r}] ${cells.join(' | ')}`);
      }
    }
    if (rowCount > maxRows) {
      parts.push(`... (${rowCount - maxRows} fler rader visas inte)`);
    }
  }

  return parts.join('\n');
}

// ─── Main review function ────────────────────────────────────────────────────

export async function runReviewExcel(input: ReviewExcelInput): Promise<ReviewExcelResult> {
  const { fileBufferBase64, fileName, instructions, documentText } = input;
  const buffer = Buffer.from(fileBufferBase64, 'base64');

  // Get structured text from the Excel file
  let structuredText: string;
  try {
    structuredText = await extractExcelStructure(buffer);
  } catch (err) {
    console.warn('[ReviewExcel] Could not extract structure, using provided text:', err);
    structuredText = documentText;
  }

  const userPrompt = `Användarens instruktion: ${instructions}

Dokumentets innehåll:

${structuredText.slice(0, 180000)}

Returnera JSON med dina kommentarer. Referera till exakta fliknamn och cellreferenser.`;

  let lastError: Error | null = null;
  for (const modelId of MODEL_IDS) {
    try {
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as {
        content?: Array<{ text?: string }>;
      };
      const textContent = responseBody.content?.[0]?.text ?? '';
      if (!textContent) continue;

      const { summary, comments } = extractJsonFromResponse(textContent);
      console.log(`[ReviewExcel] Applying ${comments.length} cell notes`);

      // Load workbook with exceljs and add notes
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      let appliedCount = 0;
      for (const c of comments) {
        // Find the worksheet by name
        const ws = workbook.getWorksheet(c.sheet);
        if (!ws) {
          console.warn(`[ReviewExcel] Sheet "${c.sheet}" not found, skipping`);
          continue;
        }

        try {
          const cell = ws.getCell(c.cell);
          const prefix = c.type === 'issue' ? '[PROBLEM] ' : c.type === 'suggestion' ? '[FÖRSLAG] ' : '';
          const noteText = `${prefix}${c.comment}\n— ${AUTHOR}`;

          // If cell already has a note, append to it
          if (cell.note) {
            const existingNote = typeof cell.note === 'string' ? cell.note : (cell.note as { texts: Array<{ text: string }> }).texts?.map(t => t.text).join('') || '';
            cell.note = `${existingNote}\n\n${noteText}`;
          } else {
            cell.note = noteText;
          }
          appliedCount++;
        } catch (cellErr) {
          console.warn(`[ReviewExcel] Could not add note to ${c.sheet}!${c.cell}:`, cellErr);
        }
      }

      console.log(`[ReviewExcel] Applied ${appliedCount}/${comments.length} notes`);

      // Write back to buffer
      const outputBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
      console.log(`[ReviewExcel] Output: ${outputBuffer.length} bytes`);

      return {
        success: true,
        fileBase64: outputBuffer.toString('base64'),
        fileName: fileName || 'document_reviewed.xlsx',
        summary: summary || 'Kommentarer tillagda.',
        fileType: 'excel',
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ReviewExcel] Model ${modelId} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('Alla modeller misslyckades');
}
