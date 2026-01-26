/**
 * Bank Matching Service
 * 
 * Matchar fakturor/kvitton mot banktransaktioner.
 * Förberett för integration med Tink eller Enable Banking.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand,
  UpdateCommand 
} from '@aws-sdk/lib-dynamodb';
import { Classification } from '../jobStore';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export interface BankTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  amount: number; // Negativt för utgifter
  currency: string;
  description: string;
  counterparty?: string;
  reference?: string; // OCR, meddelande
  category?: string;
  status: 'pending' | 'booked';
  rawData?: Record<string, unknown>;
}

export interface MatchResult {
  matched: boolean;
  confidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
  matchType?: 'ocr_reference' | 'amount_date' | 'supplier_amount' | 'manual';
  transaction?: BankTransaction;
  matchScore: number; // 0-100
  matchDetails: string[];
}

export interface UnmatchedItem {
  type: 'invoice' | 'transaction';
  id: string;
  date: string;
  amount: number;
  description: string;
  daysOld: number;
}

// ============ Main Functions ============

/**
 * Matcha en faktura/kvitto mot banktransaktioner
 */
export async function matchInvoiceToTransaction(
  companyId: string,
  classification: Classification,
  jobId: string
): Promise<MatchResult> {
  // Hämta banktransaktioner för perioden
  const startDate = addDays(classification.invoiceDate, -7);
  const endDate = addDays(classification.dueDate || classification.invoiceDate, 14);
  
  const transactions = await getTransactionsInRange(companyId, startDate, endDate);
  
  if (transactions.length === 0) {
    return {
      matched: false,
      confidence: 'none',
      matchScore: 0,
      matchDetails: ['Inga banktransaktioner hittades i perioden'],
    };
  }
  
  // Försök matcha
  let bestMatch: MatchResult = {
    matched: false,
    confidence: 'none',
    matchScore: 0,
    matchDetails: [],
  };
  
  for (const tx of transactions) {
    const result = evaluateMatch(classification, tx);
    if (result.matchScore > bestMatch.matchScore) {
      bestMatch = result;
    }
  }
  
  // Om vi hittade en match, registrera den
  if (bestMatch.matched && bestMatch.transaction) {
    await registerMatch(companyId, jobId, bestMatch.transaction.transactionId, bestMatch);
  }
  
  return bestMatch;
}

/**
 * Importera transaktioner från bank (stub för Tink/Enable)
 */
export async function importBankTransactions(
  companyId: string,
  accountId: string,
  fromDate: string,
  toDate: string
): Promise<BankTransaction[]> {
  // TODO: Implementera med Tink eller Enable Banking API
  // 
  // Tink exempel:
  // const tinkClient = new TinkClient(process.env.TINK_CLIENT_ID, process.env.TINK_CLIENT_SECRET);
  // const transactions = await tinkClient.getTransactions(accountId, fromDate, toDate);
  
  console.log(`[BankMatching] Would fetch transactions for ${accountId} from ${fromDate} to ${toDate}`);
  
  // Returnera tom lista tills API är konfigurerat
  return [];
}

/**
 * Hämta omatchade fakturor
 */
export async function getUnmatchedInvoices(companyId: string): Promise<UnmatchedItem[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'companyId-createdAt-index',
      KeyConditionExpression: 'companyId = :companyId',
      FilterExpression: 'attribute_not_exists(bankMatchId) AND #status IN (:ready, :approved)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':companyId': companyId,
        ':ready': 'ready',
        ':approved': 'approved',
      },
    }));
    
    const now = new Date();
    return (result.Items || []).map(item => ({
      type: 'invoice' as const,
      id: item.id as string,
      date: item.classification?.invoiceDate || item.createdAt as string,
      amount: item.classification?.totalAmount || 0,
      description: `${item.classification?.supplier || 'Okänd'} - ${item.classification?.invoiceNumber || ''}`,
      daysOld: Math.floor((now.getTime() - new Date(item.createdAt as string).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  } catch (error) {
    console.error('[BankMatching] Get unmatched error:', error);
    return [];
  }
}

/**
 * Hämta omatchade transaktioner
 */
export async function getUnmatchedTransactions(companyId: string): Promise<UnmatchedItem[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'attribute_not_exists(matchedJobId)',
      ExpressionAttributeValues: {
        ':pk': `TRANSACTIONS#${companyId}`,
      },
    }));
    
    const now = new Date();
    return (result.Items || []).map(item => ({
      type: 'transaction' as const,
      id: item.transactionId as string,
      date: item.date as string,
      amount: Math.abs(item.amount as number),
      description: item.description as string || item.counterparty as string || 'Okänd',
      daysOld: Math.floor((now.getTime() - new Date(item.date as string).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  } catch (error) {
    console.error('[BankMatching] Get unmatched transactions error:', error);
    return [];
  }
}

/**
 * Manuell matchning
 */
export async function manualMatch(
  companyId: string,
  jobId: string,
  transactionId: string
): Promise<void> {
  await registerMatch(companyId, jobId, transactionId, {
    matched: true,
    confidence: 'exact',
    matchType: 'manual',
    matchScore: 100,
    matchDetails: ['Manuellt matchad'],
  });
}

// ============ Internal Functions ============

function evaluateMatch(
  classification: Classification,
  transaction: BankTransaction
): MatchResult {
  const details: string[] = [];
  let score = 0;
  
  // 1. OCR/Referens-matchning (exakt)
  if (transaction.reference && classification.invoiceNumber) {
    const normalizedRef = normalizeReference(transaction.reference);
    const normalizedInvoice = normalizeReference(classification.invoiceNumber);
    
    if (normalizedRef.includes(normalizedInvoice) || normalizedInvoice.includes(normalizedRef)) {
      score += 50;
      details.push('OCR/referens matchar');
    }
  }
  
  // 2. Beloppsmatchning
  const invoiceAmount = classification.totalAmount;
  const txAmount = Math.abs(transaction.amount);
  const amountDiff = Math.abs(invoiceAmount - txAmount) / Math.max(invoiceAmount, txAmount);
  
  if (amountDiff < 0.001) { // Exakt match
    score += 30;
    details.push('Exakt belopp');
  } else if (amountDiff < 0.01) { // Inom 1%
    score += 20;
    details.push('Belopp inom 1%');
  } else if (amountDiff < 0.05) { // Inom 5%
    score += 10;
    details.push('Belopp inom 5%');
  }
  
  // 3. Datummatchning
  const invoiceDate = new Date(classification.invoiceDate);
  const dueDate = classification.dueDate ? new Date(classification.dueDate) : addDaysDate(invoiceDate, 30);
  const txDate = new Date(transaction.date);
  
  if (txDate >= invoiceDate && txDate <= dueDate) {
    score += 15;
    details.push('Datum inom förväntad period');
  } else if (txDate >= addDaysDate(invoiceDate, -7) && txDate <= addDaysDate(dueDate, 7)) {
    score += 10;
    details.push('Datum nära förväntad period');
  }
  
  // 4. Leverantörsmatchning (fuzzy)
  if (transaction.counterparty || transaction.description) {
    const txText = `${transaction.counterparty || ''} ${transaction.description || ''}`.toLowerCase();
    const supplierWords = classification.supplier.toLowerCase().split(/\s+/);
    
    const matchedWords = supplierWords.filter(word => word.length > 2 && txText.includes(word));
    if (matchedWords.length > 0) {
      score += Math.min(15, matchedWords.length * 5);
      details.push(`Leverantör matchar: ${matchedWords.join(', ')}`);
    }
  }
  
  // Bestäm confidence
  let confidence: MatchResult['confidence'] = 'none';
  let matched = false;
  
  if (score >= 80) {
    confidence = 'exact';
    matched = true;
  } else if (score >= 60) {
    confidence = 'high';
    matched = true;
  } else if (score >= 40) {
    confidence = 'medium';
    matched = true;
  } else if (score >= 20) {
    confidence = 'low';
  }
  
  // Bestäm matchType
  let matchType: MatchResult['matchType'];
  if (details.includes('OCR/referens matchar')) {
    matchType = 'ocr_reference';
  } else if (details.includes('Exakt belopp')) {
    matchType = 'amount_date';
  } else {
    matchType = 'supplier_amount';
  }
  
  return {
    matched,
    confidence,
    matchType,
    transaction: matched ? transaction : undefined,
    matchScore: score,
    matchDetails: details,
  };
}

async function getTransactionsInRange(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<BankTransaction[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': `TRANSACTIONS#${companyId}`,
        ':start': startDate,
        ':end': endDate,
      },
    }));
    
    return (result.Items || []) as BankTransaction[];
  } catch (error) {
    console.error('[BankMatching] Get transactions error:', error);
    return [];
  }
}

async function registerMatch(
  companyId: string,
  jobId: string,
  transactionId: string,
  matchResult: MatchResult
): Promise<void> {
  const now = new Date().toISOString();
  
  // Uppdatera jobbet med matchinfo
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `JOB#${jobId}`, sk: 'METADATA' },
    UpdateExpression: 'SET bankMatchId = :txId, bankMatchConfidence = :conf, bankMatchDate = :date',
    ExpressionAttributeValues: {
      ':txId': transactionId,
      ':conf': matchResult.confidence,
      ':date': now,
    },
  }));
  
  // Uppdatera transaktionen med matchinfo
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `TRANSACTIONS#${companyId}`, sk: transactionId },
    UpdateExpression: 'SET matchedJobId = :jobId, matchedDate = :date',
    ExpressionAttributeValues: {
      ':jobId': jobId,
      ':date': now,
    },
  }));
  
  console.log(`[BankMatching] Matched job ${jobId} to transaction ${transactionId} (${matchResult.confidence})`);
}

function normalizeReference(ref: string): string {
  return ref.replace(/\D/g, '');
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function addDaysDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}





