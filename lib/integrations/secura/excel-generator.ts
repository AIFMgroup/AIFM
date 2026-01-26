/**
 * Professional Excel Report Generator
 * 
 * Skapar snygga, minimalistiska Excel-rapporter med:
 * - Professionell styling och typografi
 * - Ramar och färgschema
 * - Sammanfattningar och totaler
 * - Diagram där det passar
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Brand Colors & Styling
// ============================================================================

const COLORS = {
  // Brand
  gold: 'C9A227',
  goldLight: 'FEF3C7',
  charcoal: '1F2937',
  charcoalLight: '374151',
  
  // Accents
  white: 'FFFFFF',
  lightGray: 'F9FAFB',
  mediumGray: 'E5E7EB',
  darkGray: '6B7280',
  
  // Status
  green: '10B981',
  greenLight: 'D1FAE5',
  red: 'EF4444',
  redLight: 'FEE2E2',
  blue: '3B82F6',
  blueLight: 'DBEAFE',
};

const FONTS = {
  title: { name: 'Calibri', size: 18, bold: true, color: { argb: COLORS.charcoal } },
  subtitle: { name: 'Calibri', size: 12, color: { argb: COLORS.darkGray } },
  header: { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.charcoal } },
  body: { name: 'Calibri', size: 10, color: { argb: COLORS.charcoalLight } },
  bodyBold: { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.charcoal } },
  small: { name: 'Calibri', size: 9, color: { argb: COLORS.darkGray } },
  total: { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } },
};

const BORDERS: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.mediumGray } },
  left: { style: 'thin', color: { argb: COLORS.mediumGray } },
  bottom: { style: 'thin', color: { argb: COLORS.mediumGray } },
  right: { style: 'thin', color: { argb: COLORS.mediumGray } },
};

const BORDERS_NONE: Partial<ExcelJS.Borders> = {
  top: { style: undefined },
  left: { style: undefined },
  bottom: { style: undefined },
  right: { style: undefined },
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function addLogo(worksheet: ExcelJS.Worksheet): void {
  // Add branded header bar
  worksheet.mergeCells('A1:H1');
  const headerCell = worksheet.getCell('A1');
  headerCell.value = 'AIFM Fund Management';
  headerCell.font = { ...FONTS.title, color: { argb: COLORS.gold } };
  headerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.charcoal },
  };
  headerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(1).height = 40;
}

function addReportHeader(
  worksheet: ExcelJS.Worksheet, 
  title: string, 
  subtitle: string,
  date: string,
  startRow: number = 3
): number {
  // Title
  worksheet.mergeCells(`A${startRow}:H${startRow}`);
  const titleCell = worksheet.getCell(`A${startRow}`);
  titleCell.value = title;
  titleCell.font = FONTS.title;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(startRow).height = 28;
  
  // Subtitle
  worksheet.mergeCells(`A${startRow + 1}:H${startRow + 1}`);
  const subtitleCell = worksheet.getCell(`A${startRow + 1}`);
  subtitleCell.value = `${subtitle} • ${date}`;
  subtitleCell.font = FONTS.subtitle;
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(startRow + 1).height = 20;
  
  return startRow + 3; // Return next available row
}

function addTableHeaders(
  worksheet: ExcelJS.Worksheet,
  headers: { key: string; label: string; width: number }[],
  startRow: number
): void {
  headers.forEach((header, index) => {
    const col = index + 1;
    const cell = worksheet.getCell(startRow, col);
    cell.value = header.label;
    cell.font = FONTS.header;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.lightGray },
    };
    cell.border = BORDERS;
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    
    // Set column width
    worksheet.getColumn(col).width = header.width;
  });
  
  worksheet.getRow(startRow).height = 24;
}

function addDataRow(
  worksheet: ExcelJS.Worksheet,
  data: (string | number | null)[],
  formats: ('text' | 'number' | 'currency' | 'percent')[],
  rowNum: number,
  isAlternate: boolean = false
): void {
  data.forEach((value, index) => {
    const cell = worksheet.getCell(rowNum, index + 1);
    
    if (value === null || value === undefined) {
      cell.value = '-';
    } else if (formats[index] === 'currency' && typeof value === 'number') {
      cell.value = value;
      cell.numFmt = '#,##0.00';
    } else if (formats[index] === 'percent' && typeof value === 'number') {
      cell.value = value;
      cell.numFmt = '0.00%';
    } else if (formats[index] === 'number' && typeof value === 'number') {
      cell.value = value;
      cell.numFmt = '#,##0.00';
    } else {
      cell.value = value;
    }
    
    cell.font = FONTS.body;
    cell.border = BORDERS;
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    
    if (isAlternate) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLORS.lightGray },
      };
    }
  });
  
  worksheet.getRow(rowNum).height = 22;
}

function addTotalRow(
  worksheet: ExcelJS.Worksheet,
  data: (string | number | null)[],
  formats: ('text' | 'number' | 'currency' | 'percent')[],
  rowNum: number
): void {
  data.forEach((value, index) => {
    const cell = worksheet.getCell(rowNum, index + 1);
    
    if (value === null || value === undefined) {
      cell.value = '';
    } else if (formats[index] === 'currency' && typeof value === 'number') {
      cell.value = value;
      cell.numFmt = '#,##0.00';
    } else if (formats[index] === 'percent' && typeof value === 'number') {
      cell.value = value;
      cell.numFmt = '0.00%';
    } else if (formats[index] === 'number' && typeof value === 'number') {
      cell.value = value;
      cell.numFmt = '#,##0.00';
    } else {
      cell.value = value;
    }
    
    cell.font = FONTS.total;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.charcoal },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.gold } },
      left: { style: 'thin', color: { argb: COLORS.charcoal } },
      bottom: { style: 'thin', color: { argb: COLORS.charcoal } },
      right: { style: 'thin', color: { argb: COLORS.charcoal } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  });
  
  worksheet.getRow(rowNum).height = 26;
}

function addSummaryBox(
  worksheet: ExcelJS.Worksheet,
  items: { label: string; value: string | number; highlight?: 'positive' | 'negative' | 'neutral' }[],
  startRow: number,
  startCol: number = 1
): number {
  let row = startRow;
  
  items.forEach((item, index) => {
    // Label cell
    const labelCell = worksheet.getCell(row, startCol);
    labelCell.value = item.label;
    labelCell.font = FONTS.body;
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    
    // Value cell
    const valueCell = worksheet.getCell(row, startCol + 1);
    valueCell.value = item.value;
    valueCell.font = FONTS.bodyBold;
    valueCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    
    // Highlight color
    if (item.highlight) {
      const bgColor = item.highlight === 'positive' ? COLORS.greenLight :
                     item.highlight === 'negative' ? COLORS.redLight : COLORS.blueLight;
      const textColor = item.highlight === 'positive' ? COLORS.green :
                       item.highlight === 'negative' ? COLORS.red : COLORS.blue;
      
      valueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      };
      valueCell.font = { ...FONTS.bodyBold, color: { argb: textColor } };
    }
    
    // Border
    [labelCell, valueCell].forEach(cell => {
      cell.border = {
        top: index === 0 ? { style: 'thin', color: { argb: COLORS.mediumGray } } : BORDERS_NONE.top,
        left: { style: 'thin', color: { argb: COLORS.mediumGray } },
        bottom: index === items.length - 1 ? { style: 'thin', color: { argb: COLORS.mediumGray } } : BORDERS_NONE.bottom,
        right: { style: 'thin', color: { argb: COLORS.mediumGray } },
      };
    });
    
    worksheet.getRow(row).height = 22;
    row++;
  });
  
  return row + 1;
}

function addFooter(worksheet: ExcelJS.Worksheet, rowNum: number): void {
  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  const footerCell = worksheet.getCell(`A${rowNum}`);
  footerCell.value = `Genererad av AIFM • ${new Date().toLocaleString('sv-SE')}`;
  footerCell.font = FONTS.small;
  footerCell.alignment = { vertical: 'middle', horizontal: 'left' };
}

// ============================================================================
// NOTOR REPORT (Gårdagens transaktioner)
// ============================================================================

interface NotorTransaction {
  id: string;
  fundId: string;
  type: 'SUBSCRIPTION' | 'REDEMPTION';
  amount: number;
  shares: number;
  date: string;
  settlementDate: string;
  status: string;
  investorId: string;
  investorName: string;
}

export async function generateNotorExcel(
  fundId: string,
  fundName: string,
  transactions: NotorTransaction[],
  date: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AIFM';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Notor', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  
  // Add branding
  addLogo(worksheet);
  
  // Report header
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let currentRow = addReportHeader(
    worksheet,
    `Notor - ${fundName}`,
    'Gårdagens in- och utflöden',
    formatDate(yesterday)
  );
  
  // Calculate summary
  const subscriptions = transactions.filter(t => t.type === 'SUBSCRIPTION');
  const redemptions = transactions.filter(t => t.type === 'REDEMPTION');
  const subTotal = subscriptions.reduce((sum, t) => sum + t.amount, 0);
  const redTotal = redemptions.reduce((sum, t) => sum + t.amount, 0);
  const netFlow = subTotal - redTotal;
  
  // Summary box
  currentRow = addSummaryBox(worksheet, [
    { label: 'Teckningar', value: `${subscriptions.length} st (${formatCurrency(subTotal)} SEK)`, highlight: 'positive' },
    { label: 'Inlösen', value: `${redemptions.length} st (${formatCurrency(redTotal)} SEK)`, highlight: 'negative' },
    { label: 'Nettoflöde', value: `${formatCurrency(netFlow)} SEK`, highlight: netFlow >= 0 ? 'positive' : 'negative' },
  ], currentRow);
  
  currentRow++; // Space
  
  // Table headers
  const headers = [
    { key: 'type', label: 'Typ', width: 12 },
    { key: 'investor', label: 'Investerare', width: 30 },
    { key: 'amount', label: 'Belopp (SEK)', width: 18 },
    { key: 'shares', label: 'Andelar', width: 15 },
    { key: 'settlement', label: 'Likviddatum', width: 15 },
    { key: 'status', label: 'Status', width: 12 },
  ];
  
  addTableHeaders(worksheet, headers, currentRow);
  currentRow++;
  
  // Data rows
  const formats: ('text' | 'number' | 'currency' | 'percent')[] = ['text', 'text', 'currency', 'number', 'text', 'text'];
  
  transactions.forEach((t, index) => {
    addDataRow(
      worksheet,
      [
        t.type === 'SUBSCRIPTION' ? 'Teckning' : 'Inlösen',
        t.investorName,
        t.amount,
        t.shares,
        t.settlementDate,
        t.status === 'COMPLETED' ? 'Klar' : 'Pågående',
      ],
      formats,
      currentRow,
      index % 2 === 1
    );
    currentRow++;
  });
  
  // Total row
  addTotalRow(
    worksheet,
    ['TOTALT', '', netFlow, null, null, ''],
    formats,
    currentRow
  );
  currentRow += 2;
  
  // Footer
  addFooter(worksheet, currentRow);
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// ============================================================================
// PRICE DATA REPORT (NAV-kurser)
// ============================================================================

interface PriceDataEntry {
  fundId: string;
  fundName: string;
  isin: string;
  date: string;
  nav: number;
  aum: number;
  outstandingShares: number;
  currency: string;
}

export async function generatePriceDataExcel(
  priceData: PriceDataEntry[],
  date?: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AIFM';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Prisdata', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  
  // Add branding
  addLogo(worksheet);
  
  // Report header
  let currentRow = addReportHeader(
    worksheet,
    'Prisdata - NAV-kurser',
    'Daglig distribution till institut',
    formatDate(date || new Date())
  );
  
  // Calculate totals
  const totalAUM = priceData.reduce((sum, p) => sum + p.aum, 0);
  const totalShares = priceData.reduce((sum, p) => sum + p.outstandingShares, 0);
  
  // Summary box
  currentRow = addSummaryBox(worksheet, [
    { label: 'Antal fonder', value: priceData.length.toString(), highlight: 'neutral' },
    { label: 'Totalt AUM', value: `${formatCurrency(totalAUM)} SEK`, highlight: 'positive' },
    { label: 'Totalt andelar', value: formatCurrency(totalShares), highlight: 'neutral' },
  ], currentRow);
  
  currentRow++; // Space
  
  // Table headers
  const headers = [
    { key: 'isin', label: 'ISIN', width: 18 },
    { key: 'fund', label: 'Fond', width: 28 },
    { key: 'currency', label: 'Valuta', width: 10 },
    { key: 'nav', label: 'NAV', width: 14 },
    { key: 'aum', label: 'AUM (SEK)', width: 20 },
    { key: 'shares', label: 'Utst. andelar', width: 18 },
  ];
  
  addTableHeaders(worksheet, headers, currentRow);
  currentRow++;
  
  // Data rows
  const formats: ('text' | 'number' | 'currency' | 'percent')[] = ['text', 'text', 'text', 'currency', 'currency', 'number'];
  
  priceData.forEach((p, index) => {
    addDataRow(
      worksheet,
      [p.isin, p.fundName, p.currency, p.nav, p.aum, p.outstandingShares],
      formats,
      currentRow,
      index % 2 === 1
    );
    currentRow++;
  });
  
  // Total row
  addTotalRow(
    worksheet,
    ['TOTALT', '', '', null, totalAUM, totalShares],
    formats,
    currentRow
  );
  currentRow += 2;
  
  // Add simple bar chart for AUM distribution
  if (priceData.length > 1 && priceData.length <= 10) {
    currentRow = await addAUMChart(worksheet, priceData, currentRow);
  }
  
  // Footer
  addFooter(worksheet, currentRow);
  
  const excelBuffer = await workbook.xlsx.writeBuffer();
  return excelBuffer as ArrayBuffer;
}

async function addAUMChart(
  worksheet: ExcelJS.Worksheet,
  priceData: PriceDataEntry[],
  startRow: number
): Promise<number> {
  // Add a visual AUM distribution using cells (since exceljs chart support is limited)
  worksheet.mergeCells(`A${startRow}:F${startRow}`);
  const chartTitle = worksheet.getCell(`A${startRow}`);
  chartTitle.value = 'AUM-fördelning';
  chartTitle.font = FONTS.header;
  worksheet.getRow(startRow).height = 24;
  startRow++;
  
  const totalAUM = priceData.reduce((sum, p) => sum + p.aum, 0);
  const maxBarWidth = 30; // characters
  
  priceData.forEach((p, index) => {
    const percentage = p.aum / totalAUM;
    const barWidth = Math.round(percentage * maxBarWidth);
    const bar = '█'.repeat(barWidth);
    
    // Fund name
    const nameCell = worksheet.getCell(startRow, 1);
    nameCell.value = p.fundName;
    nameCell.font = FONTS.small;
    nameCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    
    // Bar
    worksheet.mergeCells(`B${startRow}:D${startRow}`);
    const barCell = worksheet.getCell(startRow, 2);
    barCell.value = bar;
    barCell.font = { ...FONTS.body, color: { argb: COLORS.gold } };
    barCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    // Percentage
    const percentCell = worksheet.getCell(startRow, 5);
    percentCell.value = `${(percentage * 100).toFixed(1)}%`;
    percentCell.font = FONTS.small;
    percentCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    worksheet.getRow(startRow).height = 18;
    startRow++;
  });
  
  return startRow + 1;
}

// ============================================================================
// OWNER DATA REPORT (Ägardata / Clearstream)
// ============================================================================

interface OwnerHolding {
  investorId: string;
  investorName: string;
  fundId: string;
  shares: number;
  value: number;
  percentage: number;
  lastUpdated: string;
}

export async function generateOwnerDataExcel(
  fundId: string,
  fundName: string,
  holdings: OwnerHolding[],
  date?: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AIFM';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Ägardata', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  
  // Add branding
  addLogo(worksheet);
  
  // Report header
  let currentRow = addReportHeader(
    worksheet,
    `Ägardata - ${fundName}`,
    'Clearstream-rapport',
    formatDate(date || new Date())
  );
  
  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalShares = holdings.reduce((sum, h) => sum + h.shares, 0);
  
  // Sort by value descending
  const sortedHoldings = [...holdings].sort((a, b) => b.value - a.value);
  
  // Top 5 holders
  const top5 = sortedHoldings.slice(0, 5);
  const top5Percentage = top5.reduce((sum, h) => sum + h.percentage, 0);
  
  // Summary box
  currentRow = addSummaryBox(worksheet, [
    { label: 'Antal ägare', value: holdings.length.toString(), highlight: 'neutral' },
    { label: 'Totalt värde', value: `${formatCurrency(totalValue)} SEK`, highlight: 'positive' },
    { label: 'Totala andelar', value: formatCurrency(totalShares), highlight: 'neutral' },
    { label: 'Top 5 andel', value: `${(top5Percentage * 100).toFixed(1)}%`, highlight: 'neutral' },
  ], currentRow);
  
  currentRow++; // Space
  
  // Table headers
  const headers = [
    { key: 'id', label: 'Investerare ID', width: 16 },
    { key: 'name', label: 'Namn', width: 32 },
    { key: 'shares', label: 'Andelar', width: 16 },
    { key: 'value', label: 'Värde (SEK)', width: 18 },
    { key: 'percent', label: 'Andel', width: 12 },
    { key: 'updated', label: 'Uppdaterad', width: 14 },
  ];
  
  addTableHeaders(worksheet, headers, currentRow);
  currentRow++;
  
  // Data rows
  const formats: ('text' | 'number' | 'currency' | 'percent')[] = ['text', 'text', 'number', 'currency', 'percent', 'text'];
  
  sortedHoldings.forEach((h, index) => {
    addDataRow(
      worksheet,
      [h.investorId, h.investorName, h.shares, h.value, h.percentage, h.lastUpdated.split('T')[0]],
      formats,
      currentRow,
      index % 2 === 1
    );
    currentRow++;
  });
  
  // Total row
  addTotalRow(
    worksheet,
    ['TOTALT', '', totalShares, totalValue, 1, ''],
    formats,
    currentRow
  );
  currentRow += 2;
  
  // Add ownership distribution visual
  if (sortedHoldings.length > 0) {
    currentRow = addOwnershipDistribution(worksheet, sortedHoldings, totalValue, currentRow);
  }
  
  // Footer
  addFooter(worksheet, currentRow);
  
  const excelBuffer = await workbook.xlsx.writeBuffer();
  return excelBuffer as ArrayBuffer;
}

function addOwnershipDistribution(
  worksheet: ExcelJS.Worksheet,
  holdings: OwnerHolding[],
  totalValue: number,
  startRow: number
): number {
  // Top holders visualization
  worksheet.mergeCells(`A${startRow}:F${startRow}`);
  const chartTitle = worksheet.getCell(`A${startRow}`);
  chartTitle.value = 'Största ägare';
  chartTitle.font = FONTS.header;
  worksheet.getRow(startRow).height = 24;
  startRow++;
  
  const top10 = holdings.slice(0, 10);
  const maxBarWidth = 25;
  
  top10.forEach((h, index) => {
    const barWidth = Math.round(h.percentage * maxBarWidth);
    const bar = '█'.repeat(Math.max(1, barWidth));
    
    // Rank
    const rankCell = worksheet.getCell(startRow, 1);
    rankCell.value = `${index + 1}.`;
    rankCell.font = FONTS.small;
    rankCell.alignment = { vertical: 'middle', horizontal: 'right' };
    
    // Name (truncated)
    const nameCell = worksheet.getCell(startRow, 2);
    const truncatedName = h.investorName.length > 20 ? h.investorName.substring(0, 18) + '...' : h.investorName;
    nameCell.value = truncatedName;
    nameCell.font = FONTS.small;
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    
    // Bar
    worksheet.mergeCells(`C${startRow}:D${startRow}`);
    const barCell = worksheet.getCell(startRow, 3);
    barCell.value = bar;
    barCell.font = { ...FONTS.body, color: { argb: index < 3 ? COLORS.gold : COLORS.darkGray } };
    barCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    // Percentage
    const percentCell = worksheet.getCell(startRow, 5);
    percentCell.value = `${(h.percentage * 100).toFixed(2)}%`;
    percentCell.font = FONTS.small;
    percentCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    // Value
    const valueCell = worksheet.getCell(startRow, 6);
    valueCell.value = formatCurrency(h.value);
    valueCell.font = FONTS.small;
    valueCell.alignment = { vertical: 'middle', horizontal: 'right' };
    
    worksheet.getRow(startRow).height = 18;
    startRow++;
  });
  
  // Others row if needed
  if (holdings.length > 10) {
    const othersValue = holdings.slice(10).reduce((sum, h) => sum + h.value, 0);
    const othersPercentage = othersValue / totalValue;
    
    const othersRow = startRow;
    const othersNameCell = worksheet.getCell(othersRow, 2);
    othersNameCell.value = `Övriga (${holdings.length - 10} st)`;
    othersNameCell.font = { ...FONTS.small, italic: true };
    
    const othersPercentCell = worksheet.getCell(othersRow, 5);
    othersPercentCell.value = `${(othersPercentage * 100).toFixed(2)}%`;
    othersPercentCell.font = FONTS.small;
    
    const othersValueCell = worksheet.getCell(othersRow, 6);
    othersValueCell.value = formatCurrency(othersValue);
    othersValueCell.font = FONTS.small;
    
    worksheet.getRow(othersRow).height = 18;
    startRow++;
  }
  
  return startRow + 1;
}

// ============================================================================
// SUBRED REPORT (Morgondagens transaktioner)
// ============================================================================

export async function generateSubRedExcel(
  fundId: string,
  fundName: string,
  transactions: NotorTransaction[],
  date: string
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AIFM';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('SubRed', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  
  // Add branding
  addLogo(worksheet);
  
  // Report header
  let currentRow = addReportHeader(
    worksheet,
    `SubRed - ${fundName}`,
    'Förväntade in- och utflöden',
    formatDate(date)
  );
  
  // Calculate summary
  const subscriptions = transactions.filter(t => t.type === 'SUBSCRIPTION');
  const redemptions = transactions.filter(t => t.type === 'REDEMPTION');
  const subTotal = subscriptions.reduce((sum, t) => sum + t.amount, 0);
  const redTotal = redemptions.reduce((sum, t) => sum + t.amount, 0);
  const netFlow = subTotal - redTotal;
  
  // Summary box
  currentRow = addSummaryBox(worksheet, [
    { label: 'Förväntade teckningar', value: `${subscriptions.length} st (${formatCurrency(subTotal)} SEK)`, highlight: 'positive' },
    { label: 'Förväntade inlösen', value: `${redemptions.length} st (${formatCurrency(redTotal)} SEK)`, highlight: 'negative' },
    { label: 'Förväntat nettoflöde', value: `${formatCurrency(netFlow)} SEK`, highlight: netFlow >= 0 ? 'positive' : 'negative' },
  ], currentRow);
  
  currentRow++; // Space
  
  // Table headers
  const headers = [
    { key: 'type', label: 'Typ', width: 12 },
    { key: 'investor', label: 'Investerare', width: 30 },
    { key: 'amount', label: 'Belopp (SEK)', width: 18 },
    { key: 'shares', label: 'Andelar', width: 15 },
    { key: 'settlement', label: 'Likviddatum', width: 15 },
  ];
  
  addTableHeaders(worksheet, headers, currentRow);
  currentRow++;
  
  // Data rows
  const formats: ('text' | 'number' | 'currency' | 'percent')[] = ['text', 'text', 'currency', 'number', 'text'];
  
  if (transactions.length === 0) {
    worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
    const emptyCell = worksheet.getCell(`A${currentRow}`);
    emptyCell.value = 'Inga förväntade transaktioner';
    emptyCell.font = { ...FONTS.body, italic: true, color: { argb: COLORS.darkGray } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.lightGray },
    };
    worksheet.getRow(currentRow).height = 30;
    currentRow++;
  } else {
    transactions.forEach((t, index) => {
      addDataRow(
        worksheet,
        [
          t.type === 'SUBSCRIPTION' ? 'Teckning' : 'Inlösen',
          t.investorName,
          t.amount,
          t.shares,
          t.settlementDate,
        ],
        formats,
        currentRow,
        index % 2 === 1
      );
      currentRow++;
    });
    
    // Total row
    addTotalRow(
      worksheet,
      ['TOTALT', '', netFlow, null, ''],
      formats,
      currentRow
    );
    currentRow++;
  }
  
  currentRow++;
  
  // Footer
  addFooter(worksheet, currentRow);
  
  const excelBuffer = await workbook.xlsx.writeBuffer();
  return excelBuffer as ArrayBuffer;
}

// ============================================================================
// UTILITY: Convert Buffer to Blob
// ============================================================================

export function bufferToBlob(buffer: ArrayBuffer, mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): Blob {
  return new Blob([buffer], { type: mimeType });
}
