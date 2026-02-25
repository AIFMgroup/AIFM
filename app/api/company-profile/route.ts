import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getCompanyProfile,
  putCompanyProfile,
  updateCompanyProfile,
  type CompanyProfile,
  type UpdateCompanyProfileInput,
} from '@/lib/companyProfileStore';

const DEFAULT_COMPANY_ID = 'default';

function resolveCompanyId(request: NextRequest, body?: { companyId?: string }): string {
  const fromQuery = request.nextUrl.searchParams.get('companyId');
  const fromBody = body?.companyId;
  return fromBody || fromQuery || DEFAULT_COMPANY_ID;
}

/**
 * GET /api/company-profile?companyId=default
 * Returns the company profile for the given companyId (default: "default").
 */
export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyId = resolveCompanyId(request);
  const profile = await getCompanyProfile(companyId);
  return NextResponse.json(profile ?? { companyId, notFound: true });
}

/**
 * PUT /api/company-profile
 * Body: { companyId?: string, ...UpdateCompanyProfileInput } or full CompanyProfile
 * Creates or updates the company profile.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: UpdateCompanyProfileInput & { companyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const companyId = resolveCompanyId(request, body);
  const { companyId: _drop, ...updates } = body;
  const updated = await updateCompanyProfile(companyId, updates as UpdateCompanyProfileInput);
  return NextResponse.json(updated);
}

/**
 * POST /api/company-profile
 * Body: full CompanyProfile (for replace/create).
 */
export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let profile: CompanyProfile;
  try {
    profile = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!profile.companyId) {
    profile = { ...profile, companyId: DEFAULT_COMPANY_ID };
  }
  const saved = await putCompanyProfile(profile);
  return NextResponse.json(saved);
}
