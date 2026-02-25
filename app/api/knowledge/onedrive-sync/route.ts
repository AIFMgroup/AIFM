import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { runOneDriveSync } from '@/lib/knowledge/onedriveSyncService';
import { getOneDriveSyncState } from '@/lib/knowledge/onedriveSyncStateStore';

const DEFAULT_COMPANY_ID = 'default';

/**
 * GET /api/knowledge/onedrive-sync?companyId=default
 * Returns current sync state and last sync info.
 */
export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const companyId = request.nextUrl.searchParams.get('companyId') || DEFAULT_COMPANY_ID;
  const state = await getOneDriveSyncState(companyId);
  return NextResponse.json(state ?? { companyId, status: 'idle', notFound: true });
}

/**
 * POST /api/knowledge/onedrive-sync
 * Body: { companyId?: string, folderId?: string }
 * Triggers a manual OneDrive sync. Requires Microsoft 365 connected for the company.
 */
export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: { companyId?: string; folderId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  const companyId = body.companyId || request.nextUrl.searchParams.get('companyId') || DEFAULT_COMPANY_ID;
  const folderId = body.folderId || undefined;

  try {
    const result = await runOneDriveSync({ companyId, folderId });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, syncedCount: 0, error: message },
      { status: 500 }
    );
  }
}
