/**
 * CRM Timeline API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTimeline } from '@/lib/crm/store';
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

// GET /api/crm/timeline?companyId=xxx&contactId=xxx&dealId=xxx&limit=20
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const contactId = searchParams.get('contactId') || undefined;
  const crmCompanyId = searchParams.get('crmCompanyId') || undefined;
  const dealId = searchParams.get('dealId') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 });
  }

  try {
    const timeline = await getTimeline(companyId, {
      contactId,
      crmCompanyId,
      dealId,
      limit,
    });
    return NextResponse.json(timeline);
  } catch (error) {
    console.error('[CRM API] Timeline GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
