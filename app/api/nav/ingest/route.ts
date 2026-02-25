/**
 * NAV Data Ingest API
 *
 * POST /api/nav/ingest
 *
 * Accepts daily AuAg files and stores them in DynamoDB:
 * - action: 'csv-prices'  — Parse NAV price CSV from AuAg
 * - action: 'xls-subred'  — Parse Sub/Red XLS rows
 * - action: 'xls-nav'     — Parse NAV detail XLS rows
 *
 * GET /api/nav/ingest?date=YYYY-MM-DD
 * Returns imported data for a given date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  parseAuAgNAVCSV,
  parseSubRedRows,
  parseNAVDetailRows,
  type ParsedNAVPrice,
  type ParsedSubRedEntry,
  type ParsedNAVDetail,
} from '@/lib/nav-engine/ingest';
import {
  getFlowsStore,
  getNAVPricesStore,
} from '@/lib/nav-engine/flows-store';

export const dynamic = 'force-dynamic';

// ============================================================================
// Auth helper
// ============================================================================

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-aifm-cron-secret') === secret;
}

// ============================================================================
// POST — Import data
// ============================================================================

interface CSVPricesRequest {
  action: 'csv-prices';
  csvContent: string;
}

interface XLSSubRedRequest {
  action: 'xls-subred';
  rows: (string | number | null)[][];
  date: string;
}

interface XLSNAVRequest {
  action: 'xls-nav';
  rows: (string | number | null)[][];
  date: string;
}

type IngestRequest = CSVPricesRequest | XLSSubRedRequest | XLSNAVRequest;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const cronOk = isAuthorizedCron(request);
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!cronOk && !authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: IngestRequest = await request.json();

    switch (body.action) {
      case 'csv-prices': {
        const result = parseAuAgNAVCSV(body.csvContent);
        const prices = result.data as ParsedNAVPrice[];

        // Store in DynamoDB
        const stored = await getNAVPricesStore().savePricesFromCSV(prices);

        return NextResponse.json({
          success: result.success,
          action: 'csv-prices',
          date: result.date,
          parsed: result.recordsProcessed,
          stored,
          errors: result.errors,
          prices: prices.map((p) => ({
            name: p.shareClassName,
            isin: p.isin,
            nav: p.navPerShare,
            change: p.changePercent,
            currency: p.currency,
          })),
        });
      }

      case 'xls-subred': {
        const result = parseSubRedRows(body.rows, body.date);
        const entries = result.data as ParsedSubRedEntry[];

        // Store in DynamoDB
        const stored = await getFlowsStore().saveFlows(entries);

        return NextResponse.json({
          success: result.success,
          action: 'xls-subred',
          date: result.date,
          parsed: result.recordsProcessed,
          stored,
          errors: result.errors,
          flows: entries.map((e) => ({
            customer: e.customer,
            type: e.type,
            amount: e.amount,
            shares: e.shares,
            fund: e.fundName,
            isin: e.isin,
          })),
        });
      }

      case 'xls-nav': {
        const result = parseNAVDetailRows(body.rows, body.date);
        const details = result.data as ParsedNAVDetail[];

        // Store in DynamoDB
        const stored = await getNAVPricesStore().savePricesFromDetail(details);

        return NextResponse.json({
          success: result.success,
          action: 'xls-nav',
          date: result.date,
          parsed: result.recordsProcessed,
          stored,
          errors: result.errors,
          details: details.map((d) => ({
            fund: d.fundName,
            isin: d.isin,
            nav: d.navPerShare,
            shares: d.sharesOutstanding,
            tna: d.totalNetAssets,
          })),
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('[NAV Ingest]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — Query imported data
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const type = searchParams.get('type'); // 'prices', 'flows', or null (all)

    const result: Record<string, unknown> = { date };

    if (!type || type === 'prices') {
      const prices = await getNAVPricesStore().getPricesByDate(date);
      result.prices = prices;
      result.priceCount = prices.length;
    }

    if (!type || type === 'flows') {
      const flows = await getFlowsStore().getFlowsByDate(date);
      result.flows = flows;
      result.flowCount = flows.length;
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[NAV Ingest GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
