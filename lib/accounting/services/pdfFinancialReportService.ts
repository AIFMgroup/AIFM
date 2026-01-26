import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { BalanceSheet, IncomeStatement, ReportSection, AccountLine } from '@/lib/accounting/closing/closingReporter';

const PAGE_MARGIN = 40;
const LINE_HEIGHT = 14;

function formatSek(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}${abs.toLocaleString('sv-SE', { maximumFractionDigits: 0 })}`;
}

function addPage(pdf: PDFDocument) {
  const page = pdf.addPage([595.28, 841.89]); // A4
  return page;
}

function ensureSpace(state: { pdf: PDFDocument; page: any; y: number }, needed: number) {
  if (state.y - needed < PAGE_MARGIN) {
    state.page = addPage(state.pdf);
    state.y = 841.89 - PAGE_MARGIN;
  }
}

function drawText(state: { page: any; y: number }, text: string, x: number, size: number, font: any, color = rgb(0, 0, 0)) {
  state.page.drawText(text, { x, y: state.y, size, font, color });
}

function drawRight(state: { page: any; y: number }, text: string, rightX: number, size: number, font: any, color = rgb(0, 0, 0)) {
  const width = font.widthOfTextAtSize(text, size);
  state.page.drawText(text, { x: rightX - width, y: state.y, size, font, color });
}

function drawSectionLines(
  state: { pdf: PDFDocument; page: any; y: number },
  section: ReportSection,
  font: any,
  bold: any,
  columns: { leftX: number; amountRightX: number }
) {
  const indent = (section.level - 1) * 12;
  const isHeader = !section.accounts || section.accounts.length === 0;
  const titleFont = section.isTotal ? bold : (isHeader ? bold : font);

  ensureSpace(state, LINE_HEIGHT * 2);
  drawText({ page: state.page, y: state.y }, section.title, columns.leftX + indent, 11, titleFont, rgb(0.1, 0.1, 0.1));
  if (typeof section.subtotal === 'number') {
    drawRight({ page: state.page, y: state.y }, formatSek(section.subtotal), columns.amountRightX, 11, titleFont, rgb(0.1, 0.1, 0.1));
  }
  state.y -= LINE_HEIGHT;

  if (!section.accounts) return;

  for (const line of section.accounts) {
    drawAccountLine(state, line, font, bold, { ...columns, leftX: columns.leftX + indent + 12 });
  }
}

function drawAccountLine(
  state: { pdf: PDFDocument; page: any; y: number },
  line: AccountLine,
  font: any,
  bold: any,
  columns: { leftX: number; amountRightX: number }
) {
  ensureSpace(state, LINE_HEIGHT);
  const isSubtotal = !!line.isSubtotal;
  const name = `${line.account} ${line.name}`;
  drawText({ page: state.page, y: state.y }, name, columns.leftX, 10, isSubtotal ? bold : font, rgb(0.25, 0.25, 0.25));
  drawRight({ page: state.page, y: state.y }, formatSek(line.currentPeriod), columns.amountRightX, 10, isSubtotal ? bold : font, rgb(0.25, 0.25, 0.25));
  state.y -= LINE_HEIGHT;
}

function drawHeader(state: { pdf: PDFDocument; page: any; y: number }, title: string, subtitle: string, font: any, bold: any) {
  drawText({ page: state.page, y: state.y }, title, PAGE_MARGIN, 18, bold, rgb(0.05, 0.05, 0.05));
  state.y -= 22;
  drawText({ page: state.page, y: state.y }, subtitle, PAGE_MARGIN, 11, font, rgb(0.35, 0.35, 0.35));
  state.y -= 20;

  // divider line
  state.page.drawLine({
    start: { x: PAGE_MARGIN, y: state.y },
    end: { x: 595.28 - PAGE_MARGIN, y: state.y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });
  state.y -= 18;
}

export async function generateBalanceSheetPdf(report: BalanceSheet): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = addPage(pdf);
  const state = { pdf, page, y: 841.89 - PAGE_MARGIN };

  drawHeader(state, report.title, `${report.companyName} · ${report.date} · ${report.currency}`, font, bold);

  // columns
  const columns = { leftX: PAGE_MARGIN, amountRightX: 595.28 - PAGE_MARGIN };

  // Assets
  drawText({ page: state.page, y: state.y }, 'TILLGÅNGAR', PAGE_MARGIN, 12, bold, rgb(0.1, 0.1, 0.1));
  state.y -= 18;
  for (const section of report.assets.fixedAssets) drawSectionLines(state, section, font, bold, columns);
  for (const section of report.assets.currentAssets) drawSectionLines(state, section, font, bold, columns);
  ensureSpace(state, LINE_HEIGHT * 2);
  state.page.drawLine({
    start: { x: PAGE_MARGIN, y: state.y + 6 },
    end: { x: 595.28 - PAGE_MARGIN, y: state.y + 6 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  drawText({ page: state.page, y: state.y }, 'Summa tillgångar', PAGE_MARGIN, 11, bold);
  drawRight({ page: state.page, y: state.y }, formatSek(report.assets.totalAssets), columns.amountRightX, 11, bold);
  state.y -= 22;

  // Equity & liabilities
  drawText({ page: state.page, y: state.y }, 'EGET KAPITAL OCH SKULDER', PAGE_MARGIN, 12, bold, rgb(0.1, 0.1, 0.1));
  state.y -= 18;
  for (const section of report.equityAndLiabilities.equity) drawSectionLines(state, section, font, bold, columns);
  for (const section of report.equityAndLiabilities.provisions) drawSectionLines(state, section, font, bold, columns);
  for (const section of report.equityAndLiabilities.liabilities) drawSectionLines(state, section, font, bold, columns);
  ensureSpace(state, LINE_HEIGHT * 2);
  state.page.drawLine({
    start: { x: PAGE_MARGIN, y: state.y + 6 },
    end: { x: 595.28 - PAGE_MARGIN, y: state.y + 6 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  drawText({ page: state.page, y: state.y }, 'Summa eget kapital och skulder', PAGE_MARGIN, 11, bold);
  drawRight({ page: state.page, y: state.y }, formatSek(report.equityAndLiabilities.totalEquityAndLiabilities), columns.amountRightX, 11, bold);
  state.y -= 18;

  return pdf.save();
}

export async function generateIncomeStatementPdf(report: IncomeStatement): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = addPage(pdf);
  const state = { pdf, page, y: 841.89 - PAGE_MARGIN };

  drawHeader(state, report.title, `${report.companyName} · ${report.periodStart} – ${report.periodEnd} · ${report.currency}`, font, bold);

  const columns = { leftX: PAGE_MARGIN, amountRightX: 595.28 - PAGE_MARGIN };
  for (const section of report.sections) drawSectionLines(state, section, font, bold, columns);

  ensureSpace(state, LINE_HEIGHT * 5);
  state.page.drawLine({
    start: { x: PAGE_MARGIN, y: state.y + 6 },
    end: { x: 595.28 - PAGE_MARGIN, y: state.y + 6 },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  drawText({ page: state.page, y: state.y }, 'Rörelseresultat', PAGE_MARGIN, 11, bold);
  drawRight({ page: state.page, y: state.y }, formatSek(report.operatingResult), columns.amountRightX, 11, bold);
  state.y -= LINE_HEIGHT;

  drawText({ page: state.page, y: state.y }, 'Resultat före skatt', PAGE_MARGIN, 11, bold);
  drawRight({ page: state.page, y: state.y }, formatSek(report.resultBeforeTax), columns.amountRightX, 11, bold);
  state.y -= LINE_HEIGHT;

  drawText({ page: state.page, y: state.y }, 'Årets resultat', PAGE_MARGIN, 11, bold);
  drawRight({ page: state.page, y: state.y }, formatSek(report.netResult), columns.amountRightX, 11, bold);
  state.y -= LINE_HEIGHT;

  return pdf.save();
}



