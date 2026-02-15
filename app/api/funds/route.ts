import { NextResponse } from 'next/server';
import {
  mockFunds,
  mockInvestors,
  mockCommitments,
  mockCapitalCalls,
  mockDistributions,
  mockPortfolioCompanies,
  mockBankAccounts,
  mockBankTransactions,
  mockInvoices,
  mockLedgerEntries,
  mockDocuments,
} from '@/lib/fundData';

// Company ID -> Fund ID mapping (mirrors fundData.ts for use by clients)
const COMPANY_TO_FUND_MAP: Record<string, string> = {
  'company-1': 'fund-1',
  'company-2': 'fund-2',
  'company-3': 'fund-3',
  'company-4': 'fund-4',
  'company-5': 'fund-5',
};

function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = v instanceof Date ? v.toISOString() : serializeDates(v);
    }
    return out as T;
  }
  return obj;
}

/**
 * GET /api/funds
 * Returns all fund-related data for dashboard pages (fund, portfolio, investors, treasury, nav-calculation, capital-calls, distributions).
 * Data can later be sourced from DynamoDB/PostgreSQL; for now returns mock data from fundData.
 */
export async function GET() {
  try {
    const funds = serializeDates(mockFunds);
    const investors = serializeDates(mockInvestors);
    const commitments = serializeDates(mockCommitments);
    const capitalCalls = serializeDates(mockCapitalCalls);
    const distributions = serializeDates(mockDistributions);
    const portfolioCompanies = serializeDates(mockPortfolioCompanies);
    const bankAccounts = serializeDates(mockBankAccounts);
    const bankTransactions = serializeDates(mockBankTransactions);
    const invoices = serializeDates(mockInvoices);
    const ledgerEntries = serializeDates(mockLedgerEntries);
    const documents = serializeDates(mockDocuments);

    return NextResponse.json({
      funds,
      investors,
      commitments,
      capitalCalls,
      distributions,
      portfolioCompanies,
      bankAccounts,
      bankTransactions,
      invoices,
      ledgerEntries,
      documents,
      companyToFundMap: COMPANY_TO_FUND_MAP,
    });
  } catch (error) {
    console.error('[API funds]', error);
    return NextResponse.json(
      { error: 'Failed to load fund data' },
      { status: 500 }
    );
  }
}
