import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { paymentService } from '@/lib/accounting/payments/paymentService';
import { generateReconciliationSummary } from '@/lib/accounting/services/bankMatchingService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AIFM_ACCOUNTING_TABLE || 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Lightweight "is the app wired correctly" health endpoint.
 * Accessible by ALB (without cookies) for basic health status.
 * Requires auth cookie for detailed environment/company info.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    // Basic health check for ALB (public)
    if (!token) {
      return NextResponse.json({
        ok: true,
        status: 'UP',
        timestamp: new Date().toISOString()
      });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || undefined;

    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    // DynamoDB read check (permission + table name)
    try {
      await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { pk: 'HEALTH', sk: 'PING' } }));
      checks.dynamo = { ok: true };
    } catch (e) {
      checks.dynamo = { ok: false, detail: e instanceof Error ? e.message : 'unknown' };
    }

    // Feature flags / hardening
    checks.rateLimitMode = {
      ok: process.env.AIFM_REQUIRE_DYNAMO_RATE_LIMIT === 'true',
      detail: process.env.AIFM_REQUIRE_DYNAMO_RATE_LIMIT === 'true' ? 'dynamo_required' : 'fallback_allowed',
    };

    // Optional per-company signals (safe defaults)
    let payments: unknown = null;
    let bank: unknown = null;
    if (companyId) {
      payments = await paymentService.getPaymentSummary(companyId).catch((e) => ({ error: e instanceof Error ? e.message : 'unknown' }));
      const now = new Date();
      bank = await generateReconciliationSummary(companyId, now.getFullYear(), now.getMonth() + 1).catch((e) => ({
        error: e instanceof Error ? e.message : 'unknown',
      }));
    }

    const ok = Object.values(checks).every((c) => c.ok);
    return NextResponse.json({
      ok,
      generatedAt: new Date().toISOString(),
      region: REGION,
      table: TABLE_NAME,
      checks,
      company: companyId ? { companyId, payments, bank } : undefined,
    });
  } catch (error) {
    console.error('[OpsHealth] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



