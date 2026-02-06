/**
 * API Route: Fund Restrictions and ESG Checks
 * Validates securities against fund-specific rules and ESG criteria
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkFundRestrictions, 
  getFundConfiguration,
  analyzeESG,
  checkExclusions,
  ESG_EXCLUSION_LIST,
} from '@/lib/integrations/securities';

// POST /api/securities/restrictions
// Check a security against fund restrictions and ESG criteria
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      security, 
      fundId,
      checkESG = true,
      positionValueSEK,
    } = body;

    if (!security || !fundId) {
      return NextResponse.json(
        { success: false, error: 'security och fundId krävs' },
        { status: 400 }
      );
    }

    // Get fund configuration
    const fundConfig = getFundConfiguration(fundId);

    // Prepare security info for restriction check
    const securityInfo = {
      isin: security.isin || '',
      name: security.name || '',
      ticker: security.ticker || '',
      sector: security.gicsSector || security.sector,
      industry: security.industry,
      country: security.country,
      currency: security.currency,
      type: security.type,
      category: security.category,
      marketCap: security.marketCap,
      listingType: security.listingType,
      isRegulatedMarket: security.isRegulatedMarket,
      averageDailyVolumeSEK: security.averageDailyVolumeSEK,
      positionValueSEK: positionValueSEK,
    };

    // Check fund restrictions
    const restrictionResults = checkFundRestrictions(
      securityInfo,
      fundConfig,
      fundConfig.restrictions
    );

    // Check ESG if requested
    let esgResults = null;
    if (checkESG) {
      // Check exclusions
      const exclusionCheck = checkExclusions(
        securityInfo.sector,
        securityInfo.industry,
        securityInfo.name,
        security.controversyLevel,
        fundConfig.esgExclusions
      );

      // Try to get ESG scores from Yahoo Finance
      let esgScores = null;
      if (security.yahooSymbol || security.ticker) {
        try {
          const esgAnalysis = await analyzeESG(
            security.yahooSymbol || security.ticker,
            securityInfo.sector,
            securityInfo.industry,
            securityInfo.name,
            fundConfig.article,
            fundConfig.esgExclusions
          );
          esgScores = esgAnalysis.esgScores;
        } catch (e) {
          console.log('ESG scores fetch failed, continuing without');
        }
      }

      esgResults = {
        exclusionCheck,
        esgScores,
        recommendation: getESGSummary(exclusionCheck, esgScores, fundConfig.article),
      };
    }

    // Combine results
    const overallPassed = restrictionResults.passed && 
      (!esgResults || !esgResults.exclusionCheck.excluded);

    return NextResponse.json({
      success: true,
      passed: overallPassed,
      fundConfig: {
        fundId: fundConfig.fundId,
        fundName: fundConfig.fundName,
        article: fundConfig.article,
        maxSectorWeight: fundConfig.maxSectorWeight,
        maxCountryWeight: fundConfig.maxCountryWeight,
        maxIssuerWeight: fundConfig.maxIssuerWeight,
        excludedCountries: fundConfig.excludedCountries,
        excludedSectors: fundConfig.excludedSectors,
        esgExclusions: fundConfig.esgExclusions.map(id => ({
          id,
          name: ESG_EXCLUSION_LIST[id as keyof typeof ESG_EXCLUSION_LIST]?.description || id,
        })),
      },
      restrictions: restrictionResults,
      esg: esgResults,
    });
  } catch (error) {
    console.error('Restrictions check error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte kontrollera restriktioner' },
      { status: 500 }
    );
  }
}

// GET /api/securities/restrictions
// Get available exclusion categories and fund configurations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fundId = searchParams.get('fundId');

    // Return specific fund configuration
    if (fundId) {
      const config = getFundConfiguration(fundId);
      return NextResponse.json({
        success: true,
        fundConfig: config,
        exclusionCategories: Object.entries(ESG_EXCLUSION_LIST).map(([id, cat]) => ({
          id,
          name: cat.description,
          severity: cat.severity,
          keywords: cat.keywords.slice(0, 5), // First 5 keywords
        })),
      });
    }

    // Return all available exclusion categories
    return NextResponse.json({
      success: true,
      exclusionCategories: Object.entries(ESG_EXCLUSION_LIST).map(([id, cat]) => ({
        id,
        name: cat.description,
        severity: cat.severity,
        keywords: cat.keywords.slice(0, 5),
      })),
    });
  } catch (error) {
    console.error('Restrictions GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte hämta restriktioner' },
      { status: 500 }
    );
  }
}

// Helper: Generate ESG summary
function getESGSummary(
  exclusionCheck: any,
  esgScores: any,
  article: '6' | '8' | '9'
): {
  status: 'passed' | 'warning' | 'failed';
  message: string;
  details: string[];
} {
  const details: string[] = [];

  // Check exclusions first
  if (exclusionCheck.excluded) {
    return {
      status: 'failed',
      message: 'Värdepappret är exkluderat enligt fondens ESG-policy',
      details: exclusionCheck.reasons,
    };
  }

  // Add warnings
  if (exclusionCheck.warnings.length > 0) {
    details.push(...exclusionCheck.warnings);
  }

  // Article 6 - minimal requirements
  if (article === '6') {
    return {
      status: exclusionCheck.warnings.length > 0 ? 'warning' : 'passed',
      message: 'Artikel 6-fond - grundläggande ESG-krav uppfylls',
      details: details.length > 0 ? details : ['Inga ESG-hinder identifierade'],
    };
  }

  // Check ESG scores for Article 8/9
  if (esgScores?.success && esgScores?.data) {
    const { totalScore, controversyLevel } = esgScores.data;

    if (totalScore !== null) {
      details.push(`ESG-score: ${totalScore.toFixed(1)}/100`);

      // Article 8 threshold
      if (article === '8' && totalScore < 50) {
        return {
          status: 'warning',
          message: 'Låg ESG-score för Artikel 8-fond',
          details: [...details, 'ESG-score under 50 kan kräva ytterligare motivering'],
        };
      }

      // Article 9 threshold
      if (article === '9' && totalScore < 70) {
        return {
          status: 'warning',
          message: 'ESG-score under rekommenderad nivå för Artikel 9-fond',
          details: [...details, 'ESG-score under 70 kan kräva ytterligare motivering'],
        };
      }
    }

    if (controversyLevel !== null && controversyLevel >= 4) {
      return {
        status: 'warning',
        message: 'Hög kontroversialitetsnivå',
        details: [...details, `Kontroversialitet: ${controversyLevel}/5`],
      };
    }
  } else {
    details.push('ESG-data kunde inte hämtas automatiskt');
  }

  return {
    status: exclusionCheck.warnings.length > 0 ? 'warning' : 'passed',
    message: `Uppfyller ESG-kriterier för Artikel ${article}-fond`,
    details: details.length > 0 ? details : ['Inga ESG-hinder identifierade'],
  };
}
