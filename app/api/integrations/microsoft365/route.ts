import { NextRequest, NextResponse } from 'next/server';
import { MS365Client, getMS365Config, isMS365Configured } from '@/lib/integrations/microsoft365';
import { getToken, deleteToken } from '@/lib/integrations/microsoft365/token-store';
import { getUserIdFromSession } from '@/lib/auth/session';
import { parseOr400, ms365PostBodySchema } from '@/lib/api/validate';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const userId = await getUserIdFromSession();
    if (!userId && action !== 'auth-url') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const effectiveUserId = userId ?? 'default-user';

    if (action === 'status') {
      const tokens = getToken(effectiveUserId);
      
      return NextResponse.json({
        configured: isMS365Configured(),
        connected: !!tokens,
        user: tokens?.user || null,
        expiresAt: tokens?.expiresAt || null,
      });
    }

    if (action === 'auth-url') {
      const config = getMS365Config();
      if (!config) {
        return NextResponse.json({ error: 'M365 not configured' }, { status: 400 });
      }

      const client = new MS365Client(config);
      const state = uuidv4();
      const authUrl = client.getAuthorizationUrl(state);

      return NextResponse.json({ authUrl, state });
    }

    if (action === 'calendar') {
      const tokens = getToken(effectiveUserId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);

      const days = parseInt(searchParams.get('days') || '7');
      const events = await client.getUpcomingEvents(days);

      return NextResponse.json({ events });
    }

    if (action === 'today') {
      const tokens = getToken(effectiveUserId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);
      const events = await client.getTodayEvents();

      return NextResponse.json({ events });
    }

    if (action === 'emails') {
      const tokens = getToken(effectiveUserId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);
      
      const unread = searchParams.get('unread') === 'true';
      const emails = unread 
        ? await client.getUnreadEmails(25)
        : await client.getEmails('inbox', 25);

      return NextResponse.json({ emails });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[MS365 API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = parseOr400(ms365PostBodySchema, raw);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (body.action === 'create-event') {
      const tokens = getToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);

      const event = await client.createEvent({
        subject: body.subject,
        start: new Date(body.start),
        end: new Date(body.end),
        attendees: body.attendees,
        location: body.location,
        body: body.body,
        isOnlineMeeting: body.isOnlineMeeting,
      });

      return NextResponse.json({ event });
    }

    if (body.action === 'send-email') {
      const tokens = getToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);

      await client.sendEmail({
        to: body.to,
        subject: body.subject,
        body: body.body,
        cc: body.cc,
        importance: body.importance,
      });

      return NextResponse.json({ success: true });
    }

    if (body.action === 'search-emails') {
      const tokens = getToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);

      const emails = await client.searchEmails(body.query, body.limit ?? 25);

      return NextResponse.json({ emails });
    }

    if (body.action === 'check-availability') {
      const tokens = getToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getMS365Config()!;
      const client = new MS365Client(config, tokens);

      const freeBusy = await client.getFreeBusy(
        body.emails,
        body.startDate,
        body.endDate
      );

      return NextResponse.json({
        availability: Object.fromEntries(freeBusy),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[MS365 API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    deleteToken(userId);
    return NextResponse.json({ message: 'Disconnected' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
