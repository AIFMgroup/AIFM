/**
 * Generic Integration Types
 * 
 * Defines the contract for all external integrations (Fortnox, Microsoft 365, Scrive, etc.)
 */

// ============================================================================
// Core Types
// ============================================================================

export type IntegrationType = 'fortnox' | 'microsoft' | 'scrive' | 'tink';

export type IntegrationStatus = 
  | 'not_connected'
  | 'connected'
  | 'expired'
  | 'revoked'
  | 'error';

export type OAuthGrantType = 
  | 'authorization_code'
  | 'client_credentials'
  | 'refresh_token';

// ============================================================================
// Integration Configuration
// ============================================================================

export interface IntegrationEndpoints {
  /** OAuth authorization URL */
  authorization: string;
  /** OAuth token exchange URL */
  token: string;
  /** API base URL */
  api: string;
  /** Optional: Token revocation URL */
  revoke?: string;
  /** Optional: User info URL */
  userInfo?: string;
}

export interface IntegrationConfig {
  /** Unique identifier for this integration */
  id: IntegrationType;
  
  /** Display name */
  name: string;
  
  /** Description shown in UI */
  description: string;
  
  /** Icon name (lucide-react) or URL */
  icon: string;
  
  /** OAuth/API endpoints */
  endpoints: IntegrationEndpoints;
  
  /** OAuth client ID (from environment) */
  clientId: string;
  
  /** OAuth client secret (from environment) */
  clientSecret: string;
  
  /** Required OAuth scopes */
  scopes: string[];
  
  /** Whether this integration uses OAuth (vs API key) */
  usesOAuth: boolean;
  
  /** Whether refresh tokens are supported */
  supportsRefresh: boolean;
  
  /** Token expiry buffer in seconds (refresh before actual expiry) */
  tokenExpiryBuffer: number;
  
  /** Features this integration provides */
  features: IntegrationFeature[];
  
  /** Optional: Tenant/organization ID (for multi-tenant like Azure) */
  tenantId?: string;
  
  /** Optional: Custom headers for API calls */
  customHeaders?: Record<string, string>;
  
  /** Optional: Token endpoint auth method */
  tokenAuthMethod?: 'basic' | 'body';
}

export type IntegrationFeature = 
  | 'accounting'
  | 'invoicing'
  | 'banking'
  | 'identity'
  | 'email'
  | 'calendar'
  | 'files'
  | 'signing'
  | 'payments';

// ============================================================================
// Token Management
// ============================================================================

export interface IntegrationTokens {
  /** Access token for API calls */
  accessToken: string;
  
  /** Refresh token for getting new access tokens */
  refreshToken?: string;
  
  /** ISO timestamp when access token expires */
  expiresAt: string;
  
  /** Granted scopes (may differ from requested) */
  scope?: string;
  
  /** Token type (usually "Bearer") */
  tokenType?: string;
  
  /** Optional: ID token (for OIDC) */
  idToken?: string;
}

export interface IntegrationConnection {
  /** Company ID this connection belongs to */
  companyId: string;
  
  /** Integration type */
  integrationType: IntegrationType;
  
  /** Current status */
  status: IntegrationStatus;
  
  /** Encrypted tokens */
  tokens?: IntegrationTokens;
  
  /** External account/organization name */
  externalName?: string;
  
  /** External account/organization ID */
  externalId?: string;
  
  /** Last successful sync timestamp */
  lastSyncAt?: string;
  
  /** Last error message (if status is error) */
  lastError?: string;
  
  /** When the connection was established */
  connectedAt: string;
  
  /** Who connected it (user ID) */
  connectedBy?: string;
  
  /** Last updated timestamp */
  updatedAt: string;
  
  /** Metadata specific to this integration */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Token Store Interface
// ============================================================================

export interface ITokenStore {
  /** Get connection for a company and integration */
  getConnection(companyId: string, integrationType: IntegrationType): Promise<IntegrationConnection | null>;
  
  /** Save/update connection */
  saveConnection(connection: IntegrationConnection): Promise<void>;
  
  /** Update tokens only */
  updateTokens(companyId: string, integrationType: IntegrationType, tokens: IntegrationTokens): Promise<void>;
  
  /** Mark connection as revoked/error */
  setStatus(companyId: string, integrationType: IntegrationType, status: IntegrationStatus, error?: string): Promise<void>;
  
  /** Delete connection */
  deleteConnection(companyId: string, integrationType: IntegrationType): Promise<void>;
  
  /** List all connections for a company */
  listConnections(companyId: string): Promise<IntegrationConnection[]>;
  
  /** List all connections for an integration type (admin) */
  listAllByType(integrationType: IntegrationType): Promise<IntegrationConnection[]>;
  
  /** Acquire refresh lock (prevent concurrent refreshes) */
  acquireRefreshLock(companyId: string, integrationType: IntegrationType, ttlSeconds?: number): Promise<boolean>;
  
  /** Release refresh lock */
  releaseRefreshLock(companyId: string, integrationType: IntegrationType): Promise<void>;
}

// ============================================================================
// OAuth Manager Interface
// ============================================================================

export interface OAuthState {
  /** CSRF protection state */
  state: string;
  
  /** Company ID */
  companyId: string;
  
  /** Integration type */
  integrationType: IntegrationType;
  
  /** URL to return to after OAuth */
  returnTo?: string;
  
  /** Optional: PKCE code verifier */
  codeVerifier?: string;
  
  /** Created timestamp */
  createdAt: string;
}

export interface OAuthCallbackParams {
  /** Authorization code from provider */
  code: string;
  
  /** State parameter for CSRF verification */
  state: string;
  
  /** Error from provider (if any) */
  error?: string;
  
  /** Error description from provider */
  errorDescription?: string;
}

export interface IOAuthManager {
  /** Generate authorization URL */
  getAuthorizationUrl(
    integrationType: IntegrationType,
    companyId: string,
    returnTo?: string,
    host?: string
  ): Promise<{ url: string; state: OAuthState }>;
  
  /** Exchange authorization code for tokens */
  handleCallback(
    integrationType: IntegrationType,
    params: OAuthCallbackParams,
    storedState: OAuthState,
    host?: string
  ): Promise<IntegrationTokens>;
  
  /** Refresh access token */
  refreshTokens(
    integrationType: IntegrationType,
    refreshToken: string
  ): Promise<IntegrationTokens>;
  
  /** Revoke tokens (if supported) */
  revokeTokens(
    integrationType: IntegrationType,
    tokens: IntegrationTokens
  ): Promise<void>;
}

// ============================================================================
// Integration Client Interface
// ============================================================================

export interface IIntegrationClient<TConfig = unknown> {
  /** Integration type */
  readonly integrationType: IntegrationType;
  
  /** Company ID */
  readonly companyId: string;
  
  /** Initialize the client (load tokens, etc.) */
  init(): Promise<void>;
  
  /** Check if client is ready for API calls */
  isReady(): boolean;
  
  /** Make an authenticated API request */
  request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<IntegrationApiResponse<T>>;
  
  /** Get integration-specific configuration */
  getConfig(): TConfig;
}

export interface RequestOptions {
  /** Additional headers */
  headers?: Record<string, string>;
  
  /** Query parameters */
  params?: Record<string, string>;
  
  /** Request timeout in ms */
  timeout?: number;
  
  /** Skip automatic token refresh */
  skipRefresh?: boolean;
}

export interface IntegrationApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookConfig {
  /** Integration type */
  integrationType: IntegrationType;
  
  /** Webhook endpoint path */
  path: string;
  
  /** Secret for signature validation */
  secret?: string;
  
  /** Header containing signature */
  signatureHeader?: string;
  
  /** Signature algorithm */
  signatureAlgorithm?: 'hmac-sha256' | 'hmac-sha1' | 'rsa-sha256';
}

export interface WebhookPayload {
  /** Integration type */
  integrationType: IntegrationType;
  
  /** Event type */
  eventType: string;
  
  /** Event data */
  data: unknown;
  
  /** Timestamp */
  timestamp: string;
  
  /** Company ID (if determinable) */
  companyId?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type IntegrationConfigMap = {
  [K in IntegrationType]?: IntegrationConfig;
};

export interface IntegrationHealthCheck {
  integrationType: IntegrationType;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  lastChecked: string;
  details?: string;
}

