/**
 * OpenFIGI API Client
 * Free API from Bloomberg for security identifier mapping
 * https://www.openfigi.com/api
 */

const OPENFIGI_API_URL = 'https://api.openfigi.com/v3/mapping';
const OPENFIGI_SEARCH_URL = 'https://api.openfigi.com/v3/search';

export interface OpenFIGIRequest {
  idType: 'ID_ISIN' | 'TICKER' | 'ID_CUSIP' | 'ID_SEDOL' | 'ID_BB_GLOBAL' | 'COMPOSITE_ID_BB_GLOBAL';
  idValue: string;
  exchCode?: string; // Optional exchange code
  micCode?: string; // Optional MIC code
  currency?: string;
}

export interface OpenFIGIResult {
  figi: string;
  securityType: string;
  marketSector: string;
  ticker: string;
  name: string;
  exchCode: string;
  compositeFIGI: string;
  uniqueID: string;
  securityType2?: string;
  shareClassFIGI?: string;
  uniqueIDFutOpt?: string;
  securityDescription?: string;
}

export interface OpenFIGIResponse {
  data?: OpenFIGIResult[];
  error?: string;
  warning?: string;
}

export interface SecurityLookupResult {
  success: boolean;
  data?: {
    isin: string;
    name: string;
    ticker: string;
    exchangeCode: string;
    mic?: string;
    securityType: string;
    marketSector: string;
    currency?: string;
    country?: string;
    figi: string;
    compositeFigi?: string;
    description?: string;
  };
  error?: string;
  raw?: OpenFIGIResult[];
}

export class OpenFIGIClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENFIGI_API_KEY;
  }

  /**
   * Lookup security by ISIN
   */
  async lookupByISIN(isin: string, micCode?: string): Promise<SecurityLookupResult> {
    const request: OpenFIGIRequest = {
      idType: 'ID_ISIN',
      idValue: isin.toUpperCase(),
    };
    
    if (micCode) {
      request.micCode = micCode.toUpperCase();
    }

    return this.lookup([request]);
  }

  /**
   * Lookup security by ticker
   */
  async lookupByTicker(ticker: string, exchCode?: string): Promise<SecurityLookupResult> {
    const request: OpenFIGIRequest = {
      idType: 'TICKER',
      idValue: ticker.toUpperCase(),
    };
    
    if (exchCode) {
      request.exchCode = exchCode.toUpperCase();
    }

    return this.lookup([request]);
  }

  /**
   * Perform lookup request
   */
  private async lookup(requests: OpenFIGIRequest[]): Promise<SecurityLookupResult> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['X-OPENFIGI-APIKEY'] = this.apiKey;
      }

      const response = await fetch(OPENFIGI_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requests),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return { success: false, error: 'Rate limit exceeded. Please try again in a moment.' };
        }
        return { success: false, error: `API error: ${response.status}` };
      }

      const results: OpenFIGIResponse[] = await response.json();
      
      if (!results || results.length === 0) {
        return { success: false, error: 'No results found' };
      }

      const firstResult = results[0];
      
      if (firstResult.error) {
        return { success: false, error: firstResult.error };
      }

      if (!firstResult.data || firstResult.data.length === 0) {
        return { success: false, error: 'Security not found. Please verify the ISIN/ticker.' };
      }

      // Get the first match (usually the primary listing)
      const security = firstResult.data[0];
      
      return {
        success: true,
        data: {
          isin: requests[0].idValue,
          name: security.name,
          ticker: security.ticker,
          exchangeCode: security.exchCode,
          securityType: security.securityType,
          marketSector: security.marketSector,
          figi: security.figi,
          compositeFigi: security.compositeFIGI,
          description: security.securityDescription,
        },
        raw: firstResult.data,
      };
    } catch (error) {
      console.error('OpenFIGI lookup error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to lookup security' 
      };
    }
  }

  /**
   * Search for securities by query
   */
  async search(query: string): Promise<SecurityLookupResult[]> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['X-OPENFIGI-APIKEY'] = this.apiKey;
      }

      const response = await fetch(OPENFIGI_SEARCH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      
      if (!result.data || result.data.length === 0) {
        return [];
      }

      return result.data.map((security: OpenFIGIResult) => ({
        success: true,
        data: {
          isin: '',
          name: security.name,
          ticker: security.ticker,
          exchangeCode: security.exchCode,
          securityType: security.securityType,
          marketSector: security.marketSector,
          figi: security.figi,
          compositeFigi: security.compositeFIGI,
          description: security.securityDescription,
        },
      }));
    } catch (error) {
      console.error('OpenFIGI search error:', error);
      return [];
    }
  }
}

// Singleton instance
let client: OpenFIGIClient | null = null;

export function getOpenFIGIClient(): OpenFIGIClient {
  if (!client) {
    client = new OpenFIGIClient();
  }
  return client;
}

/**
 * MIC Code database (common Swedish/Nordic exchanges)
 */
export const MIC_CODES: Record<string, { name: string; country: string; type: string; currency: string; regulated: boolean }> = {
  'XSTO': { name: 'Nasdaq Stockholm', country: 'SE', type: 'Regulated Market', currency: 'SEK', regulated: true },
  'XNGM': { name: 'Nordic Growth Market', country: 'SE', type: 'MTF', currency: 'SEK', regulated: false },
  'SSME': { name: 'Spotlight Stock Market', country: 'SE', type: 'MTF', currency: 'SEK', regulated: false },
  'FNSE': { name: 'First North Sweden', country: 'SE', type: 'MTF', currency: 'SEK', regulated: false },
  'XHEL': { name: 'Nasdaq Helsinki', country: 'FI', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XCSE': { name: 'Nasdaq Copenhagen', country: 'DK', type: 'Regulated Market', currency: 'DKK', regulated: true },
  'XOSL': { name: 'Oslo Børs', country: 'NO', type: 'Regulated Market', currency: 'NOK', regulated: true },
  'XLON': { name: 'London Stock Exchange', country: 'GB', type: 'Regulated Market', currency: 'GBP', regulated: true },
  'XETR': { name: 'Xetra', country: 'DE', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XFRA': { name: 'Frankfurt Stock Exchange', country: 'DE', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XPAR': { name: 'Euronext Paris', country: 'FR', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XAMS': { name: 'Euronext Amsterdam', country: 'NL', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XNYS': { name: 'New York Stock Exchange', country: 'US', type: 'Regulated Market', currency: 'USD', regulated: true },
  'XNAS': { name: 'Nasdaq', country: 'US', type: 'Regulated Market', currency: 'USD', regulated: true },
  'XTSE': { name: 'Toronto Stock Exchange', country: 'CA', type: 'Regulated Market', currency: 'CAD', regulated: true },
  'XJPX': { name: 'Japan Exchange Group', country: 'JP', type: 'Regulated Market', currency: 'JPY', regulated: true },
  'XHKG': { name: 'Hong Kong Stock Exchange', country: 'HK', type: 'Regulated Market', currency: 'HKD', regulated: true },
  'XSHG': { name: 'Shanghai Stock Exchange', country: 'CN', type: 'Regulated Market', currency: 'CNY', regulated: true },
  'XSWX': { name: 'SIX Swiss Exchange', country: 'CH', type: 'Regulated Market', currency: 'CHF', regulated: true },
  'XMIL': { name: 'Borsa Italiana', country: 'IT', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XMAD': { name: 'Bolsa de Madrid', country: 'ES', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XLIS': { name: 'Euronext Lisbon', country: 'PT', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XBRU': { name: 'Euronext Brussels', country: 'BE', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XDUB': { name: 'Euronext Dublin', country: 'IE', type: 'Regulated Market', currency: 'EUR', regulated: true },
  'XWAR': { name: 'Warsaw Stock Exchange', country: 'PL', type: 'Regulated Market', currency: 'PLN', regulated: true },
  'XPRA': { name: 'Prague Stock Exchange', country: 'CZ', type: 'Regulated Market', currency: 'CZK', regulated: true },
  'XBUD': { name: 'Budapest Stock Exchange', country: 'HU', type: 'Regulated Market', currency: 'HUF', regulated: true },
  'XASX': { name: 'Australian Securities Exchange', country: 'AU', type: 'Regulated Market', currency: 'AUD', regulated: true },
  'XNZE': { name: 'New Zealand Exchange', country: 'NZ', type: 'Regulated Market', currency: 'NZD', regulated: true },
  'XKRX': { name: 'Korea Exchange', country: 'KR', type: 'Regulated Market', currency: 'KRW', regulated: true },
  'XTAI': { name: 'Taiwan Stock Exchange', country: 'TW', type: 'Regulated Market', currency: 'TWD', regulated: true },
  'XSES': { name: 'Singapore Exchange', country: 'SG', type: 'Regulated Market', currency: 'SGD', regulated: true },
};

/**
 * Country code to name mapping
 */
export const COUNTRY_NAMES: Record<string, string> = {
  'SE': 'Sverige',
  'NO': 'Norge',
  'DK': 'Danmark',
  'FI': 'Finland',
  'US': 'USA',
  'GB': 'Storbritannien',
  'DE': 'Tyskland',
  'FR': 'Frankrike',
  'NL': 'Nederländerna',
  'CH': 'Schweiz',
  'IT': 'Italien',
  'ES': 'Spanien',
  'PT': 'Portugal',
  'BE': 'Belgien',
  'IE': 'Irland',
  'AT': 'Österrike',
  'PL': 'Polen',
  'CZ': 'Tjeckien',
  'HU': 'Ungern',
  'CA': 'Kanada',
  'AU': 'Australien',
  'NZ': 'Nya Zeeland',
  'JP': 'Japan',
  'HK': 'Hongkong',
  'CN': 'Kina',
  'KR': 'Sydkorea',
  'TW': 'Taiwan',
  'SG': 'Singapore',
  'LU': 'Luxemburg',
};

/**
 * Extract country code from ISIN (first 2 characters)
 */
export function getCountryFromISIN(isin: string): string {
  if (!isin || isin.length < 2) return '';
  return isin.substring(0, 2).toUpperCase();
}

/**
 * GICS Sector mapping
 */
export const GICS_SECTORS: Record<string, string> = {
  '10': 'Energy',
  '15': 'Materials',
  '20': 'Industrials',
  '25': 'Consumer Discretionary',
  '30': 'Consumer Staples',
  '35': 'Health Care',
  '40': 'Financials',
  '45': 'Information Technology',
  '50': 'Communication Services',
  '55': 'Utilities',
  '60': 'Real Estate',
};

/**
 * Map OpenFIGI market sector to Swedish GICS
 */
export const MARKET_SECTOR_TO_GICS: Record<string, string> = {
  'Equity': 'Aktier',
  'Govt': 'Statsobligationer',
  'Corp': 'Företagsobligationer',
  'Mtge': 'Bostadsobligationer',
  'Muni': 'Kommunobligationer',
  'Pfd': 'Preferensaktier',
  'Comdty': 'Råvaror',
  'Curncy': 'Valutor',
  'Index': 'Index',
};

/**
 * Map OpenFIGI security type to our category/type
 */
export function mapSecurityTypeToCategory(securityType: string): { category: string; type: string } {
  const mapping: Record<string, { category: string; type: string }> = {
    'Common Stock': { category: 'transferable_security', type: 'stock' },
    'Depositary Receipt': { category: 'transferable_security', type: 'stock' },
    'ADR': { category: 'transferable_security', type: 'stock' },
    'GDR': { category: 'transferable_security', type: 'stock' },
    'Preference': { category: 'transferable_security', type: 'stock' },
    'REIT': { category: 'transferable_security', type: 'stock' },
    'MLP': { category: 'transferable_security', type: 'stock' },
    'ETF': { category: 'transferable_security', type: 'etf' },
    'ETP': { category: 'transferable_security', type: 'etf' },
    'ETN': { category: 'transferable_security', type: 'certificate' },
    'Open-End Fund': { category: 'fund_unit', type: 'fund' },
    'Closed-End Fund': { category: 'fund_unit', type: 'fund' },
    'Unit Trust': { category: 'fund_unit', type: 'fund' },
    'Corporate Bond': { category: 'transferable_security', type: 'bond' },
    'Government Bond': { category: 'transferable_security', type: 'bond' },
    'Municipal Bond': { category: 'transferable_security', type: 'bond' },
    'Convertible': { category: 'transferable_security', type: 'bond' },
    'Warrant': { category: 'derivative', type: 'warrant' },
    'Right': { category: 'derivative', type: 'warrant' },
    'Option': { category: 'derivative', type: 'option' },
    'Future': { category: 'derivative', type: 'future' },
    'Index Future': { category: 'derivative', type: 'future' },
    'Currency Future': { category: 'derivative', type: 'future' },
  };
  
  return mapping[securityType] || { category: 'other', type: 'other' };
}

/**
 * Determine listing type based on MIC
 */
export function getListingType(mic: string): string {
  const micInfo = MIC_CODES[mic?.toUpperCase()];
  if (!micInfo) return 'regulated_market'; // Default assumption
  return micInfo.regulated ? 'regulated_market' : 'other_regulated';
}

/**
 * Get default regulatory checkboxes for regulated market securities
 */
export function getDefaultRegulatoryFlags(isRegulatedMarket: boolean): Record<string, boolean> {
  if (isRegulatedMarket) {
    return {
      // FFFS 2013:9 24 kap. 1 § - presumed to be met for regulated market securities
      limitedPotentialLoss: true,
      liquidityNotEndangered: true, // Presumed per OBS note in the form
      reliableValuationChecked: true,
      appropriateInfoChecked: true,
      isMarketable: true, // Presumed per OBS note
      compatibleWithFund: true,
      riskManagementCaptures: true,
    };
  }
  return {
    limitedPotentialLoss: false,
    liquidityNotEndangered: false,
    reliableValuationChecked: false,
    appropriateInfoChecked: false,
    isMarketable: false,
    compatibleWithFund: false,
    riskManagementCaptures: false,
  };
}
