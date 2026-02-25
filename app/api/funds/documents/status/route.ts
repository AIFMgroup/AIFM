/**
 * GET /api/funds/documents/status
 * Returns per-fund status: whether each fund has any documents and specifically fondvillkor.
 * Uses the same fund list as admin/scrape (mockFunds slug IDs) so it matches stored documents.
 */

import { NextResponse } from 'next/server';
import { getFundDocuments } from '@/lib/fund-documents/fund-document-store';
import { mockFunds } from '@/lib/fundData';
import { getFundRegistry } from '@/lib/fund-registry';

export interface FundDocumentStatus {
  fundId: string;
  fundName: string;
  documentCount: number;
  hasFondvillkor: boolean;
  categories: string[];
}

export async function GET() {
  try {
    // Prefer registry funds so we report on "all funds in system"; fallback to mockFunds (slug ids match scrape/admin)
    let funds: Array<{ id: string; name: string }> = [];
    try {
      const registry = getFundRegistry();
      const registryFunds = await registry.listFunds();
      if (registryFunds.length > 0) {
        funds = registryFunds.map((f) => ({ id: f.id, name: f.name }));
      }
    } catch {
      // ignore
    }
    if (funds.length === 0) {
      funds = mockFunds.map((f) => ({ id: f.id, name: f.name }));
    }

    const statuses: FundDocumentStatus[] = await Promise.all(
      funds.map(async (fund) => {
        const docs = await getFundDocuments(fund.id).catch(() => []);
        const categories = [...new Set(docs.map((d) => d.category))];
        const hasFondvillkor = docs.some((d) => d.category === 'fondvillkor');
        return {
          fundId: fund.id,
          fundName: fund.name,
          documentCount: docs.length,
          hasFondvillkor,
          categories,
        };
      }),
    );

    const withFondvillkor = statuses.filter((s) => s.hasFondvillkor).length;
    const withAnyDocs = statuses.filter((s) => s.documentCount > 0).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalFunds: statuses.length,
        fundsWithFondvillkor: withFondvillkor,
        fundsWithAnyDocuments: withAnyDocs,
        fundsMissingFondvillkor: statuses.length - withFondvillkor,
      },
      funds: statuses,
    });
  } catch (error) {
    console.error('[API funds/documents/status]', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte hämta dokumentstatus' },
      { status: 500 }
    );
  }
}
