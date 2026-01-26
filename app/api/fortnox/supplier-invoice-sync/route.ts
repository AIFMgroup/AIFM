import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { syncSupplierInvoiceStatus } from '@/lib/fortnox/supplierInvoiceSync';

/**
 * POST /api/fortnox/supplier-invoice-sync
 * Body: { companyId: string, jobId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const companyId = body?.companyId as string | undefined;
    const jobId = body?.jobId as string | undefined;

    if (!companyId || !jobId) {
      return NextResponse.json({ error: 'companyId and jobId are required' }, { status: 400 });
    }

    const res = await syncSupplierInvoiceStatus(companyId, jobId);
    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: res.status });
  } catch (error) {
    console.error('[Fortnox] Supplier invoice sync error:', error);
    return NextResponse.json({ error: 'Failed to sync supplier invoice status' }, { status: 500 });
  }
}


