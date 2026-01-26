import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAsset, deleteAsset, listAssets, updateAsset } from '@/lib/accounting/closing/assetStore';

function generateId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * GET /api/accounting/assets?companyId=...
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = request.nextUrl.searchParams.get('companyId');
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  const assets = await listAssets(companyId);
  return NextResponse.json({ assets, count: assets.length });
}

/**
 * POST /api/accounting/assets
 * Body: { companyId, action: 'create' | 'update' | 'delete', ... }
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await request.json();
  const { companyId, action } = body as { companyId?: string; action?: string };
  if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });

  if (action === 'create') {
    const { name, account, acquisitionDate, acquisitionValue, usefulLifeMonths, depreciationMethod } = body as Record<string, unknown>;
    if (
      typeof name !== 'string' ||
      typeof account !== 'string' ||
      typeof acquisitionDate !== 'string' ||
      typeof acquisitionValue !== 'number' ||
      typeof usefulLifeMonths !== 'number' ||
      (depreciationMethod !== 'linear' && depreciationMethod !== 'declining')
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const asset = await createAsset(companyId, {
      id: generateId(),
      name,
      account,
      acquisitionDate,
      acquisitionValue,
      usefulLifeMonths,
      depreciationMethod,
    });
    return NextResponse.json({ success: true, asset });
  }

  if (action === 'update') {
    const { assetId, updates } = body as { assetId?: string; updates?: unknown };
    if (!assetId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Missing assetId/updates' }, { status: 400 });
    }
    await updateAsset(companyId, assetId, updates as Record<string, unknown>);
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    const { assetId } = body as { assetId?: string };
    if (!assetId) return NextResponse.json({ error: 'Missing assetId' }, { status: 400 });
    await deleteAsset(companyId, assetId);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}



