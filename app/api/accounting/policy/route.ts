import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAccountingPolicy, saveAccountingPolicy, AccountingPolicy } from '@/lib/accounting/services/accountingPolicyStore';

/**
 * GET /api/accounting/policy?companyId=xxx
 * PUT /api/accounting/policy?companyId=xxx  (body: partial policy)
 */

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  const policy = await getAccountingPolicy(companyId);
  return NextResponse.json({ policy });
}

export async function PUT(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  const current = await getAccountingPolicy(companyId);
  const patch = (await request.json().catch(() => ({}))) as Partial<AccountingPolicy>;

  const merged: AccountingPolicy = {
    ...current,
    ...patch,
    companyId,
    version: 1,
  };

  await saveAccountingPolicy(merged);
  return NextResponse.json({ success: true, policy: merged });
}


