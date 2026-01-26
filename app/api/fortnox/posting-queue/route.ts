import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { listPostingRecords, enqueuePosting, retryPosting } from '@/lib/fortnox/postingQueueStore';

/**
 * Fortnox Posting Queue API (ops/debug)
 *
 * GET  /api/fortnox/posting-queue?companyId=...&status=error|dead_letter|running|pending|completed
 * POST /api/fortnox/posting-queue   { companyId, jobId, action?: 'enqueue' | 'retry' }
 */

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  const status = request.nextUrl.searchParams.get('status');
  const items = await listPostingRecords(companyId, 500);
  const filtered = status ? items.filter(i => i.status === status) : items;
  return NextResponse.json({ items: filtered, count: filtered.length });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { companyId?: string; jobId?: string; action?: 'enqueue' | 'retry' };
  
  // Support companyId from body or query param (backward compat)
  const companyId = body.companyId || request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
  if (!body.jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

  const action = body.action || 'enqueue';

  if (action === 'retry') {
    const record = await retryPosting(companyId, body.jobId);
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, record, message: 'Job queued for retry' });
  }

  // Default: enqueue
  const record = await enqueuePosting(companyId, body.jobId);
  return NextResponse.json({ success: true, record });
}


