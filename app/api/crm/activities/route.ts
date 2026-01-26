/**
 * CRM Activities API (Calendar events, meetings, calls, notes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { activityStore } from '@/lib/crm/store';
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

// GET /api/crm/activities?companyId=xxx&startDate=xxx&endDate=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const activityId = searchParams.get('id');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    if (activityId) {
      const activity = await activityStore.get(activityId);
      if (!activity || activity.companyId !== companyId) {
        return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
      }
      return NextResponse.json(activity);
    }

    // If date range provided, filter by date
    if (startDate && endDate) {
      const activities = await activityStore.listByDateRange(companyId, startDate, endDate);
      return NextResponse.json(activities);
    }

    const activities = await activityStore.list(companyId);
    return NextResponse.json(activities);
  } catch (error) {
    console.error('[CRM API] Activities GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/crm/activities
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

    const activity = await activityStore.create(companyId, data, user.sub || user.email || 'system');
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('[CRM API] Activities POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/crm/activities
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

    const existing = await activityStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    await activityStore.update(id, updates, user.sub || user.email || 'system');
    const updated = await activityStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Activities PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/crm/activities - Time update (for drag-drop calendar)
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, startTime, endTime, companyId } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const existing = await activityStore.get(id);
    if (!existing || (companyId && existing.companyId !== companyId)) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (startTime) updates.startTime = startTime;
    if (endTime) updates.endTime = endTime;

    await activityStore.update(id, updates, user.sub || user.email || 'system');
    const updated = await activityStore.get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CRM API] Activities PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/crm/activities?id=xxx
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
    await activityStore.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CRM API] Activities DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
