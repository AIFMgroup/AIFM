/**
 * CRM Companies API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { crmCompanyStore } from '@/lib/crm/store';
import { verifyIdToken } from '@/lib/auth/tokens';

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  
  try {
    const payload = await verifyIdToken(token);
    return {
      sub: payload.sub as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

// GET /api/crm/companies?companyId=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const crmCompanyId = searchParams.get('id');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    if (crmCompanyId) {
      const company = await crmCompanyStore.get(crmCompanyId);
      if (!company || company.companyId !== companyId) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
      }
      return NextResponse.json(company);
    }

    const companies = await crmCompanyStore.list(companyId);
    return NextResponse.json(companies);
  } catch (error) {
    console.error('[CRM API] Companies GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/companies
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { companyId, ...data } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const company = await crmCompanyStore.create(companyId, data, user.sub || user.email || 'system');
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    console.error('[CRM API] Companies POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/crm/companies
export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, companyId, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const existing = await crmCompanyStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    await crmCompanyStore.update(id, updates, user.sub || user.email || 'system');
    const updated = await crmCompanyStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Companies PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/companies?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  try {
    await crmCompanyStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRM API] Companies DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
