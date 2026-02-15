import { NextRequest, NextResponse } from 'next/server';
import { DropboxClient } from '@/lib/integrations/dropbox/dropbox-client';
import { getSyncStore, DropboxConnection } from '@/lib/integrations/dropbox/sync-store';
import { getUserIdFromSession } from '@/lib/auth/session';

/**
 * Dropbox OAuth Callback
 * 
 * Handles the redirect from Dropbox after user authorization.
 * Exchanges the authorization code for tokens and stores the connection.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle errors from Dropbox
    if (error) {
      console.error('[Dropbox Callback] Error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/admin/dropbox?error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Validate code
    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/dropbox?error=No+authorization+code+received', request.url)
      );
    }

    // In production, validate state against stored value
    console.log('[Dropbox Callback] Received code, state:', state);

    // Create client and exchange code for tokens
    const client = new DropboxClient({
      clientId: process.env.DROPBOX_CLIENT_ID!,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/dropbox/callback`,
    });

    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.redirect(
        new URL('/admin/dropbox?error=Session+expired+please+log+in', request.url)
      );
    }

    const tokens = await client.exchangeCodeForTokens(code);

    const accountInfo = await client.getAccountInfo();

    const connection: DropboxConnection = {
      userId,
      dropboxAccountId: accountInfo.accountId,
      displayName: accountInfo.displayName,
      email: accountInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      connectedAt: new Date().toISOString(),
      lastSync: null,
      selectedFolders: [], // User will select folders later
      syncEnabled: true,
    };

    const store = getSyncStore();
    await store.saveConnection(connection);

    console.log('[Dropbox Callback] Connected:', accountInfo.displayName, accountInfo.email);

    // Redirect to Dropbox settings with success message
    return NextResponse.redirect(
      new URL('/admin/dropbox?connected=true', request.url)
    );

  } catch (error) {
    console.error('[Dropbox Callback] Error:', error);
    return NextResponse.redirect(
      new URL(`/admin/dropbox?error=${encodeURIComponent((error as Error).message)}`, request.url)
    );
  }
}
