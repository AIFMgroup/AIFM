import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
} from 'docx';
import { checkRateLimit, getClientId } from '@/lib/security/rateLimiter';

interface DocxRequest {
  title: string;
  content?: string;
  subtitle?: string;
  sections?: Array<{ title: string; content: string }>;
  footer?: string;
}

// ============================================================================
// Markdown → docx helpers
// ============================================================================

/** Font used for code spans / blocks */
const CODE_FONT = 'Courier New';
const BODY_SIZE = 22; // 11pt
const CODE_SIZE = 20; // 10pt
const LINE_SPACING_AFTER = 120; // ~6pt after each paragraph

/**
 * Parse inline markdown (bold, italic, code, bold-italic) into TextRun[].
 *
 * Supports:  **bold**  __bold__  *italic*  _italic_  `code`
 *            ***bold-italic***  ___bold-italic___
 */
function parseInlineMarkdown(text: string, baseOpts: Partial<{ bold: boolean; italics: boolean; size: number; font: string; color: string }> = {}): TextRun[] {
  const runs: TextRun[] = [];
  const size = baseOpts.size ?? BODY_SIZE;

  // Regex that captures, in priority order:
  //  1) code spans  `…`
  //  2) bold-italic ***…*** / ___…___
  //  3) bold        **…**  / __…__
  //  4) italic      *…*    / _…_
  const inlineRe = /(`[^`]+`)|(\*{3}(?!\s)(.+?)(?<!\s)\*{3}|_{3}(?!\s)(.+?)(?<!\s)_{3})|(\*{2}(?!\s)(.+?)(?<!\s)\*{2}|_{2}(?!\s)(.+?)(?<!\s)_{2})|(\*(?!\s)(.+?)(?<!\s)\*|_(?!\s)(.+?)(?<!\s)_)/g;

  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = inlineRe.exec(text)) !== null) {
    // Push plain text before this match
    if (m.index > lastIndex) {
      const plain = text.slice(lastIndex, m.index);
      if (plain) runs.push(new TextRun({ text: plain, size, ...baseOpts }));
    }

    if (m[1]) {
      // Code span – strip backticks
      const code = m[1].slice(1, -1);
      runs.push(new TextRun({ text: code, font: CODE_FONT, size: CODE_SIZE, ...baseOpts }));
    } else if (m[2]) {
      // Bold-italic
      const inner = m[3] || m[4] || '';
      runs.push(new TextRun({ text: inner, bold: true, italics: true, size, ...baseOpts }));
    } else if (m[5]) {
      // Bold
      const inner = m[6] || m[7] || '';
      runs.push(new TextRun({ text: inner, bold: true, size, ...baseOpts }));
    } else if (m[8]) {
      // Italic
      const inner = m[9] || m[10] || '';
      runs.push(new TextRun({ text: inner, italics: true, size, ...baseOpts }));
    }

    lastIndex = m.index + m[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    const rest = text.slice(lastIndex);
    if (rest) runs.push(new TextRun({ text: rest, size, ...baseOpts }));
  }

  // If nothing matched at all, return a single run
  if (runs.length === 0) {
    runs.push(new TextRun({ text, size, ...baseOpts }));
  }

  return runs;
}

/**
 * Convert a markdown string into an array of docx Paragraphs with proper
 * formatting: headings, bold, italic, code blocks, bullet / numbered lists,
 * horizontal rules, and sensible paragraph spacing.
 */
function markdownToParagraphs(md: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = md.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // ── Blank line → spacer ──────────────────────────────────────────
    if (line.trim() === '') {
      i++;
      continue;
    }

    // ── Horizontal rule ──────────────────────────────────────────────
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line.trim())) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'CCCCCC' } },
        })
      );
      i++;
      continue;
    }

    // ── Fenced code block ```…``` ────────────────────────────────────
    if (line.trim().startsWith('```')) {
      i++; // skip opening fence
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence

      // Render each code line as its own paragraph with monospace font + gray bg
      for (const cl of codeLines) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: cl || ' ', font: CODE_FONT, size: CODE_SIZE })],
            spacing: { after: 20 },
            indent: { left: convertInchesToTwip(0.3) },
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
          })
        );
      }
      // Add some spacing after the code block
      paragraphs.push(new Paragraph({ spacing: { after: LINE_SPACING_AFTER } }));
      continue;
    }

    // ── Headings (# … ######) ────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/\s*#+\s*$/, ''); // strip trailing #
      const headingLevels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(headingText),
          heading: headingLevels[level] || HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 120 },
        })
      );
      i++;
      continue;
    }

    // ── Bullet list  (- item  or  * item) ────────────────────────────
    if (/^\s*[-*]\s+/.test(line)) {
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const indent = (lines[i].match(/^(\s*)/) || [''])[0].length;
        const bulletLevel = Math.min(Math.floor(indent / 2), 3);
        const itemText = lines[i].replace(/^\s*[-*]\s+/, '');
        paragraphs.push(
          new Paragraph({
            children: parseInlineMarkdown(itemText),
            bullet: { level: bulletLevel },
            spacing: { after: 40 },
          })
        );
        i++;
      }
      // Spacing after list
      paragraphs.push(new Paragraph({ spacing: { after: LINE_SPACING_AFTER } }));
      continue;
    }

    // ── Numbered list  (1. item) ─────────────────────────────────────
    if (/^\s*\d+[.)]\s+/.test(line)) {
      let ordinal = 0;
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+[.)]\s+/, '');
        ordinal++;
        // Simulate a numbered list with a manual prefix (docx numbering
        // requires a NumberingDefinition which adds complexity – manual
        // prefix is simpler and portable)
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${ordinal}. `, bold: true, size: BODY_SIZE }),
              ...parseInlineMarkdown(itemText),
            ],
            indent: { left: convertInchesToTwip(0.3) },
            spacing: { after: 40 },
          })
        );
        i++;
      }
      paragraphs.push(new Paragraph({ spacing: { after: LINE_SPACING_AFTER } }));
      continue;
    }

    // ── Normal paragraph (may span multiple consecutive non-blank lines)
    // Collect lines until blank line or a new structural element
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^(---+|\*\*\*+|___+)\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      const joined = paraLines.join(' ').replace(/\s+/g, ' ').trim();
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(joined),
          spacing: { after: LINE_SPACING_AFTER },
        })
      );
    }
  }

  return paragraphs;
}

// ============================================================================
// API Route
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const clientId = await getClientId();
    const rateLimitResult = await checkRateLimit(clientId, 'ai-generate');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Du har gjort för många förfrågningar. Vänta innan du försöker igen.', retryAfter: rateLimitResult.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter || 60) } }
      );
    }

    const body: DocxRequest = await request.json();
    const { title, content, subtitle, sections, footer } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const hasContent = content && content.trim().length > 0;
    const hasSections = sections && sections.length > 0;
    if (!hasContent && !hasSections) {
      return NextResponse.json(
        { error: 'Content or sections are required' },
        { status: 400 }
      );
    }

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    if (subtitle) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: subtitle, italics: true, size: 20, color: '666666' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
    }

    if (hasSections && sections) {
      for (const sec of sections) {
        // Section heading
        children.push(
          new Paragraph({
            text: sec.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 120 },
          })
        );

        // Section content – convert markdown properly
        children.push(...markdownToParagraphs(sec.content));

        // Add spacing between sections
        children.push(new Paragraph({ spacing: { after: 200 } }));
      }
    } else if (hasContent && content) {
      children.push(...markdownToParagraphs(content));
    }

    if (footer) {
      // Separator line
      children.push(
        new Paragraph({
          spacing: { before: 400 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 1, color: 'CCCCCC' } },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: footer, size: 18, color: '888888', italics: true }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100 },
        })
      );
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${(title || 'document').replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.docx"`,
      },
    });
  } catch (error) {
    console.error('[generate-docx]', error);
    return NextResponse.json(
      { error: 'Failed to generate Word document' },
      { status: 500 }
    );
  }
}
