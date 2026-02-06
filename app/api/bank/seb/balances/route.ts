/**
 * API: SEB Account Balances
 * 
 * Hämtar kontosaldon från SEB Global Custody API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSEBClient, SEBAccountBalance } from '@/lib/integrations/bank/seb-client';

export const dynamic = 'force-dynamic';

interface BalancesResponse {
  success: boolean;
  accounts: SEBAccountBalance[];
  totalAvailableBalance: number;
  currency: string;
  timestamp: string;
  error?: string;
}

/**
 * GET /api/bank/seb/balances
 * Query params:
 * - accountIds: Comma-separated list of account IDs (optional)
 */
export async function GET(request: NextRequest): Promise<NextResponse<BalancesResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const accountIdsParam = searchParams.get('accountIds');
    const accountIds = accountIdsParam ? accountIdsParam.split(',') : undefined;
    
    console.log('[SEB API] Fetching balances for accounts:', accountIds || 'all');
    
    const client = getSEBClient();
    const accounts = await client.getAccountBalances(accountIds);
    
    // Calculate totals (only for SEK accounts)
    const sekAccounts = accounts.filter(a => a.currency === 'SEK');
    const totalAvailableBalance = sekAccounts.reduce((sum, a) => sum + a.availableBalance, 0);
    
    return NextResponse.json({
      success: true,
      accounts,
      totalAvailableBalance,
      currency: 'SEK',
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[SEB API] Error fetching balances:', error);
    
    return NextResponse.json(
      {
        success: false,
        accounts: [],
        totalAvailableBalance: 0,
        currency: 'SEK',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
