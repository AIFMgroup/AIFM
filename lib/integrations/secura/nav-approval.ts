/**
 * NAV Approval Service
 * 
 * Hanterar godkännande av NAV-värden med 4-ögon-princip
 * - Första godkännare: Bekräftar att NAV ser korrekt ut
 * - Andra godkännare: Slutgodkänner för distribution
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.NAV_TABLE_NAME || 'aifm-nav-approvals';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// Types
// ============================================================================

export interface FundNAV {
  fundId: string;
  fundName: string;
  isin: string;
  currency: string;
  navDate: string;
  navValue: number;
  aum: number;
  outstandingShares: number;
  previousNav?: number;
  changePercent?: number;
}

export interface NAVApprovalRequest {
  id: string;
  tenantId: string;
  companyId: string;
  navDate: string;
  funds: FundNAV[];
  
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'APPROVED' | 'REJECTED';
  
  // First approval
  firstApprover?: {
    userId: string;
    userName: string;
    approvedAt: string;
    comment?: string;
  };
  
  // Second approval (4-eyes)
  secondApprover?: {
    userId: string;
    userName: string;
    approvedAt: string;
    comment?: string;
  };
  
  // Rejection info
  rejection?: {
    userId: string;
    userName: string;
    rejectedAt: string;
    reason: string;
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  
  // Distribution tracking
  distributionStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  distributionStartedAt?: string;
  distributionCompletedAt?: string;
}

export interface NAVApprovalVote {
  requestId: string;
  userId: string;
  userName: string;
  action: 'APPROVE' | 'REJECT';
  comment?: string;
  reason?: string; // For rejections
}

export interface NAVApprovalConfig {
  tenantId: string;
  companyId: string;
  
  // Require 4-eyes (two approvers)?
  requireFourEyes: boolean;
  
  // Auto-approve if NAV change is within threshold?
  autoApproveThreshold?: number; // e.g., 0.05 = 5%
  
  // Who can approve?
  approverRoles: string[];
  
  // Distribution settings
  autoDistributeOnApproval: boolean;
  distributionDelay?: number; // Minutes to wait after approval
}

// ============================================================================
// Service
// ============================================================================

export const navApprovalService = {
  
  // ========== Create NAV for approval ==========
  
  async createApprovalRequest(
    tenantId: string,
    companyId: string,
    navDate: string,
    funds: FundNAV[],
    createdBy: string
  ): Promise<NAVApprovalRequest> {
    const now = new Date().toISOString();
    const requestId = `nav-${navDate}-${Date.now()}`;
    
    const request: NAVApprovalRequest = {
      id: requestId,
      tenantId,
      companyId,
      navDate,
      funds,
      status: 'PENDING_FIRST',
      createdAt: now,
      updatedAt: now,
      createdBy,
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `TENANT#${tenantId}`,
        SK: `NAV#${navDate}#${requestId}`,
        GSI1PK: `COMPANY#${companyId}`,
        GSI1SK: `NAV#${request.status}#${navDate}`,
        ...request,
      },
    }));
    
    return request;
  },
  
  // ========== Get approval requests ==========
  
  async getPendingApprovals(
    tenantId: string,
    companyId?: string
  ): Promise<NAVApprovalRequest[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: '#status IN (:s1, :s2)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'NAV#',
        ':s1': 'PENDING_FIRST',
        ':s2': 'PENDING_SECOND',
      },
    }));
    
    let requests = (result.Items || []) as NAVApprovalRequest[];
    
    if (companyId) {
      requests = requests.filter(r => r.companyId === companyId);
    }
    
    return requests.sort((a, b) => 
      new Date(b.navDate).getTime() - new Date(a.navDate).getTime()
    );
  },
  
  async getApprovalRequest(
    tenantId: string,
    requestId: string
  ): Promise<NAVApprovalRequest | null> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'NAV#',
        ':id': requestId,
      },
    }));
    
    return (result.Items?.[0] as NAVApprovalRequest) || null;
  },
  
  async getApprovalHistory(
    tenantId: string,
    companyId?: string,
    limit: number = 30
  ): Promise<NAVApprovalRequest[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'NAV#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }));
    
    let requests = (result.Items || []) as NAVApprovalRequest[];
    
    if (companyId) {
      requests = requests.filter(r => r.companyId === companyId);
    }
    
    return requests;
  },
  
  // ========== Vote on approval ==========
  
  async vote(
    tenantId: string,
    vote: NAVApprovalVote,
    config: NAVApprovalConfig
  ): Promise<NAVApprovalRequest> {
    const request = await this.getApprovalRequest(tenantId, vote.requestId);
    
    if (!request) {
      throw new Error('Approval request not found');
    }
    
    const now = new Date().toISOString();
    
    if (vote.action === 'REJECT') {
      // Rejection - update status and record
      request.status = 'REJECTED';
      request.rejection = {
        userId: vote.userId,
        userName: vote.userName,
        rejectedAt: now,
        reason: vote.reason || 'Ingen anledning angiven',
      };
      request.updatedAt = now;
    } else if (vote.action === 'APPROVE') {
      // Approval logic
      if (request.status === 'PENDING_FIRST') {
        // First approval
        request.firstApprover = {
          userId: vote.userId,
          userName: vote.userName,
          approvedAt: now,
          comment: vote.comment,
        };
        
        if (config.requireFourEyes) {
          request.status = 'PENDING_SECOND';
        } else {
          request.status = 'APPROVED';
        }
      } else if (request.status === 'PENDING_SECOND') {
        // Second approval (4-eyes)
        // Ensure different person
        if (request.firstApprover?.userId === vote.userId) {
          throw new Error('4-ögon-principen kräver att en annan person slutgodkänner');
        }
        
        request.secondApprover = {
          userId: vote.userId,
          userName: vote.userName,
          approvedAt: now,
          comment: vote.comment,
        };
        request.status = 'APPROVED';
      }
      
      request.updatedAt = now;
    }
    
    // Save updated request
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `NAV#${request.navDate}#${request.id}`,
      },
      UpdateExpression: `
        SET #status = :status, 
            updatedAt = :now,
            firstApprover = :first,
            secondApprover = :second,
            rejection = :rejection,
            GSI1SK = :gsi1sk
      `,
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': request.status,
        ':now': now,
        ':first': request.firstApprover || null,
        ':second': request.secondApprover || null,
        ':rejection': request.rejection || null,
        ':gsi1sk': `NAV#${request.status}#${request.navDate}`,
      },
    }));
    
    return request;
  },
  
  // ========== Start distribution after approval ==========
  
  async startDistribution(
    tenantId: string,
    requestId: string
  ): Promise<NAVApprovalRequest> {
    const request = await this.getApprovalRequest(tenantId, requestId);
    
    if (!request) {
      throw new Error('Approval request not found');
    }
    
    if (request.status !== 'APPROVED') {
      throw new Error('NAV måste vara godkänt innan distribution kan starta');
    }
    
    const now = new Date().toISOString();
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `NAV#${request.navDate}#${request.id}`,
      },
      UpdateExpression: `
        SET distributionStatus = :status, 
            distributionStartedAt = :now,
            updatedAt = :now
      `,
      ExpressionAttributeValues: {
        ':status': 'IN_PROGRESS',
        ':now': now,
      },
    }));
    
    request.distributionStatus = 'IN_PROGRESS';
    request.distributionStartedAt = now;
    
    return request;
  },
  
  async completeDistribution(
    tenantId: string,
    requestId: string,
    success: boolean
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const request = await this.getApprovalRequest(tenantId, requestId);
    if (!request) return;
    
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `NAV#${request.navDate}#${request.id}`,
      },
      UpdateExpression: `
        SET distributionStatus = :status, 
            distributionCompletedAt = :now,
            updatedAt = :now
      `,
      ExpressionAttributeValues: {
        ':status': success ? 'COMPLETED' : 'FAILED',
        ':now': now,
      },
    }));
  },
  
  // ========== Get today's NAV status ==========
  
  async getTodayStatus(
    tenantId: string,
    companyId: string
  ): Promise<{
    hasData: boolean;
    status: NAVApprovalRequest['status'] | 'NO_DATA';
    request?: NAVApprovalRequest;
    canApprove: boolean;
    needsSecondApproval: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'navDate = :date AND companyId = :company',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'NAV#',
        ':date': today,
        ':company': companyId,
      },
    }));
    
    const request = result.Items?.[0] as NAVApprovalRequest | undefined;
    
    if (!request) {
      return {
        hasData: false,
        status: 'NO_DATA',
        canApprove: false,
        needsSecondApproval: false,
      };
    }
    
    return {
      hasData: true,
      status: request.status,
      request,
      canApprove: request.status === 'PENDING_FIRST' || request.status === 'PENDING_SECOND',
      needsSecondApproval: request.status === 'PENDING_SECOND',
    };
  },
};

export default navApprovalService;
