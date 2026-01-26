/**
 * Reports API
 * 
 * Hanterar dashboard KPIs, månadsrapporter och momsrapporter
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getDashboardKPIs,
  generateMonthlyReport,
  generateVATReport,
  exportMonthlyReportCSV,
  exportVATReportCSV,
} from '@/lib/accounting/services/reportingService';
import { closingReporter } from '@/lib/accounting/closing/closingReporter';
import { generateBalanceSheetPdf, generateIncomeStatementPdf } from '@/lib/accounting/services/pdfFinancialReportService';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const reportType = searchParams.get('type') || 'dashboard';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const format = searchParams.get('format') || 'json';
  const companyName = searchParams.get('companyName') || 'Företaget AB';

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  try {
    switch (reportType) {
      case 'dashboard': {
        const kpis = await getDashboardKPIs(companyId);
        return NextResponse.json({ kpis });
      }

      case 'monthly': {
        const report = await generateMonthlyReport(companyId, year, month);
        
        if (format === 'csv') {
          const csv = exportMonthlyReportCSV(report);
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="manadsrapport-${report.period}.csv"`,
            },
          });
        }
        
        return NextResponse.json({ report });
      }

      case 'vat': {
        const orgNumber = searchParams.get('orgNumber') || '556xxx-xxxx';
        
        const report = await generateVATReport(companyId, year, month, {
          name: companyName,
          orgNumber,
        });
        
        if (format === 'csv') {
          const csv = exportVATReportCSV(report);
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="momsrapport-${report.period}.csv"`,
            },
          });
        }
        
        return NextResponse.json({ report });
      }

      case 'balanceSheet': {
        const report = await closingReporter.generateBalanceSheet(companyId, companyName, year, month);
        if (format === 'pdf') {
          const pdf = await generateBalanceSheetPdf(report);
          return new NextResponse(Buffer.from(pdf), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="balansrakning-${year}-${String(month).padStart(2, '0')}.pdf"`,
              'Cache-Control': 'no-store',
            },
          });
        }
        return NextResponse.json({ report });
      }

      case 'incomeStatement': {
        const report = await closingReporter.generateIncomeStatement(companyId, companyName, year, month);
        if (format === 'pdf') {
          const pdf = await generateIncomeStatementPdf(report);
          return new NextResponse(Buffer.from(pdf), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="resultatrakning-${year}-${String(month).padStart(2, '0')}.pdf"`,
              'Cache-Control': 'no-store',
            },
          });
        }
        return NextResponse.json({ report });
      }

      default:
        return NextResponse.json(
          { error: `Okänd rapporttyp: ${reportType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Reports API] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte generera rapport', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}








