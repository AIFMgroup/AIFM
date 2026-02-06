/**
 * Market Data & News Client
 * 
 * Provides:
 * - Financial news from multiple sources
 * - Market data (gold, silver, commodities)
 * - Regulatory updates from FI
 */

// ============================================================================
// Types
// ============================================================================

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: 'market' | 'regulatory' | 'company' | 'general';
  relevanceScore?: number;
  imageUrl?: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  timestamp: string;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
}

export interface RegulatoryUpdate {
  id: string;
  title: string;
  summary: string;
  source: 'fi' | 'esma' | 'eu' | 'riksdagen';
  category: string;
  publishedAt: string;
  url: string;
  effectiveDate?: string;
}

// ============================================================================
// Market Data Client
// ============================================================================

export class MarketDataClient {
  private newsApiKey?: string;
  private alphaVantageKey?: string;

  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY;
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY;
  }

  // ==========================================================================
  // News Methods
  // ==========================================================================

  /**
   * Get financial news
   */
  async getFinancialNews(
    query?: string,
    limit: number = 10
  ): Promise<NewsArticle[]> {
    // If NewsAPI is configured, use it
    if (this.newsApiKey) {
      try {
        const searchQuery = query || 'gold silver commodities investment funds sweden';
        const response = await fetch(
          `https://newsapi.org/v2/everything?q=${encodeURIComponent(searchQuery)}&language=en&sortBy=publishedAt&pageSize=${limit}&apiKey=${this.newsApiKey}`
        );
        
        if (response.ok) {
          const data = await response.json();
          return data.articles.map((a: any, index: number) => ({
            id: `news-${index}-${Date.now()}`,
            title: a.title,
            summary: a.description || a.content?.substring(0, 200),
            source: a.source.name,
            url: a.url,
            publishedAt: a.publishedAt,
            category: 'market' as const,
            imageUrl: a.urlToImage,
          }));
        }
      } catch (error) {
        console.error('NewsAPI error:', error);
      }
    }

    // Fallback: Return curated financial news sources
    return this.getCuratedNews(query, limit);
  }

  /**
   * Get curated financial news (fallback when no API key)
   */
  private async getCuratedNews(query?: string, limit: number = 10): Promise<NewsArticle[]> {
    const today = new Date().toISOString();
    
    // Mock curated news - in production, scrape from financial sites
    const curatedNews: NewsArticle[] = [
      {
        id: 'fi-1',
        title: 'Finansinspektionens senaste tillsynsrapport',
        summary: 'FI har publicerat sin kvartalsvisa tillsynsrapport med fokus på fondmarknaden.',
        source: 'Finansinspektionen',
        url: 'https://www.fi.se/sv/publicerat/nyheter/',
        publishedAt: today,
        category: 'regulatory',
      },
      {
        id: 'gold-1',
        title: 'Guldpriset stiger på global osäkerhet',
        summary: 'Guldpriset har ökat med 2% under veckan drivet av geopolitisk osäkerhet.',
        source: 'Reuters',
        url: 'https://www.reuters.com/markets/commodities/',
        publishedAt: today,
        category: 'market',
      },
      {
        id: 'silver-1',
        title: 'Silvermarknaden visar stark tillväxt',
        summary: 'Industriell efterfrågan driver silverpriset till nya höjder.',
        source: 'Bloomberg',
        url: 'https://www.bloomberg.com/commodities',
        publishedAt: today,
        category: 'market',
      },
    ];

    return curatedNews.slice(0, limit);
  }

  /**
   * Get regulatory news from FI
   */
  async getRegulatoryNews(): Promise<RegulatoryUpdate[]> {
    // In production, scrape FI website or use their RSS feed
    const today = new Date().toISOString();
    
    return [
      {
        id: 'fi-reg-1',
        title: 'Uppdaterade regler för AIF-förvaltare',
        summary: 'Finansinspektionen har uppdaterat FFFS 2013:10 med nya krav på likviditetshantering.',
        source: 'fi',
        category: 'FFFS',
        publishedAt: today,
        url: 'https://www.fi.se/sv/vara-register/sok-fffs/',
        effectiveDate: today,
      },
      {
        id: 'esma-1',
        title: 'ESMA publicerar Q&A om AIFMD',
        summary: 'Nya tolkningar av delegerat regelverk för alternativa investeringsfonder.',
        source: 'esma',
        category: 'Q&A',
        publishedAt: today,
        url: 'https://www.esma.europa.eu/publications-data/interactive-single-rulebook',
      },
    ];
  }

  // ==========================================================================
  // Market Data Methods
  // ==========================================================================

  /**
   * Get commodity prices (gold, silver, etc.)
   */
  async getCommodityPrices(): Promise<MarketQuote[]> {
    // If Alpha Vantage is configured, use it
    if (this.alphaVantageKey) {
      try {
        const symbols = ['XAUUSD', 'XAGUSD']; // Gold and Silver
        const quotes: MarketQuote[] = [];

        for (const symbol of symbols) {
          const response = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.alphaVantageKey}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const quote = data['Global Quote'];
            if (quote) {
              quotes.push({
                symbol: symbol,
                name: symbol === 'XAUUSD' ? 'Guld (XAU/USD)' : 'Silver (XAG/USD)',
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent']?.replace('%', '')),
                currency: 'USD',
                timestamp: new Date().toISOString(),
                high: parseFloat(quote['03. high']),
                low: parseFloat(quote['04. low']),
                open: parseFloat(quote['02. open']),
                previousClose: parseFloat(quote['08. previous close']),
              });
            }
          }
        }

        if (quotes.length > 0) return quotes;
      } catch (error) {
        console.error('Alpha Vantage error:', error);
      }
    }

    // Fallback: Return approximate market data
    return this.getMockMarketData();
  }

  /**
   * Get mock market data (fallback)
   */
  private getMockMarketData(): MarketQuote[] {
    const timestamp = new Date().toISOString();
    
    return [
      {
        symbol: 'XAU',
        name: 'Guld (XAU/USD)',
        price: 2035.50,
        change: 12.30,
        changePercent: 0.61,
        currency: 'USD',
        timestamp,
        high: 2040.00,
        low: 2020.00,
        open: 2023.20,
        previousClose: 2023.20,
      },
      {
        symbol: 'XAG',
        name: 'Silver (XAG/USD)',
        price: 23.45,
        change: 0.32,
        changePercent: 1.38,
        currency: 'USD',
        timestamp,
        high: 23.60,
        low: 23.10,
        open: 23.13,
        previousClose: 23.13,
      },
      {
        symbol: 'OMXS30',
        name: 'OMX Stockholm 30',
        price: 2456.78,
        change: 15.34,
        changePercent: 0.63,
        currency: 'SEK',
        timestamp,
      },
      {
        symbol: 'USDSEK',
        name: 'USD/SEK',
        price: 10.45,
        change: -0.05,
        changePercent: -0.48,
        currency: 'SEK',
        timestamp,
      },
      {
        symbol: 'EURSEK',
        name: 'EUR/SEK',
        price: 11.32,
        change: 0.02,
        changePercent: 0.18,
        currency: 'SEK',
        timestamp,
      },
    ];
  }

  /**
   * Get fund-related market data
   */
  async getFundMarketData(fundId: string): Promise<{
    nav: MarketQuote;
    benchmark?: MarketQuote;
    relatedAssets: MarketQuote[];
  }> {
    const commodityPrices = await this.getCommodityPrices();
    
    // In production, fetch from fund registry
    return {
      nav: {
        symbol: fundId,
        name: 'AuAg Silver Bullet A',
        price: 142.56,
        change: 1.23,
        changePercent: 0.87,
        currency: 'SEK',
        timestamp: new Date().toISOString(),
      },
      relatedAssets: commodityPrices.filter(p => ['XAU', 'XAG'].includes(p.symbol)),
    };
  }

  // ==========================================================================
  // Summary Methods for AI
  // ==========================================================================

  /**
   * Get market summary for AI context
   */
  async getMarketSummary(): Promise<string> {
    const [prices, news] = await Promise.all([
      this.getCommodityPrices(),
      this.getFinancialNews(undefined, 5),
    ]);

    let summary = '## Marknadsöversikt\n\n';
    
    summary += '### Priser\n';
    for (const quote of prices) {
      const direction = quote.change >= 0 ? '📈' : '📉';
      summary += `- ${quote.name}: ${quote.price.toFixed(2)} ${quote.currency} (${direction} ${quote.changePercent.toFixed(2)}%)\n`;
    }

    summary += '\n### Senaste nyheterna\n';
    for (const article of news) {
      summary += `- **${article.title}** (${article.source})\n  ${article.summary}\n`;
    }

    return summary;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let marketDataClientInstance: MarketDataClient | null = null;

export function getMarketDataClient(): MarketDataClient {
  if (!marketDataClientInstance) {
    marketDataClientInstance = new MarketDataClient();
  }
  return marketDataClientInstance;
}
