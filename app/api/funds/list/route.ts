/**
 * GET /api/funds/list
 * Returns all funds in the system for dropdowns (e.g. Investeringsscout, Helhetsanalys).
 * Priority: ISEC SECURA (real data) > Fund Registry > ESG fund config fallback.
 */

import { NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';
import { ALL_CONFIGS } from '@/lib/integrations/securities/esg-fund-configs';
import { getISECFunds } from '@/lib/integrations/isec/isec-data-service';

export interface FundListItem {
  fundId: string;
  fundName: string;
  isin: string;
  currency: string;
  article?: string;
  shareClassName?: string;
  navPerShare?: number;
  netAssetValue?: number;
  source?: 'isec' | 'registry' | 'config';
}

const CONFIG_FUNDS: FundListItem[] = ALL_CONFIGS.map((c) => ({
  fundId: c.fundId,
  fundName: c.fundName,
  isin: '',
  currency: 'SEK',
  article: c.article,
  source: 'config' as const,
}));

export async function GET() {
  try {
    const list: FundListItem[] = [];
    const seenIds = new Set<string>();

    // 1) ISEC SECURA — real fund data with NAV
    try {
      const isecFunds = await getISECFunds();
      for (const f of isecFunds) {
        list.push({
          fundId: f.id,
          fundName: f.name,
          isin: f.isin,
          currency: f.currency,
          navPerShare: f.navPerShare,
          netAssetValue: f.totalNav,
          source: 'isec',
        });
        seenIds.add(f.id);
      }
    } catch (err) {
      console.warn('[API funds/list] ISEC unavailable, falling back:', err);
    }

    // 2) Fund Registry
    try {
      const registry = getFundRegistry();
      const regFunds = await registry.listFunds();
      for (const f of regFunds) {
        if (!seenIds.has(f.id)) {
          list.push({
            fundId: f.id,
            fundName: f.name,
            isin: f.isin ?? '',
            currency: f.currency ?? 'SEK',
            source: 'registry',
          });
          seenIds.add(f.id);
        }
      }
    } catch { /* ignore */ }

    // 3) ESG config fallback
    for (const cf of CONFIG_FUNDS) {
      if (!seenIds.has(cf.fundId)) {
        list.push(cf);
        seenIds.add(cf.fundId);
      }
    }

    return NextResponse.json({ success: true, funds: list });
  } catch (error) {
    console.error('[API funds/list]', error);
    return NextResponse.json({ success: true, funds: CONFIG_FUNDS });
  }
}
