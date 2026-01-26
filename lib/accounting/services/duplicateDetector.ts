/**
 * Duplicate Detection Service
 * 
 * Förhindrar dubbelbetalningar genom att:
 * 1. Kontrollera fakturanummer + leverantör
 * 2. Kontrollera belopp + datum + leverantör (fuzzy match)
 * 3. Kontrollera filhash (exakt samma fil)
 * 
 * Stödjer:
 * - Idempotens (samma request ger samma resultat)
 * - Manuell override (användare kan godkänna trots varning)
 * - Audit trail för alla override-beslut
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: 'exact' | 'likely' | 'possible' | 'none';
  reason?: string;
  existingJobId?: string;
  existingJobDate?: string;
  matchType?: 'invoice_number' | 'amount_date' | 'file_hash';
  
  // Nya fält för override-hantering
  canOverride: boolean;
  overrideRequiresReason: boolean;
  checkId?: string;  // Unikt ID för denna kontroll (för idempotens)
}

export interface DocumentFingerprint {
  companyId: string;
  supplier: string;
  invoiceNumber?: string;
  totalAmount: number;
  invoiceDate: string;
  fileHash: string;
}

export interface DuplicateOverride {
  overrideId: string;
  checkId: string;
  companyId: string;
  originalJobId: string;      // Det befintliga dokumentet
  newJobId: string;           // Det nya dokumentet som godkänns trots varning
  matchType: DuplicateCheckResult['matchType'];
  // Optional linkage for strict override matching
  newFileHash?: string;
  
  // Vem och varför
  overriddenBy: string;       // userId
  overriddenByEmail?: string;
  overriddenAt: string;
  reason: string;             // Obligatorisk motivering
  
  // Kontext
  originalDocument?: {
    supplier: string;
    amount: number;
    invoiceNumber?: string;
    invoiceDate: string;
  };
  newDocument?: {
    supplier: string;
    amount: number;
    invoiceNumber?: string;
    invoiceDate: string;
  };
}

export interface IdempotencyRecord {
  requestId: string;
  companyId: string;
  fileHash: string;
  result: DuplicateCheckResult;
  createdAt: string;
  ttl: number;
}

/**
 * Kontrollera om ett dokument är en duplikat
 * 
 * @param fingerprint - Dokumentets fingeravtryck
 * @param options - Extra alternativ
 * @param options.requestId - Unikt ID för idempotens (om samma requestId skickas igen, returneras cachat resultat)
 * @param options.skipCache - Hoppa över idempotens-cache
 */
export async function checkForDuplicate(
  fingerprint: DocumentFingerprint,
  options?: {
    requestId?: string;
    skipCache?: boolean;
  }
): Promise<DuplicateCheckResult> {
  const { requestId, skipCache = false } = options || {};
  
  // Generera checkId för denna kontroll
  const checkId = requestId || generateCheckId(fingerprint);
  
  // Idempotens: kolla om vi redan har ett resultat för denna request
  if (!skipCache && requestId) {
    const cached = await getIdempotencyRecord(fingerprint.companyId, requestId);
    if (cached) {
      console.log(`[DuplicateDetector] Returning cached result for requestId: ${requestId}`);
      return cached.result;
    }
  }
  
  const normalizedSupplier = normalizeSupplier(fingerprint.supplier);
  let result: DuplicateCheckResult;
  
  // Check 1: Exakt fakturanummer + leverantör
  if (fingerprint.invoiceNumber) {
    const invoiceMatch = await findByInvoiceNumber(
      fingerprint.companyId,
      normalizedSupplier,
      fingerprint.invoiceNumber
    );
    
    if (invoiceMatch) {
      // Kolla om det finns en override
      const hasOverride = await checkForOverride(fingerprint.companyId, invoiceMatch.jobId, fingerprint.fileHash);
      
      if (hasOverride) {
        console.log(`[DuplicateDetector] Override exists for invoice ${fingerprint.invoiceNumber}`);
        result = {
          isDuplicate: false,
          confidence: 'none',
          checkId,
          canOverride: false,
          overrideRequiresReason: false,
        };
      } else {
        result = {
          isDuplicate: true,
          confidence: 'exact',
          reason: `Fakturanummer "${fingerprint.invoiceNumber}" från ${fingerprint.supplier} finns redan`,
          existingJobId: invoiceMatch.jobId,
          existingJobDate: invoiceMatch.createdAt,
          matchType: 'invoice_number',
          checkId,
          canOverride: true,  // Kan overridas om det är en annan faktura med samma nummer
          overrideRequiresReason: true,
        };
      }
      
      // Spara idempotens-record
      if (requestId) {
        await saveIdempotencyRecord(fingerprint.companyId, requestId, fingerprint.fileHash, result);
      }
      return result;
    }
  }
  
  // Check 2: Samma fil (hash)
  const hashMatch = await findByFileHash(fingerprint.companyId, fingerprint.fileHash);
  if (hashMatch) {
    result = {
      isDuplicate: true,
      confidence: 'exact',
      reason: 'Exakt samma fil har redan laddats upp',
      existingJobId: hashMatch.jobId,
      existingJobDate: hashMatch.createdAt,
      matchType: 'file_hash',
      checkId,
      canOverride: false,  // Exakt samma fil kan inte overridas
      overrideRequiresReason: false,
    };
    
    if (requestId) {
      await saveIdempotencyRecord(fingerprint.companyId, requestId, fingerprint.fileHash, result);
    }
    return result;
  }
  
  // Check 3: Belopp + datum + leverantör (fuzzy)
  const amountMatch = await findByAmountAndDate(
    fingerprint.companyId,
    normalizedSupplier,
    fingerprint.totalAmount,
    fingerprint.invoiceDate
  );
  
  if (amountMatch) {
    // Kolla om det finns en override
    const hasOverride = await checkForOverride(fingerprint.companyId, amountMatch.jobId, fingerprint.fileHash);
    
    if (hasOverride) {
      result = {
        isDuplicate: false,
        confidence: 'none',
        checkId,
        canOverride: false,
        overrideRequiresReason: false,
      };
    } else {
      result = {
        isDuplicate: false, // Inte säkert, men varna
        confidence: 'possible',
        reason: `Liknande belopp (${fingerprint.totalAmount} SEK) från ${fingerprint.supplier} finns från ${amountMatch.createdAt}`,
        existingJobId: amountMatch.jobId,
        existingJobDate: amountMatch.createdAt,
        matchType: 'amount_date',
        checkId,
        canOverride: true,
        overrideRequiresReason: true,
      };
    }
    
    if (requestId) {
      await saveIdempotencyRecord(fingerprint.companyId, requestId, fingerprint.fileHash, result);
    }
    return result;
  }
  
  result = {
    isDuplicate: false,
    confidence: 'none',
    checkId,
    canOverride: false,
    overrideRequiresReason: false,
  };
  
  if (requestId) {
    await saveIdempotencyRecord(fingerprint.companyId, requestId, fingerprint.fileHash, result);
  }
  return result;
}

/**
 * Registrera en manuell override av duplikatvarning
 */
export async function registerDuplicateOverride(params: {
  companyId: string;
  checkId: string;
  originalJobId: string;
  newJobId: string;
  newFileHash?: string;
  matchType: DuplicateCheckResult['matchType'];
  userId: string;
  userEmail?: string;
  reason: string;
  originalDocument?: DuplicateOverride['originalDocument'];
  newDocument?: DuplicateOverride['newDocument'];
}): Promise<DuplicateOverride> {
  if (!params.reason || params.reason.trim().length < 10) {
    throw new Error('Override kräver en motivering på minst 10 tecken');
  }
  
  const now = new Date().toISOString();
  const overrideId = `override-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  const override: DuplicateOverride = {
    overrideId,
    checkId: params.checkId,
    companyId: params.companyId,
    originalJobId: params.originalJobId,
    newJobId: params.newJobId,
    matchType: params.matchType,
    newFileHash: params.newFileHash,
    overriddenBy: params.userId,
    overriddenByEmail: params.userEmail,
    overriddenAt: now,
    reason: params.reason.trim(),
    originalDocument: params.originalDocument,
    newDocument: params.newDocument,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `OVERRIDE#${params.companyId}`,
      sk: `${params.originalJobId}#${params.newJobId}`,
      gsi1pk: `OVERRIDE_USER#${params.userId}`,
      gsi1sk: now,
      ...override,
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60), // 7 år
    },
  }));
  
  console.log(`[DuplicateDetector] Override registered: ${overrideId} by ${params.userId}`);
  console.log(`[DuplicateDetector] Reason: ${params.reason}`);
  
  return override;
}

/**
 * Hämta alla overrides för ett bolag
 */
export async function getOverrides(
  companyId: string,
  options?: { limit?: number; userId?: string }
): Promise<DuplicateOverride[]> {
  const { limit = 100, userId } = options || {};
  
  try {
    if (userId) {
      const result = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'gsi1pk-gsi1sk-index',
        KeyConditionExpression: 'gsi1pk = :userId',
        ExpressionAttributeValues: {
          ':userId': `OVERRIDE_USER#${userId}`,
        },
        Limit: limit,
        ScanIndexForward: false,
      }));
      return (result.Items || []) as DuplicateOverride[];
    }
    
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `OVERRIDE#${companyId}`,
      },
      Limit: limit,
      ScanIndexForward: false,
    }));
    return (result.Items || []) as DuplicateOverride[];
    
  } catch (error) {
    console.error('[DuplicateDetector] Get overrides error:', error);
    return [];
  }
}

/**
 * Registrera dokument-fingerprint för framtida duplikatkontroll
 */
export async function registerFingerprint(
  jobId: string,
  fingerprint: DocumentFingerprint
): Promise<void> {
  const normalizedSupplier = normalizeSupplier(fingerprint.supplier);
  const now = new Date().toISOString();
  
  // Spara fingerprint
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `FINGERPRINT#${fingerprint.companyId}`,
      sk: `${normalizedSupplier}#${fingerprint.invoiceNumber || fingerprint.fileHash}`,
      jobId,
      supplier: fingerprint.supplier,
      normalizedSupplier,
      invoiceNumber: fingerprint.invoiceNumber,
      totalAmount: fingerprint.totalAmount,
      invoiceDate: fingerprint.invoiceDate,
      fileHash: fingerprint.fileHash,
      createdAt: now,
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60), // 7 år (Bokföringslagen)
    }
  }));
  
  // Spara även hash-index för snabb lookup
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `HASH#${fingerprint.companyId}`,
      sk: fingerprint.fileHash,
      jobId,
      createdAt: now,
      ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
    }
  }));
}

/**
 * Ta bort fingerprint när ett dokument raderas
 */
export async function removeFingerprint(
  companyId: string,
  fileHash: string,
  supplier?: string,
  invoiceNumber?: string
): Promise<void> {
  const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
  
  try {
    // Ta bort hash-index
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `HASH#${companyId}`,
        sk: fileHash,
      }
    }));
    console.log(`[DuplicateDetector] Removed hash fingerprint for ${fileHash}`);
    
    // Ta bort fingerprint om vi har leverantör
    if (supplier) {
      const normalizedSupplier = normalizeSupplier(supplier);
      const sk = `${normalizedSupplier}#${invoiceNumber || fileHash}`;
      
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `FINGERPRINT#${companyId}`,
          sk,
        }
      }));
      console.log(`[DuplicateDetector] Removed supplier fingerprint for ${sk}`);
    }
  } catch (error) {
    console.error('[DuplicateDetector] Remove fingerprint error:', error);
  }
}

/**
 * Beräkna hash för en fil
 */
export function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 32);
}

// ============ Interna hjälpfunktioner ============

async function findByInvoiceNumber(
  companyId: string,
  normalizedSupplier: string,
  invoiceNumber: string
): Promise<{ jobId: string; createdAt: string } | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `FINGERPRINT#${companyId}`,
        ':sk': `${normalizedSupplier}#${invoiceNumber}`,
      },
    }));
    
    if (result.Items && result.Items.length > 0) {
      return {
        jobId: result.Items[0].jobId as string,
        createdAt: result.Items[0].createdAt as string,
      };
    }
  } catch (error) {
    console.error('[DuplicateDetector] Invoice lookup error:', error);
  }
  
  return null;
}

async function findByFileHash(
  companyId: string,
  fileHash: string
): Promise<{ jobId: string; createdAt: string } | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `HASH#${companyId}`,
        ':sk': fileHash,
      },
    }));
    
    if (result.Items && result.Items.length > 0) {
      return {
        jobId: result.Items[0].jobId as string,
        createdAt: result.Items[0].createdAt as string,
      };
    }
  } catch (error) {
    console.error('[DuplicateDetector] Hash lookup error:', error);
  }
  
  return null;
}

async function findByAmountAndDate(
  companyId: string,
  normalizedSupplier: string,
  amount: number,
  date: string
): Promise<{ jobId: string; createdAt: string } | null> {
  try {
    // Sök alla fingerprints för denna leverantör
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :supplier)',
      ExpressionAttributeValues: {
        ':pk': `FINGERPRINT#${companyId}`,
        ':supplier': `${normalizedSupplier}#`,
      },
    }));
    
    if (result.Items) {
      // Kolla om belopp och datum matchar (inom 1% och 7 dagar)
      for (const item of result.Items) {
        const itemAmount = item.totalAmount as number;
        const itemDate = item.invoiceDate as string;
        
        const amountDiff = Math.abs(itemAmount - amount) / Math.max(itemAmount, amount);
        const dateDiff = Math.abs(new Date(date).getTime() - new Date(itemDate).getTime()) / (1000 * 60 * 60 * 24);
        
        if (amountDiff < 0.01 && dateDiff < 7) {
          return {
            jobId: item.jobId as string,
            createdAt: item.createdAt as string,
          };
        }
      }
    }
  } catch (error) {
    console.error('[DuplicateDetector] Amount lookup error:', error);
  }
  
  return null;
}

function normalizeSupplier(supplier: string): string {
  return supplier
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ab$/, '')
    .replace(/inc\.?$/, '')
    .replace(/ltd\.?$/, '')
    .replace(/gmbh$/, '')
    .replace(/[^a-z0-9åäö]/g, '');
}

/**
 * Generera unikt checkId för en fingerprint
 */
function generateCheckId(fingerprint: DocumentFingerprint): string {
  const data = `${fingerprint.companyId}:${fingerprint.fileHash}:${Date.now()}`;
  return `chk-${crypto.createHash('sha256').update(data).digest('hex').substring(0, 16)}`;
}

/**
 * Kolla om det finns en override för ett original-dokument
 */
async function checkForOverride(
  companyId: string,
  originalJobId: string,
  newFileHash: string
): Promise<boolean> {
  try {
    // Sök efter overrides som matchar originalJobId
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :original)',
      ExpressionAttributeValues: {
        ':pk': `OVERRIDE#${companyId}`,
        ':original': `${originalJobId}#`,
      },
    }));
    
    const items = (result.Items || []) as Array<Partial<DuplicateOverride> & { newFileHash?: string }>;
    if (items.length === 0) return false;

    // Prefer strict match when newFileHash is stored
    const strictMatches = items.filter(i => typeof i.newFileHash === 'string' && i.newFileHash.length > 0);
    if (strictMatches.length > 0) {
      return strictMatches.some(i => i.newFileHash === newFileHash);
    }

    // Legacy overrides without fileHash: preserve old behavior (treat as override exists)
    return true;
    
  } catch (error) {
    console.error('[DuplicateDetector] Check override error:', error);
    return false;
  }
}

/**
 * Spara idempotens-record
 */
async function saveIdempotencyRecord(
  companyId: string,
  requestId: string,
  fileHash: string,
  result: DuplicateCheckResult
): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `IDEMPOTENCY#${companyId}`,
        sk: requestId,
        requestId,
        companyId,
        fileHash,
        result,
        createdAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 timmar
      },
    }));
  } catch (error) {
    console.error('[DuplicateDetector] Save idempotency error:', error);
    // Idempotens är en optimering, inte kritiskt om det misslyckas
  }
}

/**
 * Hämta idempotens-record
 */
async function getIdempotencyRecord(
  companyId: string,
  requestId: string
): Promise<IdempotencyRecord | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `IDEMPOTENCY#${companyId}`,
        sk: requestId,
      },
    }));
    
    return result.Item as IdempotencyRecord | null;
    
  } catch (error) {
    console.error('[DuplicateDetector] Get idempotency error:', error);
    return null;
  }
}


