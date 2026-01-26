import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { 
  hasValidFortnoxConnection, 
  deleteFortnoxTokens, 
  getFortnoxTokens,
  refreshFortnoxTokensIfNeeded 
} from '@/lib/accounting/fortnoxTokenService';

interface RouteParams {
  params: Promise<Record<string, never>>;
}

/**
 * GET /api/integrations/fortnox
 * 
 * Get Fortnox connection status for current company
 */
export async function GET(request: NextRequest, {}: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Check if connection exists and is valid
    const isConnected = await hasValidFortnoxConnection(companyId);
    
    let connectionDetails = null;
    if (isConnected) {
      const tokens = await getFortnoxTokens(companyId);
      if (tokens) {
        connectionDetails = {
          connected: true,
          expiresAt: new Date(tokens.expiresAt).toISOString(),
          scope: tokens.scope,
        };
      }
    }

    return NextResponse.json({
      connected: isConnected,
      ...connectionDetails,
    });

  } catch (error) {
    console.error('[Fortnox] Get status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/fortnox
 * 
 * Initiate Fortnox OAuth flow or disconnect
 * Body: { action: 'connect' | 'disconnect', companyId: string }
 */
export async function POST(request: NextRequest, {}: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (action === 'connect') {
      // Generate OAuth authorization URL
      const authUrl = new URL('https://apps.fortnox.se/oauth-v1/auth');
      authUrl.searchParams.set('client_id', process.env.FORTNOX_CLIENT_ID!);
      authUrl.searchParams.set('redirect_uri', process.env.FORTNOX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/fortnox/callback`);
      authUrl.searchParams.set('scope', 'companyinformation bookkeeping invoice');
      authUrl.searchParams.set('state', companyId); // CSRF protection + company mapping
      authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
      authUrl.searchParams.set('response_type', 'code');

      return NextResponse.json({
        authUrl: authUrl.toString(),
      });

    } else if (action === 'disconnect') {
      // Disconnect/revoke Fortnox connection
      await deleteFortnoxTokens(companyId);

      console.log(`[Fortnox] Disconnected company ${companyId} by user ${session.email}`);

      return NextResponse.json({
        success: true,
        message: 'Fortnox connection removed',
      });

    } else if (action === 'refresh') {
      // Manually refresh token (usually auto-refreshed)
      const tokens = await refreshFortnoxTokensIfNeeded(companyId, {
        clientId: process.env.FORTNOX_CLIENT_ID!,
        clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
        companyId,
      });

      if (!tokens) {
        return NextResponse.json({
          error: 'Failed to refresh token. Please reconnect.',
        }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        expiresAt: new Date(tokens.expiresAt).toISOString(),
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "connect", "disconnect", or "refresh"' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[Fortnox] Action error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







