import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FORTNOX_CONFIG } from '@/lib/fortnox/config';
import crypto from 'crypto';

/**
 * GET /api/fortnox/connect?companyId=xxx
 * 
 * Startar OAuth-flödet för att koppla ett bolag till Fortnox.
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Get company ID from query
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state and companyId in cookie for callback
    // Also store the preferred return URL so callback lands where the user started.
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/accounting/settings';
    const stateData = JSON.stringify({ state, companyId, returnTo });
    cookieStore.set('fortnox_oauth_state', stateData, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Build authorization URL
    const host = request.headers.get('host') || 'localhost:3000';
    const redirectUri = FORTNOX_CONFIG.getRedirectUri(host);
    
    const authUrl = new URL(FORTNOX_CONFIG.authorizationEndpoint);
    authUrl.searchParams.set('client_id', FORTNOX_CONFIG.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', FORTNOX_CONFIG.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline'); // Get refresh token

    console.log(`[Fortnox] Starting OAuth for company ${companyId}, redirect to ${authUrl.toString()}`);

    return NextResponse.redirect(authUrl.toString());

  } catch (error) {
    console.error('[Fortnox] Connect error:', error);
    return NextResponse.json(
      { error: 'Failed to start Fortnox connection' },
      { status: 500 }
    );
  }
}




