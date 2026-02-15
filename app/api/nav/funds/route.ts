/**
 * NAV Funds API
 *
 * Hämtar fonddata och NAV-värden från Fund Registry.
 * Faller tillbaka på mock-data om registret är tomt.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';
import { getNAVRecordStore } from '@/lib/nav-engine/nav-store';

// ============================================================================
// Mock Data (fallback)
// ============================================================================

const MOCK_FUND_NAVS = [
  { fundId: 'f1', shareClassId: 'sc1a', isin: 'SE0019175563', fundName: 'AUAG Essential Metals', shareClassName: 'A', currency: 'SEK', navPerShare: 142.42, previousNav: 141.85, navChange: 0.57, navChangePercent: 0.40, navDate: new Date().toISOString().split('T')[0], netAssetValue: 349892028.52, grossAssets: 352000000, totalLiabilities: 2107971.48, sharesOutstanding: 2456766.31, status: 'PRELIMINARY' as const },
  { fundId: 'f1', shareClassId: 'sc1b', isin: 'SE0019175571', fundName: 'AUAG Essential Metals', shareClassName: 'B', currency: 'EUR', navPerShare: 14.65, previousNav: 14.58, navChange: 0.07, navChangePercent: 0.48, navDate: new Date().toISOString().split('T')[0], netAssetValue: 43120778.87, grossAssets: 43500000, totalLiabilities: 379221.13, sharesOutstanding: 269451.12, status: 'PRELIMINARY' as const },
  { fundId: 'f1', shareClassId: 'sc1c', isin: 'SE0019175589', fundName: 'AUAG Essential Metals', shareClassName: 'C', currency: 'SEK', navPerShare: 128.56, previousNav: 128.05, navChange: 0.51, navChangePercent: 0.40, navDate: new Date().toISOString().split('T')[0], netAssetValue: 2571291.72, grossAssets: 2600000, totalLiabilities: 28708.28, sharesOutstanding: 20000.00, status: 'PRELIMINARY' as const },
  { fundId: 'f2', shareClassId: 'sc2a', isin: 'SE0020677946', fundName: 'AuAg Gold Rush', shareClassName: 'A', currency: 'SEK', navPerShare: 208.71, previousNav: 207.45, navChange: 1.26, navChangePercent: 0.61, navDate: new Date().toISOString().split('T')[0], netAssetValue: 505494096.59, grossAssets: 510000000, totalLiabilities: 4505903.41, sharesOutstanding: 2422025.74, status: 'PRELIMINARY' as const },
  { fundId: 'f2', shareClassId: 'sc2h', isin: 'SE0020678001', fundName: 'AuAg Gold Rush', shareClassName: 'H', currency: 'NOK', navPerShare: 197.23, previousNav: 196.05, navChange: 1.18, navChangePercent: 0.60, navDate: new Date().toISOString().split('T')[0], netAssetValue: 87854781.97, grossAssets: 88500000, totalLiabilities: 645218.03, sharesOutstanding: 488103.97, status: 'PRELIMINARY' as const },
  { fundId: 'f3', shareClassId: 'sc3a', isin: 'SE0014808440', fundName: 'AuAg Precious Green', shareClassName: 'A', currency: 'SEK', navPerShare: 198.87, previousNav: 197.92, navChange: 0.95, navChangePercent: 0.48, navDate: new Date().toISOString().split('T')[0], netAssetValue: 328924859.33, grossAssets: 331000000, totalLiabilities: 2075140.67, sharesOutstanding: 1653996.37, status: 'PRELIMINARY' as const },
  { fundId: 'f4', shareClassId: 'sc4a', isin: 'SE0013358181', fundName: 'AuAg Silver Bullet', shareClassName: 'A', currency: 'SEK', navPerShare: 378.33, previousNav: 375.89, navChange: 2.44, navChangePercent: 0.65, navDate: new Date().toISOString().split('T')[0], netAssetValue: 3400248947.80, grossAssets: 3420000000, totalLiabilities: 19751052.20, sharesOutstanding: 8987586.35, status: 'PRELIMINARY' as const },
  { fundId: 'f4', shareClassId: 'sc4b', isin: 'SE0013358199', fundName: 'AuAg Silver Bullet', shareClassName: 'B', currency: 'EUR', navPerShare: 37.23, previousNav: 36.98, navChange: 0.25, navChangePercent: 0.68, navDate: new Date().toISOString().split('T')[0], netAssetValue: 921562837.38, grossAssets: 925000000, totalLiabilities: 3437162.62, sharesOutstanding: 2265711.61, status: 'PRELIMINARY' as const },
];

// ============================================================================
// GET - Hämta NAV-data
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const fundId = searchParams.get('fundId');
    const source = searchParams.get('source') || 'auto'; // 'fund_registry', 'database', 'mock', 'auto'

    let navData: typeof MOCK_FUND_NAVS = [];
    let dataSource = 'mock';

    // Try Fund Registry first
    if (source === 'fund_registry' || source === 'auto') {
      try {
        const registry = getFundRegistry();
        const funds = await registry.listFunds();

        if (funds.length > 0) {
          const results = [];
          for (const fund of funds) {
            const shareClasses = await registry.listShareClasses(fund.id);
            for (const sc of shareClasses.filter(s => s.status === 'active')) {
              const nav = await registry.getNAV(sc.id, navDate);
              if (nav) {
                results.push({
                  fundId: fund.id,
                  shareClassId: sc.id,
                  isin: sc.isin,
                  fundName: fund.name,
                  shareClassName: sc.name,
                  currency: sc.currency,
                  navPerShare: nav.navPerShare,
                  previousNav: nav.previousNav,
                  navChange: nav.navChange,
                  navChangePercent: nav.navChangePercent,
                  navDate: nav.date,
                  netAssetValue: nav.shareClassNetAssets,
                  grossAssets: nav.totalNetAssets * 1.01,
                  totalLiabilities: nav.totalNetAssets * 0.01,
                  sharesOutstanding: nav.outstandingShares,
                  status: nav.status === 'approved' ? 'APPROVED' : nav.status === 'published' ? 'PUBLISHED' : 'PRELIMINARY',
                });
              }
            }
          }
          if (results.length > 0) {
            navData = results;
            dataSource = 'fund_registry';
          }
        }
      } catch (error) {
        console.warn('[NAV Funds API] Fund Registry fetch failed:', error);
      }
    }

    // Try database if Fund Registry had no data
    if (navData.length === 0 && (source === 'database' || source === 'auto')) {
      try {
        const navStore = getNAVRecordStore();
        const queries = MOCK_FUND_NAVS.map(m => ({ fundId: m.fundId, shareClassId: m.shareClassId }));
        const dbResults = await Promise.all(
          queries.map(async q => {
            const record = await navStore.getNAVRecord(q.fundId, q.shareClassId, navDate);
            if (record) {
              const mockInfo = MOCK_FUND_NAVS.find(m => m.fundId === q.fundId && m.shareClassId === q.shareClassId);
              return {
                fundId: record.fundId,
                shareClassId: record.shareClassId,
                isin: mockInfo?.isin || '',
                fundName: mockInfo?.fundName || '',
                shareClassName: mockInfo?.shareClassName || '',
                currency: mockInfo?.currency || 'SEK',
                navPerShare: record.navPerShare,
                previousNav: mockInfo?.previousNav,
                navChange: record.navChange,
                navChangePercent: record.navChangePercent,
                navDate: record.navDate,
                netAssetValue: record.netAssetValue,
                grossAssets: record.grossAssets,
                totalLiabilities: record.totalLiabilities,
                sharesOutstanding: record.sharesOutstanding,
                status: record.status,
              };
            }
            return null;
          })
        );
        navData = dbResults.filter((r): r is NonNullable<typeof r> => r !== null);
        if (navData.length > 0) dataSource = 'database';
      } catch (error) {
        console.warn('[NAV Funds API] Database query failed:', error);
      }
    }

    // Fall back to mock data
    if (navData.length === 0) {
      navData = MOCK_FUND_NAVS;
      dataSource = 'mock';
    }

    if (fundId) {
      navData = navData.filter(n => n.fundId === fundId);
    }

    const totalAUM = navData.reduce((sum, n) => sum + n.netAssetValue, 0);
    const uniqueFunds = new Set(navData.map(n => n.fundId)).size;

    return NextResponse.json({
      success: true,
      data: {
        navDate,
        funds: navData,
        summary: { totalAUM, fundCount: uniqueFunds, shareClassCount: navData.length },
      },
      meta: {
        source: dataSource,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[NAV Funds API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch NAV data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
