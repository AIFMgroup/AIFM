import { NextRequest, NextResponse } from 'next/server';
import { getOpenFIGIClient } from '@/lib/integrations/securities/openfigi-client';
import { collectCompanyData } from '@/lib/company-analysis/orchestrator';
import type { CompleteCompanyAnalysis, CompanyAnalysisCompareRequest } from '@/lib/company-analysis/types';

const MAX_COMPARE = 3;

/**
 * Resolve a single identifier (ISIN, ticker, or company name) to { isin?, ticker?, mic? }.
 */
async function resolveIdentifier(
  identifier: string
): Promise<{ isin?: string; ticker?: string; mic?: string }> {
  const trimmed = (identifier || '').trim();
  if (!trimmed) return {};

  const isinMatch = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/i.test(trimmed);
  if (isinMatch) {
    return { isin: trimmed.toUpperCase() };
  }

  if (trimmed.length <= 8 && /^[A-Z0-9.-]+$/i.test(trimmed)) {
    return { ticker: trimmed.toUpperCase() };
  }

  const figiClient = getOpenFIGIClient();
  const results = await figiClient.search(trimmed);
  if (results.length > 0 && results[0].data?.ticker) {
    return {
      ticker: results[0].data.ticker,
      mic: results[0].data.exchangeCode,
    };
  }
  return { ticker: trimmed };
}

interface StructuredEntry {
  isin?: string;
  mic?: string;
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as
      CompanyAnalysisCompareRequest & { entries?: StructuredEntry[] };
    const { identifiers = [], entries, fundId, useLSEG = false } = body;

    const items: StructuredEntry[] = entries && Array.isArray(entries) && entries.length >= 2
      ? entries
      : identifiers.map((id) => ({ name: String(id) }));

    if (items.length < 2 || items.length > MAX_COMPARE) {
      return NextResponse.json(
        { error: `Skicka 2–${MAX_COMPARE} bolag.` },
        { status: 400 }
      );
    }

    const resolved = await Promise.all(
      items.map(async (entry) => {
        if (entry.isin) return { isin: entry.isin.trim().toUpperCase(), mic: entry.mic?.trim(), ticker: undefined };
        if (entry.name) {
          const r = await resolveIdentifier(entry.name);
          return { ...r, mic: entry.mic?.trim() || r.mic };
        }
        return {};
      })
    );

    const analyses: CompleteCompanyAnalysis[] = await Promise.all(
      resolved.map((r, i) =>
        collectCompanyData({
          isin: r.isin,
          ticker: r.ticker,
          mic: r.mic,
          fundId,
          useLSEG,
        }).then((a) => {
          if (items[i].name && !a.identification.companyName) {
            a.identification.companyName = items[i].name;
          }
          return a;
        })
      )
    );

    return NextResponse.json({
      analyses,
      comparedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[company-analysis/compare]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
