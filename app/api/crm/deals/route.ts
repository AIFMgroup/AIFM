/**
 * CRM Deals API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { dealStore } from '@/lib/crm/store';
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

// GET /api/crm/deals?companyId=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const dealId = searchParams.get('id');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    if (dealId) {
      const deal = await dealStore.get(dealId);
      if (!deal || deal.companyId !== companyId) {
        return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
      }
      return NextResponse.json(deal);
    }

    const deals = await dealStore.list(companyId);
    return NextResponse.json(deals);
  } catch (error) {
    console.error('[CRM API] Deals GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/deals
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

    const deal = await dealStore.create(companyId, data, user.sub || user.email || 'system');
    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error('[CRM API] Deals POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/crm/deals
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

    const existing = await dealStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    await dealStore.update(id, updates, user.sub || user.email || 'system');
    const updated = await dealStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Deals PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/crm/deals - Stage update (for drag-drop)
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, stage, companyId } = body;

    if (!id || !stage) {
      return NextResponse.json({ error: 'id and stage required' }, { status: 400 });
    }

    const existing = await dealStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    await dealStore.updateStage(id, stage, user.sub || user.email || 'system');
    const updated = await dealStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Deals PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/deals?id=xxx
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
    await dealStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRM API] Deals DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
