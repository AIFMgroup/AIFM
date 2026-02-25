import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { DocxXmlEditor, type DocumentReviewEdits } from '@/lib/docx/docx-xml-editor';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
  requestHandler: new NodeHttpHandler({
    requestTimeout: 240_000, // 4 min – document review can be slow for large docs
    connectionTimeout: 10_000,
  }),
});

const MODEL_IDS = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

const SYSTEM_PROMPT = `Du är en juridisk och compliance-medarbetare som granskar avtal och andra dokument. Du ska returnera ett strukturerat JSON-objekt med föreslagna ändringar som ska appliceras som spårändringar och kommentarer i ett Word-dokument.

VIKTIGT:
- paragraphIndex är 0-baserat (första stycket = 0).
- All text du refererar till (originalText, targetText, afterText, newText) MÅSTE matcha exakt mot dokumentets text. Kopiera texten ordagrant från det givna dokumentet.
- Ge korta, tydliga reason/comment som förklaring.
- Svara ENDAST med giltig JSON. Inga markdown-kodblock, inga förklaringar utanför JSON.

PRECISION FÖR REPLACEMENTS – MYCKET VIKTIGT:
- originalText ska vara SÅ KORT SOM MÖJLIGT – bara det ord eller den fras som faktiskt ändras.
- Inkludera INTE omgivande text som förblir oförändrad.
- Exempel: Om du vill ändra "ansökan" till "anmälan" i meningen "i enlighet med denna ansökan", sätt originalText till "ansökan" och newText till "anmälan" – INTE hela meningen.
- Om flera ord i rad ändras, inkludera bara de ändrade orden plus eventuellt mellanslag.
- Samma princip gäller deletions: originalText ska bara vara den text som faktiskt ska strykas.

JSON-format:
{
  "summary": "Kort sammanfattning av alla ändringar (1-3 meningar).",
  "deletions": [ { "paragraphIndex": 0, "originalText": "exakt text att stryka", "reason": "varför" } ],
  "insertions": [ { "paragraphIndex": 0, "afterText": "text efter vilken ny text ska in", "newText": "ny text", "reason": "varför" } ],
  "replacements": [ { "paragraphIndex": 0, "originalText": "gammal text", "newText": "ny text", "reason": "varför" } ],
  "comments": [ { "paragraphIndex": 0, "targetText": "text som kommenteras", "comment": "kommentaren" } ]
}

Om du inte har några ändringar i en kategori, använd tom array []. summary ska alltid fyllas i.`;

function extractJsonFromResponse(text: string): DocumentReviewEdits & { summary?: string } {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Ingen JSON hittades i AI-svar');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    const repaired = jsonMatch[0]
      .replace(/,\s*([\]}])/g, '$1')
      .replace(/(?<=:\s*")((?:[^"\\]|\\.)*)(?=")/gs, (m: string) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'));
    parsed = JSON.parse(repaired) as Record<string, unknown>;
  }
  return {
    summary: (parsed.summary as string) ?? '',
    deletions: Array.isArray(parsed.deletions) ? (parsed.deletions as DocumentReviewEdits['deletions']) : [],
    insertions: Array.isArray(parsed.insertions) ? (parsed.insertions as DocumentReviewEdits['insertions']) : [],
    replacements: Array.isArray(parsed.replacements) ? (parsed.replacements as DocumentReviewEdits['replacements']) : [],
    comments: Array.isArray(parsed.comments) ? (parsed.comments as DocumentReviewEdits['comments']) : [],
  };
}

export interface ReviewDocxInput {
  fileBufferBase64: string;
  fileName?: string;
  instructions: string;
  documentText: string;
  paragraphs?: string[];
}

export interface ReviewDocxResult {
  success: true;
  fileBase64: string;
  fileName: string;
  summary: string;
}

/** Run document review: call Claude for edits, apply to DOCX, return modified file. */
export async function runReviewDocx(input: ReviewDocxInput): Promise<ReviewDocxResult> {
  const { fileBufferBase64, fileName, instructions, documentText, paragraphs: paragraphsInput } = input;
  const buffer = Buffer.from(fileBufferBase64, 'base64');
  const editor = await DocxXmlEditor.load(buffer);
  const paragraphCount = editor.getParagraphCount();
  const paragraphTexts = editor.getParagraphTexts();
  const numberedParagraphs = paragraphsInput ?? paragraphTexts;
  const documentWithNumbers = numberedParagraphs
    .map((p: string, i: number) => `[Stycke ${i}] ${p}`)
    .join('\n\n');

  const userPrompt = `Användarens instruktion: ${instructions}

Dokumentets stycken (index 0 till ${paragraphCount - 1}):

${documentWithNumbers}

Returnera JSON med dina föreslagna ändringar (deletions, insertions, replacements, comments). Använd exakt text från styckena ovan.`;

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
      const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as { content?: Array<{ text?: string }> };
      const textContent = responseBody.content?.[0]?.text ?? '';
      if (!textContent) continue;

      const { summary, deletions, insertions, replacements, comments } = extractJsonFromResponse(textContent);
      const edits: DocumentReviewEdits = {
        deletions,
        insertions,
        replacements,
        comments,
      };

      const editCount = (deletions?.length ?? 0) + (insertions?.length ?? 0) + (replacements?.length ?? 0) + (comments?.length ?? 0);
      console.log(`[ReviewDocx] Applying ${editCount} edits (${deletions?.length ?? 0} del, ${insertions?.length ?? 0} ins, ${replacements?.length ?? 0} rep, ${comments?.length ?? 0} com)`);

      editor.applyEdits(edits);
      const modifiedBuffer = await editor.toBuffer();

      // Validate the output is a valid ZIP (DOCX) by trying to parse it
      try {
        const JSZipValidate = (await import('jszip')).default;
        const validateZip = await JSZipValidate.loadAsync(modifiedBuffer);
        const docXml = validateZip.file('word/document.xml');
        if (!docXml) {
          console.error('[ReviewDocx] VALIDATION FAILED: word/document.xml missing from output');
          // Fall back to returning the original file unmodified
          return {
            success: true,
            fileBase64: fileBufferBase64,
            fileName: fileName || 'document_reviewed.docx',
            summary: summary + ' (Varning: Kunde inte applicera ändringar i filen, originalfilen returneras.)',
          };
        }
        const docContent = await docXml.async('string');
        if (!docContent.includes('<w:body') || !docContent.includes('</w:body>')) {
          console.error('[ReviewDocx] VALIDATION FAILED: document.xml missing body element');
          return {
            success: true,
            fileBase64: fileBufferBase64,
            fileName: fileName || 'document_reviewed.docx',
            summary: summary + ' (Varning: Kunde inte applicera ändringar i filen, originalfilen returneras.)',
          };
        }
        console.log(`[ReviewDocx] Output validated: ${modifiedBuffer.length} bytes, document.xml OK`);
      } catch (valErr) {
        console.error('[ReviewDocx] VALIDATION FAILED:', valErr);
        return {
          success: true,
          fileBase64: fileBufferBase64,
          fileName: fileName || 'document_reviewed.docx',
          summary: summary + ' (Varning: Kunde inte applicera ändringar i filen, originalfilen returneras.)',
        };
      }

      const fileBase64 = modifiedBuffer.toString('base64');

      return {
        success: true,
        fileBase64,
        fileName: fileName || 'document_reviewed.docx',
        summary: summary || 'Ändringar applicerade.',
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[ReviewDocx] Model ${modelId} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('Alla modeller misslyckades');
}
