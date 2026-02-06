/**
 * NAV Store
 * 
 * DynamoDB-lagring för NAV-data
 * 
 * Tabeller:
 * - aifm-nav-records: NAV-historik
 * - aifm-nav-approvals: Godkännanden
 * - aifm-nav-runs: Körningsloggar
 * - aifm-fund-config: Fondkonfiguration
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  NAVCalculationResult,
  NAVRun,
  NAVRunStatus,
  FundConfig,
} from './types';

// ============================================================================
// DynamoDB Client Setup
// ============================================================================

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Table names
const TABLES = {
  NAV_RECORDS: process.env.NAV_RECORDS_TABLE || 'aifm-nav-records',
  NAV_APPROVALS: process.env.NAV_APPROVALS_TABLE || 'aifm-nav-approvals',
  NAV_RUNS: process.env.NAV_RUNS_TABLE || 'aifm-nav-runs',
  FUND_CONFIG: process.env.FUND_CONFIG_TABLE || 'aifm-fund-config',
};

// ============================================================================
// Types
// ============================================================================

export interface NAVRecord {
  // Primary key
  pk: string; // FUND#fundId#SC#shareClassId
  sk: string; // NAV#YYYY-MM-DD
  
  // NAV data
  fundId: string;
  shareClassId: string;
  navDate: string;
  navPerShare: number;
  netAssetValue: number;
  grossAssets: number;
  totalLiabilities: number;
  sharesOutstanding: number;
  
  // Change
  navChange: number;
  navChangePercent: number;
  
  // Breakdown
  breakdown: NAVCalculationResult['breakdown'];
  
  // Status
  status: 'PRELIMINARY' | 'APPROVED' | 'PUBLISHED' | 'CORRECTED';
  calculatedAt: string;
  
  // Approval
  approvalId?: string;
  approvedBy?: string[];
  approvedAt?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  
  // TTL for old records (optional)
  ttl?: number;
}

export interface NAVApproval {
  // Primary key
  approvalId: string;
  
  // Sort key for queries
  navDate: string;
  
  // Funds included
  fundIds: string[];
  
  // Status
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'APPROVED' | 'REJECTED';
  
  // Approvers
  firstApprover?: {
    userId: string;
    name: string;
    approvedAt: string;
    comment?: string;
  };
  secondApprover?: {
    userId: string;
    name: string;
    approvedAt: string;
    comment?: string;
  };
  rejectedBy?: {
    userId: string;
    name: string;
    rejectedAt: string;
    reason: string;
  };
  
  // NAV summary
  navSummary: {
    fundId: string;
    shareClassId: string;
    navPerShare: number;
    navChange: number;
  }[];
  
  // Run reference
  runId: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  expiresAt?: string; // For auto-rejection
}

export interface NAVRunRecord {
  // Primary key
  runId: string;
  
  // Sort key for queries
  navDate: string;
  
  // Status
  status: NAVRunStatus;
  
  // Timing
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  
  // Results
  totalFunds: number;
  completedFunds: number;
  failedFunds: number;
  
  // Fund results (stored as JSON)
  results: {
    fundId: string;
    shareClassId: string;
    navPerShare: number;
    status: string;
    error?: string;
  }[];
  
  // Errors
  errors: string[];
  
  // Triggered by
  triggeredBy: 'MANUAL' | 'SCHEDULED' | 'API';
  triggeredByUser?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface FundConfigRecord {
  // Primary key
  fundId: string;
  
  // Fund details
  fundCode: string;
  name: string;
  currency: string;
  fundType: 'UCITS' | 'AIF' | 'SPECIAL';
  status: 'ACTIVE' | 'INACTIVE';
  
  // Fees (annual rates)
  managementFeeRate: number;
  performanceFeeRate?: number;
  depositaryFeeRate: number;
  adminFeeRate: number;
  
  // Performance fee config
  performanceFeeType?: 'HIGH_WATER_MARK' | 'HURDLE_RATE' | 'BOTH';
  hurdleRate?: number;
  
  // Pricing policy
  pricingPolicy: FundConfig['pricingPolicy'];
  
  // Accrual rules
  accrualRules: FundConfig['accrualRules'];
  
  // Share classes
  shareClasses: {
    shareClassId: string;
    shareClassCode: string;
    name: string;
    isin: string;
    currency: string;
    hedged: boolean;
    managementFeeRate?: number;
    status: 'ACTIVE' | 'INACTIVE';
  }[];
  
  // SECURA mapping
  securaFundId?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// NAV Records Store
// ============================================================================

export class NAVRecordStore {
  /**
   * Save NAV calculation result
   */
  async saveNAVRecord(result: NAVCalculationResult, status: NAVRecord['status'] = 'PRELIMINARY'): Promise<NAVRecord> {
    const now = new Date().toISOString();
    
    const record: NAVRecord = {
      pk: `FUND#${result.fundId}#SC#${result.shareClassId}`,
      sk: `NAV#${result.navDate}`,
      fundId: result.fundId,
      shareClassId: result.shareClassId,
      navDate: result.navDate,
      navPerShare: result.navPerShare,
      netAssetValue: result.netAssetValue,
      grossAssets: result.grossAssets,
      totalLiabilities: result.totalLiabilities,
      sharesOutstanding: result.sharesOutstanding,
      navChange: result.navChange,
      navChangePercent: result.navChangePercent,
      breakdown: result.breakdown,
      status,
      calculatedAt: result.calculatedAt,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.NAV_RECORDS,
      Item: record,
    }));

    return record;
  }

  /**
   * Get NAV record
   */
  async getNAVRecord(fundId: string, shareClassId: string, navDate: string): Promise<NAVRecord | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.NAV_RECORDS,
      Key: {
        pk: `FUND#${fundId}#SC#${shareClassId}`,
        sk: `NAV#${navDate}`,
      },
    }));

    return (result.Item as NAVRecord) || null;
  }

  /**
   * Get NAV history for a fund/share class
   */
  async getNAVHistory(
    fundId: string,
    shareClassId: string,
    fromDate?: string,
    toDate?: string,
    limit: number = 100
  ): Promise<NAVRecord[]> {
    const pk = `FUND#${fundId}#SC#${shareClassId}`;
    
    let keyCondition = 'pk = :pk';
    const expressionValues: Record<string, string> = { ':pk': pk };

    if (fromDate && toDate) {
      keyCondition += ' AND sk BETWEEN :from AND :to';
      expressionValues[':from'] = `NAV#${fromDate}`;
      expressionValues[':to'] = `NAV#${toDate}`;
    } else if (fromDate) {
      keyCondition += ' AND sk >= :from';
      expressionValues[':from'] = `NAV#${fromDate}`;
    } else if (toDate) {
      keyCondition += ' AND sk <= :to';
      expressionValues[':to'] = `NAV#${toDate}`;
    } else {
      keyCondition += ' AND begins_with(sk, :prefix)';
      expressionValues[':prefix'] = 'NAV#';
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_RECORDS,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    }));

    return (result.Items as NAVRecord[]) || [];
  }

  /**
   * Get latest NAV for a fund/share class
   */
  async getLatestNAV(fundId: string, shareClassId: string): Promise<NAVRecord | null> {
    const history = await this.getNAVHistory(fundId, shareClassId, undefined, undefined, 1);
    return history[0] || null;
  }

  /**
   * Update NAV status
   */
  async updateNAVStatus(
    fundId: string,
    shareClassId: string,
    navDate: string,
    status: NAVRecord['status'],
    approvalInfo?: { approvalId: string; approvedBy: string[]; approvedAt: string }
  ): Promise<void> {
    const updateExpression = approvalInfo
      ? 'SET #status = :status, approvalId = :approvalId, approvedBy = :approvedBy, approvedAt = :approvedAt, updatedAt = :updatedAt'
      : 'SET #status = :status, updatedAt = :updatedAt';

    const expressionValues: Record<string, unknown> = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };

    if (approvalInfo) {
      expressionValues[':approvalId'] = approvalInfo.approvalId;
      expressionValues[':approvedBy'] = approvalInfo.approvedBy;
      expressionValues[':approvedAt'] = approvalInfo.approvedAt;
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLES.NAV_RECORDS,
      Key: {
        pk: `FUND#${fundId}#SC#${shareClassId}`,
        sk: `NAV#${navDate}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: expressionValues,
    }));
  }

  /**
   * Batch save NAV records
   */
  async batchSaveNAVRecords(results: NAVCalculationResult[]): Promise<void> {
    const now = new Date().toISOString();
    
    // DynamoDB batch write has a limit of 25 items
    const batches = [];
    for (let i = 0; i < results.length; i += 25) {
      batches.push(results.slice(i, i + 25));
    }

    for (const batch of batches) {
      const requests = batch.map(result => ({
        PutRequest: {
          Item: {
            pk: `FUND#${result.fundId}#SC#${result.shareClassId}`,
            sk: `NAV#${result.navDate}`,
            fundId: result.fundId,
            shareClassId: result.shareClassId,
            navDate: result.navDate,
            navPerShare: result.navPerShare,
            netAssetValue: result.netAssetValue,
            grossAssets: result.grossAssets,
            totalLiabilities: result.totalLiabilities,
            sharesOutstanding: result.sharesOutstanding,
            navChange: result.navChange,
            navChangePercent: result.navChangePercent,
            breakdown: result.breakdown,
            status: 'PRELIMINARY',
            calculatedAt: result.calculatedAt,
            createdAt: now,
            updatedAt: now,
          },
        },
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLES.NAV_RECORDS]: requests,
        },
      }));
    }
  }
}

// ============================================================================
// NAV Approvals Store
// ============================================================================

export class NAVApprovalStore {
  /**
   * Create approval request
   */
  async createApproval(
    runId: string,
    navDate: string,
    results: NAVCalculationResult[]
  ): Promise<NAVApproval> {
    const now = new Date().toISOString();
    const approvalId = `APR-${navDate}-${Date.now()}`;

    const approval: NAVApproval = {
      approvalId,
      navDate,
      fundIds: [...new Set(results.map(r => r.fundId))],
      status: 'PENDING_FIRST',
      navSummary: results.map(r => ({
        fundId: r.fundId,
        shareClassId: r.shareClassId,
        navPerShare: r.navPerShare,
        navChange: r.navChange,
      })),
      runId,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.NAV_APPROVALS,
      Item: approval,
    }));

    return approval;
  }

  /**
   * Get approval by ID
   */
  async getApproval(approvalId: string): Promise<NAVApproval | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.NAV_APPROVALS,
      Key: { approvalId },
    }));

    return (result.Item as NAVApproval) || null;
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(): Promise<NAVApproval[]> {
    // Note: This would need a GSI on status for efficient querying
    // For now, we'll use a scan with filter
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_APPROVALS,
      IndexName: 'status-index', // Needs GSI
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'PENDING_FIRST' },
    }));

    return (result.Items as NAVApproval[]) || [];
  }

  /**
   * First approval
   */
  async approveFirst(
    approvalId: string,
    userId: string,
    userName: string,
    comment?: string
  ): Promise<NAVApproval> {
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLES.NAV_APPROVALS,
      Key: { approvalId },
      UpdateExpression: 'SET #status = :status, firstApprover = :approver, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'PENDING_SECOND',
        ':approver': {
          userId,
          name: userName,
          approvedAt: now,
          comment,
        },
        ':now': now,
      },
      ConditionExpression: '#status = :pendingFirst',
    }));

    return (await this.getApproval(approvalId))!;
  }

  /**
   * Second approval (final)
   */
  async approveSecond(
    approvalId: string,
    userId: string,
    userName: string,
    comment?: string
  ): Promise<NAVApproval> {
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLES.NAV_APPROVALS,
      Key: { approvalId },
      UpdateExpression: 'SET #status = :status, secondApprover = :approver, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'APPROVED',
        ':approver': {
          userId,
          name: userName,
          approvedAt: now,
          comment,
        },
        ':now': now,
      },
      ConditionExpression: '#status = :pendingSecond',
    }));

    return (await this.getApproval(approvalId))!;
  }

  /**
   * Reject approval
   */
  async reject(
    approvalId: string,
    userId: string,
    userName: string,
    reason: string
  ): Promise<NAVApproval> {
    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: TABLES.NAV_APPROVALS,
      Key: { approvalId },
      UpdateExpression: 'SET #status = :status, rejectedBy = :rejector, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'REJECTED',
        ':rejector': {
          userId,
          name: userName,
          rejectedAt: now,
          reason,
        },
        ':now': now,
      },
    }));

    return (await this.getApproval(approvalId))!;
  }
}

// ============================================================================
// NAV Runs Store
// ============================================================================

export class NAVRunStore {
  /**
   * Save NAV run
   */
  async saveRun(run: NAVRun): Promise<NAVRunRecord> {
    const now = new Date().toISOString();
    
    // Convert Map to array for storage
    const results: NAVRunRecord['results'] = [];
    run.fundResults.forEach((result, key) => {
      const [fundId, shareClassId] = key.split('/');
      results.push({
        fundId,
        shareClassId,
        navPerShare: result.navPerShare,
        status: result.status,
      });
    });

    const record: NAVRunRecord = {
      runId: run.runId,
      navDate: run.navDate,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.completedAt 
        ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
        : undefined,
      totalFunds: run.totalFunds,
      completedFunds: run.completedFunds,
      failedFunds: run.failedFunds,
      results,
      errors: run.errors,
      triggeredBy: 'MANUAL',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.NAV_RUNS,
      Item: record,
    }));

    return record;
  }

  /**
   * Get run by ID
   */
  async getRun(runId: string): Promise<NAVRunRecord | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.NAV_RUNS,
      Key: { runId },
    }));

    return (result.Item as NAVRunRecord) || null;
  }

  /**
   * Get recent runs
   */
  async getRecentRuns(limit: number = 10): Promise<NAVRunRecord[]> {
    // Note: Would need GSI on createdAt for efficient querying
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_RUNS,
      IndexName: 'navDate-index', // Needs GSI
      KeyConditionExpression: 'begins_with(navDate, :year)',
      ExpressionAttributeValues: { ':year': new Date().getFullYear().toString() },
      ScanIndexForward: false,
      Limit: limit,
    }));

    return (result.Items as NAVRunRecord[]) || [];
  }

  /**
   * Update run status
   */
  async updateRunStatus(runId: string, status: NAVRunStatus): Promise<void> {
    await docClient.send(new UpdateCommand({
      TableName: TABLES.NAV_RUNS,
      Key: { runId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString(),
      },
    }));
  }
}

// ============================================================================
// Fund Config Store
// ============================================================================

export class FundConfigStore {
  /**
   * Save fund configuration
   */
  async saveFundConfig(config: FundConfig): Promise<FundConfigRecord> {
    const now = new Date().toISOString();

    const record: FundConfigRecord = {
      fundId: config.fundId,
      fundCode: config.fundCode,
      name: config.name,
      currency: config.currency,
      fundType: config.fundType,
      status: 'ACTIVE',
      managementFeeRate: config.managementFeeRate,
      performanceFeeRate: config.performanceFeeRate,
      depositaryFeeRate: config.depositaryFeeRate,
      adminFeeRate: config.adminFeeRate,
      performanceFeeType: config.performanceFeeType,
      hurdleRate: config.hurdleRate,
      pricingPolicy: config.pricingPolicy,
      accrualRules: config.accrualRules,
      shareClasses: config.shareClasses.map(sc => ({
        shareClassId: sc.shareClassId,
        shareClassCode: sc.shareClassCode,
        name: sc.name,
        isin: sc.isin,
        currency: sc.currency,
        hedged: sc.hedged,
        managementFeeRate: sc.managementFeeRate,
        status: 'ACTIVE',
      })),
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.FUND_CONFIG,
      Item: record,
    }));

    return record;
  }

  /**
   * Get fund configuration
   */
  async getFundConfig(fundId: string): Promise<FundConfigRecord | null> {
    const result = await docClient.send(new GetCommand({
      TableName: TABLES.FUND_CONFIG,
      Key: { fundId },
    }));

    return (result.Item as FundConfigRecord) || null;
  }

  /**
   * Get all fund configurations
   */
  async getAllFundConfigs(): Promise<FundConfigRecord[]> {
    // Note: Scan is not ideal for large tables, but fund count is typically low
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.FUND_CONFIG,
      IndexName: 'status-index', // Needs GSI
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'ACTIVE' },
    }));

    return (result.Items as FundConfigRecord[]) || [];
  }

  /**
   * Update fund status
   */
  async updateFundStatus(fundId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    await docClient.send(new UpdateCommand({
      TableName: TABLES.FUND_CONFIG,
      Key: { fundId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': new Date().toISOString(),
      },
    }));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createNAVRecordStore(): NAVRecordStore {
  return new NAVRecordStore();
}

export function createNAVApprovalStore(): NAVApprovalStore {
  return new NAVApprovalStore();
}

export function createNAVRunStore(): NAVRunStore {
  return new NAVRunStore();
}

export function createFundConfigStore(): FundConfigStore {
  return new FundConfigStore();
}

// Singletons
let navRecordStore: NAVRecordStore | null = null;
let navApprovalStore: NAVApprovalStore | null = null;
let navRunStore: NAVRunStore | null = null;
let fundConfigStore: FundConfigStore | null = null;

export function getNAVRecordStore(): NAVRecordStore {
  if (!navRecordStore) navRecordStore = new NAVRecordStore();
  return navRecordStore;
}

export function getNAVApprovalStore(): NAVApprovalStore {
  if (!navApprovalStore) navApprovalStore = new NAVApprovalStore();
  return navApprovalStore;
}

export function getNAVRunStore(): NAVRunStore {
  if (!navRunStore) navRunStore = new NAVRunStore();
  return navRunStore;
}

export function getFundConfigStore(): FundConfigStore {
  if (!fundConfigStore) fundConfigStore = new FundConfigStore();
  return fundConfigStore;
}
