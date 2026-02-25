/**
 * Shared pdfkit-based report generator for all AIFM analysis reports.
 * Strict typographic system: 5 font sizes, consistent spacing, clean layout.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

let _logoBuffer: Buffer | null = null;
function getLogoBuffer(): Buffer | null {
  if (_logoBuffer) return _logoBuffer;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'AIFM_logo.png');
    _logoBuffer = fs.readFileSync(logoPath);
    return _logoBuffer;
  } catch {
    return null;
  }
}

// ─── Public types ───

export interface ReportOptions {
  reportType: string;
  title: string;
  subtitle?: string;
  date: string;
  badges?: Array<{ label: string; value: string; color?: 'green' | 'red' | 'gold' | 'gray' }>;
  sections: ReportSection[];
  disclaimerText?: string;
  footerText?: string;
  signature?: Array<{ label: string; name: string; detail?: string }>;
}

export interface ReportSection {
  title: string;
  content: SectionContent[];
}

export type SectionContent =
  | { type: 'kv'; items: Array<{ label: string; value: string; status?: 'ok' | 'warn' | 'fail' }> }
  | { type: 'text'; text: string }
  | { type: 'summary'; text: string }
  | { type: 'table'; headers: string[]; rows: Array<{ cells: string[]; bold?: boolean; color?: string }> }
  | { type: 'checklist'; items: Array<{ label: string; checked: boolean }> }
  | { type: 'bullets'; title: string; items: string[]; color?: 'green' | 'red' | 'default' }
  | { type: 'decision'; decision: 'approved' | 'rejected'; text: string }
  | { type: 'info'; text: string; variant?: 'info' | 'success' | 'error' | 'warning' }
  | { type: 'subsection'; title: string }
  | { type: 'qa'; number: string; question: string; answer: string; detail?: string }
  | { type: 'pagebreak' };

// Strict typographic scale
const F = {
  TITLE: 18,
  SUBTITLE: 11,
  SECTION: 10,
  BODY: 8.5,
  SMALL: 7,
};

const C = {
  DARK: '#1a1a1a',
  HEADER_BG: '#2d2a26',
  GOLD: '#c0a280',
  GOLD_LIGHT: '#d4c5a0',
  MID: '#374151',
  GRAY: '#6b7280',
  LIGHT_GRAY: '#9ca3af',
  BORDER: '#e2e2e2',
  SECTION_BG: '#f5f4f1',
  TABLE_HEADER: '#eceae5',
  TABLE_ALT: '#fafaf8',
  WHITE: '#ffffff',
  GREEN: '#166534',
  GREEN_BG: '#f0fdf4',
  GREEN_BORDER: '#bbf7d0',
  RED: '#991b1b',
  RED_BG: '#fef2f2',
  RED_BORDER: '#fecaca',
  AMBER: '#92400e',
  AMBER_BG: '#fffbeb',
  BLUE: '#1e40af',
  BLUE_BG: '#eff6ff',
};

export async function generatePDFReport(opts: ReportOptions): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `${opts.reportType} - ${opts.title}`,
          Author: 'AIFM Capital AB',
          Subject: opts.reportType,
          Creator: 'AIFM Platform',
        },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const LEFT = 50;
      const RIGHT = PAGE_W - 50;
      const CONTENT_W = RIGHT - LEFT;
      const BOTTOM = 58;

      const ensureSpace = (needed: number) => {
        if (doc.y + needed > PAGE_H - BOTTOM) doc.addPage();
      };

      const drawRect = (x: number, y: number, w: number, h: number, fill: string) => {
        doc.rect(x, y, w, h).fill(fill);
      };

      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
        doc.roundedRect(x, y, w, h, r).fill(fill);
      };

      const drawLine = (x1: number, y1: number, x2: number, y2: number, color: string, w = 0.5) => {
        doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(w).stroke();
      };

      // ─── Section header ───
      const drawSectionHeader = (title: string) => {
        ensureSpace(44);
        doc.y += 10;
        const y = doc.y;
        drawRect(LEFT, y, CONTENT_W, 28, C.SECTION_BG);
        drawRect(LEFT, y, 3, 28, C.GOLD);
        doc.fontSize(F.SECTION).fillColor(C.DARK).font('Helvetica-Bold')
          .text(title, LEFT + 14, y + 8, { width: CONTENT_W - 24 });
        doc.y = y + 36;
      };

      // ─── Sub-section: simple bold label ───
      const drawSubSection = (title: string) => {
        ensureSpace(18);
        doc.y += 6;
        doc.fontSize(F.BODY).fillColor(C.MID).font('Helvetica-Bold')
          .text(title, LEFT + 4, doc.y);
        doc.y += 14;
      };

      // ─── Key-value row ───
      const drawKV = (label: string, value: string, status?: 'ok' | 'warn' | 'fail') => {
        ensureSpace(16);
        const y = doc.y;
        doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
          .text(label, LEFT + 4, y, { width: 170 });
        const valColor = status === 'ok' ? C.GREEN : status === 'fail' ? C.RED : status === 'warn' ? C.AMBER : C.DARK;
        doc.fontSize(F.BODY).fillColor(valColor).font(status ? 'Helvetica-Bold' : 'Helvetica')
          .text(value || '–', LEFT + 178, y, { width: CONTENT_W - 188 });
        doc.y = y + 14;
      };

      // ─── Checkbox row ───
      const drawCheckRow = (label: string, checked: boolean) => {
        ensureSpace(16);
        const y = doc.y;
        if (checked) {
          drawRoundedRect(LEFT + 4, y, 11, 11, 2, C.GREEN);
          doc.fontSize(F.SMALL).fillColor(C.WHITE).font('Helvetica-Bold')
            .text('✓', LEFT + 5.5, y + 1, { width: 8, align: 'center' });
        } else {
          doc.roundedRect(LEFT + 4, y, 11, 11, 2).lineWidth(0.75).strokeColor(C.BORDER).stroke();
        }
        doc.fontSize(F.BODY).fillColor(C.DARK).font('Helvetica')
          .text(label, LEFT + 22, y + 1, { width: CONTENT_W - 30 });
        doc.y = y + 16;
      };

      // ─── Table ───
      const drawTable = (
        headers: string[],
        rows: Array<{ cells: string[]; bold?: boolean; color?: string }>,
        colWidths?: number[]
      ) => {
        const cols = colWidths || headers.map(() => CONTENT_W / headers.length);
        const pad = 6;
        const headerH = 22;
        const minRowH = 20;

        ensureSpace(headerH + minRowH * Math.min(rows.length, 3) + 8);

        const hy = doc.y;
        drawRoundedRect(LEFT, hy, CONTENT_W, headerH, 3, C.TABLE_HEADER);
        let cx = LEFT;
        for (let i = 0; i < headers.length; i++) {
          doc.fontSize(F.SMALL).fillColor(C.GRAY).font('Helvetica-Bold')
            .text(headers[i].toUpperCase(), cx + pad, hy + 6, { width: cols[i] - pad * 2, lineBreak: false });
          cx += cols[i];
        }
        doc.y = hy + headerH;

        for (let r = 0; r < rows.length; r++) {
          let maxCellH = 0;
          for (let i = 0; i < headers.length; i++) {
            const cellText = rows[r].cells[i] || '–';
            const font = rows[r].bold && i === 0 ? 'Helvetica-Bold' : 'Helvetica';
            const h = doc.fontSize(F.BODY).font(font).heightOfString(cellText, { width: cols[i] - pad * 2 });
            if (h > maxCellH) maxCellH = h;
          }
          const rowH = Math.max(minRowH, maxCellH + 10);

          if (doc.y + rowH > PAGE_H - BOTTOM) doc.addPage();
          const ry = doc.y;
          if (r % 2 === 1) drawRect(LEFT, ry, CONTENT_W, rowH, C.TABLE_ALT);

          cx = LEFT;
          for (let i = 0; i < headers.length; i++) {
            const font = rows[r].bold && i === 0 ? 'Helvetica-Bold' : 'Helvetica';
            doc.fontSize(F.BODY).fillColor(rows[r].color || C.DARK).font(font)
              .text(rows[r].cells[i] || '–', cx + pad, ry + 5, { width: cols[i] - pad * 2 });
            cx += cols[i];
          }
          drawLine(LEFT, ry + rowH, LEFT + CONTENT_W, ry + rowH, '#eeeeee');
          doc.y = ry + rowH;
        }
        doc.y += 6;
      };

      // ─── Text block with left accent bar ───
      const drawTextBlock = (text: string) => {
        ensureSpace(28);
        const y = doc.y;
        const textW = CONTENT_W - 24;
        const h = doc.fontSize(F.BODY).font('Helvetica').heightOfString(text, { width: textW });
        const blockH = Math.max(h + 12, 22);

        drawRoundedRect(LEFT + 2, y, CONTENT_W - 4, blockH, 3, '#faf9f7');
        drawRect(LEFT + 2, y + 4, 2.5, blockH - 8, C.GOLD_LIGHT);
        doc.fontSize(F.BODY).fillColor(C.MID).font('Helvetica')
          .text(text, LEFT + 14, y + 6, { width: textW });
        doc.y = y + blockH + 4;
      };

      // ─── Summary box ───
      const drawSummaryBox = (text: string) => {
        ensureSpace(28);
        const y = doc.y;
        const textW = CONTENT_W - 28;
        const h = doc.fontSize(F.BODY).font('Helvetica').heightOfString(text, { width: textW });
        const boxH = Math.max(h + 14, 24);

        drawRoundedRect(LEFT + 2, y, CONTENT_W - 4, boxH, 4, '#fdfcfb');
        doc.roundedRect(LEFT + 2, y, CONTENT_W - 4, boxH, 4).lineWidth(0.5).strokeColor('#e5e1d8').stroke();
        drawRect(LEFT + 2, y, CONTENT_W - 4, 2.5, C.GOLD);
        doc.fontSize(F.BODY).fillColor(C.DARK).font('Helvetica')
          .text(text, LEFT + 14, y + 8, { width: textW });
        doc.y = y + boxH + 6;
      };

      // ─── Info box ───
      const drawInfoBox = (text: string, variant: 'info' | 'success' | 'error' | 'warning' = 'info') => {
        ensureSpace(28);
        const y = doc.y;
        const palette = {
          info: { bg: C.BLUE_BG, fg: C.BLUE, icon: 'ℹ' },
          success: { bg: C.GREEN_BG, fg: C.GREEN, icon: '✓' },
          error: { bg: C.RED_BG, fg: C.RED, icon: '✗' },
          warning: { bg: C.AMBER_BG, fg: C.AMBER, icon: '!' },
        };
        const p = palette[variant];
        const textW = CONTENT_W - 44;
        const h = doc.fontSize(F.BODY).font('Helvetica-Bold').heightOfString(text, { width: textW });
        const boxH = Math.max(h + 12, 24);

        drawRoundedRect(LEFT + 2, y, CONTENT_W - 4, boxH, 4, p.bg);
        doc.fontSize(F.SECTION).fillColor(p.fg).font('Helvetica-Bold')
          .text(p.icon, LEFT + 12, y + 5);
        doc.fontSize(F.BODY).fillColor(p.fg).font('Helvetica-Bold')
          .text(text, LEFT + 28, y + 6, { width: textW });
        doc.y = y + boxH + 6;
      };

      // ─── Decision box ───
      const drawDecisionBox = (decision: 'approved' | 'rejected', text: string) => {
        const ok = decision === 'approved';
        drawInfoBox(`${ok ? 'GODKÄND' : 'UNDERKÄND'}${text ? ' – ' + text : ''}`, ok ? 'success' : 'error');
      };

      // ─── Bullet group ───
      const drawBulletGroup = (title: string, items: string[], color: 'green' | 'red' | 'default' = 'default') => {
        ensureSpace(20 + items.length * 14);
        const fg = color === 'green' ? C.GREEN : color === 'red' ? C.RED : C.DARK;
        const dot = color === 'green' ? C.GREEN : color === 'red' ? C.RED : C.GOLD;

        doc.fontSize(F.BODY).fillColor(fg).font('Helvetica-Bold')
          .text(title, LEFT + 4, doc.y);
        doc.y += 4;

        for (const item of items) {
          ensureSpace(14);
          const y = doc.y;
          doc.circle(LEFT + 12, y + 4, 2, ).fill(dot);
          doc.fontSize(F.BODY).fillColor(color === 'default' ? C.MID : fg).font('Helvetica')
            .text(item, LEFT + 22, y, { width: CONTENT_W - 30 });
          doc.y += 2;
        }
        doc.y += 4;
      };

      // ─── Q&A row ───
      const drawQA = (number: string, question: string, answer: string, detail?: string) => {
        ensureSpace(28);
        const y = doc.y;
        const qText = number ? `${number}. ${question}` : question;
        doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
          .text(qText, LEFT + 4, y, { width: CONTENT_W - 12 });
        doc.y += 2;

        const answerLower = answer.toLowerCase().trim();
        const answerColor =
          ['ja', 'godkänd', 'uppfyller', 'låg', 'minskande'].includes(answerLower) ? C.GREEN
          : ['nej', 'ej godkänd', 'uppfyller inte', 'hög', 'ökande'].includes(answerLower) ? C.RED
          : C.DARK;

        doc.fontSize(F.BODY).fillColor(answerColor).font('Helvetica-Bold')
          .text(answer, LEFT + 4, doc.y, { width: CONTENT_W - 12 });

        if (detail) {
          doc.y += 2;
          doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
            .text(detail, LEFT + 4, doc.y, { width: CONTENT_W - 12 });
        }

        doc.y += 4;
        drawLine(LEFT + 4, doc.y, RIGHT - 4, doc.y, '#eeeeee');
        doc.y += 6;
      };

      // ════════════════════════════════════════════════════════════
      // HEADER
      // ════════════════════════════════════════════════════════════

      drawRect(0, 0, PAGE_W, 82, C.HEADER_BG);
      const logo = getLogoBuffer();
      if (logo) {
        try { doc.image(logo, LEFT, 12, { height: 50 }); } catch { /* fallback below */ }
      }
      if (!logo) {
        doc.fontSize(22).fillColor(C.WHITE).font('Helvetica-Bold')
          .text('AIFM', LEFT, 18, { continued: true })
          .fillColor(C.GOLD).text('.', { continued: false });
        doc.fontSize(F.SMALL).fillColor('#64748b').font('Helvetica')
          .text('CAPITAL AB', LEFT, 44);
      }

      doc.fontSize(F.BODY).fillColor(C.GOLD).font('Helvetica')
        .text(opts.reportType, RIGHT - 180, 20, { width: 180, align: 'right' });
      doc.fontSize(F.SMALL).fillColor('#94a3b8').font('Helvetica')
        .text(opts.date, RIGHT - 180, 32, { width: 180, align: 'right' });

      if (opts.badges && opts.badges.length > 0) {
        let badgeX = RIGHT;
        for (const badge of [...opts.badges].reverse()) {
          const badgeText = `${badge.label}: ${badge.value}`;
          const bw = doc.fontSize(F.SMALL).font('Helvetica-Bold').widthOfString(badgeText) + 16;
          badgeX -= bw + 6;
          const bc = badge.color === 'green' ? '#4ade80'
            : badge.color === 'red' ? '#f87171'
            : badge.color === 'gold' ? C.GOLD
            : '#94a3b8';
          drawRoundedRect(badgeX, 48, bw, 16, 8, bc);
          doc.fontSize(F.SMALL).fillColor(C.HEADER_BG).font('Helvetica-Bold')
            .text(badgeText, badgeX, 52, { width: bw, align: 'center' });
        }
      }

      drawRect(0, 82, PAGE_W, 2.5, C.GOLD);
      doc.y = 98;

      // ════════════════════════════════════════════════════════════
      // TITLE
      // ════════════════════════════════════════════════════════════

      doc.fontSize(F.TITLE).fillColor(C.DARK).font('Helvetica-Bold')
        .text(opts.title, LEFT, doc.y);
      doc.y += 4;
      if (opts.subtitle) {
        doc.fontSize(F.SUBTITLE).fillColor(C.GRAY).font('Helvetica')
          .text(opts.subtitle, LEFT);
      }
      doc.y += 12;

      // ════════════════════════════════════════════════════════════
      // SECTIONS
      // ════════════════════════════════════════════════════════════

      for (const section of opts.sections) {
        drawSectionHeader(section.title);

        for (const content of section.content) {
          switch (content.type) {
            case 'kv':
              for (const item of content.items) drawKV(item.label, item.value, item.status);
              break;
            case 'text':
              drawTextBlock(content.text);
              break;
            case 'summary':
              drawSummaryBox(content.text);
              break;
            case 'table':
              drawTable(content.headers, content.rows);
              break;
            case 'checklist':
              for (const item of content.items) drawCheckRow(item.label, item.checked);
              break;
            case 'bullets':
              drawBulletGroup(content.title, content.items, content.color);
              break;
            case 'decision':
              drawDecisionBox(content.decision, content.text);
              break;
            case 'info':
              drawInfoBox(content.text, content.variant);
              break;
            case 'subsection':
              drawSubSection(content.title);
              break;
            case 'qa':
              drawQA(content.number, content.question, content.answer, content.detail);
              break;
            case 'pagebreak':
              doc.addPage();
              break;
          }
        }
      }

      // ════════════════════════════════════════════════════════════
      // SIGNATURE
      // ════════════════════════════════════════════════════════════

      if (opts.signature && opts.signature.length > 0) {
        ensureSpace(70);
        doc.y += 12;
        drawLine(LEFT, doc.y, RIGHT, doc.y, C.BORDER);
        doc.y += 14;

        for (const sig of opts.signature) {
          doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica')
            .text(sig.label.toUpperCase(), LEFT, doc.y);
          doc.y += 10;
          doc.fontSize(F.SECTION).fillColor(C.DARK).font('Helvetica-Bold')
            .text(sig.name, LEFT);
          if (sig.detail) {
            doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
              .text(sig.detail);
          }
          doc.y += 10;
        }
      }

      // ════════════════════════════════════════════════════════════
      // FOOTER ON EVERY PAGE
      // ════════════════════════════════════════════════════════════

      const footer = opts.footerText || `AIFM Capital AB | Konfidentiellt | ${opts.reportType}`;
      const pages = doc.bufferedPageRange();

      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        drawLine(LEFT, PAGE_H - 42, RIGHT, PAGE_H - 42, C.GOLD, 0.5);
        doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica')
          .text(`${footer}  •  Genererad ${new Date().toLocaleDateString('sv-SE')}`, LEFT, PAGE_H - 34, { width: CONTENT_W * 0.75 });
        doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica')
          .text(`Sida ${i + 1} av ${pages.count}`, LEFT, PAGE_H - 34, { width: CONTENT_W, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
