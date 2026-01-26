/**
 * Currency Service
 * 
 * Hanterar valutakonvertering, växelkurser och valutadifferenser.
 * Använder Riksbankens API för aktuella växelkurser.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Riksbankens API endpoint
const RIKSBANK_API = 'https://api.riksbank.se/swea/v1/CrossRates';

// Bokföringskonton för valuta
export const CURRENCY_ACCOUNTS = {
  EXCHANGE_GAIN: { account: '3960', name: 'Valutakursvinster på fordringar och skulder' },
  EXCHANGE_LOSS: { account: '7960', name: 'Valutakursförluster på fordringar och skulder' },
  ROUNDING: { account: '3740', name: 'Öresutjämning' },
} as const;

// Vanliga valutor
export const SUPPORTED_CURRENCIES = [
  'SEK', 'EUR', 'USD', 'GBP', 'NOK', 'DKK', 'CHF', 'PLN', 'JPY', 'CAD', 'AUD'
] as const;

export type Currency = typeof SUPPORTED_CURRENCIES[number];

export interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;
  date: string;
  source: 'riksbank' | 'ecb' | 'cached' | 'fallback';
}

export interface CurrencyConversion {
  originalAmount: number;
  originalCurrency: Currency;
  convertedAmount: number;
  targetCurrency: Currency;
  exchangeRate: number;
  rateDate: string;
  rateSource: string;
}

export interface ExchangeDifference {
  bookingRate: number;
  paymentRate: number;
  originalAmount: number;
  difference: number;
  isGain: boolean;
  account: { account: string; name: string };
}

// Fallback-kurser (uppdateras manuellt som backup)
const FALLBACK_RATES: Record<Currency, number> = {
  SEK: 1,
  EUR: 11.45,
  USD: 10.52,
  GBP: 13.35,
  NOK: 0.97,
  DKK: 1.54,
  CHF: 12.05,
  PLN: 2.48,
  JPY: 0.070,
  CAD: 7.75,
  AUD: 6.85,
};

/**
 * Hämta aktuell växelkurs från Riksbanken
 */
export async function getExchangeRate(
  from: Currency,
  to: Currency = 'SEK',
  date?: string
): Promise<ExchangeRate> {
  // Om båda är SEK, returnera 1
  if (from === 'SEK' && to === 'SEK') {
    return { from, to, rate: 1, date: new Date().toISOString().split('T')[0], source: 'riksbank' };
  }

  const requestedDate = date || new Date().toISOString().split('T')[0];

  // Helper: iterate backwards to find nearest available banking day (max 7 days)
  const candidateDates = getCandidateDates(requestedDate, 7);

  // 1. Cache-first across candidates
  for (const d of candidateDates) {
    const cached = await getCachedRate(from, to, d);
    if (cached) return cached;
  }

  // 2. Riksbank (prefer) across candidates
  for (const d of candidateDates) {
    try {
      const rate = await fetchRiksbankRate(from, to, d);
      if (rate) {
        await cacheRate(rate);
        return rate;
      }
    } catch (error) {
      console.warn('[CurrencyService] Riksbank API error:', error);
    }
  }

  // 3. ECB (backup) using the requested date (historical if supported) else candidate fallback
  for (const d of candidateDates) {
    try {
      const rate = await fetchECBRate(from, to, d);
      if (rate) {
        await cacheRate(rate);
        return rate;
      }
    } catch (error) {
      console.warn('[CurrencyService] ECB API error:', error);
    }
  }

  // 4. Fallback till hårdkodade kurser
  console.warn(`[CurrencyService] Using fallback rate for ${from}/${to}`);
  
  const fromRate = FALLBACK_RATES[from] || 1;
  const toRate = FALLBACK_RATES[to] || 1;
  const rate = toRate / fromRate;

  return {
    from,
    to,
    rate,
    date: requestedDate,
    source: 'fallback',
  };
}

/**
 * Konvertera belopp mellan valutor
 */
export async function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency = 'SEK',
  date?: string
): Promise<CurrencyConversion> {
  const exchangeRate = await getExchangeRate(from, to, date);
  const convertedAmount = Math.round(amount * exchangeRate.rate * 100) / 100;

  return {
    originalAmount: amount,
    originalCurrency: from,
    convertedAmount,
    targetCurrency: to,
    exchangeRate: exchangeRate.rate,
    rateDate: exchangeRate.date,
    rateSource: exchangeRate.source,
  };
}

/**
 * Beräkna valutadifferens mellan bokföring och betalning
 */
export async function calculateExchangeDifference(
  originalAmount: number,
  currency: Currency,
  bookingDate: string,
  paymentDate: string
): Promise<ExchangeDifference> {
  // Hämta kurser för båda datumen
  const bookingRateData = await getExchangeRate(currency, 'SEK', bookingDate);
  const paymentRateData = await getExchangeRate(currency, 'SEK', paymentDate);

  const bookedSEK = originalAmount * bookingRateData.rate;
  const paidSEK = originalAmount * paymentRateData.rate;
  const difference = Math.round((paidSEK - bookedSEK) * 100) / 100;
  const isGain = difference < 0; // Negativ differens = vi betalade mindre = vinst

  return {
    bookingRate: bookingRateData.rate,
    paymentRate: paymentRateData.rate,
    originalAmount,
    difference: Math.abs(difference),
    isGain,
    account: isGain ? CURRENCY_ACCOUNTS.EXCHANGE_GAIN : CURRENCY_ACCOUNTS.EXCHANGE_LOSS,
  };
}

/**
 * Generera bokföringsrader för valutadifferens
 */
export function generateExchangeDifferenceVoucher(
  diff: ExchangeDifference,
  supplierAccount: string = '2440'
): {
  debitAccount: string;
  debitAccountName: string;
  debitAmount: number;
  creditAccount: string;
  creditAccountName: string;
  creditAmount: number;
  description: string;
} {
  if (diff.isGain) {
    // Valutakursvinst: Debet leverantörsskuld, Kredit 3960
    return {
      debitAccount: supplierAccount,
      debitAccountName: 'Leverantörsskulder',
      debitAmount: diff.difference,
      creditAccount: CURRENCY_ACCOUNTS.EXCHANGE_GAIN.account,
      creditAccountName: CURRENCY_ACCOUNTS.EXCHANGE_GAIN.name,
      creditAmount: diff.difference,
      description: `Valutakursvinst (kurs ${diff.bookingRate.toFixed(4)} → ${diff.paymentRate.toFixed(4)})`,
    };
  } else {
    // Valutakursförlust: Debet 7960, Kredit leverantörsskuld
    return {
      debitAccount: CURRENCY_ACCOUNTS.EXCHANGE_LOSS.account,
      debitAccountName: CURRENCY_ACCOUNTS.EXCHANGE_LOSS.name,
      debitAmount: diff.difference,
      creditAccount: supplierAccount,
      creditAccountName: 'Leverantörsskulder',
      creditAmount: diff.difference,
      description: `Valutakursförlust (kurs ${diff.bookingRate.toFixed(4)} → ${diff.paymentRate.toFixed(4)})`,
    };
  }
}

/**
 * Hämta historiska kurser för en period
 */
export async function getHistoricalRates(
  currency: Currency,
  startDate: string,
  endDate: string
): Promise<ExchangeRate[]> {
  const rates: ExchangeRate[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Hämta en kurs per dag
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    try {
      const rate = await getExchangeRate(currency, 'SEK', dateStr);
      rates.push(rate);
    } catch (error) {
      console.warn(`[CurrencyService] Could not get rate for ${dateStr}`);
    }
  }

  return rates;
}

/**
 * Validera valutakod
 */
export function isValidCurrency(code: string): code is Currency {
  return SUPPORTED_CURRENCIES.includes(code as Currency);
}

/**
 * Detektera valuta från text
 */
export function detectCurrency(text: string): Currency | null {
  const normalized = text.toUpperCase();

  // Direkt valutakod
  for (const currency of SUPPORTED_CURRENCIES) {
    if (normalized.includes(currency)) {
      return currency;
    }
  }

  // Vanliga valutasymboler
  const symbolMap: Record<string, Currency> = {
    '€': 'EUR',
    '$': 'USD',
    '£': 'GBP',
    '¥': 'JPY',
    'KR': 'SEK', // Kan också vara NOK/DKK
  };

  for (const [symbol, currency] of Object.entries(symbolMap)) {
    if (normalized.includes(symbol)) {
      return currency;
    }
  }

  return null;
}

// ============ Interna hjälpfunktioner ============

async function fetchRiksbankRate(
  from: Currency,
  to: Currency,
  date: string
): Promise<ExchangeRate | null> {
  try {
    // Riksbanken API format: SEK{CURRENCY}PMI
    const seriesId = from === 'SEK' 
      ? `SEK${to}PMI` 
      : `SEK${from}PMI`;

    const response = await fetch(
      `${RIKSBANK_API}/${seriesId}/${date}`,
      { 
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5s timeout
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data && data.value) {
      const rate = from === 'SEK' ? 1 / data.value : data.value;
      return {
        from,
        to,
        rate,
        date,
        source: 'riksbank',
      };
    }

    return null;

  } catch (error) {
    console.error('[CurrencyService] Riksbank fetch error:', error);
    return null;
  }
}

async function fetchECBRate(
  from: Currency,
  to: Currency,
  date?: string
): Promise<ExchangeRate | null> {
  try {
    // ECB (Frankfurter) supports historical dates: /YYYY-MM-DD?from=EUR
    const endpointDate = date || 'latest';
    const response = await fetch(
      `https://api.frankfurter.app/${endpointDate}?from=EUR`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const rates = data.rates;

    if (!rates) return null;

    // Beräkna korsvaluta via EUR
    const fromRate = from === 'EUR' ? 1 : rates[from];
    const toRate = to === 'EUR' ? 1 : rates[to];

    if (!fromRate || !toRate) return null;

    const crossRate = toRate / fromRate;

    return {
      from,
      to,
      rate: crossRate,
      date: data.date,
      source: 'ecb',
    };

  } catch (error) {
    console.error('[CurrencyService] ECB fetch error:', error);
    return null;
  }
}

async function getCachedRate(
  from: Currency,
  to: Currency,
  date: string
): Promise<ExchangeRate | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: 'EXCHANGE_RATE',
        sk: `${from}${to}#${date}`,
      },
    }));

    if (result.Item) {
      return {
        from,
        to,
        rate: result.Item.rate,
        date,
        source: 'cached',
      };
    }

    return null;

  } catch (error) {
    console.error('[CurrencyService] Cache read error:', error);
    return null;
  }
}

async function cacheRate(rate: ExchangeRate): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: 'EXCHANGE_RATE',
        sk: `${rate.from}${rate.to}#${rate.date}`,
        rate: rate.rate,
        source: rate.source,
        cachedAt: new Date().toISOString(),
        // TTL - behåll i 7 år (audit/replay)
        ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60),
      },
    }));
  } catch (error) {
    console.error('[CurrencyService] Cache write error:', error);
  }
}

function getCandidateDates(startDate: string, maxBackDays: number): string[] {
  const out: string[] = [];
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return [new Date().toISOString().split('T')[0]];
  for (let i = 0; i <= maxBackDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().split('T')[0]);
  }
  return out;
}

/**
 * Formatera belopp med valutasymbol
 */
export function formatCurrency(
  amount: number,
  currency: Currency = 'SEK'
): string {
  const formatter = new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
}

/**
 * Avrunda till närmaste öre
 */
export function roundToOre(amount: number): number {
  return Math.round(amount * 100) / 100;
}


