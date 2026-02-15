/**
 * Client for /api/funds. Use useFundsData() in pages; helpers work on the returned data.
 * Types match lib/fundData.ts (dates come as ISO strings from API).
 */

import React from 'react';
import type {
  Fund,
  Investor,
  Commitment,
  CapitalCall,
  Distribution,
  PortfolioCompany,
  BankAccount,
  BankTransaction,
  Invoice,
  LedgerEntry,
  Document,
} from '@/lib/fundData';

export interface FundsApiResponse {
  funds: Fund[];
  investors: Investor[];
  commitments: Commitment[];
  capitalCalls: CapitalCall[];
  distributions: Distribution[];
  portfolioCompanies: PortfolioCompany[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  invoices: Invoice[];
  ledgerEntries: LedgerEntry[];
  documents: Document[];
  companyToFundMap: Record<string, string>;
}

let cached: FundsApiResponse | null = null;

export async function fetchFundsData(): Promise<FundsApiResponse> {
  if (cached) return cached;
  const res = await fetch('/api/funds');
  if (!res.ok) throw new Error('Failed to load fund data');
  const data = (await res.json()) as FundsApiResponse;
  cached = data;
  return data;
}

export function clearFundsCache(): void {
  cached = null;
}

// Helpers that operate on API response (dates may be ISO strings)
export function getCommitmentsByFund(data: FundsApiResponse, fundId: string): Commitment[] {
  const getInvestor = (id: string) => data.investors.find((i) => i.id === id);
  const getFund = (id: string) => data.funds.find((f) => f.id === id);
  return data.commitments
    .filter((c) => c.fundId === fundId)
    .map((c) => ({
      ...c,
      investor: getInvestor(c.investorId),
      fund: getFund(c.fundId),
    }));
}

export function getCommitmentsByInvestor(data: FundsApiResponse, investorId: string): Commitment[] {
  const getInvestor = (id: string) => data.investors.find((i) => i.id === id);
  const getFund = (id: string) => data.funds.find((f) => f.id === id);
  return data.commitments
    .filter((c) => c.investorId === investorId)
    .map((c) => ({
      ...c,
      investor: getInvestor(c.investorId),
      fund: getFund(c.fundId),
    }));
}

export function getPortfolioByFund(data: FundsApiResponse, fundId: string): PortfolioCompany[] {
  return data.portfolioCompanies.filter((pc) => pc.fundId === fundId);
}

export function getBankAccountsByFund(data: FundsApiResponse, fundId: string): BankAccount[] {
  return data.bankAccounts.filter((ba) => ba.fundId === fundId);
}

export function getTransactionsByAccount(data: FundsApiResponse, accountId: string): BankTransaction[] {
  return data.bankTransactions.filter((bt) => bt.accountId === accountId);
}

export function getInvestorsByCompanyId(data: FundsApiResponse, companyId: string): Investor[] {
  const fundId = data.companyToFundMap[companyId];
  if (!fundId) return [];
  const fundCommitments = data.commitments.filter((c) => c.fundId === fundId);
  const investorIds = [...new Set(fundCommitments.map((c) => c.investorId))];
  return data.investors.filter((i) => investorIds.includes(i.id));
}

export function getFundByCompanyId(data: FundsApiResponse, companyId: string): Fund | undefined {
  const fundId = data.companyToFundMap[companyId];
  return fundId ? data.funds.find((f) => f.id === fundId) : undefined;
}

export function getPortfolioByCompanyId(data: FundsApiResponse, companyId: string): PortfolioCompany[] {
  const fundId = data.companyToFundMap[companyId];
  return fundId ? getPortfolioByFund(data, fundId) : [];
}

export function getCapitalCallsByCompanyId(data: FundsApiResponse, companyId: string): CapitalCall[] {
  const fundId = data.companyToFundMap[companyId];
  return fundId ? data.capitalCalls.filter((cc) => cc.fundId === fundId) : [];
}

export function getDistributionsByCompanyId(data: FundsApiResponse, companyId: string): Distribution[] {
  const fundId = data.companyToFundMap[companyId];
  return fundId ? data.distributions.filter((d) => d.fundId === fundId) : [];
}

export function getBankAccountsByCompanyId(data: FundsApiResponse, companyId: string): BankAccount[] {
  const fundId = data.companyToFundMap[companyId];
  return fundId ? getBankAccountsByFund(data, fundId) : [];
}

export function getInvoicesByCompanyId(data: FundsApiResponse, companyId: string): Invoice[] {
  const fundId = data.companyToFundMap[companyId];
  return fundId ? data.invoices.filter((inv) => inv.fundId === fundId) : [];
}

export function getFundStats(data: FundsApiResponse) {
  const totalAUM = data.funds.reduce((sum, f) => sum + f.nav, 0);
  const totalCommitted = data.funds.reduce((sum, f) => sum + f.committedCapital, 0);
  const totalInvestors = new Set(data.commitments.map((c) => c.investorId)).size;
  const totalPortfolioCompanies = data.portfolioCompanies.filter((pc) => pc.status === 'ACTIVE').length;
  return {
    totalAUM,
    totalCommitted,
    totalInvestors,
    totalPortfolioCompanies,
    fundsCount: data.funds.length,
  };
}

// React hook for pages (use in client components only)
export function useFundsData() {
  const [data, setData] = React.useState<FundsApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFundsData()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
