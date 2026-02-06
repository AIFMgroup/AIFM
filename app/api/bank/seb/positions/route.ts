/**
 * API: SEB Custody Positions
 * 
 * Hämtar custody-positioner från SEB Global Custody API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSEBClient, SEBCustodyPosition } from '@/lib/integrations/bank/seb-client';

export const dynamic = 'force-dynamic';

interface PositionsResponse {
  success: boolean;
  positions: SEBCustodyPosition[];
  accountId?: string;
  totalMarketValue: number;
  currency: string;
  timestamp: string;
  error?: string;
}

/**
 * GET /api/bank/seb/positions
 * Query params:
 * - accountId: SEB custody account ID (optional, returns all if not specified)
 */
export async function GET(request: NextRequest): Promise<NextResponse<PositionsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || undefined;
    
    console.log('[SEB API] Fetching positions for account:', accountId || 'all');
    
    const client = getSEBClient();
    const positions = await client.getCustodyPositions(accountId);
    
    // Calculate totals
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const currency = positions[0]?.currency || 'SEK';
    
    return NextResponse.json({
      success: true,
      positions,
      accountId: accountId || undefined,
      totalMarketValue,
      currency,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[SEB API] Error fetching positions:', error);
    
    return NextResponse.json(
      {
        success: false,
        positions: [],
        totalMarketValue: 0,
        currency: 'SEK',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
