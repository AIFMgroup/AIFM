import { NextRequest, NextResponse } from 'next/server';
import { syncFundRegistryFromISEC } from '@/lib/integrations/isec/isec-data-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('x-aifm-cron-secret') || request.headers.get('x-cron-secret');
  if (header && header === secret) return true;
  const qSecret = request.nextUrl.searchParams.get('secret');
  if (qSecret && qSecret === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncFundRegistryFromISEC();
    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await syncFundRegistryFromISEC();
    return NextResponse.json({
      ok: result.errors.length === 0,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
