/**
 * Approval Workflow Service
 * 
 * Hanterar godkännandeflöden baserat på belopp och behörigheter.
 * Stödjer eskalering och delegering.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export type ApprovalLevel = 'AUTO' | 'STANDARD' | 'MANAGER' | 'EXECUTIVE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'DELEGATED';

export interface ApprovalThreshold {
  level: ApprovalLevel;
  minAmount: number;
  maxAmount: number | null; // null = ingen övre gräns
  requiredRole: string;
  description: string;
}

export interface ApprovalRequest {
  id: string;
  jobId: string;
  companyId: string;
  requestedLevel: ApprovalLevel;
  currentStatus: ApprovalStatus;
  amount: number;
  supplier: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  approvers: ApprovalAction[];
  escalatedTo?: string;
  delegatedTo?: string;
  dueDate?: string;
  notes?: string;
}

export interface ApprovalAction {
  userId: string;
  userName: string;
  userRole: string;
  action: 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'DELEGATED' | 'COMMENTED';
  timestamp: string;
  comment?: string;
  delegatedTo?: string;
}

export interface ApprovalConfig {
  companyId: string;
  thresholds: ApprovalThreshold[];
  defaultApprovers: { level: ApprovalLevel; userIds: string[] }[];
  escalationTimeout: number; // Timmar innan automatisk eskalering
  enableAutoApproval: boolean;
  autoApprovalMaxAmount: number;
  requireDualApproval: boolean; // Kräv två godkännare för höga belopp
  dualApprovalThreshold: number;
}

export interface WorkflowDecision {
  requiredLevel: ApprovalLevel;
  canAutoApprove: boolean;
  requiresDualApproval: boolean;
  suggestedApprovers: string[];
  reason: string;
  thresholdDetails: ApprovalThreshold;
}

// ============ Default Configuration ============

const DEFAULT_THRESHOLDS: ApprovalThreshold[] = [
  {
    level: 'AUTO',
    minAmount: 0,
    maxAmount: 5000,
    requiredRole: 'system',
    description: 'Automatiskt godkännande för små belopp',
  },
  {
    level: 'STANDARD',
    minAmount: 5000,
    maxAmount: 50000,
    requiredRole: 'accountant',
    description: 'Standardgodkännande av ekonomiansvarig',
  },
  {
    level: 'MANAGER',
    minAmount: 50000,
    maxAmount: 200000,
    requiredRole: 'manager',
    description: 'Chefsgodkännande krävs',
  },
  {
    level: 'EXECUTIVE',
    minAmount: 200000,
    maxAmount: null,
    requiredRole: 'executive',
    description: 'VD/CFO-godkännande krävs',
  },
];

const DEFAULT_CONFIG: Omit<ApprovalConfig, 'companyId'> = {
  thresholds: DEFAULT_THRESHOLDS,
  defaultApprovers: [
    { level: 'STANDARD', userIds: ['accountant-1'] },
    { level: 'MANAGER', userIds: ['manager-1'] },
    { level: 'EXECUTIVE', userIds: ['cfo-1', 'ceo-1'] },
  ],
  escalationTimeout: 48, // 48 timmar
  enableAutoApproval: true,
  autoApprovalMaxAmount: 5000,
  requireDualApproval: true,
  dualApprovalThreshold: 100000,
};

// ============ Workflow Logic ============

export async function getApprovalConfig(companyId: string): Promise<ApprovalConfig> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `APPROVAL_CONFIG#${companyId}`,
        sk: 'CONFIG',
      },
    }));

    if (result.Item) {
      return result.Item as ApprovalConfig;
    }
  } catch (error) {
    console.error('[ApprovalWorkflow] Failed to get config:', error);
  }

  // Returnera default config
  return { companyId, ...DEFAULT_CONFIG };
}

export async function saveApprovalConfig(config: ApprovalConfig): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `APPROVAL_CONFIG#${config.companyId}`,
      sk: 'CONFIG',
      ...config,
      updatedAt: new Date().toISOString(),
    },
  }));
}

export function determineApprovalLevel(amount: number, config: ApprovalConfig): WorkflowDecision {
  // Hitta rätt tröskel baserat på belopp
  const threshold = config.thresholds.find(t => 
    amount >= t.minAmount && (t.maxAmount === null || amount < t.maxAmount)
  ) || config.thresholds[config.thresholds.length - 1];

  // Avgör om auto-godkännande är möjligt
  const canAutoApprove = config.enableAutoApproval && 
    amount <= config.autoApprovalMaxAmount && 
    threshold.level === 'AUTO';

  // Avgör om dubbelt godkännande krävs
  const requiresDualApproval = config.requireDualApproval && 
    amount >= config.dualApprovalThreshold;

  // Hitta föreslagna godkännare
  const approverConfig = config.defaultApprovers.find(a => a.level === threshold.level);
  const suggestedApprovers = approverConfig?.userIds || [];

  return {
    requiredLevel: threshold.level,
    canAutoApprove,
    requiresDualApproval,
    suggestedApprovers,
    reason: threshold.description,
    thresholdDetails: threshold,
  };
}

/**
 * Evaluate approval rules for a job
 * Used by the processing pipeline to determine if approval is required
 */
export interface ApprovalEvaluationResult {
  requiresApproval: boolean;
  requiredLevel: ApprovalLevel;
  matchedRules: string[];
  reason: string;
  suggestedApprovers: string[];
}

export async function evaluateApprovalRules(
  companyId: string,
  jobId: string,
  classification: {
    supplier: string;
    totalAmount: number;
    overallConfidence: number;
    invoiceNumber?: string;
  },
  anomalyResult: {
    hasAnomalies: boolean;
    riskScore: number;
    highestSeverity?: string | null;
  },
  isNewSupplier: boolean
): Promise<ApprovalEvaluationResult> {
  const config = await getApprovalConfig(companyId);
  const decision = determineApprovalLevel(classification.totalAmount, config);
  
  const matchedRules: string[] = [];
  let requiresApproval = false;
  let reason = '';

  // Regel 1: Beloppsbaserad godkännande
  if (decision.requiredLevel !== 'AUTO') {
    requiresApproval = true;
    matchedRules.push(`amount_threshold_${decision.requiredLevel}`);
    reason = `Belopp ${classification.totalAmount} kr kräver ${decision.requiredLevel}-godkännande`;
  }

  // Regel 2: Ny leverantör kräver alltid granskning för belopp > 1000 kr
  if (isNewSupplier && classification.totalAmount > 1000) {
    requiresApproval = true;
    matchedRules.push('new_supplier');
    reason = reason || `Ny leverantör "${classification.supplier}" kräver granskning`;
  }

  // Regel 3: Hög risk kräver eskalering
  if (anomalyResult.riskScore >= 50) {
    requiresApproval = true;
    matchedRules.push('high_risk');
    reason = reason || `Hög riskpoäng (${anomalyResult.riskScore}) kräver granskning`;
  }

  // Regel 4: Kritiska anomalier eskalerar direkt
  if (anomalyResult.highestSeverity === 'CRITICAL' || anomalyResult.highestSeverity === 'HIGH') {
    requiresApproval = true;
    matchedRules.push('anomaly_severity');
    reason = reason || `${anomalyResult.highestSeverity} anomali detekterad`;
  }

  // Regel 5: Låg AI-confidence
  if (classification.overallConfidence < 0.7) {
    requiresApproval = true;
    matchedRules.push('low_confidence');
    reason = reason || `Låg AI-säkerhet (${(classification.overallConfidence * 100).toFixed(0)}%)`;
  }

  return {
    requiresApproval,
    requiredLevel: decision.requiredLevel,
    matchedRules,
    reason: reason || 'Auto-godkännande möjligt',
    suggestedApprovers: decision.suggestedApprovers,
  };
}

// ============ Approval Request Management ============

export async function createApprovalRequest(
  companyId: string,
  job: {
    id: string;
    classification: {
      supplier: string;
      totalAmount: number;
      invoiceNumber?: string;
    };
  },
  requestedBy: string
): Promise<ApprovalRequest> {
  const config = await getApprovalConfig(companyId);
  const decision = determineApprovalLevel(job.classification.totalAmount, config);

  const request: ApprovalRequest = {
    id: `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    jobId: job.id,
    companyId,
    requestedLevel: decision.requiredLevel,
    currentStatus: decision.canAutoApprove ? 'APPROVED' : 'PENDING',
    amount: job.classification.totalAmount,
    supplier: job.classification.supplier,
    description: `Faktura ${job.classification.invoiceNumber || 'utan nummer'} från ${job.classification.supplier}`,
    requestedBy,
    requestedAt: new Date().toISOString(),
    approvers: decision.canAutoApprove ? [{
      userId: 'system',
      userName: 'Automatiskt',
      userRole: 'system',
      action: 'APPROVED',
      timestamp: new Date().toISOString(),
      comment: 'Auto-godkänd enligt regler',
    }] : [],
    dueDate: new Date(Date.now() + config.escalationTimeout * 60 * 60 * 1000).toISOString(),
  };

  // Spara request
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `APPROVAL#${companyId}`,
      sk: `${request.requestedAt}#${request.id}`,
      gsi1pk: `JOB_APPROVAL#${job.id}`,
      gsi1sk: request.requestedAt,
      ...request,
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60), // 7 år
    },
  }));

  return request;
}

export async function getApprovalRequest(companyId: string, requestId: string): Promise<ApprovalRequest | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':pk': `APPROVAL#${companyId}`,
        ':id': requestId,
      },
      Limit: 1,
    }));

    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as ApprovalRequest;
    }
    return null;
  } catch (error) {
    console.error('[ApprovalWorkflow] Failed to get request:', error);
    return null;
  }
}

export async function getPendingApprovals(
  companyId: string,
  userRole?: string
): Promise<ApprovalRequest[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'currentStatus = :status',
      ExpressionAttributeValues: {
        ':pk': `APPROVAL#${companyId}`,
        ':status': 'PENDING',
      },
      ScanIndexForward: false,
    }));

    let requests = (result.Items || []) as ApprovalRequest[];

    // Filtrera baserat på användarens roll om angiven
    if (userRole) {
      const config = await getApprovalConfig(companyId);
      requests = requests.filter(req => {
        const threshold = config.thresholds.find(t => t.level === req.requestedLevel);
        return threshold?.requiredRole === userRole || userRole === 'admin';
      });
    }

    return requests;
  } catch (error) {
    console.error('[ApprovalWorkflow] Failed to get pending approvals:', error);
    return [];
  }
}

// ============ Approval Actions ============

export async function approveRequest(
  companyId: string,
  requestId: string,
  approver: {
    userId: string;
    userName: string;
    userRole: string;
  },
  comment?: string
): Promise<{ success: boolean; message: string; request?: ApprovalRequest }> {
  const request = await getApprovalRequest(companyId, requestId);
  if (!request) {
    return { success: false, message: 'Godkännandebegäran hittades inte' };
  }

  if (request.currentStatus !== 'PENDING') {
    return { success: false, message: `Begäran kan inte godkännas (status: ${request.currentStatus})` };
  }

  // Kontrollera behörighet
  const config = await getApprovalConfig(companyId);
  const threshold = config.thresholds.find(t => t.level === request.requestedLevel);
  
  if (threshold && !canUserApprove(approver.userRole, threshold.requiredRole)) {
    return { 
      success: false, 
      message: `Din roll (${approver.userRole}) har inte behörighet att godkänna denna nivå (${threshold.requiredRole} krävs)` 
    };
  }

  // Lägg till godkännande
  const action: ApprovalAction = {
    userId: approver.userId,
    userName: approver.userName,
    userRole: approver.userRole,
    action: 'APPROVED',
    timestamp: new Date().toISOString(),
    comment,
  };

  request.approvers.push(action);

  // Kontrollera om dubbelt godkännande krävs
  const decision = determineApprovalLevel(request.amount, config);
  if (decision.requiresDualApproval && request.approvers.filter(a => a.action === 'APPROVED').length < 2) {
    // Behöver ytterligare godkännande
    await updateApprovalRequest(companyId, request);
    return {
      success: true,
      message: 'Godkännande registrerat. Ytterligare en godkännare krävs.',
      request,
    };
  }

  // Fullt godkänt
  request.currentStatus = 'APPROVED';
  await updateApprovalRequest(companyId, request);

  return {
    success: true,
    message: 'Begäran godkänd',
    request,
  };
}

export async function rejectRequest(
  companyId: string,
  requestId: string,
  rejector: {
    userId: string;
    userName: string;
    userRole: string;
  },
  reason: string
): Promise<{ success: boolean; message: string; request?: ApprovalRequest }> {
  const request = await getApprovalRequest(companyId, requestId);
  if (!request) {
    return { success: false, message: 'Godkännandebegäran hittades inte' };
  }

  if (request.currentStatus !== 'PENDING') {
    return { success: false, message: `Begäran kan inte avvisas (status: ${request.currentStatus})` };
  }

  const action: ApprovalAction = {
    userId: rejector.userId,
    userName: rejector.userName,
    userRole: rejector.userRole,
    action: 'REJECTED',
    timestamp: new Date().toISOString(),
    comment: reason,
  };

  request.approvers.push(action);
  request.currentStatus = 'REJECTED';
  request.notes = reason;

  await updateApprovalRequest(companyId, request);

  return {
    success: true,
    message: 'Begäran avvisad',
    request,
  };
}

export async function escalateRequest(
  companyId: string,
  requestId: string,
  escalatedBy: {
    userId: string;
    userName: string;
    userRole: string;
  },
  escalateTo: string,
  reason?: string
): Promise<{ success: boolean; message: string; request?: ApprovalRequest }> {
  const request = await getApprovalRequest(companyId, requestId);
  if (!request) {
    return { success: false, message: 'Godkännandebegäran hittades inte' };
  }

  const config = await getApprovalConfig(companyId);
  const currentLevelIndex = config.thresholds.findIndex(t => t.level === request.requestedLevel);
  
  // Eskalera till nästa nivå
  const nextLevel = config.thresholds[currentLevelIndex + 1];
  if (!nextLevel) {
    return { success: false, message: 'Kan inte eskalera - redan på högsta nivån' };
  }

  const action: ApprovalAction = {
    userId: escalatedBy.userId,
    userName: escalatedBy.userName,
    userRole: escalatedBy.userRole,
    action: 'ESCALATED',
    timestamp: new Date().toISOString(),
    comment: reason || `Eskalerad till ${nextLevel.description}`,
  };

  request.approvers.push(action);
  request.currentStatus = 'ESCALATED';
  request.requestedLevel = nextLevel.level;
  request.escalatedTo = escalateTo;

  await updateApprovalRequest(companyId, request);

  return {
    success: true,
    message: `Begäran eskalerad till ${nextLevel.description}`,
    request,
  };
}

export async function delegateRequest(
  companyId: string,
  requestId: string,
  delegatedBy: {
    userId: string;
    userName: string;
    userRole: string;
  },
  delegateTo: string,
  delegateToName: string,
  reason?: string
): Promise<{ success: boolean; message: string; request?: ApprovalRequest }> {
  const request = await getApprovalRequest(companyId, requestId);
  if (!request) {
    return { success: false, message: 'Godkännandebegäran hittades inte' };
  }

  const action: ApprovalAction = {
    userId: delegatedBy.userId,
    userName: delegatedBy.userName,
    userRole: delegatedBy.userRole,
    action: 'DELEGATED',
    timestamp: new Date().toISOString(),
    comment: reason || `Delegerad till ${delegateToName}`,
    delegatedTo: delegateTo,
  };

  request.approvers.push(action);
  request.currentStatus = 'DELEGATED';
  request.delegatedTo = delegateTo;

  await updateApprovalRequest(companyId, request);

  return {
    success: true,
    message: `Begäran delegerad till ${delegateToName}`,
    request,
  };
}

// ============ Helper Functions ============

function canUserApprove(userRole: string, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    'system': 0,
    'accountant': 1,
    'manager': 2,
    'executive': 3,
    'admin': 4,
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

async function updateApprovalRequest(companyId: string, request: ApprovalRequest): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `APPROVAL#${companyId}`,
      sk: `${request.requestedAt}#${request.id}`,
      gsi1pk: `JOB_APPROVAL#${request.jobId}`,
      gsi1sk: request.requestedAt,
      ...request,
      updatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60),
    },
  }));
}

// ============ Workflow Statistics ============

export async function getApprovalStats(companyId: string): Promise<{
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  averageApprovalTime: number; // I timmar
  byLevel: { level: ApprovalLevel; count: number }[];
}> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `APPROVAL#${companyId}`,
      },
      ScanIndexForward: false,
      Limit: 500,
    }));

    const requests = (result.Items || []) as ApprovalRequest[];
    const today = new Date().toISOString().split('T')[0];

    const pending = requests.filter(r => r.currentStatus === 'PENDING');
    const approvedToday = requests.filter(r => 
      r.currentStatus === 'APPROVED' && r.requestedAt.startsWith(today)
    );
    const rejectedToday = requests.filter(r => 
      r.currentStatus === 'REJECTED' && r.requestedAt.startsWith(today)
    );

    // Beräkna genomsnittlig godkännandetid
    const approvedWithTime = requests
      .filter(r => r.currentStatus === 'APPROVED' && r.approvers.length > 0)
      .map(r => {
        const lastApproval = r.approvers.find(a => a.action === 'APPROVED');
        if (lastApproval) {
          const requestTime = new Date(r.requestedAt).getTime();
          const approvalTime = new Date(lastApproval.timestamp).getTime();
          return (approvalTime - requestTime) / (1000 * 60 * 60); // Timmar
        }
        return 0;
      })
      .filter(t => t > 0);

    const avgTime = approvedWithTime.length > 0 
      ? approvedWithTime.reduce((a, b) => a + b, 0) / approvedWithTime.length 
      : 0;

    // Räkna per nivå
    const byLevel: { level: ApprovalLevel; count: number }[] = [
      { level: 'AUTO', count: requests.filter(r => r.requestedLevel === 'AUTO').length },
      { level: 'STANDARD', count: requests.filter(r => r.requestedLevel === 'STANDARD').length },
      { level: 'MANAGER', count: requests.filter(r => r.requestedLevel === 'MANAGER').length },
      { level: 'EXECUTIVE', count: requests.filter(r => r.requestedLevel === 'EXECUTIVE').length },
    ];

    return {
      pendingCount: pending.length,
      approvedToday: approvedToday.length,
      rejectedToday: rejectedToday.length,
      averageApprovalTime: Math.round(avgTime * 10) / 10,
      byLevel,
    };
  } catch (error) {
    console.error('[ApprovalWorkflow] Failed to get stats:', error);
    return {
      pendingCount: 0,
      approvedToday: 0,
      rejectedToday: 0,
      averageApprovalTime: 0,
      byLevel: [],
    };
  }
}

// ============ Check for Overdue Approvals ============

export async function checkOverdueApprovals(companyId: string): Promise<ApprovalRequest[]> {
  const pending = await getPendingApprovals(companyId);
  const now = new Date();

  return pending.filter(req => {
    if (req.dueDate) {
      return new Date(req.dueDate) < now;
    }
    return false;
  });
}

// ============ Auto-escalate Overdue ============

export async function autoEscalateOverdue(companyId: string): Promise<number> {
  const overdue = await checkOverdueApprovals(companyId);
  let escalatedCount = 0;

  for (const request of overdue) {
    const result = await escalateRequest(
      companyId,
      request.id,
      { userId: 'system', userName: 'Automatisk', userRole: 'system' },
      'auto-escalation',
      'Automatiskt eskalerad pga timeout'
    );

    if (result.success) {
      escalatedCount++;
    }
  }

  return escalatedCount;
}
