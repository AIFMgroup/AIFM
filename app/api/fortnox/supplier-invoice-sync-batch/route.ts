import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';
import { syncSupplierInvoiceStatus } from '@/lib/fortnox/supplierInvoiceSync';

/**
 * POST /api/fortnox/supplier-invoice-sync-batch
 * Body:
 * {
 *   companyId: string,
 *   jobIds?: string[],
 *   limit?: number,
 *   minStaleMinutes?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const companyId = body?.companyId as string | undefined;
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const limit = Math.min(Math.max(parseInt(String(body?.limit ?? '25'), 10) || 25, 1), 100);
    const minStaleMinutes = Math.min(Math.max(parseInt(String(body?.minStaleMinutes ?? '10'), 10) || 10, 0), 7 * 24 * 60);
    const jobIds = (Array.isArray(body?.jobIds) ? body.jobIds : undefined) as string[] | undefined;

    const now = Date.now();
    const isStale = (last?: string) => {
      if (!last) return true;
      const t = new Date(last).getTime();
      if (isNaN(t)) return true;
      return (now - t) / 60000 >= minStaleMinutes;
    };

    let targets: string[] = [];
    if (jobIds?.length) {
      targets = jobIds.slice(0, limit);
    } else {
      const jobs = await jobStore.getByCompany(companyId);
      targets = jobs
        .filter(j => !!j.fortnoxInvoiceId)
        .filter(j => isStale(j.fortnoxInvoiceStatus?.lastSyncedAt))
        .slice(0, limit)
        .map(j => j.id);
    }

    const results: Array<{ jobId: string; success: boolean; error?: string }> = [];
    for (const jobId of targets) {
      const res = await syncSupplierInvoiceStatus(companyId, jobId);
      results.push({ jobId, success: res.success, error: res.success ? undefined : res.error });
    }

    return NextResponse.json({
      success: true,
      synced: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    console.error('[Fortnox] Supplier invoice sync batch error:', error);
    return NextResponse.json({ error: 'Failed to sync supplier invoice statuses' }, { status: 500 });
  }
}


