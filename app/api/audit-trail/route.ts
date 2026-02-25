import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand as DocQueryCommand, ScanCommand as DocScanCommand } from '@aws-sdk/lib-dynamodb';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const AUDIT_TABLE = 'aifm-audit-logs';
const SECURITIES_TABLE = 'aifm-securities-approvals';
const DATAROOMS_TABLE = 'aifm-data-rooms';
const NOTIFICATIONS_TABLE = 'aifm-notifications';

interface UnifiedAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  category: 'securities' | 'document' | 'compliance' | 'financial' | 'system' | 'security' | 'dataroom' | 'accounting';
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: {
    name: string;
    email: string;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  details: Record<string, unknown>;
  source: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    const allEntries: UnifiedAuditEntry[] = [];

    const fetchers: Promise<void>[] = [
      fetchAuditLogs(allEntries, limit),
      fetchSecuritiesAuditTrail(allEntries, limit),
      fetchDataRoomActivity(allEntries, limit),
      fetchNotifications(allEntries, limit),
    ];

    await Promise.allSettled(fetchers);

    let filtered = allEntries;

    if (category && category !== 'all') {
      filtered = filtered.filter(e => e.category === category);
    }
    if (startDate) {
      filtered = filtered.filter(e => e.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(e => e.timestamp <= endDate);
    }

    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    filtered = filtered.slice(0, limit);

    const stats = {
      total: filtered.length,
      byCategory: {} as Record<string, number>,
      bySeverity: { info: 0, warning: 0, error: 0, critical: 0 },
    };
    for (const entry of filtered) {
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
      stats.bySeverity[entry.severity]++;
    }

    return NextResponse.json({ logs: filtered, stats });
  } catch (error) {
    console.error('[AuditTrail] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit trail', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

async function fetchAuditLogs(entries: UnifiedAuditEntry[], limit: number): Promise<void> {
  try {
    const result = await docClient.send(new DocScanCommand({
      TableName: AUDIT_TABLE,
      Limit: limit,
    }));

    for (const item of result.Items || []) {
      const actionStr = String(item.action || '');
      entries.push({
        id: item.id || item.sk || `audit-${Date.now()}`,
        timestamp: item.timestamp || new Date().toISOString(),
        action: actionStr,
        category: mapAccountingCategory(actionStr),
        severity: item.success === false ? 'error' : actionStr.includes('FAILED') || actionStr.includes('BLOCKED') ? 'warning' : 'info',
        actor: {
          name: item.userEmail?.split('@')[0] || 'System',
          email: item.userEmail || 'system@aifm.se',
        },
        target: item.resourceId ? {
          type: item.resourceType || 'unknown',
          id: item.resourceId,
          name: item.details?.fileName || item.resourceId,
        } : undefined,
        details: item.details || {},
        source: 'audit-logs',
      });
    }
  } catch (error) {
    console.warn('[AuditTrail] Failed to fetch audit logs:', error);
  }
}

async function fetchSecuritiesAuditTrail(entries: UnifiedAuditEntry[], limit: number): Promise<void> {
  try {
    const result = await docClient.send(new DocScanCommand({
      TableName: SECURITIES_TABLE,
      Limit: Math.min(limit, 100),
      ProjectionExpression: 'id, #s, securityName, fundName, createdBy, createdByEmail, reviewedBy, reviewedByEmail, auditTrail, updatedAt',
      ExpressionAttributeNames: { '#s': 'status' },
    }));

    for (const item of result.Items || []) {
      const trail = item.auditTrail;
      if (!Array.isArray(trail)) continue;

      for (const entry of trail) {
        const action = String(entry.action || '');
        entries.push({
          id: `sec-${item.id}-${entry.timestamp}`,
          timestamp: entry.timestamp,
          action: `securities.${action}`,
          category: 'securities',
          severity: action === 'rejected' ? 'warning' : action === 'approved' ? 'info' : 'info',
          actor: {
            name: entry.actor || 'Unknown',
            email: entry.actorEmail || '',
          },
          target: {
            type: 'security',
            id: item.id,
            name: item.securityName || 'Värdepapper',
          },
          details: {
            fundName: item.fundName,
            status: item.status,
            ...(entry.details ? { comment: entry.details } : {}),
          },
          source: 'securities',
        });
      }
    }
  } catch (error) {
    console.warn('[AuditTrail] Failed to fetch securities audit trail:', error);
  }
}

async function fetchDataRoomActivity(entries: UnifiedAuditEntry[], limit: number): Promise<void> {
  try {
    const roomsResult = await docClient.send(new DocScanCommand({
      TableName: DATAROOMS_TABLE,
      FilterExpression: 'begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'ACT#' },
      Limit: Math.min(limit, 200),
    }));

    for (const item of roomsResult.Items || []) {
      const action = String(item.action || '');
      entries.push({
        id: item.id || `dr-${Date.now()}-${Math.random()}`,
        timestamp: item.timestamp || new Date().toISOString(),
        action: `dataroom.${action.toLowerCase()}`,
        category: 'dataroom',
        severity: action === 'DELETE' ? 'warning' : 'info',
        actor: {
          name: item.userName || item.userId || 'Unknown',
          email: item.userId || '',
        },
        target: item.targetName ? {
          type: item.targetType || 'document',
          id: item.targetId || '',
          name: item.targetName || '',
        } : undefined,
        details: {
          roomId: item.roomId,
          action,
        },
        source: 'dataroom',
      });
    }
  } catch (error) {
    console.warn('[AuditTrail] Failed to fetch data room activity:', error);
  }
}

async function fetchNotifications(entries: UnifiedAuditEntry[], limit: number): Promise<void> {
  try {
    const result = await docClient.send(new DocScanCommand({
      TableName: NOTIFICATIONS_TABLE,
      Limit: Math.min(limit, 100),
    }));

    for (const item of result.Items || []) {
      const notifType = String(item.type || 'system');
      entries.push({
        id: item.id || `notif-${Date.now()}`,
        timestamp: item.createdAt || new Date().toISOString(),
        action: `notification.${notifType}`,
        category: notifType.includes('security') || notifType.includes('approval') ? 'securities' : 'system',
        severity: item.priority === 'high' ? 'warning' : 'info',
        actor: {
          name: 'System',
          email: 'system@aifm.se',
        },
        target: item.link ? {
          type: 'notification',
          id: item.id || '',
          name: item.title || '',
        } : undefined,
        details: {
          title: item.title,
          message: item.message,
          read: item.read,
          userEmail: item.userEmail,
        },
        source: 'notifications',
      });
    }
  } catch (error) {
    console.warn('[AuditTrail] Failed to fetch notifications:', error);
  }
}

function mapAccountingCategory(action: string): UnifiedAuditEntry['category'] {
  if (action.startsWith('FORTNOX_') || action.startsWith('PAYMENT_')) return 'financial';
  if (action.startsWith('DOCUMENT_') || action.startsWith('CLASSIFICATION_')) return 'document';
  if (action.startsWith('JOB_')) return 'accounting';
  if (action.startsWith('USER_')) return 'security';
  if (action.startsWith('SETTINGS_') || action.startsWith('PERIOD_') || action.startsWith('VAT_')) return 'compliance';
  return 'system';
}
