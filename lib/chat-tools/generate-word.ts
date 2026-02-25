import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Footer,
  PageNumber,
} from 'docx';
import { getCompanyProfile } from '@/lib/companyProfileStore';

const GOLD_HEX = 'C0A280';
const CHARCOAL_HEX = '262420';
const GRAY_HEX = '737378';
const LIGHT_GRAY_HEX = 'EBEBEB';
const DEFAULT_COMPANY_NAME = 'AIFM Capital AB';

/** Parse first hex from profile brandColors string, or return default. */
function parseBrandHex(brandColors: string | undefined, fallback: string): string {
  if (!brandColors) return fallback;
  const match = brandColors.match(/#([0-9A-Fa-f]{6})/);
  return match ? match[1] : fallback;
}

interface WordSection {
  title: string;
  items: Array<{
    label: string;
    value: string;
    detail?: string;
  }>;
}

interface GenerateWordInput {
  title: string;
  subtitle?: string;
  sections: WordSection[];
  signature?: {
    date?: string;
    name?: string;
    company?: string;
  };
}

export async function runGenerateWord(input: GenerateWordInput): Promise<{
  success: boolean;
  fileBase64?: string;
  fileName?: string;
  summary?: string;
  fileType?: string;
  error?: string;
}> {
  try {
    const today = new Date().toLocaleDateString('sv-SE');
    const profile = await getCompanyProfile('default').catch(() => null);
    const companyName = profile?.legalName || profile?.companyName || DEFAULT_COMPANY_NAME;
    const goldHex = parseBrandHex(profile?.brandColors, GOLD_HEX);
    const charcoalHex = parseBrandHex(profile?.brandColors, CHARCOAL_HEX);
    const grayHex = GRAY_HEX;

    const children: Paragraph[] = [];

    // Gold accent line
    children.push(
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: goldHex },
        },
        spacing: { after: 200 },
      })
    );

    // Company name
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: companyName, size: 20, color: goldHex, font: 'Calibri' }),
        ],
        spacing: { after: 100 },
      })
    );

    // Title
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: input.title, size: 44, bold: true, color: charcoalHex, font: 'Calibri' }),
        ],
        spacing: { after: 60 },
      })
    );

    // Subtitle
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: input.subtitle || `${companyName} - ${today}`,
            size: 20,
            color: grayHex,
            font: 'Calibri',
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // Date
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Datum: ${today}`, size: 18, color: charcoalHex, font: 'Calibri' }),
        ],
        spacing: { after: 400 },
      })
    );

    // Sections
    for (const section of input.sections) {
      // Section header
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title.toUpperCase(),
              size: 22,
              bold: true,
              color: CHARCOAL_HEX,
              font: 'Calibri',
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          border: {
            left: { style: BorderStyle.SINGLE, size: 8, color: GOLD_HEX, space: 8 },
          },
          spacing: { before: 300, after: 200 },
        })
      );

      for (const item of section.items) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: item.label, size: 17, color: grayHex, font: 'Calibri' }),
            ],
            spacing: { before: 120 },
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item.value || '-',
                size: 18,
                bold: !!item.value,
                color: item.value ? charcoalHex : grayHex,
                font: 'Calibri',
              }),
            ],
            spacing: { after: item.detail ? 20 : 80 },
          })
        );
        if (item.detail) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: item.detail, size: 16, italics: true, color: GRAY_HEX, font: 'Calibri' }),
              ],
              spacing: { after: 80 },
            })
          );
        }
        // Thin separator
        children.push(
          new Paragraph({
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: LIGHT_GRAY_HEX },
            },
            spacing: { after: 40 },
          })
        );
      }
    }

    // Signature
    if (input.signature && (input.signature.name || input.signature.date)) {
      children.push(
        new Paragraph({
          border: {
            top: { style: BorderStyle.SINGLE, size: 4, color: goldHex },
          },
          spacing: { before: 600, after: 200 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'SIGNATUR', size: 22, bold: true, color: charcoalHex, font: 'Calibri' }),
          ],
          spacing: { after: 120 },
        })
      );
      if (input.signature.date) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Datum: ${input.signature.date}`, size: 18, color: CHARCOAL_HEX, font: 'Calibri' }),
            ],
            spacing: { after: 60 },
          })
        );
      }
      if (input.signature.name) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Namn: ${input.signature.name}`, size: 18, color: charcoalHex, font: 'Calibri' }),
            ],
            spacing: { after: 60 },
          })
        );
      }
      if (input.signature.company) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Företag: ${input.signature.company}`,
                size: 18,
                color: CHARCOAL_HEX,
                font: 'Calibri',
              }),
            ],
          })
        );
      }
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 20, color: charcoalHex },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
            },
          },
          headers: {},
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: `${companyName}  |  ${input.title}  |  Sida `, size: 14, color: grayHex }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 14,
                      color: grayHex,
                    }),
                  ],
                }),
              ],
            }),
          },
          children,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = Buffer.from(buffer).toString('base64');

    const safeName = input.title
      .replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const fileName = `${safeName}_${today}.docx`;

    const totalItems = input.sections.reduce((sum, s) => sum + s.items.length, 0);

    return {
      success: true,
      fileBase64: base64,
      fileName,
      summary: `Word-dokument "${input.title}" genererat med ${input.sections.length} avsnitt och ${totalItems} punkter.`,
      fileType: 'docx',
    };
  } catch (err) {
    console.error('[Generate Word] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Kunde inte generera Word-dokument.',
    };
  }
}
