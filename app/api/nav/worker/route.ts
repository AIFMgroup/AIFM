/**
 * NAV Daily Worker – full pipeline for scheduled NAV run
 *
 * POST /api/nav/worker
 * Body: { navDate?: string, skipSebSync?: boolean }
 *
 * Intended to be triggered by AWS EventBridge (cron 15:00 CET).
 * 1) Sync positions/cash from SEB Custody (if configured)
 * 2) Run NAV calculation (prices from LSEG/fund_registry, FX from ECB)
 * 3) Persist run and NAV records, create approval request
 *
 * Auth: x-aifm-cron-secret header (AIFM_CRON_SECRET) or authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { syncSEBCustodyToRegistry } from '@/lib/integrations/bank/seb-sync-service';
import { getNAVScheduler } from '@/lib/nav-engine/scheduler';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-aifm-cron-secret') || request.headers.get('x-cron-secret');
  return !!header && header === secret;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cronOk = isAuthorizedCron(request);
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!cronOk && !authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { navDate?: string; skipSebSync?: boolean };
    const navDate = typeof body?.navDate === 'string' && body.navDate ? body.navDate : undefined;
    const skipSebSync = !!body?.skipSebSync;

    const result: {
      success: boolean;
      navDate: string;
      sebSync?: { fundsSynced: number; positionsWritten: number; cashBalancesWritten: number; errors: string[] };
      run?: {
        runId: string;
        status: string;
        completedFunds: number;
        failedFunds: number;
        totalFunds: number;
        errors?: string[];
      };
      error?: string;
      timestamp: string;
    } = {
      success: false,
      navDate: navDate ?? new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    };

    // Step 0: Sync fund registry from ISEC SECURA
    try {
      const { syncFundRegistryFromISEC } = await import('@/lib/integrations/isec/isec-data-service');
      const isecSync = await syncFundRegistryFromISEC();
      (result as Record<string, unknown>).isecSync = isecSync;
    } catch (isecErr) {
      console.warn('[NAV Worker] ISEC sync failed (non-fatal):', isecErr);
    }

    if (!skipSebSync) {
      const sebResult = await syncSEBCustodyToRegistry(result.navDate);
      result.sebSync = {
        fundsSynced: sebResult.fundsSynced,
        positionsWritten: sebResult.positionsWritten,
        cashBalancesWritten: sebResult.cashBalancesWritten,
        errors: sebResult.errors,
      };
    }

    const scheduler = getNAVScheduler();
    const run = await scheduler.executeScheduledRun(result.navDate);

    result.run = {
      runId: run.runId,
      status: run.status,
      completedFunds: run.completedFunds,
      failedFunds: run.failedFunds,
      totalFunds: run.totalFunds,
      errors: run.errors?.length ? run.errors : undefined,
    };
    result.success = run.status !== 'FAILED' && run.failedFunds === 0;

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[NAV Worker]', err);
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
