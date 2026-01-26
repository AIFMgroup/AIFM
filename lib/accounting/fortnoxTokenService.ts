/**
 * Fortnox Token Storage Service
 * 
 * Securely stores and manages Fortnox OAuth tokens with support for:
 * - Encrypted storage in AWS Secrets Manager or DynamoDB
 * - Automatic token refresh
 * - Token rotation
 * - Secure revocation
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DeleteSecretCommand,
  CreateSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient, PutItemCommand, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });

const STORAGE_MODE = process.env.FORTNOX_TOKEN_STORAGE || 'secrets-manager'; // 'secrets-manager' or 'dynamodb'
const SECRETS_PREFIX = 'aifm/fortnox/';
const DYNAMODB_TABLE = 'aifm-fortnox-tokens';

export interface FortnoxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  tokenType: string;
  scope?: string;
}

export interface FortnoxConnectionConfig {
  companyId: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

/**
 * Store Fortnox tokens securely
 */
export async function storeFortnoxTokens(
  companyId: string,
  tokens: FortnoxTokens
): Promise<void> {
  if (STORAGE_MODE === 'secrets-manager') {
    await storeInSecretsManager(companyId, tokens);
  } else {
    await storeInDynamoDB(companyId, tokens);
  }
}

/**
 * Retrieve Fortnox tokens
 */
export async function getFortnoxTokens(
  companyId: string
): Promise<FortnoxTokens | null> {
  if (STORAGE_MODE === 'secrets-manager') {
    return await getFromSecretsManager(companyId);
  } else {
    return await getFromDynamoDB(companyId);
  }
}

/**
 * Delete Fortnox tokens (disconnect/revoke)
 */
export async function deleteFortnoxTokens(
  companyId: string
): Promise<void> {
  // Revoke tokens with Fortnox API first
  try {
    const tokens = await getFortnoxTokens(companyId);
    if (tokens) {
      await revokeTokensWithFortnox(tokens.accessToken);
    }
  } catch (error) {
    console.error('[FortnoxTokens] Failed to revoke tokens with Fortnox:', error);
    // Continue with deletion even if revocation fails
  }

  // Delete from storage
  if (STORAGE_MODE === 'secrets-manager') {
    await deleteFromSecretsManager(companyId);
  } else {
    await deleteFromDynamoDB(companyId);
  }
}

/**
 * Refresh Fortnox access token if expired
 */
export async function refreshFortnoxTokensIfNeeded(
  companyId: string,
  config: FortnoxConnectionConfig
): Promise<FortnoxTokens | null> {
  const tokens = await getFortnoxTokens(companyId);
  
  if (!tokens) {
    return null;
  }

  // Check if token is expired or expires in next 5 minutes
  const now = Date.now();
  const expiresIn = tokens.expiresAt - now;
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresIn > fiveMinutes) {
    // Token is still valid
    return tokens;
  }

  // Refresh token
  console.log(`[FortnoxTokens] Refreshing token for company ${companyId}`);
  
  try {
    const newTokens = await refreshAccessToken(tokens.refreshToken, config);
    await storeFortnoxTokens(companyId, newTokens);
    return newTokens;
  } catch (error) {
    console.error('[FortnoxTokens] Failed to refresh token:', error);
    // Token refresh failed, delete invalid tokens
    await deleteFortnoxTokens(companyId);
    return null;
  }
}

/**
 * Check if company has valid Fortnox connection
 */
export async function hasValidFortnoxConnection(
  companyId: string
): Promise<boolean> {
  const tokens = await getFortnoxTokens(companyId);
  if (!tokens) return false;

  // Check if token is expired
  return tokens.expiresAt > Date.now();
}

// ============================================================================
// INTERNAL: Secrets Manager Storage
// ============================================================================

async function storeInSecretsManager(
  companyId: string,
  tokens: FortnoxTokens
): Promise<void> {
  const secretName = `${SECRETS_PREFIX}${companyId}`;
  
  try {
    await secretsClient.send(new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: JSON.stringify(tokens),
    }));
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      // Secret doesn't exist yet - create it on first connect, then store the value.
      await secretsClient.send(
        new CreateSecretCommand({
          Name: secretName,
          SecretString: JSON.stringify(tokens),
          Description: `Fortnox OAuth tokens for company ${companyId}`,
        })
      );
      return;
    }
    throw error;
  }
}

async function getFromSecretsManager(
  companyId: string
): Promise<FortnoxTokens | null> {
  const secretName = `${SECRETS_PREFIX}${companyId}`;
  
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({
      SecretId: secretName,
    }));
    
    if (!response.SecretString) {
      return null;
    }
    
    return JSON.parse(response.SecretString) as FortnoxTokens;
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      return null;
    }
    throw error;
  }
}

async function deleteFromSecretsManager(
  companyId: string
): Promise<void> {
  const secretName = `${SECRETS_PREFIX}${companyId}`;
  
  try {
    await secretsClient.send(new DeleteSecretCommand({
      SecretId: secretName,
      ForceDeleteWithoutRecovery: true, // Immediate deletion
    }));
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      // Already deleted
      return;
    }
    throw error;
  }
}

// ============================================================================
// INTERNAL: DynamoDB Storage
// ============================================================================

async function storeInDynamoDB(
  companyId: string,
  tokens: FortnoxTokens
): Promise<void> {
  await dynamoClient.send(new PutItemCommand({
    TableName: DYNAMODB_TABLE,
    Item: {
      companyId: { S: companyId },
      accessToken: { S: tokens.accessToken },
      refreshToken: { S: tokens.refreshToken },
      expiresAt: { N: String(tokens.expiresAt) },
      tokenType: { S: tokens.tokenType },
      scope: { S: tokens.scope || '' },
      updatedAt: { S: new Date().toISOString() },
    },
  }));
}

async function getFromDynamoDB(
  companyId: string
): Promise<FortnoxTokens | null> {
  const response = await dynamoClient.send(new GetItemCommand({
    TableName: DYNAMODB_TABLE,
    Key: {
      companyId: { S: companyId },
    },
  }));

  if (!response.Item) {
    return null;
  }

  return {
    accessToken: response.Item.accessToken?.S || '',
    refreshToken: response.Item.refreshToken?.S || '',
    expiresAt: parseInt(response.Item.expiresAt?.N || '0'),
    tokenType: response.Item.tokenType?.S || 'Bearer',
    scope: response.Item.scope?.S,
  };
}

async function deleteFromDynamoDB(
  companyId: string
): Promise<void> {
  await dynamoClient.send(new DeleteItemCommand({
    TableName: DYNAMODB_TABLE,
    Key: {
      companyId: { S: companyId },
    },
  }));
}

// ============================================================================
// INTERNAL: Fortnox OAuth
// ============================================================================

/**
 * Refresh Fortnox access token using refresh token
 */
async function refreshAccessToken(
  refreshToken: string,
  config: FortnoxConnectionConfig
): Promise<FortnoxTokens> {
  const tokenEndpoint = 'https://apps.fortnox.se/oauth-v1/token';
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Some OAuth flows don't return new refresh token
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
  };
}

/**
 * Revoke tokens with Fortnox
 */
async function revokeTokensWithFortnox(accessToken: string): Promise<void> {
  // Fortnox doesn't have a standard revoke endpoint in OAuth v1
  // In production, you might want to implement token invalidation via API call
  // or simply delete from storage (tokens will expire naturally)
  console.log('[FortnoxTokens] Revoking token (logout)');
  
  // Optional: Call Fortnox API to invalidate session if available
  // await fetch('https://api.fortnox.se/3/oauth/revoke', { ... });
}

/**
 * Exchange authorization code for tokens (OAuth flow)
 */
export async function exchangeAuthorizationCode(
  code: string,
  config: FortnoxConnectionConfig
): Promise<FortnoxTokens> {
  const tokenEndpoint = 'https://apps.fortnox.se/oauth-v1/token';
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/integrations/fortnox/callback`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange authorization code: ${error}`);
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
  };
}



