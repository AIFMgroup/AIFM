/**
 * Bank Matching Service
 * 
 * Förbereder och matchar fakturor/kvitton mot banktransaktioner.
 * Designad för integration med Tink API.
 * 
 * Matchningslogik:
 * 1. Exakt belopp + referensnummer
 * 2. Exakt belopp + leverantör + datum (±3 dagar)
 * 3. Partiell matchning med confidence score
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { jobStore } from '@/lib/accounting/jobStore';
import { paymentService } from '@/lib/accounting/payments/paymentService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
// Store bank matching entities in the same DynamoDB table as accounting jobs to avoid extra infra.
// NOTE: these items intentionally do NOT set `createdAt` to avoid being included in the jobs GSI.
const TABLE_NAME = process.env.AIFM_ACCOUNTING_TABLE || 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export interface BankTransaction {
  id: string;
  companyId: string;
  accountId: string;           // Bankkonto-ID från Tink
  accountName?: string;
  transactionDate: string;     // YYYY-MM-DD
  bookingDate?: string;
  amount: number;              // Negativt = utgående, positivt = inkommande
  currency: string;
  description: string;
  reference?: string;          // OCR/referensnummer
  counterpartyName?: string;   // Motpart (leverantör/kund)
  counterpartyAccount?: string;
  category?: string;           // Tink-kategori
  status: 'PENDING' | 'MATCHED' | 'MANUALLY_MATCHED' | 'IGNORED';
  matchedJobId?: string;       // Kopplat bokföringsjobb
  matchConfidence?: number;
  importedAt: string;
  source: 'TINK' | 'MANUAL' | 'CSV';
}

function txKey(companyId: string, transactionId: string) {
  return { pk: `COMPANY#${companyId}`, sk: `BANKTX#${transactionId}` };
}

function txStatusIndexKey(companyId: string, status: BankTransaction['status'], transactionDate: string, transactionId: string) {
  return {
    pk: `COMPANY#${companyId}#BANKTX_STATUS#${status}`,
    sk: `DATE#${transactionDate}#BANKTX#${transactionId}`,
  };
}

function txAccountIndexKey(companyId: string, accountId: string, transactionDate: string, transactionId: string) {
  return {
    pk: `COMPANY#${companyId}#BANKTX_ACCOUNT#${accountId}`,
    sk: `DATE#${transactionDate}#BANKTX#${transactionId}`,
  };
}

export interface MatchCandidate {
  jobId: string;
  supplier: string;
  invoiceNumber?: string;
  amount: number;
  dueDate?: string;
  invoiceDate?: string;
  reference?: string;
  ocrNumber?: string;
  status: 'ready' | 'approved' | 'sent';
}

export interface MatchResult {
  transactionId: string;
  matchType: 'EXACT' | 'REFERENCE' | 'AMOUNT_DATE' | 'PARTIAL' | 'NONE';
  confidence: number;
  candidates: MatchCandidateResult[];
  suggestedMatch?: string; // jobId
  requiresReview: boolean;
}

export interface MatchCandidateResult {
  jobId: string;
  supplier: string;
  invoiceNumber?: string;
  amount: number;
  matchScore: number;
  matchReasons: string[];
  amountDiff: number;
  dateDiff?: number; // days
}

export interface ReconciliationSummary {
  period: string;
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  ignoredCount: number;
  totalIncoming: number;
  totalOutgoing: number;
  matchedIncoming: number;
  matchedOutgoing: number;
  unmatchedItems: {
    transactions: BankTransaction[];
    invoices: MatchCandidate[];
  };
}

// ============ Configuration ============

const MATCH_CONFIG = {
  // Toleranser
  amountTolerance: 1.0,          // Max 1 kr differens för exakt matchning
  dateTolerance: 5,              // Max 5 dagars differens
  
  // Confidence-trösklar
  autoMatchThreshold: 0.95,      // Auto-matcha om confidence >= 95%
  reviewThreshold: 0.70,         // Föreslå om confidence >= 70%
  
  // Vikter för matchning
  weights: {
    exactAmount: 40,
    referenceMatch: 35,
    supplierMatch: 15,
    dateProximity: 10,
  },
};

// ============ Import Functions ============

/**
 * Importera banktransaktioner (från Tink eller CSV)
 */
export async function importBankTransactions(
  companyId: string,
  transactions: Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'>[],
  source: 'TINK' | 'MANUAL' | 'CSV'
): Promise<{ imported: number; duplicates: number }> {
  let imported = 0;
  let duplicates = 0;
  const now = new Date().toISOString();
  
  for (const tx of transactions) {
    // Generate unique ID based on account + date + amount + description
    const txHash = generateTransactionHash(tx);
    const id = `tx-${txHash}`;
    
    // Check for duplicate
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: txKey(companyId, id),
    }));
    
    if (existing.Item) {
      duplicates++;
      continue;
    }
    
    const canonical: BankTransaction = {
      id,
      companyId,
      ...(tx as any),
      status: 'PENDING',
      importedAt: now,
      source,
    };

    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...txKey(companyId, id),
              ...canonical,
              entityType: 'BANK_TRANSACTION',
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...txStatusIndexKey(companyId, 'PENDING', canonical.transactionDate, id),
              ...canonical,
              entityType: 'BANK_TRANSACTION_STATUS_INDEX',
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...txAccountIndexKey(companyId, canonical.accountId, canonical.transactionDate, id),
              ...canonical,
              entityType: 'BANK_TRANSACTION_ACCOUNT_INDEX',
            },
          },
        },
      ],
    }));
    
    imported++;
  }
  
  return { imported, duplicates };
}

/**
 * Generera hash för transaktionsdeduplicering
 */
function generateTransactionHash(tx: Partial<BankTransaction>): string {
  const data = `${tx.accountId}|${tx.transactionDate}|${tx.amount}|${tx.description}`;
  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============ Matching Functions ============

/**
 * Matcha en banktransaktion mot fakturor/kvitton
 */
export async function matchTransaction(
  companyId: string,
  transaction: BankTransaction,
  candidates: MatchCandidate[]
): Promise<MatchResult> {
  const results: MatchCandidateResult[] = [];
  
  for (const candidate of candidates) {
    const matchResult = calculateMatchScore(transaction, candidate);
    if (matchResult.matchScore > 0) {
      results.push(matchResult);
    }
  }
  
  // Sortera efter matchScore
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  // Bestäm matchtyp och confidence
  let matchType: MatchResult['matchType'] = 'NONE';
  let confidence = 0;
  let suggestedMatch: string | undefined;
  
  if (results.length > 0) {
    const best = results[0];
    confidence = best.matchScore / 100;
    
    if (best.matchReasons.includes('EXACT_REFERENCE')) {
      matchType = 'REFERENCE';
    } else if (best.matchReasons.includes('EXACT_AMOUNT') && best.dateDiff !== undefined && best.dateDiff <= 3) {
      matchType = 'EXACT';
    } else if (best.matchReasons.includes('EXACT_AMOUNT')) {
      matchType = 'AMOUNT_DATE';
    } else {
      matchType = 'PARTIAL';
    }
    
    if (confidence >= MATCH_CONFIG.autoMatchThreshold) {
      suggestedMatch = best.jobId;
    }
  }
  
  return {
    transactionId: transaction.id,
    matchType,
    confidence,
    candidates: results.slice(0, 5), // Top 5 candidates
    suggestedMatch,
    requiresReview: confidence < MATCH_CONFIG.autoMatchThreshold && confidence >= MATCH_CONFIG.reviewThreshold,
  };
}

/**
 * Beräkna matchscore mellan transaktion och kandidat
 */
function calculateMatchScore(
  transaction: BankTransaction,
  candidate: MatchCandidate
): MatchCandidateResult {
  let score = 0;
  const reasons: string[] = [];
  
  // 1. Beloppmatchning
  const amountDiff = Math.abs(Math.abs(transaction.amount) - candidate.amount);
  if (amountDiff <= MATCH_CONFIG.amountTolerance) {
    score += MATCH_CONFIG.weights.exactAmount;
    reasons.push('EXACT_AMOUNT');
  } else if (amountDiff <= candidate.amount * 0.01) {
    // Inom 1%
    score += MATCH_CONFIG.weights.exactAmount * 0.8;
    reasons.push('CLOSE_AMOUNT');
  } else if (amountDiff <= candidate.amount * 0.05) {
    // Inom 5%
    score += MATCH_CONFIG.weights.exactAmount * 0.5;
    reasons.push('APPROXIMATE_AMOUNT');
  }
  
  // 2. Referensnummermatchning
  const txRef = extractReference(transaction.description, transaction.reference);
  const candidateRef = candidate.ocrNumber || candidate.reference || candidate.invoiceNumber;
  
  if (txRef && candidateRef) {
    if (txRef === candidateRef) {
      score += MATCH_CONFIG.weights.referenceMatch;
      reasons.push('EXACT_REFERENCE');
    } else if (txRef.includes(candidateRef) || candidateRef.includes(txRef)) {
      score += MATCH_CONFIG.weights.referenceMatch * 0.7;
      reasons.push('PARTIAL_REFERENCE');
    }
  }
  
  // 3. Leverantörsmatchning
  const txSupplier = normalizeSupplier(transaction.counterpartyName || transaction.description);
  const candidateSupplier = normalizeSupplier(candidate.supplier);
  
  if (txSupplier && candidateSupplier) {
    if (txSupplier === candidateSupplier) {
      score += MATCH_CONFIG.weights.supplierMatch;
      reasons.push('EXACT_SUPPLIER');
    } else if (txSupplier.includes(candidateSupplier) || candidateSupplier.includes(txSupplier)) {
      score += MATCH_CONFIG.weights.supplierMatch * 0.7;
      reasons.push('PARTIAL_SUPPLIER');
    }
  }
  
  // 4. Datumproximitet
  let dateDiff: number | undefined;
  if (candidate.dueDate || candidate.invoiceDate) {
    const txDate = new Date(transaction.transactionDate);
    const candidateDate = new Date(candidate.dueDate || candidate.invoiceDate!);
    dateDiff = Math.abs(Math.floor((txDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    if (dateDiff <= MATCH_CONFIG.dateTolerance) {
      const dateScore = MATCH_CONFIG.weights.dateProximity * (1 - dateDiff / MATCH_CONFIG.dateTolerance);
      score += dateScore;
      reasons.push(`DATE_PROXIMITY_${dateDiff}d`);
    }
  }
  
  return {
    jobId: candidate.jobId,
    supplier: candidate.supplier,
    invoiceNumber: candidate.invoiceNumber,
    amount: candidate.amount,
    matchScore: Math.min(100, score),
    matchReasons: reasons,
    amountDiff,
    dateDiff,
  };
}

/**
 * Extrahera referensnummer från beskrivning
 */
function extractReference(description: string, reference?: string): string | null {
  if (reference) return reference.replace(/\D/g, '');
  
  // Försök hitta OCR-nummer (svenska betalningsreferenser)
  // OCR-nummer är vanligtvis 4-25 siffror
  const ocrMatch = description.match(/\b(\d{4,25})\b/);
  if (ocrMatch) return ocrMatch[1];
  
  // Fakturanummer-mönster
  const invoiceMatch = description.match(/(?:faktura|inv|invoice|fakt)[^\d]*(\d+)/i);
  if (invoiceMatch) return invoiceMatch[1];
  
  return null;
}

/**
 * Normalisera leverantörsnamn för jämförelse
 */
function normalizeSupplier(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bab\b|\baktiebolag\b|\bhandelsbolag\b|\bhb\b|\bkb\b/gi, '')
    .replace(/[^a-zåäö0-9]/gi, '')
    .trim();
}

// ============ Batch Matching ============

/**
 * Matcha alla omatchade transaktioner
 */
export async function matchAllPendingTransactions(
  companyId: string,
  candidates: MatchCandidate[]
): Promise<{
  matched: number;
  requiresReview: number;
  unmatched: number;
  results: MatchResult[];
}> {
  // Hämta alla pending transaktioner
  const transactions = await getPendingTransactions(companyId);
  
  const results: MatchResult[] = [];
  let matched = 0;
  let requiresReview = 0;
  let unmatched = 0;
  
  for (const tx of transactions) {
    const result = await matchTransaction(companyId, tx, candidates);
    results.push(result);
    
    if (result.suggestedMatch) {
      // Auto-matcha
      await confirmMatch(companyId, tx.id, result.suggestedMatch, result.confidence);
      matched++;
    } else if (result.requiresReview) {
      requiresReview++;
    } else {
      unmatched++;
    }
  }
  
  return { matched, requiresReview, unmatched, results };
}

/**
 * Hämta pending transaktioner
 */
export async function getPendingTransactions(
  companyId: string,
  limit?: number
): Promise<BankTransaction[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: {
      ':pk': `COMPANY#${companyId}#BANKTX_STATUS#PENDING`,
    },
    Limit: limit,
    ScanIndexForward: false,
  }));
  
  return (result.Items || []) as BankTransaction[];
}

// ============ Match Management ============

async function moveStatusIndex(
  companyId: string,
  tx: BankTransaction,
  newStatus: BankTransaction['status'],
  patch: Partial<BankTransaction> & { matchedAt?: string; ignoredAt?: string; ignoreReason?: string }
): Promise<void> {
  const nowIso = new Date().toISOString();
  const oldStatus = tx.status;
  const transactionDate = tx.transactionDate;
  const id = tx.id;

  const updated: BankTransaction & Record<string, unknown> = {
    ...(tx as any),
    ...(patch as any),
    status: newStatus,
  };

  // Ensure timestamps are populated for status transitions
  if ((newStatus === 'MATCHED' || newStatus === 'MANUALLY_MATCHED') && !updated.matchedAt) {
    updated.matchedAt = nowIso;
  }
  if (newStatus === 'IGNORED' && !updated.ignoredAt) {
    updated.ignoredAt = nowIso;
  }

  const transactItems: any[] = [
    {
      Update: {
        TableName: TABLE_NAME,
        Key: txKey(companyId, id),
        UpdateExpression:
          'SET #status = :status, matchedJobId = :jobId, matchConfidence = :conf, matchedAt = :matchedAt, ignoreReason = :ignoreReason, ignoredAt = :ignoredAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': updated.status,
          ':jobId': updated.matchedJobId ?? null,
          ':conf': updated.matchConfidence ?? null,
          ':matchedAt': (updated as any).matchedAt ?? null,
          ':ignoreReason': (updated as any).ignoreReason ?? null,
          ':ignoredAt': (updated as any).ignoredAt ?? null,
        },
      },
    },
    {
      Delete: {
        TableName: TABLE_NAME,
        Key: txStatusIndexKey(companyId, oldStatus, transactionDate, id),
      },
    },
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          ...txStatusIndexKey(companyId, newStatus, transactionDate, id),
          ...(updated as any),
          entityType: 'BANK_TRANSACTION_STATUS_INDEX',
        },
      },
    },
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          ...txAccountIndexKey(companyId, updated.accountId, transactionDate, id),
          ...(updated as any),
          entityType: 'BANK_TRANSACTION_ACCOUNT_INDEX',
        },
      },
    },
  ];

  // If accountId changed, delete old account index too
  if (tx.accountId !== updated.accountId) {
    transactItems.splice(3, 0, {
      Delete: {
        TableName: TABLE_NAME,
        Key: txAccountIndexKey(companyId, tx.accountId, transactionDate, id),
      },
    });
  }

  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
}

/**
 * Bekräfta en matchning
 */
export async function confirmMatch(
  companyId: string,
  transactionId: string,
  jobId: string,
  confidence: number,
  isManual = false
): Promise<void> {
  const txRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: txKey(companyId, transactionId),
  }));
  const tx = txRes.Item as BankTransaction | undefined;
  if (!tx) throw new Error('Transaction not found');

  await moveStatusIndex(companyId, tx, isManual ? 'MANUALLY_MATCHED' : 'MATCHED', {
    matchedJobId: jobId,
    matchConfidence: confidence,
    matchedAt: new Date().toISOString(),
  });
  
  // Uppdatera jobbet med banktransaktionsreferens
  await linkTransactionToJob(companyId, transactionId, jobId, confidence);

  // If this is an outgoing transaction and the job is a supplier invoice, mark it as paid (AP)
  try {
    const job = await jobStore.get(jobId);
    if (tx && job?.classification?.docType === 'INVOICE' && tx.amount < 0) {
      await paymentService.completeJobPayment(companyId, jobId, {
        paymentDate: tx.transactionDate,
        bankReference: tx.reference || tx.description,
        paymentMethod: 'tink',
      });
    }
  } catch (e) {
    // Non-fatal: reconciliation matching should still succeed even if payment marking fails
    console.warn('[BankMatching] Could not auto-complete payment from confirmed match:', e);
  }
}

/**
 * Ignorera en transaktion (t.ex. intern överföring)
 */
export async function ignoreTransaction(
  companyId: string,
  transactionId: string,
  reason: string
): Promise<void> {
  const txRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: txKey(companyId, transactionId),
  }));
  const tx = txRes.Item as BankTransaction | undefined;
  if (!tx) throw new Error('Transaction not found');

  await moveStatusIndex(companyId, tx, 'IGNORED', {
    ignoreReason: reason,
    ignoredAt: new Date().toISOString(),
  });
}

/**
 * Ta bort en matchning
 */
export async function unmatch(
  companyId: string,
  transactionId: string
): Promise<void> {
  const txRes = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: txKey(companyId, transactionId),
  }));
  const tx = txRes.Item as BankTransaction | undefined;
  if (!tx) throw new Error('Transaction not found');

  await moveStatusIndex(companyId, tx, 'PENDING', {
    matchedJobId: undefined,
    matchConfidence: undefined,
    matchedAt: undefined,
  });
}

async function linkTransactionToJob(
  companyId: string,
  transactionId: string,
  jobId: string,
  confidence?: number
): Promise<void> {
  const now = new Date().toISOString();
  await jobStore.update(jobId, {
    bankTransactionId: transactionId,
    bankMatchConfidence: confidence,
    bankMatchedAt: now,
    updatedAt: now,
  });
}

/**
 * Hämta omatchade leverantörsfakturor/kvitton (jobs) som fortfarande väntar på bankmatchning
 */
export async function getUnmatchedJobs(companyId: string): Promise<MatchCandidate[]> {
  const jobs = await jobStore.getByCompany(companyId);
  return jobs
    .filter(j => (j.status === 'ready' || j.status === 'approved' || j.status === 'sent'))
    .filter(j => !j.bankTransactionId)
    .filter(j => j.classification?.totalAmount && j.classification.totalAmount > 0)
    .map(j => ({
      jobId: j.id,
      supplier: j.classification?.supplier || 'Okänd',
      invoiceNumber: j.classification?.invoiceNumber,
      amount: j.classification?.totalAmount || 0,
      dueDate: j.classification?.dueDate,
      invoiceDate: j.classification?.invoiceDate,
      reference: undefined,
      ocrNumber: undefined,
      status: j.status as 'ready' | 'approved' | 'sent',
    }));
}

/**
 * Hämta omatchade banktransaktioner (PENDING)
 */
export async function getUnmatchedBankTransactions(companyId: string, limit = 200): Promise<BankTransaction[]> {
  return getPendingTransactions(companyId, limit);
}

// ============ Reconciliation ============

/**
 * Generera avstämningsrapport för en period
 */
export async function generateReconciliationSummary(
  companyId: string,
  year: number,
  month: number
): Promise<ReconciliationSummary> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  
  // Hämta alla transaktioner för perioden
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    FilterExpression: 'transactionDate BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':pk': `COMPANY#${companyId}`,
      ':prefix': 'BANKTX#',
      ':start': startDate,
      ':end': endDate,
    },
  }));
  
  const transactions = (result.Items || []) as BankTransaction[];
  
  // Beräkna statistik
  const matched = transactions.filter(t => t.status === 'MATCHED' || t.status === 'MANUALLY_MATCHED');
  const unmatched = transactions.filter(t => t.status === 'PENDING');
  const ignored = transactions.filter(t => t.status === 'IGNORED');
  
  const incoming = transactions.filter(t => t.amount > 0);
  const outgoing = transactions.filter(t => t.amount < 0);
  
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    totalTransactions: transactions.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    ignoredCount: ignored.length,
    totalIncoming: incoming.reduce((sum, t) => sum + t.amount, 0),
    totalOutgoing: Math.abs(outgoing.reduce((sum, t) => sum + t.amount, 0)),
    matchedIncoming: incoming.filter(t => t.status === 'MATCHED' || t.status === 'MANUALLY_MATCHED')
      .reduce((sum, t) => sum + t.amount, 0),
    matchedOutgoing: Math.abs(outgoing.filter(t => t.status === 'MATCHED' || t.status === 'MANUALLY_MATCHED')
      .reduce((sum, t) => sum + t.amount, 0)),
    unmatchedItems: {
      transactions: unmatched,
      invoices: [], // Would be populated from accounting jobs
    },
  };
}

// ============ Utility Functions ============

/**
 * Parsa CSV-fil med banktransaktioner
 */
export function parseBankCSV(
  csvContent: string,
  format: 'NORDEA' | 'SEB' | 'SWEDBANK' | 'HANDELSBANKEN' | 'GENERIC'
): Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // Skip header
  const dataLines = lines.slice(1);
  
  return dataLines.map(line => {
    const fields = parseCSVLine(line);
    
    // Formatspecifik parsning
    switch (format) {
      case 'NORDEA':
        return parseNordeaRow(fields);
      case 'SEB':
        return parseSEBRow(fields);
      case 'SWEDBANK':
        return parseSwedBankRow(fields);
      case 'HANDELSBANKEN':
        return parseHandelsbankenRow(fields);
      default:
        return parseGenericRow(fields);
    }
  }).filter(tx => tx.transactionDate && !isNaN(tx.amount));
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  
  return fields;
}

function parseNordeaRow(fields: string[]): Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'> {
  // Nordea CSV format: Datum;Text;Belopp;Saldo
  return {
    accountId: 'nordea-default',
    transactionDate: formatDate(fields[0]),
    amount: parseAmount(fields[2]),
    currency: 'SEK',
    description: fields[1] || '',
    source: 'CSV',
  };
}

function parseSEBRow(fields: string[]): Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'> {
  // SEB CSV format: Bokföringsdatum;Valutadatum;Verifikationsnummer;Text/mottagare;Belopp;Saldo
  return {
    accountId: 'seb-default',
    transactionDate: formatDate(fields[0]),
    bookingDate: formatDate(fields[1]),
    amount: parseAmount(fields[4]),
    currency: 'SEK',
    description: fields[3] || '',
    reference: fields[2],
    source: 'CSV',
  };
}

function parseSwedBankRow(fields: string[]): Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'> {
  return {
    accountId: 'swedbank-default',
    transactionDate: formatDate(fields[0]),
    amount: parseAmount(fields[2]),
    currency: 'SEK',
    description: fields[1] || '',
    source: 'CSV',
  };
}

function parseHandelsbankenRow(fields: string[]): Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'> {
  return {
    accountId: 'handelsbanken-default',
    transactionDate: formatDate(fields[0]),
    amount: parseAmount(fields[3]),
    currency: 'SEK',
    description: fields[2] || '',
    source: 'CSV',
  };
}

function parseGenericRow(fields: string[]): Omit<BankTransaction, 'id' | 'companyId' | 'importedAt' | 'status'> {
  // Försök gissa kolumner
  const dateField = fields.find(f => /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/.test(f));
  const amountField = fields.find(f => /^-?[\d\s,.]+$/.test(f.replace(/[^\d,.-]/g, '')));
  const descField = fields.find(f => f.length > 10 && !/^[\d,.-]+$/.test(f));
  
  return {
    accountId: 'generic-default',
    transactionDate: formatDate(dateField || ''),
    amount: parseAmount(amountField || '0'),
    currency: 'SEK',
    description: descField || fields.join(' '),
    source: 'CSV',
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // Handle DD/MM/YYYY or DD-MM-YYYY
  const match = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  
  // Handle YYYYMMDD
  const compact = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  
  return dateStr;
}

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Remove spaces and handle Swedish format (1 234,56)
  const cleaned = amountStr
    .replace(/\s/g, '')
    .replace(/,/g, '.');
  
  return parseFloat(cleaned) || 0;
}








