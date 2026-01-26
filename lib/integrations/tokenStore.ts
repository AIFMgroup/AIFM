/**
 * Generic Integration Token Store
 * 
 * DynamoDB-based storage for integration connections and tokens.
 * Supports encryption, refresh locking, and multi-tenant access.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import type {
  ITokenStore,
  IntegrationConnection,
  IntegrationTokens,
  IntegrationType,
  IntegrationStatus,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.INTEGRATION_TOKENS_TABLE || 'aifm-integration-tokens';
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY;

// Warn at runtime (not build time) if encryption key is missing
if (
  !ENCRYPTION_KEY &&
  process.env.NODE_ENV === 'production' &&
  typeof window === 'undefined' &&
  !process.env.NEXT_PHASE?.includes('build')
) {
  console.warn(
    'WARNING: INTEGRATION_ENCRYPTION_KEY is not set. Token encryption will use development fallback.'
  );
}

const EFFECTIVE_KEY = ENCRYPTION_KEY || 'dev-fallback-key-32-chars-long!!';

// ============================================================================
// Encryption Utilities
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKeyBuffer(): Buffer {
  // Ensure key is exactly 32 bytes for AES-256
  const hash = crypto.createHash('sha256').update(EFFECTIVE_KEY).digest();
  return hash;
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, getKeyBuffer(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

function encryptTokens(tokens: IntegrationTokens): string {
  return encrypt(JSON.stringify(tokens));
}

function decryptTokens(encrypted: string): IntegrationTokens {
  return JSON.parse(decrypt(encrypted));
}

// ============================================================================
// DynamoDB Client
// ============================================================================

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// ============================================================================
// Primary Key Helpers
// ============================================================================

function makePK(companyId: string): string {
  return `COMPANY#${companyId}`;
}

function makeSK(integrationType: IntegrationType): string {
  return `INTEGRATION#${integrationType}`;
}

function makeGSI1PK(integrationType: IntegrationType): string {
  return `TYPE#${integrationType}`;
}

// ============================================================================
// Token Store Implementation
// ============================================================================

class IntegrationTokenStore implements ITokenStore {
  async getConnection(
    companyId: string,
    integrationType: IntegrationType
  ): Promise<IntegrationConnection | null> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: makePK(companyId),
            SK: makeSK(integrationType),
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      const item = result.Item;

      // Decrypt tokens if present
      let tokens: IntegrationTokens | undefined;
      if (item.encryptedTokens) {
        try {
          tokens = decryptTokens(item.encryptedTokens);
        } catch (err) {
          console.error(`[TokenStore] Failed to decrypt tokens for ${companyId}/${integrationType}:`, err);
          // Return connection with error status
          return {
            companyId,
            integrationType,
            status: 'error',
            lastError: 'Failed to decrypt tokens',
            connectedAt: item.connectedAt,
            updatedAt: item.updatedAt,
          };
        }
      }

      return {
        companyId,
        integrationType,
        status: item.status,
        tokens,
        externalName: item.externalName,
        externalId: item.externalId,
        lastSyncAt: item.lastSyncAt,
        lastError: item.lastError,
        connectedAt: item.connectedAt,
        connectedBy: item.connectedBy,
        updatedAt: item.updatedAt,
        metadata: item.metadata,
      };
    } catch (err) {
      console.error(`[TokenStore] Error getting connection:`, err);
      throw err;
    }
  }

  async saveConnection(connection: IntegrationConnection): Promise<void> {
    const now = new Date().toISOString();

    // Encrypt tokens if present
    let encryptedTokens: string | undefined;
    if (connection.tokens) {
      encryptedTokens = encryptTokens(connection.tokens);
    }

    const item = {
      PK: makePK(connection.companyId),
      SK: makeSK(connection.integrationType),
      GSI1PK: makeGSI1PK(connection.integrationType),
      GSI1SK: makePK(connection.companyId),
      companyId: connection.companyId,
      integrationType: connection.integrationType,
      status: connection.status,
      encryptedTokens,
      externalName: connection.externalName,
      externalId: connection.externalId,
      lastSyncAt: connection.lastSyncAt,
      lastError: connection.lastError,
      connectedAt: connection.connectedAt || now,
      connectedBy: connection.connectedBy,
      updatedAt: now,
      metadata: connection.metadata,
      // TTL for expired connections (optional cleanup)
      ...(connection.status === 'revoked' && {
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      }),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );
  }

  async updateTokens(
    companyId: string,
    integrationType: IntegrationType,
    tokens: IntegrationTokens
  ): Promise<void> {
    const now = new Date().toISOString();
    const encryptedTokens = encryptTokens(tokens);

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: makePK(companyId),
          SK: makeSK(integrationType),
        },
        UpdateExpression: 'SET encryptedTokens = :tokens, #status = :status, updatedAt = :now, lastError = :null',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':tokens': encryptedTokens,
          ':status': 'connected',
          ':now': now,
          ':null': null,
        },
      })
    );
  }

  async setStatus(
    companyId: string,
    integrationType: IntegrationType,
    status: IntegrationStatus,
    error?: string
  ): Promise<void> {
    const now = new Date().toISOString();

    const updateExpr = error
      ? 'SET #status = :status, lastError = :error, updatedAt = :now'
      : 'SET #status = :status, updatedAt = :now REMOVE lastError';

    const exprValues: Record<string, unknown> = {
      ':status': status,
      ':now': now,
    };
    if (error) {
      exprValues[':error'] = error;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: makePK(companyId),
          SK: makeSK(integrationType),
        },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: exprValues,
      })
    );
  }

  async deleteConnection(
    companyId: string,
    integrationType: IntegrationType
  ): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: makePK(companyId),
          SK: makeSK(integrationType),
        },
      })
    );
  }

  async listConnections(companyId: string): Promise<IntegrationConnection[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': makePK(companyId),
          ':skPrefix': 'INTEGRATION#',
        },
      })
    );

    const connections: IntegrationConnection[] = [];

    for (const item of result.Items || []) {
      let tokens: IntegrationTokens | undefined;
      if (item.encryptedTokens) {
        try {
          tokens = decryptTokens(item.encryptedTokens);
        } catch {
          // Skip decryption errors, mark as error
        }
      }

      connections.push({
        companyId: item.companyId,
        integrationType: item.integrationType,
        status: item.status,
        tokens,
        externalName: item.externalName,
        externalId: item.externalId,
        lastSyncAt: item.lastSyncAt,
        lastError: item.lastError,
        connectedAt: item.connectedAt,
        connectedBy: item.connectedBy,
        updatedAt: item.updatedAt,
        metadata: item.metadata,
      });
    }

    return connections;
  }

  async listAllByType(integrationType: IntegrationType): Promise<IntegrationConnection[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': makeGSI1PK(integrationType),
        },
      })
    );

    const connections: IntegrationConnection[] = [];

    for (const item of result.Items || []) {
      // Don't decrypt tokens in admin listing for security
      connections.push({
        companyId: item.companyId,
        integrationType: item.integrationType,
        status: item.status,
        externalName: item.externalName,
        externalId: item.externalId,
        lastSyncAt: item.lastSyncAt,
        lastError: item.lastError,
        connectedAt: item.connectedAt,
        connectedBy: item.connectedBy,
        updatedAt: item.updatedAt,
        metadata: item.metadata,
      });
    }

    return connections;
  }

  async acquireRefreshLock(
    companyId: string,
    integrationType: IntegrationType,
    ttlSeconds = 30
  ): Promise<boolean> {
    const lockKey = `LOCK#${companyId}#${integrationType}`;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + ttlSeconds;

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: lockKey,
            SK: 'REFRESH_LOCK',
            expiresAt,
            ttl: expiresAt,
          },
          ConditionExpression: 'attribute_not_exists(PK) OR expiresAt < :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
        })
      );
      return true;
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        return false; // Lock already held
      }
      throw err;
    }
  }

  async releaseRefreshLock(
    companyId: string,
    integrationType: IntegrationType
  ): Promise<void> {
    const lockKey = `LOCK#${companyId}#${integrationType}`;

    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: lockKey,
            SK: 'REFRESH_LOCK',
          },
        })
      );
    } catch {
      // Ignore errors on lock release
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const integrationTokenStore = new IntegrationTokenStore();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a connection's tokens are expired or about to expire
 */
export function isTokenExpired(
  tokens: IntegrationTokens,
  bufferSeconds = 60
): boolean {
  if (!tokens.expiresAt) return false;

  const expiresAt = new Date(tokens.expiresAt).getTime();
  const now = Date.now();
  const buffer = bufferSeconds * 1000;

  return expiresAt - buffer <= now;
}

/**
 * Check if a company has a valid connection to an integration
 */
export async function isIntegrationConnected(
  companyId: string,
  integrationType: IntegrationType
): Promise<boolean> {
  const connection = await integrationTokenStore.getConnection(companyId, integrationType);
  return connection?.status === 'connected' && !!connection.tokens;
}

/**
 * Get connection status summary for a company
 */
export async function getIntegrationsSummary(
  companyId: string
): Promise<Record<IntegrationType, IntegrationStatus>> {
  const connections = await integrationTokenStore.listConnections(companyId);
  
  const summary: Record<string, IntegrationStatus> = {};
  for (const conn of connections) {
    summary[conn.integrationType] = conn.status;
  }
  
  return summary as Record<IntegrationType, IntegrationStatus>;
}

