/**
 * Generic OAuth Manager
 * 
 * Handles OAuth 2.0 authorization flows for all integrations.
 * Supports authorization code flow, PKCE, and token refresh.
 */

import crypto from 'crypto';
import type {
  IntegrationType,
  IntegrationTokens,
  IOAuthManager,
  OAuthState,
  OAuthCallbackParams,
  IntegrationConfig,
} from './types';
import { getIntegrationConfig } from './registry';

// ============================================================================
// PKCE Utilities
// ============================================================================

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ============================================================================
// State Management
// ============================================================================

function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

// ============================================================================
// URL Builders
// ============================================================================

function getRedirectUri(integrationType: IntegrationType, host: string): string {
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}/api/integrations/${integrationType}/callback`;
}

function buildAuthorizationUrl(
  config: IntegrationConfig,
  redirectUri: string,
  state: string,
  codeChallenge?: string
): string {
  const url = new URL(config.endpoints.authorization);

  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  if (config.scopes.length > 0) {
    url.searchParams.set('scope', config.scopes.join(' '));
  }

  // PKCE support
  if (codeChallenge) {
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  // Provider-specific parameters
  if (config.id === 'fortnox') {
    url.searchParams.set('access_type', 'offline');
  }

  if (config.id === 'microsoft' && config.tenantId) {
    // Microsoft uses tenant in the URL path, already handled in endpoints
  }

  return url.toString();
}

// ============================================================================
// Token Exchange
// ============================================================================

async function exchangeCodeForTokens(
  config: IntegrationConfig,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<IntegrationTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  // Add PKCE verifier if used
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  // Build headers based on auth method
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (config.tokenAuthMethod === 'basic' || !config.tokenAuthMethod) {
    // Default: Basic auth
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    // Body auth: include credentials in body
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.endpoints.token, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OAuth] Token exchange failed for ${config.id}:`, errorText);
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    scope: data.scope,
    tokenType: data.token_type || 'Bearer',
    idToken: data.id_token,
  };
}

async function refreshAccessToken(
  config: IntegrationConfig,
  refreshToken: string
): Promise<IntegrationTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (config.tokenAuthMethod === 'basic' || !config.tokenAuthMethod) {
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.endpoints.token, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OAuth] Token refresh failed for ${config.id}:`, errorText);
    
    // Check for revocation indicators
    const lower = errorText.toLowerCase();
    if (
      lower.includes('invalid_grant') ||
      lower.includes('invalid_token') ||
      response.status === 400 ||
      response.status === 401
    ) {
      const error = new Error('Token has been revoked or expired');
      (error as Error & { code: string }).code = 'TOKEN_REVOKED';
      throw error;
    }
    
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Keep old if not provided
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    scope: data.scope,
    tokenType: data.token_type || 'Bearer',
    idToken: data.id_token,
  };
}

async function revokeToken(
  config: IntegrationConfig,
  tokens: IntegrationTokens
): Promise<void> {
  if (!config.endpoints.revoke) {
    console.log(`[OAuth] Revocation not supported for ${config.id}`);
    return;
  }

  const tokenToRevoke = tokens.refreshToken || tokens.accessToken;

  try {
    const response = await fetch(config.endpoints.revoke, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        token: tokenToRevoke,
      }),
    });

    if (!response.ok) {
      console.warn(`[OAuth] Token revocation returned ${response.status} for ${config.id}`);
    }
  } catch (err) {
    console.error(`[OAuth] Token revocation failed for ${config.id}:`, err);
    // Don't throw - revocation failure shouldn't block disconnection
  }
}

// ============================================================================
// OAuth Manager Implementation
// ============================================================================

class OAuthManager implements IOAuthManager {
  async getAuthorizationUrl(
    integrationType: IntegrationType,
    companyId: string,
    returnTo?: string,
    host?: string
  ): Promise<{ url: string; state: OAuthState }> {
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      throw new Error(`Unknown integration type: ${integrationType}`);
    }

    if (!config.usesOAuth) {
      throw new Error(`Integration ${integrationType} does not use OAuth`);
    }

    const effectiveHost = host || 'localhost:3000';
    const redirectUri = getRedirectUri(integrationType, effectiveHost);
    const stateValue = generateState();

    // Generate PKCE if supported (recommended for all public clients)
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    
    // Use PKCE for Microsoft, optional for others
    if (integrationType === 'microsoft') {
      codeVerifier = generateCodeVerifier();
      codeChallenge = generateCodeChallenge(codeVerifier);
    }

    const url = buildAuthorizationUrl(config, redirectUri, stateValue, codeChallenge);

    const state: OAuthState = {
      state: stateValue,
      companyId,
      integrationType,
      returnTo,
      codeVerifier,
      createdAt: new Date().toISOString(),
    };

    return { url, state };
  }

  async handleCallback(
    integrationType: IntegrationType,
    params: OAuthCallbackParams,
    storedState: OAuthState,
    host?: string
  ): Promise<IntegrationTokens> {
    // Verify state matches
    if (params.state !== storedState.state) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    // Check for errors from provider
    if (params.error) {
      throw new Error(`OAuth error: ${params.error} - ${params.errorDescription || 'Unknown error'}`);
    }

    if (!params.code) {
      throw new Error('No authorization code received');
    }

    const config = getIntegrationConfig(integrationType);
    if (!config) {
      throw new Error(`Unknown integration type: ${integrationType}`);
    }

    const effectiveHost = host || 'localhost:3000';
    const redirectUri = getRedirectUri(integrationType, effectiveHost);

    const tokens = await exchangeCodeForTokens(
      config,
      params.code,
      redirectUri,
      storedState.codeVerifier
    );

    return tokens;
  }

  async refreshTokens(
    integrationType: IntegrationType,
    refreshToken: string
  ): Promise<IntegrationTokens> {
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      throw new Error(`Unknown integration type: ${integrationType}`);
    }

    if (!config.supportsRefresh) {
      throw new Error(`Integration ${integrationType} does not support token refresh`);
    }

    return refreshAccessToken(config, refreshToken);
  }

  async revokeTokens(
    integrationType: IntegrationType,
    tokens: IntegrationTokens
  ): Promise<void> {
    const config = getIntegrationConfig(integrationType);
    if (!config) {
      throw new Error(`Unknown integration type: ${integrationType}`);
    }

    await revokeToken(config, tokens);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const oauthManager = new OAuthManager();

// ============================================================================
// High-Level Helper Functions
// ============================================================================

/**
 * Start OAuth flow - returns URL and state to store in cookie
 */
export async function startOAuthFlow(
  integrationType: IntegrationType,
  companyId: string,
  options?: {
    returnTo?: string;
    host?: string;
  }
): Promise<{ authUrl: string; stateData: string }> {
  const { url, state } = await oauthManager.getAuthorizationUrl(
    integrationType,
    companyId,
    options?.returnTo,
    options?.host
  );

  return {
    authUrl: url,
    stateData: JSON.stringify(state),
  };
}

/**
 * Complete OAuth flow - verifies state and exchanges code for tokens
 */
export async function completeOAuthFlow(
  integrationType: IntegrationType,
  code: string,
  stateParam: string,
  storedStateData: string,
  host?: string
): Promise<{ tokens: IntegrationTokens; companyId: string; returnTo?: string }> {
  const storedState: OAuthState = JSON.parse(storedStateData);

  // Verify state matches
  if (stateParam !== storedState.state) {
    throw new Error('Invalid state parameter');
  }

  // Verify integration type matches
  if (storedState.integrationType !== integrationType) {
    throw new Error('Integration type mismatch');
  }

  // Check state isn't too old (10 minute max)
  const stateAge = Date.now() - new Date(storedState.createdAt).getTime();
  if (stateAge > 10 * 60 * 1000) {
    throw new Error('OAuth state expired');
  }

  const tokens = await oauthManager.handleCallback(
    integrationType,
    { code, state: stateParam },
    storedState,
    host
  );

  return {
    tokens,
    companyId: storedState.companyId,
    returnTo: storedState.returnTo,
  };
}

