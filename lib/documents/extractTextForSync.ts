/**
 * Minimal text extraction for server-side sync (OneDrive -> KB).
 * Uses same libs as parse-file for PDF, DOCX, Excel. No Textract/S3.
 */

import * as XLSX from 'xlsx';

let pdfParse: typeof import('pdf-parse') | null = null;
let mammoth: typeof import('mammoth') | null = null;

export async function extractTextForSync(
  buffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const lower = fileName.toLowerCase();
  const mt = (mimeType || '').toLowerCase();

  if (lower.endsWith('.pdf') || mt.includes('pdf')) {
    return extractPdf(buffer, fileName);
  }
  if (lower.endsWith('.docx') || lower.endsWith('.doc') || mt.includes('word') || mt.includes('document')) {
    return extractDocx(buffer);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mt.includes('sheet') || mt.includes('excel')) {
    return extractExcel(buffer, fileName);
  }
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
    return '[PowerPoint: Innehåll kan synkas via manuell export till PDF/Word.]';
  }
  return `[Fil: ${fileName}. Ingen text-extraktion för denna filtyp i synk.]`;
}

async function extractPdf(buffer: Buffer, fileName: string): Promise<string> {
  try {
    if (!pdfParse) pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    const text = (data.text || '').trim();
    if (text.length > 50) return text;
  } catch (e) {
    console.warn('[extractTextForSync] PDF failed:', e);
  }
  return `[PDF: ${fileName}. Kunde inte extrahera text.]`;
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    if (!mammoth) mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || '').trim();
    if (text.length > 20) return text;
  } catch (e) {
    console.warn('[extractTextForSync] DOCX failed:', e);
  }
  return '[Word-dokument: Kunde inte extrahera text.]';
}

function extractExcel(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const lines: string[] = [`Excel: ${fileName}`, `Flikar: ${workbook.SheetNames.join(', ')}`, ''];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      lines.push(`--- ${name} ---`);
      json.slice(0, 200).forEach((row) => {
        lines.push((row as unknown[]).map((c) => String(c ?? '')).join(' | '));
      });
      if (json.length > 200) lines.push(`... ${json.length - 200} fler rader`);
    }
    return lines.join('\n');
  } catch (e) {
    console.warn('[extractTextForSync] Excel failed:', e);
  }
  return '[Excel: Kunde inte extrahera text.]';
}
