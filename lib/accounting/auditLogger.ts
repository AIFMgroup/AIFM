/**
 * Audit Logger for Accounting Module
 * Logs all important actions for compliance and debugging
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { sanitizeForLog } from '../logging';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const AUDIT_TABLE_NAME = 'aifm-audit-logs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type AuditAction = 
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'JOB_CREATED'
  | 'JOB_APPROVED'
  | 'JOB_REJECTED'
  | 'JOB_AUTO_APPROVED'
  | 'JOB_SENT_TO_FORTNOX'
  | 'JOB_PRECHECK_FAILED'
  | 'JOB_POLICY_BLOCKED'
  | 'FORTNOX_POSTING_STARTED'
  | 'FORTNOX_POSTING_COMPLETED'
  | 'FORTNOX_POSTING_FAILED'
  | 'CLASSIFICATION_COMPLETED'
  | 'CLASSIFICATION_CORRECTED'
  | 'VAT_REPORT_GENERATED'
  | 'VAT_REPORT_EXPORTED'
  | 'CLOSING_TASK_COMPLETED'
  | 'PERIOD_CLOSED'
  | 'PERIOD_LOCKED'
  | 'PAYMENT_CREATED'
  | 'PAYMENT_SCHEDULED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'ANNUAL_REPORT_UPDATED'
  | 'FORTNOX_CONNECTED'
  | 'FORTNOX_DISCONNECTED'
  | 'FORTNOX_SYNC_STARTED'
  | 'FORTNOX_SYNC_COMPLETED'
  | 'FORTNOX_SYNC_FAILED'
  | 'SETTINGS_CHANGED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

export interface AuditEntry {
  id: string;
  timestamp: string;
  companyId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: 'job' | 'document' | 'vat_report' | 'closing' | 'payment' | 'annual_report' | 'settings' | 'fortnox' | 'auth';
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

/**
 * Log an audit entry
 */
export async function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const auditEntry: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({
      TableName: AUDIT_TABLE_NAME,
      Item: {
        pk: `COMPANY#${entry.companyId}`,
        sk: `AUDIT#${auditEntry.timestamp}#${auditEntry.id}`,
        ...auditEntry,
        // GSI for querying by action type
        gsi1pk: `ACTION#${entry.action}`,
        gsi1sk: auditEntry.timestamp,
        // TTL - keep audit logs for 7 years (Bokföringslagen)
        ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60),
      },
    }));

    // Also log to CloudWatch for real-time monitoring
    console.log(JSON.stringify({
      level: 'AUDIT',
      ...sanitizeForLog(auditEntry),
    }));

  } catch (error) {
    // Never fail silently on audit logging - log to console as backup
    console.error('Failed to write audit log:', error);
    console.log(JSON.stringify({
      level: 'AUDIT_FALLBACK',
      ...auditEntry,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

/**
 * Query audit logs for a company
 */
export async function getAuditLogs(
  companyId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    action?: AuditAction;
    limit?: number;
  }
): Promise<AuditEntry[]> {
  const { startDate, endDate, action, limit = 100 } = options || {};

  try {
    // If filtering by action, use the GSI
    if (action) {
      const result = await docClient.send(new QueryCommand({
        TableName: AUDIT_TABLE_NAME,
        IndexName: 'gsi1pk-gsi1sk-index',
        KeyConditionExpression: startDate && endDate
          ? 'gsi1pk = :action AND gsi1sk BETWEEN :start AND :end'
          : 'gsi1pk = :action',
        FilterExpression: 'companyId = :companyId',
        ExpressionAttributeValues: {
          ':action': `ACTION#${action}`,
          ':companyId': companyId,
          ...(startDate && { ':start': startDate }),
          ...(endDate && { ':end': endDate }),
        },
        Limit: limit,
        ScanIndexForward: false, // newest first
      }));

      return (result.Items || []) as AuditEntry[];
    }

    // Otherwise, query by company
    const result = await docClient.send(new QueryCommand({
      TableName: AUDIT_TABLE_NAME,
      KeyConditionExpression: startDate && endDate
        ? 'pk = :pk AND sk BETWEEN :start AND :end'
        : 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${companyId}`,
        ...(startDate && endDate
          ? { ':start': `AUDIT#${startDate}`, ':end': `AUDIT#${endDate}` }
          : { ':prefix': 'AUDIT#' }
        ),
      },
      Limit: limit,
      ScanIndexForward: false, // newest first
    }));

    return (result.Items || []) as AuditEntry[];

  } catch (error) {
    console.error('Failed to query audit logs:', error);
    return [];
  }
}

/**
 * Helper to create audit context from request
 */
export function createAuditContext(request: Request, userId?: string, userEmail?: string): {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
} {
  return {
    userId,
    userEmail,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}

// Export singleton-style helper functions for common audit actions
export const auditLog = {
  documentUploaded: (companyId: string, jobId: string, fileName: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'document',
      resourceId: jobId,
      details: { fileName },
      success: true,
      ...context,
    }),

  jobApproved: (companyId: string, jobId: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'JOB_APPROVED',
      resourceType: 'job',
      resourceId: jobId,
      success: true,
      ...context,
    }),

  jobAutoApproved: (companyId: string, jobId: string, confidence: number, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'JOB_AUTO_APPROVED',
      resourceType: 'job',
      resourceId: jobId,
      details: { confidence },
      success: true,
      ...context,
    }),

  jobRejected: (companyId: string, jobId: string, reason: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'JOB_REJECTED',
      resourceType: 'job',
      resourceId: jobId,
      details: { reason },
      success: true,
      ...context,
    }),

  jobSentToFortnox: (companyId: string, jobId: string, voucherId: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'JOB_SENT_TO_FORTNOX',
      resourceType: 'job',
      resourceId: jobId,
      details: { voucherId },
      success: true,
      ...context,
    }),

  jobPrecheckFailed: (companyId: string, jobId: string, reason: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'JOB_PRECHECK_FAILED',
      resourceType: 'job',
      resourceId: jobId,
      details: { reason },
      success: false,
      errorMessage: reason,
      ...context,
    }),

  jobPolicyBlocked: (companyId: string, jobId: string, summary: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'JOB_POLICY_BLOCKED',
      resourceType: 'job',
      resourceId: jobId,
      details: { summary },
      success: false,
      errorMessage: summary,
      ...context,
    }),

  fortnoxPostingStarted: (companyId: string, jobId: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'FORTNOX_POSTING_STARTED',
      resourceType: 'fortnox',
      resourceId: jobId,
      success: true,
      ...context,
    }),

  fortnoxPostingCompleted: (companyId: string, jobId: string, resultId: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'FORTNOX_POSTING_COMPLETED',
      resourceType: 'fortnox',
      resourceId: jobId,
      details: { resultId },
      success: true,
      ...context,
    }),

  fortnoxPostingFailed: (companyId: string, jobId: string, errorMessage: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'FORTNOX_POSTING_FAILED',
      resourceType: 'fortnox',
      resourceId: jobId,
      success: false,
      errorMessage,
      ...context,
    }),

  classificationCompleted: (companyId: string, jobId: string, details: Record<string, unknown>, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'CLASSIFICATION_COMPLETED',
      resourceType: 'job',
      resourceId: jobId,
      details,
      success: true,
      ...context,
    }),

  classificationCorrected: (companyId: string, jobId: string, details: Record<string, unknown>, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'CLASSIFICATION_CORRECTED',
      resourceType: 'job',
      resourceId: jobId,
      details,
      success: true,
      ...context,
    }),

  vatReportGenerated: (companyId: string, period: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'VAT_REPORT_GENERATED',
      resourceType: 'vat_report',
      details: { period },
      success: true,
      ...context,
    }),

  periodClosed: (companyId: string, year: number, month: number, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'PERIOD_CLOSED',
      resourceType: 'closing',
      details: { year, month },
      success: true,
      ...context,
    }),

  paymentCompleted: (companyId: string, paymentId: string, amount: number, supplier: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'PAYMENT_COMPLETED',
      resourceType: 'payment',
      resourceId: paymentId,
      details: { amount, supplier },
      success: true,
      ...context,
    }),

  fortnoxConnected: (companyId: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'FORTNOX_CONNECTED',
      resourceType: 'fortnox',
      success: true,
      ...context,
    }),

  settingsChanged: (companyId: string, setting: string, oldValue: unknown, newValue: unknown, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action: 'SETTINGS_CHANGED',
      resourceType: 'settings',
      details: { setting, oldValue, newValue },
      success: true,
      ...context,
    }),

  error: (companyId: string, action: AuditAction, resourceType: AuditEntry['resourceType'], errorMessage: string, context?: Partial<AuditEntry>) =>
    logAudit({
      companyId,
      action,
      resourceType,
      success: false,
      errorMessage,
      ...context,
    }),
};


