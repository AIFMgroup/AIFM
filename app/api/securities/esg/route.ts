import { NextRequest, NextResponse } from 'next/server';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';

/**
 * GET /api/securities/esg?identifier=ISIN_OR_TICKER
 *
 * Returns normalized ESG data for a security (same shape as lookup's esgSummary)
 * so the new-approval form can auto-fill all ESG steps from the ESG API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const identifier = searchParams.get('identifier')?.trim();

    if (!identifier) {
      return NextResponse.json(
        { error: 'Query parameter "identifier" (ISIN or ticker) is required' },
        { status: 400 }
      );
    }

    const esgClient = getESGServiceClient();
    const activeProvider = esgClient.getActiveProviderName();
    const availableProviders = esgClient.getAvailableProviders();
    console.log(`[ESG API] Active provider: ${activeProvider}, available: [${availableProviders.join(', ')}], DATIA_API_KEY present: ${Boolean(process.env.DATIA_API_KEY)}`);
    
    if (!activeProvider) {
      return NextResponse.json(
        { error: `Ingen ESG-leverantör är konfigurerad. Tillgängliga: [${availableProviders.join(', ')}]. DATIA_API_KEY: ${process.env.DATIA_API_KEY ? 'set' : 'MISSING'}` },
        { status: 503 }
      );
    }

    console.log(`[ESG API] Fetching ESG data for ${identifier} from ${activeProvider}`);
    const esgData = await esgClient.getESGData(identifier);
    console.log(`[ESG API] Result: ${esgData ? 'data received' : 'null'}`);
    
    if (!esgData) {
      return NextResponse.json(
        { error: `Ingen ESG-data hittades för ${identifier} (provider: ${activeProvider})` },
        { status: 404 }
      );
    }

    const esgSummary: Record<string, unknown> = {
      provider: esgData.provider,
      totalScore: esgData.totalScore,
      environmentScore: esgData.environmentScore,
      socialScore: esgData.socialScore,
      governanceScore: esgData.governanceScore,
      controversyLevel: esgData.controversyLevel,
      sfdrAlignment: esgData.sfdrAlignment,
      taxonomyAlignmentPercent: esgData.taxonomyAlignmentPercent,
      carbonIntensity: esgData.carbonIntensity,
      carbonIntensityUnit: esgData.carbonIntensityUnit,
      exclusionFlags: esgData.exclusionFlags,
      meetsExclusionCriteria: esgData.meetsExclusionCriteria,
      paiIndicators: esgData.paiIndicators,
      fetchedAt: esgData.fetchedAt,
    };

    try {
      const paiData = await esgClient.getPAIIndicators(identifier);
      if (paiData?.length) {
        esgSummary.paiIndicators = paiData;
      }
    } catch {
      // PAI is optional
    }

    return NextResponse.json({
      success: true,
      esgSummary,
    });
  } catch (error) {
    console.error('[ESG API] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta ESG-data' },
      { status: 500 }
    );
  }
}
