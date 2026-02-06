/**
 * NAV Calculation Engine
 * 
 * Beräkningsmotor för NAV (Net Asset Value)
 * Implementerar samma beräkningslogik som SECURA
 */

import {
  NAVCalculationInput,
  NAVCalculationResult,
  NAVBreakdown,
  PositionValuation,
  CashBalance,
  Receivable,
  Liability,
  AccruedFee,
  PendingRedemption,
  FXRate,
  ValidationError,
  ValidationWarning,
  CalculationDetail,
  AssetClass,
  SecurityType,
  FundConfig,
} from './types';

// ============================================================================
// NAV Calculator Class
// ============================================================================

export class NAVCalculator {
  private fxRates: Map<string, number> = new Map();
  private fundCurrency: string = 'SEK';
  private calculationDetails: CalculationDetail[] = [];
  private validationErrors: ValidationError[] = [];
  private validationWarnings: ValidationWarning[] = [];

  /**
   * Calculate NAV for a fund/share class
   */
  calculate(input: NAVCalculationInput): NAVCalculationResult {
    // Reset state
    this.calculationDetails = [];
    this.validationErrors = [];
    this.validationWarnings = [];
    this.fundCurrency = input.fundCurrency;
    
    // Build FX rate lookup
    this.buildFXRateLookup(input.fxRates);

    // 1. Calculate gross assets
    const assetBreakdown = this.calculateAssets(
      input.positions,
      input.cashBalances,
      input.receivables
    );

    // 2. Calculate liabilities
    const liabilityBreakdown = this.calculateLiabilities(
      input.liabilities,
      input.accruedFees,
      input.pendingRedemptions,
      assetBreakdown.total, // For fee calculations based on AUM
      input.managementFeeRate,
      input.performanceFeeRate,
      input.highWaterMark
    );

    // 3. Calculate accruals
    const accrualBreakdown = this.calculateAccruals(input.positions, input.receivables);

    // 4. Calculate NAV
    const grossAssets = assetBreakdown.total;
    const totalLiabilities = liabilityBreakdown.total;
    const netAssetValue = grossAssets - totalLiabilities;
    const sharesOutstanding = input.sharesOutstanding;
    const navPerShare = sharesOutstanding > 0 ? netAssetValue / sharesOutstanding : 0;

    this.addCalculationDetail(
      'NET_ASSET_VALUE',
      'Beräkning av fondförmögenhet',
      { grossAssets, totalLiabilities },
      netAssetValue,
      'NAV = Bruttotillgångar - Skulder'
    );

    this.addCalculationDetail(
      'NAV_PER_SHARE',
      'Beräkning av andelsvärde',
      { netAssetValue, sharesOutstanding },
      navPerShare,
      'NAV/andel = Fondförmögenhet / Utestående andelar'
    );

    // 5. Validate result
    this.validateResult(input, navPerShare, netAssetValue);

    // Build result
    const result: NAVCalculationResult = {
      fundId: input.fundId,
      shareClassId: input.shareClassId,
      navDate: input.navDate,
      calculatedAt: new Date().toISOString(),
      
      grossAssets,
      totalLiabilities,
      netAssetValue,
      sharesOutstanding,
      navPerShare,
      
      previousNAV: undefined, // Set externally if available
      navChange: 0,
      navChangePercent: 0,
      
      breakdown: {
        assets: assetBreakdown,
        liabilities: liabilityBreakdown,
        accruals: accrualBreakdown,
      },
      
      validationErrors: this.validationErrors,
      warnings: this.validationWarnings,
      status: this.validationErrors.length > 0 
        ? 'ERRORS' 
        : this.validationWarnings.length > 0 
          ? 'WARNINGS' 
          : 'VALID',
      
      calculationDetails: this.calculationDetails,
    };

    return result;
  }

  /**
   * Calculate with comparison to previous NAV
   */
  calculateWithComparison(
    input: NAVCalculationInput, 
    previousNavPerShare: number
  ): NAVCalculationResult {
    const result = this.calculate(input);
    
    result.previousNAV = previousNavPerShare;
    result.navChange = result.navPerShare - previousNavPerShare;
    result.navChangePercent = previousNavPerShare > 0 
      ? (result.navChange / previousNavPerShare) * 100 
      : 0;

    return result;
  }

  // ==========================================================================
  // Asset Calculations
  // ==========================================================================

  private calculateAssets(
    positions: PositionValuation[],
    cashBalances: CashBalance[],
    receivables: Receivable[]
  ): NAVBreakdown['assets'] {
    const assetBreakdown: NAVBreakdown['assets'] = {
      equities: 0,
      bonds: 0,
      funds: 0,
      derivatives: 0,
      cash: 0,
      receivables: 0,
      other: 0,
      total: 0,
    };

    // Calculate position values
    for (const position of positions) {
      const value = this.getValueInFundCurrency(
        position.marketValue,
        position.priceCurrency
      );
      
      const category = this.mapSecurityTypeToAssetClass(position.securityType);
      
      switch (category) {
        case 'EQUITIES':
          assetBreakdown.equities += value;
          break;
        case 'FIXED_INCOME':
          assetBreakdown.bonds += value;
          break;
        case 'FUNDS':
          assetBreakdown.funds += value;
          break;
        case 'DERIVATIVES':
          assetBreakdown.derivatives += value;
          break;
        default:
          assetBreakdown.other += value;
      }
    }

    this.addCalculationDetail(
      'POSITION_VALUATION',
      'Värdering av värdepappersinnehav',
      {
        equities: assetBreakdown.equities,
        bonds: assetBreakdown.bonds,
        funds: assetBreakdown.funds,
        derivatives: assetBreakdown.derivatives,
        other: assetBreakdown.other,
      },
      assetBreakdown.equities + assetBreakdown.bonds + assetBreakdown.funds + 
        assetBreakdown.derivatives + assetBreakdown.other,
      'Summa = Aktier + Obligationer + Fonder + Derivat + Övrigt'
    );

    // Calculate cash
    for (const cash of cashBalances) {
      const value = this.getValueInFundCurrency(cash.balance, cash.currency);
      assetBreakdown.cash += value;
    }

    this.addCalculationDetail(
      'CASH_BALANCES',
      'Kassor och bankmedel',
      { accounts: cashBalances.length },
      assetBreakdown.cash
    );

    // Calculate receivables
    for (const receivable of receivables) {
      const value = this.getValueInFundCurrency(receivable.amount, receivable.currency);
      assetBreakdown.receivables += value;
    }

    this.addCalculationDetail(
      'RECEIVABLES',
      'Fordringar',
      { items: receivables.length },
      assetBreakdown.receivables
    );

    // Total
    assetBreakdown.total = 
      assetBreakdown.equities +
      assetBreakdown.bonds +
      assetBreakdown.funds +
      assetBreakdown.derivatives +
      assetBreakdown.cash +
      assetBreakdown.receivables +
      assetBreakdown.other;

    this.addCalculationDetail(
      'GROSS_ASSETS',
      'Totala bruttotillgångar',
      {
        positions: assetBreakdown.equities + assetBreakdown.bonds + 
          assetBreakdown.funds + assetBreakdown.derivatives + assetBreakdown.other,
        cash: assetBreakdown.cash,
        receivables: assetBreakdown.receivables,
      },
      assetBreakdown.total,
      'Bruttotillgångar = Positioner + Kassa + Fordringar'
    );

    return assetBreakdown;
  }

  // ==========================================================================
  // Liability Calculations
  // ==========================================================================

  private calculateLiabilities(
    liabilities: Liability[],
    accruedFees: AccruedFee[],
    pendingRedemptions: PendingRedemption[],
    grossAssets: number,
    managementFeeRate: number,
    performanceFeeRate?: number,
    highWaterMark?: number
  ): NAVBreakdown['liabilities'] {
    const liabilityBreakdown: NAVBreakdown['liabilities'] = {
      managementFee: 0,
      performanceFee: 0,
      depositaryFee: 0,
      adminFee: 0,
      auditFee: 0,
      taxLiability: 0,
      pendingRedemptions: 0,
      otherLiabilities: 0,
      total: 0,
    };

    // Process accrued fees
    for (const fee of accruedFees) {
      const value = fee.accruedAmount;
      
      switch (fee.feeType) {
        case 'MANAGEMENT_FEE':
          liabilityBreakdown.managementFee += value;
          break;
        case 'PERFORMANCE_FEE':
          liabilityBreakdown.performanceFee += value;
          break;
        case 'DEPOSITARY_FEE':
          liabilityBreakdown.depositaryFee += value;
          break;
        case 'ADMIN_FEE':
          liabilityBreakdown.adminFee += value;
          break;
        case 'AUDIT_FEE':
          liabilityBreakdown.auditFee += value;
          break;
        case 'TAX':
          liabilityBreakdown.taxLiability += value;
          break;
        default:
          liabilityBreakdown.otherLiabilities += value;
      }
    }

    // Process explicit liabilities
    for (const liability of liabilities) {
      const value = this.getValueInFundCurrency(liability.amount, liability.currency);
      
      switch (liability.type) {
        case 'MANAGEMENT_FEE':
          liabilityBreakdown.managementFee += value;
          break;
        case 'PERFORMANCE_FEE':
          liabilityBreakdown.performanceFee += value;
          break;
        case 'DEPOSITARY_FEE':
          liabilityBreakdown.depositaryFee += value;
          break;
        case 'ADMIN_FEE':
          liabilityBreakdown.adminFee += value;
          break;
        case 'AUDIT_FEE':
          liabilityBreakdown.auditFee += value;
          break;
        case 'TAX':
          liabilityBreakdown.taxLiability += value;
          break;
        default:
          liabilityBreakdown.otherLiabilities += value;
      }
    }

    this.addCalculationDetail(
      'FEES',
      'Periodiserade avgifter',
      {
        managementFee: liabilityBreakdown.managementFee,
        performanceFee: liabilityBreakdown.performanceFee,
        depositaryFee: liabilityBreakdown.depositaryFee,
        adminFee: liabilityBreakdown.adminFee,
      },
      liabilityBreakdown.managementFee + liabilityBreakdown.performanceFee +
        liabilityBreakdown.depositaryFee + liabilityBreakdown.adminFee
    );

    // Process pending redemptions
    for (const redemption of pendingRedemptions) {
      liabilityBreakdown.pendingRedemptions += redemption.estimatedAmount;
    }

    if (pendingRedemptions.length > 0) {
      this.addCalculationDetail(
        'PENDING_REDEMPTIONS',
        'Väntande inlösen',
        { count: pendingRedemptions.length },
        liabilityBreakdown.pendingRedemptions
      );
    }

    // Total
    liabilityBreakdown.total =
      liabilityBreakdown.managementFee +
      liabilityBreakdown.performanceFee +
      liabilityBreakdown.depositaryFee +
      liabilityBreakdown.adminFee +
      liabilityBreakdown.auditFee +
      liabilityBreakdown.taxLiability +
      liabilityBreakdown.pendingRedemptions +
      liabilityBreakdown.otherLiabilities;

    this.addCalculationDetail(
      'TOTAL_LIABILITIES',
      'Totala skulder',
      {
        fees: liabilityBreakdown.managementFee + liabilityBreakdown.performanceFee +
          liabilityBreakdown.depositaryFee + liabilityBreakdown.adminFee + 
          liabilityBreakdown.auditFee,
        pendingRedemptions: liabilityBreakdown.pendingRedemptions,
        other: liabilityBreakdown.otherLiabilities + liabilityBreakdown.taxLiability,
      },
      liabilityBreakdown.total
    );

    return liabilityBreakdown;
  }

  // ==========================================================================
  // Accrual Calculations
  // ==========================================================================

  private calculateAccruals(
    positions: PositionValuation[],
    receivables: Receivable[]
  ): NAVBreakdown['accruals'] {
    const accruals: NAVBreakdown['accruals'] = {
      accruedIncome: 0,
      accruedExpenses: 0,
      dividendsReceivable: 0,
      interestReceivable: 0,
      total: 0,
    };

    // Accrued interest from bonds
    for (const position of positions) {
      if (position.securityType === 'BOND' && position.accruedInterest) {
        accruals.interestReceivable += this.getValueInFundCurrency(
          position.accruedInterest,
          position.priceCurrency
        );
      }
      
      if (position.accruedDividend) {
        accruals.dividendsReceivable += this.getValueInFundCurrency(
          position.accruedDividend,
          position.priceCurrency
        );
      }
    }

    // Receivables
    for (const receivable of receivables) {
      const value = this.getValueInFundCurrency(receivable.amount, receivable.currency);
      
      if (receivable.type === 'DIVIDEND') {
        accruals.dividendsReceivable += value;
      } else if (receivable.type === 'INTEREST') {
        accruals.interestReceivable += value;
      } else {
        accruals.accruedIncome += value;
      }
    }

    accruals.total = 
      accruals.accruedIncome +
      accruals.dividendsReceivable +
      accruals.interestReceivable -
      accruals.accruedExpenses;

    return accruals;
  }

  // ==========================================================================
  // Fee Calculations (SECURA-style)
  // ==========================================================================

  /**
   * Calculate daily accrued management fee
   * Using ACT/365 convention
   */
  calculateDailyManagementFee(aum: number, annualFeeRate: number): number {
    const dailyRate = annualFeeRate / 365;
    return aum * dailyRate;
  }

  /**
   * Calculate performance fee with High Water Mark
   */
  calculatePerformanceFee(
    currentNav: number,
    highWaterMark: number,
    performanceFeeRate: number,
    sharesOutstanding: number
  ): number {
    if (currentNav <= highWaterMark) {
      return 0; // No performance fee if below HWM
    }

    const outperformance = currentNav - highWaterMark;
    const performanceFee = outperformance * sharesOutstanding * performanceFeeRate;
    
    return Math.max(0, performanceFee);
  }

  /**
   * Calculate accrued fee for a period
   */
  calculateAccruedFee(
    baseAmount: number,
    annualRate: number,
    fromDate: Date,
    toDate: Date,
    convention: 'ACT_360' | 'ACT_365' | '30_360' = 'ACT_365'
  ): number {
    const days = this.calculateDayCount(fromDate, toDate, convention);
    const yearDays = convention === 'ACT_360' ? 360 : 365;
    
    return baseAmount * (annualRate * days / yearDays);
  }

  private calculateDayCount(
    fromDate: Date,
    toDate: Date,
    convention: 'ACT_360' | 'ACT_365' | '30_360'
  ): number {
    if (convention === '30_360') {
      // 30/360 convention
      const d1 = Math.min(fromDate.getDate(), 30);
      const d2 = fromDate.getDate() === 31 ? 30 : toDate.getDate();
      const m1 = fromDate.getMonth();
      const m2 = toDate.getMonth();
      const y1 = fromDate.getFullYear();
      const y2 = toDate.getFullYear();
      
      return 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
    }
    
    // ACT/365 or ACT/360 - actual days
    const diffTime = toDate.getTime() - fromDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ==========================================================================
  // FX Conversion
  // ==========================================================================

  private buildFXRateLookup(fxRates: FXRate[]): void {
    this.fxRates.clear();
    
    for (const rate of fxRates) {
      const key = `${rate.baseCurrency}/${rate.quoteCurrency}`;
      this.fxRates.set(key, rate.rate);
      
      // Also store inverse
      const inverseKey = `${rate.quoteCurrency}/${rate.baseCurrency}`;
      this.fxRates.set(inverseKey, 1 / rate.rate);
    }
    
    // Add identity rate for fund currency
    this.fxRates.set(`${this.fundCurrency}/${this.fundCurrency}`, 1);
  }

  private getValueInFundCurrency(amount: number, currency: string): number {
    if (currency === this.fundCurrency) {
      return amount;
    }

    const rate = this.getFXRate(currency, this.fundCurrency);
    if (rate === null) {
      this.addWarning(
        'MISSING_FX_RATE',
        `Saknar valutakurs för ${currency}/${this.fundCurrency}`,
        'fxRate'
      );
      return amount; // Return unconverted as fallback
    }

    return amount * rate;
  }

  private getFXRate(fromCurrency: string, toCurrency: string): number | null {
    if (fromCurrency === toCurrency) return 1;
    
    const key = `${fromCurrency}/${toCurrency}`;
    return this.fxRates.get(key) ?? null;
  }

  // ==========================================================================
  // Security Classification
  // ==========================================================================

  private mapSecurityTypeToAssetClass(securityType: SecurityType): AssetClass {
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
      case 'WARRANT':
      case 'CERTIFICATE':
        return 'DERIVATIVES';
      case 'CASH':
        return 'CASH';
      default:
        return 'OTHER';
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  private validateResult(
    input: NAVCalculationInput,
    navPerShare: number,
    netAssetValue: number
  ): void {
    // Check for negative NAV
    if (netAssetValue < 0) {
      this.addError(
        'NEGATIVE_NAV',
        'Fondförmögenheten är negativ',
        'netAssetValue'
      );
    }

    // Check for zero shares
    if (input.sharesOutstanding <= 0) {
      this.addError(
        'INVALID_SHARES',
        'Antal utestående andelar måste vara positivt',
        'sharesOutstanding'
      );
    }

    // Check for missing prices
    const positionsWithoutPrice = input.positions.filter(p => !p.price || p.price <= 0);
    if (positionsWithoutPrice.length > 0) {
      this.addWarning(
        'MISSING_PRICES',
        `${positionsWithoutPrice.length} positioner saknar aktuellt pris`,
        'positions',
        { securities: positionsWithoutPrice.map(p => p.isin) }
      );
    }

    // Check for stale prices (older than 2 days)
    const today = new Date(input.navDate);
    const staleThreshold = new Date(today);
    staleThreshold.setDate(staleThreshold.getDate() - 2);
    
    const stalePositions = input.positions.filter(p => {
      const priceDate = new Date(p.priceDate);
      return priceDate < staleThreshold;
    });
    
    if (stalePositions.length > 0) {
      this.addWarning(
        'STALE_PRICES',
        `${stalePositions.length} positioner har priser äldre än 2 dagar`,
        'positions',
        { securities: stalePositions.map(p => ({ isin: p.isin, priceDate: p.priceDate })) }
      );
    }

    // Check NAV change threshold (warn if > 5% daily change)
    // This would need previousNAV to be passed in
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private addCalculationDetail(
    step: string,
    description: string,
    inputValues: Record<string, number>,
    outputValue: number,
    formula?: string
  ): void {
    this.calculationDetails.push({
      step,
      description,
      inputValues,
      outputValue,
      formula,
    });
  }

  private addError(code: string, message: string, field?: string, details?: Record<string, unknown>): void {
    this.validationErrors.push({
      code,
      severity: 'ERROR',
      message,
      field,
      details,
    });
  }

  private addWarning(code: string, message: string, field?: string, details?: Record<string, unknown>): void {
    this.validationWarnings.push({
      code,
      severity: 'WARNING',
      message,
      field,
      details,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createNAVCalculator(): NAVCalculator {
  return new NAVCalculator();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format NAV for display
 */
export function formatNAV(value: number, decimals: number = 4): string {
  return value.toFixed(decimals);
}

/**
 * Calculate NAV change percentage
 */
export function calculateNAVChange(current: number, previous: number): {
  change: number;
  changePercent: number;
} {
  const change = current - previous;
  const changePercent = previous > 0 ? (change / previous) * 100 : 0;
  return { change, changePercent };
}

/**
 * Check if NAV is within tolerance of reference
 */
export function isNAVWithinTolerance(
  calculated: number,
  reference: number,
  tolerancePercent: number = 0.01
): boolean {
  if (reference === 0) return calculated === 0;
  
  const difference = Math.abs(calculated - reference);
  const percentDiff = (difference / reference) * 100;
  
  return percentDiff <= tolerancePercent;
}
