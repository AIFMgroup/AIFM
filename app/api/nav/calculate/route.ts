/**
 * NAV Calculation API
 *
 * Beräknar NAV via Fund Registry + PriceProvider + CurrencyService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNAVService } from '@/lib/nav-engine/nav-service';

// ============================================================================
// POST - Calculate NAV for a single fund/share class
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundId, shareClassId, navDate } = body;

    if (!fundId || !shareClassId) {
      return NextResponse.json(
        { success: false, error: 'fundId and shareClassId are required' },
        { status: 400 }
      );
    }

    const navService = getNAVService();
    const date = navDate || new Date().toISOString().split('T')[0];
    const result = await navService.calculateNAV(fundId, shareClassId, date);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[NAV Calculate API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate NAV', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Run daily NAV for all funds
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const navService = getNAVService();
    const run = await navService.runDailyNAV(navDate);

    const results: Record<string, unknown> = {};
    run.fundResults.forEach((value, key) => {
      results[key] = value;
    });

    return NextResponse.json({
      success: run.status !== 'FAILED',
      run: { ...run, fundResults: results },
    });
  } catch (error) {
    console.error('[NAV Calculate API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run daily NAV', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
