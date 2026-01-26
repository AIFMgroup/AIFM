import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { runFIScraper } from '@/lib/compliance/scrapers/fiScraper';
import { runESMAScraper } from '@/lib/compliance/scrapers/esmaScraper';
import { ScraperResult } from '@/lib/compliance/types';

interface ScrapeRequest {
  sources?: ('fi' | 'esma' | 'all')[];
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ScrapeRequest = await request.json();
    const sources = body.sources || ['all'];

    const results: ScraperResult[] = [];

    if (sources.includes('all') || sources.includes('fi')) {
      console.log('[Scrape API] Starting FI scraper...');
      const fiResult = await runFIScraper();
      results.push(fiResult);
    }

    if (sources.includes('all') || sources.includes('esma')) {
      console.log('[Scrape API] Starting ESMA scraper...');
      const esmaResult = await runESMAScraper();
      results.push(esmaResult);
    }

    const summary = {
      totalDocumentsFound: results.reduce((sum, r) => sum + r.documentsFound, 0),
      totalDocumentsNew: results.reduce((sum, r) => sum + r.documentsNew, 0),
      totalDocumentsUpdated: results.reduce((sum, r) => sum + r.documentsUpdated, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
      results,
    };

    console.log('[Scrape API] Completed:', summary);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}




