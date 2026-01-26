/**
 * API Route: Accounting Notifications
 * 
 * GET  - Hämta olästa notifikationer
 * POST - Markera notifikation som läst
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { 
  getUnreadNotifications, 
  markAsRead,
  runScheduledNotificationChecks 
} from '@/lib/accounting/services/notificationService';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId parameter' }, { status: 400 });
    }

    const notifications = await getUnreadNotifications(companyId, limit);

    return NextResponse.json({ 
      success: true, 
      notifications,
      count: notifications.length,
    });

  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, notificationId, action } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (action === 'markAsRead' && notificationId) {
      await markAsRead(companyId, notificationId);
      return NextResponse.json({ success: true });
    }

    if (action === 'runChecks') {
      await runScheduledNotificationChecks(companyId);
      return NextResponse.json({ success: true, message: 'Notification checks completed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Failed to process notification action:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


