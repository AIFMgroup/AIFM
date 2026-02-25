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
  type Fund,
} from '@/lib/fundData';

const COMPANY_TO_FUND_MAP: Record<string, string> = {};

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
 * Returns all fund-related data for dashboard pages.
 * Enriches mock funds with ISEC NAV data when available.
 */
export async function GET() {
  try {
    let funds = serializeDates(mockFunds) as Fund[];

    // Enrich funds with real ISEC NAV data
    try {
      const { getISECFunds } = await import('@/lib/integrations/isec/isec-data-service');
      const isecFunds = await getISECFunds();
      if (isecFunds.length > 0) {
        const isecByName = new Map(isecFunds.map(f => [f.name.toLowerCase(), f]));
        const isecById = new Map(isecFunds.map(f => [f.id, f]));

        funds = funds.map(f => {
          const match = isecById.get(f.id) || isecByName.get(f.name.toLowerCase());
          if (match && match.totalNav) {
            return { ...f, nav: match.totalNav };
          }
          return f;
        });

        // Add ISEC-only funds not in mock data
        const existingIds = new Set(funds.map(f => f.id));
        const existingNames = new Set(funds.map(f => f.name.toLowerCase()));
        for (const isecFund of isecFunds) {
          if (!existingIds.has(isecFund.id) && !existingNames.has(isecFund.name.toLowerCase())) {
            funds.push({
              id: isecFund.id,
              name: isecFund.name,
              type: 'HEDGE_FUND',
              currency: isecFund.currency || 'SEK',
              vintage: new Date().getFullYear(),
              status: 'INVESTING',
              targetSize: 0,
              committedCapital: 0,
              calledCapital: 0,
              distributedCapital: 0,
              nav: isecFund.totalNav || 0,
              irr: 0,
              tvpi: 1,
              dpi: 0,
              managementFee: 0,
            } as Fund);
          }
        }
      }
    } catch (err) {
      console.warn('[API funds] ISEC enrichment skipped:', err);
    }

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
