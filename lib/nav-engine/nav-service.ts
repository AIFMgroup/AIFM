/**
 * NAV Service
 * 
 * Huvudservice för automatiserad NAV-beräkning
 * Integrerar SECURA API med beräkningsmotorn
 */

import { SecuraClient, getSecuraClientFromEnv } from '../integrations/secura/secura-client';
import {
  SecuraFund,
  SecuraPosition,
  SecuraCashSummary,
  SecuraNAV,
  SecuraFXRate,
  SecuraSubscriptionOrder,
} from '../integrations/secura/types';
import { NAVCalculator, createNAVCalculator, isNAVWithinTolerance } from './nav-calculator';
import {
  NAVCalculationInput,
  NAVCalculationResult,
  NAVRun,
  NAVRunStatus,
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
  private securaClient: SecuraClient;
  private calculator: NAVCalculator;
  private fundConfigs: Map<string, FundConfig> = new Map();

  constructor(securaClient?: SecuraClient) {
    this.securaClient = securaClient || getSecuraClientFromEnv();
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

    // 1. Fetch all data from SECURA
    const data = await this.securaClient.getNAVCalculationData(fundId, navDate);
    
    // 2. Fetch FX rates
    const currencies = this.extractCurrencies(data.positions, data.cash);
    const fxRates = await this.securaClient.getFXRates(
      data.fund.currency,
      currencies,
      navDate
    );

    // 3. Get fund configuration
    const fundConfig = this.getFundConfig(data.fund);

    // 4. Find the specific share class
    const shareClass = data.fund.shareClasses.find(sc => sc.shareClassId === shareClassId);
    if (!shareClass) {
      throw new Error(`Share class ${shareClassId} not found in fund ${fundId}`);
    }

    // 5. Transform SECURA data to calculator input
    const input = this.buildCalculationInput(
      fundId,
      shareClassId,
      navDate,
      data.fund,
      shareClass,
      data.positions,
      data.cash,
      data.pendingOrders,
      fxRates,
      fundConfig
    );

    // 6. Calculate NAV
    const result = this.calculator.calculate(input);

    // 7. Compare with SECURA's NAV if available
    if (data.currentNav) {
      const comparison = this.compareWithSecura(result, data.currentNav);
      if (!comparison.difference?.withinTolerance) {
        result.warnings.push({
          code: 'NAV_DEVIATION',
          severity: 'WARNING',
          message: `NAV avviker från SECURA med ${comparison.difference?.navPerSharePercent.toFixed(4)}%`,
          details: {
            calculated: result.navPerShare,
            secura: data.currentNav.navPerShare,
            difference: comparison.difference?.navPerShare,
          },
        });
      }
    }

    console.log(`[NAV Service] NAV calculated: ${result.navPerShare.toFixed(4)} (status: ${result.status})`);

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
      // 1. Get all active funds
      const funds = await this.securaClient.getFunds();
      const activeFunds = funds.filter(f => f.status === 'ACTIVE');
      run.totalFunds = activeFunds.length;

      console.log(`[NAV Service] Processing ${activeFunds.length} active funds`);

      // 2. Calculate NAV for each fund/share class
      for (const fund of activeFunds) {
        for (const shareClass of fund.shareClasses.filter(sc => sc.status === 'ACTIVE')) {
          try {
            const result = await this.calculateNAV(fund.fundId, shareClass.shareClassId, navDate);
            const key = `${fund.fundId}/${shareClass.shareClassId}`;
            run.fundResults.set(key, result);
            run.completedFunds++;
          } catch (error) {
            run.failedFunds++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            run.errors.push(`${fund.fundId}/${shareClass.shareClassId}: ${errorMsg}`);
            console.error(`[NAV Service] Error calculating NAV for ${fund.fundId}/${shareClass.shareClassId}:`, error);
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
   * Verify NAV against SECURA
   */
  async verifyNAV(
    fundId: string,
    shareClassId: string,
    navDate: string,
    tolerancePercent: number = 0.01
  ): Promise<NAVComparison> {
    // Calculate our NAV
    const calculated = await this.calculateNAV(fundId, shareClassId, navDate);

    // Get SECURA's NAV
    const securaNav = await this.securaClient.getNAV(fundId, shareClassId);

    return this.compareWithSecura(calculated, securaNav, tolerancePercent);
  }

  // ==========================================================================
  // Data Transformation
  // ==========================================================================

  private buildCalculationInput(
    fundId: string,
    shareClassId: string,
    navDate: string,
    fund: SecuraFund,
    shareClass: { shareClassId: string; currency: string; managementFee: number },
    positions: SecuraPosition[],
    cash: SecuraCashSummary,
    pendingOrders: SecuraSubscriptionOrder[],
    fxRates: SecuraFXRate[],
    fundConfig: FundConfig
  ): NAVCalculationInput {
    // Transform positions
    const positionValuations: PositionValuation[] = positions.map(p => ({
      positionId: p.positionId,
      securityId: p.securityId,
      isin: p.isin,
      name: p.securityName,
      securityType: p.securityType as PositionValuation['securityType'],
      quantity: p.quantity,
      nominalValue: p.nominalValue,
      price: p.price,
      priceCurrency: p.priceCurrency,
      priceDate: p.priceDate,
      priceSource: p.priceSource,
      marketValue: p.marketValue,
      marketValueFundCurrency: p.marketValueFundCurrency,
      accruedInterest: p.accruedInterest,
      accruedDividend: p.accruedDividend,
      assetClass: this.mapToAssetClass(p.securityType),
      country: p.country,
      sector: p.sector,
    }));

    // Transform cash balances
    const cashBalances: CashBalance[] = cash.accounts.map(a => ({
      accountId: a.accountId,
      accountName: a.accountName,
      bankName: a.bankName,
      currency: a.currency,
      balance: a.balance,
      balanceFundCurrency: a.balanceFundCurrency,
      valueDate: a.valueDate,
      accountType: a.accountType,
    }));

    // Transform pending redemptions
    const pendingRedemptions: PendingRedemption[] = pendingOrders
      .filter(o => o.orderType === 'REDEMPTION' && o.status === 'PENDING')
      .map(o => ({
        orderId: o.orderId,
        shareholderId: o.shareholderId,
        shares: o.shares || 0,
        estimatedAmount: o.settledAmount || (o.shares || 0) * 100, // Placeholder
        valueDate: o.valueDate,
        status: 'PENDING',
      }));

    // Transform FX rates
    const fxRateInputs: FXRate[] = fxRates.map(r => ({
      baseCurrency: r.baseCurrency,
      quoteCurrency: r.quoteCurrency,
      rate: r.rate,
      rateDate: r.rateDate,
      source: r.source,
    }));

    // Calculate shares outstanding
    // This would typically come from SECURA's shareholder data
    const sharesOutstanding = 1000000; // Placeholder - should fetch from SECURA

    // Build accrued fees
    const accruedFees: AccruedFee[] = this.calculateAccruedFees(
      fundConfig,
      positionValuations.reduce((sum, p) => sum + p.marketValueFundCurrency, 0) +
        cashBalances.reduce((sum, c) => sum + c.balanceFundCurrency, 0),
      navDate
    );

    return {
      fundId,
      shareClassId,
      navDate,
      positions: positionValuations,
      cashBalances,
      receivables: [], // Would need to fetch from SECURA
      liabilities: [],
      accruedFees,
      pendingRedemptions,
      sharesOutstanding,
      fxRates: fxRateInputs,
      fundCurrency: fund.currency,
      managementFeeRate: shareClass.managementFee,
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

    // Management fee accrual
    const daysInMonth = Math.ceil((today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const dailyMgmtFee = (aum * fundConfig.managementFeeRate) / 365;
    
    fees.push({
      feeType: 'MANAGEMENT_FEE',
      periodStart: monthStart.toISOString().split('T')[0],
      periodEnd: navDate,
      annualRate: fundConfig.managementFeeRate,
      baseAmount: aum,
      accruedAmount: dailyMgmtFee * daysInMonth,
      currency: fundConfig.currency,
    });

    // Depositary fee accrual
    if (fundConfig.depositaryFeeRate > 0) {
      const dailyDepFee = (aum * fundConfig.depositaryFeeRate) / 365;
      fees.push({
        feeType: 'DEPOSITARY_FEE',
        periodStart: monthStart.toISOString().split('T')[0],
        periodEnd: navDate,
        annualRate: fundConfig.depositaryFeeRate,
        baseAmount: aum,
        accruedAmount: dailyDepFee * daysInMonth,
        currency: fundConfig.currency,
      });
    }

    // Admin fee accrual
    if (fundConfig.adminFeeRate > 0) {
      const dailyAdminFee = (aum * fundConfig.adminFeeRate) / 365;
      fees.push({
        feeType: 'ADMIN_FEE',
        periodStart: monthStart.toISOString().split('T')[0],
        periodEnd: navDate,
        annualRate: fundConfig.adminFeeRate,
        baseAmount: aum,
        accruedAmount: dailyAdminFee * daysInMonth,
        currency: fundConfig.currency,
      });
    }

    return fees;
  }

  private mapToAssetClass(securityType: string): PositionValuation['assetClass'] {
    switch (securityType) {
      case 'EQUITY':
      case 'ETF':
        return 'EQUITIES';
      case 'BOND':
      case 'MONEY_MARKET':
        return 'FIXED_INCOME';
      case 'FUND':
        return 'FUNDS';
      case 'DERIVATIVE':
      case 'FX_FORWARD':
      case 'OPTION':
      case 'FUTURE':
        return 'DERIVATIVES';
      case 'CASH':
        return 'CASH';
      default:
        return 'OTHER';
    }
  }

  // ==========================================================================
  // Comparison & Validation
  // ==========================================================================

  private compareWithSecura(
    calculated: NAVCalculationResult,
    securaNav: SecuraNAV,
    tolerancePercent: number = 0.01
  ): NAVComparison {
    const navDiff = calculated.navPerShare - securaNav.navPerShare;
    const navDiffPercent = securaNav.navPerShare > 0 
      ? (navDiff / securaNav.navPerShare) * 100 
      : 0;

    const totalDiff = calculated.netAssetValue - securaNav.netAssetValue;
    const totalDiffPercent = securaNav.netAssetValue > 0
      ? (totalDiff / securaNav.netAssetValue) * 100
      : 0;

    return {
      navDate: calculated.navDate,
      fundId: calculated.fundId,
      shareClassId: calculated.shareClassId,
      calculated,
      reference: {
        source: 'SECURA',
        navPerShare: securaNav.navPerShare,
        netAssetValue: securaNav.netAssetValue,
        timestamp: securaNav.calculationDate,
      },
      difference: {
        navPerShare: navDiff,
        navPerSharePercent: navDiffPercent,
        netAssetValue: totalDiff,
        netAssetValuePercent: totalDiffPercent,
        withinTolerance: Math.abs(navDiffPercent) <= tolerancePercent,
      },
      toleranceThreshold: tolerancePercent,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private extractCurrencies(positions: SecuraPosition[], cash: SecuraCashSummary): string[] {
    const currencies = new Set<string>();
    
    positions.forEach(p => currencies.add(p.priceCurrency));
    cash.accounts.forEach(a => currencies.add(a.currency));
    
    return Array.from(currencies);
  }

  private getFundConfig(fund: SecuraFund): FundConfig {
    // Check cache first
    const cached = this.fundConfigs.get(fund.fundId);
    if (cached) return cached;

    // Build config from SECURA fund data
    const config: FundConfig = {
      fundId: fund.fundId,
      fundCode: fund.fundCode,
      name: fund.name,
      currency: fund.currency,
      fundType: fund.fundType,
      
      // Default fee rates - should be configured per fund
      managementFeeRate: fund.shareClasses[0]?.managementFee || 0.015,
      depositaryFeeRate: 0.0005, // 0.05% default
      adminFeeRate: 0.001, // 0.10% default
      
      pricingPolicy: {
        equityPriceType: 'CLOSE',
        bondPriceType: 'BID',
        derivativePriceType: 'MARK_TO_MARKET',
        fxRateTime: 'CLOSE',
        fxRateSource: 'ECB',
      },
      
      accrualRules: {
        feeAccrualBasis: 'DAILY',
        dividendAccrualPolicy: 'EX_DATE',
        interestAccrualMethod: 'ACT_365',
      },
      
      shareClasses: fund.shareClasses.map(sc => ({
        shareClassId: sc.shareClassId,
        shareClassCode: sc.shareClassCode,
        name: sc.name,
        isin: sc.isin,
        currency: sc.currency,
        hedged: sc.hedged,
        managementFeeRate: sc.managementFee,
        performanceFeeRate: sc.performanceFee,
        distributionPolicy: sc.distributionPolicy,
      })),
    };

    this.fundConfigs.set(fund.fundId, config);
    return config;
  }

  /**
   * Set custom fund configuration
   */
  setFundConfig(config: FundConfig): void {
    this.fundConfigs.set(config.fundId, config);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: NAVService | null = null;

/**
 * Get NAV service singleton
 */
export function getNAVService(): NAVService {
  if (!serviceInstance) {
    serviceInstance = new NAVService();
  }
  return serviceInstance;
}

/**
 * Create new NAV service instance
 */
export function createNAVService(securaClient?: SecuraClient): NAVService {
  return new NAVService(securaClient);
}
