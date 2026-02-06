import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface ExcelRequest {
  title: string;
  sheets: Array<{
    name: string;
    headers?: string[];
    data: Array<Record<string, unknown>> | string[][];
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExcelRequest = await request.json();
    const { title, sheets } = body;

    if (!title || !sheets || sheets.length === 0) {
      return NextResponse.json(
        { error: 'Title and at least one sheet are required' },
        { status: 400 }
      );
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: title,
      Author: 'AIFM Group',
      CreatedDate: new Date(),
    };

    for (const sheet of sheets) {
      let worksheet: XLSX.WorkSheet;

      // Check if data is array of arrays or array of objects
      if (Array.isArray(sheet.data[0])) {
        // Array of arrays - add headers if provided
        const sheetData = sheet.headers 
          ? [sheet.headers, ...(sheet.data as string[][])]
          : sheet.data as string[][];
        worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      } else {
        // Array of objects
        worksheet = XLSX.utils.json_to_sheet(sheet.data as Record<string, unknown>[], {
          header: sheet.headers,
        });
      }

      // Style headers (bold) - set column widths
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const colWidths: Array<{ wch: number }> = [];
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        let maxWidth = 10;
        for (let row = range.s.r; row <= range.e.r; row++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          if (cell && cell.v) {
            const cellLength = String(cell.v).length;
            maxWidth = Math.max(maxWidth, Math.min(cellLength + 2, 50));
          }
        }
        colWidths.push({ wch: maxWidth });
      }
      worksheet['!cols'] = colWidths;

      // Add sheet to workbook
      XLSX.utils.book_append_sheet(
        workbook, 
        worksheet, 
        sheet.name.slice(0, 31) // Excel sheet names max 31 chars
      );
    }

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true,
    }) as Buffer;

    // Convert to Uint8Array for Response
    const uint8Array = new Uint8Array(excelBuffer);

    // Return Excel as download
    const filename = `${title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.xlsx`;
    
    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Excel generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Excel' },
      { status: 500 }
    );
  }
}
