import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { securaClient } from '@/lib/integrations/isec/isec-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/isec?action=test|funds|nav|positions|transactions|customers|navRuns
 *
 * Proxy to ISEC SECURA REST API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'test';

    if (action === 'health') {
      const result = await securaClient.testConnection();
      return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
    }

    if (action === 'diagnostics') {
      const cronSecret = process.env.AIFM_CRON_SECRET || process.env.CRON_SECRET;
      const qSecret = searchParams.get('secret');
      if (!cronSecret || qSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const today = new Date().toISOString().split('T')[0];
      const diag: Record<string, unknown> = { env: process.env.ISEC_ENV || 'test', timestamp: today };

      const fundsRes = await securaClient.getFunds();
      diag.totalFunds = Array.isArray(fundsRes.data) ? fundsRes.data.length : 0;
      diag.mainFunds = Array.isArray(fundsRes.data) ? fundsRes.data.filter((f: { IsMainFund?: boolean }) => f.IsMainFund).length : 0;

      if (Array.isArray(fundsRes.data) && fundsRes.data.length > 0) {
        const sample = fundsRes.data.find((f: { fundPortfolioId?: number; IsMainFund?: boolean }) => f.IsMainFund && f.fundPortfolioId && f.fundPortfolioId > 0);
        if (sample) {
          diag.sampleFund = { name: sample.Name, id: sample.FundId, portfolioId: sample.fundPortfolioId, isin: sample.ISIN };
          const pid = sample.fundPortfolioId;

          const [navInfo, positions, cash, cashFlows, fees, customers] = await Promise.allSettled([
            securaClient.getNavInformation(pid, today),
            securaClient.getPositions({ portfolioIds: [pid], toDate: today }),
            securaClient.getCurrencyAccounts([pid]),
            securaClient.getCashFlows({ portfolioIds: [pid], fromDate: '2020-01-01', toDate: today }),
            securaClient.getFees([pid]),
            securaClient.getFundCustomers({ excludeClosed: true }),
          ]);

          diag.navInfo = navInfo.status === 'fulfilled' ? { ok: navInfo.value.ok, count: Array.isArray(navInfo.value.data) ? navInfo.value.data.length : 0, sample: Array.isArray(navInfo.value.data) ? navInfo.value.data[0] : null } : { error: String((navInfo as PromiseRejectedResult).reason) };
          diag.positions = positions.status === 'fulfilled' ? { ok: positions.value.ok, count: Array.isArray(positions.value.data) ? positions.value.data.length : 0, instrumentCount: Array.isArray(positions.value.data) ? positions.value.data.filter((p: { positionType?: string }) => p.positionType === 'HTInstrument').length : 0 } : { error: String((positions as PromiseRejectedResult).reason) };
          diag.currencyAccounts = cash.status === 'fulfilled' ? { ok: cash.value.ok, count: Array.isArray(cash.value.data) ? cash.value.data.length : 0 } : { error: String((cash as PromiseRejectedResult).reason) };
          diag.cashFlows = cashFlows.status === 'fulfilled' ? { ok: cashFlows.value.ok, count: Array.isArray(cashFlows.value.data) ? cashFlows.value.data.length : 0 } : { error: String((cashFlows as PromiseRejectedResult).reason) };
          diag.fees = fees.status === 'fulfilled' ? { ok: fees.value.ok, count: Array.isArray(fees.value.data) ? fees.value.data.length : 0, sample: Array.isArray(fees.value.data) ? fees.value.data[0] : null } : { error: String((fees as PromiseRejectedResult).reason) };
          diag.customers = customers.status === 'fulfilled' ? { ok: customers.value.ok, count: Array.isArray(customers.value.data) ? customers.value.data.length : 0 } : { error: String((customers as PromiseRejectedResult).reason) };
        }
      }
      return NextResponse.json(diag);
    }

    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }
    const fundId = searchParams.get('fundId') || '';
    const portfolioId = searchParams.get('portfolioId') || '';

    switch (action) {
      case 'test': {
        const result = await securaClient.testConnection();
        return NextResponse.json(result);
      }

      case 'funds': {
        const result = await securaClient.getFunds(fundId ? parseInt(fundId) : undefined);
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'nav': {
        if (!fundId) return NextResponse.json({ error: 'fundId required' }, { status: 400 });
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const result = await securaClient.getHistoricalNavRates({
          fundId: parseInt(fundId),
          fromDate: from,
          toDate: to,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'navInfo': {
        if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 });
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
        const result = await securaClient.getNavInformation(parseInt(portfolioId), date);
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'positions': {
        if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 });
        const toDate = searchParams.get('date') || undefined;
        const result = await securaClient.getPositions({
          portfolioIds: [parseInt(portfolioId)],
          toDate,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'transactions': {
        if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 });
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const result = await securaClient.getTransactions({
          portfolioIds: [parseInt(portfolioId)],
          fromDate: from,
          toDate: to,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'customers': {
        const result = await securaClient.getFundCustomers({
          customerId: fundId ? parseInt(fundId) : undefined,
          excludeClosed: true,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'customerTransactions': {
        const customerId = searchParams.get('customerId');
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const result = await securaClient.getFundCustomerTransactions({
          customerId: customerId ? parseInt(customerId) : undefined,
          fundId: fundId ? parseInt(fundId) : undefined,
          fromDate: from,
          toDate: to,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'navRuns': {
        const navDate = searchParams.get('date') || undefined;
        const result = await securaClient.getNavRuns({
          navDateTime: navDate,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'portfolios': {
        const result = await securaClient.getPortfolios();
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'fees': {
        if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 });
        const result = await securaClient.getFees([parseInt(portfolioId)]);
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'performance': {
        if (!portfolioId) return NextResponse.json({ error: 'portfolioId required' }, { status: 400 });
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        const result = await securaClient.getPerformance({
          portfolioIds: [parseInt(portfolioId)],
          fromDate: from,
          toDate: to,
        });
        return NextResponse.json({ ok: result.ok, data: result.data });
      }

      case 'overview': {
        const { getPortfolioSummary } = await import('@/lib/integrations/isec/isec-data-service');
        const summary = await getPortfolioSummary();
        return NextResponse.json({ ok: true, data: summary });
      }

      case 'fund-detail': {
        if (!fundId) return NextResponse.json({ error: 'fundId required' }, { status: 400 });
        const { getISECFundWithHoldings } = await import('@/lib/integrations/isec/isec-data-service');
        const fund = await getISECFundWithHoldings(fundId);
        return NextResponse.json({ ok: !!fund, data: fund });
      }

      case 'sync': {
        const { syncFundRegistryFromISEC } = await import('@/lib/integrations/isec/isec-data-service');
        const syncResult = await syncFundRegistryFromISEC();
        return NextResponse.json({ ok: syncResult.errors.length === 0, data: syncResult });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[SECURA API] Error:', error);
    return NextResponse.json(
      { error: 'SECURA integration error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
