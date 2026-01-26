/**
 * Generic Integration Connect Route
 * 
 * GET /api/integrations/[type]/connect?companyId=xxx
 * 
 * Starts the OAuth flow for any registered integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getIntegrationConfig,
  isIntegrationConfigured,
  startOAuthFlow,
} from '@/lib/integrations';
import type { IntegrationType } from '@/lib/integrations';

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
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    // Validate integration type
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      return NextResponse.json(
        { error: `Unknown integration type: ${type}` },
        { status: 400 }
      );
    }

    // Check if integration is configured
    if (!isIntegrationConfigured(integrationType)) {
      return NextResponse.json(
        { error: `Integration ${config.name} is not configured. Missing credentials.` },
        { status: 400 }
      );
    }

    // Check if integration uses OAuth
    if (!config.usesOAuth) {
      return NextResponse.json(
        { error: `Integration ${config.name} does not use OAuth` },
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

    // Get optional return URL
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/settings?tab=integrations';

    // Get host for redirect URI
    const host = request.headers.get('host') || 'localhost:3000';

    // Start OAuth flow
    const { authUrl, stateData } = await startOAuthFlow(integrationType, companyId, {
      returnTo,
      host,
    });

    // Store state in cookie
    cookieStore.set(`${integrationType}_oauth_state`, stateData, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    console.log(`[Integration] Starting OAuth for ${config.name}, company ${companyId}`);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Integration] Connect error:', error);
    return NextResponse.json(
      { error: 'Failed to start integration connection' },
      { status: 500 }
    );
  }
}

