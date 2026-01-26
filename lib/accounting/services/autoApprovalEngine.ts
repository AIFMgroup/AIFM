/**
 * Auto-Approval Engine
 * 
 * Automatiskt godkänner dokument som uppfyller alla regler.
 * Minskar manuellt arbete för kollegor.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export interface AutoApprovalRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // Högre = checkas först
  conditions: RuleCondition[];
  action: 'AUTO_APPROVE' | 'AUTO_APPROVE_AND_SEND' | 'FLAG_FOR_REVIEW';
  createdAt: string;
  updatedAt: string;
}

export interface RuleCondition {
  field: 'confidence' | 'supplier_known' | 'supplier_approval_count' | 'amount' | 'amount_variance' | 'doc_type' | 'has_duplicate_warning';
  operator: 'gte' | 'lte' | 'eq' | 'neq' | 'in' | 'between';
  value: number | string | boolean | string[] | [number, number];
}

export interface AutoApprovalResult {
  shouldAutoApprove: boolean;
  action: 'AUTO_APPROVE' | 'AUTO_APPROVE_AND_SEND' | 'NEEDS_REVIEW' | 'NEEDS_APPROVAL';
  matchedRule?: AutoApprovalRule;
  reason: string;
  confidence: number;
  checks: RuleCheck[];
}

export interface RuleCheck {
  rule: string;
  passed: boolean;
  details: string;
}

export interface SupplierStats {
  supplierId: string;
  supplierName: string;
  totalApprovals: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
  stdDeviation: number;
  lastApprovalDate: string;
  typicalAccounts: string[];
}

// ============ Default Rules ============

const DEFAULT_RULES: AutoApprovalRule[] = [
  {
    id: 'rule-auto-high-confidence',
    name: 'Hög AI-säkerhet + Känd leverantör',
    description: 'Auto-godkänn om AI är ≥95% säker och leverantören har godkänts ≥3 gånger tidigare',
    enabled: true,
    priority: 100,
    conditions: [
      { field: 'confidence', operator: 'gte', value: 0.95 },
      { field: 'supplier_approval_count', operator: 'gte', value: 3 },
      { field: 'amount_variance', operator: 'lte', value: 0.5 }, // Max 50% avvikelse
      { field: 'has_duplicate_warning', operator: 'eq', value: false },
    ],
    action: 'AUTO_APPROVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-auto-very-high-confidence',
    name: 'Mycket hög AI-säkerhet',
    description: 'Auto-godkänn och skicka om AI är ≥98% säker, känd leverantör, och belopp < 5000 kr',
    enabled: true,
    priority: 110,
    conditions: [
      { field: 'confidence', operator: 'gte', value: 0.98 },
      { field: 'supplier_approval_count', operator: 'gte', value: 5 },
      { field: 'amount', operator: 'lte', value: 5000 },
      { field: 'amount_variance', operator: 'lte', value: 0.3 },
      { field: 'has_duplicate_warning', operator: 'eq', value: false },
    ],
    action: 'AUTO_APPROVE_AND_SEND',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-recurring-supplier',
    name: 'Återkommande leverantör',
    description: 'Auto-godkänn återkommande fakturor (≥10 godkännanden) med normalt belopp',
    enabled: true,
    priority: 90,
    conditions: [
      { field: 'confidence', operator: 'gte', value: 0.85 },
      { field: 'supplier_approval_count', operator: 'gte', value: 10 },
      { field: 'amount_variance', operator: 'lte', value: 0.2 }, // Max 20% avvikelse
      { field: 'has_duplicate_warning', operator: 'eq', value: false },
    ],
    action: 'AUTO_APPROVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-small-receipt',
    name: 'Små kvitton',
    description: 'Auto-godkänn kvitton under 500 kr med god AI-säkerhet',
    enabled: true,
    priority: 80,
    conditions: [
      { field: 'confidence', operator: 'gte', value: 0.90 },
      { field: 'doc_type', operator: 'eq', value: 'RECEIPT' },
      { field: 'amount', operator: 'lte', value: 500 },
      { field: 'has_duplicate_warning', operator: 'eq', value: false },
    ],
    action: 'AUTO_APPROVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ============ Supplier Stats ============

async function getSupplierStats(companyId: string, supplierName: string): Promise<SupplierStats | null> {
  const normalizedName = normalizeSupplierName(supplierName);
  
  try {
    // Hämta historik för leverantören
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUPPLIER_STATS#${companyId}#${normalizedName}`,
      },
      Limit: 1,
    }));

    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as SupplierStats;
    }

    return null;
  } catch (error) {
    console.error('[AutoApproval] Failed to get supplier stats:', error);
    return null;
  }
}

async function updateSupplierStats(
  companyId: string,
  supplierName: string,
  amount: number,
  account: string
): Promise<void> {
  const normalizedName = normalizeSupplierName(supplierName);
  const now = new Date().toISOString();

  try {
    const existing = await getSupplierStats(companyId, supplierName);

    if (existing) {
      // Uppdatera befintlig statistik
      const newTotal = existing.totalApprovals + 1;
      const newAverage = ((existing.averageAmount * existing.totalApprovals) + amount) / newTotal;
      const newMin = Math.min(existing.minAmount, amount);
      const newMax = Math.max(existing.maxAmount, amount);
      
      // Beräkna ny standardavvikelse (förenklad)
      const variance = Math.abs(amount - newAverage) / newAverage;
      const newStdDev = (existing.stdDeviation * existing.totalApprovals + variance) / newTotal;

      // Uppdatera typiska konton
      const accounts = existing.typicalAccounts || [];
      if (!accounts.includes(account)) {
        accounts.push(account);
      }

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `SUPPLIER_STATS#${companyId}#${normalizedName}`,
          sk: 'STATS',
          supplierId: normalizedName,
          supplierName,
          totalApprovals: newTotal,
          averageAmount: newAverage,
          minAmount: newMin,
          maxAmount: newMax,
          stdDeviation: newStdDev,
          lastApprovalDate: now,
          typicalAccounts: accounts.slice(-5), // Behåll senaste 5
          updatedAt: now,
        },
      }));
    } else {
      // Skapa ny statistik
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `SUPPLIER_STATS#${companyId}#${normalizedName}`,
          sk: 'STATS',
          supplierId: normalizedName,
          supplierName,
          totalApprovals: 1,
          averageAmount: amount,
          minAmount: amount,
          maxAmount: amount,
          stdDeviation: 0,
          lastApprovalDate: now,
          typicalAccounts: [account],
          createdAt: now,
          updatedAt: now,
        },
      }));
    }
  } catch (error) {
    console.error('[AutoApproval] Failed to update supplier stats:', error);
  }
}

function normalizeSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zåäö0-9]/g, '')
    .trim();
}

// ============ Rule Evaluation ============

interface EvaluationContext {
  companyId: string;
  jobId: string;
  confidence: number;
  supplier: string;
  amount: number;
  docType: string;
  hasDuplicateWarning: boolean;
  supplierStats: SupplierStats | null;
}

function evaluateCondition(condition: RuleCondition, context: EvaluationContext): { passed: boolean; details: string } {
  switch (condition.field) {
    case 'confidence':
      const confValue = condition.value as number;
      if (condition.operator === 'gte') {
        return {
          passed: context.confidence >= confValue,
          details: `AI-säkerhet ${(context.confidence * 100).toFixed(0)}% ${context.confidence >= confValue ? '≥' : '<'} ${(confValue * 100).toFixed(0)}%`,
        };
      }
      break;

    case 'supplier_known':
      const isKnown = context.supplierStats !== null && context.supplierStats.totalApprovals > 0;
      return {
        passed: condition.operator === 'eq' ? isKnown === condition.value : isKnown !== condition.value,
        details: isKnown ? `Leverantör "${context.supplier}" är känd` : `Leverantör "${context.supplier}" är ny`,
      };

    case 'supplier_approval_count':
      const count = context.supplierStats?.totalApprovals || 0;
      const reqCount = condition.value as number;
      if (condition.operator === 'gte') {
        return {
          passed: count >= reqCount,
          details: `Leverantör har ${count} ${count >= reqCount ? '≥' : '<'} ${reqCount} tidigare godkännanden`,
        };
      }
      break;

    case 'amount':
      const amtValue = condition.value as number;
      if (condition.operator === 'lte') {
        return {
          passed: context.amount <= amtValue,
          details: `Belopp ${context.amount.toFixed(0)} kr ${context.amount <= amtValue ? '≤' : '>'} ${amtValue} kr`,
        };
      }
      if (condition.operator === 'gte') {
        return {
          passed: context.amount >= amtValue,
          details: `Belopp ${context.amount.toFixed(0)} kr ${context.amount >= amtValue ? '≥' : '<'} ${amtValue} kr`,
        };
      }
      if (condition.operator === 'between') {
        const [min, max] = condition.value as [number, number];
        const inRange = context.amount >= min && context.amount <= max;
        return {
          passed: inRange,
          details: `Belopp ${context.amount.toFixed(0)} kr ${inRange ? 'inom' : 'utanför'} ${min}-${max} kr`,
        };
      }
      break;

    case 'amount_variance':
      if (!context.supplierStats || context.supplierStats.totalApprovals < 2) {
        return {
          passed: true, // Kan inte beräkna avvikelse utan historik
          details: 'Ingen historik att jämföra belopp mot',
        };
      }
      const avgAmount = context.supplierStats.averageAmount;
      const variance = Math.abs(context.amount - avgAmount) / avgAmount;
      const maxVariance = condition.value as number;
      if (condition.operator === 'lte') {
        return {
          passed: variance <= maxVariance,
          details: `Beloppsavvikelse ${(variance * 100).toFixed(0)}% ${variance <= maxVariance ? '≤' : '>'} ${(maxVariance * 100).toFixed(0)}% (snitt: ${avgAmount.toFixed(0)} kr)`,
        };
      }
      break;

    case 'doc_type':
      if (condition.operator === 'eq') {
        const matches = context.docType === condition.value;
        return {
          passed: matches,
          details: `Dokumenttyp "${context.docType}" ${matches ? '=' : '≠'} "${condition.value}"`,
        };
      }
      if (condition.operator === 'in') {
        const types = condition.value as string[];
        const matches = types.includes(context.docType);
        return {
          passed: matches,
          details: `Dokumenttyp "${context.docType}" ${matches ? 'i' : 'ej i'} [${types.join(', ')}]`,
        };
      }
      break;

    case 'has_duplicate_warning':
      const hasDup = context.hasDuplicateWarning;
      const expected = condition.value as boolean;
      return {
        passed: condition.operator === 'eq' ? hasDup === expected : hasDup !== expected,
        details: hasDup ? 'Duplikattvarning finns' : 'Ingen duplikattvarning',
      };
  }

  return { passed: false, details: 'Okänt villkor' };
}

function evaluateRule(rule: AutoApprovalRule, context: EvaluationContext): { passed: boolean; checks: RuleCheck[] } {
  const checks: RuleCheck[] = [];
  let allPassed = true;

  for (const condition of rule.conditions) {
    const result = evaluateCondition(condition, context);
    checks.push({
      rule: `${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`,
      passed: result.passed,
      details: result.details,
    });
    if (!result.passed) {
      allPassed = false;
    }
  }

  return { passed: allPassed, checks };
}

// ============ Main Evaluation Function ============

export async function evaluateAutoApproval(
  companyId: string,
  job: {
    id: string;
    classification: {
      docType: string;
      supplier: string;
      totalAmount: number;
      overallConfidence: number;
      lineItems: { suggestedAccount: string }[];
    };
    hasDuplicateWarning?: boolean;
  }
): Promise<AutoApprovalResult> {
  // Hämta leverantörsstatistik
  const supplierStats = await getSupplierStats(companyId, job.classification.supplier);

  const context: EvaluationContext = {
    companyId,
    jobId: job.id,
    confidence: job.classification.overallConfidence,
    supplier: job.classification.supplier,
    amount: job.classification.totalAmount,
    docType: job.classification.docType,
    hasDuplicateWarning: job.hasDuplicateWarning || false,
    supplierStats,
  };

  // Sortera regler efter prioritet (högst först)
  const sortedRules = [...DEFAULT_RULES]
    .filter(r => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  // Utvärdera varje regel
  for (const rule of sortedRules) {
    const { passed, checks } = evaluateRule(rule, context);

    if (passed) {
      return {
        shouldAutoApprove: rule.action !== 'FLAG_FOR_REVIEW',
        action: rule.action === 'AUTO_APPROVE_AND_SEND' ? 'AUTO_APPROVE_AND_SEND' : 
               rule.action === 'AUTO_APPROVE' ? 'AUTO_APPROVE' : 'NEEDS_REVIEW',
        matchedRule: rule,
        reason: `Matchade regel: "${rule.name}"`,
        confidence: context.confidence,
        checks,
      };
    }
  }

  // Ingen regel matchade - behöver manuell granskning
  return {
    shouldAutoApprove: false,
    action: 'NEEDS_REVIEW',
    reason: 'Ingen auto-godkännanderegel matchade',
    confidence: context.confidence,
    checks: [
      {
        rule: 'Alla regler',
        passed: false,
        details: `Ingen av ${sortedRules.length} regler uppfylldes`,
      },
    ],
  };
}

// ============ Record Approval (for learning) ============

export async function recordApproval(
  companyId: string,
  job: {
    id: string;
    classification: {
      supplier: string;
      totalAmount: number;
      lineItems: { suggestedAccount: string }[];
    };
  },
  wasAutoApproved: boolean
): Promise<void> {
  const account = job.classification.lineItems[0]?.suggestedAccount || '4010';
  
  await updateSupplierStats(
    companyId,
    job.classification.supplier,
    job.classification.totalAmount,
    account
  );

  // Logga godkännandet
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `APPROVAL_LOG#${companyId}`,
      sk: `${now}#${job.id}`,
      jobId: job.id,
      supplier: job.classification.supplier,
      amount: job.classification.totalAmount,
      wasAutoApproved,
      timestamp: now,
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60), // 7 år
    },
  }));
}

// ============ Get Rules (for UI) ============

export function getAutoApprovalRules(): AutoApprovalRule[] {
  return DEFAULT_RULES;
}

// ============ Stats for Dashboard ============

export async function getAutoApprovalStats(companyId: string): Promise<{
  totalAutoApproved: number;
  totalManualApproved: number;
  autoApprovalRate: number;
  topAutoApprovedSuppliers: { supplier: string; count: number }[];
}> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `APPROVAL_LOG#${companyId}`,
      },
      ScanIndexForward: false,
      Limit: 1000,
    }));

    const logs = result.Items || [];
    const autoApproved = logs.filter((l: any) => l.wasAutoApproved);
    const manualApproved = logs.filter((l: any) => !l.wasAutoApproved);

    // Räkna per leverantör
    const supplierCounts: Record<string, number> = {};
    autoApproved.forEach((l: any) => {
      supplierCounts[l.supplier] = (supplierCounts[l.supplier] || 0) + 1;
    });

    const topSuppliers = Object.entries(supplierCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([supplier, count]) => ({ supplier, count }));

    return {
      totalAutoApproved: autoApproved.length,
      totalManualApproved: manualApproved.length,
      autoApprovalRate: logs.length > 0 ? autoApproved.length / logs.length : 0,
      topAutoApprovedSuppliers: topSuppliers,
    };
  } catch (error) {
    console.error('[AutoApproval] Failed to get stats:', error);
    return {
      totalAutoApproved: 0,
      totalManualApproved: 0,
      autoApprovalRate: 0,
      topAutoApprovedSuppliers: [],
    };
  }
}















