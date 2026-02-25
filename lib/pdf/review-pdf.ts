/**
 * PDF Review – Analyse a PDF and add sticky-note annotations with AI-generated
 * comments directly in the file.  Uses pdf-lib for manipulation and Claude
 * (Bedrock) for the actual review.
 *
 * Because PDFs don't support Word-style track changes, the strategy is:
 *   1. Extract text per page (pdf-parse).
 *   2. Send text + user instructions to Claude → get structured comments.
 *   3. Add sticky-note annotations on the relevant pages via pdf-lib.
 *   4. Return the modified PDF buffer.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { PDFDocument, PDFName, PDFArray, PDFString } from 'pdf-lib';

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

export interface PdfComment {
  pageIndex: number;       // 0-based
  targetText: string;      // The text being commented on
  comment: string;         // The annotation content
  type: 'comment' | 'suggestion' | 'issue';
}

export interface PdfReviewEdits {
  summary: string;
  comments: PdfComment[];
}

export interface ReviewPdfInput {
  fileBufferBase64: string;
  fileName?: string;
  instructions: string;
  documentText: string;
  pageTexts?: string[];
}

export interface ReviewPdfResult {
  success: true;
  fileBase64: string;
  fileName: string;
  summary: string;
  fileType: 'pdf';
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du är en juridisk och compliance-medarbetare som granskar PDF-dokument. Du ska returnera ett strukturerat JSON-objekt med kommentarer som ska läggas till som annotationer (sticky notes) i PDF-filen.

VIKTIGT:
- pageIndex är 0-baserat (första sidan = 0).
- targetText ska vara ett kort utdrag (1-2 meningar) från den text du kommenterar, kopierat ordagrant.
- comment ska vara din kommentar/förslag/anmärkning.
- type ska vara "comment" (allmän kommentar), "suggestion" (förbättringsförslag) eller "issue" (problem/risk).
- Svara ENDAST med giltig JSON. Inga markdown-kodblock.

PRECISION:
- Var specifik – referera till exakt text i dokumentet.
- Ge korta, tydliga kommentarer.
- Gruppera inte flera synpunkter i en kommentar – skapa separata kommentarer.

JSON-format:
{
  "summary": "Kort sammanfattning av granskningen (1-3 meningar).",
  "comments": [
    {
      "pageIndex": 0,
      "targetText": "exakt text som kommenteras",
      "comment": "Din kommentar här",
      "type": "comment"
    }
  ]
}

Om du inte har några kommentarer, använd tom array []. summary ska alltid fyllas i.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJsonFromResponse(text: string): PdfReviewEdits {
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
      ? (parsed.comments as PdfComment[]).filter(
          (c) => typeof c.pageIndex === 'number' && typeof c.comment === 'string',
        )
      : [],
  };
}

async function extractPageTexts(buffer: Buffer): Promise<string[]> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    // pdf-parse doesn't natively give per-page text, so we do a simple split
    const data = await pdfParse(buffer);
    // Many PDFs use form-feed (\f) as page separator
    const pages = data.text.split(/\f/);
    if (pages.length > 1) return pages.map((p) => p.trim());
    // Fallback: return the whole text as page 0
    return [data.text.trim()];
  } catch {
    return [''];
  }
}

// ─── Main review function ────────────────────────────────────────────────────

export async function runReviewPdf(input: ReviewPdfInput): Promise<ReviewPdfResult> {
  const { fileBufferBase64, fileName, instructions, documentText, pageTexts: pageTextsInput } = input;
  const buffer = Buffer.from(fileBufferBase64, 'base64');

  // Get per-page text
  const pageTexts = pageTextsInput && pageTextsInput.length > 0
    ? pageTextsInput
    : await extractPageTexts(buffer);

  const numberedPages = pageTexts
    .map((p, i) => `[Sida ${i}] ${p}`)
    .join('\n\n');

  const userPrompt = `Användarens instruktion: ${instructions}

Dokumentets sidor (index 0 till ${pageTexts.length - 1}):

${numberedPages.slice(0, 180000)}

Returnera JSON med dina kommentarer. Använd exakt text från sidorna ovan.`;

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
      console.log(`[ReviewPdf] Applying ${comments.length} annotations`);

      // Load PDF and add annotations
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();
      const dateStr = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

      // Group comments by page
      const commentsByPage = new Map<number, PdfComment[]>();
      for (const c of comments) {
        const pi = Math.max(0, Math.min(c.pageIndex, pages.length - 1));
        if (!commentsByPage.has(pi)) commentsByPage.set(pi, []);
        commentsByPage.get(pi)!.push(c);
      }

      for (const [pageIdx, pageComments] of commentsByPage) {
        const page = pages[pageIdx];
        const { height } = page.getSize();

        // Get or create the Annots array on this page
        let annotsArray: PDFArray;
        const existingAnnots = page.node.get(PDFName.of('Annots'));
        if (existingAnnots instanceof PDFArray) {
          annotsArray = existingAnnots;
        } else {
          annotsArray = pdfDoc.context.obj([]);
          page.node.set(PDFName.of('Annots'), annotsArray);
        }

        for (let ci = 0; ci < pageComments.length; ci++) {
          const c = pageComments[ci];
          // Position sticky notes along the right margin, staggered vertically
          const x = 30;
          const y = height - 40 - ci * 25;
          const iconName = c.type === 'issue' ? 'Help' : c.type === 'suggestion' ? 'Insert' : 'Comment';

          // Build the annotation content: include the target text reference
          const annotContent = c.targetText
            ? `[${c.targetText.slice(0, 80)}${c.targetText.length > 80 ? '...' : ''}]\n\n${c.comment}`
            : c.comment;

          const annotation = pdfDoc.context.obj({
            Type: 'Annot',
            Subtype: 'Text',
            Open: false,
            Name: iconName,
            Rect: [x, y, x + 20, y + 20],
            Contents: PDFString.of(annotContent),
            T: PDFString.of(AUTHOR),
            M: PDFString.of(`D:${dateStr.replace(/[-:TZ]/g, '').slice(0, 14)}`),
            C: c.type === 'issue'
              ? [1.0, 0.0, 0.0]       // Red for issues
              : c.type === 'suggestion'
                ? [0.0, 0.5, 1.0]     // Blue for suggestions
                : [1.0, 0.85, 0.0],   // Yellow/gold for comments
            F: 4, // Print flag
          });

          const annotRef = pdfDoc.context.register(annotation);
          annotsArray.push(annotRef);
        }
      }

      const modifiedBuffer = Buffer.from(await pdfDoc.save());
      console.log(`[ReviewPdf] Output: ${modifiedBuffer.length} bytes`);

      return {
        success: true,
        fileBase64: modifiedBuffer.toString('base64'),
        fileName: fileName || 'document_reviewed.pdf',
        summary: summary || 'Kommentarer tillagda.',
        fileType: 'pdf',
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ReviewPdf] Model ${modelId} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('Alla modeller misslyckades');
}
