/**
 * API: SEB Connection Test
 * 
 * Testar anslutningen till SEB API
 */

import { NextResponse } from 'next/server';
import { getSEBClient } from '@/lib/integrations/bank/seb-client';

export const dynamic = 'force-dynamic';

interface ConnectionTestResponse {
  connected: boolean;
  message: string;
  details?: {
    tokenValid: boolean;
    accountsAccessible: boolean;
    custodyAccessible: boolean;
  };
  isMockClient: boolean;
  timestamp: string;
}

/**
 * GET /api/bank/seb/test-connection
 * Tests connection to SEB API
 */
export async function GET(): Promise<NextResponse<ConnectionTestResponse>> {
  try {
    console.log('[SEB API] Testing connection...');
    
    const client = getSEBClient();
    const result = await client.testConnection();
    
    // Check if using mock client
    const isMockClient = !process.env.SEB_CLIENT_ID || process.env.NODE_ENV === 'development';
    
    return NextResponse.json({
      ...result,
      isMockClient,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[SEB API] Connection test failed:', error);
    
    return NextResponse.json(
      {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
        isMockClient: true,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
