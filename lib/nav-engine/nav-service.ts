/**
 * NAV Service
 *
 * Huvudservice för automatiserad NAV-beräkning.
 * Hämtar data från Fund Registry, PriceProvider och CurrencyService.
 */

import { getFundRegistry, type FundRegistry } from '../fund-registry';
import type {
  Fund as RegistryFund,
  ShareClass as RegistryShareClass,
  Position as RegistryPosition,
  CashBalance as RegistryCashBalance,
} from '../fund-registry/types';
import { getExchangeRate, type Currency } from '../accounting/services/currencyService';
import { getPriceDataProviderManager } from '../integrations/pricing/price-provider';
import { NAVCalculator, createNAVCalculator } from './nav-calculator';
import {
  NAVCalculationInput,
  NAVCalculationResult,
  NAVRun,
  NAVComparison,
  PositionValuation,
  CashBalance,
  Receivable,
  Liability,
  AccruedFee,
  PendingRedemption,
  FXRate,
  FundConfig,
} from './types';

// ============================================================================
// NAV Service Class
// ============================================================================

export class NAVService {
  private registry: FundRegistry;
  private calculator: NAVCalculator;
  private fundConfigs: Map<string, FundConfig> = new Map();

  constructor(registry?: FundRegistry) {
    this.registry = registry || getFundRegistry();
    this.calculator = createNAVCalculator();
  }

  // ==========================================================================
  // Main NAV Calculation Methods
  // ==========================================================================

  /**
   * Calculate NAV for a single fund/share class
   */
  async calculateNAV(
    fundId: string,
    shareClassId: string,
    navDate: string = new Date().toISOString().split('T')[0]
  ): Promise<NAVCalculationResult> {
    console.log(`[NAV Service] Calculating NAV for ${fundId}/${shareClassId} on ${navDate}`);

    // 1. Fetch fund from registry
    const fund = await this.registry.getFund(fundId);
    if (!fund) throw new Error(`Fund ${fundId} not found in Fund Registry`);

    // 2. Find share class
    const shareClasses = await this.registry.listShareClasses(fundId);
    const shareClass = shareClasses.find(sc => sc.id === shareClassId);
    if (!shareClass) throw new Error(`Share class ${shareClassId} not found for fund ${fundId}`);

    // 3. Fetch positions from registry
    const positions = await this.registry.getPositions(fundId, navDate);

    // 4. Fetch cash balances from registry
    const cashBalances = await this.registry.getCashBalances(fundId, navDate);

    // 5. Enrich positions with latest prices from PriceProvider (if market prices are stale)
    const enrichedPositions = await this.enrichPositionsWithPrices(positions, navDate);

    // 6. Collect all currencies for FX
    const currencies = this.extractCurrencies(enrichedPositions, cashBalances, fund.currency);

    // 7. Fetch FX rates from Riksbanken/ECB via CurrencyService
    const fxRates = await this.fetchFXRates(fund.currency, currencies, navDate);

    // 8. Get fund configuration
    const fundConfig = this.buildFundConfig(fund, shareClasses);

    // 9. Get shares outstanding from latest NAV record or holdings
    const sharesOutstanding = await this.getSharesOutstanding(fundId, shareClassId, navDate);

    // 10. Get pending transactions (redemptions)
    const pendingRedemptions = await this.getPendingRedemptions(fundId, shareClassId);

    // 11. Build calculation input
    const input = this.buildCalculationInput(
      fundId,
      shareClassId,
      navDate,
      fund,
      shareClass,
      enrichedPositions,
      cashBalances,
      fxRates,
      fundConfig,
      sharesOutstanding,
      pendingRedemptions
    );

    // 12. Previous day NAV for change warning
    let previousNavPerShare: number | undefined;
    try {
      const navDateObj = new Date(navDate + 'T12:00:00Z');
      navDateObj.setUTCDate(navDateObj.getUTCDate() - 1);
      const prevDateStr = navDateObj.toISOString().slice(0, 10);
      const prevNav = await this.registry.getNAV(shareClassId, prevDateStr);
      if (prevNav && typeof prevNav.navPerShare === 'number') {
        previousNavPerShare = prevNav.navPerShare;
      }
    } catch {
      // No previous NAV available
    }

    let changeWarningThresholdPercent = typeof process.env.NAV_CHANGE_WARNING_THRESHOLD_PERCENT !== 'undefined'
      ? Number(process.env.NAV_CHANGE_WARNING_THRESHOLD_PERCENT)
      : 5;
    if (Number.isNaN(changeWarningThresholdPercent) || changeWarningThresholdPercent <= 0) {
      changeWarningThresholdPercent = 5;
    }

    // 13. Calculate NAV
    const result = this.calculator.calculate(input, {
      previousNavPerShare,
      changeWarningThresholdPercent,
    });

    console.log(`[NAV Service] NAV calculated: ${result.navPerShare.toFixed(4)} (status: ${result.status})`);

    // 14. Save result to Fund Registry
    try {
      await this.registry.setNAV({
        fundId,
        shareClassId,
        date: navDate,
        navPerShare: result.navPerShare,
        totalNetAssets: result.netAssetValue,
        shareClassNetAssets: result.netAssetValue,
        outstandingShares: result.sharesOutstanding,
        source: 'calculated',
        status: 'draft',
      });
    } catch (err) {
      console.warn('[NAV Service] Failed to save NAV to registry:', err);
    }

    return result;
  }

  /**
   * Run daily NAV calculation for all funds
   */
  async runDailyNAV(navDate: string = new Date().toISOString().split('T')[0]): Promise<NAVRun> {
    const runId = `NAV-${navDate}-${Date.now()}`;
    console.log(`[NAV Service] Starting daily NAV run: ${runId}`);

    const run: NAVRun = {
      runId,
      navDate,
      startedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      fundResults: new Map(),
      totalFunds: 0,
      completedFunds: 0,
      failedFunds: 0,
      errors: [],
    };

    try {
      // 1. Get all active funds from registry
      const funds = await this.registry.listFunds();
      const activeFunds = funds.filter(f => f.status === 'active');
      run.totalFunds = activeFunds.length;

      console.log(`[NAV Service] Processing ${activeFunds.length} active funds`);

      // 2. Calculate NAV for each fund/share class
      for (const fund of activeFunds) {
        const shareClasses = await this.registry.listShareClasses(fund.id);
        const activeClasses = shareClasses.filter(sc => sc.status === 'active');

        for (const sc of activeClasses) {
          try {
            const result = await this.calculateNAV(fund.id, sc.id, navDate);
            const key = `${fund.id}/${sc.id}`;
            run.fundResults.set(key, result);
            run.completedFunds++;
          } catch (error) {
            run.failedFunds++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            run.errors.push(`${fund.id}/${sc.id}: ${errorMsg}`);
            console.error(`[NAV Service] Error calculating NAV for ${fund.id}/${sc.id}:`, error);
          }
        }
      }

      // 3. Determine final status
      run.status = run.failedFunds > 0 ? 'FAILED' : 'AWAITING_APPROVAL';
      run.completedAt = new Date().toISOString();

      console.log(`[NAV Service] NAV run completed: ${run.completedFunds}/${run.totalFunds} successful`);
    } catch (error) {
      run.status = 'FAILED';
      run.completedAt = new Date().toISOString();
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      run.errors.push(`Fatal error: ${errorMsg}`);
      console.error('[NAV Service] Fatal error in daily NAV run:', error);
    }

    return run;
  }

  /**
   * Verify NAV against a reference (e.g. previous NAV from Fund Registry)
   */
  async verifyNAV(
    fundId: string,
    shareClassId: string,
    navDate: string,
    tolerancePercent: number = 0.01
  ): Promise<NAVComparison> {
    const calculated = await this.calculateNAV(fundId, shareClassId, navDate);

    // Compare with previous NAV from Fund Registry
    const refNav = await this.registry.getNAV(shareClassId, navDate);

    const comparison: NAVComparison = {
      navDate,
      fundId,
      shareClassId,
      calculated,
      toleranceThreshold: tolerancePercent,
    };

    if (refNav) {
      const navDiff = calculated.navPerShare - refNav.navPerShare;
      const navDiffPercent = refNav.navPerShare > 0
        ? (navDiff / refNav.navPerShare) * 100
        : 0;
      const totalDiff = calculated.netAssetValue - refNav.totalNetAssets;
      const totalDiffPercent = refNav.totalNetAssets > 0
        ? (totalDiff / refNav.totalNetAssets) * 100
        : 0;

      comparison.reference = {
        source: 'FUND_REGISTRY',
        navPerShare: refNav.navPerShare,
        netAssetValue: refNav.totalNetAssets,
        timestamp: refNav.updatedAt,
      };
      comparison.difference = {
        navPerShare: navDiff,
        navPerSharePercent: navDiffPercent,
        netAssetValue: totalDiff,
        netAssetValuePercent: totalDiffPercent,
        withinTolerance: Math.abs(navDiffPercent) <= tolerancePercent,
      };
    }

    return comparison;
  }

  // ==========================================================================
  // Data Enrichment
  // ==========================================================================

  /**
   * Enrich positions with latest prices from PriceProvider if needed.
   */
  private async enrichPositionsWithPrices(
    positions: RegistryPosition[],
    navDate: string
  ): Promise<RegistryPosition[]> {
    if (positions.length === 0) return positions;

    const priceManager = getPriceDataProviderManager();
    const provider = priceManager.getActiveProvider();

    // Only enrich if provider supports instrument-level pricing
    if (!provider.getInstrumentPrice) return positions;

    const enriched: RegistryPosition[] = [];
    for (const pos of positions) {
      const isin = pos.isin ?? pos.instrumentId;
      try {
        const latestPrice = await provider.getInstrumentPrice!(isin, navDate);
        enriched.push({
          ...pos,
          marketPrice: latestPrice.price,
          marketValue: pos.quantity * latestPrice.price,
          priceSource: latestPrice.source,
        });
      } catch {
        // Keep original position data if price fetch fails
        enriched.push(pos);
      }
    }
    return enriched;
  }

  // ==========================================================================
  // FX Rates
  // ==========================================================================

  private async fetchFXRates(
    fundCurrency: string,
    currencies: string[],
    navDate: string
  ): Promise<FXRate[]> {
    const rates: FXRate[] = [];

    for (const currency of currencies) {
      if (currency === fundCurrency) continue;
      try {
        const rate = await getExchangeRate(
          currency as Currency,
          fundCurrency as Currency,
          navDate
        );
        rates.push({
          baseCurrency: currency,
          quoteCurrency: fundCurrency,
          rate: rate.rate,
          rateDate: rate.date,
          source: rate.source,
        });
      } catch (err) {
        console.warn(`[NAV Service] FX rate fetch failed for ${currency}/${fundCurrency}:`, err);
      }
    }

    return rates;
  }

  // ==========================================================================
  // Data Transformation
  // ==========================================================================

  private buildCalculationInput(
    fundId: string,
    shareClassId: string,
    navDate: string,
    fund: RegistryFund,
    shareClass: RegistryShareClass,
    positions: RegistryPosition[],
    cashBalances: RegistryCashBalance[],
    fxRates: FXRate[],
    fundConfig: FundConfig,
    sharesOutstanding: number,
    pendingRedemptions: PendingRedemption[]
  ): NAVCalculationInput {
    // Build FX rate lookup for conversion
    const fxLookup = new Map<string, number>();
    for (const r of fxRates) {
      fxLookup.set(r.baseCurrency, r.rate);
    }
    const getRate = (currency: string) => {
      if (currency === fund.currency) return 1;
      return fxLookup.get(currency) ?? 1;
    };

    // Transform positions
    const positionValuations: PositionValuation[] = positions.map(p => {
      const fxRate = getRate(p.currency);
      return {
        positionId: p.id,
        securityId: p.instrumentId,
        isin: p.isin ?? p.instrumentId,
        name: p.instrumentName,
        securityType: this.mapInstrumentType(p.instrumentType),
        quantity: p.quantity,
        price: p.marketPrice,
        priceCurrency: p.currency,
        priceDate: p.date,
        priceSource: p.priceSource ?? p.source,
        marketValue: p.marketValue,
        marketValueFundCurrency: p.marketValueBase ?? p.marketValue * fxRate,
        fxRate,
        assetClass: this.mapToAssetClass(p.instrumentType),
        country: undefined,
        sector: undefined,
      };
    });

    // Transform cash balances
    const navCashBalances: CashBalance[] = cashBalances.map(c => ({
      accountId: c.bankAccountId ?? c.id,
      accountName: c.bankName ?? 'Cash',
      bankName: c.bankName ?? '',
      currency: c.currency,
      balance: c.balance,
      balanceFundCurrency: c.balanceBase ?? c.balance * getRate(c.currency),
      valueDate: c.date,
      accountType: 'CUSTODY' as const,
    }));

    // Build accrued fees
    const aum = positionValuations.reduce((s, p) => s + p.marketValueFundCurrency, 0)
      + navCashBalances.reduce((s, c) => s + c.balanceFundCurrency, 0);

    const accruedFees = this.calculateAccruedFees(fundConfig, aum, navDate);

    return {
      fundId,
      shareClassId,
      navDate,
      positions: positionValuations,
      cashBalances: navCashBalances,
      receivables: [],
      liabilities: [],
      accruedFees,
      pendingRedemptions,
      sharesOutstanding,
      fxRates,
      fundCurrency: fund.currency,
      managementFeeRate: shareClass.managementFee ?? fundConfig.managementFeeRate,
      performanceFeeRate: shareClass.performanceFee,
    };
  }

  private calculateAccruedFees(
    fundConfig: FundConfig,
    aum: number,
    navDate: string
  ): AccruedFee[] {
    const fees: AccruedFee[] = [];
    const today = new Date(navDate);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const addFee = (type: AccruedFee['feeType'], rate: number) => {
      if (rate <= 0) return;
      const daily = (aum * rate) / 365;
      fees.push({
        feeType: type,
        periodStart: monthStart.toISOString().split('T')[0],
        periodEnd: navDate,
        annualRate: rate,
        baseAmount: aum,
        accruedAmount: daily * daysInMonth,
        currency: fundConfig.currency,
      });
    };

    addFee('MANAGEMENT_FEE', fundConfig.managementFeeRate);
    addFee('DEPOSITARY_FEE', fundConfig.depositaryFeeRate);
    addFee('ADMIN_FEE', fundConfig.adminFeeRate);

    return fees;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async getSharesOutstanding(
    fundId: string,
    shareClassId: string,
    navDate: string
  ): Promise<number> {
    // Try latest NAV record
    const latestNav = await this.registry.getNAV(shareClassId);
    if (latestNav && latestNav.outstandingShares > 0) {
      return latestNav.outstandingShares;
    }

    // Try holdings
    try {
      const holdings = await this.registry.getHoldings(fundId, shareClassId);
      const totalShares = holdings.reduce((s, h) => s + h.shares, 0);
      if (totalShares > 0) return totalShares;
    } catch {
      // ignore
    }

    // Fallback
    return 1_000_000;
  }

  private async getPendingRedemptions(
    fundId: string,
    shareClassId: string
  ): Promise<PendingRedemption[]> {
    try {
      const txs = await this.registry.listTransactions(fundId, {
        shareClassId,
        type: 'redemption',
        status: 'pending',
      });
      return txs.map(tx => ({
        orderId: tx.id,
        shareholderId: tx.investorId,
        shares: tx.shares,
        estimatedAmount: tx.amount,
        valueDate: tx.valueDate ?? tx.settlementDate,
        status: 'PENDING' as const,
      }));
    } catch {
      return [];
    }
  }

  private extractCurrencies(
    positions: RegistryPosition[],
    cash: RegistryCashBalance[],
    fundCurrency: string
  ): string[] {
    const currencies = new Set<string>();
    positions.forEach(p => currencies.add(p.currency));
    cash.forEach(c => currencies.add(c.currency));
    currencies.delete(fundCurrency);
    return Array.from(currencies);
  }

  private buildFundConfig(fund: RegistryFund, shareClasses: RegistryShareClass[]): FundConfig {
    const cached = this.fundConfigs.get(fund.id);
    if (cached) return cached;

    const config: FundConfig = {
      fundId: fund.id,
      fundCode: fund.shortName ?? fund.name,
      name: fund.name,
      currency: fund.currency,
      fundType: fund.ucits ? 'UCITS' : 'AIF',
      managementFeeRate: shareClasses[0]?.managementFee ?? 0.015,
      depositaryFeeRate: 0.0005,
      adminFeeRate: 0.001,
      pricingPolicy: {
        equityPriceType: 'CLOSE',
        bondPriceType: 'BID',
        derivativePriceType: 'MARK_TO_MARKET',
        fxRateTime: 'CLOSE',
        fxRateSource: 'RIKSBANKEN',
      },
      accrualRules: {
        feeAccrualBasis: 'DAILY',
        dividendAccrualPolicy: 'EX_DATE',
        interestAccrualMethod: 'ACT_365',
      },
      shareClasses: shareClasses.map(sc => ({
        shareClassId: sc.id,
        shareClassCode: sc.name,
        name: sc.name,
        isin: sc.isin,
        currency: sc.currency,
        hedged: false,
        managementFeeRate: sc.managementFee,
        performanceFeeRate: sc.performanceFee,
        distributionPolicy: sc.distributionPolicy === 'distributing' ? 'DIST' : 'ACC',
      })),
    };

    this.fundConfigs.set(fund.id, config);
    return config;
  }

  private mapInstrumentType(type: string): PositionValuation['securityType'] {
    const map: Record<string, PositionValuation['securityType']> = {
      equity: 'EQUITY',
      bond: 'BOND',
      etf: 'ETF',
      fund: 'FUND',
      derivative: 'DERIVATIVE',
      fx_forward: 'FX_FORWARD',
      cash: 'CASH',
      other: 'OTHER',
    };
    return map[type] ?? 'OTHER';
  }

  private mapToAssetClass(type: string): PositionValuation['assetClass'] {
    const map: Record<string, PositionValuation['assetClass']> = {
      equity: 'EQUITIES',
      etf: 'EQUITIES',
      bond: 'FIXED_INCOME',
      fund: 'FUNDS',
      derivative: 'DERIVATIVES',
      fx_forward: 'DERIVATIVES',
      cash: 'CASH',
      other: 'OTHER',
    };
    return map[type] ?? 'OTHER';
  }

  /**
   * Set custom fund configuration
   */
  setFundConfig(config: FundConfig): void {
    this.fundConfigs.set(config.fundId, config);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let serviceInstance: NAVService | null = null;

export function getNAVService(): NAVService {
  if (!serviceInstance) {
    serviceInstance = new NAVService();
  }
  return serviceInstance;
}

export function createNAVService(registry?: FundRegistry): NAVService {
  return new NAVService(registry);
}
