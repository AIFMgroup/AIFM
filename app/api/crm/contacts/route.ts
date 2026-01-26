/**
 * CRM Contacts API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { contactStore } from '@/lib/crm/store';
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

// GET /crm/contacts?companyId=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const contactId = searchParams.get('id');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    if (contactId) {
      const contact = await contactStore.get(contactId);
      if (!contact || contact.companyId !== companyId) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      return NextResponse.json(contact);
    }

    const contacts = await contactStore.list(companyId);
    return NextResponse.json(contacts);
  } catch (error) {
    console.error('[CRM API] Contacts GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /crm/contacts
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

    const contact = await contactStore.create(companyId, data, user.sub || user.email || 'system');
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error('[CRM API] Contacts POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /crm/contacts
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

    // Verify ownership
    const existing = await contactStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    await contactStore.update(id, updates, user.sub || user.email || 'system');
    const updated = await contactStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Contacts PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /crm/contacts?id=xxx
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
    await contactStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRM API] Contacts DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

