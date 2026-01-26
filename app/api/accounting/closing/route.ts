/**
 * API Route: Closing (Bokslut)
 * 
 * Endpoints:
 * GET  /api/accounting/closing?companyId=xxx&year=2024&month=11
 *      - Hämta bokslutsstatus och uppgifter
 * 
 * POST /api/accounting/closing
 *      - action: 'run-closing' - Kör automatiskt bokslut
 *      - action: 'update-task' - Uppdatera enskild uppgift
 *      - action: 'calculate-depreciation' - Beräkna avskrivningar
 *      - action: 'calculate-tax' - Beräkna skatteavsättning
 *      - action: 'generate-balance-sheet' - Generera balansräkning
 *      - action: 'generate-income-statement' - Generera resultaträkning
 *      - action: 'generate-sie' - Generera SIE-export
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { closingService } from '@/lib/accounting/closing/closingService';
import { closingReporter } from '@/lib/accounting/closing/closingReporter';
import { depreciationEngine } from '@/lib/accounting/closing/depreciationEngine';
import { taxCalculator } from '@/lib/accounting/closing/taxCalculator';
import { getSession } from '@/lib/auth/session';
import { getCompanyById } from '@/lib/companyData';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');
    const includeReports = searchParams.get('includeReports') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const now = new Date();
    const year = yearStr ? parseInt(yearStr) : now.getFullYear();
    const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1;

    // Initiera service
    await closingService.init(companyId);

    // Hämta data
    const tasks = await closingService.getClosingTasks(companyId, year, month);
    const periodData = await closingService.getPeriodData(companyId, year, month);
    const periods = await closingService.getYearPeriods(companyId, year);

    // Bygg svar
    const response: {
      success: boolean;
      tasks: typeof tasks;
      periodData: typeof periodData;
      periods: typeof periods;
      year: number;
      month: number;
      reports?: {
        balanceSheet?: Awaited<ReturnType<typeof closingReporter.generateBalanceSheet>>;
        incomeStatement?: Awaited<ReturnType<typeof closingReporter.generateIncomeStatement>>;
      };
    } = {
      success: true,
      tasks,
      periodData,
      periods,
      year,
      month,
    };

    // Inkludera rapporter om begärt
    if (includeReports) {
      const company = getCompanyById(companyId);
      const companyName = company?.name || 'Ditt Bolag AB';
      
      response.reports = {
        balanceSheet: await closingReporter.generateBalanceSheet(
          companyId,
          companyName,
          year,
          month
        ),
        incomeStatement: await closingReporter.generateIncomeStatement(
          companyId,
          companyName,
          year,
          month
        ),
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API] Closing GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch closing data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await getSession().catch(() => null);
    const actorId = session?.email || 'system';

    const body = await request.json();
    const { companyId, year, month, action } = body;

    if (!companyId || !year || !month) {
      return NextResponse.json(
        { error: 'companyId, year, and month are required' },
        { status: 400 }
      );
    }

    // Initiera service
    await closingService.init(companyId);

    // Hantera olika actions
    switch (action) {
      case 'run-closing': {
        // Kör automatiskt bokslut
        const result = await closingService.runAutomaticClosing(
          companyId,
          year,
          month,
          actorId
        );
        return NextResponse.json(result);
      }

      case 'update-task': {
        // Uppdatera enskild uppgift
        const { taskId, status, result } = body;
        
        const updatedTask = await closingService.updateTask(
          companyId,
          year,
          month,
          taskId,
          status,
          result
        );

        if (!updatedTask) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, task: updatedTask });
      }

      case 'calculate-depreciation': {
        // Beräkna avskrivningar
        const voucher = await closingService.calculateDepreciation(companyId, year, month);
        
        // Hämta detaljerad rapport
        const assets = await depreciationEngine.getAssets(companyId, year);
        
        return NextResponse.json({
          success: true,
          voucher,
          assetCount: assets.length,
          totalBookValue: assets.reduce((sum, a) => sum + a.currentBookValue, 0),
        });
      }

      case 'calculate-tax': {
        // Beräkna skatt
        const periodData = await closingService.getPeriodData(companyId, year, month);
        
        // Hämta YTD-data
        let ytdIncome = 0;
        let ytdExpenses = 0;
        
        for (let m = 1; m <= month; m++) {
          const pd = await closingService.getPeriodData(companyId, year, m);
          ytdIncome += pd.income;
          ytdExpenses += pd.expenses;
        }
        
        const taxResult = taxCalculator.calculateTax({
          revenue: ytdIncome,
          operatingExpenses: ytdExpenses,
          depreciation: 0,
          financialIncome: 0,
          financialExpenses: 0,
          nonDeductibleExpenses: 0,
          nonTaxableIncome: 0,
          previousYearLoss: 0,
          isYearEnd: month === 12,
          monthsInPeriod: month,
        });
        
        const voucher = taxCalculator.generateTaxVoucher(taxResult, year, month, month === 12);
        const report = taxCalculator.generateTaxReport(taxResult, year);
        
        return NextResponse.json({
          success: true,
          voucher,
          taxResult,
          report,
        });
      }

      case 'generate-balance-sheet': {
        // Generera balansräkning
        const company = getCompanyById(companyId);
        const companyName = body.companyName || company?.name || 'Ditt Bolag AB';
        const balanceSheet = await closingReporter.generateBalanceSheet(
          companyId,
          companyName,
          year,
          month
        );
        
        return NextResponse.json({
          success: true,
          report: balanceSheet,
        });
      }

      case 'generate-income-statement': {
        // Generera resultaträkning
        const company = getCompanyById(companyId);
        const companyName = body.companyName || company?.name || 'Ditt Bolag AB';
        const incomeStatement = await closingReporter.generateIncomeStatement(
          companyId,
          companyName,
          year,
          month
        );
        
        return NextResponse.json({
          success: true,
          report: incomeStatement,
        });
      }

      case 'generate-trial-balance': {
        // Generera huvudbok/råbalans
        const company = getCompanyById(companyId);
        const companyName = body.companyName || company?.name || 'Ditt Bolag AB';
        const trialBalance = await closingReporter.generateTrialBalance(
          companyId,
          companyName,
          year,
          month
        );
        
        return NextResponse.json({
          success: true,
          report: trialBalance,
        });
      }

      case 'generate-sie': {
        // Generera SIE-export
        const company = getCompanyById(companyId);
        const companyName = body.companyName || company?.name || 'Ditt Bolag AB';
        const orgNumber = body.orgNumber || company?.orgNumber || '556123-4567';
        
        const sieContent = await closingReporter.generateSIEExport(
          companyId,
          companyName,
          orgNumber,
          year,
          month
        );
        
        return new NextResponse(sieContent, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="export_${year}_${month}.se"`,
          },
        });
      }

      case 'get-depreciation-assets': {
        // Hämta anläggningstillgångar
        const assets = await depreciationEngine.getAssets(companyId, year);
        
        return NextResponse.json({
          success: true,
          assets,
          summary: {
            totalAcquisitionValue: assets.reduce((sum, a) => sum + a.acquisitionValue, 0),
            totalBookValue: assets.reduce((sum, a) => sum + a.currentBookValue, 0),
            totalAccumulatedDepreciation: assets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0),
            monthlyDepreciation: assets.reduce((sum, a) => sum + a.monthlyDepreciation, 0),
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[API] Closing POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process closing request' },
      { status: 500 }
    );
  }
}
