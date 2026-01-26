import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeAuthorizationCode } from '@/lib/accounting/fortnoxTokenService';
import { fortnoxClient } from '@/lib/fortnox';
import { fortnoxTokenStore } from '@/lib/fortnox/tokenStore';

/**
 * GET /fortnox/callback
 *
 * OAuth callback handler from a non-/api path to avoid CloudFront routing issues.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('__Host-fortnox_oauth_state')?.value;
    const parsed = stateCookie ? JSON.parse(stateCookie) as { state: string; companyId: string; returnTo: string; redirectUri: string } : null;

    // Force production URL for redirects (never redirect to localhost)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://d31zvrvfawczta.cloudfront.net';
    const returnTo = parsed?.returnTo || '/accounting/settings';

    if (error) {
      return NextResponse.redirect(
        new URL(`${returnTo}?fortnox=error&message=${encodeURIComponent(errorDescription || error)}`, baseUrl)
      );
    }

    if (!code || !state || !parsed?.state || state !== parsed.state) {
      return NextResponse.redirect(
        new URL(`${returnTo}?fortnox=error&message=Invalid+state+or+missing+code`, baseUrl)
      );
    }

    const companyId = parsed.companyId;
    const redirectUri = parsed.redirectUri;

    // Exchange code for tokens
    const tokens = await exchangeAuthorizationCode(code, {
      clientId: process.env.FORTNOX_CLIENT_ID!,
      clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
      companyId,
      redirectUri,
    });

    // Persist tokens in the main Fortnox token store (DynamoDB) used by the Fortnox client + status endpoints.
    await fortnoxTokenStore.saveTokens(companyId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(tokens.expiresAt).toISOString(),
      scope: tokens.scope || '',
    });

    fortnoxClient.initialize({
      clientId: process.env.FORTNOX_CLIENT_ID!,
      clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      companyId,
    });

    // Cleanup cookie
    cookieStore.set('__Host-fortnox_oauth_state', '', { maxAge: 0, path: '/', secure: true });

    return NextResponse.redirect(new URL(`${returnTo}?fortnox=success`, baseUrl));
  } catch (e) {
    console.error('[Fortnox] /fortnox/callback error:', e);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://d31zvrvfawczta.cloudfront.net';
    return NextResponse.redirect(new URL(`/accounting/settings?fortnox=error&message=${encodeURIComponent(e instanceof Error ? e.message : 'Callback failed')}`, baseUrl));
  }
}


