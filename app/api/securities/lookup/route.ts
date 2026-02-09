import { NextRequest, NextResponse } from 'next/server';
import { 
  performEnrichedLookup,
  formatSourceName,
  MIC_CODES,
  COUNTRY_NAMES,
} from '@/lib/integrations/securities';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';

export async function POST(request: NextRequest) {
  try {
    const { isin, ticker, mic } = await request.json();

    if (!isin && !ticker) {
      return NextResponse.json(
        { error: 'ISIN or ticker is required' },
        { status: 400 }
      );
    }

    // Perform enriched lookup with all data sources
    const result = await performEnrichedLookup(isin, ticker, mic);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { 
          success: false,
          error: result.errors[0] || 'Security not found',
          warnings: result.warnings,
        },
        { status: 404 }
      );
    }

    // Transform enriched data to frontend-friendly format
    // Keep source information for each field
    const enrichedData = result.data;
    
    const responseData = {
      // Basic info with sources
      name: enrichedData.name.value,
      nameSource: enrichedData.name.source,
      
      ticker: enrichedData.ticker.value,
      tickerSource: enrichedData.ticker.source,
      
      isin: enrichedData.isin.value,
      isinSource: enrichedData.isin.source,
      
      figi: enrichedData.figi?.value,
      figiSource: enrichedData.figi?.source,
      
      // Exchange info
      mic: enrichedData.mic.value,
      micSource: enrichedData.mic.source,
      
      exchangeName: enrichedData.exchangeName.value,
      exchangeNameSource: enrichedData.exchangeName.source,
      exchangeNameNotFound: enrichedData.exchangeName.notFound,
      
      isRegulatedMarket: enrichedData.isRegulatedMarket.value,
      isRegulatedMarketSource: enrichedData.isRegulatedMarket.source,
      
      listingType: enrichedData.listingType.value,
      listingTypeSource: enrichedData.listingType.source,
      
      // Classification
      securityType: enrichedData.securityType.value,
      securityTypeSource: enrichedData.securityType.source,
      
      category: enrichedData.category.value,
      categorySource: enrichedData.category.source,
      
      type: enrichedData.type.value,
      typeSource: enrichedData.type.source,
      
      // Geography & Currency
      country: enrichedData.country.value,
      countrySource: enrichedData.country.source,
      
      countryName: enrichedData.countryName.value,
      countryNameSource: enrichedData.countryName.source,
      
      currency: enrichedData.currency.value,
      currencySource: enrichedData.currency.source,
      currencyNotFound: enrichedData.currency.notFound,
      
      // Emitter info
      emitter: enrichedData.emitter.value,
      emitterSource: enrichedData.emitter.source,
      
      emitterLEI: enrichedData.emitterLEI?.value,
      emitterLEISource: enrichedData.emitterLEI?.source,
      emitterLEINotFound: enrichedData.emitterLEI?.notFound,
      emitterLEIError: enrichedData.emitterLEI?.error,
      
      // Sector
      gicsSector: enrichedData.gicsSector?.value,
      gicsSectorSource: enrichedData.gicsSector?.source,
      gicsSectorNotFound: enrichedData.gicsSector?.notFound,
      
      industry: enrichedData.industry?.value,
      industrySource: enrichedData.industry?.source,
      industryNotFound: enrichedData.industry?.notFound,
      
      // Market data
      marketCap: enrichedData.marketCap?.value,
      marketCapSource: enrichedData.marketCap?.source,
      
      currentPrice: enrichedData.currentPrice?.value,
      currentPriceSource: enrichedData.currentPrice?.source,
      
      averageDailyVolume: enrichedData.averageDailyVolume?.value,
      averageDailyVolumeSource: enrichedData.averageDailyVolume?.source,
      
      averageDailyValueSEK: enrichedData.averageDailyValueSEK?.value,
      averageDailyValueSEKSource: enrichedData.averageDailyValueSEK?.source,
      
      // Liquidity
      meetsLiquidityPresumption: enrichedData.meetsLiquidityPresumption?.value,
      meetsLiquidityPresumptionSource: enrichedData.meetsLiquidityPresumption?.source,
      
      // Regulatory defaults (for form pre-filling)
      regulatoryDefaults: enrichedData.regulatoryDefaults ? {
        limitedPotentialLoss: {
          value: enrichedData.regulatoryDefaults.limitedPotentialLoss.value,
          source: enrichedData.regulatoryDefaults.limitedPotentialLoss.source,
        },
        liquidityNotEndangered: {
          value: enrichedData.regulatoryDefaults.liquidityNotEndangered.value,
          source: enrichedData.regulatoryDefaults.liquidityNotEndangered.source,
        },
        reliableValuationChecked: {
          value: enrichedData.regulatoryDefaults.reliableValuationChecked.value,
          source: enrichedData.regulatoryDefaults.reliableValuationChecked.source,
        },
        appropriateInfoChecked: {
          value: enrichedData.regulatoryDefaults.appropriateInfoChecked.value,
          source: enrichedData.regulatoryDefaults.appropriateInfoChecked.source,
        },
        isMarketable: {
          value: enrichedData.regulatoryDefaults.isMarketable.value,
          source: enrichedData.regulatoryDefaults.isMarketable.source,
        },
        compatibleWithFund: {
          value: enrichedData.regulatoryDefaults.compatibleWithFund.value,
          source: enrichedData.regulatoryDefaults.compatibleWithFund.source,
        },
        riskManagementCaptures: {
          value: enrichedData.regulatoryDefaults.riskManagementCaptures.value,
          source: enrichedData.regulatoryDefaults.riskManagementCaptures.source,
        },
      } : null,
      
      // Valuation defaults
      valuationDefaults: enrichedData.valuationDefaults ? {
        reliableDailyPrices: {
          value: enrichedData.valuationDefaults.reliableDailyPrices.value,
          source: enrichedData.valuationDefaults.reliableDailyPrices.source,
        },
        reliableValuationType: {
          value: enrichedData.valuationDefaults.reliableValuationType.value,
          source: enrichedData.valuationDefaults.reliableValuationType.source,
        },
        appropriateInfoType: {
          value: enrichedData.valuationDefaults.appropriateInfoType.value,
          source: enrichedData.valuationDefaults.appropriateInfoType.source,
        },
        priceSourceUrl: enrichedData.valuationDefaults.priceSourceUrl ? {
          value: enrichedData.valuationDefaults.priceSourceUrl.value,
          source: enrichedData.valuationDefaults.priceSourceUrl.source,
        } : null,
      } : null,
      
      // Security URL (direct link to exchange page)
      securityUrl: enrichedData.valuationDefaults?.priceSourceUrl?.value || null,
      securityUrlSource: enrichedData.valuationDefaults?.priceSourceUrl?.source || null,
    };

    // ---- ESG data enrichment ----
    let esgSummary: Record<string, unknown> | null = null;
    try {
      const esgClient = getESGServiceClient();
      const esgId = responseData.isin || responseData.ticker;
      if (esgId && esgClient.getActiveProviderName()) {
        const esgData = await esgClient.getESGData(esgId);
        if (esgData) {
          esgSummary = {
            provider: esgData.provider,
            totalScore: esgData.totalScore,
            environmentScore: esgData.environmentScore,
            socialScore: esgData.socialScore,
            governanceScore: esgData.governanceScore,
            controversyLevel: esgData.controversyLevel,
            sfdrAlignment: esgData.sfdrAlignment,
            exclusionFlags: esgData.exclusionFlags,
            fetchedAt: esgData.fetchedAt,
          };
        }
      }
    } catch {
      // ESG enrichment is optional; don't fail the lookup
    }

    // List of auto-filled fields for UI feedback
    const autoFilledFields: string[] = [];
    
    if (responseData.name) autoFilledFields.push('name');
    if (responseData.ticker) autoFilledFields.push('ticker');
    if (responseData.isin) autoFilledFields.push('isin');
    if (responseData.mic) autoFilledFields.push('mic');
    if (responseData.exchangeName && !responseData.exchangeNameNotFound) autoFilledFields.push('exchangeName');
    if (responseData.category) autoFilledFields.push('category');
    if (responseData.type) autoFilledFields.push('type');
    if (responseData.country) autoFilledFields.push('country');
    if (responseData.currency && !responseData.currencyNotFound) autoFilledFields.push('currency');
    if (responseData.emitter) autoFilledFields.push('emitter');
    if (responseData.emitterLEI && !responseData.emitterLEINotFound) autoFilledFields.push('emitterLEI');
    if (responseData.gicsSector && !responseData.gicsSectorNotFound) autoFilledFields.push('gicsSector');
    if (responseData.industry && !responseData.industryNotFound) autoFilledFields.push('industry');
    if (responseData.listingType) autoFilledFields.push('listingType');
    if (responseData.isRegulatedMarket !== undefined) autoFilledFields.push('isRegulatedMarket');
    if (responseData.regulatoryDefaults) autoFilledFields.push('regulatoryDefaults');
    if (responseData.valuationDefaults) autoFilledFields.push('valuationDefaults');
    if (responseData.averageDailyVolume) autoFilledFields.push('averageDailyVolume');
    if (responseData.meetsLiquidityPresumption !== undefined) autoFilledFields.push('meetsLiquidityPresumption');
    if (responseData.securityUrl) autoFilledFields.push('securityUrl');
    
    return NextResponse.json({
      success: true,
      data: responseData,
      autoFilledFields,
      sourcesUsed: result.sourcesUsed.map(s => ({
        id: s,
        name: formatSourceName(s as any),
      })),
      warnings: result.warnings,
      esgSummary,
    });

  } catch (error) {
    console.error('Security lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup security' },
      { status: 500 }
    );
  }
}

// Get MIC codes list
export async function GET() {
  return NextResponse.json({
    micCodes: MIC_CODES,
    countries: COUNTRY_NAMES,
  });
}
