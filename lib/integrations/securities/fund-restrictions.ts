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
 * Fund-specific restriction configurations
 * Artikel 8/9 fonder har striktare regler, Artikel 6 har grundkrav.
 */

const SANCTIONED_COUNTRIES = ['RU', 'BY', 'KP', 'IR'];
const ALL_RESTRICTIONS = ['sector_concentration', 'country_concentration', 'excluded_countries', 'excluded_sectors', 'issuer_concentration', 'liquidity_requirement', 'regulated_market'];

export const FUND_CONFIGURATIONS: Record<string, Partial<FundData>> = {
  // ── Artikel 8 ──
  'auag-essential-metals': {
    fundId: 'auag-essential-metals', fundName: 'AuAg Essential Metals', article: '8', aum: 395_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'auag-gold-rush': {
    fundId: 'auag-gold-rush', fundName: 'AuAg Gold Rush', article: '8', aum: 606_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'auag-precious-green': {
    fundId: 'auag-precious-green', fundName: 'AuAg Precious Green', article: '8', aum: 347_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'auag-silver-bullet': {
    fundId: 'auag-silver-bullet', fundName: 'AuAg Silver Bullet', article: '8', aum: 4_322_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'sensum-strategy-global': {
    fundId: 'sensum-strategy-global', fundName: 'Sensum Strategy Global', article: '8', aum: 280_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'clusterMines', 'chemicalBiological', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'vinga-corporate-bond': {
    fundId: 'vinga-corporate-bond', fundName: 'Vinga Corporate Bond', article: '8', aum: 350_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling', 'SMS-lån'],
    esgExclusions: ['fossilFuels', 'controversialWeapons', 'smsLoans', 'gambling', 'alcohol', 'tobacco', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'plain-capital-bronx': {
    fundId: 'plain-capital-bronx', fundName: 'Plain Capital BronX', article: '8', aum: 750_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'controversialWeapons', 'tobacco', 'alcohol', 'adultContent', 'fossilFuels', 'gambling'], restrictions: ALL_RESTRICTIONS,
  },
  'plain-capital-lunatix': {
    fundId: 'plain-capital-lunatix', fundName: 'Plain Capital LunatiX', article: '8', aum: 620_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'controversialWeapons', 'tobacco', 'alcohol', 'adultContent', 'fossilFuels', 'gambling'], restrictions: ALL_RESTRICTIONS,
  },
  'plain-capital-styx': {
    fundId: 'plain-capital-styx', fundName: 'Plain Capital StyX', article: '8', aum: 480_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'controversialWeapons', 'tobacco', 'alcohol', 'adultContent', 'fossilFuels', 'gambling'], restrictions: ALL_RESTRICTIONS,
  },
  'metaspace-fund': {
    fundId: 'metaspace-fund', fundName: 'MetaSpace Fund', article: '8', aum: 85_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'lucy-global-fund': {
    fundId: 'lucy-global-fund', fundName: 'Lucy Global Fund', article: '8', aum: 150_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'sam-aktiv-ranta': {
    fundId: 'sam-aktiv-ranta', fundName: 'SAM Aktiv Ränta', article: '8', aum: 210_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.40, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Fossil Fuels'],
    esgExclusions: ['weapons', 'controversialWeapons', 'nuclearWeapons', 'tobacco', 'adultContent', 'fossilFuels'], restrictions: ALL_RESTRICTIONS,
  },
  'arte-collectum-ii': {
    fundId: 'arte-collectum-ii', fundName: 'Arte Collectum II AB', article: '8', aum: 80_000_000,
    maxSectorWeight: 0.30, maxCountryWeight: 0.50, maxIssuerWeight: 0.10, maxIlliquidWeight: 0.20,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons'],
    esgExclusions: ['weapons', 'tobacco', 'controversialWeapons', 'nuclearWeapons', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  // ── Artikel 9 ──
  'proethos-fond': {
    fundId: 'proethos-fond', fundName: 'Proethos Fond', article: '9', aum: 420_000_000,
    maxSectorWeight: 0.20, maxCountryWeight: 0.35, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.10,
    excludedCountries: [...SANCTIONED_COUNTRIES, 'SA'], excludedSectors: ['Tobacco', 'Weapons', 'Gambling', 'Oil & Gas', 'Coal', 'Nuclear'],
    esgExclusions: ['weapons', 'tobacco', 'fossilFuels', 'gambling', 'nuclear', 'alcohol', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  'arte-collectum-i': {
    fundId: 'arte-collectum-i', fundName: 'Arte Collectum I AB', article: '9', aum: 120_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.50, maxIssuerWeight: 0.10, maxIlliquidWeight: 0.20,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Tobacco', 'Weapons', 'Gambling', 'Oil & Gas', 'Coal'],
    esgExclusions: ['weapons', 'tobacco', 'fossilFuels', 'gambling', 'adultContent'], restrictions: ALL_RESTRICTIONS,
  },
  // ── Artikel 6 ──
  'epoque': {
    fundId: 'epoque', fundName: 'EPOQUE', article: '6', aum: 180_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.50, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
  },
  'go-blockchain-fund': {
    fundId: 'go-blockchain-fund', fundName: 'Go Blockchain Fund', article: '6', aum: 120_000_000,
    maxSectorWeight: 0.30, maxCountryWeight: 0.50, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
  },
  'soic-dynamic-china': {
    fundId: 'soic-dynamic-china', fundName: 'SOIC Dynamic China', article: '6', aum: 150_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.60, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: ['RU', 'BY', 'KP', 'IR'], excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
  },
  'arden-xfund': {
    fundId: 'arden-xfund', fundName: 'Arden xFund', article: '6', aum: 100_000_000,
    maxSectorWeight: 0.25, maxCountryWeight: 0.50, maxIssuerWeight: 0.05, maxIlliquidWeight: 0.15,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
  },
  'sbp-kredit': {
    fundId: 'sbp-kredit', fundName: 'SBP Kredit', article: '6', aum: 300_000_000,
    maxSectorWeight: 0.30, maxCountryWeight: 0.50, maxIssuerWeight: 0.10, maxIlliquidWeight: 0.20,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
  },
  'estea-omsorgsfastigheter': {
    fundId: 'estea-omsorgsfastigheter', fundName: 'Estea Omsorgsfastigheter', article: '6', aum: 200_000_000,
    maxSectorWeight: 0.30, maxCountryWeight: 0.50, maxIssuerWeight: 0.10, maxIlliquidWeight: 0.25,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
  },
  'ssid-co-invest-fund': {
    fundId: 'ssid-co-invest-fund', fundName: 'SSID Co-Invest Fund', article: '6', aum: 50_000_000,
    maxSectorWeight: 0.30, maxCountryWeight: 0.50, maxIssuerWeight: 0.10, maxIlliquidWeight: 0.25,
    excludedCountries: SANCTIONED_COUNTRIES, excludedSectors: ['Weapons'],
    esgExclusions: ['controversialWeapons'], restrictions: ALL_RESTRICTIONS,
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
