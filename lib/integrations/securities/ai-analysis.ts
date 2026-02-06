/**
 * AI Analysis Types for Security Approval
 * Types used for AI-generated field suggestions with strict source requirements
 */

import { EnrichedSecurityData } from './enriched-lookup';

/**
 * AI-generated field with citation
 */
export interface AIGeneratedField<T> {
  value: T;
  confidence: 'high' | 'medium' | 'low' | 'not_found';
  source: {
    type: 'ai_analysis';
    basedOn: string[]; // List of data points used
    reasoning: string; // Why this conclusion was reached
    generatedAt: string;
  };
  notFound?: boolean;
  error?: string;
}

/**
 * AI Analysis result
 */
export interface AIAnalysisResult {
  success: boolean;
  
  // Fund compliance
  complianceMotivation?: AIGeneratedField<string>;
  placementRestrictions?: AIGeneratedField<string>;
  
  // ESG
  environmentalCharacteristics?: AIGeneratedField<string>;
  socialCharacteristics?: AIGeneratedField<string>;
  
  // Valuation
  valuationMethodSuggestion?: AIGeneratedField<string>;
  
  // Liquidity
  liquidityMotivation?: AIGeneratedField<string>;
  marketabilityMotivation?: AIGeneratedField<string>;
  
  // Warnings/notes
  warnings: string[];
  errors: string[];
}

/**
 * Fund information for analysis
 */
export interface FundInfo {
  fundId: string;
  fundName: string;
  article: '6' | '8' | '9';
  investmentFocus?: string;
  restrictions?: string[];
}

/**
 * Create AI not-found response
 */
export function createAINotFound<T>(reason: string): AIGeneratedField<T> {
  return {
    value: '' as T,
    confidence: 'not_found',
    notFound: true,
    error: reason,
    source: {
      type: 'ai_analysis',
      basedOn: [],
      reasoning: reason,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Format market cap for display
 */
export function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)} biljoner`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} miljarder`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} miljoner`;
  }
  return value.toLocaleString('sv-SE');
}

/**
 * Build verified facts from enriched security data
 * Only includes fields that have actual values and sources
 */
export function buildVerifiedFacts(
  security: EnrichedSecurityData,
  additionalData?: {
    marketCap?: number;
    averageDailyValueSEK?: number;
    meetsLiquidityPresumption?: boolean;
  }
): string[] {
  const facts: string[] = [];

  if (security.name.value && !security.name.notFound) {
    facts.push(`Värdepapper: ${security.name.value} (källa: ${security.name.source.source})`);
  }
  if (security.isin.value && !security.isin.notFound) {
    facts.push(`ISIN: ${security.isin.value}`);
  }
  if (security.type.value && !security.type.notFound) {
    facts.push(`Typ: ${security.type.value} (källa: ${security.type.source.source})`);
  }
  if (security.category.value && !security.category.notFound) {
    facts.push(`Kategori: ${security.category.value}`);
  }
  if (security.country.value && !security.country.notFound) {
    facts.push(`Land: ${security.countryName?.value || security.country.value}`);
  }
  if (security.currency.value && !security.currency.notFound) {
    facts.push(`Valuta: ${security.currency.value}`);
  }
  if (security.isRegulatedMarket.value !== undefined && !security.isRegulatedMarket.notFound) {
    facts.push(`Reglerad marknad: ${security.isRegulatedMarket.value ? 'Ja' : 'Nej'}`);
  }
  if (security.exchangeName?.value && !security.exchangeName.notFound) {
    facts.push(`Börs: ${security.exchangeName.value}`);
  }
  if (security.gicsSector?.value && !security.gicsSector.notFound) {
    facts.push(`Sektor: ${security.gicsSector.value} (källa: ${security.gicsSector.source.source})`);
  }
  if (security.industry?.value && !security.industry.notFound) {
    facts.push(`Bransch: ${security.industry.value} (källa: ${security.industry.source.source})`);
  }
  
  // Additional market data
  if (additionalData?.marketCap) {
    facts.push(`Börsvärde: ${formatMarketCap(additionalData.marketCap)}`);
  }
  if (additionalData?.averageDailyValueSEK) {
    facts.push(`Genomsnittlig daglig omsättning: ${formatMarketCap(additionalData.averageDailyValueSEK)} SEK`);
  }
  if (additionalData?.meetsLiquidityPresumption !== undefined) {
    facts.push(`Uppfyller likviditetspresumtion (>400 MSEK): ${additionalData.meetsLiquidityPresumption ? 'Ja' : 'Nej'}`);
  }

  return facts;
}
