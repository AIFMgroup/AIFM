import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuditLogs, AuditAction } from '@/lib/accounting/auditLogger';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const action = searchParams.get('action') as AuditAction | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId parameter' }, { status: 400 });
    }

    const logs = await getAuditLogs(companyId, {
      action: action || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    return NextResponse.json({ 
      success: true, 
      logs,
      count: logs.length,
    });

  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


