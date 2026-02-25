/**
 * Fund Administration Mock Data
 * Comprehensive data for the AIFM fund management system
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Fund {
  id: string;
  name: string;
  type: 'VENTURE_CAPITAL' | 'PRIVATE_EQUITY' | 'REAL_ESTATE' | 'HEDGE_FUND';
  currency: string;
  vintage: number;
  status: 'RAISING' | 'INVESTING' | 'HARVESTING' | 'LIQUIDATING';
  targetSize: number;
  committedCapital: number;
  calledCapital: number;
  distributedCapital: number;
  nav: number;
  irr: number;
  tvpi: number;
  dpi: number;
  managementFee: number;
  carriedInterest: number;
  createdAt: Date;
}

export interface Investor {
  id: string;
  name: string;
  type: 'INDIVIDUAL' | 'INSTITUTION' | 'FAMILY_OFFICE' | 'PENSION_FUND' | 'ENDOWMENT';
  email: string;
  phone: string;
  country: string;
  kycStatus: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  amlStatus: 'CLEAR' | 'FLAGGED' | 'REVIEWING';
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  pepStatus: boolean;
  taxId: string;
  createdAt: Date;
}

export interface Commitment {
  id: string;
  fundId: string;
  investorId: string;
  committedAmount: number;
  calledAmount: number;
  distributedAmount: number;
  remainingCommitment: number;
  ownershipPercentage: number;
  signedAt: Date;
  investor?: Investor;
  fund?: Fund;
}

export interface CapitalCall {
  id: string;
  fundId: string;
  callNumber: number;
  totalAmount: number;
  callDate: Date;
  dueDate: Date;
  purpose: string;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'FULLY_PAID' | 'OVERDUE';
  items: CapitalCallItem[];
}

export interface CapitalCallItem {
  id: string;
  capitalCallId: string;
  investorId: string;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';
  paidAt?: Date;
  investor?: Investor;
}

export interface Distribution {
  id: string;
  fundId: string;
  distributionNumber: number;
  totalAmount: number;
  distributionDate: Date;
  type: 'DIVIDEND' | 'RETURN_OF_CAPITAL' | 'PROFIT_DISTRIBUTION';
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  items: DistributionItem[];
}

export interface DistributionItem {
  id: string;
  distributionId: string;
  investorId: string;
  amount: number;
  investor?: Investor;
}

export interface PortfolioCompany {
  id: string;
  name: string;
  sector: string;
  country: string;
  investmentDate: Date;
  initialInvestment: number;
  currentValuation: number;
  ownership: number;
  status: 'ACTIVE' | 'REALIZED' | 'WRITTEN_OFF';
  metrics: {
    revenue?: number;
    ebitda?: number;
    employees?: number;
    growth?: number;
  };
  fundId: string;
}

export interface BankAccount {
  id: string;
  fundId: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  bic: string;
  currency: string;
  balance: number;
  type: 'OPERATING' | 'CUSTODY' | 'ESCROW';
  status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  lastSyncAt: Date;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: Date;
  amount: number;
  currency: string;
  type: 'CREDIT' | 'DEBIT';
  category: 'CAPITAL_CALL' | 'DISTRIBUTION' | 'INVESTMENT' | 'FEE' | 'EXPENSE' | 'OTHER';
  counterparty: string;
  reference: string;
  description: string;
  matched: boolean;
  matchedTo?: string;
}

export interface Invoice {
  id: string;
  fundId: string;
  vendorName: string;
  vendorId?: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  category: 'LEGAL' | 'AUDIT' | 'ADMIN' | 'MANAGEMENT_FEE' | 'OTHER';
  description: string;
  attachmentUrl?: string;
  approvedBy?: string;
  paidAt?: Date;
}

export interface LedgerEntry {
  id: string;
  fundId: string;
  date: Date;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  reference?: string;
  category: string;
  status: 'PENDING' | 'POSTED' | 'REVERSED';
  createdBy: string;
  approvedBy?: string;
}

export interface Document {
  id: string;
  fundId?: string;
  investorId?: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: 'LPA' | 'SUBSCRIPTION' | 'KYC' | 'REPORT' | 'STATEMENT' | 'TAX' | 'OTHER';
  uploadedAt: Date;
  uploadedBy: string;
  accessLevel: 'PUBLIC' | 'INVESTORS' | 'INTERNAL';
}

// ============================================================================
// MOCK DATA
// ============================================================================

export const mockFunds: Fund[] = [
  { id: 'auag-essential-metals', name: 'AuAg Essential Metals', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2022, status: 'INVESTING', targetSize: 500000000, committedCapital: 395000000, calledCapital: 395000000, distributedCapital: 0, nav: 395000000, irr: 12.5, tvpi: 1.25, dpi: 0, managementFee: 1.25, carriedInterest: 0, createdAt: new Date('2022-06-01') },
  { id: 'auag-gold-rush', name: 'AuAg Gold Rush', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2021, status: 'INVESTING', targetSize: 700000000, committedCapital: 606000000, calledCapital: 606000000, distributedCapital: 0, nav: 606000000, irr: 15.2, tvpi: 1.35, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2021-09-01') },
  { id: 'auag-precious-green', name: 'AuAg Precious Green', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2020, status: 'INVESTING', targetSize: 400000000, committedCapital: 347000000, calledCapital: 347000000, distributedCapital: 0, nav: 347000000, irr: 10.8, tvpi: 1.18, dpi: 0, managementFee: 1.25, carriedInterest: 0, createdAt: new Date('2020-11-01') },
  { id: 'auag-silver-bullet', name: 'AuAg Silver Bullet', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2020, status: 'INVESTING', targetSize: 5000000000, committedCapital: 4322000000, calledCapital: 4322000000, distributedCapital: 0, nav: 4322000000, irr: 18.7, tvpi: 1.45, dpi: 0, managementFee: 1.0, carriedInterest: 0, createdAt: new Date('2020-03-15') },
  { id: 'epoque', name: 'EPOQUE', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2023, status: 'INVESTING', targetSize: 300000000, committedCapital: 180000000, calledCapital: 180000000, distributedCapital: 0, nav: 180000000, irr: 8.5, tvpi: 1.10, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2023-01-15') },
  { id: 'go-blockchain-fund', name: 'Go Blockchain Fund', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2022, status: 'INVESTING', targetSize: 200000000, committedCapital: 120000000, calledCapital: 120000000, distributedCapital: 0, nav: 120000000, irr: 22.0, tvpi: 1.60, dpi: 0, managementFee: 2.0, carriedInterest: 20, createdAt: new Date('2022-04-01') },
  { id: 'metaspace-fund', name: 'MetaSpace Fund', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2023, status: 'INVESTING', targetSize: 150000000, committedCapital: 85000000, calledCapital: 85000000, distributedCapital: 0, nav: 85000000, irr: 14.3, tvpi: 1.28, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2023-06-01') },
  { id: 'plain-capital-bronx', name: 'Plain Capital BronX', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2018, status: 'INVESTING', targetSize: 1000000000, committedCapital: 750000000, calledCapital: 750000000, distributedCapital: 0, nav: 750000000, irr: 11.2, tvpi: 1.30, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2018-01-15') },
  { id: 'plain-capital-lunatix', name: 'Plain Capital LunatiX', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2019, status: 'INVESTING', targetSize: 800000000, committedCapital: 620000000, calledCapital: 620000000, distributedCapital: 0, nav: 620000000, irr: 9.8, tvpi: 1.22, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2019-03-01') },
  { id: 'plain-capital-styx', name: 'Plain Capital StyX', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2017, status: 'INVESTING', targetSize: 600000000, committedCapital: 480000000, calledCapital: 480000000, distributedCapital: 0, nav: 480000000, irr: 10.5, tvpi: 1.25, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2017-06-01') },
  { id: 'proethos-fond', name: 'Proethos Fond', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2016, status: 'INVESTING', targetSize: 500000000, committedCapital: 420000000, calledCapital: 420000000, distributedCapital: 0, nav: 420000000, irr: 9.2, tvpi: 1.18, dpi: 0, managementFee: 1.0, carriedInterest: 0, createdAt: new Date('2016-09-01') },
  { id: 'sam-aktiv-ranta', name: 'SAM Aktiv Ränta', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2021, status: 'INVESTING', targetSize: 300000000, committedCapital: 210000000, calledCapital: 210000000, distributedCapital: 0, nav: 210000000, irr: 4.5, tvpi: 1.08, dpi: 0, managementFee: 0.75, carriedInterest: 0, createdAt: new Date('2021-01-10') },
  { id: 'sensum-strategy-global', name: 'Sensum Strategy Global', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2020, status: 'INVESTING', targetSize: 400000000, committedCapital: 280000000, calledCapital: 280000000, distributedCapital: 0, nav: 280000000, irr: 13.1, tvpi: 1.32, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2020-05-01') },
  { id: 'soic-dynamic-china', name: 'SOIC Dynamic China', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2022, status: 'INVESTING', targetSize: 250000000, committedCapital: 150000000, calledCapital: 150000000, distributedCapital: 0, nav: 150000000, irr: 7.8, tvpi: 1.12, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2022-03-01') },
  { id: 'vinga-corporate-bond', name: 'Vinga Corporate Bond', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2021, status: 'INVESTING', targetSize: 500000000, committedCapital: 350000000, calledCapital: 350000000, distributedCapital: 0, nav: 350000000, irr: 5.2, tvpi: 1.10, dpi: 0, managementFee: 0.75, carriedInterest: 0, createdAt: new Date('2021-06-01') },
  { id: 'arte-collectum-i', name: 'Arte Collectum I AB', type: 'PRIVATE_EQUITY', currency: 'SEK', vintage: 2022, status: 'INVESTING', targetSize: 200000000, committedCapital: 120000000, calledCapital: 120000000, distributedCapital: 0, nav: 120000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2022-03-01') },
  { id: 'arte-collectum-ii', name: 'Arte Collectum II AB', type: 'PRIVATE_EQUITY', currency: 'SEK', vintage: 2024, status: 'INVESTING', targetSize: 200000000, committedCapital: 80000000, calledCapital: 80000000, distributedCapital: 0, nav: 80000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2024-04-01') },
  { id: 'estea-omsorgsfastigheter', name: 'Estea Omsorgsfastigheter', type: 'REAL_ESTATE', currency: 'SEK', vintage: 2024, status: 'INVESTING', targetSize: 500000000, committedCapital: 200000000, calledCapital: 200000000, distributedCapital: 0, nav: 200000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2024-01-01') },
  { id: 'lucy-global-fund', name: 'Lucy Global Fund', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2021, status: 'INVESTING', targetSize: 300000000, committedCapital: 150000000, calledCapital: 150000000, distributedCapital: 0, nav: 150000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2021-01-01') },
  { id: 'arden-xfund', name: 'Arden xFund', type: 'HEDGE_FUND', currency: 'SEK', vintage: 2013, status: 'INVESTING', targetSize: 200000000, committedCapital: 100000000, calledCapital: 100000000, distributedCapital: 0, nav: 100000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2013-01-01') },
  { id: 'sbp-kredit', name: 'SBP Kredit', type: 'PRIVATE_EQUITY', currency: 'SEK', vintage: 2020, status: 'INVESTING', targetSize: 500000000, committedCapital: 300000000, calledCapital: 300000000, distributedCapital: 0, nav: 300000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.0, carriedInterest: 0, createdAt: new Date('2020-01-01') },
  { id: 'ssid-co-invest-fund', name: 'SSID Co-Invest Fund', type: 'PRIVATE_EQUITY', currency: 'SEK', vintage: 2024, status: 'INVESTING', targetSize: 100000000, committedCapital: 50000000, calledCapital: 50000000, distributedCapital: 0, nav: 50000000, irr: 0, tvpi: 1.0, dpi: 0, managementFee: 1.5, carriedInterest: 20, createdAt: new Date('2024-01-01') },
];

export const mockInvestors: Investor[] = [
  {
    id: 'inv-1',
    name: 'Första AP-fonden',
    type: 'PENSION_FUND',
    email: 'investments@ap1.se',
    phone: '+46 8 555 17 100',
    country: 'Sweden',
    kycStatus: 'APPROVED',
    amlStatus: 'CLEAR',
    riskRating: 'LOW',
    pepStatus: false,
    taxId: 'SE802005-6142',
    createdAt: new Date('2022-01-15'),
  },
  {
    id: 'inv-2',
    name: 'Nordea Life & Pension',
    type: 'INSTITUTION',
    email: 'alternatives@nordea.com',
    phone: '+358 9 1651',
    country: 'Finland',
    kycStatus: 'APPROVED',
    amlStatus: 'CLEAR',
    riskRating: 'LOW',
    pepStatus: false,
    taxId: 'FI-0112305-2',
    createdAt: new Date('2022-02-20'),
  },
  {
    id: 'inv-3',
    name: 'Wallenberg Foundations',
    type: 'FAMILY_OFFICE',
    email: 'investments@wallenberg.org',
    phone: '+46 8 545 017 80',
    country: 'Sweden',
    kycStatus: 'APPROVED',
    amlStatus: 'CLEAR',
    riskRating: 'LOW',
    pepStatus: true,
    taxId: 'SE802001-5000',
    createdAt: new Date('2022-01-10'),
  },
  {
    id: 'inv-4',
    name: 'Copenhagen Infrastructure Partners',
    type: 'INSTITUTION',
    email: 'ir@cip.dk',
    phone: '+45 70 70 51 51',
    country: 'Denmark',
    kycStatus: 'APPROVED',
    amlStatus: 'CLEAR',
    riskRating: 'LOW',
    pepStatus: false,
    taxId: 'DK-30533505',
    createdAt: new Date('2022-03-05'),
  },
  {
    id: 'inv-5',
    name: 'Erik Lindström',
    type: 'INDIVIDUAL',
    email: 'erik.lindstrom@email.se',
    phone: '+46 70 123 45 67',
    country: 'Sweden',
    kycStatus: 'APPROVED',
    amlStatus: 'CLEAR',
    riskRating: 'MEDIUM',
    pepStatus: false,
    taxId: '196505121234',
    createdAt: new Date('2022-04-12'),
  },
  {
    id: 'inv-6',
    name: 'Oslo Pensjonskasse',
    type: 'PENSION_FUND',
    email: 'invest@opk.no',
    phone: '+47 22 87 56 00',
    country: 'Norway',
    kycStatus: 'IN_PROGRESS',
    amlStatus: 'REVIEWING',
    riskRating: 'LOW',
    pepStatus: false,
    taxId: 'NO-982463718',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'inv-7',
    name: 'Baltic Investment Group',
    type: 'FAMILY_OFFICE',
    email: 'office@balticinvest.ee',
    phone: '+372 6 311 400',
    country: 'Estonia',
    kycStatus: 'PENDING',
    amlStatus: 'FLAGGED',
    riskRating: 'HIGH',
    pepStatus: true,
    taxId: 'EE-101234567',
    createdAt: new Date('2024-02-01'),
  },
];

export const mockCommitments: Commitment[] = [];

export const mockCapitalCalls: CapitalCall[] = [];

export const mockDistributions: Distribution[] = [];

export const mockPortfolioCompanies: PortfolioCompany[] = [];

export const mockBankAccounts: BankAccount[] = [];

export const mockBankTransactions: BankTransaction[] = [];

export const mockInvoices: Invoice[] = [];

export const mockLedgerEntries: LedgerEntry[] = [];

export const mockDocuments: Document[] = [];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getFundById(id: string): Fund | undefined {
  return mockFunds.find(f => f.id === id);
}

export function getInvestorById(id: string): Investor | undefined {
  return mockInvestors.find(i => i.id === id);
}

export function getCommitmentsByFund(fundId: string): Commitment[] {
  return mockCommitments
    .filter(c => c.fundId === fundId)
    .map(c => ({
      ...c,
      investor: getInvestorById(c.investorId),
      fund: getFundById(c.fundId),
    }));
}

export function getCommitmentsByInvestor(investorId: string): Commitment[] {
  return mockCommitments
    .filter(c => c.investorId === investorId)
    .map(c => ({
      ...c,
      investor: getInvestorById(c.investorId),
      fund: getFundById(c.fundId),
    }));
}

export function getPortfolioByFund(fundId: string): PortfolioCompany[] {
  return mockPortfolioCompanies.filter(pc => pc.fundId === fundId);
}

export function getBankAccountsByFund(fundId: string): BankAccount[] {
  return mockBankAccounts.filter(ba => ba.fundId === fundId);
}

export function getTransactionsByAccount(accountId: string): BankTransaction[] {
  return mockBankTransactions.filter(bt => bt.accountId === accountId);
}

export function getInvoicesByFund(fundId: string): Invoice[] {
  return mockInvoices.filter(inv => inv.fundId === fundId);
}

export function getDocumentsByFund(fundId: string): Document[] {
  return mockDocuments.filter(doc => doc.fundId === fundId);
}

export function getDocumentsByInvestor(investorId: string): Document[] {
  return mockDocuments.filter(doc => doc.investorId === investorId || doc.accessLevel === 'INVESTORS');
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '–';
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// Calculate total stats
export function getFundStats() {
  const totalAUM = mockFunds.reduce((sum, f) => sum + f.nav, 0);
  const totalCommitted = mockFunds.reduce((sum, f) => sum + f.committedCapital, 0);
  const totalInvestors = new Set(mockCommitments.map(c => c.investorId)).size;
  const totalPortfolioCompanies = mockPortfolioCompanies.filter(pc => pc.status === 'ACTIVE').length;
  
  return {
    totalAUM,
    totalCommitted,
    totalInvestors,
    totalPortfolioCompanies,
    fundsCount: mockFunds.length,
  };
}

// Mapping between company IDs (from companyData) and fund IDs
const companyToFundMap: Record<string, string> = {};

export function getFundByCompanyId(companyId: string): Fund | undefined {
  const fundId = companyToFundMap[companyId];
  return fundId ? mockFunds.find(f => f.id === fundId) : undefined;
}

export function getPortfolioByCompanyId(companyId: string): PortfolioCompany[] {
  const fundId = companyToFundMap[companyId];
  return fundId ? getPortfolioByFund(fundId) : [];
}

export function getInvestorsByCompanyId(companyId: string): Investor[] {
  const fundId = companyToFundMap[companyId];
  if (!fundId) return [];
  // Get all investors who have commitments in this fund
  const fundCommitments = mockCommitments.filter(c => c.fundId === fundId);
  const investorIds = [...new Set(fundCommitments.map(c => c.investorId))];
  return mockInvestors.filter(i => investorIds.includes(i.id));
}

export function getCapitalCallsByCompanyId(companyId: string): CapitalCall[] {
  const fundId = companyToFundMap[companyId];
  return fundId ? mockCapitalCalls.filter(cc => cc.fundId === fundId) : [];
}

export function getDistributionsByCompanyId(companyId: string): Distribution[] {
  const fundId = companyToFundMap[companyId];
  return fundId ? mockDistributions.filter(d => d.fundId === fundId) : [];
}

export function getBankAccountsByCompanyId(companyId: string): BankAccount[] {
  const fundId = companyToFundMap[companyId];
  return fundId ? getBankAccountsByFund(fundId) : [];
}

export function getInvoicesByCompanyId(companyId: string): Invoice[] {
  const fundId = companyToFundMap[companyId];
  return fundId ? getInvoicesByFund(fundId) : [];
}

