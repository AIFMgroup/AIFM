import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listPostingRecords } from '@/lib/fortnox/postingQueueStore';
import { jobStore } from '@/lib/accounting/jobStore';
import { sendToFortnox } from '@/lib/fortnox/voucherService';
import { getRoleFromRequest } from '@/lib/accounting/authz';
import { createAuditContext } from '@/lib/accounting/auditLogger';
import { getSession } from '@/lib/auth/session';
import { transactionAudit } from '@/lib/accounting/transactionAudit';

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-aifm-cron-secret');
  return !!header && header === secret;
}

/**
 * POST /api/fortnox/posting-queue/worker
 * Body: { companyId: string, limit?: number }
 *
 * Intended to be triggered by EventBridge/Lambda or manually.
 * Uses the same idempotency/backoff rules as sendToFortnox().
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const runId = `fortnox-queue-run-${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    const cronOk = isAuthorizedCron(request);
    if (!token && !cronOk) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // RBAC hook: currently allow all authenticated roles (and cron), but keep role available for audit + future hardening.
    const role = getRoleFromRequest(request);
    const session = cronOk ? null : await getSession().catch(() => null);
    const auditContext = createAuditContext(
      request,
      cronOk ? 'cron' : (session?.email || 'user'),
      cronOk ? undefined : session?.email
    );

    const body = await request.json();
    const companyId = body?.companyId as string | undefined;
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const limit = Math.min(Math.max(parseInt(String(body?.limit ?? '10'), 10) || 10, 1), 50);

    const records = await listPostingRecords(companyId, 500);
    const now = Date.now();
    const eligible = records
      .filter(r => r.status === 'pending' || r.status === 'error')
      .filter(r => {
        if (r.status === 'pending') return true;
        if (!r.nextRetryAt) return true;
        const t = new Date(r.nextRetryAt).getTime();
        return isNaN(t) || t <= now;
      })
      .sort((a, b) => (a.nextRetryAt || a.createdAt).localeCompare(b.nextRetryAt || b.createdAt))
      .slice(0, limit);

    const results: Array<{ jobId: string; success: boolean; skipped?: boolean; error?: string }> = [];
    for (const rec of eligible) {
      const job = await jobStore.get(rec.jobId);
      if (!job || job.companyId !== companyId) {
        results.push({ jobId: rec.jobId, success: false, skipped: true, error: 'Job not found or company mismatch' });
        continue;
      }
      if (job.status !== 'approved' && job.status !== 'ready') {
        results.push({ jobId: rec.jobId, success: false, skipped: true, error: `Job status not eligible: ${job.status}` });
        continue;
      }
      const res = await sendToFortnox(companyId, job);
      results.push({ jobId: rec.jobId, success: res.success, error: res.success ? undefined : res.error });
    }

    const responseBody = {
      companyId,
      runId,
      processed: eligible.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success && !r.skipped).length,
      skipped: results.filter(r => r.skipped).length,
      results,
    };

    // Transaction audit: one entry per run
    try {
      await transactionAudit.logChange({
        companyId,
        transactionId: runId,
        actor: {
          userId: auditContext.userId || (cronOk ? 'cron' : 'user'),
          userEmail: auditContext.userEmail,
          userName: cronOk ? 'cron' : (session?.name || undefined),
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
        changeType: 'CREATE',
        resourceType: 'settings',
        changes: [
          {
            field: 'fortnoxQueueRun',
            fieldLabel: 'Fortnox-kö körning',
            previousValue: null,
            newValue: {
              triggeredBy: cronOk ? 'cron' : 'user',
              role,
              companyId,
              limit,
              processed: responseBody.processed,
              success: responseBody.success,
              failed: responseBody.failed,
              skipped: responseBody.skipped,
              jobIds: responseBody.results.map(r => r.jobId),
              durationMs: Date.now() - startedAt,
            },
            changeSource: cronOk ? 'SYSTEM' : 'USER',
          },
        ],
        systemReason: cronOk ? 'Triggered by cron secret' : 'Triggered manually via UI/API',
        context: {
          correlationId: runId,
        },
        isAIDecision: false,
        requiresReview: false,
      });
    } catch (e) {
      console.error('[PostingWorker] Failed to write transaction audit:', e);
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('[PostingWorker] Error:', error);
    // Best-effort audit of failed run (if we can infer companyId from body)
    try {
      const body = await request.clone().json().catch(() => null);
      const companyId = (body as any)?.companyId as string | undefined;
      if (companyId) {
        const cronOk = isAuthorizedCron(request);
        const role = getRoleFromRequest(request);
        const session = cronOk ? null : await getSession().catch(() => null);
        const auditContext = createAuditContext(
          request,
          cronOk ? 'cron' : (session?.email || 'user'),
          cronOk ? undefined : session?.email
        );
        await transactionAudit.logChange({
          companyId,
          transactionId: runId,
          actor: {
            userId: auditContext.userId || (cronOk ? 'cron' : 'user'),
            userEmail: auditContext.userEmail,
            userName: cronOk ? 'cron' : (session?.name || undefined),
            ipAddress: auditContext.ipAddress,
            userAgent: auditContext.userAgent,
          },
          changeType: 'CREATE',
          resourceType: 'settings',
          changes: [
            {
              field: 'fortnoxQueueRun',
              fieldLabel: 'Fortnox-kö körning',
              previousValue: null,
              newValue: {
                triggeredBy: cronOk ? 'cron' : 'user',
                role,
                companyId,
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startedAt,
              },
              changeSource: cronOk ? 'SYSTEM' : 'USER',
            },
          ],
          systemReason: 'Worker failed',
          context: { correlationId: runId },
          isAIDecision: false,
          requiresReview: false,
        });
      }
    } catch (e) {
      console.error('[PostingWorker] Failed to write failure transaction audit:', e);
    }
    return NextResponse.json({ error: 'Failed to process posting queue' }, { status: 500 });
  }
}


