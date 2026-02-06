/**
 * NAV Export API
 * 
 * Exportera NAV-data i olika format
 */

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// ============================================================================
// Types
// ============================================================================

interface NAVExportData {
  fundName: string;
  shareClassName: string;
  isin: string;
  currency: string;
  navPerShare: number;
  navChangePercent: number;
  netAssetValue: number;
  sharesOutstanding: number;
  navDate: string;
  status: string;
}

// ============================================================================
// POST - Export NAV data
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, navDate, data } = body;

    if (!format || !data) {
      return NextResponse.json(
        { success: false, error: 'format and data are required' },
        { status: 400 }
      );
    }

    switch (format) {
      case 'csv':
        return exportCSV(data, navDate);
      case 'excel':
        return exportExcel(data, navDate);
      case 'pdf':
        return exportPDF(data, navDate);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown format: ${format}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[NAV Export API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Export failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Export Functions
// ============================================================================

function exportCSV(data: NAVExportData[], navDate: string): NextResponse {
  const headers = [
    'ISIN',
    'Fond',
    'Andelsklass',
    'Valuta',
    'NAV',
    'Förändring %',
    'AUM',
    'Utestående andelar',
    'Status',
    'Datum',
  ];

  const rows = data.map(item => [
    item.isin,
    item.fundName,
    item.shareClassName,
    item.currency,
    item.navPerShare.toFixed(4),
    item.navChangePercent.toFixed(2),
    item.netAssetValue.toFixed(2),
    item.sharesOutstanding.toFixed(2),
    item.status,
    navDate,
  ]);

  // Use semicolon as delimiter for Swedish Excel compatibility
  const csv = [
    headers.join(';'),
    ...rows.map(row => row.join(';')),
  ].join('\n');

  // Add BOM for UTF-8
  const csvWithBom = '\ufeff' + csv;

  return new NextResponse(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="NAV_${navDate}.csv"`,
    },
  });
}

function exportExcel(data: NAVExportData[], navDate: string): NextResponse {
  // For now, return CSV with .xlsx extension
  // A proper implementation would use a library like xlsx
  const headers = [
    'ISIN',
    'Fond',
    'Andelsklass',
    'Valuta',
    'NAV',
    'Förändring %',
    'AUM',
    'Utestående andelar',
    'Status',
    'Datum',
  ];

  const rows = data.map(item => [
    item.isin,
    item.fundName,
    item.shareClassName,
    item.currency,
    item.navPerShare.toFixed(4),
    item.navChangePercent.toFixed(2),
    item.netAssetValue.toFixed(2),
    item.sharesOutstanding.toFixed(2),
    item.status,
    navDate,
  ]);

  const csv = [
    headers.join('\t'),
    ...rows.map(row => row.join('\t')),
  ].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="NAV_${navDate}.xls"`,
    },
  });
}

async function exportPDF(data: NAVExportData[], navDate: string): Promise<NextResponse> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const margin = 50;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  page.drawText('NAV-rapport', {
    x: margin,
    y,
    size: 24,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 30;

  page.drawText(`Datum: ${navDate}`, {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 10;

  page.drawText(`Genererad: ${new Date().toLocaleString('sv-SE')}`, {
    x: margin,
    y,
    size: 10,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 40;

  // Summary
  const totalAUM = data.reduce((sum, d) => sum + d.netAssetValue, 0);
  const avgChange = data.reduce((sum, d) => sum + d.navChangePercent, 0) / data.length;

  page.drawText('Sammanfattning', {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 20;

  page.drawText(`Totalt AUM: ${formatLargeCurrency(totalAUM)} SEK`, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Antal andelsklasser: ${data.length}`, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 15;

  page.drawText(`Genomsnittlig förändring: ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`, {
    x: margin,
    y,
    size: 11,
    font: helvetica,
    color: avgChange >= 0 ? rgb(0.1, 0.6, 0.3) : rgb(0.8, 0.2, 0.2),
  });
  y -= 40;

  // Table header
  const columns = [
    { label: 'ISIN', x: margin, width: 120 },
    { label: 'Fond', x: margin + 120, width: 180 },
    { label: 'Valuta', x: margin + 300, width: 50 },
    { label: 'NAV', x: margin + 350, width: 80 },
    { label: 'Förändring', x: margin + 430, width: 70 },
    { label: 'AUM', x: margin + 500, width: 100 },
    { label: 'Status', x: margin + 600, width: 80 },
  ];

  // Header background
  page.drawRectangle({
    x: margin - 5,
    y: y - 5,
    width: pageWidth - 2 * margin + 10,
    height: 25,
    color: rgb(0.95, 0.95, 0.95),
  });

  for (const col of columns) {
    page.drawText(col.label, {
      x: col.x,
      y: y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  y -= 30;

  // Table rows
  for (const item of data) {
    if (y < margin + 50) {
      // New page
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawText(item.isin, {
      x: columns[0].x,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`${item.fundName} ${item.shareClassName}`.slice(0, 30), {
      x: columns[1].x,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(item.currency, {
      x: columns[2].x,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText(item.navPerShare.toFixed(4), {
      x: columns[3].x,
      y,
      size: 9,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const changeColor = item.navChangePercent >= 0 ? rgb(0.1, 0.6, 0.3) : rgb(0.8, 0.2, 0.2);
    page.drawText(`${item.navChangePercent >= 0 ? '+' : ''}${item.navChangePercent.toFixed(2)}%`, {
      x: columns[4].x,
      y,
      size: 9,
      font: helvetica,
      color: changeColor,
    });

    page.drawText(formatCompactCurrency(item.netAssetValue), {
      x: columns[5].x,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText(item.status, {
      x: columns[6].x,
      y,
      size: 8,
      font: helvetica,
      color: item.status === 'APPROVED' ? rgb(0.1, 0.6, 0.3) : rgb(0.6, 0.5, 0.1),
    });

    y -= 20;
  }

  // Footer
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Sida ${i + 1} av ${pages.length}`, {
      x: pageWidth - margin - 60,
      y: 30,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });

    p.drawText('AIFM AB - Konfidentiellt', {
      x: margin,
      y: 30,
      size: 9,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="NAV_${navDate}.pdf"`,
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatLargeCurrency(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} Mdr`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} Mkr`;
  }
  return new Intl.NumberFormat('sv-SE').format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(0)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toFixed(0);
}
