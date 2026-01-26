/**
 * Auto-Approve Rules Engine
 * 
 * Regelmotor för automatisk godkännande av bokföringsunderlag.
 * Stödjer:
 * - Leverantörsbaserade regler
 * - Beloppsbaserade regler
 * - Kontobaserade regler
 * - Confidence-baserade regler
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  QueryCommand,
  DeleteCommand 
} from '@aws-sdk/lib-dynamodb';
import { Classification } from '../jobStore';
import { getSupplierProfile } from './supplierMemory';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type RuleType = 
  | 'supplier_whitelist'      // Godkänn alltid från denna leverantör
  | 'amount_threshold'        // Godkänn under visst belopp
  | 'account_auto'            // Godkänn om konto är X
  | 'confidence_threshold'    // Godkänn om confidence > X
  | 'known_supplier'          // Godkänn om leverantör är känd sedan tidigare
  | 'combined';               // Kombinera flera villkor

export interface ApprovalRule {
  ruleId: string;
  companyId: string;
  name: string;
  description: string;
  type: RuleType;
  enabled: boolean;
  priority: number; // Lägre = högre prioritet
  
  // Villkor
  conditions: {
    // Leverantör
    supplierPattern?: string;    // Regex eller exakt match
    supplierExact?: string[];    // Lista med exakta leverantörer
    
    // Belopp
    maxAmount?: number;
    minAmount?: number;
    
    // Konto
    accounts?: string[];         // Lista med tillåtna konton
    
    // Confidence
    minConfidence?: number;      // 0.0 - 1.0
    
    // Dokumenttyp
    docTypes?: ('INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'BANK' | 'OTHER')[];
    
    // Kombinera med AND/OR
    operator?: 'AND' | 'OR';
  };
  
  // Åtgärd
  action: 'auto_approve' | 'flag_for_review' | 'reject';
  
  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  triggerCount: number;
  lastTriggeredAt?: string;
}

export interface RuleEvaluationResult {
  shouldAutoApprove: boolean;
  matchedRules: {
    rule: ApprovalRule;
    matched: boolean;
    reason: string;
  }[];
  finalAction: 'auto_approve' | 'manual_review' | 'flag_for_review' | 'reject';
  confidence: number;
  summary: string;
}

/**
 * Skapa default-regler för ett bolag
 */
export async function createDefaultRules(companyId: string, createdBy: string): Promise<void> {
  const defaultRules: Omit<ApprovalRule, 'ruleId' | 'createdAt' | 'updatedAt' | 'triggerCount'>[] = [
    {
      companyId,
      name: 'Hög confidence + känd leverantör',
      description: 'Auto-godkänn om AI:n är >95% säker och leverantören är känd sedan tidigare',
      type: 'combined',
      enabled: true,
      priority: 1,
      conditions: {
        minConfidence: 0.95,
        operator: 'AND',
      },
      action: 'auto_approve',
      createdBy,
    },
    {
      companyId,
      name: 'Små kvitton',
      description: 'Auto-godkänn kvitton under 500 kr med confidence >80%',
      type: 'combined',
      enabled: true,
      priority: 2,
      conditions: {
        maxAmount: 500,
        minConfidence: 0.8,
        docTypes: ['RECEIPT'],
        operator: 'AND',
      },
      action: 'auto_approve',
      createdBy,
    },
    {
      companyId,
      name: 'AWS/Cloud-tjänster',
      description: 'Auto-godkänn fakturor från AWS, Google, Microsoft till konto 6250',
      type: 'supplier_whitelist',
      enabled: true,
      priority: 3,
      conditions: {
        supplierPattern: '(aws|amazon|google|microsoft|azure|github|vercel)',
        accounts: ['6250'],
        operator: 'AND',
      },
      action: 'auto_approve',
      createdBy,
    },
    {
      companyId,
      name: 'Stora belopp - manuell granskning',
      description: 'Flagga fakturor över 50 000 kr för manuell granskning',
      type: 'amount_threshold',
      enabled: true,
      priority: 0, // Högst prioritet
      conditions: {
        minAmount: 50000,
      },
      action: 'flag_for_review',
      createdBy,
    },
    {
      companyId,
      name: 'Låg confidence',
      description: 'Flagga om AI:n är osäker (<70%)',
      type: 'confidence_threshold',
      enabled: true,
      priority: 0,
      conditions: {
        minConfidence: 0, // Match allt
      },
      action: 'flag_for_review',
      createdBy,
    },
  ];
  
  const now = new Date().toISOString();
  
  for (let i = 0; i < defaultRules.length; i++) {
    const rule = defaultRules[i];
    const ruleId = `rule-${Date.now()}-${i}`;
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `RULES#${companyId}`,
        sk: ruleId,
        ...rule,
        ruleId,
        createdAt: now,
        updatedAt: now,
        triggerCount: 0,
      }
    }));
  }
  
  console.log(`[AutoApprove] Created ${defaultRules.length} default rules for company ${companyId}`);
}

/**
 * Hämta alla regler för ett bolag
 */
export async function getRules(companyId: string): Promise<ApprovalRule[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `RULES#${companyId}`,
      },
    }));
    
    const rules = (result.Items || []) as ApprovalRule[];
    return rules.sort((a, b) => a.priority - b.priority);
  } catch (error) {
    console.error('[AutoApprove] Get rules error:', error);
    return [];
  }
}

/**
 * Evaluera alla regler mot ett dokument
 */
export async function evaluateRules(
  companyId: string,
  classification: Classification,
  overallConfidence: number
): Promise<RuleEvaluationResult> {
  const rules = await getRules(companyId);
  const matchedRules: RuleEvaluationResult['matchedRules'] = [];
  
  // Kolla om leverantören är känd
  const supplierProfile = await getSupplierProfile(companyId, classification.supplier);
  const isKnownSupplier = !!supplierProfile;
  
  let shouldAutoApprove = false;
  let finalAction: RuleEvaluationResult['finalAction'] = 'manual_review';
  let highestPriorityAction: ApprovalRule['action'] | null = null;
  let highestPriority = Infinity;
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    const { matched, reason } = evaluateRule(rule, classification, overallConfidence, isKnownSupplier);
    
    matchedRules.push({ rule, matched, reason });
    
    if (matched && rule.priority < highestPriority) {
      highestPriority = rule.priority;
      highestPriorityAction = rule.action;
      
      // Uppdatera trigger count (async, don't wait)
      incrementTriggerCount(companyId, rule.ruleId).catch(console.error);
    }
  }
  
  // Bestäm slutlig åtgärd
  if (highestPriorityAction === 'auto_approve') {
    shouldAutoApprove = true;
    finalAction = 'auto_approve';
  } else if (highestPriorityAction === 'flag_for_review') {
    finalAction = 'flag_for_review';
  } else if (highestPriorityAction === 'reject') {
    finalAction = 'reject';
  }
  
  // Säkerhetskontroller som alltid gäller
  if (overallConfidence < 0.7) {
    shouldAutoApprove = false;
    finalAction = 'flag_for_review';
  }
  
  // Bygg sammanfattning
  const approvedRules = matchedRules.filter(r => r.matched && r.rule.action === 'auto_approve');
  const flaggedRules = matchedRules.filter(r => r.matched && r.rule.action === 'flag_for_review');
  
  let summary = '';
  if (shouldAutoApprove) {
    summary = `Auto-godkänd: ${approvedRules.map(r => r.rule.name).join(', ')}`;
  } else if (flaggedRules.length > 0) {
    summary = `Flaggad: ${flaggedRules.map(r => r.rule.name).join(', ')}`;
  } else {
    summary = 'Ingen regel matchade - manuell granskning';
  }
  
  return {
    shouldAutoApprove,
    matchedRules,
    finalAction,
    confidence: overallConfidence,
    summary,
  };
}

/**
 * Lägg till en ny regel
 */
export async function addRule(rule: Omit<ApprovalRule, 'ruleId' | 'createdAt' | 'updatedAt' | 'triggerCount'>): Promise<string> {
  const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `RULES#${rule.companyId}`,
      sk: ruleId,
      ...rule,
      ruleId,
      createdAt: now,
      updatedAt: now,
      triggerCount: 0,
    }
  }));
  
  return ruleId;
}

/**
 * Ta bort en regel
 */
export async function deleteRule(companyId: string, ruleId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `RULES#${companyId}`,
      sk: ruleId,
    }
  }));
}

// ============ Interna hjälpfunktioner ============

function evaluateRule(
  rule: ApprovalRule,
  classification: Classification,
  confidence: number,
  isKnownSupplier: boolean
): { matched: boolean; reason: string } {
  const { conditions } = rule;
  const results: { condition: string; passed: boolean }[] = [];
  
  // Leverantör pattern
  if (conditions.supplierPattern) {
    const regex = new RegExp(conditions.supplierPattern, 'i');
    const passed = regex.test(classification.supplier);
    results.push({ condition: 'supplier_pattern', passed });
  }
  
  // Leverantör exakt
  if (conditions.supplierExact && conditions.supplierExact.length > 0) {
    const normalizedSupplier = classification.supplier.toLowerCase();
    const passed = conditions.supplierExact.some(s => normalizedSupplier.includes(s.toLowerCase()));
    results.push({ condition: 'supplier_exact', passed });
  }
  
  // Belopp max
  if (conditions.maxAmount !== undefined) {
    const passed = classification.totalAmount <= conditions.maxAmount;
    results.push({ condition: 'max_amount', passed });
  }
  
  // Belopp min
  if (conditions.minAmount !== undefined) {
    const passed = classification.totalAmount >= conditions.minAmount;
    results.push({ condition: 'min_amount', passed });
  }
  
  // Konto
  if (conditions.accounts && conditions.accounts.length > 0) {
    const usedAccounts = classification.lineItems.map(li => li.suggestedAccount);
    const passed = usedAccounts.some(a => conditions.accounts!.includes(a));
    results.push({ condition: 'accounts', passed });
  }
  
  // Confidence
  if (conditions.minConfidence !== undefined) {
    // Special case: om minConfidence är 0, matcha allt under 0.7 (för "låg confidence" regel)
    if (conditions.minConfidence === 0 && rule.action === 'flag_for_review') {
      const passed = confidence < 0.7;
      results.push({ condition: 'low_confidence', passed });
    } else {
      const passed = confidence >= conditions.minConfidence;
      results.push({ condition: 'min_confidence', passed });
    }
  }
  
  // Dokumenttyp
  if (conditions.docTypes && conditions.docTypes.length > 0) {
    const passed = conditions.docTypes.includes(classification.docType);
    results.push({ condition: 'doc_type', passed });
  }
  
  // Känd leverantör (implicit för combined rules med minConfidence)
  if (rule.type === 'combined' && conditions.minConfidence && conditions.minConfidence >= 0.9) {
    results.push({ condition: 'known_supplier', passed: isKnownSupplier });
  }
  
  // Ingen villkor = matcha alltid
  if (results.length === 0) {
    return { matched: true, reason: 'Ingen villkor - matchade alltid' };
  }
  
  // Kombinera resultat
  const operator = conditions.operator || 'AND';
  const matched = operator === 'AND'
    ? results.every(r => r.passed)
    : results.some(r => r.passed);
  
  const passedConditions = results.filter(r => r.passed).map(r => r.condition);
  const failedConditions = results.filter(r => !r.passed).map(r => r.condition);
  
  const reason = matched
    ? `Matchade: ${passedConditions.join(', ')}`
    : `Missade: ${failedConditions.join(', ')}`;
  
  return { matched, reason };
}

async function incrementTriggerCount(companyId: string, ruleId: string): Promise<void> {
  const now = new Date().toISOString();
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `RULES#${companyId}`,
        sk: ruleId,
      },
      // Note: In production, use UpdateCommand with atomic increment
    }));
  } catch (error) {
    // Ignore errors for trigger count
  }
}





