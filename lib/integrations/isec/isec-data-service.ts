/**
 * SECURA Data Service
 *
 * Shared layer that provides ISEC SECURA data to NAV calculation,
 * the overview dashboard, and the chat agent.
 *
 * Maps the real SECURA API responses (integer PKs, specific field names)
 * to the normalized types used across the application.
 *
 * - Caches responses in memory with configurable TTL
 * - Falls back gracefully if VPN / SECURA is unreachable
 */

import {
  securaClient,
  type SecuraFund,
  type SecuraPosition,
  type SecuraCurrencyAccount,
  type SecuraFee,
  type SecuraFundCustomer,
  type SecuraFundCustomerTransaction,
  type SecuraNavDetails,
  type SecuraHistoricalNavRate,
  type SecuraResponse,
} from './isec-client';

const CACHE_TTL_MS = 5 * 60 * 1000;
const NAV_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttl = CACHE_TTL_MS) {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// ---------------------------------------------------------------------------
// Normalized types used across the app (stable interface for consumers)
// ---------------------------------------------------------------------------

export interface NormalizedFund {
  id: string;
  name: string;
  isin: string;
  currency: string;
  navPerShare?: number;
  totalNav?: number;
  navDate?: string;
  shareClassName?: string;
  holdings?: NormalizedHolding[];
  isMainFund?: boolean;
  mainFundId?: string;
  fundPortfolioId?: number;
  meta?: Record<string, unknown>;
}

export interface NormalizedHolding {
  securityId: string;
  name: string;
  isin?: string;
  quantity: number;
  marketValue: number;
  currency: string;
  weight?: number;
  sector?: string;
  country?: string;
}

export interface NormalizedTransaction {
  id: string;
  type: string;
  date: string;
  securityName?: string;
  isin?: string;
  amount: number;
  currency: string;
  status: string;
  fundId?: string;
}

export interface FundOverviewData {
  nav: number;
  navPerShare?: number;
  navDate?: string;
  moic?: number;
  irr?: number;
  totalInvested?: number;
  totalDistributed?: number;
  unrealizedGain?: number;
  holdingsCount?: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

let _securaAvailable: boolean | null = null;
let _availableCheckedAt = 0;
const AVAILABILITY_CHECK_TTL = 60 * 1000;

export async function isISECAvailable(): Promise<boolean> {
  if (_securaAvailable !== null && Date.now() - _availableCheckedAt < AVAILABILITY_CHECK_TTL) {
    return _securaAvailable;
  }
  try {
    const result = await securaClient.testConnection();
    _securaAvailable = result.connected;
  } catch {
    _securaAvailable = false;
  }
  _availableCheckedAt = Date.now();
  return _securaAvailable;
}

// ---------------------------------------------------------------------------
// Fund list
// ---------------------------------------------------------------------------

function mapSecuraFundToNormalized(f: SecuraFund): NormalizedFund {
  const latestNav = f.LatestNAVRate ? parseFloat(String(f.LatestNAVRate)) : undefined;
  return {
    id: String(f.FundId),
    name: f.Name || '',
    isin: f.ISIN || '',
    currency: f.CurrencyCode || 'SEK',
    navPerShare: isNaN(latestNav!) ? undefined : latestNav,
    navDate: f.LatestNAVDate || undefined,
    isMainFund: f.IsMainFund,
    mainFundId: f.MainFundID > 0 ? String(f.MainFundID) : undefined,
    fundPortfolioId: f.fundPortfolioId > 0 ? f.fundPortfolioId : undefined,
    meta: f as unknown as Record<string, unknown>,
  };
}

export async function getISECFunds(): Promise<NormalizedFund[]> {
  const cacheKey = 'secura:funds';
  const cached = getCached<NormalizedFund[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await securaClient.getFunds();
    if (!res.ok || !Array.isArray(res.data)) return [];

    const funds = res.data.map(mapSecuraFundToNormalized);
    setCache(cacheKey, funds, NAV_CACHE_TTL_MS);
    return funds;
  } catch (err) {
    console.error('[SECURA DataService] Failed to fetch funds:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Single fund with holdings (positions)
// ---------------------------------------------------------------------------

export async function getISECFundWithHoldings(fundId: string): Promise<NormalizedFund | null> {
  const cacheKey = `secura:fund:${fundId}`;
  const cached = getCached<NormalizedFund>(cacheKey);
  if (cached) return cached;

  try {
    const fundIdNum = parseInt(fundId, 10);

    const [fundRes, posRes] = await Promise.allSettled([
      securaClient.getFund(fundIdNum),
      // We need the fund's portfolioId to fetch positions.
      // First get fund details, then use fundPortfolioId.
      securaClient.getFunds(fundIdNum),
    ]);

    const fundList = fundRes.status === 'fulfilled' && fundRes.value.ok
      ? fundRes.value.data : [];
    const fundData = Array.isArray(fundList) ? fundList[0] : null;
    if (!fundData) return null;

    const fund = mapSecuraFundToNormalized(fundData);

    // Fetch positions if we have a portfolio ID
    if (fundData.fundPortfolioId && fundData.fundPortfolioId > 0) {
      try {
        const positionsRes = await securaClient.getPositions({
          portfolioIds: [fundData.fundPortfolioId],
        });
        if (positionsRes.ok && Array.isArray(positionsRes.data)) {
          fund.holdings = positionsRes.data
            .filter((p: SecuraPosition) => p.positionType === 'HTInstrument')
            .map((p: SecuraPosition) => ({
              securityId: String(p.positionId),
              name: p.designation || '',
              quantity: p.quantity,
              marketValue: p.marketValue,
              currency: p.currency || fundData.CurrencyCode || 'SEK',
              weight: p.shareOfPortfolio,
            }));
        }
      } catch { /* positions optional */ }
    }

    setCache(cacheKey, fund, CACHE_TTL_MS);
    return fund;
  } catch (err) {
    console.error(`[SECURA DataService] Failed to fetch fund ${fundId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fund overview data (for dashboard)
// ---------------------------------------------------------------------------

export async function getFundOverview(fundId: string): Promise<FundOverviewData | null> {
  const cacheKey = `secura:overview:${fundId}`;
  const cached = getCached<FundOverviewData>(cacheKey);
  if (cached) return cached;

  try {
    const fund = await getISECFundWithHoldings(fundId);
    if (!fund || !fund.totalNav) return null;

    const overview: FundOverviewData = {
      nav: fund.totalNav,
      navPerShare: fund.navPerShare,
      navDate: fund.navDate,
      currency: fund.currency,
      holdingsCount: fund.holdings?.length,
    };

    setCache(cacheKey, overview, NAV_CACHE_TTL_MS);
    return overview;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Transactions (fund customer transactions)
// ---------------------------------------------------------------------------

export async function getISECTransactions(
  fundId: string,
  params?: { from?: string; to?: string; type?: string }
): Promise<NormalizedTransaction[]> {
  const cacheKey = `secura:tx:${fundId}:${JSON.stringify(params || {})}`;
  const cached = getCached<NormalizedTransaction[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await securaClient.getFundCustomerTransactions({
      fundId: parseInt(fundId, 10),
      fromDate: params?.from,
      toDate: params?.to,
    });
    if (!res.ok || !Array.isArray(res.data)) return [];

    const txns: NormalizedTransaction[] = res.data.map((t: SecuraFundCustomerTransaction) => ({
      id: String(t.fundTransactionId),
      type: t.transactionType || '',
      date: t.transactionDate || '',
      amount: t.amount,
      currency: 'SEK',
      status: t.isCancelled ? 'cancelled' : t.isOrder ? 'order' : 'settled',
      fundId,
    }));

    setCache(cacheKey, txns, CACHE_TTL_MS);
    return txns;
  } catch (err) {
    console.error(`[SECURA DataService] Failed to fetch transactions for ${fundId}:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// NAV history
// ---------------------------------------------------------------------------

export async function getISECNavHistory(
  fundId: string,
  params?: { from?: string; to?: string }
): Promise<SecuraHistoricalNavRate[]> {
  const cacheKey = `secura:navhist:${fundId}:${JSON.stringify(params || {})}`;
  const cached = getCached<SecuraHistoricalNavRate[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await securaClient.getHistoricalNavRates({
      fundId: parseInt(fundId, 10),
      fromDate: params?.from,
      toDate: params?.to,
    });
    if (!res.ok || !Array.isArray(res.data)) return [];
    setCache(cacheKey, res.data, NAV_CACHE_TTL_MS);
    return res.data;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Aggregated portfolio summary (all funds)
// ---------------------------------------------------------------------------

export async function getPortfolioSummary(): Promise<{
  totalNav: number;
  currency: string;
  funds: Array<{ id: string; name: string; nav: number; navPerShare?: number; holdingsCount?: number }>;
}> {
  const cacheKey = 'secura:portfolio-summary';
  const cached = getCached<ReturnType<typeof getPortfolioSummary> extends Promise<infer T> ? T : never>(cacheKey);
  if (cached) return cached;

  const funds = await getISECFunds();
  let totalNav = 0;
  const fundSummaries = funds.map((f) => {
    const nav = f.totalNav || 0;
    totalNav += nav;
    return {
      id: f.id,
      name: f.name,
      nav,
      navPerShare: f.navPerShare,
      holdingsCount: f.holdings?.length,
    };
  });

  const result = { totalNav, currency: 'SEK', funds: fundSummaries };
  setCache(cacheKey, result, NAV_CACHE_TTL_MS);
  return result;
}

// ---------------------------------------------------------------------------
// Chat-friendly text summaries
// ---------------------------------------------------------------------------

export async function getFundSummaryForChat(fundId?: string): Promise<string> {
  if (fundId) {
    const fund = await getISECFundWithHoldings(fundId);
    if (!fund) return 'Kunde inte hämta fonddata från SECURA.';

    const lines = [
      `## ${fund.name}`,
      `- ISIN: ${fund.isin || 'ej tillgängligt'}`,
      `- Valuta: ${fund.currency}`,
      fund.totalNav ? `- Totalt NAV: ${fund.totalNav.toLocaleString('sv-SE')} ${fund.currency}` : null,
      fund.navPerShare ? `- NAV per andel: ${fund.navPerShare.toLocaleString('sv-SE')} ${fund.currency}` : null,
      fund.navDate ? `- NAV-datum: ${fund.navDate}` : null,
    ].filter(Boolean);

    if (fund.holdings && fund.holdings.length > 0) {
      lines.push('', '### Innehav');
      const sorted = [...fund.holdings].sort((a, b) => (b.weight || b.marketValue) - (a.weight || a.marketValue));
      for (const h of sorted.slice(0, 20)) {
        const pct = h.weight ? ` (${(h.weight * 100).toFixed(1)}%)` : '';
        lines.push(`- ${h.name}: ${h.marketValue.toLocaleString('sv-SE')} ${h.currency}${pct}`);
      }
      if (sorted.length > 20) lines.push(`- ... och ${sorted.length - 20} till`);
    }

    return lines.join('\n');
  }

  const summary = await getPortfolioSummary();
  if (summary.funds.length === 0) return 'Ingen fonddata tillgänglig från SECURA.';

  const lines = [
    `## Fondöversikt (SECURA)`,
    `- Totalt NAV: ${summary.totalNav.toLocaleString('sv-SE')} ${summary.currency}`,
    `- Antal fonder: ${summary.funds.length}`,
    '',
    '### Fonder',
  ];

  for (const f of summary.funds) {
    lines.push(`- **${f.name}**: NAV ${f.nav.toLocaleString('sv-SE')} SEK${f.navPerShare ? `, NAV/andel ${f.navPerShare.toLocaleString('sv-SE')}` : ''}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// NAV Calculation data (for NAV engine integration)
// ---------------------------------------------------------------------------

export interface ISECNAVCalculationData {
  fundId: string;
  fundName: string;
  currency: string;
  shareClasses: Array<{
    id: string;
    name: string;
    isin: string;
    currency: string;
    managementFee: number;
    performanceFee?: number;
    navPerShare?: number;
    totalNav?: number;
    outstandingShares?: number;
  }>;
  positions: Array<{
    id: string;
    securityId: string;
    securityName: string;
    isin?: string;
    instrumentType: string;
    quantity: number;
    marketPrice: number;
    marketValue: number;
    currency: string;
    priceCurrency: string;
    priceDate?: string;
    priceSource?: string;
    accruedInterest?: number;
    sector?: string;
    country?: string;
  }>;
  cashBalances: Array<{
    accountId: string;
    bankName: string;
    currency: string;
    balance: number;
    valueDate?: string;
    accountType: string;
  }>;
  fxRates: Array<{
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    date: string;
    source: string;
  }>;
  accruedFees: Array<{
    feeType: string;
    annualRate: number;
    accruedAmount: number;
    periodStart?: string;
    periodEnd?: string;
    currency: string;
  }>;
  shareholders: Array<{
    id: string;
    name: string;
    type?: string;
    shareClassId?: string;
    shares: number;
    marketValue?: number;
    ownershipPercent?: number;
  }>;
  navDate: string;
}

/**
 * Fetch all data needed for NAV calculation from SECURA for a specific fund.
 *
 * Uses the real SECURA endpoints:
 * - /fund/list → fund info + share class info (share classes = non-main funds with MainFundID)
 * - /fund/navinformation → NAV details per share class (fees, outstanding units, AUM)
 * - /position/list → portfolio positions
 * - /portfolio/currencyaccountlist → cash accounts
 * - /portfolio/cashflowlist → cash balances
 * - /portfolio/feelist → fee models
 * - /fundcustomer/list → shareholders
 * - /fundnavprices/currency → FX rates used in NAV
 */
export async function getISECNAVCalculationData(
  fundId: string,
  navDate?: string
): Promise<ISECNAVCalculationData | null> {
  const cacheKey = `secura:nav-calc:${fundId}:${navDate || 'latest'}`;
  const cached = getCached<ISECNAVCalculationData>(cacheKey);
  if (cached) return cached;

  try {
    const fundIdNum = parseInt(fundId, 10);
    const today = navDate || new Date().toISOString().split('T')[0];

    // 1. Get fund info (includes share classes as separate funds with MainFundID)
    const fundRes = await securaClient.getFunds();
    if (!fundRes.ok || !Array.isArray(fundRes.data)) return null;

    const mainFund = fundRes.data.find(f => f.FundId === fundIdNum);
    if (!mainFund) return null;

    // Share classes are funds where MainFundID == our fund's FundId
    const shareClassFunds = mainFund.IsMainFund
      ? fundRes.data.filter(f => f.MainFundID === fundIdNum && f.FundId !== fundIdNum)
      : [];

    const portfolioId = mainFund.fundPortfolioId;

    // 2. Parallel fetch: NAV info, positions, cash, fees, customers, FX
    const promises = await Promise.allSettled([
      portfolioId > 0
        ? securaClient.getNavInformation(portfolioId, today)
        : Promise.resolve({ ok: false, status: 0, data: [] } as SecuraResponse<SecuraNavDetails[]>),
      portfolioId > 0
        ? securaClient.getPositions({ portfolioIds: [portfolioId], toDate: today })
        : Promise.resolve({ ok: false, status: 0, data: [] } as SecuraResponse<SecuraPosition[]>),
      portfolioId > 0
        ? securaClient.getCurrencyAccounts([portfolioId])
        : Promise.resolve({ ok: false, status: 0, data: [] } as SecuraResponse<SecuraCurrencyAccount[]>),
      portfolioId > 0
        ? securaClient.getCashFlows({ portfolioIds: [portfolioId], fromDate: today, toDate: today })
        : Promise.resolve({ ok: false, status: 0, data: [] } as SecuraResponse<unknown[]>),
      portfolioId > 0
        ? securaClient.getFees([portfolioId])
        : Promise.resolve({ ok: false, status: 0, data: [] } as SecuraResponse<SecuraFee[]>),
      securaClient.getFundCustomers(),
      portfolioId > 0
        ? securaClient.getNavPricesCurrency({ portfolioId, date: today })
        : Promise.resolve({ ok: false, status: 0, data: [] } as SecuraResponse<unknown[]>),
    ]);

    const navInfoData = promises[0].status === 'fulfilled' && promises[0].value.ok && Array.isArray(promises[0].value.data)
      ? promises[0].value.data as SecuraNavDetails[] : [];
    const positionsData = promises[1].status === 'fulfilled' && promises[1].value.ok && Array.isArray(promises[1].value.data)
      ? promises[1].value.data as SecuraPosition[] : [];
    const cashAccountsData = promises[2].status === 'fulfilled' && promises[2].value.ok && Array.isArray(promises[2].value.data)
      ? promises[2].value.data as SecuraCurrencyAccount[] : [];
    const cashFlowData = promises[3].status === 'fulfilled' && promises[3].value.ok && Array.isArray(promises[3].value.data)
      ? promises[3].value.data as Array<{ balance?: number; currencyaccountid?: number }> : [];
    const feesData = promises[4].status === 'fulfilled' && promises[4].value.ok && Array.isArray(promises[4].value.data)
      ? promises[4].value.data as SecuraFee[] : [];
    const customersData = promises[5].status === 'fulfilled' && promises[5].value.ok && Array.isArray(promises[5].value.data)
      ? promises[5].value.data as SecuraFundCustomer[] : [];
    const fxData = promises[6].status === 'fulfilled' && promises[6].value.ok && Array.isArray(promises[6].value.data)
      ? promises[6].value.data as Array<{ currencyId: number; price: number; priceTime?: string }> : [];

    // Map share classes: combine fund list data with NAV info
    const shareClasses = [mainFund, ...shareClassFunds].map(scFund => {
      const navInfo = navInfoData.find(n => n.portfolioId === scFund.fundPortfolioId);
      return {
        id: String(scFund.FundId),
        name: scFund.Name || '',
        isin: scFund.ISIN || '',
        currency: scFund.CurrencyCode || mainFund.CurrencyCode || 'SEK',
        managementFee: scFund.FixedFeePercentage ?? 0,
        performanceFee: scFund.PerformanceFeePercentage || undefined,
        navPerShare: navInfo?.NAV ?? (scFund.LatestNAVRate ? parseFloat(String(scFund.LatestNAVRate)) : undefined),
        totalNav: navInfo?.totalNAV,
        outstandingShares: navInfo?.outstandingUnits,
      };
    });

    // Map positions (only instrument positions, not cash/group totals)
    const positions = positionsData
      .filter(p => p.positionType === 'HTInstrument')
      .map(p => ({
        id: String(p.positionId),
        securityId: String(p.positionId),
        securityName: p.designation || '',
        instrumentType: 'other',
        quantity: p.quantity,
        marketPrice: p.localPrice || p.price || 0,
        marketValue: p.marketValue,
        currency: p.currency || mainFund.CurrencyCode || 'SEK',
        priceCurrency: p.currency || mainFund.CurrencyCode || 'SEK',
        priceDate: p.localPriceDate || today,
        priceSource: 'SECURA',
        accruedInterest: p.accruedInterest || 0,
      }));

    // Map cash balances from currency accounts + latest cash flow balance
    const cashBalances = cashAccountsData.map(ca => {
      const latestFlow = cashFlowData.find(cf => cf.currencyaccountid === ca.currencyaccountid);
      return {
        accountId: String(ca.currencyaccountid),
        bankName: ca.name || 'SECURA',
        currency: mainFund.CurrencyCode || 'SEK',
        balance: latestFlow?.balance ?? 0,
        accountType: ca.iscollateralaccount ? 'COLLATERAL' : 'CUSTODY',
      };
    });

    // Map FX rates
    const fxRates = fxData.map(fx => ({
      baseCurrency: mainFund.CurrencyCode || 'SEK',
      quoteCurrency: String(fx.currencyId),
      rate: fx.price,
      date: fx.priceTime || today,
      source: 'SECURA',
    }));

    // Map fees
    const accruedFees = feesData.map(f => {
      const navInfo = navInfoData[0];
      return {
        feeType: f.type || 'pftFixed',
        annualRate: f.value,
        accruedAmount: f.type?.includes('Fixed')
          ? (navInfo?.accruedFixedFee ?? 0)
          : (navInfo?.accruedPerformanceFee ?? 0),
        periodStart: f.startDate,
        periodEnd: f.stopDate,
        currency: mainFund.CurrencyCode || 'SEK',
      };
    });

    // If no explicit fee models but navInfo has accrued fees, create synthetic entries
    if (accruedFees.length === 0 && navInfoData.length > 0) {
      const ni = navInfoData[0];
      if (ni.accruedFixedFee) {
        accruedFees.push({
          feeType: 'management',
          annualRate: ni.adminFeePct || mainFund.FixedFeePercentage || 0,
          accruedAmount: ni.accruedFixedFee,
          periodStart: today,
          periodEnd: today,
          currency: mainFund.CurrencyCode || 'SEK',
        });
      }
      if (ni.accruedPerformanceFee) {
        accruedFees.push({
          feeType: 'performance',
          annualRate: mainFund.PerformanceFeePercentage || 0,
          accruedAmount: ni.accruedPerformanceFee,
          periodStart: today,
          periodEnd: today,
          currency: mainFund.CurrencyCode || 'SEK',
        });
      }
    }

    // Map shareholders
    const shareholders = customersData.map(c => ({
      id: String(c.customerId),
      name: c.name || '',
      type: c.customerType,
    })) as ISECNAVCalculationData['shareholders'];

    const result: ISECNAVCalculationData = {
      fundId: String(mainFund.FundId),
      fundName: mainFund.Name || '',
      currency: mainFund.CurrencyCode || 'SEK',
      navDate: today,
      shareClasses,
      positions,
      cashBalances,
      fxRates,
      accruedFees,
      shareholders,
    };

    setCache(cacheKey, result, CACHE_TTL_MS);
    return result;
  } catch (err) {
    console.error(`[SECURA DataService] Failed to fetch NAV calc data for ${fundId}:`, err);
    return null;
  }
}

/**
 * Fetch NAV calculation data for ALL funds from SECURA.
 */
export async function getAllISECNAVData(): Promise<ISECNAVCalculationData[]> {
  const funds = await getISECFunds();
  // Main funds = IsMainFund==true OR standalone funds (no parent, MainFundID==-1)
  const mainFunds = funds.filter(f => f.isMainFund === true || !f.mainFundId);
  if (mainFunds.length === 0) return [];

  const results = await Promise.allSettled(
    mainFunds.map(f => getISECNAVCalculationData(f.id))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ISECNAVCalculationData | null> =>
      r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);
}

/**
 * Get shareholders for a fund from SECURA.
 */
export async function getISECShareholders(
  _fundId: string,
  _shareClassId?: string
): Promise<ISECNAVCalculationData['shareholders']> {
  const cacheKey = `secura:shareholders:all`;
  const cached = getCached<ISECNAVCalculationData['shareholders']>(cacheKey);
  if (cached) return cached;

  try {
    const res = await securaClient.getFundCustomers({ excludeClosed: true });
    if (!res.ok || !Array.isArray(res.data)) return [];

    const result = res.data.map((c: SecuraFundCustomer) => ({
      id: String(c.customerId),
      name: c.name || '',
      type: c.customerType,
      shares: 0,
    }));

    setCache(cacheKey, result, CACHE_TTL_MS);
    return result;
  } catch {
    return [];
  }
}

export function clearISECCache() {
  cache.clear();
  _securaAvailable = null;
  _availableCheckedAt = 0;
}

// ---------------------------------------------------------------------------
// Fund Registry sync from SECURA
// ---------------------------------------------------------------------------

export interface SyncResult {
  fundsCreated: number;
  fundsUpdated: number;
  shareClassesCreated: number;
  navRecordsSet: number;
  positionsSynced: number;
  cashBalancesSynced: number;
  errors: string[];
}

type CurrencyType = 'SEK' | 'EUR' | 'USD' | 'NOK' | 'DKK' | 'GBP' | 'CHF' | 'JPY';
const VALID_CURRENCIES = new Set(['SEK', 'EUR', 'USD', 'NOK', 'DKK', 'GBP', 'CHF', 'JPY']);
function toCurrency(code: string | undefined): CurrencyType {
  const c = (code || 'SEK').toUpperCase();
  return (VALID_CURRENCIES.has(c) ? c : 'SEK') as CurrencyType;
}

/**
 * Full sync: Fund Registry ← SECURA.
 *
 * 1. Creates/updates funds + share classes
 * 2. Fetches NAV information (totalNAV, outstandingUnits) per share class
 * 3. Syncs positions from portfolio
 * 4. Syncs cash balances from currency accounts
 */
export async function syncFundRegistryFromISEC(): Promise<SyncResult> {
  const { getFundRegistry } = await import('@/lib/fund-registry');
  const registry = getFundRegistry();

  const result: SyncResult = {
    fundsCreated: 0, fundsUpdated: 0,
    shareClassesCreated: 0, navRecordsSet: 0,
    positionsSynced: 0, cashBalancesSynced: 0,
    errors: [],
  };

  try {
    const fundRes = await securaClient.getFunds();
    if (!fundRes.ok || !Array.isArray(fundRes.data)) {
      result.errors.push('Failed to fetch funds from SECURA');
      return result;
    }

    const allFunds = fundRes.data;
    const mainFunds = allFunds.filter(f => f.IsMainFund || f.MainFundID <= 0);
    const existingFunds = await registry.listFunds();
    const today = new Date().toISOString().split('T')[0];

    for (const sf of mainFunds) {
      try {
        const alreadyExists = existingFunds.find(f => f.isin === sf.ISIN || f.name === sf.Name);
        let fundId: string;

        if (alreadyExists) {
          fundId = alreadyExists.id;
          result.fundsUpdated++;
        } else {
          const created = await registry.createFund({
            name: sf.Name || `Fund ${sf.FundId}`,
            legalName: sf.Name || '',
            isin: sf.ISIN || '',
            currency: toCurrency(sf.CurrencyCode),
            status: sf.Active ? 'active' : 'closed',
            type: 'other',
            ucits: true,
            aifmd: false,
            countryOfDomicile: 'SE',
            inceptionDate: '',
            fiscalYearEnd: '12-31',
          });
          fundId = created.id;
          result.fundsCreated++;
        }

        // ---------- NAV information from SECURA ----------
        let navInfoMap = new Map<number, SecuraNavDetails>();
        const portfolioId = sf.fundPortfolioId;
        if (portfolioId > 0) {
          try {
            const navInfoRes = await securaClient.getNavInformation(portfolioId, today);
            if (navInfoRes.ok && Array.isArray(navInfoRes.data)) {
              for (const ni of navInfoRes.data) {
                navInfoMap.set(ni.portfolioId, ni);
              }
            }
          } catch { /* nav info optional */ }
        }

        // ---------- Share classes ----------
        const shareClassFunds = allFunds.filter(f => f.MainFundID === sf.FundId && f.FundId !== sf.FundId);
        const scFunds = shareClassFunds.length > 0 ? shareClassFunds : [sf];

        for (const scf of scFunds) {
          try {
            const existingSCs = await registry.listShareClasses(fundId);
            const scExists = existingSCs.find(s => s.isin === scf.ISIN || s.name === (scf.Name || 'A'));

            let scId: string;
            if (scExists) {
              scId = scExists.id;
            } else {
              const createdSC = await registry.createShareClass({
                fundId,
                name: scf.Name || 'A',
                isin: scf.ISIN || '',
                currency: toCurrency(scf.CurrencyCode),
                status: scf.Active ? 'active' : 'hard_closed',
                managementFee: scf.FixedFeePercentage || 0,
                performanceFee: scf.PerformanceFeePercentage || undefined,
                entryFee: scf.buyFeePercentage || undefined,
                exitFee: scf.sellFeePercentage || undefined,
                distributionPolicy: 'accumulating',
              });
              scId = createdSC.id;
              result.shareClassesCreated++;
            }

            // --- NAV record with real totalNAV + outstandingUnits ---
            const navRate = typeof scf.LatestNAVRate === 'number'
              ? scf.LatestNAVRate
              : parseFloat(String(scf.LatestNAVRate));
            const navDate = scf.LatestNAVDate || today;

            if (navRate && !isNaN(navRate)) {
              const navInfo = navInfoMap.get(scf.fundPortfolioId);
              try {
                await registry.setNAV({
                  fundId,
                  shareClassId: scId,
                  date: navDate,
                  navPerShare: navRate,
                  totalNetAssets: navInfo?.totalNAV ?? 0,
                  shareClassNetAssets: navInfo?.totalNAV
                    ? navInfo.totalNAV * (navInfo.shareClassShareOfFund ?? 1)
                    : 0,
                  outstandingShares: navInfo?.outstandingUnits ?? 0,
                  source: 'external_provider',
                  status: 'published',
                });
                result.navRecordsSet++;
              } catch { /* NAV record may already exist */ }
            }
          } catch (scErr) {
            result.errors.push(`ShareClass ${scf.Name}: ${scErr instanceof Error ? scErr.message : 'unknown'}`);
          }
        }

        // ---------- Positions ----------
        if (portfolioId > 0) {
          try {
            const posRes = await securaClient.getPositions({ portfolioIds: [portfolioId], toDate: today });
            if (posRes.ok && Array.isArray(posRes.data)) {
              const instrumentPositions = posRes.data.filter((p: SecuraPosition) => p.positionType === 'HTInstrument');
              if (instrumentPositions.length > 0) {
                await registry.clearPositions(fundId, today);
                const mapped = instrumentPositions.map((p: SecuraPosition) => ({
                  fundId,
                  date: today,
                  instrumentId: String(p.positionId),
                  instrumentName: p.designation || '',
                  instrumentType: 'other' as const,
                  isin: undefined,
                  quantity: p.quantity,
                  currency: toCurrency(p.currency || sf.CurrencyCode),
                  marketPrice: p.localPrice || p.price || 0,
                  marketValue: p.marketValue,
                  marketValueBase: p.marketValue,
                  portfolioWeight: p.shareOfPortfolio,
                  source: 'custodian' as const,
                  priceSource: 'SECURA',
                }));
                await registry.setPositions(fundId, today, mapped);
                result.positionsSynced += mapped.length;
              }
            }
          } catch (posErr) {
            result.errors.push(`Positions ${sf.Name}: ${posErr instanceof Error ? posErr.message : 'unknown'}`);
          }

          // ---------- Cash balances (via cashflows – last entry per account has running balance) ----------
          try {
            const cashFlowRes = await securaClient.getCashFlows({
              portfolioIds: [portfolioId],
              fromDate: '2020-01-01',
              toDate: today,
            });
            if (cashFlowRes.ok && Array.isArray(cashFlowRes.data) && cashFlowRes.data.length > 0) {
              await registry.clearCashBalances(fundId, today);
              // Group by currency account, take last entry (has latest balance)
              const byAccount = new Map<number, { balance: number; accountId: number }>();
              for (const cf of cashFlowRes.data) {
                byAccount.set(cf.currencyaccountid, { balance: cf.balance, accountId: cf.currencyaccountid });
              }
              for (const [, entry] of byAccount) {
                const cur = toCurrency(sf.CurrencyCode);
                await registry.setCashBalance({
                  fundId,
                  date: today,
                  currency: cur,
                  balance: entry.balance,
                  balanceBase: entry.balance,
                  availableBalance: entry.balance,
                  pendingInflows: 0,
                  pendingOutflows: 0,
                  reservedAmount: 0,
                  bankAccountId: String(entry.accountId),
                  bankName: 'SECURA',
                  source: 'custodian' as const,
                });
                result.cashBalancesSynced++;
              }
            }
          } catch (cashErr) {
            result.errors.push(`Cash ${sf.Name}: ${cashErr instanceof Error ? cashErr.message : 'unknown'}`);
          }
        }

      } catch (fundErr) {
        result.errors.push(`Fund ${sf.Name}: ${fundErr instanceof Error ? fundErr.message : 'unknown'}`);
      }
    }
  } catch (err) {
    result.errors.push(`Sync failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return result;
}
