/**
 * Generic Integration OAuth Callback Route
 * 
 * GET /api/integrations/[type]/callback
 * 
 * Handles the OAuth callback for any registered integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getIntegrationConfig,
  completeOAuthFlow,
  integrationTokenStore,
  createClient,
} from '@/lib/integrations';
import type { IntegrationType, IntegrationConnection } from '@/lib/integrations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const integrationType = type as IntegrationType;
    const cookieStore = await cookies();

    // Validate integration type
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      return NextResponse.redirect(
        new URL(`/settings?tab=integrations&error=unknown_type`, request.url)
      );
    }

    // Get parameters from query
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');
    const errorDescription = request.nextUrl.searchParams.get('error_description');

    // Handle OAuth error
    if (error) {
      console.error(`[Integration] OAuth error for ${config.name}:`, error, errorDescription);
      return NextResponse.redirect(
        new URL(`/settings?tab=integrations&integration=${type}&error=${error}`, request.url)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/settings?tab=integrations&integration=${type}&error=missing_params`, request.url)
      );
    }

    // Get stored state from cookie
    const storedStateData = cookieStore.get(`${integrationType}_oauth_state`)?.value;
    if (!storedStateData) {
      return NextResponse.redirect(
        new URL(`/settings?tab=integrations&integration=${type}&error=invalid_state`, request.url)
      );
    }

    // Clear the state cookie
    cookieStore.delete(`${integrationType}_oauth_state`);

    // Get host for redirect URI
    const host = request.headers.get('host') || 'localhost:3000';

    // Complete OAuth flow
    let tokens;
    let companyId;
    let returnTo;

    try {
      const result = await completeOAuthFlow(
        integrationType,
        code,
        state,
        storedStateData,
        host
      );
      tokens = result.tokens;
      companyId = result.companyId;
      returnTo = result.returnTo;
    } catch (err) {
      console.error(`[Integration] OAuth completion failed for ${config.name}:`, err);
      return NextResponse.redirect(
        new URL(`/settings?tab=integrations&integration=${type}&error=token_error`, request.url)
      );
    }

    // Create initial connection
    const now = new Date().toISOString();
    const connection: IntegrationConnection = {
      companyId,
      integrationType,
      status: 'connected',
      tokens,
      connectedAt: now,
      updatedAt: now,
    };

    // Try to get external account info
    try {
      // Save tokens first so client can use them
      await integrationTokenStore.saveConnection(connection);

      // Get account info based on integration type
      if (integrationType === 'fortnox') {
        const client = await createClient(integrationType, companyId);
        const companyInfo = await client.get<{ CompanyInformation: { CompanyName: string; OrganizationNumber: string } }>('/companyinformation');
        if (companyInfo.success && companyInfo.data) {
          connection.externalName = companyInfo.data.CompanyInformation.CompanyName;
          connection.externalId = companyInfo.data.CompanyInformation.OrganizationNumber;
        }
      } else if (integrationType === 'microsoft') {
        const client = await createClient(integrationType, companyId);
        const userInfo = await client.get<{ displayName: string; mail: string; id: string }>('/me');
        if (userInfo.success && userInfo.data) {
          connection.externalName = userInfo.data.displayName;
          connection.externalId = userInfo.data.id;
        }
      } else if (integrationType === 'scrive') {
        const client = await createClient(integrationType, companyId);
        const userInfo = await client.get<{ name: string; id: string; company_name: string }>('/getpersonalinfo');
        if (userInfo.success && userInfo.data) {
          connection.externalName = userInfo.data.company_name || userInfo.data.name;
          connection.externalId = userInfo.data.id;
        }
      }

      // Save updated connection with external info
      await integrationTokenStore.saveConnection(connection);
    } catch (err) {
      console.error(`[Integration] Failed to get account info for ${config.name}:`, err);
      // Connection is still saved, just without external info
    }

    console.log(`[Integration] ${config.name} connected for company ${companyId}`);

    // Redirect to return URL with success indicator
    const redirectUrl = new URL(returnTo || '/settings?tab=integrations', request.url);
    redirectUrl.searchParams.set('integration', type);
    redirectUrl.searchParams.set('connected', 'true');

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[Integration] Callback error:', error);
    const { type } = await params;
    return NextResponse.redirect(
      new URL(`/settings?tab=integrations&integration=${type}&error=internal_error`, request.url)
    );
  }
}

