/**
 * Accounting Job Store - Production Version
 * Uses DynamoDB for metadata and S3 for document storage
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand, 
  DeleteCommand, 
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============ Types ============
export interface LineItem {
  id: string;
  description: string;
  netAmount: number;
  vatAmount: number;
  suggestedAccount: string;
  suggestedCostCenter: string | null;
  confidence: number;
  // Optional "why" for auditability (agent rationale)
  suggestionSource?: string; // e.g. supplier_history | ml_model | category_rules | amount_pattern | ai_inference | policy_override | manual
  suggestionReasoning?: string;
  suggestionAlternatives?: Array<{
    account: string;
    accountName?: string;
    confidence?: number;
    source?: string;
  }>;
}

export interface Classification {
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'BANK' | 'OTHER';
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  vatAmount: number;
  lineItems: LineItem[];
  overallConfidence: number;
  // Optional enrichment fields (used for bank matching, VAT edge cases, and Fortnox mapping)
  paymentReference?: string;
  supplierCountry?: string;
  supplierVatId?: string;
  // FX metadata (when documents are in foreign currency but bookkeeping/posting is SEK)
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  exchangeRateDate?: string;
  exchangeRateSource?: string;
  // Optional policy evaluation (per-company accounting policy / guardrails)
  policy?: {
    appliedAt: string;
    requiresApproval?: boolean;
    summary?: string;
    violations?: Array<{
      code: string;
      field: string;
      message: string;
      severity: 'warning' | 'error';
    }>;
  };
}

export interface MultiReceiptSplitInfo {
  receiptCount: number;
  childJobIds: string[];
  detection?: unknown;
}

export interface AccountingJob {
  id: string;
  companyId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'queued' | 'uploading' | 'scanning' | 'ocr' | 'analyzing' | 'ready' | 'approved' | 'sent' | 'error' | 'split' | 'completed';
  createdAt: string;
  updatedAt: string;
  s3Key?: string;
  fileKey?: string;  // Alternative to s3Key for separated receipts
  fileHash?: string;
  ocrText?: string;
  classification?: Classification;
  fortnoxVoucherId?: string;
  fortnoxInvoiceId?: string; // Fortnox SupplierInvoice GivenNumber
  fortnoxInvoiceStatus?: {
    booked?: boolean;
    cancelled?: boolean;
    credit?: boolean;
    balance?: number;
    lastSyncedAt?: string;
  };
  fortnoxFxVoucherId?: string; // Fortnox voucher id for FX difference posting
  // Bank reconciliation linkage
  bankTransactionId?: string;
  bankMatchConfidence?: number;
  bankMatchedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  sentAt?: string;
  error?: string;
  message?: string;
  processingMetrics?: Record<string, number>;
  // Multi-receipt splitting
  splitInfo?: MultiReceiptSplitInfo;
  // Payment tracking (AP)
  payment?: {
    status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';
    paymentMethod?: 'manual' | 'tink' | 'fortnox';
    scheduledDate?: string;
    paidAt?: string;
    paymentDate?: string; // YYYY-MM-DD (for FX difference calculation)
    bankReference?: string;
    exchangeDifference?: {
      currency: string;
      bookingDate: string;
      paymentDate: string;
      bookingRate: number;
      paymentRate: number;
      originalAmount: number;
      difference: number;
      isGain: boolean;
      account: { account: string; name: string };
      voucherSuggestion?: {
        debitAccount: string;
        debitAccountName: string;
        debitAmount: number;
        creditAccount: string;
        creditAccountName: string;
        creditAmount: number;
        description: string;
      };
    };
  };
  metadata?: {
    isFromMultiReceiptImage?: boolean;
    parentJobId?: string;
    receiptIndex?: number;
    estimatedSupplier?: string;
    estimatedAmount?: string;
    boundingBox?: unknown;
  };
}

// ============ AWS Clients ============
const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';
// Prefer S3_BUCKET (used by processing pipeline), fallback to default bucket.
const BUCKET_NAME = process.env.S3_BUCKET || 'aifm-accounting-docs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: REGION });

// ============ Job Store ============
export const jobStore = {
  async get(jobId: string): Promise<AccountingJob | null> {
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `JOB#${jobId}`, sk: 'METADATA' }
      }));
      
      if (!result.Item) return null;
      
      return mapDynamoToJob(result.Item);
    } catch (error) {
      console.error('DynamoDB get error:', error);
      return null;
    }
  },

  async set(job: AccountingJob): Promise<void> {
    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `JOB#${job.id}`,
          sk: 'METADATA',
          ...job,
        }
      }));
    } catch (error) {
      console.error('DynamoDB put error:', error);
      throw error;
    }
  },

  async update(jobId: string, updates: Partial<AccountingJob>): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, unknown> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    if (updateExpressions.length === 0) return;

    try {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: `JOB#${jobId}`, sk: 'METADATA' },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }));
    } catch (error) {
      console.error('DynamoDB update error:', error);
      throw error;
    }
  },

  async delete(jobId: string): Promise<boolean> {
    try {
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: `JOB#${jobId}`, sk: 'METADATA' }
      }));
      return true;
    } catch (error) {
      console.error('DynamoDB delete error:', error);
      return false;
    }
  },

  async getByCompany(companyId: string): Promise<AccountingJob[]> {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'companyId-createdAt-index',
        KeyConditionExpression: 'companyId = :companyId',
        ExpressionAttributeValues: { ':companyId': companyId },
        ScanIndexForward: false, // Newest first
      }));

      return (result.Items || []).map(mapDynamoToJob);
    } catch (error) {
      console.error('DynamoDB query error:', error);
      return [];
    }
  },

  generateId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Alias for compatibility
  async getJob(jobId: string): Promise<AccountingJob | null> {
    return this.get(jobId);
  },

  async updateJob(jobId: string, updates: Partial<AccountingJob>): Promise<void> {
    return this.update(jobId, updates);
  },
};

// ============ S3 Document Store ============
export const documentStore = {
  async upload(jobId: string, fileName: string, fileBuffer: Buffer, contentType: string): Promise<string> {
    const s3Key = `documents/${jobId}/${fileName}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    }));

    return s3Key;
  },

  async getSignedUrl(s3Key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn });
  },

  async delete(s3Key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    }));
  },

  async getBuffer(s3Key: string): Promise<Buffer> {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    }));
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  },
};

// ============ Helpers ============
function mapDynamoToJob(item: Record<string, unknown>): AccountingJob {
  return {
    id: item.id as string,
    companyId: item.companyId as string,
    fileName: item.fileName as string,
    fileType: item.fileType as string,
    fileSize: item.fileSize as number,
    status: item.status as AccountingJob['status'],
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
    s3Key: item.s3Key as string | undefined,
    fileHash: item.fileHash as string | undefined,
    ocrText: item.ocrText as string | undefined,
    classification: item.classification as Classification | undefined,
    fortnoxVoucherId: item.fortnoxVoucherId as string | undefined,
    fortnoxInvoiceId: item.fortnoxInvoiceId as string | undefined,
    fortnoxInvoiceStatus: item.fortnoxInvoiceStatus as AccountingJob['fortnoxInvoiceStatus'] | undefined,
    fortnoxFxVoucherId: item.fortnoxFxVoucherId as string | undefined,
    bankTransactionId: item.bankTransactionId as string | undefined,
    bankMatchConfidence: item.bankMatchConfidence as number | undefined,
    bankMatchedAt: item.bankMatchedAt as string | undefined,
    approvedBy: item.approvedBy as string | undefined,
    approvedAt: item.approvedAt as string | undefined,
    sentAt: item.sentAt as string | undefined,
    error: item.error as string | undefined,
    payment: item.payment as AccountingJob['payment'] | undefined,
  };
}

// ============ Account Options (re-exported from basKontoplan) ============
export { vanligaKostnadskonton, getKontoOptions, allaKonton, hittaBastaKonto } from './basKontoplan';

// Account options for dropdowns (computed from BAS kontoplan)
import { vanligaKostnadskonton as basKonton } from './basKontoplan';
export const accountOptions = basKonton.map(k => ({
  value: k.konto,
  label: `${k.konto} – ${k.namn}`,
  category: k.kategori,
}));

export const costCenterOptions = [
  { value: '', label: 'Inget kostnadsställe' },
  { value: 'ADM', label: 'ADM – Administration' },
  { value: 'FUND1', label: 'FUND1 – Nordic Ventures I' },
  { value: 'FUND2', label: 'FUND2 – Nordic Ventures II' },
  { value: 'SALES', label: 'SALES – Försäljning' },
];

// Fortnox integration moved to @/lib/fortnox/voucherService.ts
