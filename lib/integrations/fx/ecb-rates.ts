/**
 * ECB FX Rates Integration
 * 
 * Hämtar valutakurser från Europeiska Centralbanken (ECB)
 * ECB publicerar dagliga referenskurser kl 16:00 CET
 * 
 * API: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
 */

// ============================================================================
// Types
// ============================================================================

export interface FXRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  rateDate: string;
  source: 'ECB' | 'RIKSBANKEN' | 'MANUAL';
  timestamp: string;
}

export interface ECBRatesResponse {
  success: boolean;
  date: string;
  base: string;
  rates: Record<string, number>;
  source: string;
}

// ============================================================================
// ECB API Client
// ============================================================================

const ECB_DAILY_RATES_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const ECB_HISTORICAL_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';

/**
 * Fetch latest FX rates from ECB
 */
export async function fetchECBRates(): Promise<ECBRatesResponse> {
  try {
    const response = await fetch(ECB_DAILY_RATES_URL, {
      headers: { 'Accept': 'application/xml' },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`ECB API error: ${response.status}`);
    }

    const xml = await response.text();
    return parseECBXML(xml);

  } catch (error) {
    console.error('[ECB Rates] Failed to fetch rates:', error);
    throw error;
  }
}

/**
 * Fetch historical FX rates from ECB (last 90 days)
 */
export async function fetchECBHistoricalRates(date?: string): Promise<ECBRatesResponse> {
  try {
    const response = await fetch(ECB_HISTORICAL_URL, {
      headers: { 'Accept': 'application/xml' },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error(`ECB API error: ${response.status}`);
    }

    const xml = await response.text();
    
    if (date) {
      return parseECBXMLForDate(xml, date);
    }
    
    return parseECBXML(xml);

  } catch (error) {
    console.error('[ECB Rates] Failed to fetch historical rates:', error);
    throw error;
  }
}

// ============================================================================
// XML Parser
// ============================================================================

function parseECBXML(xml: string): ECBRatesResponse {
  const rates: Record<string, number> = {};
  let date = new Date().toISOString().split('T')[0];

  // Extract date
  const dateMatch = xml.match(/time='(\d{4}-\d{2}-\d{2})'/);
  if (dateMatch) {
    date = dateMatch[1];
  }

  // Extract rates
  const rateRegex = /<Cube currency='(\w{3})' rate='([\d.]+)'\/>/g;
  let match;
  while ((match = rateRegex.exec(xml)) !== null) {
    const currency = match[1];
    const rate = parseFloat(match[2]);
    rates[currency] = rate;
  }

  return {
    success: true,
    date,
    base: 'EUR',
    rates,
    source: 'ECB',
  };
}

function parseECBXMLForDate(xml: string, targetDate: string): ECBRatesResponse {
  const rates: Record<string, number> = {};

  // Find the specific date section
  const datePattern = new RegExp(`<Cube time='${targetDate}'>([\\s\\S]*?)</Cube>`, 'i');
  const dateMatch = xml.match(datePattern);

  if (!dateMatch) {
    // Return closest available date
    console.warn(`[ECB Rates] No rates for ${targetDate}, returning latest`);
    return parseECBXML(xml);
  }

  const dateSection = dateMatch[1];

  // Extract rates from the date section
  const rateRegex = /<Cube currency='(\w{3})' rate='([\d.]+)'\/>/g;
  let match;
  while ((match = rateRegex.exec(dateSection)) !== null) {
    const currency = match[1];
    const rate = parseFloat(match[2]);
    rates[currency] = rate;
  }

  return {
    success: true,
    date: targetDate,
    base: 'EUR',
    rates,
    source: 'ECB',
  };
}

// ============================================================================
// Rate Conversion Utilities
// ============================================================================

/**
 * Convert ECB rates (EUR base) to any base currency
 */
export function convertToBaseCurrency(
  ecbRates: Record<string, number>,
  baseCurrency: string
): Record<string, number> {
  const rates: Record<string, number> = {};

  if (baseCurrency === 'EUR') {
    return ecbRates;
  }

  const baseRate = ecbRates[baseCurrency];
  if (!baseRate) {
    throw new Error(`No ECB rate for ${baseCurrency}`);
  }

  // Convert each rate to the new base
  rates['EUR'] = 1 / baseRate;
  
  for (const [currency, rate] of Object.entries(ecbRates)) {
    if (currency !== baseCurrency) {
      rates[currency] = rate / baseRate;
    }
  }

  return rates;
}

/**
 * Get cross rate between two currencies
 */
export function getCrossRate(
  ecbRates: Record<string, number>,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  if (fromCurrency === 'EUR') {
    const rate = ecbRates[toCurrency];
    if (!rate) throw new Error(`No ECB rate for ${toCurrency}`);
    return rate;
  }

  if (toCurrency === 'EUR') {
    const rate = ecbRates[fromCurrency];
    if (!rate) throw new Error(`No ECB rate for ${fromCurrency}`);
    return 1 / rate;
  }

  // Cross rate via EUR
  const fromRate = ecbRates[fromCurrency];
  const toRate = ecbRates[toCurrency];

  if (!fromRate) throw new Error(`No ECB rate for ${fromCurrency}`);
  if (!toRate) throw new Error(`No ECB rate for ${toCurrency}`);

  return toRate / fromRate;
}

/**
 * Build FX rate lookup map for NAV calculation
 */
export function buildFXRateMap(
  ecbRates: Record<string, number>,
  fundCurrency: string
): Map<string, number> {
  const rateMap = new Map<string, number>();

  // Add identity rate
  rateMap.set(`${fundCurrency}/${fundCurrency}`, 1);

  // Get rates based on fund currency
  const basedRates = convertToBaseCurrency(ecbRates, fundCurrency);

  // Add all rates
  for (const [currency, rate] of Object.entries(basedRates)) {
    rateMap.set(`${currency}/${fundCurrency}`, rate);
    rateMap.set(`${fundCurrency}/${currency}`, 1 / rate);
  }

  // Add EUR if not fund currency
  if (fundCurrency !== 'EUR') {
    rateMap.set(`EUR/${fundCurrency}`, basedRates['EUR'] || 1);
    rateMap.set(`${fundCurrency}/EUR`, 1 / (basedRates['EUR'] || 1));
  }

  return rateMap;
}

/**
 * Convert FX rates to FXRate objects
 */
export function toFXRateObjects(
  ecbRates: ECBRatesResponse,
  baseCurrency: string = 'SEK'
): FXRate[] {
  const rates: FXRate[] = [];
  const basedRates = convertToBaseCurrency(ecbRates.rates, baseCurrency);

  for (const [currency, rate] of Object.entries(basedRates)) {
    rates.push({
      baseCurrency: currency,
      quoteCurrency: baseCurrency,
      rate,
      rateDate: ecbRates.date,
      source: 'ECB',
      timestamp: new Date().toISOString(),
    });
  }

  return rates;
}

// ============================================================================
// Caching Layer
// ============================================================================

interface CachedRates {
  rates: ECBRatesResponse;
  fetchedAt: number;
}

let ratesCache: CachedRates | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get FX rates with caching
 */
export async function getECBRates(forceRefresh: boolean = false): Promise<ECBRatesResponse> {
  const now = Date.now();

  if (!forceRefresh && ratesCache && (now - ratesCache.fetchedAt) < CACHE_TTL) {
    return ratesCache.rates;
  }

  const rates = await fetchECBRates();
  
  ratesCache = {
    rates,
    fetchedAt: now,
  };

  return rates;
}

/**
 * Get FX rate for a specific currency pair
 */
export async function getRate(
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<FXRate> {
  const ecbRates = date 
    ? await fetchECBHistoricalRates(date)
    : await getECBRates();

  const rate = getCrossRate(ecbRates.rates, fromCurrency, toCurrency);

  return {
    baseCurrency: fromCurrency,
    quoteCurrency: toCurrency,
    rate,
    rateDate: ecbRates.date,
    source: 'ECB',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get all rates for a base currency
 */
export async function getRatesForCurrency(
  baseCurrency: string,
  date?: string
): Promise<FXRate[]> {
  const ecbRates = date 
    ? await fetchECBHistoricalRates(date)
    : await getECBRates();

  return toFXRateObjects(ecbRates, baseCurrency);
}

// ============================================================================
// Common currencies for Swedish funds
// ============================================================================

export const COMMON_CURRENCIES = [
  'SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK', 'CHF', 'JPY', 'CAD', 'AUD'
];

/**
 * Get rates for common currencies used in Swedish funds
 */
export async function getCommonRates(
  baseCurrency: string = 'SEK',
  date?: string
): Promise<FXRate[]> {
  const allRates = await getRatesForCurrency(baseCurrency, date);
  return allRates.filter(r => COMMON_CURRENCIES.includes(r.baseCurrency));
}
