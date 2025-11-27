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
  {
    id: 'fund-1',
    name: 'Nordic Growth Fund I',
    type: 'VENTURE_CAPITAL',
    currency: 'SEK',
    vintage: 2022,
    status: 'INVESTING',
    targetSize: 500000000,
    committedCapital: 425000000,
    calledCapital: 212500000,
    distributedCapital: 45000000,
    nav: 285000000,
    irr: 18.5,
    tvpi: 1.55,
    dpi: 0.21,
    managementFee: 2.0,
    carriedInterest: 20,
    createdAt: new Date('2022-03-15'),
  },
  {
    id: 'fund-2',
    name: 'Scandinavian Tech Fund II',
    type: 'VENTURE_CAPITAL',
    currency: 'EUR',
    vintage: 2023,
    status: 'RAISING',
    targetSize: 200000000,
    committedCapital: 145000000,
    calledCapital: 36250000,
    distributedCapital: 0,
    nav: 42000000,
    irr: 12.3,
    tvpi: 1.16,
    dpi: 0,
    managementFee: 2.0,
    carriedInterest: 20,
    createdAt: new Date('2023-06-01'),
  },
  {
    id: 'fund-3',
    name: 'Baltic Real Estate Fund',
    type: 'REAL_ESTATE',
    currency: 'EUR',
    vintage: 2021,
    status: 'HARVESTING',
    targetSize: 150000000,
    committedCapital: 150000000,
    calledCapital: 142500000,
    distributedCapital: 85000000,
    nav: 178000000,
    irr: 22.4,
    tvpi: 1.85,
    dpi: 0.60,
    managementFee: 1.5,
    carriedInterest: 20,
    createdAt: new Date('2021-01-10'),
  },
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

export const mockCommitments: Commitment[] = [
  // Fund 1 commitments
  { id: 'com-1', fundId: 'fund-1', investorId: 'inv-1', committedAmount: 100000000, calledAmount: 50000000, distributedAmount: 10000000, remainingCommitment: 50000000, ownershipPercentage: 23.5, signedAt: new Date('2022-03-20') },
  { id: 'com-2', fundId: 'fund-1', investorId: 'inv-2', committedAmount: 75000000, calledAmount: 37500000, distributedAmount: 8000000, remainingCommitment: 37500000, ownershipPercentage: 17.6, signedAt: new Date('2022-03-25') },
  { id: 'com-3', fundId: 'fund-1', investorId: 'inv-3', committedAmount: 125000000, calledAmount: 62500000, distributedAmount: 14000000, remainingCommitment: 62500000, ownershipPercentage: 29.4, signedAt: new Date('2022-03-18') },
  { id: 'com-4', fundId: 'fund-1', investorId: 'inv-4', committedAmount: 75000000, calledAmount: 37500000, distributedAmount: 8000000, remainingCommitment: 37500000, ownershipPercentage: 17.6, signedAt: new Date('2022-04-01') },
  { id: 'com-5', fundId: 'fund-1', investorId: 'inv-5', committedAmount: 50000000, calledAmount: 25000000, distributedAmount: 5000000, remainingCommitment: 25000000, ownershipPercentage: 11.8, signedAt: new Date('2022-04-15') },
  // Fund 2 commitments
  { id: 'com-6', fundId: 'fund-2', investorId: 'inv-1', committedAmount: 50000000, calledAmount: 12500000, distributedAmount: 0, remainingCommitment: 37500000, ownershipPercentage: 34.5, signedAt: new Date('2023-06-15') },
  { id: 'com-7', fundId: 'fund-2', investorId: 'inv-3', committedAmount: 75000000, calledAmount: 18750000, distributedAmount: 0, remainingCommitment: 56250000, ownershipPercentage: 51.7, signedAt: new Date('2023-06-20') },
  { id: 'com-8', fundId: 'fund-2', investorId: 'inv-5', committedAmount: 20000000, calledAmount: 5000000, distributedAmount: 0, remainingCommitment: 15000000, ownershipPercentage: 13.8, signedAt: new Date('2023-07-01') },
  // Fund 3 commitments
  { id: 'com-9', fundId: 'fund-3', investorId: 'inv-2', committedAmount: 50000000, calledAmount: 47500000, distributedAmount: 28000000, remainingCommitment: 2500000, ownershipPercentage: 33.3, signedAt: new Date('2021-02-01') },
  { id: 'com-10', fundId: 'fund-3', investorId: 'inv-4', committedAmount: 100000000, calledAmount: 95000000, distributedAmount: 57000000, remainingCommitment: 5000000, ownershipPercentage: 66.7, signedAt: new Date('2021-02-15') },
];

export const mockCapitalCalls: CapitalCall[] = [
  {
    id: 'cc-1',
    fundId: 'fund-1',
    callNumber: 5,
    totalAmount: 42500000,
    callDate: new Date('2024-11-01'),
    dueDate: new Date('2024-11-30'),
    purpose: 'Ny investering i TechStart AB',
    status: 'SENT',
    items: [
      { id: 'cci-1', capitalCallId: 'cc-1', investorId: 'inv-1', amount: 10000000, paidAmount: 10000000, status: 'PAID', paidAt: new Date('2024-11-15') },
      { id: 'cci-2', capitalCallId: 'cc-1', investorId: 'inv-2', amount: 7500000, paidAmount: 7500000, status: 'PAID', paidAt: new Date('2024-11-18') },
      { id: 'cci-3', capitalCallId: 'cc-1', investorId: 'inv-3', amount: 12500000, paidAmount: 12500000, status: 'PAID', paidAt: new Date('2024-11-12') },
      { id: 'cci-4', capitalCallId: 'cc-1', investorId: 'inv-4', amount: 7500000, paidAmount: 0, status: 'PENDING' },
      { id: 'cci-5', capitalCallId: 'cc-1', investorId: 'inv-5', amount: 5000000, paidAmount: 2500000, status: 'PARTIAL' },
    ],
  },
  {
    id: 'cc-2',
    fundId: 'fund-2',
    callNumber: 2,
    totalAmount: 14500000,
    callDate: new Date('2024-10-15'),
    dueDate: new Date('2024-11-15'),
    purpose: 'Uppföljningsinvestering i DataFlow',
    status: 'FULLY_PAID',
    items: [
      { id: 'cci-6', capitalCallId: 'cc-2', investorId: 'inv-1', amount: 5000000, paidAmount: 5000000, status: 'PAID', paidAt: new Date('2024-11-01') },
      { id: 'cci-7', capitalCallId: 'cc-2', investorId: 'inv-3', amount: 7500000, paidAmount: 7500000, status: 'PAID', paidAt: new Date('2024-10-28') },
      { id: 'cci-8', capitalCallId: 'cc-2', investorId: 'inv-5', amount: 2000000, paidAmount: 2000000, status: 'PAID', paidAt: new Date('2024-11-05') },
    ],
  },
];

export const mockDistributions: Distribution[] = [
  {
    id: 'dist-1',
    fundId: 'fund-1',
    distributionNumber: 2,
    totalAmount: 25000000,
    distributionDate: new Date('2024-09-30'),
    type: 'PROFIT_DISTRIBUTION',
    status: 'PAID',
    items: [
      { id: 'di-1', distributionId: 'dist-1', investorId: 'inv-1', amount: 5875000 },
      { id: 'di-2', distributionId: 'dist-1', investorId: 'inv-2', amount: 4400000 },
      { id: 'di-3', distributionId: 'dist-1', investorId: 'inv-3', amount: 7350000 },
      { id: 'di-4', distributionId: 'dist-1', investorId: 'inv-4', amount: 4400000 },
      { id: 'di-5', distributionId: 'dist-1', investorId: 'inv-5', amount: 2975000 },
    ],
  },
  {
    id: 'dist-2',
    fundId: 'fund-3',
    distributionNumber: 4,
    totalAmount: 35000000,
    distributionDate: new Date('2024-10-15'),
    type: 'RETURN_OF_CAPITAL',
    status: 'PAID',
    items: [
      { id: 'di-6', distributionId: 'dist-2', investorId: 'inv-2', amount: 11650000 },
      { id: 'di-7', distributionId: 'dist-2', investorId: 'inv-4', amount: 23350000 },
    ],
  },
];

export const mockPortfolioCompanies: PortfolioCompany[] = [
  {
    id: 'pc-1',
    name: 'TechStart AB',
    sector: 'Företagsmjukvara',
    country: 'Sweden',
    investmentDate: new Date('2022-06-15'),
    initialInvestment: 25000000,
    currentValuation: 45000000,
    ownership: 18.5,
    status: 'ACTIVE',
    metrics: { revenue: 35000000, ebitda: 5000000, employees: 85, growth: 45 },
    fundId: 'fund-1',
  },
  {
    id: 'pc-2',
    name: 'DataFlow Nordic',
    sector: 'Dataanalys',
    country: 'Finland',
    investmentDate: new Date('2022-09-01'),
    initialInvestment: 35000000,
    currentValuation: 72000000,
    ownership: 22.0,
    status: 'ACTIVE',
    metrics: { revenue: 48000000, ebitda: 12000000, employees: 120, growth: 62 },
    fundId: 'fund-1',
  },
  {
    id: 'pc-3',
    name: 'GreenEnergy Solutions',
    sector: 'CleanTech',
    country: 'Denmark',
    investmentDate: new Date('2023-01-20'),
    initialInvestment: 40000000,
    currentValuation: 55000000,
    ownership: 15.0,
    status: 'ACTIVE',
    metrics: { revenue: 62000000, ebitda: 8000000, employees: 95, growth: 28 },
    fundId: 'fund-1',
  },
  {
    id: 'pc-4',
    name: 'HealthTech Norge',
    sector: 'Hälsotech',
    country: 'Norway',
    investmentDate: new Date('2023-04-10'),
    initialInvestment: 30000000,
    currentValuation: 48000000,
    ownership: 20.0,
    status: 'ACTIVE',
    metrics: { revenue: 28000000, ebitda: 3000000, employees: 65, growth: 55 },
    fundId: 'fund-1',
  },
  {
    id: 'pc-5',
    name: 'LogiSmart',
    sector: 'Logistik',
    country: 'Sweden',
    investmentDate: new Date('2023-08-01'),
    initialInvestment: 20000000,
    currentValuation: 35000000,
    ownership: 12.0,
    status: 'ACTIVE',
    metrics: { revenue: 85000000, ebitda: 15000000, employees: 200, growth: 35 },
    fundId: 'fund-1',
  },
  {
    id: 'pc-6',
    name: 'Fintech Innovations',
    sector: 'FinTech',
    country: 'Estonia',
    investmentDate: new Date('2023-11-15'),
    initialInvestment: 15000000,
    currentValuation: 30000000,
    ownership: 10.0,
    status: 'ACTIVE',
    metrics: { revenue: 12000000, ebitda: -2000000, employees: 45, growth: 120 },
    fundId: 'fund-2',
  },
  {
    id: 'pc-7',
    name: 'CyberShield',
    sector: 'Cybersäkerhet',
    country: 'Sweden',
    investmentDate: new Date('2024-02-01'),
    initialInvestment: 22000000,
    currentValuation: 28000000,
    ownership: 15.0,
    status: 'ACTIVE',
    metrics: { revenue: 18000000, ebitda: 2000000, employees: 55, growth: 85 },
    fundId: 'fund-2',
  },
  {
    id: 'pc-8',
    name: 'Nordic Properties I',
    sector: 'Kommersiella fastigheter',
    country: 'Sweden',
    investmentDate: new Date('2021-04-01'),
    initialInvestment: 50000000,
    currentValuation: 68000000,
    ownership: 100,
    status: 'ACTIVE',
    metrics: { revenue: 8500000, ebitda: 6200000, employees: 5, growth: 8 },
    fundId: 'fund-3',
  },
  {
    id: 'pc-9',
    name: 'Baltic Logistics Hub',
    sector: 'Industrifastigheter',
    country: 'Latvia',
    investmentDate: new Date('2021-08-15'),
    initialInvestment: 45000000,
    currentValuation: 62000000,
    ownership: 100,
    status: 'ACTIVE',
    metrics: { revenue: 7200000, ebitda: 5400000, employees: 8, growth: 12 },
    fundId: 'fund-3',
  },
  {
    id: 'pc-10',
    name: 'Helsinki Office Park',
    sector: 'Kontorsfastigheter',
    country: 'Finland',
    investmentDate: new Date('2022-01-10'),
    initialInvestment: 40000000,
    currentValuation: 48000000,
    ownership: 100,
    status: 'ACTIVE',
    metrics: { revenue: 5800000, ebitda: 4200000, employees: 3, growth: 5 },
    fundId: 'fund-3',
  },
];

export const mockBankAccounts: BankAccount[] = [
  {
    id: 'ba-1',
    fundId: 'fund-1',
    bankName: 'SEB',
    accountNumber: '5201-12345678',
    iban: 'SE45 5000 0000 0520 1123 4567 8',
    bic: 'ESSESESS',
    currency: 'SEK',
    balance: 45680000,
    type: 'OPERATING',
    status: 'ACTIVE',
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'ba-2',
    fundId: 'fund-1',
    bankName: 'Swedbank',
    accountNumber: '8001-12345678',
    iban: 'SE35 8000 0800 1123 4567 8901',
    bic: 'SWEDSESS',
    currency: 'SEK',
    balance: 12500000,
    type: 'CUSTODY',
    status: 'ACTIVE',
    lastSyncAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    id: 'ba-3',
    fundId: 'fund-2',
    bankName: 'Nordea',
    accountNumber: '1234-56789012',
    iban: 'FI21 1234 5678 9012 34',
    bic: 'NDEAFIHH',
    currency: 'EUR',
    balance: 8750000,
    type: 'OPERATING',
    status: 'ACTIVE',
    lastSyncAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: 'ba-4',
    fundId: 'fund-3',
    bankName: 'Danske Bank',
    accountNumber: '3520-1234567890',
    iban: 'DK50 3520 1234 5678 90',
    bic: 'DABADKKK',
    currency: 'EUR',
    balance: 22400000,
    type: 'OPERATING',
    status: 'ACTIVE',
    lastSyncAt: new Date(Date.now() - 30 * 60 * 1000),
  },
];

export const mockBankTransactions: BankTransaction[] = [
  // Recent transactions for Fund 1
  { id: 'bt-1', accountId: 'ba-1', date: new Date('2024-11-25'), amount: 10000000, currency: 'SEK', type: 'CREDIT', category: 'CAPITAL_CALL', counterparty: 'Första AP-fonden', reference: 'CC5-INV1', description: 'Kapitalanrop #5 inbetalning', matched: true, matchedTo: 'cci-1' },
  { id: 'bt-2', accountId: 'ba-1', date: new Date('2024-11-24'), amount: 7500000, currency: 'SEK', type: 'CREDIT', category: 'CAPITAL_CALL', counterparty: 'Nordea Life & Pension', reference: 'CC5-INV2', description: 'Kapitalanrop #5 inbetalning', matched: true, matchedTo: 'cci-2' },
  { id: 'bt-3', accountId: 'ba-1', date: new Date('2024-11-23'), amount: 12500000, currency: 'SEK', type: 'CREDIT', category: 'CAPITAL_CALL', counterparty: 'Wallenberg Foundations', reference: 'CC5-INV3', description: 'Kapitalanrop #5 inbetalning', matched: true, matchedTo: 'cci-3' },
  { id: 'bt-4', accountId: 'ba-1', date: new Date('2024-11-22'), amount: 2500000, currency: 'SEK', type: 'CREDIT', category: 'CAPITAL_CALL', counterparty: 'Erik Lindström', reference: 'CC5-PARTIAL', description: 'Kapitalanrop #5 delbetalning', matched: true, matchedTo: 'cci-5' },
  { id: 'bt-5', accountId: 'ba-1', date: new Date('2024-11-20'), amount: 850000, currency: 'SEK', type: 'DEBIT', category: 'FEE', counterparty: 'Fund Admin AB', reference: 'MGMT-Q4-2024', description: 'Q4 2024 Management fee', matched: true },
  { id: 'bt-6', accountId: 'ba-1', date: new Date('2024-11-18'), amount: 125000, currency: 'SEK', type: 'DEBIT', category: 'EXPENSE', counterparty: 'Advokatfirman Lindahl', reference: 'INV-2024-1234', description: 'Juridiska tjänster - TechStart transaktion', matched: true },
  { id: 'bt-7', accountId: 'ba-1', date: new Date('2024-11-15'), amount: 45000, currency: 'SEK', type: 'DEBIT', category: 'EXPENSE', counterparty: 'KPMG', reference: 'AUDIT-2024', description: 'Kvartalsvis revisionsgranskning', matched: true },
  { id: 'bt-8', accountId: 'ba-1', date: new Date('2024-11-10'), amount: 25000000, currency: 'SEK', type: 'DEBIT', category: 'INVESTMENT', counterparty: 'TechStart AB', reference: 'INV-TS-002', description: 'Uppföljningsinvestering', matched: true },
  // Unmatched transaction
  { id: 'bt-9', accountId: 'ba-1', date: new Date('2024-11-08'), amount: 15000, currency: 'SEK', type: 'CREDIT', category: 'OTHER', counterparty: 'Okänd avsändare', reference: 'REF12345', description: 'Inkommande betalning', matched: false },
  // Fund 2 transactions
  { id: 'bt-10', accountId: 'ba-3', date: new Date('2024-11-20'), amount: 5000000, currency: 'EUR', type: 'CREDIT', category: 'CAPITAL_CALL', counterparty: 'Första AP-fonden', reference: 'CC2-F2-INV1', description: 'Kapitalanrop #2 inbetalning', matched: true },
  { id: 'bt-11', accountId: 'ba-3', date: new Date('2024-11-15'), amount: 200000, currency: 'EUR', type: 'DEBIT', category: 'FEE', counterparty: 'Fund Admin AB', reference: 'MGMT-F2-Q4', description: 'Q4 2024 Management fee', matched: true },
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    fundId: 'fund-1',
    vendorName: 'Advokatfirman Lindahl',
    invoiceNumber: 'LIN-2024-5678',
    amount: 185000,
    currency: 'SEK',
    issueDate: new Date('2024-11-20'),
    dueDate: new Date('2024-12-20'),
    status: 'PENDING',
    category: 'LEGAL',
    description: 'Juridiska tjänster - Q4 2024 fondcompliance granskning',
  },
  {
    id: 'inv-2',
    fundId: 'fund-1',
    vendorName: 'KPMG',
    invoiceNumber: 'KPMG-2024-9012',
    amount: 245000,
    currency: 'SEK',
    issueDate: new Date('2024-11-15'),
    dueDate: new Date('2024-12-15'),
    status: 'APPROVED',
    category: 'AUDIT',
    description: 'Årsrevision 2024',
    approvedBy: 'Anna Svensson',
  },
  {
    id: 'inv-3',
    fundId: 'fund-1',
    vendorName: 'Fund Admin AB',
    invoiceNumber: 'FA-2024-Q4',
    amount: 850000,
    currency: 'SEK',
    issueDate: new Date('2024-11-01'),
    dueDate: new Date('2024-11-30'),
    status: 'PAID',
    category: 'ADMIN',
    description: 'Q4 2024 Fondadministration',
    approvedBy: 'Carl Johansson',
    paidAt: new Date('2024-11-20'),
  },
  {
    id: 'inv-4',
    fundId: 'fund-2',
    vendorName: 'PWC',
    invoiceNumber: 'PWC-2024-3456',
    amount: 75000,
    currency: 'EUR',
    issueDate: new Date('2024-11-18'),
    dueDate: new Date('2024-12-18'),
    status: 'PENDING',
    category: 'AUDIT',
    description: 'Skattegranskning',
  },
  {
    id: 'inv-5',
    fundId: 'fund-3',
    vendorName: 'Colliers',
    invoiceNumber: 'COL-2024-7890',
    amount: 125000,
    currency: 'EUR',
    issueDate: new Date('2024-11-10'),
    dueDate: new Date('2024-12-10'),
    status: 'APPROVED',
    category: 'OTHER',
    description: 'Fastighetsvärdering Q4 2024',
    approvedBy: 'Eva Larsson',
  },
];

export const mockLedgerEntries: LedgerEntry[] = [
  { id: 'le-1', fundId: 'fund-1', date: new Date('2024-11-25'), description: 'Capital Call #5 - Första AP-fonden', debitAccount: 'Bank - SEB', creditAccount: 'LP Capital - AP1', amount: 10000000, currency: 'SEK', reference: 'CC5-INV1', category: 'CAPITAL_CALL', status: 'POSTED', createdBy: 'System', approvedBy: 'Anna Svensson' },
  { id: 'le-2', fundId: 'fund-1', date: new Date('2024-11-24'), description: 'Capital Call #5 - Nordea Life', debitAccount: 'Bank - SEB', creditAccount: 'LP Capital - Nordea', amount: 7500000, currency: 'SEK', reference: 'CC5-INV2', category: 'CAPITAL_CALL', status: 'POSTED', createdBy: 'System', approvedBy: 'Anna Svensson' },
  { id: 'le-3', fundId: 'fund-1', date: new Date('2024-11-20'), description: 'Management Fee Q4 2024', debitAccount: 'Management Fee Expense', creditAccount: 'Bank - SEB', amount: 850000, currency: 'SEK', reference: 'MGMT-Q4-2024', category: 'EXPENSE', status: 'POSTED', createdBy: 'System', approvedBy: 'Carl Johansson' },
  { id: 'le-4', fundId: 'fund-1', date: new Date('2024-11-18'), description: 'Legal Services - Lindahl', debitAccount: 'Legal Expenses', creditAccount: 'Accounts Payable', amount: 125000, currency: 'SEK', reference: 'INV-2024-1234', category: 'EXPENSE', status: 'POSTED', createdBy: 'AI Agent', approvedBy: 'Anna Svensson' },
  { id: 'le-5', fundId: 'fund-1', date: new Date('2024-11-10'), description: 'Investment - TechStart AB', debitAccount: 'Investments - TechStart', creditAccount: 'Bank - SEB', amount: 25000000, currency: 'SEK', reference: 'INV-TS-002', category: 'INVESTMENT', status: 'POSTED', createdBy: 'System', approvedBy: 'Anna Svensson' },
  { id: 'le-6', fundId: 'fund-1', date: new Date('2024-11-25'), description: 'Legal Services - Compliance Review', debitAccount: 'Legal Expenses', creditAccount: 'Accounts Payable', amount: 185000, currency: 'SEK', reference: 'LIN-2024-5678', category: 'EXPENSE', status: 'PENDING', createdBy: 'AI Agent' },
];

export const mockDocuments: Document[] = [
  { id: 'doc-1', fundId: 'fund-1', title: 'Kommanditbolagsavtal', fileName: 'NGF1_LPA_2022.pdf', fileType: 'application/pdf', fileSize: 2500000, category: 'LPA', uploadedAt: new Date('2022-03-15'), uploadedBy: 'Admin', accessLevel: 'INVESTORS' },
  { id: 'doc-2', fundId: 'fund-1', title: 'Q3 2024 Kvartalsrapport', fileName: 'NGF1_Q3_2024_Report.pdf', fileType: 'application/pdf', fileSize: 1800000, category: 'REPORT', uploadedAt: new Date('2024-10-15'), uploadedBy: 'Admin', accessLevel: 'INVESTORS' },
  { id: 'doc-3', fundId: 'fund-1', title: 'Q2 2024 Kvartalsrapport', fileName: 'NGF1_Q2_2024_Report.pdf', fileType: 'application/pdf', fileSize: 1650000, category: 'REPORT', uploadedAt: new Date('2024-07-15'), uploadedBy: 'Admin', accessLevel: 'INVESTORS' },
  { id: 'doc-4', fundId: 'fund-1', investorId: 'inv-1', title: 'Capital Account Statement Q3 2024', fileName: 'AP1_Statement_Q3_2024.pdf', fileType: 'application/pdf', fileSize: 450000, category: 'STATEMENT', uploadedAt: new Date('2024-10-20'), uploadedBy: 'System', accessLevel: 'INVESTORS' },
  { id: 'doc-5', investorId: 'inv-1', title: 'KYC Documentation', fileName: 'AP1_KYC_2024.pdf', fileType: 'application/pdf', fileSize: 3200000, category: 'KYC', uploadedAt: new Date('2024-01-15'), uploadedBy: 'Compliance', accessLevel: 'INTERNAL' },
  { id: 'doc-6', fundId: 'fund-2', title: 'Scandinavian Tech Fund II - PPM', fileName: 'STF2_PPM_2023.pdf', fileType: 'application/pdf', fileSize: 4500000, category: 'LPA', uploadedAt: new Date('2023-06-01'), uploadedBy: 'Admin', accessLevel: 'INVESTORS' },
  { id: 'doc-7', fundId: 'fund-1', investorId: 'inv-5', title: 'Subscription Agreement', fileName: 'Lindstrom_Subscription_2022.pdf', fileType: 'application/pdf', fileSize: 850000, category: 'SUBSCRIPTION', uploadedAt: new Date('2022-04-15'), uploadedBy: 'Admin', accessLevel: 'INTERNAL' },
];

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

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
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

