/**
 * Test Secura Connection
 * 
 * Testar att vi kan ansluta till Secura API
 */

import { NextRequest, NextResponse } from 'next/server';
import { SecuraClient } from '@/lib/integrations/secura';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Tillåt override av credentials för testning
    const {
      host = process.env.SECURA_HOST || '194.62.154.68',
      port = parseInt(process.env.SECURA_API_PORT || '20023'),
      username = process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
      password = body.password || process.env.SECURA_PASSWORD,
    } = body;

    if (!password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Password required',
          message: 'Please provide password in request body or set SECURA_PASSWORD env var',
        },
        { status: 400 }
      );
    }

    const client = new SecuraClient({
      environment: 'test',
      host,
      port,
      username,
      password,
    });

    console.log(`[Secura Test] Attempting connection to ${host}:${port}...`);
    
    const startTime = Date.now();
    const connected = await client.testConnection();
    const duration = Date.now() - startTime;

    if (connected) {
      // Försök hämta lite data för att verifiera
      let funds = [];
      try {
        funds = await client.getFunds();
      } catch {
        // Ignore - just testing connection
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully connected to Secura API',
        connection: {
          host,
          port,
          username,
          responseTime: `${duration}ms`,
        },
        data: {
          fundsFound: funds.length,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Connection failed',
        message: 'Could not authenticate with Secura API',
        connection: {
          host,
          port,
          username,
          responseTime: `${duration}ms`,
        },
      }, { status: 401 });
    }

  } catch (error) {
    console.error('[Secura Test] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
    const isNetworkError = errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED');

    return NextResponse.json({
      success: false,
      error: 'Connection failed',
      message: errorMessage,
      hint: isTimeout 
        ? 'Connection timed out - check if your IP is whitelisted'
        : isNetworkError 
        ? 'Network error - check host/port and network access'
        : 'Check credentials and try again',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/nav-automation/test-connection',
    method: 'POST',
    description: 'Test connection to Secura API',
    body: {
      host: 'optional - defaults to env var or 194.62.154.68',
      port: 'optional - defaults to env var or 20023',
      username: 'optional - defaults to env var or RESTAPI_AIFM',
      password: 'required - Secura password',
    },
  });
}
