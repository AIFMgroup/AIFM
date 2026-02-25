import { NextRequest, NextResponse } from 'next/server';
import { performEnrichedLookup } from '@/lib/integrations/securities';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import { getYahooFinanceClient } from '@/lib/integrations/securities/yahoo-finance-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ScoutRecommendation {
  name: string;
  ticker: string;
  isin: string;
  sector: string;
  country: string;
  [key: string]: unknown;
}

async function enrichWithAPIs(rec: ScoutRecommendation): Promise<Record<string, unknown>> {
  const enriched: Record<string, unknown> = { ...rec };

  try {
    if (rec.isin || rec.ticker) {
      const lookupResult = await performEnrichedLookup(
        rec.isin || undefined,
        rec.ticker || undefined,
        undefined
      );
      if (lookupResult.success && lookupResult.data) {
        const d = lookupResult.data;
        enriched.marketCap = d.marketCap?.value;
        enriched.currentPrice = d.currentPrice?.value;
        enriched.currency = d.currency?.value;
        enriched.exchange = d.exchangeName?.value;
        enriched.industry = d.industry?.value;
        enriched.gicsSector = d.gicsSector?.value;
        enriched.isin = d.isin?.value || rec.isin;
        enriched.ticker = d.ticker?.value || rec.ticker;
        enriched.name = d.name?.value || rec.name;
        enriched.country = d.countryName?.value || d.country?.value || rec.country;
        enriched.lei = d.emitterLEI?.value;
        enriched.emitter = d.emitter?.value;
        enriched.avgDailyVolume = d.averageDailyVolume?.value;
        enriched.isRegulatedMarket = d.isRegulatedMarket?.value;
        enriched.lookupSuccess = true;
      }
    }
  } catch (e) {
    console.warn('[Scout-enrich] Lookup failed for', rec.name, e);
  }

  try {
    const esgClient = getESGServiceClient();
    const esgId = (enriched.isin as string) || rec.ticker;
    if (esgId && esgClient.getActiveProviderName()) {
      const esgData = await esgClient.getESGData(esgId);
      if (esgData) {
        enriched.esgScore = esgData.totalScore;
        enriched.esgEnvironment = esgData.environmentScore;
        enriched.esgSocial = esgData.socialScore;
        enriched.esgGovernance = esgData.governanceScore;
        enriched.esgProvider = esgData.provider;
        enriched.carbonIntensity = esgData.carbonIntensity;
        enriched.carbonIntensityUnit = esgData.carbonIntensityUnit;
        enriched.sfdrAlignmentAPI = esgData.sfdrAlignment;
        enriched.taxonomyAlignment = esgData.taxonomyAlignmentPercent;
        enriched.controversyLevel = esgData.controversyLevel;
        enriched.esgSuccess = true;
      }

      try {
        const paiData = await esgClient.getPAIIndicators(esgId);
        if (paiData?.length) {
          enriched.paiIndicators = paiData.slice(0, 10);
        }
      } catch { /* optional */ }

      try {
        const exclusionData = await esgClient.getExclusionScreening(esgId);
        if (exclusionData) {
          enriched.exclusionFlags = exclusionData;
        }
      } catch { /* optional */ }
    }
  } catch (e) {
    console.warn('[Scout-enrich] ESG failed for', rec.name, e);
  }

  try {
    const yahoo = getYahooFinanceClient();
    const symbol = rec.ticker || (enriched.ticker as string);
    if (symbol) {
      const quote = await yahoo.getQuote(symbol);
      if (quote.success && quote.data) {
        enriched.yahooPrice = quote.data.regularMarketPrice;
        enriched.yahooMarketCap = quote.data.marketCap;
        enriched.yahooVolume = quote.data.averageDailyVolume3Month;
        enriched.yahoo52wHigh = quote.data.fiftyTwoWeekHigh;
        enriched.yahoo52wLow = quote.data.fiftyTwoWeekLow;
        enriched.yahooCurrency = quote.data.currency;
        enriched.yahooSector = quote.data.sector;
        enriched.yahooIndustry = quote.data.industry;

        if (quote.data.regularMarketPrice && quote.data.fiftyTwoWeekHigh && quote.data.fiftyTwoWeekLow) {
          const price = quote.data.regularMarketPrice;
          const high = quote.data.fiftyTwoWeekHigh;
          const low = quote.data.fiftyTwoWeekLow;
          enriched.priceVs52wHigh = `${(((price - high) / high) * 100).toFixed(1)}%`;
          enriched.priceVs52wLow = `${(((price - low) / low) * 100).toFixed(1)}%`;
          enriched.rangePosition52w = `${(((price - low) / (high - low)) * 100).toFixed(0)}%`;
        }
      }
    }
  } catch (e) {
    console.warn('[Scout-enrich] Yahoo failed for', rec.name, e);
  }

  return enriched;
}

export async function POST(request: NextRequest) {
  let body: { recommendations: ScoutRecommendation[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ogiltig förfrågan' }, { status: 400 });
  }

  const { recommendations } = body;
  if (!recommendations?.length) {
    return NextResponse.json({ error: 'Inga rekommendationer att anrika' }, { status: 400 });
  }

  try {
    console.log('[Scout-enrich] Enriching', recommendations.length, 'recommendations with API data...');
    const enrichedResults = await Promise.allSettled(
      recommendations.map((rec) => enrichWithAPIs(rec))
    );
    const enriched = enrichedResults.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { ...recommendations[i], enrichmentFailed: true }
    );
    console.log('[Scout-enrich] Complete');
    return NextResponse.json({ success: true, enrichedRecommendations: enriched });
  } catch (error) {
    console.error('[Scout-enrich] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte anrika rekommendationer' },
      { status: 500 }
    );
  }
}
