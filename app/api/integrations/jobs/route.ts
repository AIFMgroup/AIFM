import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRoleFromRequest, assertCan } from '@/lib/accounting/authz';
import { listIntegrationJobs, requeueJob } from '@/lib/integrations/jobQueue';

/**
 * GET /api/integrations/jobs?companyId=...
 * List integration jobs for a company (debug/ops).
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = getRoleFromRequest(request);
    assertCan(role, 'VIEW');

    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '200', 10) || 200, 1), 500);
    const jobs = await listIntegrationJobs(companyId, limit);

    return NextResponse.json({ companyId, count: jobs.length, jobs });
  } catch (e) {
    console.error('[IntegrationsJobs] GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/integrations/jobs
 * Body: { companyId, action: 'retry', jobId }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = getRoleFromRequest(request);
    // Only allow retry by non-auditors
    assertCan(role, 'EDIT_CLASSIFICATION');

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const companyId = typeof body?.companyId === 'string' ? body.companyId : null;
    const action = typeof body?.action === 'string' ? body.action : null;
    const jobId = typeof body?.jobId === 'string' ? body.jobId : null;

    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    if (action !== 'retry') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    await requeueJob(companyId, jobId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[IntegrationsJobs] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


