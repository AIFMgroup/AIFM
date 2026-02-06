/**
 * NAV Calculation API
 * 
 * Endpoint för att beräkna NAV
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNAVService } from '@/lib/nav-engine/nav-service';
import { createSecuraClient } from '@/lib/integrations/secura/secura-client';
import { SecuraConfig } from '@/lib/integrations/secura/types';

// ============================================================================
// POST - Calculate NAV
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundId, shareClassId, navDate, securaConfig } = body;

    // Validate required fields
    if (!fundId || !shareClassId) {
      return NextResponse.json(
        { success: false, error: 'fundId and shareClassId are required' },
        { status: 400 }
      );
    }

    // Get SECURA config from request or environment
    const config: SecuraConfig = securaConfig || {
      host: process.env.SECURA_HOST || '194.62.154.68',
      port: parseInt(process.env.SECURA_PORT || '20023', 10),
      username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
      password: process.env.SECURA_PASSWORD || '',
    };

    if (!config.password) {
      return NextResponse.json(
        { success: false, error: 'SECURA password not configured' },
        { status: 500 }
      );
    }

    // Create SECURA client and NAV service
    const securaClient = createSecuraClient(config);
    const navService = createNAVService(securaClient);

    // Calculate NAV
    const date = navDate || new Date().toISOString().split('T')[0];
    const result = await navService.calculateNAV(fundId, shareClassId, date);

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('[NAV Calculate API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate NAV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Calculate NAV for all funds (daily run)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get SECURA config from environment
    const config: SecuraConfig = {
      host: process.env.SECURA_HOST || '194.62.154.68',
      port: parseInt(process.env.SECURA_PORT || '20023', 10),
      username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
      password: process.env.SECURA_PASSWORD || '',
    };

    if (!config.password) {
      return NextResponse.json(
        { success: false, error: 'SECURA password not configured' },
        { status: 500 }
      );
    }

    // Create SECURA client and NAV service
    const securaClient = createSecuraClient(config);
    const navService = createNAVService(securaClient);

    // Run daily NAV
    const run = await navService.runDailyNAV(navDate);

    // Convert Map to object for JSON serialization
    const results: Record<string, unknown> = {};
    run.fundResults.forEach((value, key) => {
      results[key] = value;
    });

    return NextResponse.json({
      success: run.status !== 'FAILED',
      run: {
        ...run,
        fundResults: results,
      },
    });

  } catch (error) {
    console.error('[NAV Calculate API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to run daily NAV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
