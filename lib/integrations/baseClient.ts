/**
 * Base Integration Client
 * 
 * Abstract base class that all integration clients extend.
 * Provides common functionality for authentication, API calls, and token refresh.
 */

import type {
  IntegrationType,
  IntegrationConfig,
  IntegrationTokens,
  IntegrationApiResponse,
  IIntegrationClient,
  RequestOptions,
} from './types';
import { getIntegrationConfig } from './registry';
import { integrationTokenStore, isTokenExpired } from './tokenStore';
import { oauthManager } from './oauthManager';

// ============================================================================
// Base Client Implementation
// ============================================================================

export abstract class BaseIntegrationClient<TConfig = IntegrationConfig>
  implements IIntegrationClient<TConfig>
{
  readonly integrationType: IntegrationType;
  readonly companyId: string;

  protected config: IntegrationConfig;
  protected tokens: IntegrationTokens | null = null;
  protected initialized = false;

  constructor(integrationType: IntegrationType, companyId: string) {
    this.integrationType = integrationType;
    this.companyId = companyId;

    const config = getIntegrationConfig(integrationType);
    if (!config) {
      throw new Error(`Unknown integration type: ${integrationType}`);
    }
    this.config = config;
  }

  /**
   * Initialize the client by loading tokens from store
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const connection = await integrationTokenStore.getConnection(
      this.companyId,
      this.integrationType
    );

    if (!connection || connection.status !== 'connected' || !connection.tokens) {
      throw new Error(`${this.config.name} is not connected for this company`);
    }

    this.tokens = connection.tokens;
    this.initialized = true;
  }

  /**
   * Check if client is ready for API calls
   */
  isReady(): boolean {
    return this.initialized && this.tokens !== null;
  }

  /**
   * Get the integration config (can be overridden for custom config)
   */
  getConfig(): TConfig {
    return this.config as unknown as TConfig;
  }

  /**
   * Make an authenticated API request
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<IntegrationApiResponse<T>> {
    if (!this.isReady()) {
      return { success: false, error: 'Client not initialized' };
    }

    // Check if token needs refresh
    if (!options?.skipRefresh && this.tokens && isTokenExpired(this.tokens, this.config.tokenExpiryBuffer)) {
      try {
        await this.refreshToken();
      } catch (err) {
        console.error(`[${this.config.name}] Token refresh failed:`, err);
        return { success: false, error: 'Token refresh failed' };
      }
    }

    // Build URL
    const url = this.buildUrl(endpoint, options?.params);

    // Build headers
    const headers: Record<string, string> = {
      'Authorization': `${this.tokens!.tokenType || 'Bearer'} ${this.tokens!.accessToken}`,
      'Accept': 'application/json',
      ...this.config.customHeaders,
      ...options?.headers,
    };

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const controller = new AbortController();
      const timeout = options?.timeout || 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle response
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for auth errors
        if (response.status === 401 || response.status === 403) {
          // Mark as expired/revoked
          await integrationTokenStore.setStatus(
            this.companyId,
            this.integrationType,
            'expired',
            `API returned ${response.status}`
          );
        }

        return {
          success: false,
          error: errorText || `Request failed with status ${response.status}`,
          statusCode: response.status,
          headers: responseHeaders,
        };
      }

      // Handle empty responses
      if (response.status === 204) {
        return {
          success: true,
          statusCode: response.status,
          headers: responseHeaders,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: data as T,
        statusCode: response.status,
        headers: responseHeaders,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Request timed out' };
      }
      
      console.error(`[${this.config.name}] Request error:`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Build full URL for API request
   */
  protected buildUrl(endpoint: string, params?: Record<string, string>): string {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.config.endpoints.api}${normalizedEndpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  /**
   * Refresh access token
   */
  protected async refreshToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Try to acquire lock to prevent concurrent refreshes
    const lockAcquired = await integrationTokenStore.acquireRefreshLock(
      this.companyId,
      this.integrationType,
      30
    );

    if (!lockAcquired) {
      // Another process is refreshing, wait and reload
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const connection = await integrationTokenStore.getConnection(
        this.companyId,
        this.integrationType
      );
      if (connection?.tokens) {
        this.tokens = connection.tokens;
      }
      return;
    }

    try {
      const newTokens = await oauthManager.refreshTokens(
        this.integrationType,
        this.tokens.refreshToken
      );

      await integrationTokenStore.updateTokens(
        this.companyId,
        this.integrationType,
        newTokens
      );

      this.tokens = newTokens;
      console.log(`[${this.config.name}] Token refreshed for company ${this.companyId}`);
    } catch (err) {
      // Check if token was revoked
      if ((err as Error & { code?: string }).code === 'TOKEN_REVOKED') {
        await integrationTokenStore.setStatus(
          this.companyId,
          this.integrationType,
          'revoked',
          'Token has been revoked. Please reconnect.'
        );
      } else {
        await integrationTokenStore.setStatus(
          this.companyId,
          this.integrationType,
          'error',
          (err as Error).message
        );
      }
      throw err;
    } finally {
      await integrationTokenStore.releaseRefreshLock(
        this.companyId,
        this.integrationType
      );
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<IntegrationApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<IntegrationApiResponse<T>> {
    return this.request<T>('POST', endpoint, body, options);
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<IntegrationApiResponse<T>> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<IntegrationApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, body, options);
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<IntegrationApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}

// ============================================================================
// Client Factory
// ============================================================================

type ClientConstructor<T extends BaseIntegrationClient> = new (companyId: string) => T;

const clientRegistry = new Map<IntegrationType, ClientConstructor<BaseIntegrationClient>>();

/**
 * Register a client class for an integration type
 */
export function registerClient<T extends BaseIntegrationClient>(
  type: IntegrationType,
  ClientClass: ClientConstructor<T>
): void {
  clientRegistry.set(type, ClientClass as ClientConstructor<BaseIntegrationClient>);
}

/**
 * Create a client instance for an integration
 */
export async function createClient<T extends BaseIntegrationClient = BaseIntegrationClient>(
  type: IntegrationType,
  companyId: string
): Promise<T> {
  const ClientClass = clientRegistry.get(type);
  
  if (!ClientClass) {
    throw new Error(`No client registered for integration type: ${type}`);
  }

  const client = new ClientClass(companyId) as T;
  await client.init();
  
  return client;
}

/**
 * Check if a client can be created (connection exists and is valid)
 */
export async function canCreateClient(
  type: IntegrationType,
  companyId: string
): Promise<boolean> {
  const connection = await integrationTokenStore.getConnection(companyId, type);
  return connection?.status === 'connected' && !!connection.tokens;
}

