/**
 * Transaction-Level Audit Trail
 * 
 * Spårar alla ändringar på transaktionsnivå med före/efter-värden.
 * Implementerar write-only audit log som ej kan modifieras efter skapande.
 * 
 * Följer:
 * - Bokföringslagen 5 kap. 7§ (verifikationer ska vara varaktiga)
 * - SOC 2 Type II (change management)
 * - GDPR Art. 30 (behandlingsregister)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { calculateTTL, DataCategory, DATA_CLASSIFICATIONS, maskPII } from './dataClassification';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const AUDIT_TABLE_NAME = 'aifm-transaction-audit';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export type ChangeType = 
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'RESTORE';

export type FieldChangeType = 
  | 'account'
  | 'vat'
  | 'vatRate'
  | 'supplier'
  | 'amount'
  | 'totalAmount'
  | 'invoiceDate'
  | 'dueDate'
  | 'invoiceNumber'
  | 'description'
  | 'costCenter'
  | 'project'
  | 'status'
  | 'classification'
  | 'other';

export interface FieldChange {
  field: FieldChangeType | string;
  fieldLabel?: string;           // Användarvänligt namn
  previousValue: unknown;
  newValue: unknown;
  changeSource: 'USER' | 'AI' | 'SYSTEM' | 'INTEGRATION';
}

export interface TransactionAuditEntry {
  // Identifiering
  auditId: string;
  transactionId: string;          // t.ex. jobId
  companyId: string;
  
  // Tidsstämpel (immutable)
  timestamp: string;
  timestampUnix: number;
  
  // Vem
  actor: {
    userId: string;
    userEmail?: string;
    userName?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  
  // Vad
  changeType: ChangeType;
  resourceType: 'job' | 'voucher' | 'invoice' | 'receipt' | 'payment' | 'period' | 'settings';
  
  // Ändringar
  changes: FieldChange[];
  
  // Varför
  reason?: string;                // Användarens motivering
  systemReason?: string;          // Systemets anledning (t.ex. "auto-approve rule matched")
  
  // Kontext
  context?: {
    documentName?: string;
    supplier?: string;
    amount?: number;
    aiConfidence?: number;
    ruleId?: string;
    correlationId?: string;
  };
  
  // Snapshot (före-tillstånd för rollback)
  previousState?: Record<string, unknown>;
  
  // Metadata
  dataCategory: DataCategory;
  isAIDecision: boolean;
  requiresReview: boolean;
}

// ============ Core Functions ============

/**
 * Logga en transaktionsändring (immutable - kan ej ändras efter skapande)
 */
export async function logTransactionChange(
  entry: Omit<TransactionAuditEntry, 'auditId' | 'timestamp' | 'timestampUnix' | 'dataCategory'>
): Promise<string> {
  const now = new Date();
  const auditId = generateAuditId(entry.companyId, entry.transactionId);
  
  const fullEntry: TransactionAuditEntry = {
    ...entry,
    auditId,
    timestamp: now.toISOString(),
    timestampUnix: now.getTime(),
    dataCategory: 'AUDIT_LOG',
  };
  
  // Maskera PII innan vi loggar till console
  const maskedEntry = {
    ...fullEntry,
    actor: maskPII(fullEntry.actor as Record<string, unknown>),
    previousState: fullEntry.previousState ? maskPII(fullEntry.previousState) : undefined,
  };
  
  try {
    await docClient.send(new PutCommand({
      TableName: AUDIT_TABLE_NAME,
      Item: {
        pk: `COMPANY#${entry.companyId}`,
        sk: `TX#${entry.transactionId}#${fullEntry.timestamp}#${auditId}`,
        
        // GSI för att söka per transaktion
        gsi1pk: `TX#${entry.transactionId}`,
        gsi1sk: fullEntry.timestamp,
        
        // GSI för att söka per användare
        gsi2pk: `USER#${entry.actor.userId}`,
        gsi2sk: fullEntry.timestamp,
        
        ...fullEntry,
        
        // TTL - 7 år för audit logs
        ttl: calculateTTL('AUDIT_LOG'),
        
        // Condition: förhindra överskrivning (immutable)
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
    
    // Logga till CloudWatch
    console.log(JSON.stringify({
      level: 'AUDIT_TX',
      ...maskedEntry,
    }));
    
    return auditId;
    
  } catch (error: unknown) {
    // Om det är ett ConditionalCheckFailedException, loggen finns redan (idempotent)
    if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') {
      console.warn(`[TransactionAudit] Entry already exists: ${auditId}`);
      return auditId;
    }
    
    // Fallback: logga till CloudWatch även om DynamoDB misslyckas
    console.error('[TransactionAudit] Failed to write to DynamoDB:', error);
    console.log(JSON.stringify({
      level: 'AUDIT_TX_FALLBACK',
      ...maskedEntry,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    
    throw error;
  }
}

/**
 * Hämta ändringshistorik för en specifik transaktion
 */
export async function getTransactionHistory(
  companyId: string,
  transactionId: string,
  options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<TransactionAuditEntry[]> {
  const { limit = 100, startDate, endDate } = options || {};
  
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: AUDIT_TABLE_NAME,
      IndexName: 'gsi1pk-gsi1sk-index',
      KeyConditionExpression: startDate && endDate
        ? 'gsi1pk = :txId AND gsi1sk BETWEEN :start AND :end'
        : 'gsi1pk = :txId',
      ExpressionAttributeValues: {
        ':txId': `TX#${transactionId}`,
        ...(startDate && { ':start': startDate }),
        ...(endDate && { ':end': endDate }),
      },
      Limit: limit,
      ScanIndexForward: false, // Senaste först
    }));
    
    return (result.Items || []) as TransactionAuditEntry[];
    
  } catch (error) {
    console.error('[TransactionAudit] Query failed:', error);
    return [];
  }
}

/**
 * Hämta alla ändringar gjorda av en användare
 */
export async function getUserActivityLog(
  userId: string,
  options?: {
    companyId?: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<TransactionAuditEntry[]> {
  const { limit = 100, startDate, endDate, companyId } = options || {};
  
  try {
    let result;
    
    if (companyId) {
      // Filtrera på bolag
      result = await docClient.send(new QueryCommand({
        TableName: AUDIT_TABLE_NAME,
        IndexName: 'gsi2pk-gsi2sk-index',
        KeyConditionExpression: startDate && endDate
          ? 'gsi2pk = :userId AND gsi2sk BETWEEN :start AND :end'
          : 'gsi2pk = :userId',
        FilterExpression: 'companyId = :companyId',
        ExpressionAttributeValues: {
          ':userId': `USER#${userId}`,
          ':companyId': companyId,
          ...(startDate && { ':start': startDate }),
          ...(endDate && { ':end': endDate }),
        },
        Limit: limit,
        ScanIndexForward: false,
      }));
    } else {
      result = await docClient.send(new QueryCommand({
        TableName: AUDIT_TABLE_NAME,
        IndexName: 'gsi2pk-gsi2sk-index',
        KeyConditionExpression: startDate && endDate
          ? 'gsi2pk = :userId AND gsi2sk BETWEEN :start AND :end'
          : 'gsi2pk = :userId',
        ExpressionAttributeValues: {
          ':userId': `USER#${userId}`,
          ...(startDate && { ':start': startDate }),
          ...(endDate && { ':end': endDate }),
        },
        Limit: limit,
        ScanIndexForward: false,
      }));
    }
    
    return (result.Items || []) as TransactionAuditEntry[];
    
  } catch (error) {
    console.error('[TransactionAudit] User activity query failed:', error);
    return [];
  }
}

// ============ Helper Functions ============

/**
 * Skapa fältändringar genom att jämföra två objekt
 */
export function createFieldChanges(
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>,
  changeSource: FieldChange['changeSource'] = 'USER',
  fieldsToTrack?: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];
  const allFields = fieldsToTrack || [...new Set([...Object.keys(previousState), ...Object.keys(newState)])];
  
  for (const field of allFields) {
    const prev = previousState[field];
    const next = newState[field];
    
    // Jämför värden (deep comparison för objekt)
    if (!deepEqual(prev, next)) {
      changes.push({
        field: field as FieldChangeType,
        fieldLabel: getFieldLabel(field),
        previousValue: prev,
        newValue: next,
        changeSource,
      });
    }
  }
  
  return changes;
}

/**
 * Logga kontoändring (vanligt scenario)
 */
export async function logAccountChange(params: {
  companyId: string;
  transactionId: string;
  actor: TransactionAuditEntry['actor'];
  previousAccount: string;
  newAccount: string;
  previousAccountName?: string;
  newAccountName?: string;
  reason?: string;
  context?: TransactionAuditEntry['context'];
}): Promise<string> {
  return logTransactionChange({
    companyId: params.companyId,
    transactionId: params.transactionId,
    actor: params.actor,
    changeType: 'UPDATE',
    resourceType: 'job',
    changes: [{
      field: 'account',
      fieldLabel: 'Bokföringskonto',
      previousValue: params.previousAccountName 
        ? `${params.previousAccount} - ${params.previousAccountName}`
        : params.previousAccount,
      newValue: params.newAccountName
        ? `${params.newAccount} - ${params.newAccountName}`
        : params.newAccount,
      changeSource: 'USER',
    }],
    reason: params.reason,
    context: params.context,
    isAIDecision: false,
    requiresReview: false,
  });
}

/**
 * Logga moms-ändring
 */
export async function logVATChange(params: {
  companyId: string;
  transactionId: string;
  actor: TransactionAuditEntry['actor'];
  previousVAT: number;
  newVAT: number;
  previousVATRate?: number;
  newVATRate?: number;
  reason?: string;
  context?: TransactionAuditEntry['context'];
}): Promise<string> {
  const changes: FieldChange[] = [];
  
  if (params.previousVAT !== params.newVAT) {
    changes.push({
      field: 'vat',
      fieldLabel: 'Momsbelopp',
      previousValue: params.previousVAT,
      newValue: params.newVAT,
      changeSource: 'USER',
    });
  }
  
  if (params.previousVATRate !== undefined && params.newVATRate !== undefined && 
      params.previousVATRate !== params.newVATRate) {
    changes.push({
      field: 'vatRate',
      fieldLabel: 'Momssats',
      previousValue: `${params.previousVATRate}%`,
      newValue: `${params.newVATRate}%`,
      changeSource: 'USER',
    });
  }
  
  return logTransactionChange({
    companyId: params.companyId,
    transactionId: params.transactionId,
    actor: params.actor,
    changeType: 'UPDATE',
    resourceType: 'job',
    changes,
    reason: params.reason,
    context: params.context,
    isAIDecision: false,
    requiresReview: false,
  });
}

/**
 * Logga leverantörsändring
 */
export async function logSupplierChange(params: {
  companyId: string;
  transactionId: string;
  actor: TransactionAuditEntry['actor'];
  previousSupplier: string;
  newSupplier: string;
  reason?: string;
  context?: TransactionAuditEntry['context'];
}): Promise<string> {
  return logTransactionChange({
    companyId: params.companyId,
    transactionId: params.transactionId,
    actor: params.actor,
    changeType: 'UPDATE',
    resourceType: 'job',
    changes: [{
      field: 'supplier',
      fieldLabel: 'Leverantör',
      previousValue: params.previousSupplier,
      newValue: params.newSupplier,
      changeSource: 'USER',
    }],
    reason: params.reason,
    context: params.context,
    isAIDecision: false,
    requiresReview: false,
  });
}

/**
 * Logga AI-klassificering
 */
export async function logAIClassification(params: {
  companyId: string;
  transactionId: string;
  classification: {
    supplier?: string;
    account?: string;
    amount?: number;
    vat?: number;
    confidence: number;
  };
  context?: TransactionAuditEntry['context'];
}): Promise<string> {
  const changes: FieldChange[] = [];
  
  if (params.classification.supplier) {
    changes.push({
      field: 'supplier',
      fieldLabel: 'Leverantör',
      previousValue: null,
      newValue: params.classification.supplier,
      changeSource: 'AI',
    });
  }
  
  if (params.classification.account) {
    changes.push({
      field: 'account',
      fieldLabel: 'Bokföringskonto',
      previousValue: null,
      newValue: params.classification.account,
      changeSource: 'AI',
    });
  }
  
  if (params.classification.amount !== undefined) {
    changes.push({
      field: 'amount',
      fieldLabel: 'Belopp',
      previousValue: null,
      newValue: params.classification.amount,
      changeSource: 'AI',
    });
  }
  
  return logTransactionChange({
    companyId: params.companyId,
    transactionId: params.transactionId,
    actor: {
      userId: 'system',
      userName: 'AI Classifier',
    },
    changeType: 'CREATE',
    resourceType: 'job',
    changes,
    systemReason: `AI-klassificering med ${Math.round(params.classification.confidence * 100)}% konfidens`,
    context: {
      ...params.context,
      aiConfidence: params.classification.confidence,
    },
    isAIDecision: true,
    requiresReview: params.classification.confidence < 0.85,
  });
}

/**
 * Logga godkännande/avvisning
 */
export async function logApproval(params: {
  companyId: string;
  transactionId: string;
  actor: TransactionAuditEntry['actor'];
  approved: boolean;
  reason?: string;
  isAutoApproved?: boolean;
  context?: TransactionAuditEntry['context'];
}): Promise<string> {
  return logTransactionChange({
    companyId: params.companyId,
    transactionId: params.transactionId,
    actor: params.actor,
    changeType: params.approved ? 'APPROVE' : 'REJECT',
    resourceType: 'job',
    changes: [{
      field: 'status',
      fieldLabel: 'Status',
      previousValue: 'PENDING_APPROVAL',
      newValue: params.approved ? 'APPROVED' : 'REJECTED',
      changeSource: params.isAutoApproved ? 'SYSTEM' : 'USER',
    }],
    reason: params.reason,
    systemReason: params.isAutoApproved ? 'Auto-godkänd baserat på regler' : undefined,
    context: params.context,
    isAIDecision: false,
    requiresReview: false,
  });
}

// ============ Internal Helpers ============

function generateAuditId(companyId: string, transactionId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `txaudit-${timestamp}-${random}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    
    if (aKeys.length !== bKeys.length) return false;
    
    for (const key of aKeys) {
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    
    return true;
  }
  
  return false;
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    account: 'Bokföringskonto',
    vat: 'Momsbelopp',
    vatRate: 'Momssats',
    supplier: 'Leverantör',
    amount: 'Belopp',
    totalAmount: 'Totalbelopp',
    invoiceDate: 'Fakturadatum',
    dueDate: 'Förfallodatum',
    invoiceNumber: 'Fakturanummer',
    description: 'Beskrivning',
    costCenter: 'Kostnadsställe',
    project: 'Projekt',
    status: 'Status',
    classification: 'Klassificering',
  };
  
  return labels[field] || field;
}

// ============ Exports ============

export const transactionAudit = {
  logChange: logTransactionChange,
  logAccountChange,
  logVATChange,
  logSupplierChange,
  logAIClassification,
  logApproval,
  getHistory: getTransactionHistory,
  getUserActivity: getUserActivityLog,
  createFieldChanges,
};

