import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';
import { listPostingRecords } from '@/lib/fortnox/postingQueueStore';
import { getPendingApprovals } from '@/lib/accounting/services/approvalWorkflow';
import { getAllPeriods } from '@/lib/accounting/services/periodClosingService';
import { generateReconciliationSummary } from '@/lib/accounting/services/bankMatchingService';
import { paymentService } from '@/lib/accounting/payments/paymentService';
import { skatteverketSubmissionStore } from '@/lib/accounting/integrations/skatteverketSubmissionStore';
import { listIntegrationJobs } from '@/lib/integrations/jobQueue';

/**
 * Lightweight operational metrics for monitoring dashboards/alerts.
 * GET /api/accounting/ops/metrics?companyId=...
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

    const [jobs, postingRecords, approvals, paymentSummary, skvSubmissions] = await Promise.all([
      jobStore.getByCompany(companyId),
      listPostingRecords(companyId, 1000),
      getPendingApprovals(companyId),
      paymentService.getPaymentSummary(companyId).catch(() => null),
      skatteverketSubmissionStore.list(companyId).catch(() => []),
    ]);

    const integrationJobs = await listIntegrationJobs(companyId, 500).catch(() => []);
    const integrationJobCounts: Record<string, number> = {};
    for (const j of integrationJobs) integrationJobCounts[j.status] = (integrationJobCounts[j.status] || 0) + 1;

    const statusCounts: Record<string, number> = {};
    for (const j of jobs) statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;

    const postingCounts: Record<string, number> = {};
    for (const r of postingRecords) postingCounts[r.status] = (postingCounts[r.status] || 0) + 1;

    const fortnoxFailures = postingRecords.filter(r => r.status === 'error' || r.status === 'dead_letter');
    const ocrFailures = jobs.filter(j => j.status === 'error' && (j.error || '').toLowerCase().includes('ocr'));

    // Period KPIs
    const periods = await getAllPeriods(companyId).catch(() => []);
    const periodCounts: Record<string, number> = {};
    for (const p of periods) periodCounts[p.status] = (periodCounts[p.status] || 0) + 1;

    // Bank match KPIs (current month)
    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const bank = await generateReconciliationSummary(companyId, year, month).catch(() => null);

    const skvCounts: Record<string, number> = {};
    for (const s of skvSubmissions) {
      const status = (s as { status?: unknown })?.status;
      const key = typeof status === 'string' ? status : 'unknown';
      skvCounts[key] = (skvCounts[key] || 0) + 1;
    }

    return NextResponse.json({
      companyId,
      generatedAt: new Date().toISOString(),
      jobs: {
        total: jobs.length,
        byStatus: statusCounts,
        ocrFailures: ocrFailures.length,
        processingFailures: statusCounts.error || 0,
      },
      approvals: {
        pending: approvals.length,
      },
      periods: {
        total: periods.length,
        byStatus: periodCounts,
        locked: periodCounts.LOCKED || 0,
        closed: periodCounts.CLOSED || 0,
        open: periodCounts.OPEN || 0,
      },
      bank: bank
        ? {
            year,
            month,
            totalTransactions: bank.totalTransactions,
            matchedCount: bank.matchedCount,
            unmatchedCount: bank.unmatchedCount,
            matchRate: bank.totalTransactions > 0 ? bank.matchedCount / bank.totalTransactions : 1,
          }
        : { year, month, error: 'bank_summary_unavailable' },
      fortnox: {
        postingQueueByStatus: postingCounts,
        failures: fortnoxFailures.length,
        deadLetters: postingCounts.dead_letter || 0,
      },
      integrations: {
        jobs: {
          total: integrationJobs.length,
          byStatus: integrationJobCounts,
          deadLetters: integrationJobCounts.dead_letter || 0,
        },
      },
      payments: paymentSummary
        ? paymentSummary
        : { error: 'payment_summary_unavailable' },
      skatteverket: {
        submissionsByStatus: skvCounts,
        queued: skvCounts.queued || 0,
        failed: skvCounts.failed || 0,
      },
    });
  } catch (error) {
    console.error('[OpsMetrics] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


