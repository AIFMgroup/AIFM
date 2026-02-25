import { generatePDFReport, type ReportSection, type SectionContent } from '@/lib/pdf/pdfkit-report-generator';
import { getCompanyProfile } from '@/lib/companyProfileStore';

interface PdfItem {
  label: string;
  value: string;
  detail?: string;
}

interface PdfSection {
  title: string;
  items?: PdfItem[];
  text?: string;
  summary?: string;
  bullets?: { title: string; items: string[]; color?: 'green' | 'red' | 'default' };
  table?: { headers: string[]; rows: string[][] };
  checklist?: Array<{ label: string; checked: boolean }>;
}

interface GeneratePdfInput {
  title: string;
  subtitle?: string;
  sections: PdfSection[];
  signature?: {
    date?: string;
    name?: string;
    company?: string;
  };
}

const DEFAULT_COMPANY_NAME = 'AIFM Capital AB';

export async function runGeneratePdf(input: GeneratePdfInput): Promise<{
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

    const sections: ReportSection[] = input.sections.map((s) => {
      const content: SectionContent[] = [];

      if (s.summary) {
        content.push({ type: 'summary', text: s.summary });
      }

      if (s.text) {
        content.push({ type: 'text', text: s.text });
      }

      if (s.bullets) {
        content.push({ type: 'bullets', title: s.bullets.title, items: s.bullets.items, color: s.bullets.color || 'default' });
      }

      if (s.table) {
        content.push({
          type: 'table',
          headers: s.table.headers,
          rows: s.table.rows.map((cells) => ({ cells })),
        });
      }

      if (s.checklist) {
        content.push({ type: 'checklist', items: s.checklist });
      }

      if (s.items) {
        for (const item of s.items) {
          if (item.detail) {
            content.push({ type: 'qa', number: '', question: item.label, answer: item.value || '–', detail: item.detail });
          } else if (item.value && item.value.length > 200) {
            content.push({ type: 'kv', items: [{ label: item.label, value: '' }] });
            content.push({ type: 'text', text: item.value });
          } else {
            content.push({ type: 'kv', items: [{ label: item.label, value: item.value || '–' }] });
          }
        }
      }

      return { title: s.title, content };
    });

    const signature = input.signature
      ? [
          ...(input.signature.date ? [{ label: 'Datum', name: input.signature.date }] : []),
          ...(input.signature.name ? [{ label: 'Namn', name: input.signature.name, detail: input.signature.company || companyName }] : []),
        ]
      : undefined;

    const pdfBuffer = await generatePDFReport({
      reportType: 'Rapport',
      title: input.title,
      subtitle: input.subtitle || `${companyName} – ${today}`,
      date: today,
      sections,
      signature,
    });

    const base64 = pdfBuffer.toString('base64');
    const safeName = input.title
      .replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const fileName = `${safeName}_${today}.pdf`;

    return {
      success: true,
      fileBase64: base64,
      fileName,
      summary: `PDF-rapport "${input.title}" genererad med ${sections.length} avsnitt.`,
      fileType: 'pdf',
    };
  } catch (err) {
    console.error('[Generate PDF] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Kunde inte generera PDF.',
    };
  }
}
