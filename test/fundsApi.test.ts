/**
 * Unit tests for funds API helpers (getFundStats, getCommitmentsByFund, getPortfolioByFund, etc.)
 */

import { describe, expect, test } from 'vitest';
import {
  getFundStats,
  getCommitmentsByFund,
  getPortfolioByFund,
  getBankAccountsByFund,
  getInvestorsByCompanyId,
  getFundByCompanyId,
  type FundsApiResponse,
} from '../lib/fundsApi';

const mockFundsData: FundsApiResponse = {
  funds: [
    { id: 'f1', name: 'Fund A', type: 'VENTURE_CAPITAL', currency: 'SEK', vintage: 2022, status: 'INVESTING', targetSize: 100, committedCapital: 80, calledCapital: 40, distributedCapital: 10, nav: 50, irr: 10, tvpi: 1.2, dpi: 0.1, managementFee: 2, carriedInterest: 20, createdAt: new Date('2022-01-01') },
    { id: 'f2', name: 'Fund B', type: 'PRIVATE_EQUITY', currency: 'EUR', vintage: 2023, status: 'RAISING', targetSize: 200, committedCapital: 100, calledCapital: 0, distributedCapital: 0, nav: 100, irr: 0, tvpi: 1, dpi: 0, managementFee: 2, carriedInterest: 20, createdAt: new Date('2023-01-01') },
  ],
  investors: [
    { id: 'i1', name: 'Inv 1', type: 'PENSION_FUND', email: 'a@b.se', phone: '', country: 'SE', kycStatus: 'APPROVED', amlStatus: 'CLEAR', riskRating: 'LOW', pepStatus: false, taxId: '', createdAt: new Date() },
  ],
  commitments: [
    { id: 'c1', fundId: 'f1', investorId: 'i1', committedAmount: 50, calledAmount: 25, distributedAmount: 5, remainingCommitment: 20, ownershipPercentage: 10, signedAt: new Date() },
  ],
  capitalCalls: [],
  distributions: [],
  portfolioCompanies: [
    { id: 'p1', name: 'Co 1', sector: 'Tech', country: 'SE', investmentDate: new Date(), initialInvestment: 10, currentValuation: 15, ownership: 5, status: 'ACTIVE', metrics: {}, fundId: 'f1' },
  ],
  bankAccounts: [
    { id: 'b1', fundId: 'f1', bankName: 'Bank', accountNumber: '1', iban: '', bic: '', currency: 'SEK', balance: 1000, type: 'OPERATING', status: 'ACTIVE', lastSyncAt: new Date() },
  ],
  bankTransactions: [],
  invoices: [],
  ledgerEntries: [],
  documents: [],
  companyToFundMap: { 'company-1': 'f1' },
};

describe('fundsApi', () => {
  test('getFundStats returns correct aggregates', () => {
    const stats = getFundStats(mockFundsData);
    expect(stats.fundsCount).toBe(2);
    expect(stats.totalAUM).toBe(150);
    expect(stats.totalCommitted).toBe(180);
    expect(stats.totalInvestors).toBe(1);
    expect(stats.totalPortfolioCompanies).toBe(1);
  });

  test('getCommitmentsByFund filters by fundId', () => {
    const list = getCommitmentsByFund(mockFundsData, 'f1');
    expect(list).toHaveLength(1);
    expect(list[0].fundId).toBe('f1');
    expect(getCommitmentsByFund(mockFundsData, 'f2')).toHaveLength(0);
  });

  test('getPortfolioByFund filters by fundId', () => {
    const list = getPortfolioByFund(mockFundsData, 'f1');
    expect(list).toHaveLength(1);
    expect(list[0].fundId).toBe('f1');
  });

  test('getBankAccountsByFund filters by fundId', () => {
    const list = getBankAccountsByFund(mockFundsData, 'f1');
    expect(list).toHaveLength(1);
    expect(list[0].fundId).toBe('f1');
  });

  test('getFundByCompanyId returns fund for mapped company', () => {
    const fund = getFundByCompanyId(mockFundsData, 'company-1');
    expect(fund?.id).toBe('f1');
    expect(getFundByCompanyId(mockFundsData, 'unknown')).toBeUndefined();
  });

  test('getInvestorsByCompanyId returns investors with commitments in fund', () => {
    const list = getInvestorsByCompanyId(mockFundsData, 'company-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('i1');
  });
});
