/**
 * API: SEB Transactions
 * 
 * Hämtar transaktioner från SEB Global Custody API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSEBClient, SEBTransaction } from '@/lib/integrations/bank/seb-client';

export const dynamic = 'force-dynamic';

interface TransactionsResponse {
  success: boolean;
  transactions: SEBTransaction[];
  accountId: string;
  fromDate: string;
  toDate: string;
  totalCredits: number;
  totalDebits: number;
  netFlow: number;
  timestamp: string;
  error?: string;
}

/**
 * GET /api/bank/seb/transactions
 * Query params:
 * - accountId: SEB account ID (required)
 * - fromDate: Start date in YYYY-MM-DD format (required)
 * - toDate: End date in YYYY-MM-DD format (required)
 */
export async function GET(request: NextRequest): Promise<NextResponse<TransactionsResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    
    // Validate required parameters
    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }
    
    if (!fromDate || !toDate) {
      return NextResponse.json(
        { error: 'fromDate and toDate are required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }
    
    console.log('[SEB API] Fetching transactions:', { accountId, fromDate, toDate });
    
    const client = getSEBClient();
    const transactions = await client.getTransactions(accountId, fromDate, toDate);
    
    // Calculate totals
    const totalCredits = transactions
      .filter(t => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalDebits = transactions
      .filter(t => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return NextResponse.json({
      success: true,
      transactions,
      accountId,
      fromDate,
      toDate,
      totalCredits,
      totalDebits,
      netFlow: totalCredits - totalDebits,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[SEB API] Error fetching transactions:', error);
    
    return NextResponse.json(
      {
        success: false,
        transactions: [],
        accountId: '',
        fromDate: '',
        toDate: '',
        totalCredits: 0,
        totalDebits: 0,
        netFlow: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
