/**
 * CRM Stats API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCrmStats } from '@/lib/crm/store';
import { verifyIdToken } from '@/lib/auth/tokens';

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  
  try {
    const payload = await verifyIdToken(token);
    return {
      sub: payload.sub as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

// GET /api/crm/stats?companyId=xxx
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    const stats = await getCrmStats(companyId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[CRM API] Stats GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
