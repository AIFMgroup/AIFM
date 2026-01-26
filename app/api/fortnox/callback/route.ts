import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FORTNOX_CONFIG } from '@/lib/fortnox/config';
import { fortnoxTokenStore, FortnoxTokens } from '@/lib/fortnox/tokenStore';
import { FortnoxClient } from '@/lib/fortnox/client';
import { auditLog, createAuditContext } from '@/lib/accounting/auditLogger';

/**
 * GET /api/fortnox/callback
 * 
 * Hanterar callback från Fortnox OAuth.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Get authorization code and state from query
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('[Fortnox] OAuth error:', error);
      return NextResponse.redirect(new URL('/settings?fortnox=error', request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings?fortnox=missing_params', request.url));
    }

    // Verify state
    const storedStateData = cookieStore.get('fortnox_oauth_state')?.value;
    if (!storedStateData) {
      return NextResponse.redirect(new URL('/settings?fortnox=invalid_state', request.url));
    }

    let stateData: { state: string; companyId: string; returnTo?: string };
    try {
      stateData = JSON.parse(storedStateData);
    } catch {
      return NextResponse.redirect(new URL('/settings?fortnox=invalid_state', request.url));
    }

    if (stateData.state !== state) {
      return NextResponse.redirect(new URL('/settings?fortnox=state_mismatch', request.url));
    }

    const companyId = stateData.companyId;
    const returnTo = stateData.returnTo || '/accounting/settings';

    // Exchange code for tokens
    const host = request.headers.get('host') || 'localhost:3000';
    const redirectUri = FORTNOX_CONFIG.getRedirectUri(host);

    const tokenResponse = await fetch(FORTNOX_CONFIG.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${FORTNOX_CONFIG.clientId}:${FORTNOX_CONFIG.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Fortnox] Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/settings?fortnox=token_error', request.url));
    }

    const tokenData = await tokenResponse.json();

    const tokens: FortnoxTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      scope: tokenData.scope,
    };

    // Get company info from Fortnox
    let fortnoxCompanyName: string | undefined;
    let fortnoxCompanyId: string | undefined;

    try {
      // Temporarily save tokens to fetch company info
      await fortnoxTokenStore.saveTokens(companyId, tokens);
      
      const client = new FortnoxClient(companyId);
      await client.init();
      
      const companyInfo = await client.getCompanyInfo();
      if (companyInfo.success && companyInfo.data) {
        fortnoxCompanyName = companyInfo.data.CompanyName;
        fortnoxCompanyId = companyInfo.data.OrganizationNumber;
      }
    } catch (error) {
      console.error('[Fortnox] Failed to get company info:', error);
    }

    // Save tokens with metadata
    await fortnoxTokenStore.saveTokens(companyId, tokens, {
      fortnoxCompanyName,
      fortnoxCompanyId,
    });

    // Audit log
    await auditLog.fortnoxConnected(companyId, {
      ...createAuditContext(request),
      details: {
        fortnoxCompanyName,
        fortnoxCompanyId,
        scope: tokens.scope,
      }
    });

    // Clear state cookie
    cookieStore.delete('fortnox_oauth_state');

    console.log(`[Fortnox] Successfully connected company ${companyId} to Fortnox (${fortnoxCompanyName})`);

    // Redirect back to requested page with success (and trigger bootstrap on client)
    return NextResponse.redirect(new URL(`${returnTo}?fortnox=success&company=${companyId}&bootstrap=1`, request.url));

  } catch (error) {
    console.error('[Fortnox] Callback error:', error);
    return NextResponse.redirect(new URL('/accounting/settings?fortnox=error', request.url));
  }
}




