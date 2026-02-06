import { NextRequest, NextResponse } from 'next/server';
import { SlackClient, getSlackConfig, isSlackConfigured } from '@/lib/integrations/slack';
import { getSlackToken, deleteSlackToken } from '@/lib/integrations/slack/token-store';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const userId = 'default-user';

    if (action === 'status') {
      const tokens = getSlackToken(userId);
      
      return NextResponse.json({
        configured: isSlackConfigured(),
        connected: !!tokens,
        team: tokens ? { id: tokens.teamId, name: tokens.teamName } : null,
      });
    }

    if (action === 'auth-url') {
      const config = getSlackConfig();
      if (!config) {
        return NextResponse.json({ error: 'Slack not configured' }, { status: 400 });
      }

      const client = new SlackClient(config);
      const state = uuidv4();
      const authUrl = client.getAuthorizationUrl(state);

      return NextResponse.json({ authUrl, state });
    }

    if (action === 'channels') {
      const tokens = getSlackToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getSlackConfig()!;
      const client = new SlackClient(config, tokens);
      const channels = await client.listChannels(true);

      return NextResponse.json({ channels });
    }

    if (action === 'users') {
      const tokens = getSlackToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getSlackConfig()!;
      const client = new SlackClient(config, tokens);
      const users = await client.listUsers();

      return NextResponse.json({ users });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Slack API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const userId = 'default-user';

    if (action === 'send-message') {
      const tokens = getSlackToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getSlackConfig()!;
      const client = new SlackClient(config, tokens);

      const message = await client.sendMessage(
        body.channel,
        body.text,
        { threadTs: body.threadTs }
      );

      return NextResponse.json({ message });
    }

    if (action === 'send-dm') {
      const tokens = getSlackToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getSlackConfig()!;
      const client = new SlackClient(config, tokens);

      const message = await client.sendDirectMessage(body.userId, body.text);

      return NextResponse.json({ message });
    }

    if (action === 'get-history') {
      const tokens = getSlackToken(userId);
      if (!tokens) {
        return NextResponse.json({ error: 'Not connected' }, { status: 401 });
      }

      const config = getSlackConfig()!;
      const client = new SlackClient(config, tokens);

      const messages = await client.getChannelHistory(body.channel, body.limit || 50);

      return NextResponse.json({ messages });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Slack API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = 'default-user';
    deleteSlackToken(userId);
    return NextResponse.json({ message: 'Disconnected' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
