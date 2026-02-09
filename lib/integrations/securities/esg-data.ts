/**
 * ESG Data Integration
 * Fetches ESG scores from Yahoo Finance and checks against exclusion criteria.
 * Enhanced with provider-agnostic data and configurable revenue thresholds.
 */

import { getYahooFinanceClient } from './yahoo-finance-client';
import type { ExclusionInvolvement, NormalizedESGData } from '../esg/types';

const YAHOO_QUOTESUMMARY_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';

// ---------------------------------------------------------------------------
// Configurable revenue thresholds (per exclusion category)
// Used when provider supplies involvement percentages.
// ---------------------------------------------------------------------------

export interface RevenueThreshold {
  /** Revenue % above which the security is excluded outright */
  excludeAbovePercent: number;
  /** Revenue % above which a warning is raised (but not excluded) */
  warnAbovePercent: number;
}

/** Default revenue thresholds per category (industry best-practice defaults) */
export const DEFAULT_REVENUE_THRESHOLDS: Record<string, RevenueThreshold> = {
  weapons: { excludeAbovePercent: 0, warnAbovePercent: 0 },
  tobacco: { excludeAbovePercent: 5, warnAbovePercent: 0 },
  fossilFuels: { excludeAbovePercent: 5, warnAbovePercent: 1 },
  gambling: { excludeAbovePercent: 5, warnAbovePercent: 1 },
  adultContent: { excludeAbovePercent: 0, warnAbovePercent: 0 },
  animalTesting: { excludeAbovePercent: 10, warnAbovePercent: 5 },
  nuclear: { excludeAbovePercent: 10, warnAbovePercent: 5 },
  gmo: { excludeAbovePercent: 10, warnAbovePercent: 5 },
  alcohol: { excludeAbovePercent: 10, warnAbovePercent: 5 },
};

/** Fund-level exclusion policy (can be stored in DynamoDB per fund) */
export interface FundExclusionPolicy {
  fundId: string;
  categories: string[];
  /** Override default revenue thresholds per category */
  revenueThresholds?: Record<string, RevenueThreshold>;
  /** Maximum controversy level (0-5); higher => excluded */
  maxControversyLevel?: number;
};

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

// ---------------------------------------------------------------------------
// Enhanced exclusion check: consumes provider-level involvement data
// ---------------------------------------------------------------------------

export interface EnhancedExclusionResult extends ExclusionCheckResult {
  /** Provider-level involvement data that was evaluated */
  evaluatedInvolvements?: ExclusionInvolvement[];
  /** Which thresholds were applied */
  appliedThresholds?: Record<string, RevenueThreshold>;
}

/**
 * Enhanced exclusion check that merges keyword-based screening with
 * provider-level involvement data and configurable revenue thresholds.
 *
 * @param params.sector          GICS sector
 * @param params.industry        Industry name
 * @param params.companyName     Company name (for keyword matching)
 * @param params.controversyLevel 0-5 from provider
 * @param params.providerFlags   ExclusionInvolvement[] from ESG provider (optional)
 * @param params.policy          Fund-level exclusion policy (optional)
 */
export function checkExclusionsEnhanced(params: {
  sector?: string;
  industry?: string;
  companyName?: string;
  controversyLevel?: number;
  providerFlags?: ExclusionInvolvement[];
  policy?: FundExclusionPolicy;
}): EnhancedExclusionResult {
  const {
    sector,
    industry,
    companyName,
    controversyLevel,
    providerFlags = [],
    policy,
  } = params;

  const categories = policy?.categories ?? ['weapons', 'tobacco', 'fossilFuels'];
  const thresholds: Record<string, RevenueThreshold> = {
    ...DEFAULT_REVENUE_THRESHOLDS,
    ...(policy?.revenueThresholds ?? {}),
  };

  // Start with the existing keyword-based check for backward compatibility
  const base = checkExclusions(sector, industry, companyName, controversyLevel, categories);

  const result: EnhancedExclusionResult = {
    ...base,
    evaluatedInvolvements: providerFlags,
    appliedThresholds: thresholds,
  };

  // ---- Provider-level involvement data (revenue thresholds) ----
  for (const flag of providerFlags) {
    const cat = flag.category;
    if (!categories.includes(cat)) continue;

    const threshold = thresholds[cat];
    if (!threshold) continue;

    const revenue = flag.revenuePercent;
    const level = flag.involvementLevel;

    if (revenue !== undefined) {
      // Revenue-based threshold
      if (revenue > threshold.excludeAbovePercent) {
        result.excluded = true;
        const catDesc = ESG_EXCLUSION_LIST[cat as keyof typeof ESG_EXCLUSION_LIST]?.description ?? cat;
        const msg = `${catDesc}: ${revenue.toFixed(1)}% av intäkterna (tröskel: >${threshold.excludeAbovePercent}%)`;
        if (!result.reasons.includes(msg)) result.reasons.push(msg);
      } else if (revenue > threshold.warnAbovePercent) {
        const catDesc = ESG_EXCLUSION_LIST[cat as keyof typeof ESG_EXCLUSION_LIST]?.description ?? cat;
        const msg = `${catDesc}: ${revenue.toFixed(1)}% av intäkterna (varningströskel: >${threshold.warnAbovePercent}%)`;
        if (!result.warnings.includes(msg)) result.warnings.push(msg);
      }
    } else if (level === 'high') {
      // No revenue data but provider flags high involvement
      result.excluded = true;
      const catDesc = ESG_EXCLUSION_LIST[cat as keyof typeof ESG_EXCLUSION_LIST]?.description ?? cat;
      const msg = `${catDesc}: Hög involvering (leverantörsdata)`;
      if (!result.reasons.includes(msg)) result.reasons.push(msg);
    } else if (level === 'medium') {
      const catDesc = ESG_EXCLUSION_LIST[cat as keyof typeof ESG_EXCLUSION_LIST]?.description ?? cat;
      const msg = `${catDesc}: Medel involvering (leverantörsdata)`;
      if (!result.warnings.includes(msg)) result.warnings.push(msg);
    }
  }

  // ---- Fund-level max controversy ----
  const maxControversy = policy?.maxControversyLevel ?? 4;
  if (controversyLevel !== undefined && controversyLevel >= maxControversy) {
    result.excluded = true;
    const msg = `Kontroversialitetsnivå ${controversyLevel}/5 överstiger fondens gräns (${maxControversy})`;
    if (!result.reasons.includes(msg)) result.reasons.push(msg);
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
 * Complete ESG analysis combining ESG service (or Yahoo Finance fallback)
 * with exclusion checks and recommendation.
 *
 * When the ESG service is available (with any registered provider), it is used
 * as the primary data source. Otherwise falls back to the legacy Yahoo Finance
 * direct call.
 */
export async function analyzeESG(
  symbol: string,
  sector?: string,
  industry?: string,
  companyName?: string,
  fundArticle: '6' | '8' | '9' = '8',
  fundExclusionCategories: string[] = ['weapons', 'tobacco', 'fossilFuels'],
  fundExclusionPolicy?: FundExclusionPolicy
): Promise<{
  esgScores: ESGScores;
  exclusionCheck: EnhancedExclusionResult;
  recommendation: {
    recommendation: string;
    suitable: boolean;
    details: string[];
  };
  /** Normalized provider data if ESG service was used */
  normalizedData?: NormalizedESGData | null;
  /** Which provider served the data */
  dataSource?: string;
}> {
  let normalizedData: NormalizedESGData | null = null;
  let dataSource = 'yahoo_finance_legacy';

  // Try ESG service first (provider-agnostic path)
  try {
    const { getESGServiceClient } = await import('../esg/esg-service');
    const client = getESGServiceClient();
    const activeProvider = client.getActiveProviderName();

    if (activeProvider) {
      normalizedData = await client.getESGData(symbol);
      if (normalizedData) {
        dataSource = normalizedData.provider;
      }
    }
  } catch {
    // ESG service not available; fall through to legacy
  }

  // Build legacy ESGScores from normalizedData or fetch from Yahoo directly
  let esgScores: ESGScores;

  if (normalizedData) {
    // Convert normalized back to legacy ESGScores format for backward compat
    esgScores = {
      success: true,
      data: {
        totalScore: normalizedData.totalScore,
        environmentScore: normalizedData.environmentScore,
        socialScore: normalizedData.socialScore,
        governanceScore: normalizedData.governanceScore,
        percentile: normalizedData.percentile,
        peerGroup: normalizedData.peerGroup,
        controversyLevel: normalizedData.controversyLevel,
        relatedControversies: normalizedData.relatedControversies,
      },
      source: 'yahoo_finance', // type limitation; actual source in dataSource
      sourceUrl: '',
    };
  } else {
    esgScores = await getESGScores(symbol);
    dataSource = 'yahoo_finance_legacy';
  }

  // Enhanced exclusion check (uses provider involvement data when available)
  const exclusionCheck = checkExclusionsEnhanced({
    sector,
    industry,
    companyName,
    controversyLevel: esgScores.data?.controversyLevel ?? undefined,
    providerFlags: normalizedData?.exclusionFlags,
    policy: fundExclusionPolicy ?? {
      fundId: '',
      categories: fundExclusionCategories,
    },
  });

  // Get recommendation
  const recommendation = getESGRecommendation(esgScores, exclusionCheck, fundArticle);

  return {
    esgScores,
    exclusionCheck,
    recommendation,
    normalizedData,
    dataSource,
  };
}
