import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';
import { validateClassification } from '@/lib/accounting/services/validationService';
import { listPostingRecords } from '@/lib/fortnox/postingQueueStore';
import { getPendingApprovals } from '@/lib/accounting/services/approvalWorkflow';
import { getRoleFromRequest } from '@/lib/accounting/authz';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

    // Role is derived by middleware from a verified token (Cognito groups).
    // Do NOT trust client-provided query params for authorization.
    const role = getRoleFromRequest(request);

    const [jobs, postingRecords, pendingApprovals] = await Promise.all([
      jobStore.getByCompany(companyId),
      listPostingRecords(companyId, 500),
      getPendingApprovals(companyId, role),
    ]);

    const reviewJobs = jobs
      .filter(j => ['ready', 'error'].includes(j.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const fortnoxIssues = postingRecords
      .filter(r => r.status === 'error' || r.status === 'dead_letter')
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));

    const items = reviewJobs.map(job => {
      const classification = job.classification;
      const validation = classification ? validateClassification(classification) : null;
      const hasCriticalValidation = !!validation?.errors?.some(e => e.severity === 'critical');
      const hasPolicyBlock = !!classification?.policy?.violations?.some(v => v.severity === 'error');
      const hasFx = !!classification?.originalCurrency && classification.originalCurrency !== 'SEK';
      const hasFxMissing = !!classification?.currency && classification.currency !== 'SEK';

      return {
        job,
        flags: {
          hasCriticalValidation,
          hasPolicyBlock,
          hasFx,
          hasFxMissing,
        },
        validation,
      };
    });

    const summary = {
      totalJobs: jobs.length,
      needsReview: items.filter(i => i.job.status === 'ready').length,
      errors: items.filter(i => i.job.status === 'error').length,
      needsApproval: pendingApprovals.length,
      fortnoxIssues: fortnoxIssues.length,
      ocrFailures: jobs.filter(j => j.status === 'error' && (j.error || '').toLowerCase().includes('ocr')).length,
    };

    return NextResponse.json({
      companyId,
      summary,
      review: items,
      approvals: pendingApprovals,
      fortnoxIssues,
    });
  } catch (error) {
    console.error('[AccountingInbox] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


