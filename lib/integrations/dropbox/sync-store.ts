/**
 * Dropbox Sync State Store
 * 
 * Stores sync status, credentials, and file tracking.
 * Uses DynamoDB in production, in-memory for development.
 */

import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, QueryCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// ============================================================================
// Types
// ============================================================================

export interface DropboxConnection {
  userId: string;
  dropboxAccountId: string;
  displayName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  connectedAt: string;
  lastSync: string | null;
  selectedFolders: string[];
  syncEnabled: boolean;
}

export interface SyncedFile {
  dropboxPath: string;
  dropboxId: string;
  s3Key: string;
  name: string;
  size: number;
  contentHash: string;
  syncedAt: string;
  status: 'synced' | 'pending' | 'error';
  errorMessage?: string;
}

export interface SyncJob {
  jobId: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalFiles: number;
  processedFiles: number;
  addedFiles: number;
  updatedFiles: number;
  errors: string[];
}

// ============================================================================
// In-Memory Store (Development)
// ============================================================================

class InMemorySyncStore {
  private connections: Map<string, DropboxConnection> = new Map();
  private files: Map<string, SyncedFile> = new Map();
  private jobs: Map<string, SyncJob> = new Map();

  async saveConnection(connection: DropboxConnection): Promise<void> {
    this.connections.set(connection.userId, connection);
  }

  async getConnection(userId: string): Promise<DropboxConnection | null> {
    return this.connections.get(userId) || null;
  }

  async deleteConnection(userId: string): Promise<void> {
    this.connections.delete(userId);
  }

  async saveSyncedFile(file: SyncedFile): Promise<void> {
    this.files.set(file.dropboxPath, file);
  }

  async getSyncedFile(dropboxPath: string): Promise<SyncedFile | null> {
    return this.files.get(dropboxPath) || null;
  }

  async listSyncedFiles(limit: number = 100): Promise<SyncedFile[]> {
    return Array.from(this.files.values()).slice(0, limit);
  }

  async deleteSyncedFile(dropboxPath: string): Promise<void> {
    this.files.delete(dropboxPath);
  }

  async saveSyncJob(job: SyncJob): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getLatestSyncJob(userId: string): Promise<SyncJob | null> {
    const userJobs = Array.from(this.jobs.values())
      .filter(j => j.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return userJobs[0] || null;
  }

  async getSyncStats(): Promise<{
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    errorFiles: number;
  }> {
    const files = Array.from(this.files.values());
    return {
      totalFiles: files.length,
      syncedFiles: files.filter(f => f.status === 'synced').length,
      pendingFiles: files.filter(f => f.status === 'pending').length,
      errorFiles: files.filter(f => f.status === 'error').length,
    };
  }
}

// ============================================================================
// DynamoDB Store (Production)
// ============================================================================

class DynamoDBSyncStore {
  private client: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-north-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      } : undefined,
    });
    this.tableName = process.env.DROPBOX_SYNC_TABLE || 'aifm-dropbox-sync';
  }

  async saveConnection(connection: DropboxConnection): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        PK: `CONNECTION#${connection.userId}`,
        SK: 'METADATA',
        ...connection,
        type: 'connection',
      }, { removeUndefinedValues: true }),
    });
    await this.client.send(command);
  }

  async getConnection(userId: string): Promise<DropboxConnection | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `CONNECTION#${userId}`,
        SK: 'METADATA',
      }),
    });
    const result = await this.client.send(command);
    if (!result.Item) return null;
    
    const data = unmarshall(result.Item);
    return {
      userId: data.userId,
      dropboxAccountId: data.dropboxAccountId,
      displayName: data.displayName,
      email: data.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      connectedAt: data.connectedAt,
      lastSync: data.lastSync,
      selectedFolders: data.selectedFolders || [],
      syncEnabled: data.syncEnabled ?? true,
    };
  }

  async deleteConnection(userId: string): Promise<void> {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `CONNECTION#${userId}`,
        SK: 'METADATA',
      }),
    });
    await this.client.send(command);
  }

  async saveSyncedFile(file: SyncedFile): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        PK: 'FILES',
        SK: `FILE#${file.dropboxPath}`,
        ...file,
        type: 'file',
      }, { removeUndefinedValues: true }),
    });
    await this.client.send(command);
  }

  async getSyncedFile(dropboxPath: string): Promise<SyncedFile | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: 'FILES',
        SK: `FILE#${dropboxPath}`,
      }),
    });
    const result = await this.client.send(command);
    if (!result.Item) return null;
    
    const data = unmarshall(result.Item);
    return {
      dropboxPath: data.dropboxPath,
      dropboxId: data.dropboxId,
      s3Key: data.s3Key,
      name: data.name,
      size: data.size,
      contentHash: data.contentHash,
      syncedAt: data.syncedAt,
      status: data.status,
      errorMessage: data.errorMessage,
    };
  }

  async listSyncedFiles(limit: number = 100): Promise<SyncedFile[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: marshall({
        ':pk': 'FILES',
      }),
      Limit: limit,
    });
    const result = await this.client.send(command);
    return (result.Items || []).map(item => {
      const data = unmarshall(item);
      return {
        dropboxPath: data.dropboxPath,
        dropboxId: data.dropboxId,
        s3Key: data.s3Key,
        name: data.name,
        size: data.size,
        contentHash: data.contentHash,
        syncedAt: data.syncedAt,
        status: data.status,
        errorMessage: data.errorMessage,
      };
    });
  }

  async deleteSyncedFile(dropboxPath: string): Promise<void> {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: 'FILES',
        SK: `FILE#${dropboxPath}`,
      }),
    });
    await this.client.send(command);
  }

  async saveSyncJob(job: SyncJob): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        PK: `JOB#${job.userId}`,
        SK: `JOB#${job.jobId}`,
        ...job,
        type: 'job',
      }, { removeUndefinedValues: true }),
    });
    await this.client.send(command);
  }

  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    // This is a simplified version - in production you'd need the userId too
    return null;
  }

  async getLatestSyncJob(userId: string): Promise<SyncJob | null> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: marshall({
        ':pk': `JOB#${userId}`,
      }),
      ScanIndexForward: false, // Descending order
      Limit: 1,
    });
    const result = await this.client.send(command);
    if (!result.Items || result.Items.length === 0) return null;
    
    const data = unmarshall(result.Items[0]);
    return {
      jobId: data.jobId,
      userId: data.userId,
      status: data.status,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      totalFiles: data.totalFiles,
      processedFiles: data.processedFiles,
      addedFiles: data.addedFiles,
      updatedFiles: data.updatedFiles,
      errors: data.errors || [],
    };
  }

  async getSyncStats(): Promise<{
    totalFiles: number;
    syncedFiles: number;
    pendingFiles: number;
    errorFiles: number;
  }> {
    // In production, you'd want to maintain counters or use a scan with filters
    const files = await this.listSyncedFiles(1000);
    return {
      totalFiles: files.length,
      syncedFiles: files.filter(f => f.status === 'synced').length,
      pendingFiles: files.filter(f => f.status === 'pending').length,
      errorFiles: files.filter(f => f.status === 'error').length,
    };
  }
}

// ============================================================================
// Export Store Instance
// ============================================================================

type SyncStore = InMemorySyncStore | DynamoDBSyncStore;

let syncStoreInstance: SyncStore | null = null;

export function getSyncStore(): SyncStore {
  if (!syncStoreInstance) {
    // Use DynamoDB in production if table is configured
    if (process.env.DROPBOX_SYNC_TABLE && process.env.AWS_ACCESS_KEY_ID) {
      syncStoreInstance = new DynamoDBSyncStore();
    } else {
      syncStoreInstance = new InMemorySyncStore();
    }
  }
  return syncStoreInstance;
}
