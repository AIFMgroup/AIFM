/**
 * Fund Restrictions Configuration and Validation
 * Checks securities against fund-specific placement rules
 */

export interface FundRestriction {
  id: string;
  name: string;
  description: string;
  type: 'sector' | 'country' | 'issuer' | 'concentration' | 'liquidity' | 'esg' | 'security_type' | 'custom';
  condition: (security: SecurityInfo, fundData: FundData) => RestrictionResult;
}

export interface SecurityInfo {
  isin: string;
  name: string;
  ticker: string;
  sector?: string;
  industry?: string;
  country?: string;
  currency?: string;
  type?: string;
  category?: string;
  marketCap?: number;
  listingType?: string;
  isRegulatedMarket?: boolean;
  averageDailyVolumeSEK?: number;
  positionValueSEK?: number;
}

export interface FundData {
  fundId: string;
  fundName: string;
  article: '6' | '8' | '9';
  aum: number; // Assets under management in SEK
  currentPositions: {
    isin: string;
    name: string;
    sector: string;
    country: string;
    issuer: string;
    weight: number; // Percentage
    valueSEK: number;
  }[];
  restrictions: string[]; // IDs of applicable restrictions
  maxSectorWeight: number; // e.g., 0.20 for 20%
  maxCountryWeight: number;
  maxIssuerWeight: number;
  maxIlliquidWeight: number;
  excludedCountries: string[];
  excludedSectors: string[];
  esgExclusions: string[];
}

export interface RestrictionResult {
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  currentValue?: number;
  limit?: number;
}

/**
 * Default fund restrictions based on Swedish regulations and common practices
 */
export const DEFAULT_RESTRICTIONS: FundRestriction[] = [
  // Sector concentration
  {
    id: 'sector_concentration',
    name: 'Sektorkoncentration',
    description: 'Max 20% av fondförmögenheten i en enskild sektor',
    type: 'sector',
    condition: (security, fundData) => {
      if (!security.sector) {
        return { passed: true, severity: 'info', message: 'Sektorinformation saknas' };
      }

      const currentSectorWeight = fundData.currentPositions
        .filter(p => p.sector === security.sector)
        .reduce((sum, p) => sum + p.weight, 0);

      const newPositionWeight = security.positionValueSEK 
        ? (security.positionValueSEK / fundData.aum) * 100 
        : 0;

      const projectedWeight = currentSectorWeight + newPositionWeight;
      const limit = fundData.maxSectorWeight * 100;

      if (projectedWeight > limit) {
        return {
          passed: false,
          severity: 'error',
          message: `Sektorexponering mot ${security.sector} överskrider ${limit}%`,
          details: `Nuvarande: ${currentSectorWeight.toFixed(1)}%, efter köp: ${projectedWeight.toFixed(1)}%`,
          currentValue: projectedWeight,
          limit,
        };
      }

      if (projectedWeight > limit * 0.9) {
        return {
          passed: true,
          severity: 'warning',
          message: `Sektorexponering närmar sig gränsen (${projectedWeight.toFixed(1)}% av ${limit}%)`,
          currentValue: projectedWeight,
          limit,
        };
      }

      return { passed: true, severity: 'info', message: 'Sektorexponering OK' };
    },
  },

  // Country concentration
  {
    id: 'country_concentration',
    name: 'Landskoncentration',
    description: 'Max exponering mot enskilt land',
    type: 'country',
    condition: (security, fundData) => {
      if (!security.country) {
        return { passed: true, severity: 'info', message: 'Landsinformation saknas' };
      }

      const currentCountryWeight = fundData.currentPositions
        .filter(p => p.country === security.country)
        .reduce((sum, p) => sum + p.weight, 0);

      const newPositionWeight = security.positionValueSEK 
        ? (security.positionValueSEK / fundData.aum) * 100 
        : 0;

      const projectedWeight = currentCountryWeight + newPositionWeight;
      const limit = fundData.maxCountryWeight * 100;

      if (projectedWeight > limit) {
        return {
          passed: false,
          severity: 'error',
          message: `Landsexponering mot ${security.country} överskrider ${limit}%`,
          currentValue: projectedWeight,
          limit,
        };
      }

      return { passed: true, severity: 'info', message: 'Landsexponering OK' };
    },
  },

  // Excluded countries
  {
    id: 'excluded_countries',
    name: 'Exkluderade länder',
    description: 'Länder som är uteslutna från investeringar',
    type: 'country',
    condition: (security, fundData) => {
      if (!security.country) {
        return { passed: true, severity: 'info', message: 'Landsinformation saknas' };
      }

      if (fundData.excludedCountries.includes(security.country)) {
        return {
          passed: false,
          severity: 'error',
          message: `${security.country} är exkluderat enligt fondens placeringsregler`,
        };
      }

      return { passed: true, severity: 'info', message: 'Landet är tillåtet' };
    },
  },

  // Excluded sectors
  {
    id: 'excluded_sectors',
    name: 'Exkluderade sektorer',
    description: 'Sektorer som är uteslutna från investeringar',
    type: 'sector',
    condition: (security, fundData) => {
      if (!security.sector && !security.industry) {
        return { passed: true, severity: 'info', message: 'Sektorinformation saknas' };
      }

      const sectorLower = security.sector?.toLowerCase() || '';
      const industryLower = security.industry?.toLowerCase() || '';

      for (const excluded of fundData.excludedSectors) {
        const excludedLower = excluded.toLowerCase();
        if (sectorLower.includes(excludedLower) || industryLower.includes(excludedLower)) {
          return {
            passed: false,
            severity: 'error',
            message: `Sektorn/branschen "${security.sector || security.industry}" är exkluderad`,
          };
        }
      }

      return { passed: true, severity: 'info', message: 'Sektorn är tillåten' };
    },
  },

  // Issuer concentration (5 kap. 5 § LVF)
  {
    id: 'issuer_concentration',
    name: 'Emittentkoncentration',
    description: 'Max 5% av fondförmögenheten i värdepapper från samma emittent (LVF 5:5)',
    type: 'issuer',
    condition: (security, fundData) => {
      const issuerName = security.name; // Simplified - would need proper issuer matching
      
      const currentIssuerWeight = fundData.currentPositions
        .filter(p => p.issuer === issuerName || p.name.includes(security.name.split(' ')[0]))
        .reduce((sum, p) => sum + p.weight, 0);

      const newPositionWeight = security.positionValueSEK 
        ? (security.positionValueSEK / fundData.aum) * 100 
        : 0;

      const projectedWeight = currentIssuerWeight + newPositionWeight;
      const limit = fundData.maxIssuerWeight * 100;

      if (projectedWeight > limit) {
        return {
          passed: false,
          severity: 'error',
          message: `Emittentexponering överskrider ${limit}% (LVF 5 kap. 5 §)`,
          currentValue: projectedWeight,
          limit,
        };
      }

      if (projectedWeight > limit * 0.8) {
        return {
          passed: true,
          severity: 'warning',
          message: `Emittentexponering närmar sig gränsen (${projectedWeight.toFixed(1)}% av ${limit}%)`,
          currentValue: projectedWeight,
          limit,
        };
      }

      return { passed: true, severity: 'info', message: 'Emittentkoncentration OK' };
    },
  },

  // Liquidity requirement
  {
    id: 'liquidity_requirement',
    name: 'Likviditetskrav',
    description: 'Max andel illikvida tillgångar i fonden',
    type: 'liquidity',
    condition: (security, fundData) => {
      // Check if security meets liquidity presumption (>400 MSEK daily volume)
      const isLiquid = security.averageDailyVolumeSEK 
        ? security.averageDailyVolumeSEK > 400_000_000 
        : security.isRegulatedMarket || false;

      if (isLiquid) {
        return { passed: true, severity: 'info', message: 'Uppfyller likviditetspresumtionen' };
      }

      // Calculate current illiquid weight
      const currentIlliquidWeight = fundData.currentPositions
        .filter(p => !p.weight) // Simplified - would need proper liquidity data
        .reduce((sum, p) => sum + p.weight, 0);

      const newPositionWeight = security.positionValueSEK 
        ? (security.positionValueSEK / fundData.aum) * 100 
        : 0;

      const projectedIlliquidWeight = currentIlliquidWeight + newPositionWeight;
      const limit = fundData.maxIlliquidWeight * 100;

      if (projectedIlliquidWeight > limit) {
        return {
          passed: false,
          severity: 'error',
          message: `Andel illikvida tillgångar överskrider ${limit}%`,
          currentValue: projectedIlliquidWeight,
          limit,
        };
      }

      return {
        passed: true,
        severity: 'warning',
        message: 'Värdepappret klassificeras som illikvid men inom gränsen',
        currentValue: projectedIlliquidWeight,
        limit,
      };
    },
  },

  // Regulated market requirement
  {
    id: 'regulated_market',
    name: 'Reglerad marknad',
    description: 'Krav på notering på reglerad marknad',
    type: 'security_type',
    condition: (security, fundData) => {
      if (security.isRegulatedMarket || security.listingType === 'regulated_market') {
        return { passed: true, severity: 'info', message: 'Noterat på reglerad marknad' };
      }

      if (security.listingType === 'other_regulated') {
        return {
          passed: true,
          severity: 'warning',
          message: 'Noterat på annan reglerad handelsplats (MTF)',
        };
      }

      if (security.listingType === 'unlisted') {
        return {
          passed: true,
          severity: 'warning',
          message: 'Onoterat värdepapper - kräver särskild motivering',
        };
      }

      return { passed: true, severity: 'info', message: 'Noteringstyp kontrollerad' };
    },
  },

  // Market cap requirement (some funds have minimum market cap)
  {
    id: 'market_cap_minimum',
    name: 'Minsta börsvärde',
    description: 'Minsta börsvärde för investering',
    type: 'custom',
    condition: (security, fundData) => {
      const minMarketCap = 1_000_000_000; // 1 billion SEK default
      
      if (!security.marketCap) {
        return { passed: true, severity: 'info', message: 'Börsvärde ej tillgängligt' };
      }

      if (security.marketCap < minMarketCap) {
        return {
          passed: true,
          severity: 'warning',
          message: `Börsvärde ${formatSEK(security.marketCap)} under rekommenderat minimum ${formatSEK(minMarketCap)}`,
          currentValue: security.marketCap,
          limit: minMarketCap,
        };
      }

      return { passed: true, severity: 'info', message: 'Börsvärde OK' };
    },
  },
];

/**
 * Format SEK amount for display
 */
function formatSEK(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)} mdr SEK`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} MSEK`;
  }
  return `${amount.toLocaleString('sv-SE')} SEK`;
}

/**
 * Check all fund restrictions for a security
 */
export function checkFundRestrictions(
  security: SecurityInfo,
  fundData: FundData,
  restrictionIds?: string[]
): {
  passed: boolean;
  results: (RestrictionResult & { restrictionId: string; restrictionName: string })[];
  errors: string[];
  warnings: string[];
} {
  const applicableRestrictions = restrictionIds 
    ? DEFAULT_RESTRICTIONS.filter(r => restrictionIds.includes(r.id))
    : DEFAULT_RESTRICTIONS;

  const results: (RestrictionResult & { restrictionId: string; restrictionName: string })[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let passed = true;

  for (const restriction of applicableRestrictions) {
    try {
      const result = restriction.condition(security, fundData);
      results.push({
        ...result,
        restrictionId: restriction.id,
        restrictionName: restriction.name,
      });

      if (!result.passed) {
        passed = false;
        errors.push(`${restriction.name}: ${result.message}`);
      } else if (result.severity === 'warning') {
        warnings.push(`${restriction.name}: ${result.message}`);
      }
    } catch (error) {
      console.error(`Error checking restriction ${restriction.id}:`, error);
      results.push({
        passed: true,
        severity: 'info',
        message: 'Kunde inte kontrollera denna regel',
        restrictionId: restriction.id,
        restrictionName: restriction.name,
      });
    }
  }

  return { passed, results, errors, warnings };
}

/**
 * Example fund configurations
 */
export const FUND_CONFIGURATIONS: Record<string, Partial<FundData>> = {
  'fund-1': {
    fundId: 'fund-1',
    fundName: 'Nordic Ventures I',
    article: '8',
    aum: 500_000_000,
    maxSectorWeight: 0.25,
    maxCountryWeight: 0.40,
    maxIssuerWeight: 0.05,
    maxIlliquidWeight: 0.15,
    excludedCountries: ['RU', 'BY', 'KP', 'IR'],
    excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco'],
    restrictions: ['sector_concentration', 'country_concentration', 'excluded_countries', 'issuer_concentration', 'liquidity_requirement'],
  },
  'fund-2': {
    fundId: 'fund-2',
    fundName: 'Nordic Ventures II',
    article: '9',
    aum: 300_000_000,
    maxSectorWeight: 0.20,
    maxCountryWeight: 0.35,
    maxIssuerWeight: 0.05,
    maxIlliquidWeight: 0.10,
    excludedCountries: ['RU', 'BY', 'KP', 'IR', 'SA'],
    excludedSectors: ['Tobacco', 'Weapons', 'Gambling', 'Oil & Gas', 'Coal'],
    esgExclusions: ['weapons', 'tobacco', 'fossilFuels', 'gambling'],
    restrictions: ['sector_concentration', 'country_concentration', 'excluded_countries', 'excluded_sectors', 'issuer_concentration', 'liquidity_requirement'],
  },
  'fund-3': {
    fundId: 'fund-3',
    fundName: 'AIFM Räntebärande',
    article: '6',
    aum: 200_000_000,
    maxSectorWeight: 0.30,
    maxCountryWeight: 0.50,
    maxIssuerWeight: 0.10,
    maxIlliquidWeight: 0.20,
    excludedCountries: ['RU', 'BY', 'KP'],
    excludedSectors: [],
    esgExclusions: ['weapons'],
    restrictions: ['excluded_countries', 'issuer_concentration'],
  },
  'fund-4': {
    fundId: 'fund-4',
    fundName: 'Global Tech Fund',
    article: '8',
    aum: 750_000_000,
    maxSectorWeight: 0.40, // Higher for tech fund
    maxCountryWeight: 0.50,
    maxIssuerWeight: 0.05,
    maxIlliquidWeight: 0.10,
    excludedCountries: ['RU', 'BY', 'KP', 'IR', 'CN'],
    excludedSectors: ['Tobacco', 'Weapons'],
    esgExclusions: ['weapons', 'tobacco'],
    restrictions: ['sector_concentration', 'country_concentration', 'excluded_countries', 'issuer_concentration', 'liquidity_requirement', 'market_cap_minimum'],
  },
};

/**
 * Get fund configuration with defaults
 */
export function getFundConfiguration(fundId: string): FundData {
  const config = FUND_CONFIGURATIONS[fundId] || {};
  
  return {
    fundId: config.fundId || fundId,
    fundName: config.fundName || 'Unknown Fund',
    article: config.article || '6',
    aum: config.aum || 100_000_000,
    currentPositions: [], // Would be fetched from portfolio system
    restrictions: config.restrictions || ['issuer_concentration', 'liquidity_requirement'],
    maxSectorWeight: config.maxSectorWeight || 0.25,
    maxCountryWeight: config.maxCountryWeight || 0.50,
    maxIssuerWeight: config.maxIssuerWeight || 0.05,
    maxIlliquidWeight: config.maxIlliquidWeight || 0.15,
    excludedCountries: config.excludedCountries || ['RU', 'BY', 'KP'],
    excludedSectors: config.excludedSectors || [],
    esgExclusions: config.esgExclusions || ['weapons'],
  };
}
