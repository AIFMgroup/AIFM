import { NextRequest, NextResponse } from 'next/server';
import { getMarketDataClient } from '@/lib/integrations/market-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';

    const client = getMarketDataClient();

    if (action === 'summary') {
      const summary = await client.getMarketSummary();
      return NextResponse.json({ summary });
    }

    if (action === 'prices') {
      const prices = await client.getCommodityPrices();
      return NextResponse.json({ prices });
    }

    if (action === 'news') {
      const query = searchParams.get('query') || undefined;
      const limit = parseInt(searchParams.get('limit') || '10');
      const news = await client.getFinancialNews(query, limit);
      return NextResponse.json({ news });
    }

    if (action === 'regulatory') {
      const updates = await client.getRegulatoryNews();
      return NextResponse.json({ updates });
    }

    if (action === 'fund') {
      const fundId = searchParams.get('fundId');
      if (!fundId) {
        return NextResponse.json({ error: 'fundId required' }, { status: 400 });
      }
      const data = await client.getFundMarketData(fundId);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Market Data API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
