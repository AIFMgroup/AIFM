/**
 * ISEC SECURA REST API - Type Definitions
 * 
 * Typdefinitioner för SECURA Platform API responses
 * Dokumentation: https://www.isec.com/our-offerings-isec/secura-platform/secura-reporting
 */

// ============================================================================
// Authentication & Connection
// ============================================================================

export interface SecuraConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number; // milliseconds
  retryAttempts?: number;
}

export interface SecuraAuthResponse {
  token: string;
  expiresAt: string;
  refreshToken?: string;
}

export interface SecuraConnectionStatus {
  connected: boolean;
  lastConnected?: string;
  error?: string;
  version?: string;
}

// ============================================================================
// Fund Data
// ============================================================================

export interface SecuraFund {
  fundId: string;
  fundCode: string;
  name: string;
  legalName: string;
  isin: string;
  currency: string;
  fundType: 'UCITS' | 'AIF' | 'SPECIAL';
  status: 'ACTIVE' | 'INACTIVE' | 'LIQUIDATING';
  inceptionDate: string;
  managementCompany: string;
  depositary: string;
  auditor?: string;
  
  // Share classes
  shareClasses: SecuraShareClass[];
}

export interface SecuraShareClass {
  shareClassId: string;
  shareClassCode: string;
  name: string;
  isin: string;
  currency: string;
  hedged: boolean;
  distributionPolicy: 'ACC' | 'DIST'; // Accumulating or Distributing
  minInvestment?: number;
  managementFee: number; // Percentage (e.g., 0.015 for 1.5%)
  performanceFee?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
}

// ============================================================================
// Positions & Holdings
// ============================================================================

export interface SecuraPosition {
  positionId: string;
  fundId: string;
  securityId: string;
  isin: string;
  securityName: string;
  securityType: SecuraSecurityType;
  
  // Quantities
  quantity: number;
  nominalValue?: number;
  
  // Valuation
  price: number;
  priceCurrency: string;
  priceDate: string;
  priceSource: string;
  marketValue: number;
  marketValueFundCurrency: number;
  
  // Cost basis
  averageCost: number;
  totalCost: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  
  // Accruals
  accruedInterest?: number;
  accruedDividend?: number;
  
  // Classification
  country: string;
  sector?: string;
  assetClass: string;
  
  // Dates
  tradeDate?: string;
  settlementDate?: string;
}

export type SecuraSecurityType = 
  | 'EQUITY'
  | 'BOND'
  | 'FUND'
  | 'ETF'
  | 'DERIVATIVE'
  | 'FX_FORWARD'
  | 'OPTION'
  | 'FUTURE'
  | 'WARRANT'
  | 'CERTIFICATE'
  | 'MONEY_MARKET'
  | 'CASH'
  | 'OTHER';

// ============================================================================
// Cash & Bank Balances
// ============================================================================

export interface SecuraCashBalance {
  accountId: string;
  fundId: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  balance: number;
  balanceFundCurrency: number;
  availableBalance: number;
  valueDate: string;
  accountType: 'CUSTODY' | 'SETTLEMENT' | 'MARGIN' | 'COLLATERAL';
}

export interface SecuraCashSummary {
  fundId: string;
  totalCash: number;
  totalCashFundCurrency: number;
  balancesByCurrency: {
    currency: string;
    balance: number;
    balanceFundCurrency: number;
    fxRate: number;
  }[];
  accounts: SecuraCashBalance[];
}

// ============================================================================
// NAV Data
// ============================================================================

export interface SecuraNAV {
  fundId: string;
  shareClassId: string;
  navDate: string;
  calculationDate: string;
  status: 'PRELIMINARY' | 'OFFICIAL' | 'CORRECTED';
  
  // NAV breakdown
  grossAssets: number;
  totalLiabilities: number;
  netAssetValue: number;
  
  // Per share
  sharesOutstanding: number;
  navPerShare: number;
  previousNavPerShare?: number;
  navChange: number;
  navChangePercent: number;
  
  // Asset breakdown
  assetBreakdown: {
    equities: number;
    bonds: number;
    funds: number;
    derivatives: number;
    cash: number;
    other: number;
  };
  
  // Liability breakdown
  liabilityBreakdown: {
    managementFee: number;
    performanceFee: number;
    depositaryFee: number;
    adminFee: number;
    auditFee: number;
    otherExpenses: number;
    pendingRedemptions: number;
    otherLiabilities: number;
  };
  
  // Accruals
  accruals: {
    accruedIncome: number;
    accruedExpenses: number;
    dividendsReceivable: number;
    interestReceivable: number;
  };
}

export interface SecuraNAVHistory {
  fundId: string;
  shareClassId: string;
  history: {
    date: string;
    navPerShare: number;
    sharesOutstanding: number;
    netAssetValue: number;
    aum: number;
  }[];
}

// ============================================================================
// Transactions
// ============================================================================

export interface SecuraTransaction {
  transactionId: string;
  fundId: string;
  transactionType: SecuraTransactionType;
  securityId?: string;
  isin?: string;
  securityName?: string;
  
  // Transaction details
  tradeDate: string;
  settlementDate: string;
  quantity: number;
  price: number;
  grossAmount: number;
  commission?: number;
  fees?: number;
  netAmount: number;
  currency: string;
  
  // Status
  status: 'PENDING' | 'SETTLED' | 'CANCELLED' | 'FAILED';
  
  // Counterparty
  broker?: string;
  counterparty?: string;
  
  // Reference
  externalReference?: string;
  internalReference?: string;
}

export type SecuraTransactionType =
  | 'BUY'
  | 'SELL'
  | 'SUBSCRIPTION'
  | 'REDEMPTION'
  | 'DIVIDEND'
  | 'INTEREST'
  | 'FX_SPOT'
  | 'FX_FORWARD'
  | 'CORPORATE_ACTION'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FEE'
  | 'OTHER';

// ============================================================================
// Shareholders & Orders
// ============================================================================

export interface SecuraShareholder {
  shareholderId: string;
  fundId: string;
  shareClassId: string;
  
  // Investor info
  investorType: 'INDIVIDUAL' | 'INSTITUTIONAL' | 'FUND' | 'NOMINEE';
  name: string;
  country: string;
  
  // Holdings
  shares: number;
  sharesPercent: number;
  marketValue: number;
  averageCost?: number;
  
  // Dates
  firstInvestmentDate?: string;
  lastTransactionDate?: string;
}

export interface SecuraSubscriptionOrder {
  orderId: string;
  fundId: string;
  shareClassId: string;
  shareholderId: string;
  
  orderType: 'SUBSCRIPTION' | 'REDEMPTION' | 'SWITCH';
  orderDate: string;
  valueDate: string;
  
  // Order details
  amount?: number; // For subscriptions
  shares?: number; // For redemptions
  navPerShare?: number;
  settledShares?: number;
  settledAmount?: number;
  
  status: 'PENDING' | 'PROCESSING' | 'SETTLED' | 'CANCELLED' | 'REJECTED';
  
  // Payment
  paymentStatus?: 'PENDING' | 'RECEIVED' | 'PAID';
  paymentReference?: string;
}

// ============================================================================
// Prices & Market Data
// ============================================================================

export interface SecuraPrice {
  securityId: string;
  isin: string;
  priceDate: string;
  
  // Prices
  price: number;
  bidPrice?: number;
  askPrice?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  closePrice?: number;
  
  currency: string;
  priceSource: string;
  priceType: 'CLOSE' | 'BID' | 'ASK' | 'MID' | 'LAST' | 'NAV';
  
  // Volume
  volume?: number;
  turnover?: number;
}

export interface SecuraFXRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  rateDate: string;
  source: string;
}

// ============================================================================
// Reports
// ============================================================================

export interface SecuraReport {
  reportId: string;
  reportType: SecuraReportType;
  fundId: string;
  reportDate: string;
  generatedAt: string;
  status: 'PENDING' | 'GENERATED' | 'FAILED';
  downloadUrl?: string;
  format: 'PDF' | 'EXCEL' | 'CSV' | 'XML';
}

export type SecuraReportType =
  | 'NAV_REPORT'
  | 'POSITION_REPORT'
  | 'TRANSACTION_REPORT'
  | 'SHAREHOLDER_REGISTER'
  | 'PRIIPS_KID'
  | 'MONTHLY_REPORT'
  | 'ANNUAL_REPORT';

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface SecuraApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
  errors?: SecuraApiError[];
}

export interface SecuraApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface SecuraQueryParams {
  fundId?: string;
  shareClassId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface SecuraPositionQuery extends SecuraQueryParams {
  securityType?: SecuraSecurityType;
  includeZeroPositions?: boolean;
}

export interface SecuraTransactionQuery extends SecuraQueryParams {
  transactionType?: SecuraTransactionType;
  status?: string;
}

export interface SecuraNAVQuery extends SecuraQueryParams {
  status?: 'PRELIMINARY' | 'OFFICIAL' | 'CORRECTED';
}
