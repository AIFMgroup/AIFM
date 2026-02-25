import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} from '@/lib/notifications/notification-store';

async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const token = (await cookies()).get('__Host-aifm_id_token')?.value;
    if (!token) return null;
    const payload = await verifyIdToken(token);
    return (payload.email as string) ?? (payload['cognito:username'] as string) ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const email =
    request.nextUrl.searchParams.get('email') || (await getCurrentUserEmail());
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const notifications = await getNotificationsForUser(email, limit);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    if (
      error instanceof Error &&
      (error.name === 'ResourceNotFoundException' ||
        error.message.includes('ResourceNotFoundException'))
    ) {
      return NextResponse.json({ notifications: [] });
    }
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const email = await getCurrentUserEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { action, id, createdAt } = await request.json();

    if (action === 'mark_read' && id && createdAt) {
      await markNotificationRead(email, createdAt, id);
      return NextResponse.json({ success: true });
    }

    if (action === 'mark_all_read') {
      await markAllRead(email);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const email = await getCurrentUserEmail();
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, createdAt } = await request.json();
    if (!id || !createdAt) {
      return NextResponse.json({ error: 'id and createdAt required' }, { status: 400 });
    }

    await deleteNotification(email, createdAt, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
