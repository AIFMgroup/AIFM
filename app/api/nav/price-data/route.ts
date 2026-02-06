import { NextRequest, NextResponse } from 'next/server';
import {
  getPriceDataProviderManager,
  type PriceDataSource,
  type CSVPriceRow,
} from '@/lib/integrations/pricing';

// ============================================================================
// GET - Hämta prisdata
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fundId = searchParams.get('fundId');
    const date = searchParams.get('date') || undefined;
    const source = searchParams.get('source') as PriceDataSource | null;
    const action = searchParams.get('action');

    const manager = getPriceDataProviderManager();

    // Hämta provider-status
    if (action === 'status') {
      const statuses = await manager.getAllStatuses();
      return NextResponse.json({
        activeSource: manager.getActiveSource(),
        statuses,
      });
    }

    // Använd specifik källa om angiven, annars aktiv
    const provider = source ? manager.getProvider(source) : manager.getActiveProvider();
    
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown price source: ${source}` },
        { status: 400 }
      );
    }

    // Hämta för specifik fond eller alla
    if (fundId) {
      const priceData = await provider.getPriceData(fundId, date);
      return NextResponse.json(priceData);
    } else {
      const allPriceData = await provider.getAllPriceData(date);
      return NextResponse.json({
        source: provider.source,
        date: date || new Date().toISOString().split('T')[0],
        data: allPriceData,
        count: allPriceData.length,
      });
    }
  } catch (error) {
    console.error('Price data GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch price data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Importera prisdata (CSV eller manuell)
// ============================================================================

interface ImportCSVRequest {
  action: 'import-csv';
  data: CSVPriceRow[];
}

interface SetManualPriceRequest {
  action: 'set-manual';
  fundId: string;
  fundName: string;
  isin: string;
  date: string;
  nav: number;
  aum?: number;
  outstandingShares?: number;
  currency?: string;
}

interface SetSourceRequest {
  action: 'set-source';
  source: PriceDataSource;
}

type PostRequestBody = ImportCSVRequest | SetManualPriceRequest | SetSourceRequest;

export async function POST(request: NextRequest) {
  try {
    const body: PostRequestBody = await request.json();
    const manager = getPriceDataProviderManager();

    switch (body.action) {
      case 'import-csv': {
        const result = manager.importCSV(body.data);
        return NextResponse.json({
          success: true,
          imported: result.imported,
          errors: result.errors,
          message: `Imported ${result.imported} price records`,
        });
      }

      case 'set-manual': {
        manager.setManualPrice({
          fundId: body.fundId,
          fundName: body.fundName,
          isin: body.isin,
          date: body.date,
          nav: body.nav,
          aum: body.aum,
          outstandingShares: body.outstandingShares,
          currency: body.currency,
        });
        return NextResponse.json({
          success: true,
          message: `Set manual price for ${body.fundId}`,
        });
      }

      case 'set-source': {
        manager.setActiveSource(body.source);
        return NextResponse.json({
          success: true,
          activeSource: body.source,
          message: `Switched to ${body.source} price provider`,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Price data POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process price data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Uppdatera prisdata
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const manager = getPriceDataProviderManager();

    // Uppdatera manuellt pris
    if (body.fundId && body.nav !== undefined) {
      manager.setManualPrice({
        fundId: body.fundId,
        fundName: body.fundName || `Fund ${body.fundId}`,
        isin: body.isin || body.fundId,
        date: body.date || new Date().toISOString().split('T')[0],
        nav: body.nav,
        aum: body.aum,
        outstandingShares: body.outstandingShares,
        currency: body.currency,
      });

      return NextResponse.json({
        success: true,
        message: `Updated price for ${body.fundId}`,
      });
    }

    return NextResponse.json(
      { error: 'Missing required fields (fundId, nav)' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Price data PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update price data' },
      { status: 500 }
    );
  }
}
