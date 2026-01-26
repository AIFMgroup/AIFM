/**
 * Fortnox Token Store
 * 
 * Hanterar lagring och kryptering av Fortnox OAuth-tokens per bolag.
 * Tokens lagras i DynamoDB med AES-256 kryptering.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const REGION = process.env.AWS_REGION || 'eu-north-1';
export const FORTNOX_DDB_TABLE_NAME = process.env.FORTNOX_DDB_TABLE_NAME || 'aifm-fortnox-tokens';

const ENCRYPTION_KEY = process.env.FORTNOX_ENCRYPTION_KEY;

// No top-level throw during build time.
// Next.js build process evaluates modules in production mode, but without production secrets.
if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.NEXT_PHASE?.includes('build')) {
  // This will only trigger at runtime on the server
  console.warn('WARNING: FORTNOX_ENCRYPTION_KEY is not set. Token encryption will use development fallback.');
}

// Fallback for development and build time
const EFFECTIVE_KEY = ENCRYPTION_KEY || 'dev-fallback-key-do-not-use-in-prod-32';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface FortnoxTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO date
  scope: string;
}

export interface FortnoxConnection {
  companyId: string;
  connected: boolean;
  connectedAt?: string;
  connectedBy?: string;
  fortnoxCompanyId?: string;
  fortnoxCompanyName?: string;
  tokens?: FortnoxTokens;
  lastSync?: string;
  lastError?: string;
  revokedAt?: string;
}

// ============ Kryptering ============

function getKey(): Buffer {
  // Ensure key is exactly 32 bytes for AES-256
  return crypto.createHash('sha256').update(EFFECTIVE_KEY).digest();
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ============ Token Store ============

export const fortnoxTokenStore = {
  /**
   * Spara tokens för ett bolag
   */
  async saveTokens(companyId: string, tokens: FortnoxTokens, metadata?: {
    connectedBy?: string;
    fortnoxCompanyId?: string;
    fortnoxCompanyName?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    
    await docClient.send(new PutCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Item: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
        companyId,
        connected: true,
        connectedAt: now,
        connectedBy: metadata?.connectedBy,
        fortnoxCompanyId: metadata?.fortnoxCompanyId,
        fortnoxCompanyName: metadata?.fortnoxCompanyName,
        // Encrypt sensitive tokens
        encryptedAccessToken: encrypt(tokens.accessToken),
        encryptedRefreshToken: encrypt(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        lastSync: now,
        lastError: null,
        revokedAt: null,
        refreshLockUntil: null,
        updatedAt: now,
      }
    }));
    
    console.log(`[FortnoxTokenStore] Saved tokens for company ${companyId}`);
  },

  /**
   * Hämta tokens för ett bolag
   */
  async getTokens(companyId: string): Promise<FortnoxTokens | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: FORTNOX_DDB_TABLE_NAME,
        Key: {
          pk: `COMPANY#${companyId}`,
          sk: 'FORTNOX_CONNECTION',
        }
      }));

      if (!result.Item || !result.Item.connected) {
        return null;
      }

      return {
        accessToken: decrypt(result.Item.encryptedAccessToken as string),
        refreshToken: decrypt(result.Item.encryptedRefreshToken as string),
        expiresAt: result.Item.expiresAt as string,
        scope: result.Item.scope as string,
      };
    } catch (error) {
      console.error(`[FortnoxTokenStore] Error getting tokens for ${companyId}:`, error);
      return null;
    }
  },

  /**
   * Hämta anslutningsstatus för ett bolag
   */
  async getConnection(companyId: string): Promise<FortnoxConnection> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: FORTNOX_DDB_TABLE_NAME,
        Key: {
          pk: `COMPANY#${companyId}`,
          sk: 'FORTNOX_CONNECTION',
        }
      }));

      if (!result.Item) {
        return {
          companyId,
          connected: false,
        };
      }

      return {
        companyId,
        connected: result.Item.connected as boolean,
        connectedAt: result.Item.connectedAt as string,
        connectedBy: result.Item.connectedBy as string,
        fortnoxCompanyId: result.Item.fortnoxCompanyId as string,
        fortnoxCompanyName: result.Item.fortnoxCompanyName as string,
        lastSync: result.Item.lastSync as string,
        lastError: result.Item.lastError as string,
        revokedAt: result.Item.revokedAt as string,
      };
    } catch (error) {
      console.error(`[FortnoxTokenStore] Error getting connection for ${companyId}:`, error);
      return {
        companyId,
        connected: false,
      };
    }
  },

  /**
   * Uppdatera tokens (efter refresh)
   */
  async updateTokens(companyId: string, tokens: FortnoxTokens): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    
    await docClient.send(new UpdateCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
      },
      UpdateExpression: 'SET encryptedAccessToken = :at, encryptedRefreshToken = :rt, expiresAt = :exp, updatedAt = :now, lastError = :null',
      ExpressionAttributeValues: {
        ':at': encrypt(tokens.accessToken),
        ':rt': encrypt(tokens.refreshToken),
        ':exp': tokens.expiresAt,
        ':now': new Date().toISOString(),
        ':null': null,
      }
    }));
    
    console.log(`[FortnoxTokenStore] Updated tokens for company ${companyId}`);
  },

  /**
   * Koppla bort Fortnox
   */
  async disconnect(companyId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
      }
    }));
    
    console.log(`[FortnoxTokenStore] Disconnected company ${companyId}`);
  },

  /**
   * Spara senaste fel
   */
  async setError(companyId: string, error: string): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    
    await docClient.send(new UpdateCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
      },
      UpdateExpression: 'SET lastError = :err, updatedAt = :now',
      ExpressionAttributeValues: {
        ':err': error,
        ':now': new Date().toISOString(),
      }
    }));
  },

  /**
   * Uppdatera senaste synk
   */
  async updateLastSync(companyId: string): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    
    await docClient.send(new UpdateCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
      },
      UpdateExpression: 'SET lastSync = :now, lastError = :null, updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':null': null,
      }
    }));
  },

  /**
   * Markera anslutningen som återkallad/ogiltig (t.ex. invalid_grant vid refresh)
   * Vi behåller record för spårbarhet men kräver ny koppling.
   */
  async markRevoked(companyId: string, reason: string): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
      },
      UpdateExpression: 'SET connected = :false, revokedAt = :now, lastError = :reason, updatedAt = :now',
      ExpressionAttributeValues: {
        ':false': false,
        ':now': now,
        ':reason': reason,
      }
    }));
  },

  /**
   * Refresh-token i Fortnox är single-use. För att undvika race conditions
   * tar vi en kort lock per bolag i DynamoDB innan vi gör refresh.
   */
  async acquireRefreshLock(companyId: string, lockSeconds = 30): Promise<boolean> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    const now = Date.now();
    const lockUntil = new Date(now + lockSeconds * 1000).toISOString();
    const nowIso = new Date(now).toISOString();

    try {
      await docClient.send(new UpdateCommand({
        TableName: FORTNOX_DDB_TABLE_NAME,
        Key: {
          pk: `COMPANY#${companyId}`,
          sk: 'FORTNOX_CONNECTION',
        },
        UpdateExpression: 'SET refreshLockUntil = :lockUntil, updatedAt = :now',
        ConditionExpression: 'attribute_not_exists(refreshLockUntil) OR refreshLockUntil = :null OR refreshLockUntil < :now',
        ExpressionAttributeValues: {
          ':lockUntil': lockUntil,
          ':now': nowIso,
          ':null': null,
        },
      }));
      return true;
    } catch (error) {
      // ConditionalCheckFailed => lock is held
      return false;
    }
  },

  async releaseRefreshLock(companyId: string): Promise<void> {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb');
    await docClient.send(new UpdateCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_CONNECTION',
      },
      UpdateExpression: 'SET refreshLockUntil = :null, updatedAt = :now',
      ExpressionAttributeValues: {
        ':null': null,
        ':now': new Date().toISOString(),
      },
    }));
  },
};




