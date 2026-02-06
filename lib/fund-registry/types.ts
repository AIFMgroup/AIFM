/**
 * Fund Registry Type Definitions
 * 
 * Moderna typdefinitioner för fondhantering
 */

// ============================================================================
// Core Entity Types
// ============================================================================

export interface Fund {
  id: string;
  name: string;
  shortName?: string;
  legalName: string;
  isin: string;
  currency: Currency;
  status: FundStatus;
  type: FundType;
  
  // Regulatory
  ucits: boolean;
  aifmd: boolean;
  countryOfDomicile: string;
  regulatoryAuthority?: string;
  
  // Management
  fundManager?: string;
  investmentManager?: string;
  administrator?: string;
  custodian?: string;
  
  // Dates
  inceptionDate: string;
  fiscalYearEnd: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ShareClass {
  id: string;
  fundId: string;
  name: string;
  isin: string;
  currency: Currency;
  status: ShareClassStatus;
  
  // Fees
  managementFee: number;      // % per year
  performanceFee?: number;    // % of profit
  entryFee?: number;          // % on subscription
  exitFee?: number;           // % on redemption
  
  // Distribution
  distributionPolicy: 'accumulating' | 'distributing';
  dividendFrequency?: 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  
  // Subscription/Redemption
  minInitialInvestment?: number;
  minSubsequentInvestment?: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface NAVRecord {
  id: string;
  fundId: string;
  shareClassId: string;
  date: string;
  
  // NAV Values
  navPerShare: number;
  previousNav?: number;
  navChange?: number;          // Absolute change
  navChangePercent?: number;   // % change
  
  // Fund Level
  totalNetAssets: number;
  shareClassNetAssets: number;
  outstandingShares: number;
  
  // Source & Status
  source: NAVSource;
  status: NAVStatus;
  approvedBy?: string;
  approvedAt?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface Position {
  id: string;
  fundId: string;
  date: string;
  
  // Instrument
  instrumentId: string;
  instrumentName: string;
  instrumentType: InstrumentType;
  isin?: string;
  ticker?: string;
  
  // Holdings
  quantity: number;
  currency: Currency;
  
  // Valuation
  marketPrice: number;
  marketValue: number;
  marketValueBase: number;    // In fund currency
  
  // Cost
  costBasis?: number;
  averageCost?: number;
  unrealizedPL?: number;
  unrealizedPLPercent?: number;
  
  // Weight
  portfolioWeight?: number;   // % of total portfolio
  
  // Source
  source: DataSource;
  priceSource?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface CashBalance {
  id: string;
  fundId: string;
  date: string;
  
  currency: Currency;
  balance: number;
  balanceBase: number;        // In fund currency
  
  // Breakdown
  availableBalance: number;
  pendingInflows: number;
  pendingOutflows: number;
  reservedAmount: number;
  
  // Bank details
  bankAccountId?: string;
  bankName?: string;
  
  source: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  fundId: string;
  shareClassId: string;
  
  // Transaction Details
  type: TransactionType;
  status: TransactionStatus;
  
  // Amounts
  amount: number;
  currency: Currency;
  shares: number;
  navPerShare: number;
  
  // Fees
  fee?: number;
  feeType?: string;
  
  // Dates
  tradeDate: string;
  settlementDate: string;
  valueDate?: string;
  
  // Counterparty
  investorId: string;
  investorName: string;
  investorType?: InvestorType;
  
  // Reference
  externalRef?: string;
  internalRef: string;
  
  // Notes
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface Investor {
  id: string;
  name: string;
  type: InvestorType;
  
  // Contact
  email?: string;
  phone?: string;
  
  // Address
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  
  // Identification
  taxId?: string;
  legalEntityId?: string;     // LEI
  
  // KYC/AML
  kycStatus: KYCStatus;
  kycDate?: string;
  riskRating?: 'low' | 'medium' | 'high';
  
  // Classification
  mifidClassification?: 'retail' | 'professional' | 'eligible_counterparty';
  
  createdAt: string;
  updatedAt: string;
}

export interface Holding {
  investorId: string;
  investorName: string;
  fundId: string;
  shareClassId: string;
  
  shares: number;
  value: number;
  valueCurrency: Currency;
  
  percentageOfClass: number;
  percentageOfFund: number;
  
  acquisitionDate?: string;
  averageCost?: number;
  
  updatedAt: string;
}

// ============================================================================
// Enums & Types
// ============================================================================

export type Currency = 'SEK' | 'EUR' | 'USD' | 'NOK' | 'DKK' | 'GBP' | 'CHF' | 'JPY';

export type FundStatus = 'active' | 'suspended' | 'liquidating' | 'closed' | 'draft';

export type FundType = 
  | 'equity' 
  | 'fixed_income' 
  | 'mixed' 
  | 'money_market' 
  | 'alternative' 
  | 'real_estate'
  | 'commodity'
  | 'other';

export type ShareClassStatus = 'active' | 'soft_closed' | 'hard_closed' | 'suspended';

export type NAVSource = 'calculated' | 'manual' | 'imported' | 'external_provider';

export type NAVStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'corrected';

export type InstrumentType = 
  | 'equity' 
  | 'bond' 
  | 'etf' 
  | 'fund' 
  | 'derivative' 
  | 'fx_forward' 
  | 'cash' 
  | 'other';

export type DataSource = 'internal' | 'custodian' | 'broker' | 'manual' | 'imported';

export type TransactionType = 'subscription' | 'redemption' | 'switch_in' | 'switch_out' | 'dividend' | 'fee';

export type TransactionStatus = 'pending' | 'confirmed' | 'settled' | 'cancelled' | 'failed';

export type InvestorType = 
  | 'individual' 
  | 'institutional' 
  | 'fund_of_funds' 
  | 'pension_fund' 
  | 'insurance' 
  | 'bank'
  | 'corporate'
  | 'nominee';

export type KYCStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'review_required';

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// ============================================================================
// Report Types
// ============================================================================

export interface NAVReport {
  fund: Fund;
  shareClass: ShareClass;
  nav: NAVRecord;
  positions: Position[];
  cashBalances: CashBalance[];
  generatedAt: string;
}

export interface HoldingsReport {
  fund: Fund;
  shareClass: ShareClass;
  date: string;
  holdings: Holding[];
  totalShares: number;
  totalValue: number;
  generatedAt: string;
}

export interface TransactionReport {
  fund: Fund;
  shareClass: ShareClass;
  dateFrom: string;
  dateTo: string;
  transactions: Transaction[];
  summary: {
    subscriptions: { count: number; totalAmount: number; totalShares: number };
    redemptions: { count: number; totalAmount: number; totalShares: number };
    netFlow: number;
    netShares: number;
  };
  generatedAt: string;
}
