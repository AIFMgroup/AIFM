import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getRoleFromRequest } from '@/lib/accounting/authz';
import { dynamoClient } from '@/lib/dataRooms/dynamoClient';
import { QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';

interface RouteParams {
  params: Promise<Record<string, never>>;
}

/**
 * GET /api/audit/logs
 * 
 * Query audit logs (restricted to auditors, admins, and compliance team)
 * 
 * Query params:
 * - companyId: Filter by company
 * - userId: Filter by user
 * - action: Filter by action type
 * - startDate: Start date (ISO string)
 * - endDate: End date (ISO string)
 * - limit: Max records (default 100, max 1000)
 * - nextToken: Pagination token
 */
export async function GET(request: NextRequest, {}: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role - only auditors and admins
    const role = await getRoleFromRequest(request);
    if (role !== 'auditor' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Requires auditor or admin role' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const nextToken = searchParams.get('nextToken');

    let logs: any[] = [];

    if (companyId) {
      // Query by companyId-timestamp index
      const result = await dynamoClient.send(new QueryCommand({
        TableName: 'aifm-audit-logs',
        IndexName: 'companyId-timestamp-index',
        KeyConditionExpression: 'companyId = :companyId' + (startDate ? ' AND #ts BETWEEN :start AND :end' : ''),
        ExpressionAttributeNames: startDate ? { '#ts': 'timestamp' } : undefined,
        ExpressionAttributeValues: {
          ':companyId': { S: companyId },
          ...(startDate && { ':start': { S: startDate } }),
          ...(endDate && { ':end': { S: endDate || new Date().toISOString() } }),
        },
        Limit: limit,
        ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
      }));

      logs = result.Items || [];
      
      const responseNextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      return NextResponse.json({
        logs: logs.map(parseAuditLog),
        nextToken: responseNextToken,
        count: logs.length,
      });

    } else if (userId) {
      // Query by userId index
      const result = await dynamoClient.send(new QueryCommand({
        TableName: 'aifm-audit-logs',
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
        },
        Limit: limit,
      }));

      logs = result.Items || [];
      return NextResponse.json({
        logs: logs.map(parseAuditLog),
        count: logs.length,
      });

    } else {
      // Scan all (expensive, should be avoided in production with large datasets)
      const result = await dynamoClient.send(new ScanCommand({
        TableName: 'aifm-audit-logs',
        Limit: limit,
        ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
      }));

      logs = result.Items || [];
      
      const responseNextToken = result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined;

      return NextResponse.json({
        logs: logs.map(parseAuditLog),
        nextToken: responseNextToken,
        count: logs.length,
        warning: 'Scanning all logs is expensive. Please filter by companyId or userId.',
      });
    }

  } catch (error) {
    console.error('[Audit] Query error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * Parse DynamoDB audit log item
 */
function parseAuditLog(item: Record<string, any>): any {
  return {
    id: item.id?.S || item.sk?.S,
    timestamp: item.timestamp?.S,
    userId: item.userId?.S,
    userName: item.userName?.S,
    userEmail: item.userEmail?.S,
    companyId: item.companyId?.S,
    action: item.action?.S,
    targetType: item.targetType?.S,
    targetId: item.targetId?.S,
    targetName: item.targetName?.S,
    ipAddress: item.ipAddress?.S,
    userAgent: item.userAgent?.S,
    metadata: item.metadata?.S ? JSON.parse(item.metadata.S) : undefined,
  };
}







