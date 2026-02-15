/**
 * NAV Engine - Type Definitions
 * 
 * Typdefinitioner för NAV-beräkningsmotorn
 */

// ============================================================================
// Core NAV Types
// ============================================================================

export interface NAVCalculationInput {
  fundId: string;
  shareClassId: string;
  navDate: string;
  
  // Tillgångar
  positions: PositionValuation[];
  cashBalances: CashBalance[];
  receivables: Receivable[];
  
  // Skulder
  liabilities: Liability[];
  accruedFees: AccruedFee[];
  pendingRedemptions: PendingRedemption[];
  
  // Andelar
  sharesOutstanding: number;
  
  // FX-kurser
  fxRates: FXRate[];
  
  // Fond-metadata
  fundCurrency: string;
  managementFeeRate: number; // Årlig %
  performanceFeeRate?: number;
  highWaterMark?: number;
}

export interface NAVCalculationResult {
  fundId: string;
  shareClassId: string;
  navDate: string;
  calculatedAt: string;
  
  // Sammanfattning
  grossAssets: number;
  totalLiabilities: number;
  netAssetValue: number;
  sharesOutstanding: number;
  navPerShare: number;
  
  // Förändring
  previousNAV?: number;
  navChange: number;
  navChangePercent: number;
  
  // Detaljerad uppdelning
  breakdown: NAVBreakdown;
  
  // Avstämning & validering
  validationErrors: ValidationError[];
  warnings: ValidationWarning[];
  status: 'VALID' | 'WARNINGS' | 'ERRORS';
  
  // Audit trail
  calculationDetails: CalculationDetail[];
}

export interface NAVBreakdown {
  assets: {
    equities: number;
    bonds: number;
    funds: number;
    derivatives: number;
    cash: number;
    receivables: number;
    other: number;
    total: number;
  };
  
  liabilities: {
    managementFee: number;
    performanceFee: number;
    depositaryFee: number;
    adminFee: number;
    auditFee: number;
    taxLiability: number;
    pendingRedemptions: number;
    otherLiabilities: number;
    total: number;
  };
  
  accruals: {
    accruedIncome: number;
    accruedExpenses: number;
    dividendsReceivable: number;
    interestReceivable: number;
    total: number;
  };
}

// ============================================================================
// Position & Valuation Types
// ============================================================================

export interface PositionValuation {
  positionId: string;
  securityId: string;
  isin: string;
  name: string;
  securityType: SecurityType;
  
  // Kvantitet
  quantity: number;
  nominalValue?: number;
  
  // Pris & värdering
  price: number;
  priceCurrency: string;
  priceDate: string;
  priceSource: string;
  
  // Beräknat värde
  marketValue: number; // I värdepapperets valuta
  marketValueFundCurrency: number; // I fondens valuta
  fxRate?: number;
  
  // Periodiseringar
  accruedInterest?: number;
  accruedDividend?: number;
  
  // Klassificering
  assetClass: AssetClass;
  country?: string;
  sector?: string;
}

export type SecurityType = 
  | 'EQUITY'
  | 'BOND'
  | 'FUND'
  | 'ETF'
  | 'DERIVATIVE'
  | 'FX_FORWARD'
  | 'OPTION'
  | 'FUTURE'
  | 'MONEY_MARKET'
  | 'CERTIFICATE'
  | 'WARRANT'
  | 'CASH'
  | 'OTHER';

export type AssetClass = 
  | 'EQUITIES'
  | 'FIXED_INCOME'
  | 'FUNDS'
  | 'DERIVATIVES'
  | 'CASH'
  | 'OTHER';

// ============================================================================
// Cash & Balance Types
// ============================================================================

export interface CashBalance {
  accountId: string;
  accountName: string;
  bankName: string;
  currency: string;
  balance: number;
  balanceFundCurrency: number;
  fxRate?: number;
  valueDate: string;
  accountType: 'CUSTODY' | 'SETTLEMENT' | 'MARGIN' | 'COLLATERAL';
}

export interface FXRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  rateDate: string;
  source: string;
}

// ============================================================================
// Receivables & Payables
// ============================================================================

export interface Receivable {
  id: string;
  type: 'DIVIDEND' | 'INTEREST' | 'SUBSCRIPTION' | 'SALE_PROCEEDS' | 'TAX_RECLAIM' | 'OTHER';
  description: string;
  amount: number;
  currency: string;
  amountFundCurrency: number;
  expectedDate: string;
  counterparty?: string;
}

export interface Liability {
  id: string;
  type: LiabilityType;
  description: string;
  amount: number;
  currency: string;
  amountFundCurrency: number;
  dueDate?: string;
  counterparty?: string;
}

export type LiabilityType = 
  | 'MANAGEMENT_FEE'
  | 'PERFORMANCE_FEE'
  | 'DEPOSITARY_FEE'
  | 'ADMIN_FEE'
  | 'AUDIT_FEE'
  | 'LEGAL_FEE'
  | 'TAX'
  | 'BROKER_FEE'
  | 'PENDING_PURCHASE'
  | 'OTHER';

export interface AccruedFee {
  feeType: LiabilityType;
  periodStart: string;
  periodEnd: string;
  annualRate: number;
  baseAmount: number;
  accruedAmount: number;
  currency: string;
}

export interface PendingRedemption {
  orderId: string;
  shareholderId: string;
  shares: number;
  estimatedAmount: number;
  valueDate: string;
  status: 'PENDING' | 'PROCESSING';
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationError {
  code: string;
  severity: 'ERROR';
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  code: string;
  severity: 'WARNING';
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface CalculationDetail {
  step: string;
  description: string;
  inputValues: Record<string, number>;
  outputValue: number;
  formula?: string;
}

// ============================================================================
// Fund & Share Class Configuration
// ============================================================================

export interface FundConfig {
  fundId: string;
  fundCode: string;
  name: string;
  currency: string;
  fundType: 'UCITS' | 'AIF' | 'SPECIAL';
  
  // Avgifter
  managementFeeRate: number;
  performanceFeeRate?: number;
  depositaryFeeRate: number;
  adminFeeRate: number;
  
  // Performance fee-beräkning
  performanceFeeType?: 'HIGH_WATER_MARK' | 'HURDLE_RATE' | 'BOTH';
  hurdleRate?: number;
  
  // Värderingsprinciper
  pricingPolicy: {
    equityPriceType: 'CLOSE' | 'BID' | 'MID';
    bondPriceType: 'CLOSE' | 'BID' | 'MID';
    derivativePriceType: 'MARK_TO_MARKET' | 'MARK_TO_MODEL';
    fxRateTime: 'CLOSE' | 'SPECIFIC_TIME';
    fxRateSource: string;
  };
  
  // Periodiseringsregler
  accrualRules: {
    feeAccrualBasis: 'DAILY' | 'MONTHLY';
    dividendAccrualPolicy: 'EX_DATE' | 'PAY_DATE';
    interestAccrualMethod: 'ACT_360' | 'ACT_365' | '30_360';
  };
  
  shareClasses: ShareClassConfig[];
}

export interface ShareClassConfig {
  shareClassId: string;
  shareClassCode: string;
  name: string;
  isin: string;
  currency: string;
  hedged: boolean;
  hedgingRatio?: number;
  
  // Avgifter som skiljer sig per andelsklass
  managementFeeRate?: number; // Override fund-level
  performanceFeeRate?: number;
  
  // Distribution
  distributionPolicy: 'ACC' | 'DIST';
  distributionFrequency?: 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY';
}

// ============================================================================
// NAV Calculation Schedule
// ============================================================================

export interface NAVScheduleConfig {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  cutoffTime: string; // HH:mm
  timezone: string;
  holidays: string[]; // ISO dates
  
  // Approval workflow
  requiresApproval: boolean;
  approvalLevels: number; // 1 = single, 2 = 4-eyes
  approvers: string[];
  
  // Distribution
  autoPublish: boolean;
  publishDelay?: number; // minutes after approval
  recipients: NAVRecipient[];
}

export interface NAVRecipient {
  id: string;
  name: string;
  email: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'REGULATOR';
  fundIds: string[];
  reportFormats: ('PDF' | 'EXCEL' | 'CSV' | 'API')[];
}

// ============================================================================
// NAV Run & Status
// ============================================================================

export interface NAVRun {
  runId: string;
  navDate: string;
  startedAt: string;
  completedAt?: string;
  status: NAVRunStatus;
  
  fundResults: Map<string, NAVCalculationResult>;
  
  totalFunds: number;
  completedFunds: number;
  failedFunds: number;
  
  errors: string[];
  
  // Approval
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string[];
  approvedAt?: string[];
}

export type NAVRunStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'FAILED';

// ============================================================================
// Comparison & Reconciliation
// ============================================================================

export interface NAVComparison {
  navDate: string;
  fundId: string;
  shareClassId: string;
  
  calculated: NAVCalculationResult;
  reference?: {
    source: 'FUND_REGISTRY' | 'ADMINISTRATOR' | 'PREVIOUS' | 'SEB';
    navPerShare: number;
    netAssetValue: number;
    timestamp: string;
  };
  
  difference?: {
    navPerShare: number;
    navPerSharePercent: number;
    netAssetValue: number;
    netAssetValuePercent: number;
    withinTolerance: boolean;
  };
  
  toleranceThreshold: number; // e.g., 0.0001 for 0.01%
}
