/**
 * NAV Automation API Routes
 * 
 * Endpoints för att köra NAV-automation manuellt eller via scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';
import { getPriceDataProviderManager } from '@/lib/integrations/pricing';

// Konfiguration för daglig automation
const DEFAULT_CONFIG = {
  priceData: {
    recipients: ['institutions@example.com'],
    uploadToWebsite: true,
  },
  navReports: {
    recipients: ['asset.manager@example.com'],
  },
};

/**
 * POST /api/nav-automation
 * 
 * Kör NAV-automation manuellt eller via cron
 * 
 * Body:
 * {
 *   "type": "all" | "nav-reports" | "price-data" | "status",
 *   "config": { ... } // Optional override config
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verifiera API-nyckel för scheduler/cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type = 'status' } = body;

    const registry = getFundRegistry();
    const priceManager = getPriceDataProviderManager();

    switch (type) {
      case 'price-data': {
        // Get all price data from active provider
        const provider = priceManager.getActiveProvider();
        const priceData = await provider.getAllPriceData();
        
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'price-data',
          source: provider.source,
          count: priceData.length,
          data: priceData,
        });
      }
      
      case 'nav-reports': {
        // Get NAV data from fund registry
        const funds = await registry.listFunds();
        const navData = await registry.getPriceData();
        
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'nav-reports',
          fundCount: funds.length,
          navRecords: navData.length,
          data: navData,
        });
      }

      case 'sync': {
        // Sync operation placeholder
        const funds = await registry.listFunds();
        const shareClasses = await registry.listShareClasses();
        
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'sync',
          synced: {
            funds: funds.length,
            shareClasses: shareClasses.length,
          },
        });
      }
      
      case 'status':
      default: {
        const funds = await registry.listFunds();
        const providerStatus = await priceManager.getAllStatuses();
        
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'status',
          fundRegistry: {
            status: 'active',
            fundCount: funds.length,
          },
          priceProvider: {
            active: priceManager.getActiveSource(),
            statuses: providerStatus,
          },
        });
      }
    }

  } catch (error) {
    console.error('[NAV Automation API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Automation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/nav-automation
 * 
 * Hämta status för NAV-automation
 */
export async function GET() {
  try {
    const registry = getFundRegistry();
    const priceManager = getPriceDataProviderManager();
    
    const funds = await registry.listFunds();
    const shareClasses = await registry.listShareClasses();
    const providerStatus = await priceManager.getAllStatuses();

    return NextResponse.json({
      status: 'ready',
      fundRegistry: {
        status: 'active',
        fundCount: funds.length,
        shareClassCount: shareClasses.length,
      },
      priceProvider: {
        active: priceManager.getActiveSource(),
        statuses: providerStatus,
      },
      config: {
        enabled: true,
      },
    });
  } catch (error) {
    console.error('[NAV Automation API] Status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
