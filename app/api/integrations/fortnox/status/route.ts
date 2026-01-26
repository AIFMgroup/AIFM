import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fortnoxTokenStore } from '@/lib/fortnox/tokenStore';
import { fortnoxBootstrapStore } from '@/lib/fortnox/bootstrapStore';

/**
 * GET /api/integrations/fortnox/status?companyId=xxx
 *
 * Mirrors the legacy /api/fortnox/status endpoint, but under /api/integrations/*
 * to avoid CloudFront routing conflicts in production.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    const connection = await fortnoxTokenStore.getConnection(companyId);
    const bootstrap = await fortnoxBootstrapStore.getState(companyId);

    return NextResponse.json({
      connected: connection.connected,
      connectedAt: connection.connectedAt,
      fortnoxCompanyName: connection.fortnoxCompanyName,
      fortnoxCompanyId: connection.fortnoxCompanyId,
      lastSync: connection.lastSync,
      lastError: connection.lastError,
      revokedAt: connection.revokedAt,
      bootstrapStatus: bootstrap.status,
      bootstrapStartedAt: bootstrap.startedAt,
      bootstrapFinishedAt: bootstrap.finishedAt,
      bootstrapLastError: bootstrap.lastError,
      bootstrapStats: bootstrap.stats,
    });
  } catch (error) {
    console.error('[Fortnox] Integrations status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}


