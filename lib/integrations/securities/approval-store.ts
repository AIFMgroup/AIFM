/**
 * Security Approval Store
 * DynamoDB-backed store for security approval requests with auto-save support
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  DeleteCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { 
  SecurityApprovalRequest, 
  FundApprovalList, 
  SecurityApprovalSummary 
} from './types';

const TABLE_NAME = process.env.SECURITIES_APPROVALS_TABLE || 'aifm-securities-approvals';

// Initialize DynamoDB client
let dynamoClient: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-north-1',
    });
    dynamoClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }
  return dynamoClient;
}

// Generate unique ID
function generateId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Helper to create DynamoDB item from approval
function toDbItem(approval: SecurityApprovalRequest) {
  return {
    PK: `APPROVAL#${approval.id}`,
    SK: `APPROVAL#${approval.id}`,
    GSI1PK: `FUND#${approval.fundId}`,
    GSI1SK: `${approval.status}#${approval.updatedAt}`,
    GSI2PK: `STATUS#${approval.status}`,
    GSI2SK: approval.updatedAt,
    GSI3PK: `USER#${approval.createdByEmail}`,
    GSI3SK: approval.updatedAt,
    ...approval,
    // Add TTL for drafts older than 90 days
    ttl: approval.status === 'draft' 
      ? Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) 
      : undefined,
  };
}

// Create a new approval request
export async function createApproval(
  data: Omit<SecurityApprovalRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<SecurityApprovalRequest> {
  const id = generateId();
  const now = new Date().toISOString();
  
  const approval: SecurityApprovalRequest = {
    ...data,
    id,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  
  const client = getClient();
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: toDbItem(approval),
  }));
  
  return approval;
}

// Get approval by ID
export async function getApproval(id: string): Promise<SecurityApprovalRequest | null> {
  const client = getClient();
  const result = await client.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${id}`,
      SK: `APPROVAL#${id}`,
    },
  }));
  
  if (!result.Item) return null;
  
  // Remove DynamoDB-specific fields
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK, ttl, ...approval } = result.Item;
  return approval as SecurityApprovalRequest;
}

// Update approval (supports partial updates for auto-save)
export async function updateApproval(
  id: string, 
  updates: Partial<SecurityApprovalRequest>
): Promise<SecurityApprovalRequest | null> {
  const existing = await getApproval(id);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  const updated: SecurityApprovalRequest = {
    ...existing,
    ...updates,
    updatedAt: now,
  };
  
  const client = getClient();
  await client.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: toDbItem(updated),
  }));
  
  return updated;
}

// Auto-save draft (creates or updates)
export async function saveDraft(
  id: string | null,
  data: Partial<SecurityApprovalRequest> & { 
    fundId: string;
    fundName: string;
    createdBy: string;
    createdByEmail: string;
  }
): Promise<SecurityApprovalRequest> {
  if (id) {
    const existing = await getApproval(id);
    if (existing && existing.status === 'draft') {
      const updated = await updateApproval(id, data);
      return updated!;
    }
  }
  
  // Create new draft
  return createApproval({
    fundId: data.fundId,
    fundName: data.fundName,
    createdBy: data.createdBy,
    createdByEmail: data.createdByEmail,
    basicInfo: data.basicInfo || {
      name: '',
      category: 'transferable_security',
      type: 'stock',
      ticker: '',
      isin: '',
      marketPlace: '',
      listingType: 'regulated_market',
      mic: '',
      currency: '',
      country: '',
      emitter: '',
    },
    fundCompliance: data.fundCompliance || {
      fundId: data.fundId,
      fundName: data.fundName,
      complianceMotivation: '',
      placementRestrictions: '',
    },
    regulatoryFFFS: data.regulatoryFFFS || {
      limitedPotentialLoss: true,
      liquidityNotEndangered: true,
      reliableValuation: { type: 'market_price', checked: true },
      appropriateInformation: { type: 'regular_market_info', checked: true },
      isMarketable: true,
      compatibleWithFund: true,
      riskManagementCaptures: true,
    },
    regulatoryLVF: data.regulatoryLVF || {},
    liquidityAnalysis: data.liquidityAnalysis || {
      fffsLiquidityNotEndangered: true,
      fffsIsMarketable: true,
    },
    valuationInfo: data.valuationInfo || {
      reliableDailyPrices: true,
      isEmission: false,
    },
    esgInfo: data.esgInfo || {
      article8Or9Fund: false,
      meetsExclusionCriteria: true,
      meetsSustainableInvestmentMinimum: true,
    },
  });
}

// Submit for review
export async function submitApproval(id: string): Promise<SecurityApprovalRequest | null> {
  const now = new Date().toISOString();
  return updateApproval(id, {
    status: 'submitted',
    submittedAt: now,
  });
}

// Approve
export async function approveApproval(
  id: string,
  reviewedBy: string,
  reviewedByEmail: string,
  comments?: string
): Promise<SecurityApprovalRequest | null> {
  const now = new Date().toISOString();
  // Approval valid for 12 months
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  
  return updateApproval(id, {
    status: 'approved',
    reviewedAt: now,
    reviewedBy,
    reviewedByEmail,
    reviewComments: comments,
    expiresAt,
  });
}

// Reject
export async function rejectApproval(
  id: string,
  reviewedBy: string,
  reviewedByEmail: string,
  reason: string
): Promise<SecurityApprovalRequest | null> {
  const now = new Date().toISOString();
  
  return updateApproval(id, {
    status: 'rejected',
    reviewedAt: now,
    reviewedBy,
    reviewedByEmail,
    rejectionReason: reason,
  });
}

// Delete approval (only drafts)
export async function deleteApproval(id: string): Promise<boolean> {
  const existing = await getApproval(id);
  if (!existing || existing.status !== 'draft') return false;
  
  const client = getClient();
  await client.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `APPROVAL#${id}`,
      SK: `APPROVAL#${id}`,
    },
  }));
  
  return true;
}

// List approvals by fund
export async function listApprovalsByFund(fundId: string): Promise<SecurityApprovalRequest[]> {
  const client = getClient();
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :fundId',
    ExpressionAttributeValues: {
      ':fundId': `FUND#${fundId}`,
    },
    ScanIndexForward: false, // Most recent first
  }));
  
  return (result.Items || []).map(item => {
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK, ttl, ...approval } = item;
    return approval as SecurityApprovalRequest;
  });
}

// List approvals by status
export async function listApprovalsByStatus(
  status: SecurityApprovalRequest['status']
): Promise<SecurityApprovalRequest[]> {
  const client = getClient();
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI2',
    KeyConditionExpression: 'GSI2PK = :status',
    ExpressionAttributeValues: {
      ':status': `STATUS#${status}`,
    },
    ScanIndexForward: false,
  }));
  
  return (result.Items || []).map(item => {
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK, ttl, ...approval } = item;
    return approval as SecurityApprovalRequest;
  });
}

// List approvals by user
export async function listApprovalsByUser(email: string): Promise<SecurityApprovalRequest[]> {
  const client = getClient();
  const result = await client.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :email',
    ExpressionAttributeValues: {
      ':email': `USER#${email}`,
    },
    ScanIndexForward: false,
  }));
  
  return (result.Items || []).map(item => {
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK, ttl, ...approval } = item;
    return approval as SecurityApprovalRequest;
  });
}

// List drafts by user (for "resume draft" feature)
export async function listDraftsByUser(email: string): Promise<SecurityApprovalRequest[]> {
  const approvals = await listApprovalsByUser(email);
  return approvals.filter(a => a.status === 'draft');
}

// Get fund approval list (for Operations view)
export async function getFundApprovalList(fundId: string): Promise<FundApprovalList> {
  const approvals = await listApprovalsByFund(fundId);
  
  // Get fund name from first approval or default
  const fundName = approvals[0]?.fundName || 'Unknown Fund';
  
  return {
    fundId,
    fundName,
    approvals,
    pendingCount: approvals.filter(a => a.status === 'submitted' || a.status === 'under_review').length,
    approvedCount: approvals.filter(a => a.status === 'approved').length,
    totalCount: approvals.length,
  };
}

// Get all pending approvals (for Operations)
export async function getAllPendingApprovals(): Promise<SecurityApprovalRequest[]> {
  const [submitted, underReview] = await Promise.all([
    listApprovalsByStatus('submitted'),
    listApprovalsByStatus('under_review'),
  ]);
  
  return [...submitted, ...underReview].sort((a, b) => 
    new Date(a.submittedAt || a.updatedAt).getTime() - 
    new Date(b.submittedAt || b.updatedAt).getTime()
  );
}

// Get summary for dashboard
export async function getApprovalSummary(): Promise<SecurityApprovalSummary> {
  // Use parallel queries for better performance
  const [submitted, underReview, approved, rejected] = await Promise.all([
    listApprovalsByStatus('submitted'),
    listApprovalsByStatus('under_review'),
    listApprovalsByStatus('approved'),
    listApprovalsByStatus('rejected'),
  ]);
  
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const expiringApprovals = approved.filter(a => 
    a.expiresAt && new Date(a.expiresAt) < thirtyDaysFromNow
  );
  
  const recentApprovals = approved.filter(a =>
    a.reviewedAt && new Date(a.reviewedAt) > sevenDaysAgo
  );
  
  return {
    totalPending: submitted.length + underReview.length,
    totalApproved: approved.length,
    totalRejected: rejected.length,
    recentApprovals: recentApprovals
      .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
      .slice(0, 5),
    expiringApprovals: expiringApprovals
      .sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime())
      .slice(0, 5),
  };
}

// Search approvals
export async function searchApprovals(query: string): Promise<SecurityApprovalRequest[]> {
  // For search, we need to scan since we're searching across multiple fields
  const client = getClient();
  const result = await client.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'contains(#name, :query) OR contains(#isin, :query) OR contains(#ticker, :query)',
    ExpressionAttributeNames: {
      '#name': 'basicInfo.name',
      '#isin': 'basicInfo.isin',
      '#ticker': 'basicInfo.ticker',
    },
    ExpressionAttributeValues: {
      ':query': query.toLowerCase(),
    },
  }));
  
  // In practice, for better search we'd use OpenSearch or a different approach
  // For now, filter client-side after fetching
  const allApprovals = (result.Items || []).map(item => {
    const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK, ttl, ...approval } = item;
    return approval as SecurityApprovalRequest;
  });
  
  const searchLower = query.toLowerCase();
  return allApprovals.filter(approval =>
    approval.basicInfo.name.toLowerCase().includes(searchLower) ||
    approval.basicInfo.isin.toLowerCase().includes(searchLower) ||
    approval.basicInfo.ticker.toLowerCase().includes(searchLower) ||
    approval.fundName.toLowerCase().includes(searchLower)
  ).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

// Search approved securities for "copy from previous" feature
export async function searchApprovedSecurities(
  query: string, 
  limit: number = 10
): Promise<SecurityApprovalRequest[]> {
  const approved = await listApprovalsByStatus('approved');
  const searchLower = query.toLowerCase();
  
  return approved
    .filter(approval =>
      approval.basicInfo.name.toLowerCase().includes(searchLower) ||
      approval.basicInfo.isin.toLowerCase().includes(searchLower) ||
      approval.basicInfo.ticker.toLowerCase().includes(searchLower) ||
      approval.fundName.toLowerCase().includes(searchLower)
    )
    .slice(0, limit);
}

// Copy approval as new draft
export async function copyApprovalAsDraft(
  sourceId: string,
  targetFundId: string,
  targetFundName: string,
  createdBy: string,
  createdByEmail: string
): Promise<SecurityApprovalRequest | null> {
  const source = await getApproval(sourceId);
  if (!source) return null;
  
  // Create new draft with source data
  return createApproval({
    fundId: targetFundId,
    fundName: targetFundName,
    createdBy,
    createdByEmail,
    basicInfo: { ...source.basicInfo },
    fundCompliance: {
      ...source.fundCompliance,
      fundId: targetFundId,
      fundName: targetFundName,
    },
    regulatoryFFFS: { ...source.regulatoryFFFS },
    regulatoryLVF: { ...source.regulatoryLVF },
    liquidityAnalysis: { ...source.liquidityAnalysis },
    valuationInfo: { ...source.valuationInfo },
    esgInfo: { ...source.esgInfo },
    unlistedInfo: source.unlistedInfo ? { ...source.unlistedInfo } : undefined,
    fundUnitInfo: source.fundUnitInfo ? { ...source.fundUnitInfo } : undefined,
    plannedAcquisitionShare: source.plannedAcquisitionShare,
  });
}
