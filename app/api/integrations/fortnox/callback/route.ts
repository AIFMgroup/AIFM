import { NextRequest, NextResponse } from 'next/server';
import { exchangeAuthorizationCode, storeFortnoxTokens } from '@/lib/accounting/fortnoxTokenService';
import { getSession } from '@/lib/auth/session';
import { fortnoxClient } from '@/lib/fortnox';

interface RouteParams {
  params: Promise<Record<string, never>>;
}

/**
 * GET /api/integrations/fortnox/callback
 * 
 * OAuth callback handler for Fortnox integration
 * Query params:
 * - code: Authorization code from Fortnox
 * - state: Company ID (for CSRF protection and mapping)
 * - error: Error code if authorization failed
 */
export async function GET(request: NextRequest, {}: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // companyId
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      console.error('[Fortnox OAuth] Authorization failed:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/accounting/integrations?status=error&message=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/accounting/integrations?status=error&message=Missing+authorization+code+or+state', request.url)
      );
    }

    const companyId = state;

    // Verify user is authenticated and authorized for this company
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.redirect(
        new URL('/login?redirect=/accounting/integrations', request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeAuthorizationCode(code, {
      clientId: process.env.FORTNOX_CLIENT_ID!,
      clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
      companyId,
      redirectUri: process.env.FORTNOX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/fortnox/callback`,
    });

    // Store tokens securely
    await storeFortnoxTokens(companyId, tokens);

    // Initialize fortnox client with new tokens
    fortnoxClient.initialize({
      clientId: process.env.FORTNOX_CLIENT_ID!,
      clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      companyId,
    });

    console.log(`[Fortnox OAuth] Successfully connected company ${companyId}`);

    // Redirect back to integrations page with success status
    return NextResponse.redirect(
      new URL('/accounting/integrations?status=connected&integration=fortnox', request.url)
    );

  } catch (error) {
    console.error('[Fortnox OAuth] Callback error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to connect to Fortnox';

    return NextResponse.redirect(
      new URL(`/accounting/integrations?status=error&message=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}







