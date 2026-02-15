/**
 * DOCX XML Editor – apply track changes and comments to an existing Word document.
 * Uses JSZip to read/write the DOCX (ZIP) and manipulates word/document.xml and word/comments.xml.
 * OOXML namespace: w = http://schemas.openxmlformats.org/wordprocessingml/2006/main
 */

import JSZip from 'jszip';

const AUTHOR = 'AIFM Agent';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export interface DeletionChange {
  paragraphIndex: number;
  originalText: string;
  reason?: string;
}

export interface InsertionChange {
  paragraphIndex: number;
  afterText: string;  // insert after this text (or at start of paragraph if empty)
  newText: string;
  reason?: string;
}

export interface ReplacementChange {
  paragraphIndex: number;
  originalText: string;
  newText: string;
  reason?: string;
}

export interface CommentChange {
  paragraphIndex: number;
  targetText: string;
  comment: string;
}

export interface DocumentReviewEdits {
  deletions?: DeletionChange[];
  insertions?: InsertionChange[];
  replacements?: ReplacementChange[];
  comments?: CommentChange[];
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Extract plain text from a paragraph XML string (all w:t content concatenated) */
function getParagraphText(paragraphXml: string): string {
  const parts: string[] = [];
  const regex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = regex.exec(paragraphXml)) !== null) {
    parts.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  }
  return parts.join('');
}

/** Find all paragraph boundaries in document XML (w:p elements; w:p is not nested) */
function extractParagraphs(documentXml: string): string[] {
  const paragraphs: string[] = [];
  const bodyMatch = documentXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) return [];
  const body = bodyMatch[1];
  const paragraphRegex = /<w:p\s[^>]*>[\s\S]*?<\/w:p>|<w:p>[\s\S]*?<\/w:p>/g;
  let m;
  while ((m = paragraphRegex.exec(body)) !== null) {
    paragraphs.push(m[0]);
  }
  return paragraphs;
}

/** Replace first occurrence of plain text inside paragraph XML with a replacement XML fragment, preserving structure where possible */
function replaceTextInParagraph(paragraphXml: string, originalText: string, replacementXml: string): string {
  if (!originalText.trim()) return paragraphXml;
  const escaped = escapeXml(originalText);
  if (paragraphXml.includes(escaped)) {
    return paragraphXml.replace(escaped, replacementXml);
  }
  const unescaped = originalText;
  if (paragraphXml.includes(unescaped)) {
    return paragraphXml.replace(unescaped, replacementXml);
  }
  const text = getParagraphText(paragraphXml);
  const idx = text.indexOf(originalText);
  if (idx === -1) return paragraphXml;
  let runStart = 0;
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let runMatch;
  let currentRun: { start: number; end: number; xml: string } | null = null;
  let pos = 0;
  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runXml = runMatch[0];
    const runText = getParagraphText(runXml);
    const runEnd = pos + runText.length;
    if (idx >= pos && idx < runEnd) {
      currentRun = { start: pos, end: runEnd, xml: runXml };
      break;
    }
    pos = runEnd;
  }
  if (!currentRun) return paragraphXml;
  const runText = getParagraphText(currentRun.xml);
  const localStart = idx - currentRun.start;
  const localEnd = localStart + originalText.length;
  const before = runText.slice(0, localStart);
  const after = runText.slice(localEnd);
  const runInner = currentRun.xml.replace(/<w:r(?:\s[^>]*)?>|<\/w:r>/g, '');
  const newRunContent = (before ? `<w:t>${escapeXml(before)}</w:t>` : '') + replacementXml + (after ? `<w:t>${escapeXml(after)}</w:t>` : '');
  const newRun = currentRun.xml.replace(runInner, newRunContent);
  return paragraphXml.replace(currentRun.xml, newRun);
}

/** Insert XML fragment after the first occurrence of afterText in paragraph, or at start if afterText is empty */
function insertAfterInParagraph(paragraphXml: string, afterText: string, insertionXml: string): string {
  if (!afterText.trim()) {
    const insertPos = paragraphXml.indexOf('>', paragraphXml.indexOf('<w:p')) + 1;
    return paragraphXml.slice(0, insertPos) + insertionXml + paragraphXml.slice(insertPos);
  }
  const text = getParagraphText(paragraphXml);
  const idx = text.indexOf(afterText);
  if (idx === -1) return paragraphXml;
  let pos = 0;
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let runMatch;
  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runXml = runMatch[0];
    const runText = getParagraphText(runXml);
    const runEnd = pos + runText.length;
    if (idx + afterText.length <= runEnd) {
      const localEnd = idx + afterText.length - pos;
      const runInner = runMatch[0];
      const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      let tPos = 0;
      while ((tMatch = tRegex.exec(runInner)) !== null) {
        const tLen = tMatch[1].length;
        if (tPos + tLen >= localEnd) {
          const insertAt = runMatch.index + tMatch.index + tMatch[0].length;
          return paragraphXml.slice(0, insertAt) + insertionXml + paragraphXml.slice(insertAt);
        }
        tPos += tLen;
      }
      return paragraphXml.slice(0, runMatch.index + runMatch[0].length) + insertionXml + paragraphXml.slice(runMatch.index + runMatch[0].length);
    }
    pos = runEnd;
  }
  return paragraphXml;
}

export class DocxXmlEditor {
  private zip: JSZip;
  private documentXml: string;
  private paragraphs: string[];
  private originalParagraphs: string[]; // Pristine copies for rebuildDocument()
  private revisionId: number;
  private commentId: number;
  private commentsXmlParts: string[];
  private dateString: string;

  private constructor(zip: JSZip, documentXml: string) {
    this.zip = zip;
    this.documentXml = documentXml;
    this.paragraphs = extractParagraphs(documentXml);
    this.originalParagraphs = [...this.paragraphs]; // Keep originals for diff-based rebuild
    this.revisionId = 1;
    this.commentId = 1;
    this.commentsXmlParts = [];
    this.dateString = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  static async load(buffer: Buffer): Promise<DocxXmlEditor> {
    const zip = await JSZip.loadAsync(buffer);
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('word/document.xml not found in DOCX');
    const documentXml = await docFile.async('string');
    return new DocxXmlEditor(zip, documentXml);
  }

  getParagraphCount(): number {
    return this.paragraphs.length;
  }

  getParagraphTexts(): string[] {
    return this.paragraphs.map(getParagraphText);
  }

  /** Apply all edits (deletions, insertions, replacements, comments) and return modified buffer */
  applyEdits(edits: DocumentReviewEdits): void {
    const { deletions = [], insertions = [], replacements = [], comments = [] } = edits;

    replacements.forEach((r) => {
      this.applyReplacement(r);
    });
    deletions.forEach((d) => {
      this.applyDeletion(d);
    });
    insertions.forEach((i) => {
      this.applyInsertion(i);
    });
    comments.forEach((c) => {
      this.applyComment(c);
    });
  }

  private applyDeletion(d: DeletionChange): void {
    const idx = d.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphs.length) return;
    const delXml = `<w:del w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:delText xml:space="preserve">${escapeXml(d.originalText)}</w:delText></w:r></w:del>`;
    this.paragraphs[idx] = replaceTextInParagraph(this.paragraphs[idx], d.originalText, delXml);
  }

  private applyInsertion(i: InsertionChange): void {
    const idx = i.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphs.length) return;
    const insXml = `<w:ins w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:t xml:space="preserve">${escapeXml(i.newText)}</w:t></w:r></w:ins>`;
    this.paragraphs[idx] = insertAfterInParagraph(this.paragraphs[idx], i.afterText, insXml);
  }

  private applyReplacement(r: ReplacementChange): void {
    const idx = r.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphs.length) return;
    const delXml = `<w:del w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:delText xml:space="preserve">${escapeXml(r.originalText)}</w:delText></w:r></w:del>`;
    const insXml = `<w:ins w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:t xml:space="preserve">${escapeXml(r.newText)}</w:t></w:r></w:ins>`;
    let p = this.paragraphs[idx];
    p = replaceTextInParagraph(p, r.originalText, delXml + insXml);
    this.paragraphs[idx] = p;
  }

  private applyComment(c: CommentChange): void {
    const idx = c.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphs.length) return;
    const id = this.commentId++;
    const commentRangeStart = `<w:commentRangeStart w:id="${id}"/>`;
    const commentRangeEnd = `<w:commentRangeEnd w:id="${id}"/>`;
    const commentRef = `<w:r><w:rPr><w:rStyle w:val="CommentReference"/><w:vanish/><w:vertAlign w:val="superscript"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;
    const replacementXml = commentRangeStart + `<w:r><w:t xml:space="preserve">${escapeXml(c.targetText)}</w:t></w:r>` + commentRangeEnd + commentRef;
    this.paragraphs[idx] = replaceTextInParagraph(this.paragraphs[idx], c.targetText, replacementXml);
    this.commentsXmlParts.push(`<w:comment w:id="${id}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}" w:initials="AI"><w:p><w:r><w:t>${escapeXml(c.comment)}</w:t></w:r></w:p></w:comment>`);
  }

  /** Rebuild document.xml by replacing each original paragraph with its modified version.
   *  This preserves all non-paragraph elements (tables, sectPr, sdt, etc.) in the body. */
  private rebuildDocument(): void {
    let xml = this.documentXml;
    // Replace each original paragraph with its (possibly modified) version.
    // We stored originals in this.originalParagraphs during construction.
    for (let i = 0; i < this.originalParagraphs.length; i++) {
      const original = this.originalParagraphs[i];
      const modified = this.paragraphs[i];
      if (original !== modified) {
        // Replace the first occurrence of the original paragraph
        const idx = xml.indexOf(original);
        if (idx !== -1) {
          xml = xml.slice(0, idx) + modified + xml.slice(idx + original.length);
        }
      }
    }
    this.documentXml = xml;
    this.zip.file('word/document.xml', xml);
  }

  private async ensureCommentsXml(): Promise<void> {
    if (this.commentsXmlParts.length === 0) return;
    const commentsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="${W_NS}">
${this.commentsXmlParts.join('\n')}
</w:comments>`;
    this.zip.file('word/comments.xml', commentsContent);
    const relsPath = 'word/_rels/document.xml.rels';
    const relsFile = this.zip.file(relsPath);
    if (relsFile) {
      const rels = await relsFile.async('string');
      if (!rels.includes('comments.xml')) {
        const newRels = rels.replace('</Relationships>', '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>');
        this.zip.file(relsPath, newRels);
      }
    }
  }

  async toBuffer(): Promise<Buffer> {
    this.rebuildDocument();
    await this.ensureCommentsXml();
    return await this.zip.generateAsync({ type: 'nodebuffer' });
  }
}
