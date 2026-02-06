/**
 * Test Fund Registry Connection
 * 
 * Verifierar att fondregistret fungerar korrekt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';

export async function POST(request: NextRequest) {
  try {
    const registry = getFundRegistry();
    const startTime = Date.now();
    
    // Test by fetching funds
    const funds = await registry.listFunds();
    const duration = Date.now() - startTime;

    // Get share classes count
    const shareClasses = await registry.listShareClasses();

    return NextResponse.json({
      success: true,
      message: 'Fund Registry is operational',
      connection: {
        status: 'active',
        responseTime: `${duration}ms`,
      },
      data: {
        fundsRegistered: funds.length,
        shareClassesRegistered: shareClasses.length,
        funds: funds.map(f => ({
          id: f.id,
          name: f.name,
          isin: f.isin,
          status: f.status,
        })),
      },
    });

  } catch (error) {
    console.error('[Fund Registry Test] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({
      success: false,
      error: 'Registry check failed',
      message: errorMessage,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/nav-automation/test-connection',
    method: 'POST',
    description: 'Test Fund Registry status',
    note: 'No parameters required - tests the internal fund registry',
  });
}
