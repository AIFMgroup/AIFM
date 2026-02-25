import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';

/**
 * Sanitize text for WinAnsi encoding (the only encoding supported by
 * pdf-lib's standard fonts). Replaces common Unicode characters that
 * fall outside WinAnsi with safe ASCII equivalents.
 */
/**
 * Sanitize a single line for pdf-lib drawText (no control chars allowed).
 * Newlines must be handled BEFORE calling this – split on \n first,
 * then sanitize each line individually.
 */
function sanitizeForPdf(text: string): string {
  return text
    // Control characters that drawText cannot render
    .replace(/[\n\r\t]/g, ' ')
    // Collapse multiple spaces into one
    .replace(/ {2,}/g, ' ')
    // Subscript/superscript digits
    .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
    .replace(/₄/g, '4').replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
    .replace(/₈/g, '8').replace(/₉/g, '9')
    .replace(/⁰/g, '0').replace(/¹/g, '1').replace(/²/g, '2').replace(/³/g, '3')
    .replace(/⁴/g, '4').replace(/⁵/g, '5').replace(/⁶/g, '6').replace(/⁷/g, '7')
    .replace(/⁸/g, '8').replace(/⁹/g, '9')
    // Common symbols
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->')
    .replace(/•/g, '-').replace(/·/g, '-')
    .replace(/…/g, '...').replace(/–/g, '-').replace(/—/g, '-')
    .replace(/"/g, '"').replace(/"/g, '"').replace(/'/g, "'").replace(/'/g, "'")
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=')
    .replace(/±/g, '+/-').replace(/∞/g, 'inf')
    .replace(/✓/g, 'V').replace(/✗/g, 'X').replace(/✔/g, 'V').replace(/✘/g, 'X')
    .replace(/⚠️/g, '(!)').replace(/⚠/g, '(!)')
    .replace(/━/g, '-')
    // Remove any remaining non-WinAnsi characters (keep basic Latin, Latin-1 Supplement)
    // WinAnsi covers U+0020–U+007E and U+00A0–U+00FF (with some gaps)
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

const COLORS = {
  charcoal: rgb(0.15, 0.15, 0.18),
  gold: rgb(0.76, 0.63, 0.36),
  lightGold: rgb(0.76, 0.63, 0.36),
  gray: rgb(0.45, 0.45, 0.48),
  lightGray: rgb(0.92, 0.92, 0.92),
  white: rgb(1, 1, 1),
  green: rgb(0.18, 0.65, 0.35),
  red: rgb(0.75, 0.22, 0.22),
  sectionBg: rgb(0.97, 0.96, 0.94),
};

const MARGIN = 55;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface ReportSection {
  title: string;
  questions: Array<{
    number: string;
    text: string;
    answer: string;
    detail?: string;
    type?: string;
  }>;
}

/** Optional checklist section (e.g. "Underlag" in delegation reports) */
export interface UnderlagSectionItem {
  label: string;
  checked: boolean;
}

type PaiTableRow = Record<string, string | boolean | undefined> & {
  indicator: string;
  value?: string;
  unit?: string;
  coverage?: string;
  source?: string;
  isHeader?: boolean;
  isBold?: boolean;
};

interface DnshAnalysis {
  climateMitigation?: string;
  climateAdaptation?: string;
  waterResources?: string;
  circularEconomy?: string;
  pollution?: string;
  biodiversity?: string;
  overallDnsh?: string;
}

interface ReportConfig {
  title: string;
  subtitle: string;
  date: string;
  sections: ReportSection[];
  sfdrArticle?: string;
  executiveSummary?: string;
  methodology?: string;
  dnshAnalysis?: DnshAnalysis;
  paiTable?: PaiTableRow[];
  goodGovernanceAssessment?: string;
  underlagSection?: { title: string; items: UnderlagSectionItem[] };
  signature?: {
    date: string;
    name: string;
    company: string;
  };
  answeredCount: number;
  totalCount: number;
}

function wrapLine(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const sanitized = sanitizeForPdf(text);
  const words = sanitized.split(' ').filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Wrap text preserving paragraph breaks. Returns an array of lines where
 * empty strings ('') represent paragraph breaks (blank lines).
 *
 * Heuristics:
 *  - Double newlines are always paragraph breaks.
 *  - Single newlines are treated as paragraph breaks when preceded by a
 *    sentence-ending character (.!?:) or when the next line starts with a
 *    capital letter / digit / dash, which is the common AI output pattern.
 *  - For long texts without any newlines we insert synthetic paragraph
 *    breaks after every ~600 characters at a sentence boundary so the PDF
 *    doesn't become a wall of text.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n');

  // Split on double-newline first (clear paragraph boundary)
  const bigParts = normalized.split(/\n{2,}/);
  const result: string[] = [];

  for (let bp = 0; bp < bigParts.length; bp++) {
    const block = bigParts[bp];
    // Within a big-part, split on single newlines
    const singleLines = block.split('\n');

    for (let sl = 0; sl < singleLines.length; sl++) {
      const trimmed = singleLines[sl].trim();
      if (!trimmed) continue;

      // Break very long paragraphs without newlines into sub-paragraphs
      const subParagraphs = breakLongParagraph(trimmed);

      for (let sp = 0; sp < subParagraphs.length; sp++) {
        result.push(...wrapLine(subParagraphs[sp], font, fontSize, maxWidth));
        if (sp < subParagraphs.length - 1) {
          result.push(''); // synthetic paragraph break
        }
      }

      // Add paragraph break between single-line segments
      if (sl < singleLines.length - 1) {
        result.push('');
      }
    }

    // Add paragraph break between big-parts
    if (bp < bigParts.length - 1) {
      result.push('');
    }
  }
  return result;
}

/**
 * Break a single long paragraph (no newlines) into smaller paragraphs at
 * sentence boundaries (. ! ?) roughly every TARGET_LEN characters.
 */
function breakLongParagraph(text: string, targetLen = 600): string[] {
  if (text.length <= targetLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > targetLen) {
    // Find a sentence-ending punctuation near the target length
    let bestIdx = -1;
    for (let i = Math.min(targetLen, remaining.length - 1); i >= targetLen * 0.5; i--) {
      if ('.!?'.includes(remaining[i]) && (i + 1 >= remaining.length || remaining[i + 1] === ' ')) {
        bestIdx = i;
        break;
      }
    }
    if (bestIdx === -1) {
      // No sentence end found; look forward instead
      for (let i = targetLen; i < remaining.length; i++) {
        if ('.!?'.includes(remaining[i]) && (i + 1 >= remaining.length || remaining[i + 1] === ' ')) {
          bestIdx = i;
          break;
        }
      }
    }
    if (bestIdx === -1) break; // No sentence boundary at all
    parts.push(remaining.slice(0, bestIdx + 1).trim());
    remaining = remaining.slice(bestIdx + 1).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function formatAnswer(answer: string, type?: string): string {
  if (!answer || answer === 'null' || answer === 'undefined') return '-';
  const lower = answer.toLowerCase().trim();
  if (lower === 'yes') return 'Ja';
  if (lower === 'no') return 'Nej';
  if (lower === 'approved') return 'Godkänd';
  if (lower === 'rejected') return 'Ej godkänd';
  if (lower === 'meets') return 'Uppfyller';
  if (lower === 'does_not_meet') return 'Uppfyller inte';
  if (lower === 'low') return 'Låg';
  if (lower === 'medium') return 'Medel';
  if (lower === 'high') return 'Hög';
  if (lower === 'decreasing') return 'Minskande';
  if (lower === 'stable') return 'Stabil';
  if (lower === 'increasing') return 'Ökande';
  if (lower === 'not_available') return 'Data saknas';
  return answer;
}

export async function generateReport(config: ReportConfig): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Helper: safe drawText that sanitizes before rendering
  function safeDraw(p: PDFPage, text: string, opts: Parameters<PDFPage['drawText']>[1]) {
    p.drawText(sanitizeForPdf(text), opts);
  }

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function addNewPage(): PDFPage {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    drawFooter(page, helvetica, pdfDoc.getPageCount());
    return page;
  }

  function drawFooter(p: PDFPage, font: PDFFont, pageNum: number) {
    const footerText = sanitizeForPdf(`AIFM Capital AB  -  ${config.title}  -  Sida ${pageNum}`);
    const footerWidth = font.widthOfTextAtSize(footerText, 7);
    p.drawText(footerText, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: 25,
      size: 7,
      font,
      color: COLORS.gray,
    });
    p.drawLine({
      start: { x: MARGIN, y: 40 },
      end: { x: PAGE_WIDTH - MARGIN, y: 40 },
      thickness: 0.5,
      color: COLORS.lightGray,
    });
  }

  function ensureSpace(needed: number) {
    if (y - needed < 60) {
      addNewPage();
    }
  }

  // --- Cover / Header ---
  drawFooter(page, helvetica, 1);

  // Gold accent line at top
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 30,
    width: CONTENT_WIDTH,
    height: 3,
    color: COLORS.gold,
  });

  y = PAGE_HEIGHT - 70;

  // AIFM Capital AB
  safeDraw(page, 'AIFM Capital AB', {
    x: MARGIN,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.gold,
  });
  y -= 28;

  // Title
  safeDraw(page, config.title, {
    x: MARGIN,
    y,
    size: 22,
    font: helveticaBold,
    color: COLORS.charcoal,
  });
  y -= 22;

  // Subtitle
  safeDraw(page, config.subtitle, {
    x: MARGIN,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.gray,
  });
  y -= 30;

  const metaBoxHeight = config.sfdrArticle ? 52 : 40;
  // Meta info box
  page.drawRectangle({
    x: MARGIN,
    y: y - metaBoxHeight,
    width: CONTENT_WIDTH,
    height: metaBoxHeight,
    color: COLORS.sectionBg,
    borderColor: COLORS.lightGray,
    borderWidth: 0.5,
  });

  let metaY = y - 18;
  safeDraw(page, `Datum: ${config.date || '-'}`, {
    x: MARGIN + 15,
    y: metaY,
    size: 9,
    font: helvetica,
    color: COLORS.charcoal,
  });
  metaY -= 14;

  if (config.sfdrArticle) {
    safeDraw(page, `SFDR: Artikel ${config.sfdrArticle}`, {
      x: MARGIN + 15,
      y: metaY,
      size: 9,
      font: helvetica,
      color: COLORS.charcoal,
    });
    metaY -= 14;
  }

  const statsText = `Besvarade frågor: ${config.answeredCount} av ${config.totalCount}`;
  safeDraw(page, statsText, {
    x: MARGIN + 15,
    y: metaY,
    size: 9,
    font: helvetica,
    color: COLORS.gray,
  });

  const pctText = `(${Math.round((config.answeredCount / Math.max(config.totalCount, 1)) * 100)}%)`;
  const statsWidth = helvetica.widthOfTextAtSize(sanitizeForPdf(statsText), 9);
  safeDraw(page, pctText, {
    x: MARGIN + 15 + statsWidth + 5,
    y: metaY,
    size: 9,
    font: helveticaBold,
    color: COLORS.gold,
  });

  y -= metaBoxHeight + 20;

  // Separator
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: COLORS.lightGray,
  });
  y -= 20;

  // --- Executive Summary ---
  if (config.executiveSummary) {
    ensureSpace(60);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 16, color: COLORS.gold });
    safeDraw(page, 'SAMMANFATTNING', { x: MARGIN + 12, y, size: 10, font: helveticaBold, color: COLORS.charcoal });
    y -= 22;

    const summaryLines = wrapText(config.executiveSummary, helvetica, 8.5, CONTENT_WIDTH - 16);
    for (const line of summaryLines) {
      if (line === '') { y -= 6; continue; }
      ensureSpace(14);
      safeDraw(page, line, { x: MARGIN + 8, y, size: 8.5, font: helvetica, color: COLORS.charcoal });
      y -= 12;
    }
    y -= 16;
  }

  // --- Methodology ---
  if (config.methodology) {
    ensureSpace(60);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 16, color: COLORS.gold });
    safeDraw(page, 'METODIK', { x: MARGIN + 12, y, size: 10, font: helveticaBold, color: COLORS.charcoal });
    y -= 22;

    const methodLines = wrapText(config.methodology, helvetica, 8.5, CONTENT_WIDTH - 16);
    for (const line of methodLines) {
      if (line === '') { y -= 6; continue; }
      ensureSpace(14);
      safeDraw(page, line, { x: MARGIN + 8, y, size: 8.5, font: helvetica, color: COLORS.charcoal });
      y -= 12;
    }
    y -= 16;
  }

  // --- Good Governance Assessment ---
  if (config.goodGovernanceAssessment) {
    ensureSpace(60);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 16, color: COLORS.gold });
    safeDraw(page, 'GOD STYRNING (SFDR ART. 2(17))', { x: MARGIN + 12, y, size: 10, font: helveticaBold, color: COLORS.charcoal });
    y -= 22;

    const govLines = wrapText(config.goodGovernanceAssessment, helvetica, 8.5, CONTENT_WIDTH - 16);
    for (const line of govLines) {
      if (line === '') { y -= 6; continue; }
      ensureSpace(14);
      safeDraw(page, line, { x: MARGIN + 8, y, size: 8.5, font: helvetica, color: COLORS.charcoal });
      y -= 12;
    }
    y -= 16;
  }

  // --- PAI / GHG Emissions Table ---
  if (config.paiTable && config.paiTable.length > 0) {
    ensureSpace(80);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 16, color: COLORS.gold });
    safeDraw(page, 'GHG-UTSLAPP & PAI-INDIKATORER', { x: MARGIN + 12, y, size: 10, font: helveticaBold, color: COLORS.charcoal });
    y -= 22;

    // Detect which year columns exist in the data
    const POSSIBLE_YEARS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    const yearCols: string[] = [];
    for (const yr of POSSIBLE_YEARS) {
      if (config.paiTable.some((r) => r[yr] != null && String(r[yr]).trim() !== '' && String(r[yr]).trim() !== 'null')) {
        yearCols.push(yr);
      }
    }
    const hasYears = yearCols.length > 0;

    const tableX = MARGIN + 4;
    const tableW = CONTENT_WIDTH - 8;
    const ROW_H = 14;
    const HEADER_H = 16;
    const FONT_SZ = 7;
    const FONT_SZ_SM = 6.5;

    if (hasYears) {
      // ── Multi-year GHG table ──
      const indicatorW = Math.min(200, tableW * 0.38);
      const unitW = 55;
      const changeW = 55;
      const yearW = (tableW - indicatorW - unitW - changeW) / Math.max(yearCols.length, 1);
      const rowH = 16;
      // Vertically centre text: baseline sits at row-top minus half the row
      // plus half the cap-height. For Helvetica at 7pt the cap-height is ~5pt.
      const textOffsetY = (rowH - FONT_SZ * 0.72) / 2;

      // Column header row
      ensureSpace(rowH + 4);
      const headerY = y;
      page.drawRectangle({ x: tableX, y: headerY - rowH, width: tableW, height: rowH, color: COLORS.sectionBg });

      const hTextY = headerY - textOffsetY;
      let hx = tableX + 4;
      safeDraw(page, 'GHG-utslapp (tCO2e)', { x: hx, y: hTextY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      hx = tableX + indicatorW;
      for (const yr of yearCols) {
        const label = sanitizeForPdf(yr);
        const lw = helveticaBold.widthOfTextAtSize(label, FONT_SZ);
        safeDraw(page, label, { x: hx + (yearW - lw) / 2, y: hTextY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
        hx += yearW;
      }
      const cLabel = 'Forandr.';
      const clw = helveticaBold.widthOfTextAtSize(cLabel, FONT_SZ);
      safeDraw(page, cLabel, { x: hx + (changeW - clw) / 2, y: hTextY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      hx += changeW;
      safeDraw(page, 'Enhet', { x: hx + 2, y: hTextY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      y -= rowH;

      // Thin line under header
      page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 0.5, color: COLORS.gold });

      // Data rows
      let visibleIdx = 0; // for alternating colors (skip headers)
      for (let ri = 0; ri < config.paiTable.length; ri++) {
        const row = config.paiTable[ri];
        const isHeader = row.isHeader === true || row.isHeader === 'true';
        const isBold = row.isBold === true || row.isBold === 'true' || isHeader;
        const indicatorRaw = String(row.indicator || '');

        ensureSpace(rowH + 2);

        const textY = y - textOffsetY;

        // Row background
        if (isHeader) {
          page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: COLORS.sectionBg });
        } else if (visibleIdx % 2 === 1) {
          page.drawRectangle({ x: tableX, y: y - rowH, width: tableW, height: rowH, color: rgb(0.975, 0.975, 0.97) });
        }

        // Indicator text
        let rx = tableX + 4;
        const indText = sanitizeForPdf(indicatorRaw);
        const truncInd = indText.length > 45 ? indText.substring(0, 43) + '..' : indText;
        safeDraw(page, truncInd, {
          x: rx, y: textY, size: FONT_SZ,
          font: isBold ? helveticaBold : helvetica,
          color: COLORS.charcoal,
        });

        if (!isHeader) {
          // Year value cells
          rx = tableX + indicatorW;
          const yearValues: number[] = [];
          for (const yr of yearCols) {
            const raw = String(row[yr] ?? '').trim();
            if (raw && raw !== '-' && raw !== 'null') {
              const numVal = parseFloat(raw.replace(/[,\s]/g, ''));
              if (!isNaN(numVal)) yearValues.push(numVal);
            }
            const display = sanitizeForPdf(raw || '-');
            const dw = (isBold ? helveticaBold : helvetica).widthOfTextAtSize(display, FONT_SZ);
            safeDraw(page, display, {
              x: rx + (yearW - dw) / 2, y: textY, size: FONT_SZ,
              font: isBold ? helveticaBold : helvetica,
              color: COLORS.charcoal,
            });
            rx += yearW;
          }

          // Change % column
          let changeStr = '-';
          let changeColor = COLORS.gray;
          if (yearValues.length >= 2) {
            const prev = yearValues[yearValues.length - 2];
            const curr = yearValues[yearValues.length - 1];
            if (prev !== 0) {
              const pct = ((curr - prev) / Math.abs(prev)) * 100;
              changeStr = (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
              changeColor = pct < 0 ? COLORS.green : pct > 0 ? COLORS.red : COLORS.gray;
            }
          }
          const chgW = helveticaBold.widthOfTextAtSize(sanitizeForPdf(changeStr), FONT_SZ);
          safeDraw(page, changeStr, {
            x: rx + (changeW - chgW) / 2, y: textY, size: FONT_SZ,
            font: helveticaBold, color: changeColor,
          });
          rx += changeW;

          // Unit
          const unitStr = sanitizeForPdf(String(row.unit || ''));
          safeDraw(page, unitStr.substring(0, 14), { x: rx + 2, y: textY, size: FONT_SZ_SM, font: helvetica, color: COLORS.gray });
        }

        y -= rowH;

        // Separator line between rows
        if (!isHeader) {
          page.drawLine({
            start: { x: tableX, y },
            end: { x: tableX + tableW, y },
            thickness: 0.15,
            color: COLORS.lightGray,
          });
          visibleIdx++;
        } else {
          page.drawLine({
            start: { x: tableX, y },
            end: { x: tableX + tableW, y },
            thickness: 0.4,
            color: COLORS.gold,
          });
        }
      }
    } else {
      // ── Fallback: single-value table (legacy) ──
      const colWidths = { indicator: 180, value: 100, unit: 80, coverage: 60, source: tableW - 180 - 100 - 80 - 60 };
      const fbRowH = 16;
      const fbTextOff = (fbRowH - FONT_SZ * 0.72) / 2;

      ensureSpace(20);
      page.drawRectangle({ x: tableX, y: y - fbRowH, width: tableW, height: fbRowH, color: COLORS.sectionBg });
      const fbHdrY = y - fbTextOff;
      let hx = tableX + 4;
      safeDraw(page, 'Indikator', { x: hx, y: fbHdrY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      hx += colWidths.indicator;
      safeDraw(page, 'Varde', { x: hx, y: fbHdrY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      hx += colWidths.value;
      safeDraw(page, 'Enhet', { x: hx, y: fbHdrY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      hx += colWidths.unit;
      safeDraw(page, 'Tackn.', { x: hx, y: fbHdrY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      hx += colWidths.coverage;
      safeDraw(page, 'Kalla', { x: hx, y: fbHdrY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
      y -= fbRowH;

      for (const row of config.paiTable) {
        ensureSpace(fbRowH + 2);
        const fbTxtY = y - fbTextOff;
        let rx = tableX + 4;
        const indicatorText = sanitizeForPdf(String(row.indicator || '-'));
        const truncInd = indicatorText.length > 40 ? indicatorText.substring(0, 38) + '..' : indicatorText;
        safeDraw(page, truncInd, { x: rx, y: fbTxtY, size: FONT_SZ, font: helvetica, color: COLORS.charcoal });
        rx += colWidths.indicator;
        safeDraw(page, String(row.value || '-').substring(0, 20), { x: rx, y: fbTxtY, size: FONT_SZ, font: helveticaBold, color: COLORS.charcoal });
        rx += colWidths.value;
        safeDraw(page, String(row.unit || '-').substring(0, 15), { x: rx, y: fbTxtY, size: FONT_SZ, font: helvetica, color: COLORS.gray });
        rx += colWidths.unit;
        safeDraw(page, String(row.coverage || '-').substring(0, 10), { x: rx, y: fbTxtY, size: FONT_SZ, font: helvetica, color: COLORS.gray });
        rx += colWidths.coverage;
        safeDraw(page, String(row.source || '-').substring(0, 20), { x: rx, y: fbTxtY, size: FONT_SZ, font: helvetica, color: COLORS.gray });
        y -= fbRowH;
        page.drawLine({ start: { x: tableX, y }, end: { x: tableX + tableW, y }, thickness: 0.2, color: COLORS.lightGray });
      }
    }
    y -= 16;
  }

  // --- DNSH Analysis ---
  if (config.dnshAnalysis) {
    const dnsh = config.dnshAnalysis;
    const dnshEntries = [
      { label: 'Begransning av klimatforandringar', text: dnsh.climateMitigation },
      { label: 'Klimatanpassning', text: dnsh.climateAdaptation },
      { label: 'Vatten och marina resurser', text: dnsh.waterResources },
      { label: 'Cirkular ekonomi', text: dnsh.circularEconomy },
      { label: 'Forebyggande av fororeningar', text: dnsh.pollution },
      { label: 'Biologisk mangfald och ekosystem', text: dnsh.biodiversity },
    ].filter(e => e.text);

    if (dnshEntries.length > 0 || dnsh.overallDnsh) {
      ensureSpace(60);
      page.drawRectangle({ x: MARGIN, y: y - 2, width: 3, height: 16, color: COLORS.gold });
      safeDraw(page, 'DNSH-ANALYS (DO NO SIGNIFICANT HARM)', { x: MARGIN + 12, y, size: 10, font: helveticaBold, color: COLORS.charcoal });
      y -= 22;

      if (dnsh.overallDnsh) {
        const overallLines = wrapText(dnsh.overallDnsh, helveticaBold, 8.5, CONTENT_WIDTH - 16);
        for (const line of overallLines) {
          if (line === '') { y -= 6; continue; }
          ensureSpace(14);
          safeDraw(page, line, { x: MARGIN + 8, y, size: 8.5, font: helveticaBold, color: COLORS.charcoal });
          y -= 12;
        }
        y -= 8;
      }

      for (const entry of dnshEntries) {
        ensureSpace(30);
        safeDraw(page, entry.label, { x: MARGIN + 8, y, size: 8, font: helveticaBold, color: COLORS.gray });
        y -= 13;
        const entryLines = wrapText(entry.text!, helvetica, 8, CONTENT_WIDTH - 24);
        for (const line of entryLines) {
          if (line === '') { y -= 5; continue; }
          ensureSpace(12);
          safeDraw(page, line, { x: MARGIN + 16, y, size: 8, font: helvetica, color: COLORS.charcoal });
          y -= 11;
        }
        y -= 6;
      }
      y -= 10;
    }
  }

  // --- SFDR Regulatory Reference ---
  if (config.sfdrArticle) {
    ensureSpace(50);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: COLORS.lightGray });
    y -= 16;
    safeDraw(page, 'REGULATORISK REFERENS', { x: MARGIN, y, size: 8, font: helveticaBold, color: COLORS.gray });
    y -= 12;
    const regText = config.sfdrArticle === '9'
      ? 'Denna analys ar upprattad i enlighet med forordning (EU) 2019/2088 (SFDR) Artikel 9 och delegerade forordningar (RTS). Produkten har hallbart investeringsmal. PAI-indikatorer redovisas enligt Tabell 1-3 i RTS. DNSH-bedomning genomford mot samtliga sex EU-taxonomimal.'
      : config.sfdrArticle === '8'
        ? 'Denna analys ar upprattad i enlighet med forordning (EU) 2019/2088 (SFDR) Artikel 8 och delegerade forordningar (RTS). Produkten framjar miljo- och/eller sociala egenskaper. PAI-indikatorer beaktas. DNSH-bedomning genomford. God styrning verifierad enligt Art. 2(17).'
        : 'Denna analys ar upprattad i enlighet med forordning (EU) 2019/2088 (SFDR) Artikel 6. Hallbarhetsrisker integreras i investeringsprocessen.';
    const regLines = wrapText(regText, helvetica, 7.5, CONTENT_WIDTH);
    for (const line of regLines) {
      if (line === '') { y -= 5; continue; }
      ensureSpace(12);
      safeDraw(page, line, { x: MARGIN, y, size: 7.5, font: helvetica, color: COLORS.gray });
      y -= 10;
    }
    y -= 16;
  }

  // --- Detailed Sections ---
  for (const section of config.sections) {
    ensureSpace(50);

    // Section header with gold accent
    page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: 3,
      height: 16,
      color: COLORS.gold,
    });

    safeDraw(page, section.title.toUpperCase(), {
      x: MARGIN + 12,
      y,
      size: 10,
      font: helveticaBold,
      color: COLORS.charcoal,
    });
    y -= 22;

    for (const q of section.questions) {
      const answerText = formatAnswer(q.answer, q.type);
      const hasAnswer = answerText !== '-';

      const qLines = wrapText(`${q.number}. ${q.text}`, helvetica, 8.5, CONTENT_WIDTH - 20);
      const answerLines = wrapText(answerText, hasAnswer ? helveticaBold : helvetica, 8.5, CONTENT_WIDTH - 20);
      const detailLines = q.detail ? wrapText(q.detail, helvetica, 7.5, CONTENT_WIDTH - 20) : [];

      const qHeight = qLines.reduce((h, l) => h + (l === '' ? 6 : 12), 0);
      const aHeight = answerLines.reduce((h, l) => h + (l === '' ? 6 : 12), 0);
      const dHeight = detailLines.reduce((h, l) => h + (l === '' ? 5 : 10), 0);
      const totalHeight = qHeight + aHeight + dHeight + 18;
      ensureSpace(totalHeight);

      for (const line of qLines) {
        if (line === '') { y -= 6; continue; }
        safeDraw(page, line, {
          x: MARGIN + 8,
          y,
          size: 8.5,
          font: helvetica,
          color: COLORS.gray,
        });
        y -= 12;
      }

      y -= 6;
      const answerColor = !hasAnswer
        ? COLORS.gray
        : answerText === 'Ja' || answerText === 'Godkänd' || answerText === 'Uppfyller' || answerText === 'Låg'
        ? COLORS.green
        : answerText === 'Nej' || answerText === 'Ej godkänd' || answerText === 'Uppfyller inte' || answerText === 'Hög'
        ? COLORS.red
        : COLORS.charcoal;

      for (const line of answerLines) {
        if (line === '') { y -= 8; continue; }
        safeDraw(page, line, {
          x: MARGIN + 8,
          y,
          size: 8.5,
          font: hasAnswer ? helveticaBold : helvetica,
          color: answerColor,
        });
        y -= 12;
      }

      if (detailLines.length > 0) {
        y -= 6;
        for (const line of detailLines) {
          if (line === '') { y -= 7; continue; }
          safeDraw(page, line, {
            x: MARGIN + 8,
            y,
            size: 7.5,
            font: helvetica,
            color: COLORS.gray,
          });
          y -= 10;
        }
      }

      // Thin separator
      y -= 4;
      page.drawLine({
        start: { x: MARGIN + 8, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.3,
        color: COLORS.lightGray,
      });
      y -= 10;
    }

    y -= 8;
  }

  // --- Underlag (checklist) ---
  if (config.underlagSection && config.underlagSection.items.length > 0) {
    ensureSpace(60);

    page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: 3,
      height: 16,
      color: COLORS.gold,
    });
    safeDraw(page, config.underlagSection.title.toUpperCase(), {
      x: MARGIN + 12,
      y,
      size: 10,
      font: helveticaBold,
      color: COLORS.charcoal,
    });
    y -= 22;

    for (const item of config.underlagSection.items) {
      const prefix = item.checked ? 'Ja' : 'Nej';
      const color = item.checked ? COLORS.green : COLORS.gray;
      const line = `${prefix} – ${item.label}`;
      const lines = wrapText(line, helvetica, 8.5, CONTENT_WIDTH - 20);
      for (const ln of lines) {
        if (ln === '') { y -= 6; continue; }
        ensureSpace(14);
        safeDraw(page, ln, { x: MARGIN + 8, y, size: 8.5, font: helvetica, color });
        y -= 12;
      }
      y -= 4;
    }
    y -= 12;
  }

  // --- Signature ---
  if (config.signature && (config.signature.name || config.signature.date)) {
    ensureSpace(100);

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: COLORS.gold,
    });
    y -= 25;

    safeDraw(page, 'SIGNATUR', {
      x: MARGIN,
      y,
      size: 10,
      font: helveticaBold,
      color: COLORS.charcoal,
    });
    y -= 20;

    if (config.signature.date) {
      safeDraw(page, `Datum: ${config.signature.date}`, {
        x: MARGIN,
        y,
        size: 9,
        font: helvetica,
        color: COLORS.charcoal,
      });
      y -= 15;
    }

    if (config.signature.name) {
      safeDraw(page, `Namn: ${config.signature.name}`, {
        x: MARGIN,
        y,
        size: 9,
        font: helvetica,
        color: COLORS.charcoal,
      });
      y -= 15;
    }

    if (config.signature.company) {
      safeDraw(page, `Företag: ${config.signature.company}`, {
        x: MARGIN,
        y,
        size: 9,
        font: helvetica,
        color: COLORS.charcoal,
      });
    }
  }

  return pdfDoc.save();
}
