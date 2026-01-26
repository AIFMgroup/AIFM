import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { enqueueIntegrationJob, stableIdempotencyKeyFromBytes } from '@/lib/integrations/jobQueue';

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verifyHmacSha256(rawBody: Buffer, secret: string, providedSignature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(expected, providedSignature);
}

/**
 * POST /api/tink/webhook
 *
 * Skeleton endpoint:
 * - verifies signature (HMAC-SHA256 over raw body) when configured
 * - enqueues an integration job and returns 202
 *
 * NOTE: Header names vary by provider; for now we support:
 * - x-tink-signature: hex hmac sha256(rawBody)
 * - x-tink-event-id: optional idempotency key override
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.TINK_WEBHOOK_SECRET || '';
    const requireSig = process.env.TINK_REQUIRE_SIGNATURE === 'true' || !!secret;

    const raw = Buffer.from(await request.arrayBuffer());
    const signature = request.headers.get('x-tink-signature') || '';
    const eventId = request.headers.get('x-tink-event-id') || '';

    if (requireSig) {
      if (!secret) return NextResponse.json({ error: 'Webhook signature required but TINK_WEBHOOK_SECRET is missing' }, { status: 500 });
      if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      if (!verifyHmacSha256(raw, secret, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payloadJson: unknown = await (async () => {
      try {
        return JSON.parse(raw.toString('utf-8'));
      } catch {
        return { raw: raw.toString('utf-8') };
      }
    })();

    const companyId =
      typeof (payloadJson as any)?.companyId === 'string'
        ? (payloadJson as any).companyId
        : request.nextUrl.searchParams.get('companyId'); // fallback for testing

    if (!companyId) return NextResponse.json({ error: 'Missing companyId (in body.companyId or ?companyId=...)' }, { status: 400 });

    const idempotencyKey = eventId || stableIdempotencyKeyFromBytes(raw);

    const { job, deduped } = await enqueueIntegrationJob({
      companyId,
      type: 'TINK_WEBHOOK_EVENT',
      idempotencyKey,
      payload: {
        receivedAt: new Date().toISOString(),
        headers: {
          signature: signature || undefined,
          eventId: eventId || undefined,
        },
        body: payloadJson as Record<string, unknown>,
      },
    });

    return NextResponse.json({ accepted: true, deduped, jobId: job.id }, { status: 202 });
  } catch (e) {
    console.error('[TinkWebhook] POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


