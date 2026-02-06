/**
 * Yahoo Finance Client (via unofficial API)
 * Used for market data, volume, and basic company info
 * Note: Uses public endpoints, no API key required
 * 
 * Includes caching layer to reduce API calls and improve reliability
 */

import { withCache, getCached, setCached } from './cache';

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const YAHOO_QUOTESUMMARY_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';

// Cache configuration
const CACHE_PREFIX = 'yahoo';
const QUOTE_CACHE_TTL = 24 * 60 * 60; // 24 hours for quote data
const SEARCH_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days for symbol lookups (rarely changes)

export interface YahooQuoteResult {
  success: boolean;
  data?: {
    symbol: string;
    shortName: string;
    longName?: string;
    currency: string;
    exchange: string;
    exchangeName: string;
    regularMarketPrice: number;
    regularMarketVolume: number;
    averageDailyVolume3Month: number;
    averageDailyVolume10Day: number;
    marketCap?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    sector?: string;
    industry?: string;
  };
  error?: string;
  source: 'yahoo_finance';
  sourceUrl: string;
}

export interface LiquidityAnalysis {
  success: boolean;
  data?: {
    averageDailyVolume: number;
    averageDailyValueSEK: number;
    meetsLiquidityPresumption: boolean; // > 400 MSEK daily
    estimatedLiquidationDays: number;
    liquidityCategory: '1_day' | '2_days' | '3_days' | 'more_than_3';
  };
  error?: string;
  source: 'yahoo_finance';
  sourceUrl: string;
}

export class YahooFinanceClient {
  /**
   * Get ticker symbol for ISIN
   * Yahoo uses different symbols, so we need to map
   */
  private mapISINToTicker(isin: string, mic?: string): string {
    // Extract country from ISIN
    const country = isin.substring(0, 2).toUpperCase();
    
    // Common suffix mappings
    const suffixes: Record<string, string> = {
      'SE': '.ST',  // Stockholm
      'NO': '.OL',  // Oslo
      'DK': '.CO',  // Copenhagen
      'FI': '.HE',  // Helsinki
      'DE': '.DE',  // Germany
      'GB': '.L',   // London
      'FR': '.PA',  // Paris
      'NL': '.AS',  // Amsterdam
      'CH': '.SW',  // Swiss
      'IT': '.MI',  // Milan
      'ES': '.MC',  // Madrid
    };

    return suffixes[country] || '';
  }

  /**
   * Search for a symbol by ISIN or name (with caching)
   */
  async searchSymbol(query: string): Promise<string | null> {
    const cacheKey = `search:${query.toUpperCase()}`;
    
    // Check cache first
    const cached = await getCached<string | null>(cacheKey, { prefix: CACHE_PREFIX });
    if (cached !== null) {
      console.log('[Yahoo] Cache hit for search:', query);
      return cached;
    }
    
    try {
      const response = await fetch(
        `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AIFM/1.0)',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      let symbol: string | null = null;
      if (data.quotes && data.quotes.length > 0) {
        // Prefer equity type
        const equity = data.quotes.find((q: any) => q.quoteType === 'EQUITY');
        symbol = equity?.symbol || data.quotes[0].symbol;
      }

      // Cache the result (even if null, to avoid repeated lookups)
      if (symbol) {
        await setCached(cacheKey, symbol, { prefix: CACHE_PREFIX, ttlSeconds: SEARCH_CACHE_TTL });
      }
      
      return symbol;
    } catch (error) {
      console.error('Yahoo search error:', error);
      return null;
    }
  }

  /**
   * Get quote data for a symbol (with caching)
   */
  async getQuote(symbol: string): Promise<YahooQuoteResult> {
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    
    // Check cache first
    const cached = await getCached<YahooQuoteResult>(cacheKey, { prefix: CACHE_PREFIX });
    if (cached !== null && cached.success) {
      console.log('[Yahoo] Cache hit for quote:', symbol);
      return cached;
    }
    
    try {
      // Try to get comprehensive data from quoteSummary
      const summaryUrl = `${YAHOO_QUOTESUMMARY_URL}/${symbol}?modules=price,summaryDetail,assetProfile`;
      
      const response = await fetch(summaryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIFM/1.0)',
        },
      });

      if (!response.ok) {
        // Fallback to chart API
        return this.getQuoteFromChartWithCache(symbol);
      }

      const data = await response.json();
      const result = data.quoteSummary?.result?.[0];

      if (!result) {
        return this.getQuoteFromChartWithCache(symbol);
      }

      const price = result.price || {};
      const summary = result.summaryDetail || {};
      const profile = result.assetProfile || {};

      const quoteResult: YahooQuoteResult = {
        success: true,
        data: {
          symbol: price.symbol || symbol,
          shortName: price.shortName || '',
          longName: price.longName || '',
          currency: price.currency || '',
          exchange: price.exchange || '',
          exchangeName: price.exchangeName || '',
          regularMarketPrice: price.regularMarketPrice?.raw || 0,
          regularMarketVolume: price.regularMarketVolume?.raw || 0,
          averageDailyVolume3Month: summary.averageDailyVolume3Month?.raw || summary.averageVolume?.raw || 0,
          averageDailyVolume10Day: summary.averageDailyVolume10Day?.raw || 0,
          marketCap: price.marketCap?.raw,
          fiftyTwoWeekHigh: summary.fiftyTwoWeekHigh?.raw,
          fiftyTwoWeekLow: summary.fiftyTwoWeekLow?.raw,
          sector: profile.sector,
          industry: profile.industry,
        },
        source: 'yahoo_finance',
        sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
      };

      // Cache successful result
      await setCached(cacheKey, quoteResult, { prefix: CACHE_PREFIX, ttlSeconds: QUOTE_CACHE_TTL });
      console.log('[Yahoo] Cached quote for:', symbol);
      
      return quoteResult;
    } catch (error) {
      console.error('Yahoo quote error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch quote',
        source: 'yahoo_finance',
        sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
      };
    }
  }

  /**
   * Fallback: Get quote from chart API (with caching)
   */
  private async getQuoteFromChartWithCache(symbol: string): Promise<YahooQuoteResult> {
    const cacheKey = `chart:${symbol.toUpperCase()}`;
    
    // Check cache first
    const cached = await getCached<YahooQuoteResult>(cacheKey, { prefix: CACHE_PREFIX });
    if (cached !== null && cached.success) {
      console.log('[Yahoo] Cache hit for chart:', symbol);
      return cached;
    }
    
    try {
      const response = await fetch(
        `${YAHOO_QUOTE_URL}/${symbol}?interval=1d&range=3mo`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AIFM/1.0)',
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: 'Kunde inte hämta marknadsdata från Yahoo Finance',
          source: 'yahoo_finance',
          sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
        };
      }

      const data = await response.json();
      const result = data.chart?.result?.[0];

      if (!result) {
        return {
          success: false,
          error: 'Ingen data hittades för denna ticker',
          source: 'yahoo_finance',
          sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
        };
      }

      const meta = result.meta;
      const volumes = result.indicators?.quote?.[0]?.volume || [];
      
      // Calculate average volume
      const validVolumes = volumes.filter((v: number | null) => v !== null && v > 0);
      const avgVolume = validVolumes.length > 0 
        ? validVolumes.reduce((a: number, b: number) => a + b, 0) / validVolumes.length 
        : 0;

      const quoteResult: YahooQuoteResult = {
        success: true,
        data: {
          symbol: meta.symbol,
          shortName: meta.shortName || '',
          currency: meta.currency || '',
          exchange: meta.exchange || '',
          exchangeName: meta.exchangeName || '',
          regularMarketPrice: meta.regularMarketPrice || 0,
          regularMarketVolume: meta.regularMarketVolume || 0,
          averageDailyVolume3Month: Math.round(avgVolume),
          averageDailyVolume10Day: Math.round(avgVolume),
        },
        source: 'yahoo_finance',
        sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
      };

      // Cache successful result
      await setCached(cacheKey, quoteResult, { prefix: CACHE_PREFIX, ttlSeconds: QUOTE_CACHE_TTL });
      console.log('[Yahoo] Cached chart data for:', symbol);
      
      return quoteResult;
    } catch (error) {
      return {
        success: false,
        error: 'Kunde inte hämta marknadsdata',
        source: 'yahoo_finance',
        sourceUrl: `https://finance.yahoo.com/quote/${symbol}`,
      };
    }
  }

  /**
   * Get quote by ISIN (searches first, then gets quote)
   */
  async getQuoteByISIN(isin: string, ticker?: string, mic?: string): Promise<YahooQuoteResult> {
    let symbol: string | null = null;

    // Try direct ticker with suffix first
    if (ticker) {
      const suffix = this.mapISINToTicker(isin, mic);
      const trySymbol = ticker.replace(/-/g, '') + suffix;
      
      const result = await this.getQuote(trySymbol);
      if (result.success) {
        return result;
      }

      // Try without suffix
      const result2 = await this.getQuote(ticker.replace(/-/g, ''));
      if (result2.success) {
        return result2;
      }
    }

    // Search by ISIN
    symbol = await this.searchSymbol(isin);
    
    if (symbol) {
      return this.getQuote(symbol);
    }

    return {
      success: false,
      error: 'Kunde inte hitta värdepappret på Yahoo Finance',
      source: 'yahoo_finance',
      sourceUrl: 'https://finance.yahoo.com/',
    };
  }

  /**
   * Analyze liquidity based on volume data
   */
  async analyzeLiquidity(
    symbol: string,
    positionValueSEK: number,
    currentPrice: number,
    currency: string
  ): Promise<LiquidityAnalysis> {
    const quote = await this.getQuote(symbol);

    if (!quote.success || !quote.data) {
      return {
        success: false,
        error: quote.error || 'Kunde inte hämta volymdata',
        source: 'yahoo_finance',
        sourceUrl: quote.sourceUrl,
      };
    }

    const avgVolume = quote.data.averageDailyVolume3Month || quote.data.averageDailyVolume10Day || 0;
    
    if (avgVolume === 0) {
      return {
        success: false,
        error: 'Ingen volymdata tillgänglig för likviditetsanalys',
        source: 'yahoo_finance',
        sourceUrl: quote.sourceUrl,
      };
    }

    // Calculate average daily value
    const price = quote.data.regularMarketPrice || currentPrice;
    let avgDailyValue = avgVolume * price;

    // Convert to SEK if needed (approximate rates)
    const toSEK: Record<string, number> = {
      'USD': 10.5,
      'EUR': 11.5,
      'GBP': 13.5,
      'NOK': 1.0,
      'DKK': 1.55,
      'CHF': 12.0,
      'SEK': 1.0,
    };

    const rate = toSEK[currency] || toSEK[quote.data.currency] || 1;
    const avgDailyValueSEK = avgDailyValue * rate;

    // Liquidity presumption: > 400 MSEK daily volume
    const meetsPresumption = avgDailyValueSEK > 400_000_000;

    // Estimate liquidation days based on position size
    // Assuming max 25% of daily volume
    const maxDailyLiquidation = avgDailyValueSEK * 0.25;
    const estimatedDays = maxDailyLiquidation > 0 ? positionValueSEK / maxDailyLiquidation : 999;

    let liquidityCategory: '1_day' | '2_days' | '3_days' | 'more_than_3';
    if (estimatedDays <= 1) liquidityCategory = '1_day';
    else if (estimatedDays <= 2) liquidityCategory = '2_days';
    else if (estimatedDays <= 3) liquidityCategory = '3_days';
    else liquidityCategory = 'more_than_3';

    return {
      success: true,
      data: {
        averageDailyVolume: avgVolume,
        averageDailyValueSEK: Math.round(avgDailyValueSEK),
        meetsLiquidityPresumption: meetsPresumption,
        estimatedLiquidationDays: Math.ceil(estimatedDays),
        liquidityCategory,
      },
      source: 'yahoo_finance',
      sourceUrl: quote.sourceUrl,
    };
  }
}

// Singleton
let yahooClient: YahooFinanceClient | null = null;

export function getYahooFinanceClient(): YahooFinanceClient {
  if (!yahooClient) {
    yahooClient = new YahooFinanceClient();
  }
  return yahooClient;
}
