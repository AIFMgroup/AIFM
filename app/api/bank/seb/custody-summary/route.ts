/**
 * API: SEB Custody Summary
 * 
 * Hämtar en sammanfattad custody-rapport för ett konto/fond
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSEBClient, SEBCustodyReport } from '@/lib/integrations/bank/seb-client';

export const dynamic = 'force-dynamic';

interface CustodySummaryResponse {
  success: boolean;
  report?: SEBCustodyReport;
  error?: string;
  timestamp: string;
}

/**
 * GET /api/bank/seb/custody-summary
 * Query params:
 * - accountId: SEB custody account ID (required)
 * - date: Date for the report in YYYY-MM-DD format (optional, defaults to today)
 */
export async function GET(request: NextRequest): Promise<NextResponse<CustodySummaryResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const date = searchParams.get('date') || undefined;
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }
    
    console.log('[SEB API] Fetching custody summary:', { accountId, date });
    
    const client = getSEBClient();
    const report = await client.getCustodySummary(accountId, date);
    
    return NextResponse.json({
      success: true,
      report,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[SEB API] Error fetching custody summary:', error);
    
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
