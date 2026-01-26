/**
 * Generic Integration Status Route
 * 
 * GET /api/integrations/[type]/status?companyId=xxx
 * 
 * Returns the connection status for an integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getIntegrationConfig,
  integrationTokenStore,
  isTokenExpired,
} from '@/lib/integrations';
import type { IntegrationType, IntegrationStatus } from '@/lib/integrations';

export interface IntegrationStatusResponse {
  integrationType: string;
  integrationName: string;
  status: IntegrationStatus;
  connected: boolean;
  externalName?: string;
  externalId?: string;
  lastSyncAt?: string;
  lastError?: string;
  connectedAt?: string;
  tokenExpiresSoon?: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const integrationType = type as IntegrationType;

    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate integration type
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      return NextResponse.json(
        { error: `Unknown integration type: ${type}` },
        { status: 400 }
      );
    }

    // Get company ID from query
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    // Get connection from store
    const connection = await integrationTokenStore.getConnection(companyId, integrationType);

    if (!connection) {
      const response: IntegrationStatusResponse = {
        integrationType,
        integrationName: config.name,
        status: 'not_connected',
        connected: false,
      };
      return NextResponse.json(response);
    }

    // Check if token is about to expire
    let tokenExpiresSoon = false;
    if (connection.tokens && connection.status === 'connected') {
      tokenExpiresSoon = isTokenExpired(connection.tokens, 3600); // 1 hour warning
    }

    const response: IntegrationStatusResponse = {
      integrationType,
      integrationName: config.name,
      status: connection.status,
      connected: connection.status === 'connected',
      externalName: connection.externalName,
      externalId: connection.externalId,
      lastSyncAt: connection.lastSyncAt,
      lastError: connection.lastError,
      connectedAt: connection.connectedAt,
      tokenExpiresSoon,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Integration] Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/[type]/status?companyId=xxx
 * 
 * Disconnects an integration.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params;
    const integrationType = type as IntegrationType;

    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate integration type
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      return NextResponse.json(
        { error: `Unknown integration type: ${type}` },
        { status: 400 }
      );
    }

    // Get company ID from query
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    // Get current connection to attempt token revocation
    const connection = await integrationTokenStore.getConnection(companyId, integrationType);

    if (connection?.tokens && config.endpoints.revoke) {
      // Try to revoke tokens at the provider
      try {
        const { oauthManager } = await import('@/lib/integrations');
        await oauthManager.revokeTokens(integrationType, connection.tokens);
      } catch (err) {
        console.warn(`[Integration] Token revocation failed for ${config.name}:`, err);
        // Continue with deletion even if revocation fails
      }
    }

    // Delete the connection
    await integrationTokenStore.deleteConnection(companyId, integrationType);

    console.log(`[Integration] ${config.name} disconnected for company ${companyId}`);

    return NextResponse.json({
      success: true,
      message: `${config.name} has been disconnected`,
    });
  } catch (error) {
    console.error('[Integration] Disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}

