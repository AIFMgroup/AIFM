import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fortnoxTokenStore } from '@/lib/fortnox/tokenStore';
import { fortnoxBootstrapStore } from '@/lib/fortnox/bootstrapStore';
import { bootstrapFortnoxCompany } from '@/lib/fortnox/bootstrap';
import { logAudit, createAuditContext } from '@/lib/accounting/auditLogger';

/**
 * GET /api/fortnox/bootstrap?companyId=xxx
 * Returnerar bootstrap-status och statistik.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

    const state = await fortnoxBootstrapStore.getState(companyId);
    return NextResponse.json(state);
  } catch (error) {
    console.error('[Fortnox] Bootstrap status error:', error);
    return NextResponse.json({ error: 'Failed to get bootstrap status' }, { status: 500 });
  }
}

/**
 * POST /api/fortnox/bootstrap?companyId=xxx
 * Startar bootstrap (kontoplan, dimensioner, leverantörer, artiklar) så att bolaget blir "redo".
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

    const connection = await fortnoxTokenStore.getConnection(companyId);
    if (!connection.connected) {
      return NextResponse.json({ error: 'Fortnox not connected' }, { status: 400 });
    }

    const current = await fortnoxBootstrapStore.getState(companyId);
    if (current.status === 'running') {
      return NextResponse.json(current);
    }

    await logAudit({
      companyId,
      action: 'FORTNOX_SYNC_STARTED',
      resourceType: 'fortnox',
      details: { type: 'bootstrap' },
      success: true,
      ...createAuditContext(request),
    });

    // Kör bootstrap synkront (kan ta några sekunder). UI kan polla GET.
    await bootstrapFortnoxCompany(companyId, { includeSuppliers: true, includeArticles: true });
    const after = await fortnoxBootstrapStore.getState(companyId);

    if (after.status === 'ready') {
      await logAudit({
        companyId,
        action: 'FORTNOX_SYNC_COMPLETED',
        resourceType: 'fortnox',
        details: { type: 'bootstrap', stats: after.stats },
        success: true,
        ...createAuditContext(request),
      });
    } else if (after.status === 'error') {
      await logAudit({
        companyId,
        action: 'FORTNOX_SYNC_FAILED',
        resourceType: 'fortnox',
        details: { type: 'bootstrap', stats: after.stats },
        success: false,
        errorMessage: after.lastError || 'Bootstrap failed',
        ...createAuditContext(request),
      });
    }

    return NextResponse.json(after);
  } catch (error) {
    console.error('[Fortnox] Bootstrap start error:', error);
    return NextResponse.json({ error: 'Failed to bootstrap Fortnox' }, { status: 500 });
  }
}


