/**
 * NAV Calculations
 * 
 * Beräkningar för NAV-sättning
 * Implementerar standard fondredovisning enligt UCITS/AIF-regler
 */

// ============================================================================
// Core NAV Formulas
// ============================================================================

/**
 * Beräkna NAV (Net Asset Value / Fondförmögenhet)
 * 
 * NAV = Bruttotillgångar - Skulder
 * 
 * Bruttotillgångar inkluderar:
 * - Värdepappersinnehav (marknadsvärde)
 * - Kassor och bankmedel
 * - Fordringar (utdelningar, räntor)
 * - Periodiserade intäkter
 * 
 * Skulder inkluderar:
 * - Periodiserade avgifter (förvaltning, förvar, admin)
 * - Väntande inlösen
 * - Leverantörsskulder
 */
export function calculateNAV(
  grossAssets: number,
  totalLiabilities: number
): number {
  return grossAssets - totalLiabilities;
}

/**
 * Beräkna NAV per andel
 * 
 * NAV/andel = Fondförmögenhet / Utestående andelar
 */
export function calculateNAVPerShare(
  netAssetValue: number,
  sharesOutstanding: number
): number {
  if (sharesOutstanding <= 0) return 0;
  return netAssetValue / sharesOutstanding;
}

/**
 * Beräkna förändring i NAV
 */
export function calculateNAVChange(
  currentNAV: number,
  previousNAV: number
): { change: number; changePercent: number } {
  const change = currentNAV - previousNAV;
  const changePercent = previousNAV > 0 ? (change / previousNAV) * 100 : 0;
  return { change, changePercent };
}

// ============================================================================
// Position Valuation
// ============================================================================

/**
 * Värdera en position (värdepapper)
 * 
 * Marknadsvärde = Antal × Pris × (1 / FX-kurs om annan valuta)
 */
export function valuePosition(
  quantity: number,
  price: number,
  priceCurrency: string,
  fundCurrency: string,
  fxRate: number = 1
): number {
  const localValue = quantity * price;
  
  if (priceCurrency === fundCurrency) {
    return localValue;
  }
  
  // Konvertera till fondvaluta
  return localValue * fxRate;
}

/**
 * Beräkna upplupen ränta för obligationer (Accrued Interest)
 * 
 * AI = Nominellt × Kupongränta × (Dagar sedan kupong / Dagskonvention)
 */
export function calculateAccruedInterest(
  nominalValue: number,
  couponRate: number,
  daysSinceCoupon: number,
  dayCountConvention: 'ACT_360' | 'ACT_365' | '30_360' = 'ACT_365'
): number {
  const daysInYear = dayCountConvention === 'ACT_360' ? 360 : 365;
  return nominalValue * couponRate * (daysSinceCoupon / daysInYear);
}

/**
 * Beräkna upplupen utdelning
 * 
 * Bokförs från ex-datum (eller avstämningsdag)
 */
export function calculateAccruedDividend(
  shares: number,
  dividendPerShare: number,
  isExDate: boolean
): number {
  return isExDate ? shares * dividendPerShare : 0;
}

// ============================================================================
// Fee Calculations (Avgiftsberäkningar)
// ============================================================================

/**
 * Beräkna daglig förvaltningsavgift
 * 
 * Daglig avgift = AUM × (Årlig avgift / 365)
 * 
 * Använder typiskt ACT/365 konvention
 */
export function calculateDailyManagementFee(
  aum: number,
  annualFeeRate: number,
  dayCount: 'ACT_365' | 'ACT_360' = 'ACT_365'
): number {
  const daysInYear = dayCount === 'ACT_360' ? 360 : 365;
  return aum * (annualFeeRate / daysInYear);
}

/**
 * Beräkna periodiserad avgift för en period
 * 
 * Periodisering = AUM × Årlig avgift × (Antal dagar / Dagar per år)
 */
export function calculateAccruedFee(
  aum: number,
  annualFeeRate: number,
  days: number,
  dayCount: 'ACT_365' | 'ACT_360' = 'ACT_365'
): number {
  const daysInYear = dayCount === 'ACT_360' ? 360 : 365;
  return aum * annualFeeRate * (days / daysInYear);
}

/**
 * Beräkna resultatbaserad avgift (Performance Fee)
 * 
 * Med High Water Mark:
 * - Avgift tas bara ut om NAV > HWM
 * - Performance Fee = (NAV - HWM) × Avgiftssats × Andelar
 */
export function calculatePerformanceFee(
  currentNAVPerShare: number,
  highWaterMark: number,
  performanceFeeRate: number,
  sharesOutstanding: number
): number {
  if (currentNAVPerShare <= highWaterMark) {
    return 0; // Ingen avgift under HWM
  }
  
  const outperformance = currentNAVPerShare - highWaterMark;
  return outperformance * performanceFeeRate * sharesOutstanding;
}

/**
 * Beräkna resultatbaserad avgift med Hurdle Rate
 * 
 * Avgift tas ut endast på avkastning över hurdle rate
 */
export function calculatePerformanceFeeWithHurdle(
  currentNAVPerShare: number,
  previousNAVPerShare: number,
  hurdleRate: number,
  performanceFeeRate: number,
  sharesOutstanding: number,
  days: number
): number {
  // Beräkna periodiserad hurdle
  const periodHurdle = previousNAVPerShare * (hurdleRate * days / 365);
  const hurdleAdjustedNAV = previousNAVPerShare + periodHurdle;
  
  if (currentNAVPerShare <= hurdleAdjustedNAV) {
    return 0;
  }
  
  const excessReturn = currentNAVPerShare - hurdleAdjustedNAV;
  return excessReturn * performanceFeeRate * sharesOutstanding;
}

// ============================================================================
// FX Calculations (Valutaomräkning)
// ============================================================================

/**
 * Konvertera belopp mellan valutor
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: Map<string, number>
): number {
  if (fromCurrency === toCurrency) return amount;
  
  // Försök direkt kurs
  const directKey = `${fromCurrency}/${toCurrency}`;
  if (fxRates.has(directKey)) {
    return amount * fxRates.get(directKey)!;
  }
  
  // Försök invers kurs
  const inverseKey = `${toCurrency}/${fromCurrency}`;
  if (fxRates.has(inverseKey)) {
    return amount / fxRates.get(inverseKey)!;
  }
  
  // Försök via USD eller EUR
  for (const crossCurrency of ['USD', 'EUR']) {
    const toUSD = fxRates.get(`${fromCurrency}/${crossCurrency}`);
    const fromUSD = fxRates.get(`${crossCurrency}/${toCurrency}`);
    
    if (toUSD && fromUSD) {
      return amount * toUSD * fromUSD;
    }
  }
  
  throw new Error(`No FX rate found for ${fromCurrency}/${toCurrency}`);
}

/**
 * Beräkna valutaexponering per valuta
 */
export function calculateCurrencyExposure(
  positions: Array<{ currency: string; marketValue: number }>,
  cash: Array<{ currency: string; balance: number }>,
  fundCurrency: string,
  fxRates: Map<string, number>
): Map<string, { localValue: number; fundCurrencyValue: number; percentage: number }> {
  const exposure = new Map<string, { localValue: number; fundCurrencyValue: number; percentage: number }>();
  
  let totalValue = 0;
  
  // Aggregera positioner per valuta
  for (const pos of positions) {
    const current = exposure.get(pos.currency) || { localValue: 0, fundCurrencyValue: 0, percentage: 0 };
    current.localValue += pos.marketValue;
    current.fundCurrencyValue += convertCurrency(pos.marketValue, pos.currency, fundCurrency, fxRates);
    exposure.set(pos.currency, current);
    totalValue += current.fundCurrencyValue;
  }
  
  // Lägg till kassa
  for (const c of cash) {
    const current = exposure.get(c.currency) || { localValue: 0, fundCurrencyValue: 0, percentage: 0 };
    current.localValue += c.balance;
    const converted = convertCurrency(c.balance, c.currency, fundCurrency, fxRates);
    current.fundCurrencyValue += converted;
    exposure.set(c.currency, current);
    totalValue += converted;
  }
  
  // Beräkna procent
  exposure.forEach((value, currency) => {
    value.percentage = totalValue > 0 ? (value.fundCurrencyValue / totalValue) * 100 : 0;
  });
  
  return exposure;
}

// ============================================================================
// Share Class Calculations
// ============================================================================

/**
 * Beräkna NAV för hedgad andelsklass
 * 
 * Hedgade andelsklasser har FX-säkring mot fondvalutan
 * NAV justeras för hedging-kostnader
 */
export function calculateHedgedShareClassNAV(
  baseNAVPerShare: number,
  hedgingCost: number, // Årlig kostnad som %
  days: number,
  hedgingRatio: number = 1 // 1 = 100% hedgad
): number {
  const dailyHedgingCost = (hedgingCost / 365) * hedgingRatio;
  const periodCost = dailyHedgingCost * days;
  
  return baseNAVPerShare * (1 - periodCost);
}

/**
 * Fördela fondkostnader mellan andelsklasser
 * 
 * Kostnader fördelas proportionellt baserat på AUM
 */
export function allocateFeeToShareClass(
  totalFee: number,
  shareClassAUM: number,
  totalFundAUM: number
): number {
  if (totalFundAUM <= 0) return 0;
  return totalFee * (shareClassAUM / totalFundAUM);
}

// ============================================================================
// Subscription/Redemption Calculations
// ============================================================================

/**
 * Beräkna antal andelar för teckning
 * 
 * Andelar = Tecknat belopp / NAV per andel
 */
export function calculateSubscriptionShares(
  subscriptionAmount: number,
  navPerShare: number,
  entryFee: number = 0
): { shares: number; feeAmount: number; netAmount: number } {
  const feeAmount = subscriptionAmount * entryFee;
  const netAmount = subscriptionAmount - feeAmount;
  const shares = navPerShare > 0 ? netAmount / navPerShare : 0;
  
  return { shares, feeAmount, netAmount };
}

/**
 * Beräkna utbetalning för inlösen
 * 
 * Belopp = Antal andelar × NAV per andel × (1 - Utträdesavgift)
 */
export function calculateRedemptionAmount(
  shares: number,
  navPerShare: number,
  exitFee: number = 0
): { grossAmount: number; feeAmount: number; netAmount: number } {
  const grossAmount = shares * navPerShare;
  const feeAmount = grossAmount * exitFee;
  const netAmount = grossAmount - feeAmount;
  
  return { grossAmount, feeAmount, netAmount };
}

/**
 * Beräkna dilution levy (utspädningsskydd)
 * 
 * Används vid stora in-/utflöden för att skydda befintliga andelsägare
 */
export function calculateDilutionLevy(
  flowAmount: number,
  navPerShare: number,
  bidAskSpread: number,
  transactionCosts: number,
  isSubscription: boolean
): number {
  // Dilution = Flöde × (Spread/2 + Transaktionskostnader)
  const dilutionRate = (bidAskSpread / 2) + transactionCosts;
  return flowAmount * dilutionRate * (isSubscription ? 1 : -1);
}

// ============================================================================
// Day Count Conventions
// ============================================================================

/**
 * Beräkna antal dagar enligt olika konventioner
 */
export function calculateDayCount(
  fromDate: Date,
  toDate: Date,
  convention: 'ACT_360' | 'ACT_365' | '30_360' | 'ACT_ACT'
): number {
  switch (convention) {
    case '30_360': {
      // 30/360 (Bond basis)
      let d1 = Math.min(fromDate.getDate(), 30);
      let d2 = toDate.getDate();
      if (d1 === 30 && d2 === 31) d2 = 30;
      if (d1 === 31) d1 = 30;
      
      const m1 = fromDate.getMonth();
      const m2 = toDate.getMonth();
      const y1 = fromDate.getFullYear();
      const y2 = toDate.getFullYear();
      
      return 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
    }
    
    case 'ACT_ACT': {
      // Actual/Actual (ISDA)
      const diffTime = toDate.getTime() - fromDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    case 'ACT_360':
    case 'ACT_365':
    default: {
      // Actual/360 or Actual/365
      const diffTime = toDate.getTime() - fromDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  }
}

/**
 * Beräkna årsfraktion
 */
export function calculateYearFraction(
  fromDate: Date,
  toDate: Date,
  convention: 'ACT_360' | 'ACT_365' | '30_360' | 'ACT_ACT'
): number {
  const days = calculateDayCount(fromDate, toDate, convention);
  
  switch (convention) {
    case 'ACT_360':
    case '30_360':
      return days / 360;
    case 'ACT_ACT': {
      // För ACT/ACT, ta hänsyn till skottår
      const year = fromDate.getFullYear();
      const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return days / (isLeapYear ? 366 : 365);
    }
    case 'ACT_365':
    default:
      return days / 365;
  }
}

// ============================================================================
// Rounding Rules
// ============================================================================

/**
 * Avrunda NAV per andel
 * Typiskt 2-4 decimaler beroende på andelsklass
 */
export function roundNAVPerShare(
  value: number,
  decimals: number = 2,
  roundingMethod: 'ROUND' | 'FLOOR' | 'CEIL' = 'ROUND'
): number {
  const multiplier = Math.pow(10, decimals);
  
  switch (roundingMethod) {
    case 'FLOOR':
      return Math.floor(value * multiplier) / multiplier;
    case 'CEIL':
      return Math.ceil(value * multiplier) / multiplier;
    case 'ROUND':
    default:
      return Math.round(value * multiplier) / multiplier;
  }
}

/**
 * Avrunda antal andelar
 * Typiskt 2-6 decimaler
 */
export function roundShares(
  shares: number,
  decimals: number = 4
): number {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(shares * multiplier) / multiplier; // Alltid avrunda nedåt
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validera NAV-beräkning
 */
export function validateNAVCalculation(
  grossAssets: number,
  totalLiabilities: number,
  netAssetValue: number,
  sharesOutstanding: number,
  navPerShare: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Kontrollera att NAV stämmer
  const expectedNAV = grossAssets - totalLiabilities;
  if (Math.abs(netAssetValue - expectedNAV) > 0.01) {
    errors.push(`NAV mismatch: ${netAssetValue} != ${expectedNAV}`);
  }
  
  // Kontrollera NAV per andel
  if (sharesOutstanding > 0) {
    const expectedNAVPerShare = netAssetValue / sharesOutstanding;
    if (Math.abs(navPerShare - expectedNAVPerShare) > 0.0001) {
      errors.push(`NAV per share mismatch: ${navPerShare} != ${expectedNAVPerShare}`);
    }
  }
  
  // Kontrollera rimliga värden
  if (grossAssets < 0) {
    errors.push('Gross assets cannot be negative');
  }
  
  if (totalLiabilities < 0) {
    errors.push('Total liabilities cannot be negative');
  }
  
  if (sharesOutstanding < 0) {
    errors.push('Shares outstanding cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Kontrollera NAV-förändring (varning vid stora rörelser)
 */
export function checkNAVMovement(
  currentNAV: number,
  previousNAV: number,
  warningThreshold: number = 5, // 5%
  errorThreshold: number = 10 // 10%
): { status: 'OK' | 'WARNING' | 'ERROR'; changePercent: number; message: string } {
  const changePercent = previousNAV > 0 ? ((currentNAV - previousNAV) / previousNAV) * 100 : 0;
  const absChange = Math.abs(changePercent);
  
  if (absChange >= errorThreshold) {
    return {
      status: 'ERROR',
      changePercent,
      message: `NAV ändrades med ${changePercent.toFixed(2)}% vilket överstiger gränsen på ${errorThreshold}%`,
    };
  }
  
  if (absChange >= warningThreshold) {
    return {
      status: 'WARNING',
      changePercent,
      message: `NAV ändrades med ${changePercent.toFixed(2)}% vilket överstiger varningsgränsen på ${warningThreshold}%`,
    };
  }
  
  return {
    status: 'OK',
    changePercent,
    message: `NAV ändrades med ${changePercent.toFixed(2)}%`,
  };
}

// ============================================================================
// Report Data Structures
// ============================================================================

export interface NAVReportData {
  fund: {
    name: string;
    isin: string;
    currency: string;
  };
  shareClass: {
    name: string;
    isin: string;
    currency: string;
  };
  navDate: string;
  calculationDate: string;
  
  // NAV Summary
  grossAssets: number;
  totalLiabilities: number;
  netAssetValue: number;
  sharesOutstanding: number;
  navPerShare: number;
  previousNavPerShare: number;
  navChange: number;
  navChangePercent: number;
  
  // Asset Breakdown
  assetBreakdown: {
    category: string;
    value: number;
    percentage: number;
  }[];
  
  // Liability Breakdown
  liabilityBreakdown: {
    category: string;
    value: number;
  }[];
  
  // Top Holdings
  topHoldings: {
    name: string;
    isin: string;
    quantity: number;
    price: number;
    marketValue: number;
    percentage: number;
  }[];
  
  // Currency Exposure
  currencyExposure: {
    currency: string;
    value: number;
    percentage: number;
  }[];
}

/**
 * Generera NAV-rapportdata
 */
export function generateNAVReportData(
  fundName: string,
  fundIsin: string,
  fundCurrency: string,
  shareClassName: string,
  shareClassIsin: string,
  shareClassCurrency: string,
  navDate: string,
  grossAssets: number,
  totalLiabilities: number,
  sharesOutstanding: number,
  previousNavPerShare: number,
  assetBreakdown: { category: string; value: number }[],
  liabilityBreakdown: { category: string; value: number }[],
  topHoldings: { name: string; isin: string; quantity: number; price: number; marketValue: number }[],
  currencyExposure: { currency: string; value: number }[]
): NAVReportData {
  const netAssetValue = grossAssets - totalLiabilities;
  const navPerShare = calculateNAVPerShare(netAssetValue, sharesOutstanding);
  const { change, changePercent } = calculateNAVChange(navPerShare, previousNavPerShare);
  
  // Beräkna procent för tillgångar
  const assetBreakdownWithPercent = assetBreakdown.map(a => ({
    ...a,
    percentage: grossAssets > 0 ? (a.value / grossAssets) * 100 : 0,
  }));
  
  // Beräkna procent för innehav
  const topHoldingsWithPercent = topHoldings.map(h => ({
    ...h,
    percentage: grossAssets > 0 ? (h.marketValue / grossAssets) * 100 : 0,
  }));
  
  // Beräkna procent för valutaexponering
  const totalCurrencyValue = currencyExposure.reduce((sum, c) => sum + c.value, 0);
  const currencyExposureWithPercent = currencyExposure.map(c => ({
    ...c,
    percentage: totalCurrencyValue > 0 ? (c.value / totalCurrencyValue) * 100 : 0,
  }));
  
  return {
    fund: { name: fundName, isin: fundIsin, currency: fundCurrency },
    shareClass: { name: shareClassName, isin: shareClassIsin, currency: shareClassCurrency },
    navDate,
    calculationDate: new Date().toISOString(),
    grossAssets,
    totalLiabilities,
    netAssetValue,
    sharesOutstanding,
    navPerShare: roundNAVPerShare(navPerShare, 4),
    previousNavPerShare,
    navChange: change,
    navChangePercent: changePercent,
    assetBreakdown: assetBreakdownWithPercent,
    liabilityBreakdown,
    topHoldings: topHoldingsWithPercent,
    currencyExposure: currencyExposureWithPercent,
  };
}
