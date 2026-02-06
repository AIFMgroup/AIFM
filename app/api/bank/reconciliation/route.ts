/**
 * API: Bank Reconciliation
 * 
 * Utför NAV-avstämning mellan Secura och bank (SEB/Swedbank)
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getReconciliationEngine, 
  ReconciliationResult 
} from '@/lib/integrations/bank/reconciliation-engine';
import { SwedBankCustodyReport } from '@/lib/integrations/bank/swedbank-pdf-processor';

export const maxDuration = 60; // 1 minute timeout
export const dynamic = 'force-dynamic';

interface ReconciliationRequest {
  fundId: string;
  bankType: 'SEB' | 'SWEDBANK';
  date?: string;
  // For SEB
  sebAccountId?: string;
  // For Swedbank (if not using PDF upload)
  swedbankReport?: SwedBankCustodyReport;
}

interface ReconciliationResponse {
  success: boolean;
  result?: ReconciliationResult;
  error?: string;
  timestamp: string;
}

/**
 * POST /api/bank/reconciliation
 * 
 * Body:
 * - fundId: Fund ID in Secura
 * - bankType: 'SEB' or 'SWEDBANK'
 * - date: Date for reconciliation (YYYY-MM-DD)
 * - sebAccountId: SEB custody account ID (required for SEB)
 * - swedbankReport: Swedbank report data (optional, for pre-processed PDF)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ReconciliationResponse>> {
  try {
    const body: ReconciliationRequest = await request.json();
    
    const { fundId, bankType, date, sebAccountId, swedbankReport } = body;
    
    // Validate required fields
    if (!fundId) {
      return NextResponse.json(
        { success: false, error: 'fundId is required', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    
    if (!bankType || !['SEB', 'SWEDBANK'].includes(bankType)) {
      return NextResponse.json(
        { success: false, error: 'bankType must be SEB or SWEDBANK', timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }
    
    console.log('[Reconciliation API] Starting reconciliation:', { fundId, bankType, date });
    
    const engine = getReconciliationEngine();
    let result: ReconciliationResult;
    
    if (bankType === 'SEB') {
      if (!sebAccountId) {
        return NextResponse.json(
          { success: false, error: 'sebAccountId is required for SEB reconciliation', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      
      result = await engine.reconcileWithSEB(fundId, sebAccountId, date);
    } else {
      // SWEDBANK
      if (!swedbankReport) {
        return NextResponse.json(
          { success: false, error: 'swedbankReport is required for Swedbank reconciliation. Upload a PDF first.', timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      
      result = await engine.reconcileWithSwedbank(fundId, swedbankReport);
    }
    
    console.log('[Reconciliation API] Completed:', { 
      fundId, 
      status: result.summary.overallStatus,
      positions: result.summary.totalPositions,
      matching: result.summary.matchingPositions,
    });
    
    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Reconciliation API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bank/reconciliation
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    description: 'Bank Reconciliation API',
    usage: {
      method: 'POST',
      body: {
        fundId: 'Fund ID in Secura (required)',
        bankType: 'SEB or SWEDBANK (required)',
        date: 'Date for reconciliation, YYYY-MM-DD (optional, defaults to today)',
        sebAccountId: 'SEB custody account ID (required for SEB)',
        swedbankReport: 'Swedbank report data from PDF processing (required for SWEDBANK)',
      },
    },
    endpoints: {
      sebPositions: 'GET /api/bank/seb/positions',
      sebBalances: 'GET /api/bank/seb/balances',
      sebTransactions: 'GET /api/bank/seb/transactions',
      sebTestConnection: 'GET /api/bank/seb/test-connection',
      swedbankProcessPdf: 'POST /api/bank/swedbank/process-pdf',
    },
    reconciliationStatuses: {
      APPROVED: 'All positions match within thresholds',
      REVIEW_REQUIRED: 'Some discrepancies found that need review',
      FAILED: 'Major discrepancies or reconciliation failed',
    },
  });
}
