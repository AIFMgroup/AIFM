/**
 * Integration Registry
 * 
 * Central registry of all available integrations and their configurations.
 * Add new integrations here to make them available throughout the app.
 */

import type {
  IntegrationType,
  IntegrationConfig,
  IntegrationConfigMap,
  IntegrationFeature,
} from './types';

// ============================================================================
// Integration Configurations
// ============================================================================

/**
 * Fortnox Integration
 * Swedish accounting/ERP system
 */
const fortnoxConfig: IntegrationConfig = {
  id: 'fortnox',
  name: 'Fortnox',
  description: 'Koppla till Fortnox för bokföring, fakturering och leverantörsreskontra.',
  icon: 'FileSpreadsheet',
  
  endpoints: {
    authorization: 'https://apps.fortnox.se/oauth-v1/auth',
    token: 'https://apps.fortnox.se/oauth-v1/token',
    api: 'https://api.fortnox.se/3',
    revoke: undefined, // Fortnox doesn't support token revocation
  },
  
  clientId: process.env.FORTNOX_CLIENT_ID || '',
  clientSecret: process.env.FORTNOX_CLIENT_SECRET || '',
  
  scopes: [
    'bookkeeping',
    'invoice',
    'supplier',
    'article',
    'costcenter',
    'project',
    'companyinformation',
  ],
  
  usesOAuth: true,
  supportsRefresh: true,
  tokenExpiryBuffer: 300, // 5 minutes
  tokenAuthMethod: 'basic',
  
  features: ['accounting', 'invoicing'],
};

/**
 * Microsoft 365 Integration
 * Azure AD / Entra ID for identity and Microsoft Graph for services
 */
const microsoftConfig: IntegrationConfig = {
  id: 'microsoft',
  name: 'Microsoft 365',
  description: 'Integrera med Microsoft 365 för e-post, kalender, filer och användarhantering.',
  icon: 'Mail',
  
  endpoints: {
    authorization: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
    token: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/token`,
    api: 'https://graph.microsoft.com/v1.0',
    userInfo: 'https://graph.microsoft.com/v1.0/me',
    revoke: undefined, // Use /me/revokeSignInSessions for full revocation
  },
  
  clientId: process.env.AZURE_CLIENT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  tenantId: process.env.AZURE_TENANT_ID,
  
  scopes: [
    'openid',
    'profile',
    'email',
    'offline_access',
    'User.Read',
    'Mail.Read',
    'Mail.Send',
    'Calendars.ReadWrite',
    'Files.ReadWrite.All',
  ],
  
  usesOAuth: true,
  supportsRefresh: true,
  tokenExpiryBuffer: 300,
  tokenAuthMethod: 'body', // Microsoft prefers credentials in body
  
  features: ['identity', 'email', 'calendar', 'files'],
};

/**
 * Scrive Integration
 * Electronic signature platform
 */
const scriveConfig: IntegrationConfig = {
  id: 'scrive',
  name: 'Scrive',
  description: 'Digital signering av avtal, kontrakt och andra dokument.',
  icon: 'PenTool',
  
  endpoints: {
    authorization: 'https://scrive.com/oauth/authorization',
    token: 'https://scrive.com/oauth/token',
    api: 'https://scrive.com/api/v2',
    revoke: 'https://scrive.com/oauth/revoke',
  },
  
  clientId: process.env.SCRIVE_CLIENT_ID || '',
  clientSecret: process.env.SCRIVE_CLIENT_SECRET || '',
  
  scopes: [
    'FULL_ACCESS', // Scrive uses broad scopes
  ],
  
  usesOAuth: true,
  supportsRefresh: true,
  tokenExpiryBuffer: 300,
  tokenAuthMethod: 'basic',
  
  features: ['signing'],
};

/**
 * Tink Integration
 * Open banking platform for account aggregation
 */
const tinkConfig: IntegrationConfig = {
  id: 'tink',
  name: 'Tink',
  description: 'Automatisk import av banktransaktioner för avstämning.',
  icon: 'Landmark',
  
  endpoints: {
    authorization: 'https://link.tink.com/1.0/authorize',
    token: 'https://api.tink.com/api/v1/oauth/token',
    api: 'https://api.tink.com/api/v1',
    revoke: 'https://api.tink.com/api/v1/oauth/revoke',
  },
  
  clientId: process.env.TINK_CLIENT_ID || '',
  clientSecret: process.env.TINK_CLIENT_SECRET || '',
  
  scopes: [
    'accounts:read',
    'transactions:read',
    'credentials:read',
  ],
  
  usesOAuth: true,
  supportsRefresh: true,
  tokenExpiryBuffer: 300,
  tokenAuthMethod: 'body',
  
  features: ['banking'],
};

// ============================================================================
// Registry
// ============================================================================

const integrationRegistry: IntegrationConfigMap = {
  fortnox: fortnoxConfig,
  microsoft: microsoftConfig,
  scrive: scriveConfig,
  tink: tinkConfig,
};

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Get configuration for a specific integration
 */
export function getIntegrationConfig(type: IntegrationType): IntegrationConfig | undefined {
  return integrationRegistry[type];
}

/**
 * Get all registered integrations
 */
export function getAllIntegrations(): IntegrationConfig[] {
  return Object.values(integrationRegistry).filter((c): c is IntegrationConfig => c !== undefined);
}

/**
 * Get integrations by feature
 */
export function getIntegrationsByFeature(feature: IntegrationFeature): IntegrationConfig[] {
  return getAllIntegrations().filter((config) => config.features.includes(feature));
}

/**
 * Check if an integration is configured (has credentials)
 */
export function isIntegrationConfigured(type: IntegrationType): boolean {
  const config = getIntegrationConfig(type);
  if (!config) return false;
  
  // Check if required credentials are present
  if (config.usesOAuth) {
    return !!(config.clientId && config.clientSecret);
  }
  
  return true;
}

/**
 * Get all configured integrations (ready to use)
 */
export function getConfiguredIntegrations(): IntegrationConfig[] {
  return getAllIntegrations().filter((config) => isIntegrationConfigured(config.id));
}

/**
 * Get integration display info for UI
 */
export function getIntegrationDisplayInfo(type: IntegrationType): {
  name: string;
  description: string;
  icon: string;
  features: IntegrationFeature[];
  configured: boolean;
} | null {
  const config = getIntegrationConfig(type);
  if (!config) return null;
  
  return {
    name: config.name,
    description: config.description,
    icon: config.icon,
    features: config.features,
    configured: isIntegrationConfigured(type),
  };
}

/**
 * Get all integrations with their display info and status
 */
export function getAllIntegrationsDisplayInfo(): Array<{
  id: IntegrationType;
  name: string;
  description: string;
  icon: string;
  features: IntegrationFeature[];
  configured: boolean;
}> {
  return getAllIntegrations().map((config) => ({
    id: config.id,
    name: config.name,
    description: config.description,
    icon: config.icon,
    features: config.features,
    configured: isIntegrationConfigured(config.id),
  }));
}

// ============================================================================
// Feature Descriptions (for UI)
// ============================================================================

export const featureDescriptions: Record<IntegrationFeature, string> = {
  accounting: 'Bokföring',
  invoicing: 'Fakturering',
  banking: 'Bank & Betalningar',
  identity: 'Användarhantering',
  email: 'E-post',
  calendar: 'Kalender',
  files: 'Filhantering',
  signing: 'Digital signering',
  payments: 'Betalningar',
};

// ============================================================================
// Integration Categories (for UI grouping)
// ============================================================================

export const integrationCategories = {
  finance: {
    name: 'Ekonomi & Bokföring',
    integrations: ['fortnox'] as IntegrationType[],
  },
  banking: {
    name: 'Bank & Betalningar',
    integrations: ['tink'] as IntegrationType[],
  },
  productivity: {
    name: 'Produktivitet',
    integrations: ['microsoft'] as IntegrationType[],
  },
  documents: {
    name: 'Dokument & Signering',
    integrations: ['scrive'] as IntegrationType[],
  },
};

export type IntegrationCategory = keyof typeof integrationCategories;

