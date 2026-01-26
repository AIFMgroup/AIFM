/**
 * Supplier Memory Service
 * 
 * Kommer ihåg leverantör → konto-mappningar baserat på tidigare godkännanden.
 * Lär sig från korrigeringar och bygger upp en kunskap över tid.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand,
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface SupplierProfile {
  supplierId: string;
  supplierName: string;
  normalizedName: string;
  orgNumber?: string;
  
  // Vanligaste kontot
  defaultAccount: string;
  defaultAccountName: string;
  
  // Alla använda konton med frekvens
  accountHistory: {
    account: string;
    accountName: string;
    count: number;
    lastUsed: string;
  }[];
  
  // Vanlig dokumenttyp
  typicalDocType: 'INVOICE' | 'RECEIPT' | 'OTHER';
  
  // Statistik
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastTransactionAt: string;
}

export interface AccountSuggestion {
  account: string;
  accountName: string;
  confidence: number;
  source: 'supplier_history' | 'category_match' | 'default';
  usageCount?: number;
}

/**
 * Hämta leverantörsprofil
 */
export async function getSupplierProfile(
  companyId: string,
  supplierName: string
): Promise<SupplierProfile | null> {
  const normalizedName = normalizeSupplierName(supplierName);
  
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `SUPPLIER#${companyId}`,
        sk: normalizedName,
      }
    }));
    
    if (result.Item) {
      return result.Item as SupplierProfile;
    }
  } catch (error) {
    console.error('[SupplierMemory] Get profile error:', error);
  }
  
  return null;
}

/**
 * Föreslå konto baserat på leverantörshistorik
 */
export async function suggestAccountFromHistory(
  companyId: string,
  supplierName: string
): Promise<AccountSuggestion | null> {
  const profile = await getSupplierProfile(companyId, supplierName);
  
  if (!profile) {
    return null;
  }
  
  // Använd det vanligaste kontot
  if (profile.accountHistory.length > 0) {
    const topAccount = profile.accountHistory[0];
    const totalUsage = profile.accountHistory.reduce((sum, a) => sum + a.count, 0);
    const confidence = Math.min(0.95, 0.7 + (topAccount.count / totalUsage) * 0.25);
    
    return {
      account: topAccount.account,
      accountName: topAccount.accountName,
      confidence,
      source: 'supplier_history',
      usageCount: topAccount.count,
    };
  }
  
  return {
    account: profile.defaultAccount,
    accountName: profile.defaultAccountName,
    confidence: 0.8,
    source: 'supplier_history',
  };
}

/**
 * Registrera en transaktion och uppdatera leverantörsprofil
 */
export async function recordTransaction(
  companyId: string,
  supplierName: string,
  account: string,
  accountName: string,
  amount: number,
  docType: 'INVOICE' | 'RECEIPT' | 'OTHER',
  orgNumber?: string
): Promise<void> {
  const normalizedName = normalizeSupplierName(supplierName);
  const now = new Date().toISOString();
  
  // Hämta befintlig profil eller skapa ny
  const existing = await getSupplierProfile(companyId, supplierName);
  
  if (existing) {
    // Uppdatera befintlig profil
    await updateSupplierProfile(companyId, normalizedName, existing, {
      account,
      accountName,
      amount,
      docType,
      timestamp: now,
    });
  } else {
    // Skapa ny profil
    const newProfile: SupplierProfile = {
      supplierId: `${companyId}-${normalizedName}`,
      supplierName,
      normalizedName,
      orgNumber,
      defaultAccount: account,
      defaultAccountName: accountName,
      accountHistory: [{
        account,
        accountName,
        count: 1,
        lastUsed: now,
      }],
      typicalDocType: docType,
      totalTransactions: 1,
      totalAmount: amount,
      averageAmount: amount,
      createdAt: now,
      updatedAt: now,
      lastTransactionAt: now,
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `SUPPLIER#${companyId}`,
        sk: normalizedName,
        ...newProfile,
      }
    }));
    
    console.log(`[SupplierMemory] Created profile for: ${supplierName}`);
  }
}

/**
 * Registrera en korrigering (användaren ändrade konto)
 */
export async function recordCorrection(
  companyId: string,
  supplierName: string,
  originalAccount: string,
  correctedAccount: string,
  correctedAccountName: string
): Promise<void> {
  const normalizedName = normalizeSupplierName(supplierName);
  const now = new Date().toISOString();
  
  const existing = await getSupplierProfile(companyId, supplierName);
  
  if (existing) {
    // Öka vikten för det korrigerade kontot
    const accountIndex = existing.accountHistory.findIndex(a => a.account === correctedAccount);
    
    if (accountIndex >= 0) {
      existing.accountHistory[accountIndex].count += 2; // Korrigeringar väger mer
      existing.accountHistory[accountIndex].lastUsed = now;
    } else {
      existing.accountHistory.push({
        account: correctedAccount,
        accountName: correctedAccountName,
        count: 2,
        lastUsed: now,
      });
    }
    
    // Sortera efter count
    existing.accountHistory.sort((a, b) => b.count - a.count);
    
    // Uppdatera default om det korrigerade kontot nu är vanligast
    if (existing.accountHistory[0].account === correctedAccount) {
      existing.defaultAccount = correctedAccount;
      existing.defaultAccountName = correctedAccountName;
    }
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `SUPPLIER#${companyId}`,
        sk: normalizedName,
        ...existing,
        updatedAt: now,
      }
    }));
    
    console.log(`[SupplierMemory] Recorded correction for ${supplierName}: ${originalAccount} → ${correctedAccount}`);
  }
}

/**
 * Hämta alla kända leverantörer för ett bolag
 */
export async function getKnownSuppliers(
  companyId: string,
  limit: number = 100
): Promise<SupplierProfile[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUPPLIER#${companyId}`,
      },
      Limit: limit,
      ScanIndexForward: false, // Senaste först
    }));
    
    return (result.Items || []) as SupplierProfile[];
  } catch (error) {
    console.error('[SupplierMemory] List suppliers error:', error);
    return [];
  }
}

/**
 * Sök efter liknande leverantörer (fuzzy match)
 */
export async function findSimilarSupplier(
  companyId: string,
  supplierName: string
): Promise<SupplierProfile | null> {
  const normalized = normalizeSupplierName(supplierName);
  const suppliers = await getKnownSuppliers(companyId);
  
  for (const supplier of suppliers) {
    // Exakt match
    if (supplier.normalizedName === normalized) {
      return supplier;
    }
    
    // Fuzzy match (en sträng innehåller den andra)
    if (supplier.normalizedName.includes(normalized) || normalized.includes(supplier.normalizedName)) {
      return supplier;
    }
    
    // Levenshtein distance för korta namn
    if (normalized.length < 15 && supplier.normalizedName.length < 15) {
      const distance = levenshteinDistance(normalized, supplier.normalizedName);
      if (distance <= 2) {
        return supplier;
      }
    }
  }
  
  return null;
}

// ============ Interna hjälpfunktioner ============

async function updateSupplierProfile(
  companyId: string,
  normalizedName: string,
  existing: SupplierProfile,
  transaction: {
    account: string;
    accountName: string;
    amount: number;
    docType: 'INVOICE' | 'RECEIPT' | 'OTHER';
    timestamp: string;
  }
): Promise<void> {
  // Uppdatera accountHistory
  const accountIndex = existing.accountHistory.findIndex(a => a.account === transaction.account);
  
  if (accountIndex >= 0) {
    existing.accountHistory[accountIndex].count += 1;
    existing.accountHistory[accountIndex].lastUsed = transaction.timestamp;
  } else {
    existing.accountHistory.push({
      account: transaction.account,
      accountName: transaction.accountName,
      count: 1,
      lastUsed: transaction.timestamp,
    });
  }
  
  // Sortera efter count
  existing.accountHistory.sort((a, b) => b.count - a.count);
  
  // Uppdatera default till vanligaste
  existing.defaultAccount = existing.accountHistory[0].account;
  existing.defaultAccountName = existing.accountHistory[0].accountName;
  
  // Uppdatera statistik
  existing.totalTransactions += 1;
  existing.totalAmount += transaction.amount;
  existing.averageAmount = existing.totalAmount / existing.totalTransactions;
  existing.lastTransactionAt = transaction.timestamp;
  existing.updatedAt = transaction.timestamp;
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `SUPPLIER#${companyId}`,
      sk: normalizedName,
      ...existing,
    }
  }));
}

function normalizeSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ab$/, '')
    .replace(/inc\.?$/, '')
    .replace(/ltd\.?$/, '')
    .replace(/gmbh$/, '')
    .replace(/[^a-z0-9åäö]/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}





