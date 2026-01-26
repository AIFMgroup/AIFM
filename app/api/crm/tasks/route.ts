/**
 * CRM Tasks API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { taskStore } from '@/lib/crm/store';
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

// GET /api/crm/tasks?companyId=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const taskId = searchParams.get('id');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    if (taskId) {
      const task = await taskStore.get(taskId);
      if (!task || task.companyId !== companyId) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json(task);
    }

    const tasks = await taskStore.list(companyId);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('[CRM API] Tasks GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/tasks
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

    const task = await taskStore.create(companyId, data, user.sub || user.email || 'system');
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[CRM API] Tasks POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/crm/tasks
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

    const existing = await taskStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await taskStore.update(id, updates, user.sub || user.email || 'system');
    const updated = await taskStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Tasks PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/tasks?id=xxx
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
    await taskStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRM API] Tasks DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
