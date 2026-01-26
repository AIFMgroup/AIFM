/**
 * Integration Manager Index
 * 
 * Central export point for all integration functionality.
 * 
 * Usage:
 * ```ts
 * import { 
 *   createFortnoxClient, 
 *   getIntegrationConfig,
 *   startOAuthFlow,
 *   integrationTokenStore 
 * } from '@/lib/integrations';
 * ```
 */

// Types
export type {
  IntegrationType,
  IntegrationStatus,
  IntegrationConfig,
  IntegrationEndpoints,
  IntegrationTokens,
  IntegrationConnection,
  IntegrationFeature,
  IntegrationApiResponse,
  IntegrationHealthCheck,
  ITokenStore,
  IOAuthManager,
  IIntegrationClient,
  OAuthState,
  OAuthCallbackParams,
  RequestOptions,
  WebhookConfig,
  WebhookPayload,
} from './types';

// Registry
export {
  getIntegrationConfig,
  getAllIntegrations,
  getIntegrationsByFeature,
  isIntegrationConfigured,
  getConfiguredIntegrations,
  getIntegrationDisplayInfo,
  getAllIntegrationsDisplayInfo,
  featureDescriptions,
  integrationCategories,
} from './registry';
export type { IntegrationCategory } from './registry';

// Token Store
export {
  integrationTokenStore,
  isTokenExpired,
  isIntegrationConnected,
  getIntegrationsSummary,
} from './tokenStore';

// OAuth Manager
export {
  oauthManager,
  startOAuthFlow,
  completeOAuthFlow,
} from './oauthManager';

// Base Client
export {
  BaseIntegrationClient,
  registerClient,
  createClient,
  canCreateClient,
} from './baseClient';

// Integration Clients
export {
  // Fortnox
  FortnoxClient,
  createFortnoxClient,
  // Microsoft
  MicrosoftClient,
  createMicrosoftClient,
  // Scrive
  ScriveClient,
  createScriveClient,
  sendForSigning,
} from './clients';

// Re-export client types
export type {
  FortnoxCompanyInfo,
  FortnoxVoucher,
  FortnoxSupplierInvoice,
  FortnoxSupplier,
  FortnoxAccount,
  FortnoxInvoice,
  MicrosoftUser,
  MicrosoftEmail,
  MicrosoftCalendarEvent,
  MicrosoftDriveItem,
  MicrosoftContact,
  ScriveDocument,
  ScriveSignatory,
  ScriveDocumentStatus,
} from './clients';

