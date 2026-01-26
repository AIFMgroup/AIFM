import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

/**
 * GET /fortnox/connect?companyId=xxx&returnTo=/accounting/settings
 *
 * Starts Fortnox OAuth flow from a non-/api path so CloudFront routing won't send it to the backend origin.
 */
export async function GET(request: NextRequest) {
  try {
    // Require auth cookie (same cookie we use elsewhere)
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const returnTo = searchParams.get('returnTo') || '/accounting/settings';
    if (!companyId) {
      return NextResponse.redirect(new URL(`${returnTo}?fortnox=error&message=Missing+companyId`, request.url));
    }

    // Build redirectUri based on current host (works behind CloudFront)
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = process.env.FORTNOX_REDIRECT_URI || `${protocol}://${host}/fortnox/callback`;

    const clientId = process.env.FORTNOX_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(new URL(`${returnTo}?fortnox=error&message=Missing+FORTNOX_CLIENT_ID`, request.url));
    }

    // CSRF protection - use __Host- prefix for stricter security
    const state = crypto.randomBytes(16).toString('hex');
    cookieStore.set('__Host-fortnox_oauth_state', JSON.stringify({ state, companyId, returnTo, redirectUri }), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    const authUrl = new URL('https://apps.fortnox.se/oauth-v1/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('state', state);
    // Scopes matching enabled permissions in Fortnox app (article, bookkeeping, companyinformation, costcenter, supplier, supplierinvoice, project, currency)
    const scopes = process.env.FORTNOX_SCOPES || 'article bookkeeping companyinformation costcenter supplier supplierinvoice project currency';
    authUrl.searchParams.set('scope', scopes);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('[Fortnox] /fortnox/connect error:', error);
    return NextResponse.redirect(new URL('/accounting/settings?fortnox=error&message=Failed+to+start+Fortnox+connect', request.url));
  }
}


