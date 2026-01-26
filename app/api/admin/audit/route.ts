import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, ScanCommandInput } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// DynamoDB Setup
// ============================================================================

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const AUDIT_TABLE = process.env.AUDIT_TABLE_NAME || 'aifm-audit-logs';

// ============================================================================
// Types
// ============================================================================

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  companyId?: string;
  companyName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure' | 'warning';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// GET - Query audit logs with filters
// ============================================================================

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');
    const lastKey = searchParams.get('lastKey');

    // Build filter expression
    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (startDate) {
      filterExpressions.push('#ts >= :startDate');
      expressionAttributeNames['#ts'] = 'timestamp';
      expressionAttributeValues[':startDate'] = startDate;
    }

    if (endDate) {
      filterExpressions.push('#ts <= :endDate');
      expressionAttributeNames['#ts'] = 'timestamp';
      expressionAttributeValues[':endDate'] = endDate;
    }

    if (userId) {
      filterExpressions.push('userId = :userId');
      expressionAttributeValues[':userId'] = userId;
    }

    if (action) {
      filterExpressions.push('#action = :action');
      expressionAttributeNames['#action'] = 'action';
      expressionAttributeValues[':action'] = action;
    }

    if (resource) {
      filterExpressions.push('resource = :resource');
      expressionAttributeValues[':resource'] = resource;
    }

    if (severity) {
      filterExpressions.push('severity = :severity');
      expressionAttributeValues[':severity'] = severity;
    }

    const scanParams: ScanCommandInput = {
      TableName: AUDIT_TABLE,
      Limit: limit,
    };

    if (filterExpressions.length > 0) {
      scanParams.FilterExpression = filterExpressions.join(' AND ');
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
      if (Object.keys(expressionAttributeNames).length > 0) {
        scanParams.ExpressionAttributeNames = expressionAttributeNames;
      }
    }

    if (lastKey) {
      scanParams.ExclusiveStartKey = JSON.parse(lastKey);
    }

    const command = new ScanCommand(scanParams);
    const response = await docClient.send(command);

    // Sort by timestamp descending
    const logs = (response.Items || []).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      logs,
      lastKey: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : null,
      count: logs.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch audit logs';
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create audit log entry (internal use)
// ============================================================================

export async function POST(request: NextRequest) {
  // This endpoint is for internal logging - don't require admin role
  // but validate the request origin
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  // Only allow internal calls
  if (origin && !origin.includes(host || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      userId,
      userEmail,
      action,
      resource,
      resourceId,
      companyId,
      companyName,
      details,
      status = 'success',
      severity = 'low',
    } = body;

    if (!userId || !action || !resource) {
      return NextResponse.json(
        { error: 'userId, action, and resource are required' },
        { status: 400 }
      );
    }

    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userId,
      userEmail: userEmail || 'unknown',
      action,
      resource,
      resourceId,
      companyId,
      companyName,
      details,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      status,
      severity,
    };

    // In production, save to DynamoDB
    // For now, just log to console (CloudWatch)
    console.log('[AUDIT]', JSON.stringify(entry));

    return NextResponse.json({ success: true, id: entry.id });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create audit log';
    console.error('Failed to create audit log:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET stats - Audit statistics
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Return aggregated stats
    // In production, this would query DynamoDB with aggregations
    const stats = {
      totalLogs: 0,
      byAction: {} as Record<string, number>,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      byStatus: {
        success: 0,
        failure: 0,
        warning: 0,
      },
      topUsers: [] as Array<{ userId: string; count: number }>,
      topResources: [] as Array<{ resource: string; count: number }>,
    };

    return NextResponse.json(stats);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch audit stats';
    console.error('Failed to fetch audit stats:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

