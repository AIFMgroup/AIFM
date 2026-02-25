import * as XLSX from 'xlsx';

interface ExcelSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

interface GenerateExcelInput {
  title: string;
  sheets: ExcelSheet[];
}

export async function runGenerateExcel(input: GenerateExcelInput): Promise<{
  success: boolean;
  fileBase64?: string;
  fileName?: string;
  summary?: string;
  fileType?: string;
  error?: string;
}> {
  try {
    const wb = XLSX.utils.book_new();

    for (const sheet of input.sheets) {
      const data = [sheet.headers, ...sheet.rows];
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Auto-size columns based on content
      const colWidths = sheet.headers.map((h, colIdx) => {
        let max = h.length;
        for (const row of sheet.rows) {
          const cell = row[colIdx] || '';
          if (cell.length > max) max = cell.length;
        }
        return { wch: Math.min(max + 2, 60) };
      });
      ws['!cols'] = colWidths;

      // Style header row bold via cell formatting
      for (let c = 0; c < sheet.headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = { font: { bold: true } };
        }
      }

      const sheetName = sheet.name.slice(0, 31); // Excel max 31 chars
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const base64 = Buffer.from(buf).toString('base64');

    const today = new Date().toLocaleDateString('sv-SE');
    const safeName = input.title
      .replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    const fileName = `${safeName}_${today}.xlsx`;

    const totalRows = input.sheets.reduce((sum, s) => sum + s.rows.length, 0);

    return {
      success: true,
      fileBase64: base64,
      fileName,
      summary: `Excel-fil "${input.title}" genererad med ${input.sheets.length} flik(ar) och ${totalRows} rader.`,
      fileType: 'excel',
    };
  } catch (err) {
    console.error('[Generate Excel] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Kunde inte generera Excel-fil.',
    };
  }
}
