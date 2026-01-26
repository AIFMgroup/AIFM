/**
 * Integration List Route
 * 
 * GET /api/integrations?companyId=xxx
 * 
 * Returns all available integrations with their status for a company.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getAllIntegrationsDisplayInfo,
  integrationTokenStore,
  isTokenExpired,
  integrationCategories,
} from '@/lib/integrations';
import type { IntegrationType, IntegrationStatus } from '@/lib/integrations';

export interface IntegrationListItem {
  id: IntegrationType;
  name: string;
  description: string;
  icon: string;
  features: string[];
  configured: boolean;
  status: IntegrationStatus;
  connected: boolean;
  externalName?: string;
  externalId?: string;
  lastSyncAt?: string;
  lastError?: string;
  connectedAt?: string;
  tokenExpiresSoon?: boolean;
}

export interface IntegrationListResponse {
  integrations: IntegrationListItem[];
  categories: typeof integrationCategories;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get company ID from query
    const companyId = request.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    // Get all available integrations
    const allIntegrations = getAllIntegrationsDisplayInfo();

    // Get all connections for this company
    const connections = await integrationTokenStore.listConnections(companyId);
    const connectionMap = new Map(
      connections.map((c) => [c.integrationType, c])
    );

    // Build response
    const integrations: IntegrationListItem[] = allIntegrations.map((integration) => {
      const connection = connectionMap.get(integration.id);

      let tokenExpiresSoon = false;
      if (connection?.tokens && connection.status === 'connected') {
        tokenExpiresSoon = isTokenExpired(connection.tokens, 3600);
      }

      return {
        id: integration.id,
        name: integration.name,
        description: integration.description,
        icon: integration.icon,
        features: integration.features,
        configured: integration.configured,
        status: connection?.status || 'not_connected',
        connected: connection?.status === 'connected',
        externalName: connection?.externalName,
        externalId: connection?.externalId,
        lastSyncAt: connection?.lastSyncAt,
        lastError: connection?.lastError,
        connectedAt: connection?.connectedAt,
        tokenExpiresSoon,
      };
    });

    const response: IntegrationListResponse = {
      integrations,
      categories: integrationCategories,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Integration] List error:', error);
    return NextResponse.json(
      { error: 'Failed to list integrations' },
      { status: 500 }
    );
  }
}

