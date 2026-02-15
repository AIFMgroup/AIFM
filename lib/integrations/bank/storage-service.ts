/**
 * Bank Data Storage Service
 * 
 * Hanterar lagring och hämtning av bankdata:
 * - Swedbank PDF:er och extraherad data
 * - SEB API-snapshots (positioner, saldon, transaktioner)
 * - Avstämningsrapporter
 * 
 * S3 Bucket Structure:
 * aifm-bank-data/
 * ├── swedbank/
 * │   ├── emails/           # Raw emails
 * │   ├── pdfs/             # Original PDFs
 * │   └── processed/        # Extracted JSON data
 * ├── seb/
 * │   ├── positions/        # Daily position snapshots
 * │   ├── balances/         # Daily balance snapshots
 * │   └── transactions/     # Transaction history
 * └── reconciliation/
 *     ├── reports/          # Reconciliation results
 *     └── exports/          # Excel exports
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================================
// Types
// ============================================================================

export type DataCategory = 'swedbank' | 'seb' | 'reconciliation';
export type SwedBankSubCategory = 'emails' | 'pdfs' | 'processed';
export type SEBSubCategory = 'positions' | 'balances' | 'transactions';
export type ReconciliationSubCategory = 'reports' | 'exports';
export interface StoredDocument {
  key: string;
  category: DataCategory;
  subCategory: string;
  fileName: string;
  date: string;
  fundId?: string;
  accountId?: string;
  size: number;
  lastModified: Date;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StorageListOptions {
  category: DataCategory;
  subCategory?: string;
  fundId?: string;
  accountId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface StorageSaveOptions {
  category: DataCategory;
  subCategory: string;
  fundId?: string;
  accountId?: string;
  fileName?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

// ============================================================================
// Configuration
// ============================================================================

const BUCKET_NAME = process.env.BANK_DATA_BUCKET || process.env.DATA_BUCKET || 'aifm-bank-data';
const REGION = process.env.AWS_REGION || 'eu-north-1';

// ============================================================================
// S3 Client
// ============================================================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: REGION });
  }
  return s3Client;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate S3 key path based on category, date, and identifiers
 */
function generateKey(
  category: DataCategory,
  subCategory: string,
  date: string,
  fileName: string,
  fundId?: string,
  accountId?: string
): string {
  const datePath = date.replace(/-/g, '/'); // 2026-01-26 -> 2026/01/26
  
  let prefix = `${category}/${subCategory}/${datePath}`;
  
  if (fundId) {
    prefix += `/${fundId}`;
  } else if (accountId) {
    prefix += `/${accountId}`;
  }
  
  return `${prefix}/${fileName}`;
}

/**
 * Parse S3 key to extract metadata
 */
function parseKey(key: string): Partial<StoredDocument> {
  const parts = key.split('/');
  
  // Expected format: category/subCategory/YYYY/MM/DD/[fundId|accountId]/fileName
  const category = parts[0] as DataCategory;
  const subCategory = parts[1];
  const year = parts[2];
  const month = parts[3];
  const day = parts[4];
  const date = `${year}-${month}-${day}`;
  
  // Check if there's an identifier before fileName
  let fundId: string | undefined;
  let accountId: string | undefined;
  let fileName: string;
  
  if (parts.length > 6) {
    const identifier = parts[5];
    fileName = parts.slice(6).join('/');
    
    if (identifier.startsWith('FUND') || identifier.startsWith('SE')) {
      fundId = identifier;
    } else if (identifier.startsWith('SEB-')) {
      accountId = identifier;
    }
  } else {
    fileName = parts[5] || '';
  }
  
  return {
    key,
    category,
    subCategory,
    date,
    fundId,
    accountId,
    fileName,
  };
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate a timestamp-based filename
 */
function generateFileName(prefix: string, extension: string): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}.${extension}`;
}

// ============================================================================
// Storage Service
// ============================================================================

export class BankStorageService {
  private bucket: string;
  private s3: S3Client;

  constructor(bucket?: string) {
    this.bucket = bucket || BUCKET_NAME;
    this.s3 = getS3Client();
  }

  // ==========================================================================
  // Save Operations
  // ==========================================================================

  /**
   * Save data to S3
   */
  async save(
    data: Buffer | string | object,
    options: StorageSaveOptions
  ): Promise<{ key: string; url: string }> {
    const date = getToday();
    const fileName = options.fileName || generateFileName(options.subCategory, 
      options.contentType === 'application/json' ? 'json' : 
      options.contentType === 'application/pdf' ? 'pdf' : 
      options.contentType?.includes('spreadsheet') ? 'xlsx' : 'dat'
    );
    
    const key = generateKey(
      options.category,
      options.subCategory,
      date,
      fileName,
      options.fundId,
      options.accountId
    );
    
    let body: Buffer | string;
    let contentType = options.contentType || 'application/octet-stream';
    
    if (typeof data === 'object' && !(data instanceof Buffer)) {
      body = JSON.stringify(data, null, 2);
      contentType = 'application/json';
    } else {
      body = data as Buffer | string;
    }
    
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: {
        ...options.metadata,
        category: options.category,
        subCategory: options.subCategory,
        date,
        ...(options.fundId && { fundId: options.fundId }),
        ...(options.accountId && { accountId: options.accountId }),
      },
    }));
    
    console.log(`[BankStorage] Saved: ${key}`);
    
    return {
      key,
      url: `s3://${this.bucket}/${key}`,
    };
  }

  /**
   * Save Swedbank PDF
   */
  async saveSwedBankPDF(
    pdfBuffer: Buffer,
    fundId?: string
  ): Promise<{ key: string; url: string }> {
    return this.save(pdfBuffer, {
      category: 'swedbank',
      subCategory: 'pdfs',
      fundId,
      contentType: 'application/pdf',
      fileName: generateFileName('custody-report', 'pdf'),
    });
  }

  /**
   * Save Swedbank processed data
   */
  async saveSwedBankProcessed(
    data: object,
    fundId?: string
  ): Promise<{ key: string; url: string }> {
    return this.save(data, {
      category: 'swedbank',
      subCategory: 'processed',
      fundId,
      contentType: 'application/json',
    });
  }

  /**
   * Save SEB positions snapshot
   */
  async saveSEBPositions(
    positions: object[],
    accountId: string
  ): Promise<{ key: string; url: string }> {
    return this.save(
      { accountId, positions, timestamp: new Date().toISOString() },
      {
        category: 'seb',
        subCategory: 'positions',
        accountId,
        contentType: 'application/json',
        fileName: `${accountId}-positions.json`,
      }
    );
  }

  /**
   * Save SEB balances snapshot
   */
  async saveSEBBalances(
    balances: object[],
    accountId: string
  ): Promise<{ key: string; url: string }> {
    return this.save(
      { accountId, balances, timestamp: new Date().toISOString() },
      {
        category: 'seb',
        subCategory: 'balances',
        accountId,
        contentType: 'application/json',
        fileName: `${accountId}-balances.json`,
      }
    );
  }

  /**
   * Save reconciliation report
   */
  async saveReconciliationReport(
    report: object,
    fundId: string
  ): Promise<{ key: string; url: string }> {
    return this.save(report, {
      category: 'reconciliation',
      subCategory: 'reports',
      fundId,
      contentType: 'application/json',
    });
  }

  /**
   * Save reconciliation Excel export
   */
  async saveReconciliationExport(
    excelBuffer: Buffer,
    fundId: string
  ): Promise<{ key: string; url: string }> {
    return this.save(excelBuffer, {
      category: 'reconciliation',
      subCategory: 'exports',
      fundId,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: generateFileName(`${fundId}-reconciliation`, 'xlsx'),
    });
  }

  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * Get object from S3
   */
  async get(key: string): Promise<{ data: Buffer; contentType: string; metadata: Record<string, string> }> {
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    
    const data = await response.Body?.transformToByteArray();
    
    return {
      data: Buffer.from(data || []),
      contentType: response.ContentType || 'application/octet-stream',
      metadata: response.Metadata || {},
    };
  }

  /**
   * Get JSON object from S3
   */
  async getJSON<T = unknown>(key: string): Promise<T> {
    const { data } = await this.get(key);
    return JSON.parse(data.toString('utf-8'));
  }

  /**
   * Generate presigned URL for download
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  // ==========================================================================
  // List Operations
  // ==========================================================================

  /**
   * List documents with filtering
   */
  async list(options: StorageListOptions): Promise<StoredDocument[]> {
    let prefix = options.category;
    
    if (options.subCategory) {
      prefix += `/${options.subCategory}`;
    }
    
    if (options.fromDate) {
      prefix += `/${options.fromDate.replace(/-/g, '/')}`;
    }
    
    const response = await this.s3.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: options.limit || 100,
    }));
    
    const documents: StoredDocument[] = [];
    
    for (const obj of response.Contents || []) {
      if (!obj.Key) continue;
      
      const parsed = parseKey(obj.Key);
      
      // Apply filters
      if (options.fundId && parsed.fundId !== options.fundId) continue;
      if (options.accountId && parsed.accountId !== options.accountId) continue;
      if (options.toDate && parsed.date && parsed.date > options.toDate) continue;
      
      documents.push({
        key: obj.Key,
        category: parsed.category!,
        subCategory: parsed.subCategory!,
        fileName: parsed.fileName!,
        date: parsed.date!,
        fundId: parsed.fundId,
        accountId: parsed.accountId,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        contentType: this.guessContentType(obj.Key),
      });
    }
    
    // Sort by date descending (newest first)
    documents.sort((a, b) => b.date.localeCompare(a.date));
    
    return documents;
  }

  /**
   * List recent Swedbank reports
   */
  async listSwedBankReports(limit: number = 20): Promise<StoredDocument[]> {
    return this.list({
      category: 'swedbank',
      subCategory: 'processed',
      limit,
    });
  }

  /**
   * List recent SEB snapshots
   */
  async listSEBSnapshots(accountId?: string, limit: number = 20): Promise<StoredDocument[]> {
    return this.list({
      category: 'seb',
      subCategory: 'positions',
      accountId,
      limit,
    });
  }

  /**
   * List reconciliation reports
   */
  async listReconciliationReports(fundId?: string, limit: number = 20): Promise<StoredDocument[]> {
    return this.list({
      category: 'reconciliation',
      subCategory: 'reports',
      fundId,
      limit,
    });
  }

  /**
   * Get reconciliation history for a fund
   */
  async getReconciliationHistory(
    fundId: string,
    fromDate: string,
    toDate: string
  ): Promise<StoredDocument[]> {
    return this.list({
      category: 'reconciliation',
      subCategory: 'reports',
      fundId,
      fromDate,
      toDate,
      limit: 100,
    });
  }

  // ==========================================================================
  // Delete Operations
  // ==========================================================================

  /**
   * Delete object from S3
   */
  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    console.log(`[BankStorage] Deleted: ${key}`);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Guess content type from file extension
   */
  private guessContentType(key: string): string {
    if (key.endsWith('.json')) return 'application/json';
    if (key.endsWith('.pdf')) return 'application/pdf';
    if (key.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (key.endsWith('.csv')) return 'text/csv';
    if (key.endsWith('.eml')) return 'message/rfc822';
    return 'application/octet-stream';
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    byCategory: Record<DataCategory, number>;
    totalSizeBytes: number;
  }> {
    const categories: DataCategory[] = ['swedbank', 'seb', 'reconciliation'];
    const stats = {
      totalDocuments: 0,
      byCategory: {} as Record<DataCategory, number>,
      totalSizeBytes: 0,
    };
    
    for (const category of categories) {
      const docs = await this.list({ category, limit: 1000 });
      stats.byCategory[category] = docs.length;
      stats.totalDocuments += docs.length;
      stats.totalSizeBytes += docs.reduce((sum, d) => sum + d.size, 0);
    }
    
    return stats;
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let storageInstance: BankStorageService | null = null;

export function getBankStorageService(): BankStorageService {
  if (!storageInstance) {
    storageInstance = new BankStorageService();
  }
  return storageInstance;
}

export function resetBankStorageService(): void {
  storageInstance = null;
}
