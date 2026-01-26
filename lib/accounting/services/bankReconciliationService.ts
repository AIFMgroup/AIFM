/**
 * Bank Reconciliation Service
 * 
 * Komplett bankavstämning med:
 * - Automatisk matchning mot fakturor
 * - Smart OCR-läsning av betalningsreferenser
 * - Leverantörsigenkänning
 * - Realtidsstatistik
 * - Regelbaserad automatisk matchning
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  GetCommand
} from '@aws-sdk/lib-dynamodb';
import * as bankMatchingService from './bankMatchingService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
// Store reconciliation entities in the same DynamoDB table as accounting jobs to avoid extra infra.
// NOTE: these items intentionally do NOT set `createdAt` (job GSI key) unless needed for a specific entity.
const TABLE_NAME = process.env.AIFM_ACCOUNTING_TABLE || 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export interface ReconciliationRule {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  priority: number;
  
  // Villkor
  conditions: {
    type: 'amount' | 'description' | 'counterparty' | 'reference' | 'category';
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'range';
    value: string | number | [number, number];
  }[];
  
  // Åtgärd
  action: {
    type: 'match_invoice' | 'categorize' | 'ignore' | 'flag_review';
    account?: string;
    accountName?: string;
    costCenter?: string;
    vatCode?: string;
    description?: string;
  };
  
  // Statistik
  matchCount: number;
  lastMatchAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationSession {
  id: string;
  companyId: string;
  startDate: string;
  endDate: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  
  // Statistik
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  ignoredCount: number;
  flaggedCount: number;
  
  // Belopp
  totalAmount: number;
  matchedAmount: number;
  unmatchedAmount: number;
  
  // Metadata
  startedAt: string;
  completedAt?: string;
  startedBy: string;
}

export interface TransactionSuggestion {
  transactionId: string;
  suggestions: {
    type: 'invoice' | 'rule' | 'historical' | 'ai';
    confidence: number;
    description: string;
    data: {
      invoiceId?: string;
      invoiceNumber?: string;
      supplier?: string;
      amount?: number;
      account?: string;
      accountName?: string;
      costCenter?: string;
    };
  }[];
}

export interface BankAccount {
  id: string;
  companyId: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  currency: string;
  balance?: number;
  lastSyncAt?: string;
  isConnected: boolean;
  connectionProvider?: 'tink' | 'enable' | 'manual';
}

export interface ReconciliationStats {
  period: string;
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  ignoredTransactions: number;
  
  autoMatchRate: number; // percentage
  avgMatchTime: number; // seconds
  
  topUnmatchedSuppliers: {
    name: string;
    count: number;
    totalAmount: number;
  }[];
  
  matchByType: {
    exact_reference: number;
    amount_date: number;
    supplier_match: number;
    rule_based: number;
    manual: number;
  };
  
  amountsByCategory: {
    category: string;
    income: number;
    expense: number;
    count: number;
  }[];
}

// ============ Main Functions ============

/**
 * Starta en ny avstämningssession
 */
export async function startReconciliationSession(
  companyId: string,
  startDate: string,
  endDate: string,
  startedBy: string
): Promise<ReconciliationSession> {
  const sessionId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  
  // Hämta transaktioner för perioden
  const transactions = await bankMatchingService.getPendingTransactions(companyId, 500);
  const periodTransactions = transactions.filter(tx => 
    tx.transactionDate >= startDate && tx.transactionDate <= endDate
  );
  
  const totalAmount = periodTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  
  const session: ReconciliationSession = {
    id: sessionId,
    companyId,
    startDate,
    endDate,
    status: 'in_progress',
    totalTransactions: periodTransactions.length,
    matchedCount: 0,
    unmatchedCount: periodTransactions.length,
    ignoredCount: 0,
    flaggedCount: 0,
    totalAmount,
    matchedAmount: 0,
    unmatchedAmount: totalAmount,
    startedAt: now,
    startedBy,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `SESSION#${sessionId}`,
      ...session,
    },
  }));
  
  return session;
}

/**
 * Kör automatisk matchning för alla väntande transaktioner
 */
export async function runAutoReconciliation(
  companyId: string,
  sessionId: string
): Promise<{
  matched: number;
  suggested: number;
  unmatched: number;
  results: TransactionSuggestion[];
}> {
  // Hämta väntande transaktioner
  const transactions = await bankMatchingService.getPendingTransactions(companyId);
  
  // Hämta aktiva regler
  const rules = await getReconciliationRules(companyId);
  
  // Hämta kandidater (fakturor som väntar på betalning)
  const candidates = await getMatchCandidates(companyId);
  
  let matched = 0;
  let suggested = 0;
  let unmatched = 0;
  const results: TransactionSuggestion[] = [];
  
  for (const tx of transactions) {
    const suggestions: TransactionSuggestion['suggestions'] = [];
    
    // 1. Prova regelbaserad matchning först
    const ruleMatch = await applyRules(tx, rules);
    if (ruleMatch) {
      suggestions.push({
        type: 'rule',
        confidence: 0.95,
        description: `Regel: ${ruleMatch.name}`,
        data: {
          account: ruleMatch.action.account,
          accountName: ruleMatch.action.accountName,
          costCenter: ruleMatch.action.costCenter,
        },
      });
    }
    
    // 2. Sök efter matchande fakturor
    const invoiceMatches = await bankMatchingService.matchTransaction(companyId, tx, candidates);
    for (const candidate of invoiceMatches.candidates.slice(0, 3)) {
      suggestions.push({
        type: 'invoice',
        confidence: candidate.matchScore / 100,
        description: `Faktura ${candidate.invoiceNumber || ''} från ${candidate.supplier}`,
        data: {
          invoiceId: candidate.jobId,
          invoiceNumber: candidate.invoiceNumber,
          supplier: candidate.supplier,
          amount: candidate.amount,
        },
      });
    }
    
    // 3. Sök i historik för liknande transaktioner
    const historicalMatch = await findHistoricalMatch(companyId, tx);
    if (historicalMatch) {
      suggestions.push({
        type: 'historical',
        confidence: historicalMatch.confidence,
        description: `Baserat på tidigare transaktion`,
        data: {
          account: historicalMatch.account,
          accountName: historicalMatch.accountName,
          supplier: historicalMatch.supplier,
        },
      });
    }
    
    // Sortera efter confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    // Om bästa förslaget har hög confidence, auto-matcha
    if (suggestions.length > 0 && suggestions[0].confidence >= 0.95) {
      if (suggestions[0].type === 'invoice' && suggestions[0].data.invoiceId) {
        await bankMatchingService.confirmMatch(
          companyId, 
          tx.id, 
          suggestions[0].data.invoiceId,
          suggestions[0].confidence
        );
        matched++;
      } else if (suggestions[0].type === 'rule') {
        await applyRuleAction(companyId, tx.id, ruleMatch!);
        matched++;
      }
    } else if (suggestions.length > 0) {
      suggested++;
    } else {
      unmatched++;
    }
    
    results.push({
      transactionId: tx.id,
      suggestions,
    });
  }
  
  // Uppdatera sessionstatistik
  await updateSessionStats(companyId, sessionId, { matched, suggested, unmatched });
  
  return { matched, suggested, unmatched, results };
}

/**
 * Hämta matchkandidater (obetalda fakturor)
 */
async function getMatchCandidates(companyId: string): Promise<bankMatchingService.MatchCandidate[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: 'aifm-accounting-jobs',
      IndexName: 'companyId-createdAt-index',
      KeyConditionExpression: 'companyId = :companyId',
      FilterExpression: '#status IN (:ready, :approved, :sent) AND attribute_not_exists(bankMatchId)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':companyId': companyId,
        ':ready': 'ready',
        ':approved': 'approved',
        ':sent': 'sent',
      },
    }));
    
    return (result.Items || []).map(item => ({
      jobId: item.id as string,
      supplier: item.classification?.supplier || 'Okänd',
      invoiceNumber: item.classification?.invoiceNumber,
      amount: item.classification?.totalAmount || 0,
      dueDate: item.classification?.dueDate,
      invoiceDate: item.classification?.invoiceDate,
      reference: item.classification?.reference,
      ocrNumber: item.classification?.ocrNumber,
      status: item.status as 'ready' | 'approved' | 'sent',
    }));
  } catch (error) {
    console.error('[BankReconciliation] Get candidates error:', error);
    return [];
  }
}

// ============ Rules Management ============

/**
 * Skapa en ny avstämningsregel
 */
export async function createReconciliationRule(
  companyId: string,
  rule: Omit<ReconciliationRule, 'id' | 'companyId' | 'matchCount' | 'createdAt' | 'updatedAt'>
): Promise<ReconciliationRule> {
  const ruleId = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  
  const newRule: ReconciliationRule = {
    ...rule,
    id: ruleId,
    companyId,
    matchCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `RULE#${ruleId}`,
      ...newRule,
    },
  }));
  
  return newRule;
}

/**
 * Hämta alla regler för ett företag
 */
export async function getReconciliationRules(companyId: string): Promise<ReconciliationRule[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      FilterExpression: 'isActive = :active',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${companyId}`,
        ':prefix': 'RULE#',
        ':active': true,
      },
    }));
    
    return ((result.Items || []) as ReconciliationRule[])
      .sort((a, b) => a.priority - b.priority);
  } catch (error) {
    console.error('[BankReconciliation] Get rules error:', error);
    return [];
  }
}

/**
 * Applicera regler på en transaktion
 */
async function applyRules(
  transaction: bankMatchingService.BankTransaction,
  rules: ReconciliationRule[]
): Promise<ReconciliationRule | null> {
  for (const rule of rules) {
    if (matchesRule(transaction, rule)) {
      return rule;
    }
  }
  return null;
}

function matchesRule(
  transaction: bankMatchingService.BankTransaction,
  rule: ReconciliationRule
): boolean {
  for (const condition of rule.conditions) {
    let value: string | number;
    
    switch (condition.type) {
      case 'amount':
        value = Math.abs(transaction.amount);
        break;
      case 'description':
        value = transaction.description;
        break;
      case 'counterparty':
        value = transaction.counterpartyName || '';
        break;
      case 'reference':
        value = transaction.reference || '';
        break;
      case 'category':
        value = transaction.category || '';
        break;
      default:
        continue;
    }
    
    let matches = false;
    
    switch (condition.operator) {
      case 'equals':
        matches = String(value).toLowerCase() === String(condition.value).toLowerCase();
        break;
      case 'contains':
        matches = String(value).toLowerCase().includes(String(condition.value).toLowerCase());
        break;
      case 'startsWith':
        matches = String(value).toLowerCase().startsWith(String(condition.value).toLowerCase());
        break;
      case 'endsWith':
        matches = String(value).toLowerCase().endsWith(String(condition.value).toLowerCase());
        break;
      case 'regex':
        try {
          matches = new RegExp(String(condition.value), 'i').test(String(value));
        } catch {
          matches = false;
        }
        break;
      case 'range':
        if (Array.isArray(condition.value) && typeof value === 'number') {
          matches = value >= condition.value[0] && value <= condition.value[1];
        }
        break;
    }
    
    if (!matches) return false;
  }
  
  return true;
}

async function applyRuleAction(
  companyId: string,
  transactionId: string,
  rule: ReconciliationRule
): Promise<void> {
  // Uppdatera transaktionen med regelåtgärd
  await docClient.send(new UpdateCommand({
    TableName: 'aifm-bank-matching',
    Key: { pk: `COMPANY#${companyId}`, sk: `TX#${transactionId}` },
    UpdateExpression: 'SET #status = :status, appliedRuleId = :ruleId, suggestedAccount = :account, suggestedAccountName = :accountName, suggestedCostCenter = :costCenter',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': rule.action.type === 'ignore' ? 'IGNORED' : 'CATEGORIZED',
      ':ruleId': rule.id,
      ':account': rule.action.account || null,
      ':accountName': rule.action.accountName || null,
      ':costCenter': rule.action.costCenter || null,
    },
  }));
  
  // Uppdatera regelstatistik
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `RULE#${rule.id}` },
    UpdateExpression: 'SET matchCount = matchCount + :inc, lastMatchAt = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':now': new Date().toISOString(),
    },
  }));
}

// ============ Historical Matching ============

/**
 * Hitta liknande historiska transaktioner
 */
async function findHistoricalMatch(
  companyId: string,
  transaction: bankMatchingService.BankTransaction
): Promise<{
  confidence: number;
  account: string;
  accountName: string;
  supplier?: string;
} | null> {
  try {
    // Sök efter transaktioner med liknande beskrivning
    const result = await docClient.send(new QueryCommand({
      TableName: 'aifm-bank-matching',
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: '#status = :status AND contains(description, :desc)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${companyId}`,
        ':status': 'MATCHED',
        ':desc': extractKeywords(transaction.description),
      },
      Limit: 10,
    }));
    
    if (!result.Items || result.Items.length === 0) return null;
    
    // Hitta mest liknande
    const similar = result.Items[0];
    if (similar.suggestedAccount) {
      return {
        confidence: 0.75,
        account: similar.suggestedAccount as string,
        accountName: similar.suggestedAccountName as string || '',
        supplier: similar.counterpartyName as string,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[BankReconciliation] Historical match error:', error);
    return null;
  }
}

function extractKeywords(text: string): string {
  // Extrahera första 3 ord som är längre än 3 tecken
  const words = text.split(/\s+/).filter(w => w.length > 3);
  return words.slice(0, 3).join(' ');
}

// ============ Session Management ============

async function updateSessionStats(
  companyId: string,
  sessionId: string,
  stats: { matched: number; suggested: number; unmatched: number }
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `SESSION#${sessionId}` },
    UpdateExpression: 'SET matchedCount = matchedCount + :matched, unmatchedCount = :unmatched, flaggedCount = flaggedCount + :suggested, updatedAt = :now',
    ExpressionAttributeValues: {
      ':matched': stats.matched,
      ':unmatched': stats.unmatched,
      ':suggested': stats.suggested,
      ':now': new Date().toISOString(),
    },
  }));
}

/**
 * Avsluta en avstämningssession
 */
export async function completeReconciliationSession(
  companyId: string,
  sessionId: string
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `SESSION#${sessionId}` },
    UpdateExpression: 'SET #status = :status, completedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'completed',
      ':now': new Date().toISOString(),
    },
  }));
}

// ============ Statistics ============

/**
 * Hämta avstämningsstatistik för en period
 */
export async function getReconciliationStats(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<ReconciliationStats> {
  const summary = await bankMatchingService.generateReconciliationSummary(
    companyId,
    parseInt(startDate.slice(0, 4)),
    parseInt(startDate.slice(5, 7))
  );
  
  // Beräkna matchningstyper
  const matchByType = {
    exact_reference: 0,
    amount_date: 0,
    supplier_match: 0,
    rule_based: 0,
    manual: 0,
  };
  
  // Beräkna automatchningsgrad
  const autoMatchRate = summary.totalTransactions > 0
    ? (summary.matchedCount / summary.totalTransactions) * 100
    : 0;
  
  return {
    period: `${startDate} - ${endDate}`,
    totalTransactions: summary.totalTransactions,
    matchedTransactions: summary.matchedCount,
    unmatchedTransactions: summary.unmatchedCount,
    ignoredTransactions: summary.ignoredCount,
    autoMatchRate,
    avgMatchTime: 0, // Would be calculated from actual timing data
    topUnmatchedSuppliers: [],
    matchByType,
    amountsByCategory: [],
  };
}

// ============ Bank Account Management ============

/**
 * Lägg till ett bankkonto
 */
export async function addBankAccount(
  companyId: string,
  account: Omit<BankAccount, 'id' | 'companyId'>
): Promise<BankAccount> {
  const accountId = `bank-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const newAccount: BankAccount = {
    ...account,
    id: accountId,
    companyId,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `BANK#${accountId}`,
      ...newAccount,
    },
  }));
  
  return newAccount;
}

/**
 * Hämta alla bankkonton för ett företag
 */
export async function getBankAccounts(companyId: string): Promise<BankAccount[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${companyId}`,
        ':prefix': 'BANK#',
      },
    }));
    
    return (result.Items || []) as BankAccount[];
  } catch (error) {
    console.error('[BankReconciliation] Get bank accounts error:', error);
    return [];
  }
}







