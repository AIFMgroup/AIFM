/**
 * API: SEB Custody sync to Fund Registry
 *
 * POST /api/bank/seb/sync
 * Body: { date?: string } (optional; default today)
 *
 * Requires: cron secret (x-aifm-cron-secret) or authenticated user with permission.
 * Runs syncSEBCustodyToRegistry and returns result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { syncSEBCustodyToRegistry } from '@/lib/integrations/bank/seb-sync-service';

export const dynamic = 'force-dynamic';

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-aifm-cron-secret') === secret;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cronOk = isAuthorizedCron(request);
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!cronOk && !authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { date?: string };
    const date = typeof body?.date === 'string' && body.date ? body.date : undefined;

    const result = await syncSEBCustodyToRegistry(date);
    return NextResponse.json({
      success: result.errors.length === 0,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SEB sync API]', err);
    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
