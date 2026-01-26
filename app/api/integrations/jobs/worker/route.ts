import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRoleFromRequest, can } from '@/lib/accounting/authz';
import {
  claimJob,
  completeJob,
  failJob,
  listDueJobs,
  type IntegrationJob,
} from '@/lib/integrations/jobQueue';

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-aifm-cron-secret');
  return !!header && header === secret;
}

async function isAuthedUser(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get('__Host-aifm_id_token')?.value;
}

async function processJob(job: IntegrationJob): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  switch (job.type) {
    case 'TINK_WEBHOOK_EVENT': {
      // Skeleton: accept + store + mark done. Real Tink pipeline will parse and enqueue follow-up jobs.
      return { ok: true, result: { handled: true } };
    }
    default:
      return { ok: false, error: `Unsupported job type: ${job.type}` };
  }
}

/**
 * POST /api/integrations/jobs/worker
 * Body: { companyId: string, limit?: number }
 *
 * Can be triggered by:
 * - authenticated user (accountant+)
 * - cron secret header (EventBridge/Lambda)
 */
export async function POST(request: NextRequest) {
  try {
    const cronOk = isAuthorizedCron(request);
    const authed = await isAuthedUser(request);
    if (!cronOk && !authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (authed) {
      const role = getRoleFromRequest(request);
      if (!can(role, 'SEND_TO_FORTNOX')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const companyId = typeof body?.companyId === 'string' ? body.companyId : null;
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const limitRaw = body?.limit;
    const limit = Math.min(
      Math.max(typeof limitRaw === 'number' ? limitRaw : parseInt(String(limitRaw ?? '10'), 10) || 10, 1),
      50
    );

    const queued = await listDueJobs(companyId, 'queued', limit);
    const failed = queued.length < limit ? await listDueJobs(companyId, 'failed', limit - queued.length) : [];
    const candidates = [...queued, ...failed];

    const claimedBy = cronOk ? 'cron' : `user:${getRoleFromRequest(request)}`;
    const results: Array<{ jobId: string; type: string; success: boolean; error?: string; skipped?: boolean }> = [];

    for (const job of candidates) {
      const ok = await claimJob(companyId, job.id, claimedBy, 60_000);
      if (!ok) {
        results.push({ jobId: job.id, type: job.type, success: false, skipped: true, error: 'Not claimable' });
        continue;
      }

      try {
        const res = await processJob(job);
        if (res.ok) {
          await completeJob(companyId, job.id, res.result);
          results.push({ jobId: job.id, type: job.type, success: true });
        } else {
          await failJob(companyId, job.id, res.error || 'Unknown error');
          results.push({ jobId: job.id, type: job.type, success: false, error: res.error || 'Unknown error' });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        await failJob(companyId, job.id, msg);
        results.push({ jobId: job.id, type: job.type, success: false, error: msg });
      }
    }

    return NextResponse.json({
      companyId,
      processed: candidates.length,
      success: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      results,
    });
  } catch (e) {
    console.error('[IntegrationsJobsWorker] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


