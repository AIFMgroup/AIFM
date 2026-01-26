/**
 * NAV Automation API Routes
 * 
 * Endpoints för att köra NAV-automation manuellt eller via scheduler
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNAVAutomationService } from '@/lib/integrations/secura';

// Konfiguration för daglig automation
// I produktion: hämta från databas eller konfigurationsfil
const DEFAULT_CONFIG = {
  navReports: {
    fundIds: ['FUND001', 'FUND002', 'FUND003'], // Ersätt med faktiska fond-IDn
    recipients: ['asset.manager@example.com'],
    format: 'PDF' as const,
  },
  notor: {
    fundIds: ['FUND001', 'FUND002', 'FUND003'],
    recipients: ['operations@example.com'],
    format: 'PDF' as const,
  },
  subReds: {
    fundIds: ['FUND001', 'FUND002', 'FUND003'],
    recipients: ['operations@example.com'],
    includeAccountStatement: true,
  },
  priceData: {
    fundIds: ['FUND001', 'FUND002', 'FUND003'],
    recipients: ['institutions@example.com'],
    uploadToWebsite: true,
    websiteEndpoint: process.env.WEBSITE_PRICE_DATA_ENDPOINT,
  },
  ownerData: {
    fundIds: ['FUND001', 'FUND002', 'FUND003'],
    recipients: ['clearstream@example.com'],
    includeClearstream: true,
  },
};

/**
 * POST /api/nav-automation
 * 
 * Kör NAV-automation manuellt eller via cron
 * 
 * Body:
 * {
 *   "type": "all" | "nav-reports" | "notor" | "subreds" | "price-data" | "owner-data",
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
    const { type = 'all', config: customConfig } = body;

    const service = getNAVAutomationService();
    const config = { ...DEFAULT_CONFIG, ...customConfig };

    let results;

    switch (type) {
      case 'nav-reports':
        results = await service.processNAVReports(config.navReports);
        break;
      
      case 'notor':
        results = await service.processNotor(config.notor);
        break;
      
      case 'subreds':
        results = await service.processSubReds(config.subReds);
        break;
      
      case 'price-data':
        results = await service.processPriceData(config.priceData);
        break;
      
      case 'owner-data':
        results = await service.processOwnerData(config.ownerData);
        break;
      
      case 'all':
      default:
        const fullResults = await service.runDailyAutomation(config);
        return NextResponse.json({
          success: true,
          timestamp: new Date().toISOString(),
          ...fullResults,
        });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      type,
      results,
    });

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
 * Hämta status för senaste körning
 */
export async function GET() {
  try {
    // TODO: Hämta status från databas
    return NextResponse.json({
      status: 'ready',
      lastRun: null,
      nextScheduledRun: null,
      config: {
        enabled: process.env.NAV_AUTOMATION_ENABLED === 'true',
        securaConnected: !!process.env.SECURA_PASSWORD,
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
