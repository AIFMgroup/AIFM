/**
 * ESG Data Integration
 * Fetches ESG scores from Yahoo Finance and checks against exclusion criteria
 */

import { getYahooFinanceClient } from './yahoo-finance-client';

const YAHOO_QUOTESUMMARY_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';

export interface ESGScores {
  success: boolean;
  data?: {
    totalScore: number | null;
    environmentScore: number | null;
    socialScore: number | null;
    governanceScore: number | null;
    percentile: number | null;
    peerGroup: string | null;
    controversyLevel: number | null; // 0-5, higher is worse
    relatedControversies?: string[];
  };
  error?: string;
  source: 'yahoo_finance';
  sourceUrl: string;
}

export interface ExclusionCheckResult {
  excluded: boolean;
  reasons: string[];
  warnings: string[];
  sector?: string;
  industry?: string;
  controversyLevel?: number;
  source: string;
}

/**
 * ESG Exclusion Categories
 * Based on common SFDR Article 8/9 exclusion criteria
 */
export const ESG_EXCLUSION_LIST = {
  // Weapons & Defense
  weapons: {
    keywords: [
      'weapon', 'defense', 'military', 'ammunition', 'firearms', 'arms',
      'aerospace & defense', 'defense primes', 'cluster munitions',
      'nuclear weapons', 'biological weapons', 'chemical weapons',
      'landmines', 'depleted uranium',
    ],
    description: 'Vapen och försvarsindustri',
    severity: 'high',
  },
  
  // Tobacco
  tobacco: {
    keywords: ['tobacco', 'cigarette', 'cigar', 'smoking', 'nicotine'],
    description: 'Tobaksproduktion',
    severity: 'high',
  },
  
  // Fossil fuels
  fossilFuels: {
    keywords: [
      'coal', 'oil & gas', 'oil sands', 'arctic drilling', 'fracking',
      'thermal coal', 'tar sands', 'deep sea drilling',
    ],
    description: 'Fossila bränslen (kol, olja, gas)',
    severity: 'medium',
  },
  
  // Gambling
  gambling: {
    keywords: ['gambling', 'casino', 'betting', 'lottery', 'gaming'],
    description: 'Spel och hasardspel',
    severity: 'medium',
  },
  
  // Adult entertainment
  adultContent: {
    keywords: ['adult entertainment', 'pornography'],
    description: 'Vuxenunderhållning',
    severity: 'high',
  },
  
  // Controversial animal testing
  animalTesting: {
    keywords: ['animal testing', 'fur', 'animal cruelty'],
    description: 'Djurförsök/päls',
    severity: 'low',
  },
  
  // Nuclear power (some funds exclude)
  nuclear: {
    keywords: ['nuclear power', 'uranium mining'],
    description: 'Kärnkraft',
    severity: 'low',
  },
  
  // GMO (some funds exclude)
  gmo: {
    keywords: ['genetically modified', 'gmo'],
    description: 'Genetiskt modifierade organismer',
    severity: 'low',
  },
  
  // Alcohol
  alcohol: {
    keywords: ['alcoholic beverages', 'brewery', 'distillery', 'spirits'],
    description: 'Alkoholproduktion',
    severity: 'low',
  },
};

// Industry mappings to exclusion categories
const INDUSTRY_EXCLUSIONS: Record<string, string[]> = {
  'Aerospace & Defense': ['weapons'],
  'Tobacco': ['tobacco'],
  'Oil & Gas': ['fossilFuels'],
  'Coal': ['fossilFuels'],
  'Casinos & Gaming': ['gambling'],
  'Brewers': ['alcohol'],
  'Distillers & Vintners': ['alcohol'],
};

// GICS sector mappings to potential concerns
const SECTOR_CONCERNS: Record<string, string[]> = {
  'Energy': ['fossilFuels'],
  'Materials': ['fossilFuels'], // Mining
  'Consumer Staples': ['tobacco', 'alcohol'],
};

/**
 * Fetch ESG scores from Yahoo Finance
 */
export async function getESGScores(symbol: string): Promise<ESGScores> {
  try {
    const url = `${YAHOO_QUOTESUMMARY_URL}/${symbol}?modules=esgScores`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIFM/1.0)',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Kunde inte hämta ESG-data från Yahoo Finance',
        source: 'yahoo_finance',
        sourceUrl: `https://finance.yahoo.com/quote/${symbol}/sustainability`,
      };
    }

    const data = await response.json();
    const esgData = data.quoteSummary?.result?.[0]?.esgScores;

    if (!esgData) {
      return {
        success: false,
        error: 'Ingen ESG-data tillgänglig för detta värdepapper',
        source: 'yahoo_finance',
        sourceUrl: `https://finance.yahoo.com/quote/${symbol}/sustainability`,
      };
    }

    return {
      success: true,
      data: {
        totalScore: esgData.totalEsg?.raw || null,
        environmentScore: esgData.environmentScore?.raw || null,
        socialScore: esgData.socialScore?.raw || null,
        governanceScore: esgData.governanceScore?.raw || null,
        percentile: esgData.percentile?.raw || null,
        peerGroup: esgData.peerGroup || null,
        controversyLevel: esgData.highestControversy || null,
        relatedControversies: esgData.relatedControversy || [],
      },
      source: 'yahoo_finance',
      sourceUrl: `https://finance.yahoo.com/quote/${symbol}/sustainability`,
    };
  } catch (error) {
    console.error('ESG fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel vid hämtning av ESG-data',
      source: 'yahoo_finance',
      sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
    };
  }
}

/**
 * Check if a security should be excluded based on ESG criteria
 */
export function checkExclusions(
  sector?: string,
  industry?: string,
  companyName?: string,
  controversyLevel?: number,
  fundExclusionCategories: string[] = ['weapons', 'tobacco', 'fossilFuels']
): ExclusionCheckResult {
  const result: ExclusionCheckResult = {
    excluded: false,
    reasons: [],
    warnings: [],
    sector,
    industry,
    controversyLevel,
    source: 'internal_exclusion_list',
  };

  const sectorLower = sector?.toLowerCase() || '';
  const industryLower = industry?.toLowerCase() || '';
  const nameLower = companyName?.toLowerCase() || '';

  // Check each exclusion category
  for (const categoryId of fundExclusionCategories) {
    const category = ESG_EXCLUSION_LIST[categoryId as keyof typeof ESG_EXCLUSION_LIST];
    if (!category) continue;

    for (const keyword of category.keywords) {
      const keywordLower = keyword.toLowerCase();
      
      if (
        industryLower.includes(keywordLower) ||
        sectorLower.includes(keywordLower) ||
        nameLower.includes(keywordLower)
      ) {
        if (category.severity === 'high') {
          result.excluded = true;
          result.reasons.push(`${category.description}: Matchar "${keyword}"`);
        } else {
          result.warnings.push(`${category.description}: Potentiell matchning mot "${keyword}"`);
        }
      }
    }
  }

  // Check industry mappings
  if (industry) {
    const industryExclusions = INDUSTRY_EXCLUSIONS[industry];
    if (industryExclusions) {
      for (const exclusionId of industryExclusions) {
        if (fundExclusionCategories.includes(exclusionId)) {
          const category = ESG_EXCLUSION_LIST[exclusionId as keyof typeof ESG_EXCLUSION_LIST];
          if (category && category.severity === 'high') {
            result.excluded = true;
            if (!result.reasons.some(r => r.includes(category.description))) {
              result.reasons.push(`${category.description}: Industri "${industry}" är exkluderad`);
            }
          }
        }
      }
    }
  }

  // Check controversy level (4-5 is severe)
  if (controversyLevel !== undefined && controversyLevel >= 4) {
    result.warnings.push(`Hög kontroversialitetsnivå: ${controversyLevel}/5`);
  }

  return result;
}

/**
 * Get ESG recommendation text based on scores and exclusions
 */
export function getESGRecommendation(
  esgScores: ESGScores,
  exclusionCheck: ExclusionCheckResult,
  fundArticle: '6' | '8' | '9'
): {
  recommendation: string;
  suitable: boolean;
  details: string[];
} {
  const details: string[] = [];
  let suitable = true;

  // Check exclusions first
  if (exclusionCheck.excluded) {
    return {
      recommendation: 'Värdepappret uppfyller INTE fondens exkluderingskriterier',
      suitable: false,
      details: exclusionCheck.reasons,
    };
  }

  // Add warnings
  if (exclusionCheck.warnings.length > 0) {
    details.push(...exclusionCheck.warnings.map(w => `⚠️ ${w}`));
  }

  // Article 6 funds have no specific ESG requirements
  if (fundArticle === '6') {
    return {
      recommendation: 'Artikel 6-fond - Inga specifika ESG-krav gäller',
      suitable: true,
      details: ['Hållbarhetsrisker bör dock beaktas i investeringsbeslutet'],
    };
  }

  // Check ESG scores for Article 8/9 funds
  if (esgScores.success && esgScores.data) {
    const { totalScore, environmentScore, socialScore, governanceScore, controversyLevel, percentile } = esgScores.data;

    if (totalScore !== null) {
      details.push(`ESG Total Score: ${totalScore.toFixed(1)}/100`);
      
      if (environmentScore !== null) details.push(`  - Miljö: ${environmentScore.toFixed(1)}`);
      if (socialScore !== null) details.push(`  - Socialt: ${socialScore.toFixed(1)}`);
      if (governanceScore !== null) details.push(`  - Styrning: ${governanceScore.toFixed(1)}`);
      
      if (percentile !== null) {
        details.push(`Percentil inom peer group: ${percentile}%`);
      }

      // Article 8: Must promote E or S characteristics
      if (fundArticle === '8') {
        if (totalScore >= 50 || (environmentScore && environmentScore >= 50) || (socialScore && socialScore >= 50)) {
          details.push('✓ Uppfyller miniminivå för Artikel 8-fond');
        } else {
          details.push('⚠️ Låg ESG-score kan vara problematisk för Artikel 8-fond');
          suitable = false;
        }
      }

      // Article 9: Must have sustainable investment as objective
      if (fundArticle === '9') {
        if (totalScore >= 70 && controversyLevel !== null && controversyLevel < 3) {
          details.push('✓ Uppfyller ESG-krav för Artikel 9-fond');
        } else {
          if (totalScore < 70) {
            details.push('⚠️ ESG-score under 70 kan vara problematisk för Artikel 9-fond');
          }
          if (controversyLevel !== null && controversyLevel >= 3) {
            details.push(`⚠️ Kontroversialitetsnivå ${controversyLevel}/5 är för hög för Artikel 9-fond`);
          }
          suitable = false;
        }
      }
    }

    if (controversyLevel !== null) {
      if (controversyLevel >= 4) {
        details.push(`⚠️ Hög kontroversialitetsnivå (${controversyLevel}/5)`);
        suitable = false;
      } else if (controversyLevel >= 3) {
        details.push(`Medelkontroversialitet (${controversyLevel}/5)`);
      }
    }
  } else {
    details.push('ESG-data kunde inte hämtas - manuell bedömning krävs');
  }

  return {
    recommendation: suitable 
      ? `Värdepappret uppfyller ESG-kriterier för Artikel ${fundArticle}-fond`
      : `Värdepappret kan ha ESG-problem för Artikel ${fundArticle}-fond`,
    suitable,
    details,
  };
}

/**
 * Complete ESG analysis combining Yahoo Finance data and exclusion checks
 */
export async function analyzeESG(
  symbol: string,
  sector?: string,
  industry?: string,
  companyName?: string,
  fundArticle: '6' | '8' | '9' = '8',
  fundExclusionCategories: string[] = ['weapons', 'tobacco', 'fossilFuels']
): Promise<{
  esgScores: ESGScores;
  exclusionCheck: ExclusionCheckResult;
  recommendation: {
    recommendation: string;
    suitable: boolean;
    details: string[];
  };
}> {
  // Fetch ESG scores
  const esgScores = await getESGScores(symbol);

  // Check exclusions
  const exclusionCheck = checkExclusions(
    sector,
    industry,
    companyName,
    esgScores.data?.controversyLevel ?? undefined,
    fundExclusionCategories
  );

  // Get recommendation
  const recommendation = getESGRecommendation(esgScores, exclusionCheck, fundArticle);

  return {
    esgScores,
    exclusionCheck,
    recommendation,
  };
}
