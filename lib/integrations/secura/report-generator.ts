/**
 * Report Generator
 * 
 * Genererar rapporter i olika format (Excel, PDF, CSV)
 * för NAV-automation
 */

// ============================================================================
// Types
// ============================================================================

export interface ReportColumn {
  key: string;
  header: string;
  width?: number;
  format?: 'text' | 'number' | 'currency' | 'date' | 'percent';
}

export interface ReportData {
  title: string;
  subtitle?: string;
  date: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
}

// ============================================================================
// CSV Generator
// ============================================================================

export function generateCSV(data: ReportData): string {
  const lines: string[] = [];
  
  // Header row
  lines.push(data.columns.map(col => `"${col.header}"`).join(','));
  
  // Data rows
  for (const row of data.rows) {
    const values = data.columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      if (typeof value === 'number') {
        if (col.format === 'currency') return value.toFixed(2);
        if (col.format === 'percent') return (value * 100).toFixed(2) + '%';
        return value.toString();
      }
      return `"${String(value)}"`;
    });
    lines.push(values.join(','));
  }
  
  return lines.join('\n');
}

// ============================================================================
// Excel-like XML Generator (SpreadsheetML)
// ============================================================================

export function generateExcelXML(data: ReportData): string {
  const escapeXml = (str: string) => 
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Size="11"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Percent">
   <NumberFormat ss:Format="0.00%"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(data.title.substring(0, 31))}">
  <Table>`;

  // Column widths
  for (const col of data.columns) {
    xml += `\n   <Column ss:Width="${col.width || 100}"/>`;
  }

  // Title row
  xml += `
   <Row>
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(data.title)}</Data></Cell>
   </Row>`;

  // Date row
  xml += `
   <Row>
    <Cell><Data ss:Type="String">Datum: ${escapeXml(data.date)}</Data></Cell>
   </Row>
   <Row/>`;

  // Header row
  xml += `
   <Row>`;
  for (const col of data.columns) {
    xml += `
    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.header)}</Data></Cell>`;
  }
  xml += `
   </Row>`;

  // Data rows
  for (const row of data.rows) {
    xml += `
   <Row>`;
    for (const col of data.columns) {
      const value = row[col.key];
      if (value === null || value === undefined) {
        xml += `
    <Cell><Data ss:Type="String"></Data></Cell>`;
      } else if (typeof value === 'number') {
        const style = col.format === 'currency' ? ' ss:StyleID="Currency"' : 
                      col.format === 'percent' ? ' ss:StyleID="Percent"' : '';
        xml += `
    <Cell${style}><Data ss:Type="Number">${value}</Data></Cell>`;
      } else {
        xml += `
    <Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
      }
    }
    xml += `
   </Row>`;
  }

  // Summary row if provided
  if (data.summary) {
    xml += `
   <Row/>
   <Row>`;
    for (const col of data.columns) {
      const value = data.summary[col.key];
      if (value !== undefined) {
        if (typeof value === 'number') {
          xml += `
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${value}</Data></Cell>`;
        } else {
          xml += `
    <Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
        }
      } else {
        xml += `
    <Cell/>`;
      }
    }
    xml += `
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

// ============================================================================
// Specific Report Generators
// ============================================================================

export interface NotorEntry {
  fundName: string;
  type: 'SUBSCRIPTION' | 'REDEMPTION';
  investorName: string;
  amount: number;
  shares: number;
  date: string;
  settlementDate: string;
}

export function generateNotorReport(
  fundName: string,
  date: string,
  entries: NotorEntry[]
): ReportData {
  const subscriptions = entries.filter(e => e.type === 'SUBSCRIPTION');
  const redemptions = entries.filter(e => e.type === 'REDEMPTION');
  
  const totalSubAmount = subscriptions.reduce((sum, e) => sum + e.amount, 0);
  const totalRedAmount = redemptions.reduce((sum, e) => sum + e.amount, 0);
  
  return {
    title: `Nota - ${fundName}`,
    subtitle: `Gårdagens in/utflöden`,
    date,
    columns: [
      { key: 'type', header: 'Typ', width: 80 },
      { key: 'investorName', header: 'Investerare', width: 150 },
      { key: 'amount', header: 'Belopp', width: 120, format: 'currency' },
      { key: 'shares', header: 'Andelar', width: 100, format: 'number' },
      { key: 'settlementDate', header: 'Likviddatum', width: 100 },
    ],
    rows: entries.map(e => ({
      type: e.type === 'SUBSCRIPTION' ? 'Teckning' : 'Inlösen',
      investorName: e.investorName,
      amount: e.amount,
      shares: e.shares,
      settlementDate: e.settlementDate,
    })),
    summary: {
      type: 'TOTALT',
      amount: totalSubAmount - totalRedAmount,
    },
  };
}

export interface PriceDataEntry {
  fundId: string;
  fundName: string;
  isin: string;
  currency: string;
  nav: number;
  aum: number;
  outstandingShares: number;
  date: string;
}

export function generatePriceDataReport(
  date: string,
  entries: PriceDataEntry[]
): ReportData {
  const totalAUM = entries.reduce((sum, e) => sum + e.aum, 0);
  
  return {
    title: 'Prisdata',
    subtitle: 'NAV och AUM per fond',
    date,
    columns: [
      { key: 'isin', header: 'ISIN', width: 130 },
      { key: 'fundName', header: 'Fond', width: 180 },
      { key: 'currency', header: 'Valuta', width: 60 },
      { key: 'nav', header: 'NAV', width: 100, format: 'currency' },
      { key: 'aum', header: 'AUM', width: 150, format: 'currency' },
      { key: 'outstandingShares', header: 'Utst. andelar', width: 120, format: 'number' },
    ],
    rows: entries as unknown as Record<string, unknown>[],
    summary: {
      fundName: 'TOTALT',
      aum: totalAUM,
    },
  };
}

export interface OwnerDataEntry {
  investorId: string;
  investorName: string;
  fundName: string;
  shares: number;
  value: number;
  percentage: number;
}

export function generateOwnerDataReport(
  fundName: string,
  date: string,
  entries: OwnerDataEntry[]
): ReportData {
  const totalValue = entries.reduce((sum, e) => sum + e.value, 0);
  const totalShares = entries.reduce((sum, e) => sum + e.shares, 0);
  
  return {
    title: `Ägardata - ${fundName}`,
    subtitle: 'Innehav per investerare',
    date,
    columns: [
      { key: 'investorId', header: 'Investerare ID', width: 120 },
      { key: 'investorName', header: 'Namn', width: 180 },
      { key: 'shares', header: 'Andelar', width: 120, format: 'number' },
      { key: 'value', header: 'Värde (SEK)', width: 150, format: 'currency' },
      { key: 'percentage', header: 'Andel %', width: 80, format: 'percent' },
    ],
    rows: entries as unknown as Record<string, unknown>[],
    summary: {
      investorName: 'TOTALT',
      shares: totalShares,
      value: totalValue,
      percentage: 1,
    },
  };
}

// ============================================================================
// Blob Generators
// ============================================================================

export function createCSVBlob(data: ReportData): Blob {
  const csv = generateCSV(data);
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function createExcelBlob(data: ReportData): Blob {
  const xml = generateExcelXML(data);
  return new Blob([xml], { type: 'application/vnd.ms-excel' });
}

// ============================================================================
// Download Helper (for client-side)
// ============================================================================

export function downloadReport(
  data: ReportData,
  format: 'csv' | 'excel',
  filename: string
): void {
  const blob = format === 'csv' ? createCSVBlob(data) : createExcelBlob(data);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${format === 'csv' ? 'csv' : 'xml'}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
