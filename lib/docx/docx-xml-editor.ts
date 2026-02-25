/**
 * DOCX XML Editor – apply track changes and comments to an existing Word document.
 * Uses JSZip to read/write the DOCX (ZIP) and manipulates word/document.xml and word/comments.xml.
 *
 * Strategy: Instead of regex-based paragraph extraction (fragile with complex OOXML),
 * we work directly on the full document XML string, finding text within <w:t> elements
 * and wrapping matched regions with track-change / comment markup.
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
  afterText: string;
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

function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/** Collect all <w:t> and <w:delText> content in document order so matching works in docs with track changes */
function collectText(xml: string): string {
  const combined: Array<{ pos: number; text: string }> = [];
  const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  const delRegex = /<w:delText(?:\s[^>]*)?>([^<]*)<\/w:delText>/g;
  let m;
  while ((m = tRegex.exec(xml)) !== null) {
    combined.push({ pos: m.index, text: unescapeXml(m[1]) });
  }
  while ((m = delRegex.exec(xml)) !== null) {
    combined.push({ pos: m.index, text: unescapeXml(m[1]) });
  }
  combined.sort((a, b) => a.pos - b.pos);
  return combined.map(c => c.text).join('');
}

/**
 * Find the start index of each <w:p ...>...</w:p> in the body section of document.xml.
 * Uses a simple state machine rather than regex to handle nested elements correctly.
 */
function findParagraphRanges(documentXml: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  // Find <w:body> region
  const bodyStart = documentXml.indexOf('<w:body');
  if (bodyStart === -1) return [];
  const bodyEnd = documentXml.lastIndexOf('</w:body>');
  if (bodyEnd === -1) return [];

  // Scan for top-level <w:p> elements inside body
  // We need to handle nesting: <w:p> can appear inside <w:tc> (table cells)
  // We only want top-level paragraphs (direct children of w:body)
  let i = documentXml.indexOf('>', bodyStart) + 1; // skip past <w:body ...>
  let depth = 0; // depth of non-w:p elements

  while (i < bodyEnd) {
    // Find next tag
    const tagStart = documentXml.indexOf('<', i);
    if (tagStart === -1 || tagStart >= bodyEnd) break;

    // Determine tag name and type
    const tagEnd = documentXml.indexOf('>', tagStart);
    if (tagEnd === -1) break;

    const tagContent = documentXml.slice(tagStart, tagEnd + 1);
    const isSelfClosing = tagContent.endsWith('/>');

    if (tagContent.startsWith('<w:p') && (tagContent[4] === ' ' || tagContent[4] === '>') && depth === 0) {
      if (isSelfClosing) {
        // Self-closing paragraph: <w:p ... />
        ranges.push({ start: tagStart, end: tagEnd + 1 });
        i = tagEnd + 1;
      } else {
        // Opening <w:p> – find matching </w:p>
        // Since w:p is NOT nested (OOXML spec), we can search for the next </w:p>
        const closeTag = '</w:p>';
        const closeIdx = documentXml.indexOf(closeTag, tagEnd);
        if (closeIdx === -1) break;
        ranges.push({ start: tagStart, end: closeIdx + closeTag.length });
        i = closeIdx + closeTag.length;
      }
    } else if (!isSelfClosing && tagContent.startsWith('</')) {
      // Closing tag of a non-paragraph element
      if (depth > 0) depth--;
      i = tagEnd + 1;
    } else if (!isSelfClosing && !tagContent.startsWith('<?') && !tagContent.startsWith('<!')) {
      // Opening tag of a non-paragraph element (like w:tbl, w:sdt, etc.)
      depth++;
      i = tagEnd + 1;
    } else {
      i = tagEnd + 1;
    }
  }

  return ranges;
}

/**
 * Within a paragraph XML string, find the run (<w:r>) that contains the target text
 * at the given character offset, and split it so we can insert markup between runs.
 *
 * Returns the paragraph XML with the target text replaced by `replacementXml`.
 */
function replaceInParagraph(paragraphXml: string, targetText: string, replacementXml: string): string {
  if (!targetText.trim()) return paragraphXml;

  const fullText = collectText(paragraphXml);
  let idx = fullText.indexOf(targetText);
  if (idx === -1) {
    // Case-insensitive fallback
    idx = fullText.toLowerCase().indexOf(targetText.toLowerCase());
    if (idx === -1) return paragraphXml;
    // Use the actual text from the document
    targetText = fullText.slice(idx, idx + targetText.length);
  }

  const endIdx = idx + targetText.length;

  // Map character positions to <w:t> and <w:delText> elements (document order) so we can preserve existing markup
  interface TElement {
    xmlStart: number;
    xmlEnd: number;
    textStart: number;
    textEnd: number;
    content: string;
    runXmlStart: number;
    runXmlEnd: number;
    openTagLength: number;
  }
  const tElements: TElement[] = [];
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let charPos = 0;
  let runMatch;

  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runXml = runMatch[0];
    const runStart = runMatch.index;
    const runEnd = runStart + runXml.length;
    const segments: Array<{ pos: number; content: string; xmlStart: number; xmlEnd: number; openTagLength: number }> = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    const delRegex = /<w:delText(?:\s[^>]*)?>([^<]*)<\/w:delText>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(runXml)) !== null) {
      const openLen = tMatch[0].indexOf('>') + 1;
      segments.push({
        pos: runStart + tMatch.index,
        content: unescapeXml(tMatch[1]),
        xmlStart: runStart + tMatch.index,
        xmlEnd: runStart + tMatch.index + tMatch[0].length,
        openTagLength: openLen,
      });
    }
    while ((tMatch = delRegex.exec(runXml)) !== null) {
      const openLen = tMatch[0].indexOf('>') + 1;
      segments.push({
        pos: runStart + tMatch.index,
        content: unescapeXml(tMatch[1]),
        xmlStart: runStart + tMatch.index,
        xmlEnd: runStart + tMatch.index + tMatch[0].length,
        openTagLength: openLen,
      });
    }
    segments.sort((a, b) => a.pos - b.pos);
    for (const seg of segments) {
      tElements.push({
        xmlStart: seg.xmlStart,
        xmlEnd: seg.xmlEnd,
        textStart: charPos,
        textEnd: charPos + seg.content.length,
        content: seg.content,
        runXmlStart: runStart,
        runXmlEnd: runEnd,
        openTagLength: seg.openTagLength,
      });
      charPos += seg.content.length;
    }
  }

  // Find which elements overlap with our target range [idx, endIdx)
  const firstT = tElements.find(t => t.textEnd > idx);
  const lastT = [...tElements].reverse().find(t => t.textStart < endIdx);
  if (!firstT || !lastT) return paragraphXml;

  /** XML offset in paragraphXml for a character position (so we can slice and preserve existing markup) */
  function getXmlOffsetForCharPos(charPos: number): number {
    const e = tElements.find(t => t.textStart <= charPos && charPos <= t.textEnd);
    if (!e) return firstT.runXmlStart;
    if (charPos <= e.textStart) return e.xmlStart;
    if (charPos >= e.textEnd) return e.xmlEnd;
    const n = charPos - e.textStart;
    return e.xmlStart + e.openTagLength + escapeXml(e.content.slice(0, n)).length;
  }

  const beforeEnd = getXmlOffsetForCharPos(idx);
  const afterStart = getXmlOffsetForCharPos(endIdx);
  const beforeXml = paragraphXml.slice(firstT.runXmlStart, beforeEnd);
  const afterXml = paragraphXml.slice(afterStart, lastT.runXmlEnd);

  return (
    paragraphXml.slice(0, firstT.runXmlStart) +
    beforeXml +
    replacementXml +
    afterXml +
    paragraphXml.slice(lastT.runXmlEnd)
  );
}

/**
 * Insert XML after a target text within a paragraph.
 */
function insertAfter(paragraphXml: string, afterText: string, insertionXml: string): string {
  if (!afterText.trim()) {
    // Insert at the very start of the paragraph (after <w:p ...>)
    const gt = paragraphXml.indexOf('>', paragraphXml.indexOf('<w:p')) + 1;
    return paragraphXml.slice(0, gt) + insertionXml + paragraphXml.slice(gt);
  }

  const fullText = collectText(paragraphXml);
  let idx = fullText.indexOf(afterText);
  if (idx === -1) return paragraphXml;
  const endIdx = idx + afterText.length;

  // Find the run containing the end of afterText; preserve existing markup by slicing run XML
  const runRegex = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let charPos = 0;
  let runMatch;

  while ((runMatch = runRegex.exec(paragraphXml)) !== null) {
    const runXml = runMatch[0];
    const runText = collectText(runXml);
    const runEnd = charPos + runText.length;

    if (endIdx <= runEnd) {
      const localEnd = endIdx - charPos;
      const offsetInRun = getRunXmlOffsetForCharPos(runXml, localEnd);
      const beforeRunXml = runXml.slice(0, offsetInRun);
      const afterRunXml = runXml.slice(offsetInRun);

      const parts: string[] = [];
      if (beforeRunXml.trim()) parts.push(beforeRunXml);
      parts.push(insertionXml);
      if (afterRunXml.trim()) parts.push(afterRunXml);

      return (
        paragraphXml.slice(0, runMatch.index) +
        parts.join('') +
        paragraphXml.slice(runMatch.index + runXml.length)
      );
    }
    charPos = runEnd;
  }
  return paragraphXml;
}

/** Character position to byte offset within a single run's XML (preserves w:t/w:delText markup) */
function getRunXmlOffsetForCharPos(runXml: string, charPos: number): number {
  const segments: Array<{ pos: number; content: string; xmlStart: number; openTagLength: number }> = [];
  const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  const delRegex = /<w:delText(?:\s[^>]*)?>([^<]*)<\/w:delText>/g;
  let m;
  while ((m = tRegex.exec(runXml)) !== null) {
    segments.push({
      pos: m.index,
      content: unescapeXml(m[1]),
      xmlStart: m.index,
      openTagLength: m[0].indexOf('>') + 1,
    });
  }
  while ((m = delRegex.exec(runXml)) !== null) {
    segments.push({
      pos: m.index,
      content: unescapeXml(m[1]),
      xmlStart: m.index,
      openTagLength: m[0].indexOf('>') + 1,
    });
  }
  segments.sort((a, b) => a.pos - b.pos);
  let acc = 0;
  for (const seg of segments) {
    const len = seg.content.length;
    if (charPos <= acc + len) {
      const n = charPos - acc;
      return seg.xmlStart + seg.openTagLength + escapeXml(seg.content.slice(0, n)).length;
    }
    acc += len;
  }
  return runXml.length;
}

export class DocxXmlEditor {
  private zip: JSZip;
  private documentXml: string;
  private paragraphRanges: Array<{ start: number; end: number }>;
  private modifications: Map<number, string>; // paragraphIndex -> modified XML
  private revisionId: number;
  private commentId: number;
  private commentsXmlParts: string[];
  private dateString: string;

  private constructor(zip: JSZip, documentXml: string) {
    this.zip = zip;
    this.documentXml = documentXml;
    this.paragraphRanges = findParagraphRanges(documentXml);
    this.modifications = new Map();
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
    return this.paragraphRanges.length;
  }

  getParagraphTexts(): string[] {
    return this.paragraphRanges.map(r => collectText(this.documentXml.slice(r.start, r.end)));
  }

  /** Get the current XML for a paragraph (possibly already modified) */
  private getParagraphXml(index: number): string {
    if (this.modifications.has(index)) return this.modifications.get(index)!;
    const range = this.paragraphRanges[index];
    return this.documentXml.slice(range.start, range.end);
  }

  applyEdits(edits: DocumentReviewEdits): void {
    const { deletions = [], insertions = [], replacements = [], comments = [] } = edits;
    replacements.forEach(r => this.applyReplacement(r));
    deletions.forEach(d => this.applyDeletion(d));
    insertions.forEach(i => this.applyInsertion(i));
    comments.forEach(c => this.applyComment(c));
  }

  private applyDeletion(d: DeletionChange): void {
    const idx = d.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphRanges.length) return;
    const delXml = `<w:del w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:delText xml:space="preserve">${escapeXml(d.originalText)}</w:delText></w:r></w:del>`;
    const pXml = this.getParagraphXml(idx);
    this.modifications.set(idx, replaceInParagraph(pXml, d.originalText, delXml));
  }

  private applyInsertion(i: InsertionChange): void {
    const idx = i.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphRanges.length) return;
    const insXml = `<w:ins w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:t xml:space="preserve">${escapeXml(i.newText)}</w:t></w:r></w:ins>`;
    const pXml = this.getParagraphXml(idx);
    this.modifications.set(idx, insertAfter(pXml, i.afterText, insXml));
  }

  private applyReplacement(r: ReplacementChange): void {
    const idx = r.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphRanges.length) return;

    // Minimize the diff: trim common prefix and suffix so only the
    // actually-changed characters are marked as deleted/inserted.
    let origText = r.originalText;
    let newText = r.newText;

    // Find common prefix (character-by-character)
    let prefixLen = 0;
    const minLen = Math.min(origText.length, newText.length);
    while (prefixLen < minLen && origText[prefixLen] === newText[prefixLen]) {
      prefixLen++;
    }

    // Avoid splitting in the middle of a word – back up to the last space/boundary
    if (prefixLen > 0 && prefixLen < minLen) {
      // Only back up if we're inside a word (not at a word boundary)
      const origChar = origText[prefixLen - 1];
      if (origChar !== ' ' && origChar !== '\t' && origChar !== '\n') {
        // Back up to the start of the current word
        while (prefixLen > 0 && origText[prefixLen - 1] !== ' ' && origText[prefixLen - 1] !== '\t') {
          prefixLen--;
        }
      }
    }

    // Find common suffix (from the end, not overlapping with prefix)
    let suffixLen = 0;
    const origRemaining = origText.length - prefixLen;
    const newRemaining = newText.length - prefixLen;
    const minRemaining = Math.min(origRemaining, newRemaining);
    while (
      suffixLen < minRemaining &&
      origText[origText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    // Avoid splitting in the middle of a word – advance to the next space/boundary
    if (suffixLen > 0 && suffixLen < minRemaining) {
      const origChar = origText[origText.length - suffixLen];
      if (origChar !== ' ' && origChar !== '\t' && origChar !== '\n') {
        while (suffixLen > 0 && origText[origText.length - suffixLen] !== ' ' && origText[origText.length - suffixLen] !== '\t') {
          suffixLen--;
        }
      }
    }

    const trimmedOrig = origText.slice(prefixLen, origText.length - suffixLen);
    const trimmedNew = newText.slice(prefixLen, newText.length - suffixLen);

    // Use trimmed versions if they're non-empty and the original text can still be found
    const pXml = this.getParagraphXml(idx);
    const fullText = collectText(pXml);

    if (trimmedOrig.length > 0 && trimmedNew.length > 0 && fullText.includes(trimmedOrig)) {
      origText = trimmedOrig;
      newText = trimmedNew;
    }

    const delXml = `<w:del w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:delText xml:space="preserve">${escapeXml(origText)}</w:delText></w:r></w:del>`;
    const insXml = `<w:ins w:id="${this.revisionId++}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}"><w:r><w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r></w:ins>`;
    this.modifications.set(idx, replaceInParagraph(pXml, origText, delXml + insXml));
  }

  private applyComment(c: CommentChange): void {
    const idx = c.paragraphIndex;
    if (idx < 0 || idx >= this.paragraphRanges.length) return;
    const id = this.commentId++;
    const commentRangeStart = `<w:commentRangeStart w:id="${id}"/>`;
    const commentRangeEnd = `<w:commentRangeEnd w:id="${id}"/>`;
    const commentRef = `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;
    const replacementXml = commentRangeStart + `<w:r><w:t xml:space="preserve">${escapeXml(c.targetText)}</w:t></w:r>` + commentRangeEnd + commentRef;
    const pXml = this.getParagraphXml(idx);
    this.modifications.set(idx, replaceInParagraph(pXml, c.targetText, replacementXml));
    this.commentsXmlParts.push(
      `<w:comment w:id="${id}" w:author="${escapeXml(AUTHOR)}" w:date="${this.dateString}" w:initials="AI"><w:p><w:r><w:t>${escapeXml(c.comment)}</w:t></w:r></w:p></w:comment>`
    );
  }

  /** Rebuild document.xml by replacing modified paragraphs in-place */
  private rebuildDocument(): void {
    if (this.modifications.size === 0) return;

    // Process modifications in reverse order so earlier offsets remain valid
    const sortedIndices = [...this.modifications.keys()].sort((a, b) => b - a);
    let xml = this.documentXml;

    for (const i of sortedIndices) {
      const range = this.paragraphRanges[i];
      const modified = this.modifications.get(i)!;
      xml = xml.slice(0, range.start) + modified + xml.slice(range.end);
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

    // Add relationship for comments.xml
    const relsPath = 'word/_rels/document.xml.rels';
    const relsFile = this.zip.file(relsPath);
    if (relsFile) {
      const rels = await relsFile.async('string');
      if (!rels.includes('comments.xml')) {
        const newRels = rels.replace(
          '</Relationships>',
          '<Relationship Id="rIdComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'
        );
        this.zip.file(relsPath, newRels);
      }
    }

    // Register comments.xml in [Content_Types].xml so Word recognises it
    const ctPath = '[Content_Types].xml';
    const ctFile = this.zip.file(ctPath);
    if (ctFile) {
      let ct = await ctFile.async('string');
      if (!ct.includes('/word/comments.xml')) {
        ct = ct.replace(
          '</Types>',
          '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'
        );
        this.zip.file(ctPath, ct);
      }
    }
  }

  async toBuffer(): Promise<Buffer> {
    this.rebuildDocument();
    await this.ensureCommentsXml();
    return await this.zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }
}
