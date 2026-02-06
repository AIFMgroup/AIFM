/**
 * NAV Funds API
 * 
 * Hämtar fonddata och NAV-värden
 * Försöker först SECURA API, faller tillbaka på mock-data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSecuraClient } from '@/lib/integrations/secura/secura-client';
import { getNAVRecordStore } from '@/lib/nav-engine/nav-store';

// ============================================================================
// Mock Data (används när SECURA inte är konfigurerat)
// ============================================================================

const MOCK_FUND_NAVS = [
  { 
    fundId: 'f1',
    shareClassId: 'sc1a',
    isin: 'SE0019175563', 
    fundName: 'AUAG Essential Metals', 
    shareClassName: 'A',
    currency: 'SEK', 
    navPerShare: 142.42, 
    previousNav: 141.85,
    navChange: 0.57,
    navChangePercent: 0.40,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 349892028.52,
    grossAssets: 352000000,
    totalLiabilities: 2107971.48,
    sharesOutstanding: 2456766.31,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f1',
    shareClassId: 'sc1b',
    isin: 'SE0019175571', 
    fundName: 'AUAG Essential Metals', 
    shareClassName: 'B',
    currency: 'EUR', 
    navPerShare: 14.65, 
    previousNav: 14.58,
    navChange: 0.07,
    navChangePercent: 0.48,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 43120778.87,
    grossAssets: 43500000,
    totalLiabilities: 379221.13,
    sharesOutstanding: 269451.12,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f1',
    shareClassId: 'sc1c',
    isin: 'SE0019175589', 
    fundName: 'AUAG Essential Metals', 
    shareClassName: 'C',
    currency: 'SEK', 
    navPerShare: 128.56, 
    previousNav: 128.05,
    navChange: 0.51,
    navChangePercent: 0.40,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 2571291.72,
    grossAssets: 2600000,
    totalLiabilities: 28708.28,
    sharesOutstanding: 20000.00,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f2',
    shareClassId: 'sc2a',
    isin: 'SE0020677946', 
    fundName: 'AuAg Gold Rush', 
    shareClassName: 'A',
    currency: 'SEK', 
    navPerShare: 208.71, 
    previousNav: 207.45,
    navChange: 1.26,
    navChangePercent: 0.61,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 505494096.59,
    grossAssets: 510000000,
    totalLiabilities: 4505903.41,
    sharesOutstanding: 2422025.74,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f2',
    shareClassId: 'sc2h',
    isin: 'SE0020678001', 
    fundName: 'AuAg Gold Rush', 
    shareClassName: 'H',
    currency: 'NOK', 
    navPerShare: 197.23, 
    previousNav: 196.05,
    navChange: 1.18,
    navChangePercent: 0.60,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 87854781.97,
    grossAssets: 88500000,
    totalLiabilities: 645218.03,
    sharesOutstanding: 488103.97,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f3',
    shareClassId: 'sc3a',
    isin: 'SE0014808440', 
    fundName: 'AuAg Precious Green', 
    shareClassName: 'A',
    currency: 'SEK', 
    navPerShare: 198.87, 
    previousNav: 197.92,
    navChange: 0.95,
    navChangePercent: 0.48,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 328924859.33,
    grossAssets: 331000000,
    totalLiabilities: 2075140.67,
    sharesOutstanding: 1653996.37,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f4',
    shareClassId: 'sc4a',
    isin: 'SE0013358181', 
    fundName: 'AuAg Silver Bullet', 
    shareClassName: 'A',
    currency: 'SEK', 
    navPerShare: 378.33, 
    previousNav: 375.89,
    navChange: 2.44,
    navChangePercent: 0.65,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 3400248947.80,
    grossAssets: 3420000000,
    totalLiabilities: 19751052.20,
    sharesOutstanding: 8987586.35,
    status: 'PRELIMINARY' as const,
  },
  { 
    fundId: 'f4',
    shareClassId: 'sc4b',
    isin: 'SE0013358199', 
    fundName: 'AuAg Silver Bullet', 
    shareClassName: 'B',
    currency: 'EUR', 
    navPerShare: 37.23, 
    previousNav: 36.98,
    navChange: 0.25,
    navChangePercent: 0.68,
    navDate: new Date().toISOString().split('T')[0], 
    netAssetValue: 921562837.38,
    grossAssets: 925000000,
    totalLiabilities: 3437162.62,
    sharesOutstanding: 2265711.61,
    status: 'PRELIMINARY' as const,
  },
];

// ============================================================================
// GET - Hämta NAV-data
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const fundId = searchParams.get('fundId');
    const source = searchParams.get('source') || 'auto'; // 'secura', 'database', 'mock', 'auto'

    let navData: typeof MOCK_FUND_NAVS = [];
    let dataSource = 'mock';

    // Try SECURA first if configured and requested
    if (source === 'secura' || source === 'auto') {
      const securaPassword = process.env.SECURA_PASSWORD;
      
      if (securaPassword) {
        try {
          const securaClient = createSecuraClient({
            host: process.env.SECURA_HOST || '194.62.154.68',
            port: parseInt(process.env.SECURA_PORT || '20023', 10),
            username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
            password: securaPassword,
          });

          // Test connection
          const status = await securaClient.testConnection();
          
          if (status.connected) {
            // Fetch NAV data from SECURA
            const funds = await securaClient.getFunds();
            const navPromises = funds
              .filter(f => f.status === 'ACTIVE')
              .flatMap(fund => 
                fund.shareClasses
                  .filter(sc => sc.status === 'ACTIVE')
                  .map(async sc => {
                    try {
                      const nav = await securaClient.getNAV(fund.fundId, sc.shareClassId);
                      return {
                        fundId: fund.fundId,
                        shareClassId: sc.shareClassId,
                        isin: sc.isin,
                        fundName: fund.name,
                        shareClassName: sc.name,
                        currency: sc.currency,
                        navPerShare: nav.navPerShare,
                        previousNav: nav.previousNavPerShare,
                        navChange: nav.navChange,
                        navChangePercent: nav.navChangePercent,
                        navDate: nav.navDate,
                        netAssetValue: nav.netAssetValue,
                        grossAssets: nav.grossAssets,
                        totalLiabilities: nav.totalLiabilities,
                        sharesOutstanding: nav.sharesOutstanding,
                        status: nav.status,
                      };
                    } catch {
                      return null;
                    }
                  })
              );

            const results = await Promise.all(navPromises);
            navData = results.filter((r): r is NonNullable<typeof r> => r !== null);
            dataSource = 'secura';
          }
        } catch (error) {
          console.warn('[NAV Funds API] SECURA connection failed, trying database:', error);
        }
      }
    }

    // Try database if SECURA failed or not configured
    if (navData.length === 0 && (source === 'database' || source === 'auto')) {
      try {
        const navStore = getNAVRecordStore();
        
        // Get unique fund/shareClass combinations from mock data to query
        const queries = MOCK_FUND_NAVS.map(m => ({
          fundId: m.fundId,
          shareClassId: m.shareClassId,
        }));

        const dbResults = await Promise.all(
          queries.map(async q => {
            const record = await navStore.getNAVRecord(q.fundId, q.shareClassId, navDate);
            if (record) {
              // Find matching mock for additional info
              const mockInfo = MOCK_FUND_NAVS.find(
                m => m.fundId === q.fundId && m.shareClassId === q.shareClassId
              );
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
        if (navData.length > 0) {
          dataSource = 'database';
        }
      } catch (error) {
        console.warn('[NAV Funds API] Database query failed:', error);
      }
    }

    // Fall back to mock data
    if (navData.length === 0) {
      navData = MOCK_FUND_NAVS;
      dataSource = 'mock';
    }

    // Filter by fundId if specified
    if (fundId) {
      navData = navData.filter(n => n.fundId === fundId);
    }

    // Calculate summary stats
    const totalAUM = navData.reduce((sum, n) => sum + n.netAssetValue, 0);
    const uniqueFunds = new Set(navData.map(n => n.fundId)).size;

    return NextResponse.json({
      success: true,
      data: {
        navDate,
        funds: navData,
        summary: {
          totalAUM,
          fundCount: uniqueFunds,
          shareClassCount: navData.length,
        },
      },
      meta: {
        source: dataSource,
        timestamp: new Date().toISOString(),
        securaConfigured: !!process.env.SECURA_PASSWORD,
      },
    });

  } catch (error) {
    console.error('[NAV Funds API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch NAV data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
