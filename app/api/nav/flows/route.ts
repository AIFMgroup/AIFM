/**
 * NAV Flows API
 *
 * GET /api/nav/flows?date=YYYY-MM-DD&type=notor|subred
 *
 * Returns imported Sub/Red transactions for a given date.
 * - notor: Yesterday's settled flows
 * - subred: Today's planned flows
 * - (no type): All flows for the date
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFlowsStore, type StoredFlowEntry } from '@/lib/nav-engine/flows-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const type = searchParams.get('type'); // 'notor', 'subred', or null

    const flowsStore = getFlowsStore();

    let flows: StoredFlowEntry[];
    let dataSource = 'flows-store';

    if (type === 'notor') {
      const yesterday = getPreviousBusinessDay(date);
      flows = await flowsStore.getFlowsByDate(yesterday);
    } else if (type === 'subred') {
      flows = await flowsStore.getFlowsByDate(date);
    } else {
      flows = await flowsStore.getFlowsByDate(date);
    }

    // Enrich with ISEC transaction data if local store is empty
    if (flows.length === 0) {
      try {
        const { getISECFunds, getISECTransactions } = await import('@/lib/integrations/isec/isec-data-service');
        const funds = await getISECFunds();
        const isecFlows: StoredFlowEntry[] = [];

        for (const fund of funds) {
          const txns = await getISECTransactions(fund.id, { from: date, to: date });
          for (const txn of txns) {
            const isSubscription = txn.type.toLowerCase().includes('subscri') || txn.type.toLowerCase().includes('inflow') || txn.type.toLowerCase().includes('köp');
            isecFlows.push({
              pk: `FLOW#${date}`,
              sk: `${fund.id}#${txn.id}`,
              date,
              fundId: fund.id,
              fundName: fund.name,
              isin: fund.isin || '',
              type: isSubscription ? 'subscription' : 'redemption',
              amount: Math.abs(txn.amount),
              currency: txn.currency,
              shares: 0,
              customer: txn.securityName || '',
              status: txn.status.toLowerCase().includes('settled') ? 'settled' : 'pending',
              source: 'ISEC',
              importedAt: new Date().toISOString(),
            } as StoredFlowEntry);
          }
        }

        if (isecFlows.length > 0) {
          flows = isecFlows;
          dataSource = 'isec';
        }
      } catch (err) {
        console.warn('[NAV Flows] ISEC enrichment failed:', err);
      }
    }

    // Calculate summary per fund
    const summaryMap = new Map<string, {
      fundName: string;
      totalInflow: number;
      totalOutflow: number;
      netFlow: number;
      currency: string;
      transactionCount: number;
    }>();

    for (const flow of flows) {
      const key = flow.fundName || flow.fundId;
      const existing = summaryMap.get(key) || {
        fundName: key,
        totalInflow: 0,
        totalOutflow: 0,
        netFlow: 0,
        currency: flow.currency,
        transactionCount: 0,
      };

      if (flow.type === 'subscription') {
        existing.totalInflow += flow.amount;
        existing.netFlow += flow.amount;
      } else {
        existing.totalOutflow += flow.amount;
        existing.netFlow -= flow.amount;
      }
      existing.transactionCount++;
      summaryMap.set(key, existing);
    }

    return NextResponse.json({
      date,
      type: type || 'all',
      flows: flows.map((f) => ({
        id: f.sk,
        fundName: f.fundName,
        isin: f.isin,
        type: f.type === 'subscription' ? 'inflow' : 'outflow',
        amount: f.amount,
        currency: f.currency,
        shares: f.shares,
        navPrice: 0,
        investor: f.customer,
        date: f.date,
        status: f.status === 'settled' ? 'confirmed' : f.status === 'confirmed' ? 'confirmed' : 'pending',
      })),
      summary: Array.from(summaryMap.values()),
      totalFlows: flows.length,
    });
  } catch (err) {
    console.error('[NAV Flows GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function getPreviousBusinessDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().split('T')[0];
}
