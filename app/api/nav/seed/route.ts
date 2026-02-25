/**
 * NAV Seed API
 *
 * POST /api/nav/seed
 *
 * Seeds the DynamoDB fund-config table with AuAg fund configurations.
 * Should be run once to set up the system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUAG_FUNDS } from '@/lib/nav-engine/auag-funds';
import { getFundConfigStore } from '@/lib/nav-engine/nav-store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configStore = getFundConfigStore();
    const results: { fundId: string; name: string; shareClasses: number; status: string }[] = [];

    for (const fund of AUAG_FUNDS) {
      try {
        await configStore.saveFundConfig(fund);
        results.push({
          fundId: fund.fundId,
          name: fund.name,
          shareClasses: fund.shareClasses.length,
          status: 'created',
        });
      } catch (err) {
        results.push({
          fundId: fund.fundId,
          name: fund.name,
          shareClasses: fund.shareClasses.length,
          status: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'created').length;
    const totalShareClasses = results.reduce((sum, r) => sum + r.shareClasses, 0);

    return NextResponse.json({
      success: true,
      message: `Seeded ${successCount} funds with ${totalShareClasses} share classes`,
      funds: results,
    });
  } catch (err) {
    console.error('[NAV Seed]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
