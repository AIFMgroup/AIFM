import { NextRequest, NextResponse } from 'next/server';
import { SlackClient, getSlackConfig } from '@/lib/integrations/slack';
import { setSlackToken } from '@/lib/integrations/slack/token-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('[Slack Callback] Error:', error);
      return NextResponse.redirect(
        new URL(`/admin/integrations?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/integrations?error=No+authorization+code', request.url)
      );
    }

    const config = getSlackConfig();
    if (!config) {
      return NextResponse.redirect(
        new URL('/admin/integrations?error=Slack+not+configured', request.url)
      );
    }

    const client = new SlackClient(config);
    const tokens = await client.exchangeCodeForTokens(code);

    // Store tokens
    const userId = 'default-user';
    setSlackToken(userId, tokens);

    console.log('[Slack Callback] Connected to:', tokens.teamName);

    return NextResponse.redirect(
      new URL('/admin/integrations?connected=slack', request.url)
    );

  } catch (error) {
    console.error('[Slack Callback] Error:', error);
    return NextResponse.redirect(
      new URL(`/admin/integrations?error=${encodeURIComponent((error as Error).message)}`, request.url)
    );
  }
}
