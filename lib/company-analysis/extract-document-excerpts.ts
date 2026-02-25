/**
 * Extract text excerpts from IR documents (S3 or stored textContent) for AI context.
 * Uses pdf-parse with Textract OCR fallback for PDFs.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import type { HoldingDocument } from '../holding-documents/holding-document-store';
import type { DocumentExcerpt } from './types';

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'aifm-documents';
const REGION = process.env.AWS_REGION || 'eu-north-1';
const TEXTRACT_REGION = 'eu-west-1';
const DEFAULT_EXCERPT_LENGTH = 5000;
const MAX_DOCS = 5;
const MIN_PDF_TEXT_LENGTH = 200;
const TEXTRACT_MAX_BYTES = 5 * 1024 * 1024;

const s3 = new S3Client({ region: REGION });
const textractClient = new TextractClient({
  region: TEXTRACT_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const CATEGORY_PRIORITY: Record<string, number> = {
  annual_report: 0,
  sustainability_report: 1,
  quarterly_report: 2,
  investor_presentation: 3,
  governance: 4,
  other: 5,
};

let pdfParse: ((buffer: Buffer) => Promise<{ text: string; numpages?: number }>) | null = null;

async function extractFromPdf(buffer: Buffer): Promise<string> {
  let text = '';
  try {
    if (!pdfParse) {
      const mod = await import('pdf-parse');
      pdfParse = mod.default;
    }
    const data = await pdfParse(buffer);
    text = (data?.text || '').trim();
  } catch {
    // fall through to Textract
  }
  if (text.length >= MIN_PDF_TEXT_LENGTH) return text;
  try {
    if (buffer.length > TEXTRACT_MAX_BYTES) return text || '[PDF för stor för OCR.]';
    const response = await textractClient.send(
      new DetectDocumentTextCommand({ Document: { Bytes: buffer } })
    );
    const lines = (response.Blocks || [])
      .filter((b) => b.BlockType === 'LINE' && b.Text)
      .map((b) => b.Text as string);
    const ocr = lines.join('\n').trim();
    return ocr.length >= MIN_PDF_TEXT_LENGTH ? ocr : text || '[Lite text extraherad.]';
  } catch {
    return text || '[Kunde inte läsa PDF.]';
  }
}

function isPdf(doc: HoldingDocument): boolean {
  const ft = (doc.fileType || '').toLowerCase();
  const fn = (doc.fileName || '').toLowerCase();
  return ft === 'pdf' || fn.endsWith('.pdf');
}

/**
 * Fetch document excerpts for the top N IR documents (by category priority).
 * Uses stored textContent when available; otherwise downloads from S3 and extracts text.
 */
export async function extractDocumentExcerpts(
  irDocuments: HoldingDocument[],
  options?: { maxDocs?: number; excerptLength?: number }
): Promise<DocumentExcerpt[]> {
  const maxDocs = options?.maxDocs ?? MAX_DOCS;
  const excerptLength = options?.excerptLength ?? DEFAULT_EXCERPT_LENGTH;

  const sorted = [...irDocuments].sort(
    (a, b) => (CATEGORY_PRIORITY[a.category] ?? 99) - (CATEGORY_PRIORITY[b.category] ?? 99)
  );
  const toProcess = sorted.slice(0, maxDocs);
  const excerpts: DocumentExcerpt[] = [];

  for (const doc of toProcess) {
    let text = '';
    if (doc.textContent && doc.textContent.trim().length > 100) {
      text = doc.textContent.trim();
    } else if (isPdf(doc) && doc.s3Key) {
      try {
        const res = await s3.send(
          new GetObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key })
        );
        const body = res.Body;
        if (body) {
          const buffer = Buffer.from(await body.transformToByteArray());
          text = await extractFromPdf(buffer);
        }
      } catch (e) {
        console.warn('[extract-document-excerpts] S3/PDF failed for', doc.s3Key, e);
      }
    }
    if (text.length > 0) {
      excerpts.push({
        documentId: doc.documentId,
        fileName: doc.fileName,
        category: doc.category,
        excerpt: text.slice(0, excerptLength),
        excerptLength,
      });
    }
  }
  return excerpts;
}
