import { NextRequest, NextResponse } from 'next/server';
import { MS365Client, getMS365Config } from '@/lib/integrations/microsoft365';
import { setToken } from '@/lib/integrations/microsoft365/token-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      console.error('[MS365 Callback] Error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/admin/integrations?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/integrations?error=No+authorization+code', request.url)
      );
    }

    const config = getMS365Config();
    if (!config) {
      return NextResponse.redirect(
        new URL('/admin/integrations?error=M365+not+configured', request.url)
      );
    }

    const client = new MS365Client(config);
    const tokens = await client.exchangeCodeForTokens(code);

    // Get user info
    const user = await client.getMe();

    // Store tokens (in production, use DynamoDB)
    const userId = 'default-user';
    setToken(userId, {
      ...tokens,
      user,
    });

    console.log('[MS365 Callback] Connected:', user.displayName, user.email);

    return NextResponse.redirect(
      new URL('/admin/integrations?connected=microsoft365', request.url)
    );

  } catch (error) {
    console.error('[MS365 Callback] Error:', error);
    return NextResponse.redirect(
      new URL(`/admin/integrations?error=${encodeURIComponent((error as Error).message)}`, request.url)
    );
  }
}
