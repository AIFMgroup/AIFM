/**
 * Enriched Security Lookup
 * Combines data from multiple sources with full provenance tracking
 */

import { getOpenFIGIClient, MIC_CODES, COUNTRY_NAMES, mapSecurityTypeToCategory, getListingType, getDefaultRegulatoryFlags } from './openfigi-client';
import { getGLEIFClient } from './gleif-client';
import { getYahooFinanceClient } from './yahoo-finance-client';

/**
 * Source information for a field
 */
export interface FieldSource {
  source: 'openfigi' | 'gleif' | 'yahoo_finance' | 'mic_database' | 'isin_derivation' | 'regulatory_rule';
  sourceUrl: string;
  retrievedAt: string;
  confidence: 'high' | 'medium' | 'low';
  rawValue?: string | number | boolean;
}

/**
 * A field value with its source
 */
export interface SourcedField<T> {
  value: T;
  source: FieldSource;
  notFound?: boolean;
  error?: string;
}

/**
 * Enriched security data with full source tracking
 */
export interface EnrichedSecurityData {
  // Basic identification
  isin: SourcedField<string>;
  name: SourcedField<string>;
  ticker: SourcedField<string>;
  figi?: SourcedField<string>;
  
  // Exchange/Market info
  mic: SourcedField<string>;
  exchangeName: SourcedField<string>;
  isRegulatedMarket: SourcedField<boolean>;
  listingType: SourcedField<string>;
  
  // Classification
  securityType: SourcedField<string>;
  category: SourcedField<string>;
  type: SourcedField<string>;
  
  // Geography & Currency
  country: SourcedField<string>;
  countryName: SourcedField<string>;
  currency: SourcedField<string>;
  
  // Emitter info
  emitter: SourcedField<string>;
  emitterLEI?: SourcedField<string>;
  
  // Sector
  gicsSector?: SourcedField<string>;
  industry?: SourcedField<string>;
  
  // Market data
  marketCap?: SourcedField<number>;
  currentPrice?: SourcedField<number>;
  averageDailyVolume?: SourcedField<number>;
  averageDailyValueSEK?: SourcedField<number>;
  
  // Liquidity analysis
  meetsLiquidityPresumption?: SourcedField<boolean>;
  estimatedLiquidationDays?: SourcedField<number>;
  liquidityCategory?: SourcedField<string>;
  
  // Regulatory defaults (for regulated markets)
  regulatoryDefaults?: {
    limitedPotentialLoss: SourcedField<boolean>;
    liquidityNotEndangered: SourcedField<boolean>;
    reliableValuationChecked: SourcedField<boolean>;
    appropriateInfoChecked: SourcedField<boolean>;
    isMarketable: SourcedField<boolean>;
    compatibleWithFund: SourcedField<boolean>;
    riskManagementCaptures: SourcedField<boolean>;
  };
  
  // Valuation defaults
  valuationDefaults?: {
    reliableDailyPrices: SourcedField<boolean>;
    reliableValuationType: SourcedField<string>;
    appropriateInfoType: SourcedField<string>;
    priceSourceUrl?: SourcedField<string>;
  };
}

/**
 * Lookup result with all sources
 */
export interface EnrichedLookupResult {
  success: boolean;
  data?: EnrichedSecurityData;
  errors: string[];
  warnings: string[];
  sourcesUsed: string[];
}

/**
 * Create a sourced field
 */
function createSourcedField<T>(
  value: T,
  source: FieldSource['source'],
  sourceUrl: string,
  confidence: FieldSource['confidence'] = 'high',
  rawValue?: string | number | boolean
): SourcedField<T> {
  return {
    value,
    source: {
      source,
      sourceUrl,
      retrievedAt: new Date().toISOString(),
      confidence,
      rawValue,
    },
  };
}

/**
 * Create a not-found field
 */
function createNotFoundField<T>(
  source: FieldSource['source'],
  error: string
): SourcedField<T> {
  return {
    value: '' as T,
    notFound: true,
    error,
    source: {
      source,
      sourceUrl: '',
      retrievedAt: new Date().toISOString(),
      confidence: 'low',
    },
  };
}

/**
 * Get country code from ISIN
 */
function getCountryFromISIN(isin: string): string {
  if (!isin || isin.length < 2) return '';
  return isin.substring(0, 2).toUpperCase();
}

/**
 * Perform enriched lookup combining all data sources
 */
export async function performEnrichedLookup(
  isin: string,
  ticker?: string,
  mic?: string
): Promise<EnrichedLookupResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourcesUsed: string[] = [];

  // 1. OpenFIGI lookup (primary source)
  const figiClient = getOpenFIGIClient();
  let figiResult;
  
  if (isin) {
    figiResult = await figiClient.lookupByISIN(isin, mic);
  } else if (ticker) {
    figiResult = await figiClient.lookupByTicker(ticker, mic);
  }

  if (!figiResult?.success) {
    return {
      success: false,
      errors: [figiResult?.error || 'Värdepappret hittades inte i OpenFIGI'],
      warnings: [],
      sourcesUsed: ['openfigi'],
    };
  }

  sourcesUsed.push('openfigi');
  const figiData = figiResult.data!;

  // 2. Derive data from ISIN and MIC
  const exchangeCode = figiData.exchangeCode || mic || '';
  const micInfo = MIC_CODES[exchangeCode.toUpperCase()];
  const isinCountry = getCountryFromISIN(isin);
  const country = isinCountry || micInfo?.country || '';
  const isRegulatedMarket = micInfo?.regulated ?? true;
  
  sourcesUsed.push('mic_database');

  // 3. GLEIF lookup for LEI
  const gleifClient = getGLEIFClient();
  const gleifResult = await gleifClient.searchByName(figiData.name, country);
  
  if (gleifResult.success) {
    sourcesUsed.push('gleif');
  } else {
    warnings.push(`LEI kunde inte hittas: ${gleifResult.error}`);
  }

  // 4. Yahoo Finance for market data
  const yahooClient = getYahooFinanceClient();
  const yahooResult = await yahooClient.getQuoteByISIN(isin, ticker || figiData.ticker, mic);
  
  if (yahooResult.success) {
    sourcesUsed.push('yahoo_finance');
  } else {
    warnings.push(`Marknadsdata kunde inte hämtas: ${yahooResult.error}`);
  }

  // 5. Build enriched data with sources
  const { category, type } = mapSecurityTypeToCategory(figiData.securityType || '');
  const listingType = getListingType(exchangeCode);
  const regulatoryFlags = getDefaultRegulatoryFlags(isRegulatedMarket);

  const enrichedData: EnrichedSecurityData = {
    // Basic identification
    isin: createSourcedField(isin, 'isin_derivation', '', 'high'),
    name: createSourcedField(figiData.name, 'openfigi', 'https://www.openfigi.com/', 'high', figiData.name),
    ticker: createSourcedField(figiData.ticker, 'openfigi', 'https://www.openfigi.com/', 'high'),
    figi: figiData.figi ? createSourcedField(figiData.figi, 'openfigi', 'https://www.openfigi.com/', 'high') : undefined,

    // Exchange/Market info
    mic: createSourcedField(exchangeCode, 'openfigi', 'https://www.openfigi.com/', 'high'),
    exchangeName: micInfo 
      ? createSourcedField(micInfo.name, 'mic_database', 'https://www.iso20022.org/market-identifier-codes', 'high')
      : createNotFoundField('mic_database', 'MIC-kod inte hittad i databasen'),
    isRegulatedMarket: createSourcedField(
      isRegulatedMarket, 
      'mic_database', 
      'https://www.iso20022.org/market-identifier-codes',
      'high'
    ),
    listingType: createSourcedField(listingType, 'mic_database', 'https://www.iso20022.org/market-identifier-codes', 'high'),

    // Classification
    securityType: createSourcedField(figiData.securityType, 'openfigi', 'https://www.openfigi.com/', 'high'),
    category: createSourcedField(category, 'openfigi', 'https://www.openfigi.com/', 'high', figiData.securityType),
    type: createSourcedField(type, 'openfigi', 'https://www.openfigi.com/', 'high', figiData.securityType),

    // Geography & Currency
    country: createSourcedField(country, 'isin_derivation', 'https://www.isin.org/', 'high', isin.substring(0, 2)),
    countryName: createSourcedField(
      COUNTRY_NAMES[country] || country,
      'isin_derivation',
      'https://www.isin.org/',
      'high'
    ),
    currency: micInfo
      ? createSourcedField(micInfo.currency, 'mic_database', 'https://www.iso20022.org/market-identifier-codes', 'high')
      : createNotFoundField('mic_database', 'Valuta kunde inte härledas'),

    // Emitter info
    emitter: createSourcedField(figiData.name, 'openfigi', 'https://www.openfigi.com/', 'medium'),
    emitterLEI: gleifResult.success && gleifResult.data
      ? createSourcedField(gleifResult.data.lei, 'gleif', gleifResult.sourceUrl, 'high')
      : createNotFoundField('gleif', gleifResult.error || 'LEI hittades inte'),
  };

  // Add Yahoo Finance data if available
  if (yahooResult.success && yahooResult.data) {
    const yd = yahooResult.data;
    
    if (yd.sector) {
      enrichedData.gicsSector = createSourcedField(yd.sector, 'yahoo_finance', yahooResult.sourceUrl, 'high');
    }
    if (yd.industry) {
      enrichedData.industry = createSourcedField(yd.industry, 'yahoo_finance', yahooResult.sourceUrl, 'high');
    }
    if (yd.marketCap) {
      enrichedData.marketCap = createSourcedField(yd.marketCap, 'yahoo_finance', yahooResult.sourceUrl, 'high');
    }
    if (yd.regularMarketPrice) {
      enrichedData.currentPrice = createSourcedField(yd.regularMarketPrice, 'yahoo_finance', yahooResult.sourceUrl, 'high');
    }
    if (yd.averageDailyVolume3Month) {
      enrichedData.averageDailyVolume = createSourcedField(
        yd.averageDailyVolume3Month, 
        'yahoo_finance', 
        yahooResult.sourceUrl, 
        'high'
      );

      // Calculate daily value in SEK
      const price = yd.regularMarketPrice || 0;
      const currency = yd.currency || enrichedData.currency.value;
      const toSEK: Record<string, number> = {
        'USD': 10.5, 'EUR': 11.5, 'GBP': 13.5, 'NOK': 1.0, 'DKK': 1.55, 'CHF': 12.0, 'SEK': 1.0,
      };
      const rate = toSEK[currency] || 1;
      const dailyValueSEK = yd.averageDailyVolume3Month * price * rate;

      enrichedData.averageDailyValueSEK = createSourcedField(
        Math.round(dailyValueSEK),
        'yahoo_finance',
        yahooResult.sourceUrl,
        'medium'
      );

      // Liquidity presumption check (400 MSEK)
      const meetsPresumption = dailyValueSEK > 400_000_000;
      enrichedData.meetsLiquidityPresumption = createSourcedField(
        meetsPresumption,
        'yahoo_finance',
        yahooResult.sourceUrl,
        'medium',
        dailyValueSEK
      );
    }
  }

  // Add regulatory defaults for regulated markets
  if (isRegulatedMarket) {
    const regSource = 'regulatory_rule';
    const regUrl = 'https://www.fi.se/sv/vara-register/fffs/';
    
    enrichedData.regulatoryDefaults = {
      limitedPotentialLoss: createSourcedField(true, regSource, regUrl, 'high'),
      liquidityNotEndangered: createSourcedField(true, regSource, regUrl, 'high'),
      reliableValuationChecked: createSourcedField(true, regSource, regUrl, 'high'),
      appropriateInfoChecked: createSourcedField(true, regSource, regUrl, 'high'),
      isMarketable: createSourcedField(true, regSource, regUrl, 'high'),
      compatibleWithFund: createSourcedField(true, regSource, regUrl, 'medium'),
      riskManagementCaptures: createSourcedField(true, regSource, regUrl, 'medium'),
    };

    // Determine price source URL based on exchange
    const priceSourceUrl = getPriceSourceUrl(exchangeCode, figiData.ticker, isin);
    
    enrichedData.valuationDefaults = {
      reliableDailyPrices: createSourcedField(true, regSource, regUrl, 'high'),
      reliableValuationType: createSourcedField('market_price', regSource, regUrl, 'high'),
      appropriateInfoType: createSourcedField('regular_market_info', regSource, regUrl, 'high'),
      priceSourceUrl: priceSourceUrl
        ? createSourcedField(priceSourceUrl, 'mic_database', priceSourceUrl, 'high')
        : undefined,
    };
  }

  return {
    success: true,
    data: enrichedData,
    errors,
    warnings,
    sourcesUsed,
  };
}

/**
 * Get price source URL based on exchange
 */
function getPriceSourceUrl(mic: string, ticker?: string, isin?: string): string | null {
  const upperMic = mic?.toUpperCase() || '';
  
  // Nordic exchanges (Nasdaq)
  if (['XSTO', 'XHEL', 'XCSE', 'XICE'].includes(upperMic)) {
    if (isin) {
      return `https://www.nasdaqomxnordic.com/shares/microsite?Instrument=${isin}`;
    }
    return 'https://www.nasdaqomxnordic.com/';
  }
  
  // Oslo Børs
  if (['XOSL', 'XOAS'].includes(upperMic)) {
    if (ticker) {
      return `https://www.oslobors.no/ob/servlets/components?type=quote&strip=true&comp=table&columns=ITEM%2CLAST%2CTIME%2CCHANGE_PCT_SLACK%2CBID%2CASK%2CHIGH%2CLOW%2CTURNOVER%2CVOLUMETOT&itemSector=${ticker}.OSE`;
    }
    return 'https://www.oslobors.no/';
  }
  
  // London Stock Exchange
  if (['XLON'].includes(upperMic)) {
    if (ticker) {
      return `https://www.londonstockexchange.com/stock/${ticker}/company-page`;
    }
    return 'https://www.londonstockexchange.com/';
  }
  
  // Deutsche Börse (XETRA, Frankfurt)
  if (['XETR', 'XFRA'].includes(upperMic)) {
    if (isin) {
      return `https://www.boerse-frankfurt.de/equity/${isin}`;
    }
    return 'https://www.boerse-frankfurt.de/';
  }
  
  // Euronext (Paris, Amsterdam, Brussels, Lisbon)
  if (['XPAR', 'XAMS', 'XBRU', 'XLIS'].includes(upperMic)) {
    if (isin) {
      return `https://live.euronext.com/en/product/equities/${isin}`;
    }
    return 'https://live.euronext.com/';
  }
  
  // SIX Swiss Exchange
  if (['XSWX'].includes(upperMic)) {
    if (isin) {
      return `https://www.six-group.com/en/products-services/the-swiss-stock-exchange/market-data/shares/share-explorer/share-details.html?isin=${isin}`;
    }
    return 'https://www.six-group.com/';
  }
  
  // US exchanges - use Yahoo Finance as it's public
  if (['XNYS', 'XNAS', 'XASE'].includes(upperMic)) {
    if (ticker) {
      return `https://finance.yahoo.com/quote/${ticker}`;
    }
    return null;
  }
  
  // Default: return Yahoo Finance if we have a ticker
  if (ticker) {
    return `https://finance.yahoo.com/quote/${ticker}`;
  }
  
  return null;
}

/**
 * Format source name for display
 */
export function formatSourceName(source: FieldSource['source']): string {
  const names: Record<FieldSource['source'], string> = {
    'openfigi': 'OpenFIGI (Bloomberg)',
    'gleif': 'GLEIF',
    'yahoo_finance': 'Yahoo Finance',
    'mic_database': 'ISO MIC Database',
    'isin_derivation': 'ISIN Standard',
    'regulatory_rule': 'FFFS 2013:9 / LVF',
  };
  return names[source] || source;
}
