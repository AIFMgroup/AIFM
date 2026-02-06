import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

interface DocxRequest {
  title: string;
  content?: string;
  subtitle?: string;
  sections?: Array<{ title: string; content: string }>;
  footer?: string;
}

function textToParagraphs(text: string): Paragraph[] {
  const lines = text.split(/\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];
  return lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line.replace(/\s+/g, ' ').trim(), size: 22 })],
        spacing: { after: 100 },
      })
  );
}

export async function POST(request: NextRequest) {
  try {
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
          children: [new TextRun({ text: subtitle, italics: true, size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
    }

    if (hasSections && sections) {
      for (const sec of sections) {
        children.push(
          new Paragraph({
            text: sec.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 120 },
          })
        );
        children.push(...textToParagraphs(sec.content));
      }
    } else if (hasContent && content) {
      children.push(...textToParagraphs(content));
    }

    if (footer) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: footer, size: 18, color: '666666' }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
        })
      );
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer, {
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
