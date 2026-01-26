import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { skatteverketSubmissionService } from '@/lib/accounting/integrations/skatteverketSubmissionService';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    const submissions = await skatteverketSubmissionService.list(companyId);
    return NextResponse.json({ submissions });
  } catch (e) {
    console.error('[API] skatteverket/submissions GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { companyId, year, month, quarter } = body || {};
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    if (!year) return NextResponse.json({ error: 'year is required' }, { status: 400 });

    const submission = await skatteverketSubmissionService.queueVatDeclaration({
      companyId,
      year,
      month,
      quarter,
    });

    return NextResponse.json({ success: true, submission });
  } catch (e) {
    console.error('[API] skatteverket/submissions POST error:', e);
    return NextResponse.json(
      { error: 'Internal server error', details: e instanceof Error ? e.message : 'Unknown' },
      { status: 500 }
    );
  }
}



