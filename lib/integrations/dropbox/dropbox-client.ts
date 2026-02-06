/**
 * Dropbox Integration Client
 * 
 * Handles OAuth authentication and file operations with Dropbox API.
 * Syncs documents to S3 for indexing in AWS Bedrock Knowledge Base.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// Types
// ============================================================================

export interface DropboxConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface DropboxFile {
  id: string;
  name: string;
  path: string;
  size: number;
  modified: string;
  isFolder: boolean;
  contentHash?: string;
}

export interface DropboxSyncStatus {
  isConnected: boolean;
  lastSync: string | null;
  totalFiles: number;
  syncedFiles: number;
  pendingFiles: number;
  failedFiles: number;
  syncInProgress: boolean;
  selectedFolders: string[];
}

export interface SyncResult {
  success: boolean;
  filesProcessed: number;
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  errors: string[];
  duration: number;
}

export interface DropboxTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// Supported File Types
// ============================================================================

const SUPPORTED_EXTENSIONS = [
  // Documents
  '.pdf', '.doc', '.docx', '.txt', '.md', '.rtf',
  // Spreadsheets  
  '.xls', '.xlsx', '.csv',
  // Presentations
  '.ppt', '.pptx',
  // Images (for OCR)
  '.png', '.jpg', '.jpeg', '.tiff',
  // Data
  '.json', '.xml',
];

function isSupportedFile(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext);
}

// ============================================================================
// Dropbox Client
// ============================================================================

export class DropboxClient {
  private config: DropboxConfig;
  private s3Client: S3Client;
  private s3Bucket: string;
  private s3Prefix: string;

  constructor(config: DropboxConfig) {
    this.config = config;
    this.s3Bucket = process.env.KNOWLEDGE_BASE_S3_BUCKET || 'aifm-knowledge-base';
    this.s3Prefix = process.env.KNOWLEDGE_BASE_S3_PREFIX || 'dropbox-documents';
    
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'eu-north-1',
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      } : undefined,
    });
  }

  // ==========================================================================
  // OAuth Methods
  // ==========================================================================

  /**
   * Generate OAuth authorization URL for user to connect Dropbox
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      state: state,
      token_access_type: 'offline', // Get refresh token
    });

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<DropboxTokenResponse> {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const tokens: DropboxTokenResponse = await response.json();
    
    // Update config with new tokens
    this.config.accessToken = tokens.access_token;
    this.config.refreshToken = tokens.refresh_token;
    this.config.expiresAt = Date.now() + (tokens.expires_in * 1000);

    return tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokens: DropboxTokenResponse = await response.json();
    this.config.accessToken = tokens.access_token;
    this.config.expiresAt = Date.now() + (tokens.expires_in * 1000);
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.config.accessToken) {
      throw new Error('Not authenticated with Dropbox');
    }

    // Refresh if token expires in less than 5 minutes
    if (this.config.expiresAt && this.config.expiresAt < Date.now() + 300000) {
      await this.refreshAccessToken();
    }
  }

  // ==========================================================================
  // File Operations
  // ==========================================================================

  /**
   * List all files in a folder (recursive)
   */
  async listFiles(path: string = '', recursive: boolean = true): Promise<DropboxFile[]> {
    await this.ensureValidToken();

    const files: DropboxFile[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const endpoint: string = cursor 
        ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
        : 'https://api.dropboxapi.com/2/files/list_folder';

      const body = cursor 
        ? { cursor }
        : { 
            path: path || '', 
            recursive,
            include_deleted: false,
            include_has_explicit_shared_members: false,
            include_mounted_folders: true,
            include_non_downloadable_files: false,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list files: ${error}`);
      }

      const data = await response.json();

      for (const entry of data.entries) {
        files.push({
          id: entry.id,
          name: entry.name,
          path: entry.path_display || entry.path_lower,
          size: entry.size || 0,
          modified: entry.server_modified || entry.client_modified || new Date().toISOString(),
          isFolder: entry['.tag'] === 'folder',
          contentHash: entry.content_hash,
        });
      }

      hasMore = data.has_more;
      cursor = data.cursor;
    }

    return files;
  }

  /**
   * Download a file from Dropbox
   */
  async downloadFile(path: string): Promise<Buffer> {
    await this.ensureValidToken();

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${path}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get account info
   */
  async getAccountInfo(): Promise<{ displayName: string; email: string; accountId: string }> {
    await this.ensureValidToken();

    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get account info');
    }

    const data = await response.json();
    return {
      displayName: data.name.display_name,
      email: data.email,
      accountId: data.account_id,
    };
  }

  // ==========================================================================
  // S3 Sync Methods
  // ==========================================================================

  /**
   * Upload a file to S3 for knowledge base indexing
   */
  async uploadToS3(dropboxPath: string, content: Buffer, metadata: Record<string, string>): Promise<string> {
    // Create S3 key from Dropbox path
    const s3Key = `${this.s3Prefix}${dropboxPath}`;

    // Determine content type
    const ext = dropboxPath.toLowerCase().substring(dropboxPath.lastIndexOf('.'));
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    };

    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: s3Key,
      Body: content,
      ContentType: contentTypes[ext] || 'application/octet-stream',
      Metadata: {
        ...metadata,
        'dropbox-path': dropboxPath,
        'sync-date': new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);
    return s3Key;
  }

  /**
   * Remove a file from S3
   */
  async removeFromS3(dropboxPath: string): Promise<void> {
    const s3Key = `${this.s3Prefix}${dropboxPath}`;
    
    const command = new DeleteObjectCommand({
      Bucket: this.s3Bucket,
      Key: s3Key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Sync files from Dropbox to S3
   */
  async syncToS3(
    folders: string[] = [''],
    onProgress?: (processed: number, total: number, currentFile: string) => void
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      filesProcessed: 0,
      filesAdded: 0,
      filesUpdated: 0,
      filesRemoved: 0,
      errors: [],
      duration: 0,
    };

    try {
      // List all files from specified folders
      const allFiles: DropboxFile[] = [];
      for (const folder of folders) {
        const files = await this.listFiles(folder, true);
        allFiles.push(...files);
      }

      // Filter to supported files only
      const supportedFiles = allFiles.filter(f => !f.isFolder && isSupportedFile(f.name));
      const totalFiles = supportedFiles.length;

      console.log(`[Dropbox Sync] Found ${totalFiles} supported files to sync`);

      // Process files in batches
      const BATCH_SIZE = 10;
      for (let i = 0; i < supportedFiles.length; i += BATCH_SIZE) {
        const batch = supportedFiles.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (file) => {
          try {
            onProgress?.(result.filesProcessed, totalFiles, file.name);

            // Download from Dropbox
            const content = await this.downloadFile(file.path);

            // Upload to S3 with metadata
            await this.uploadToS3(file.path, content, {
              'original-name': file.name,
              'dropbox-id': file.id,
              'modified-date': file.modified,
              'content-hash': file.contentHash || '',
            });

            result.filesAdded++;
          } catch (error) {
            const errorMsg = `Failed to sync ${file.path}: ${(error as Error).message}`;
            result.errors.push(errorMsg);
            console.error(`[Dropbox Sync] ${errorMsg}`);
          }

          result.filesProcessed++;
        }));

        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < supportedFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push((error as Error).message);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let dropboxClientInstance: DropboxClient | null = null;

export function getDropboxClient(): DropboxClient | null {
  if (!process.env.DROPBOX_CLIENT_ID || !process.env.DROPBOX_CLIENT_SECRET) {
    return null;
  }

  if (!dropboxClientInstance) {
    dropboxClientInstance = new DropboxClient({
      clientId: process.env.DROPBOX_CLIENT_ID,
      clientSecret: process.env.DROPBOX_CLIENT_SECRET,
      redirectUri: process.env.DROPBOX_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/dropbox/callback`,
      accessToken: process.env.DROPBOX_ACCESS_TOKEN,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
    });
  }

  return dropboxClientInstance;
}

export function isDropboxConfigured(): boolean {
  return !!(process.env.DROPBOX_CLIENT_ID && process.env.DROPBOX_CLIENT_SECRET);
}
