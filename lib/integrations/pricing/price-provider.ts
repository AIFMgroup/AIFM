/**
 * Price Data Provider System
 *
 * Pluggbar arkitektur för prisdata:
 * - Mock: Testdata för utveckling
 * - CSV: Manuell uppladdning av CSV-filer
 * - Manual: Direkt inmatning i UI
 * - FundRegistry: Hämta från internt fondregister
 * - LSEG: Hämta från LSEG/Refinitiv API (kräver licens)
 */

import { getFundRegistry } from '@/lib/fund-registry';
import {
  getLSEGAccessToken,
  getLSEGBaseUrl,
  isLSEGConfigured,
} from '@/lib/integrations/lseg/lseg-auth';

// ============================================================================
// Types
// ============================================================================

export interface PriceDataRecord {
  fundId: string;
  fundName: string;
  isin: string;
  date: string;
  nav: number;
  navChange?: number;        // Förändring i %
  previousNav?: number;
  aum: number;
  outstandingShares: number;
  currency: string;
  source: PriceDataSource;
  lastUpdated: string;
}

export interface InstrumentPrice {
  isin: string;
  ric?: string;              // Reuters Instrument Code
  name: string;
  price: number;
  currency: string;
  priceDate: string;
  source: PriceDataSource;
  bid?: number;
  ask?: number;
  volume?: number;
  lastUpdated: string;
}

export type PriceDataSource = 'mock' | 'csv' | 'manual' | 'fund_registry' | 'lseg';

export interface PriceDataProvider {
  readonly source: PriceDataSource;
  
  // Fund-nivå prisdata (för NAV-rapportering)
  getPriceData(fundId: string, date?: string): Promise<PriceDataRecord>;
  getAllPriceData(date?: string): Promise<PriceDataRecord[]>;
  
  // Instrument-nivå priser (för positionsvärdering)
  getInstrumentPrice?(isin: string, date?: string): Promise<InstrumentPrice>;
  getInstrumentPrices?(isins: string[], date?: string): Promise<InstrumentPrice[]>;
  
  // Provider-specifik konfiguration
  isConfigured(): boolean;
  getStatus(): Promise<ProviderStatus>;
}

export interface ProviderStatus {
  available: boolean;
  lastCheck: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface CSVPriceRow {
  isin: string;
  fundName?: string;
  date: string;
  nav: number;
  aum?: number;
  outstandingShares?: number;
  currency?: string;
}

// ============================================================================
// Mock Provider (för utveckling/test)
// ============================================================================

class MockPriceDataProvider implements PriceDataProvider {
  readonly source: PriceDataSource = 'mock';
  
  private readonly funds: Omit<PriceDataRecord, 'date' | 'source' | 'lastUpdated'>[] = [
    {
      fundId: 'SE0019175563',
      fundName: 'AUAG Essential Metals A',
      isin: 'SE0019175563',
      currency: 'SEK',
      nav: 142.42,
      navChange: 1.23,
      previousNav: 140.69,
      aum: 395584099.11,
      outstandingShares: 2456766.31,
    },
    {
      fundId: 'SE0019175571',
      fundName: 'AUAG Essential Metals B',
      isin: 'SE0019175571',
      currency: 'EUR',
      nav: 14.65,
      navChange: 1.18,
      previousNav: 14.48,
      aum: 43120778.87,
      outstandingShares: 269451.12,
    },
    {
      fundId: 'SE0020677946',
      fundName: 'AuAg Gold Rush A',
      isin: 'SE0020677946',
      currency: 'SEK',
      nav: 208.71,
      navChange: 2.45,
      previousNav: 203.72,
      aum: 505494096.59,
      outstandingShares: 2422025.74,
    },
    {
      fundId: 'SE0014808440',
      fundName: 'AuAg Precious Green A',
      isin: 'SE0014808440',
      currency: 'SEK',
      nav: 198.87,
      navChange: 0.87,
      previousNav: 197.15,
      aum: 328924859.33,
      outstandingShares: 1653996.37,
    },
    {
      fundId: 'SE0013358181',
      fundName: 'AuAg Silver Bullet A',
      isin: 'SE0013358181',
      currency: 'SEK',
      nav: 378.33,
      navChange: 3.12,
      previousNav: 366.87,
      aum: 3400248947.80,
      outstandingShares: 8987586.35,
    },
    {
      fundId: 'SE0013358199',
      fundName: 'AuAg Silver Bullet B',
      isin: 'SE0013358199',
      currency: 'EUR',
      nav: 37.23,
      navChange: 3.05,
      previousNav: 36.13,
      aum: 921562837.38,
      outstandingShares: 2265711.61,
    },
  ];

  async getPriceData(fundId: string, date?: string): Promise<PriceDataRecord> {
    const record = this.funds.find((f) => f.fundId === fundId || f.isin === fundId);
    if (!record) {
      throw new Error(`Mock price data not found for fund ${fundId}`);
    }
    return {
      ...record,
      date: date || new Date().toISOString().split('T')[0],
      source: this.source,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getAllPriceData(date?: string): Promise<PriceDataRecord[]> {
    const effectiveDate = date || new Date().toISOString().split('T')[0];
    return this.funds.map((f) => ({
      ...f,
      date: effectiveDate,
      source: this.source as PriceDataSource,
      lastUpdated: new Date().toISOString(),
    }));
  }

  isConfigured(): boolean {
    return true;
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      available: true,
      lastCheck: new Date().toISOString(),
      message: 'Mock provider active - using test data',
    };
  }
}

// ============================================================================
// CSV Provider (manuell CSV-uppladdning)
// ============================================================================

class CSVPriceDataProvider implements PriceDataProvider {
  readonly source: PriceDataSource = 'csv';
  private priceData: Map<string, PriceDataRecord> = new Map();
  private lastImport: string | null = null;

  async getPriceData(fundId: string, date?: string): Promise<PriceDataRecord> {
    const key = `${fundId}-${date || 'latest'}`;
    const record = this.priceData.get(key) || this.priceData.get(`${fundId}-latest`);
    
    if (!record) {
      throw new Error(`No CSV price data found for fund ${fundId}. Upload a CSV file first.`);
    }
    return record;
  }

  async getAllPriceData(date?: string): Promise<PriceDataRecord[]> {
    const targetDate = date || 'latest';
    const records: PriceDataRecord[] = [];
    
    this.priceData.forEach((record, key) => {
      if (key.endsWith(targetDate) || key.endsWith('-latest')) {
        records.push(record);
      }
    });
    
    if (records.length === 0) {
      throw new Error('No CSV price data available. Upload a CSV file first.');
    }
    
    return records;
  }

  /**
   * Importera prisdata från parsad CSV
   */
  importFromCSV(rows: CSVPriceRow[]): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    for (const row of rows) {
      try {
        if (!row.isin || !row.nav) {
          errors.push(`Row missing required fields (isin, nav): ${JSON.stringify(row)}`);
          continue;
        }

        const record: PriceDataRecord = {
          fundId: row.isin,
          fundName: row.fundName || `Fund ${row.isin}`,
          isin: row.isin,
          date: row.date || new Date().toISOString().split('T')[0],
          nav: row.nav,
          aum: row.aum || 0,
          outstandingShares: row.outstandingShares || 0,
          currency: row.currency || 'SEK',
          source: 'csv',
          lastUpdated: new Date().toISOString(),
        };

        // Spara med datum-nyckel och "latest"
        this.priceData.set(`${row.isin}-${record.date}`, record);
        this.priceData.set(`${row.isin}-latest`, record);
        imported++;
      } catch (error) {
        errors.push(`Error processing row: ${error}`);
      }
    }

    this.lastImport = new Date().toISOString();
    return { imported, errors };
  }

  /**
   * Rensa all importerad data
   */
  clearData(): void {
    this.priceData.clear();
    this.lastImport = null;
  }

  /**
   * Hämta alla nycklar
   */
  getKeys(): string[] {
    return Array.from(this.priceData.keys());
  }

  isConfigured(): boolean {
    return this.priceData.size > 0;
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      available: this.priceData.size > 0,
      lastCheck: new Date().toISOString(),
      message: this.lastImport 
        ? `CSV data loaded: ${this.priceData.size} records (imported ${this.lastImport})`
        : 'No CSV data loaded. Upload a CSV file to use this provider.',
      details: {
        recordCount: this.priceData.size,
        lastImport: this.lastImport,
      },
    };
  }
}

// ============================================================================
// Manual Provider (direkt inmatning i UI)
// ============================================================================

class ManualPriceDataProvider implements PriceDataProvider {
  readonly source: PriceDataSource = 'manual';
  private priceData: Map<string, PriceDataRecord> = new Map();

  async getPriceData(fundId: string, date?: string): Promise<PriceDataRecord> {
    const key = `${fundId}-${date || 'latest'}`;
    const record = this.priceData.get(key) || this.priceData.get(`${fundId}-latest`);
    
    if (!record) {
      throw new Error(`No manual price data found for fund ${fundId}`);
    }
    return record;
  }

  async getAllPriceData(date?: string): Promise<PriceDataRecord[]> {
    const targetDate = date || 'latest';
    const records: PriceDataRecord[] = [];
    
    this.priceData.forEach((record, key) => {
      if (key.endsWith(targetDate) || key.endsWith('-latest')) {
        records.push(record);
      }
    });
    
    return records;
  }

  /**
   * Sätt pris manuellt för en fond
   */
  setPrice(data: {
    fundId: string;
    fundName: string;
    isin: string;
    date: string;
    nav: number;
    aum?: number;
    outstandingShares?: number;
    currency?: string;
  }): void {
    const record: PriceDataRecord = {
      fundId: data.fundId,
      fundName: data.fundName,
      isin: data.isin,
      date: data.date,
      nav: data.nav,
      aum: data.aum || 0,
      outstandingShares: data.outstandingShares || 0,
      currency: data.currency || 'SEK',
      source: 'manual',
      lastUpdated: new Date().toISOString(),
    };

    this.priceData.set(`${data.fundId}-${data.date}`, record);
    this.priceData.set(`${data.fundId}-latest`, record);
  }

  /**
   * Ta bort pris för en fond
   */
  removePrice(fundId: string, date?: string): void {
    if (date) {
      this.priceData.delete(`${fundId}-${date}`);
    } else {
      // Ta bort alla för denna fond
      const keysToDelete = Array.from(this.priceData.keys()).filter(key => key.startsWith(fundId));
      keysToDelete.forEach(key => this.priceData.delete(key));
    }
  }

  isConfigured(): boolean {
    return this.priceData.size > 0;
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      available: true,
      lastCheck: new Date().toISOString(),
      message: `Manual provider: ${this.priceData.size} prices entered`,
      details: {
        recordCount: this.priceData.size,
      },
    };
  }
}

// ============================================================================
// Fund Registry Provider (internt fondregister)
// ============================================================================

class FundRegistryPriceDataProvider implements PriceDataProvider {
  readonly source: PriceDataSource = 'fund_registry';

  async getPriceData(fundId: string, date?: string): Promise<PriceDataRecord> {
    const registry = getFundRegistry();
    const priceData = await registry.getPriceData(date);
    
    const record = priceData.find(p => p.fundId === fundId || p.isin === fundId);
    if (!record) {
      throw new Error(`No price data found in fund registry for ${fundId}`);
    }

    return {
      fundId: record.fundId,
      fundName: record.fundName,
      isin: record.isin,
      date: record.date,
      nav: record.nav,
      navChange: record.navChange,
      aum: record.aum,
      outstandingShares: record.outstandingShares,
      currency: record.currency,
      source: 'fund_registry',
      lastUpdated: record.lastUpdated,
    };
  }

  async getAllPriceData(date?: string): Promise<PriceDataRecord[]> {
    const registry = getFundRegistry();
    const priceData = await registry.getPriceData(date);
    
    return priceData.map(p => ({
      fundId: p.fundId,
      fundName: p.fundName,
      isin: p.isin,
      date: p.date,
      nav: p.nav,
      navChange: p.navChange,
      aum: p.aum,
      outstandingShares: p.outstandingShares,
      currency: p.currency,
      source: 'fund_registry' as PriceDataSource,
      lastUpdated: p.lastUpdated,
    }));
  }

  isConfigured(): boolean {
    return true; // Always configured as it uses internal system
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const registry = getFundRegistry();
      const funds = await registry.listFunds();
      
      return {
        available: true,
        lastCheck: new Date().toISOString(),
        message: `Fund Registry active: ${funds.length} funds registered`,
        details: {
          fundCount: funds.length,
        },
      };
    } catch (error) {
      return {
        available: false,
        lastCheck: new Date().toISOString(),
        message: `Fund Registry error: ${error}`,
      };
    }
  }
}

// ============================================================================
// LSEG Provider (LSEG/Refinitiv Data Platform - priser, referensdata)
// ============================================================================

/** LSEG pricing/quote response shape (flexible for different API versions) */
interface LSEGQuoteResponse {
  data?: Array<{
    Instrument?: string;
    ISIN?: string;
    TradePrice?: number;
    LastPrice?: number;
    ClosePrice?: number;
    Last?: number;
    Close?: number;
    Currency?: string;
    PriceDate?: string;
    TradeDate?: string;
    DisplayName?: string;
    RIC?: string;
  }>;
  TradePrice?: number;
  LastPrice?: number;
  ClosePrice?: number;
  Currency?: string;
  PriceDate?: string;
  DisplayName?: string;
}

/** LSEG reference data response (sector, industry, country, market cap) */
interface LSEGRefDataResponse {
  data?: Array<Record<string, unknown>>;
}

class LSEGPriceDataProvider implements PriceDataProvider {
  readonly source: PriceDataSource = 'lseg';

  private async apiGet<T>(path: string): Promise<T> {
    const token = await getLSEGAccessToken();
    const baseUrl = getLSEGBaseUrl();
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`LSEG API ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private mapQuoteToInstrumentPrice(
    isin: string,
    raw: LSEGQuoteResponse,
    date: string
  ): InstrumentPrice {
    const price =
      raw.TradePrice ??
      raw.LastPrice ??
      raw.ClosePrice ??
      (Array.isArray(raw.data) && raw.data[0]
        ? (raw.data[0].TradePrice ??
          raw.data[0].LastPrice ??
          raw.data[0].ClosePrice ??
          raw.data[0].Last ??
          raw.data[0].Close)
        : undefined);
    const currency =
      raw.Currency ??
      (Array.isArray(raw.data) && raw.data[0] ? (raw.data[0].Currency as string) : 'USD');
    const priceDate =
      raw.PriceDate ??
      raw.TradeDate ??
      (Array.isArray(raw.data) && raw.data[0]
        ? ((raw.data[0].PriceDate ?? raw.data[0].TradeDate) as string)
        : date);
    const name =
      raw.DisplayName ??
      (Array.isArray(raw.data) && raw.data[0] ? (raw.data[0].DisplayName as string) : isin);
    const ric = Array.isArray(raw.data) && raw.data[0] ? (raw.data[0].RIC as string) : undefined;

    if (typeof price !== 'number') {
      throw new Error(`LSEG: no price in response for ${isin}`);
    }

    return {
      isin,
      ric,
      name: String(name ?? isin),
      price,
      currency: String(currency ?? 'USD'),
      priceDate: String(priceDate ?? date),
      source: 'lseg',
      lastUpdated: new Date().toISOString(),
    };
  }

  async getInstrumentPrice(isin: string, date?: string): Promise<InstrumentPrice> {
    if (!this.isConfigured()) {
      throw new Error('LSEG provider not configured. Set LSEG_API_KEY and LSEG_API_SECRET.');
    }
    const effectiveDate = date ?? new Date().toISOString().split('T')[0];
    const path = `/data/pricing/v1/views/quote?identifier=ISIN:${encodeURIComponent(isin)}&date=${effectiveDate}`;
    try {
      const raw = await this.apiGet<LSEGQuoteResponse>(path);
      return this.mapQuoteToInstrumentPrice(isin, raw, effectiveDate);
    } catch (err) {
      const altPath = `/data/datagrid/v1/views/quote/data?identifier=ISIN:${encodeURIComponent(isin)}&date=${effectiveDate}`;
      try {
        const raw = await this.apiGet<LSEGQuoteResponse>(altPath);
        return this.mapQuoteToInstrumentPrice(isin, raw, effectiveDate);
      } catch {
        throw err;
      }
    }
  }

  async getInstrumentPrices(isins: string[], date?: string): Promise<InstrumentPrice[]> {
    const results: InstrumentPrice[] = [];
    for (const isin of isins) {
      try {
        results.push(await this.getInstrumentPrice(isin, date));
      } catch {
        // Skip failed; caller can check length vs input
      }
    }
    return results;
  }

  async getPriceData(fundId: string, date?: string): Promise<PriceDataRecord> {
    if (!this.isConfigured()) {
      throw new Error('LSEG provider not configured.');
    }
    const effectiveDate = date ?? new Date().toISOString().split('T')[0];
    const instrument = await this.getInstrumentPrice(fundId, effectiveDate);
    return {
      fundId,
      fundName: instrument.name,
      isin: fundId,
      date: effectiveDate,
      nav: instrument.price,
      aum: 0,
      outstandingShares: 0,
      currency: instrument.currency,
      source: 'lseg',
      lastUpdated: instrument.lastUpdated,
    };
  }

  async getAllPriceData(date?: string): Promise<PriceDataRecord[]> {
    if (!this.isConfigured()) {
      throw new Error('LSEG provider not configured.');
    }
    try {
      const registry = getFundRegistry();
      const funds = await registry.listFunds();
      const shareClasses = await registry.listShareClasses();
      const isins = new Set<string>();
      for (const sc of shareClasses) {
        isins.add(sc.isin);
      }
      for (const f of funds) {
        isins.add(f.isin);
      }
      const results: PriceDataRecord[] = [];
      for (const isin of isins) {
        try {
          results.push(await this.getPriceData(isin, date));
        } catch {
          // skip
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Referensdata (sektor, industri, land, market cap) för ett instrument
   */
  async getReferenceData(isin: string): Promise<LSEGRefDataResponse | null> {
    if (!this.isConfigured()) return null;
    try {
      const path = `/data/datagrid/v1/views/reference/data?identifier=ISIN:${encodeURIComponent(isin)}`;
      return await this.apiGet<LSEGRefDataResponse>(path);
    } catch {
      return null;
    }
  }

  /**
   * Corporate actions för ett instrument i ett datumintervall
   */
  async getCorporateActions(
    isin: string,
    fromDate: string,
    toDate: string
  ): Promise<LSEGRefDataResponse | null> {
    if (!this.isConfigured()) return null;
    try {
      const path = `/data/datagrid/v1/views/corporate-actions/data?identifier=ISIN:${encodeURIComponent(isin)}&from=${fromDate}&to=${toDate}`;
      return await this.apiGet<LSEGRefDataResponse>(path);
    } catch {
      return null;
    }
  }

  isConfigured(): boolean {
    return isLSEGConfigured();
  }

  async getStatus(): Promise<ProviderStatus> {
    if (!this.isConfigured()) {
      return {
        available: false,
        lastCheck: new Date().toISOString(),
        message: 'LSEG not configured. Set LSEG_API_KEY and LSEG_API_SECRET.',
        details: { configured: false },
      };
    }
    try {
      await getLSEGAccessToken();
      return {
        available: true,
        lastCheck: new Date().toISOString(),
        message: 'LSEG connected',
        details: { baseUrl: getLSEGBaseUrl() },
      };
    } catch (err) {
      return {
        available: false,
        lastCheck: new Date().toISOString(),
        message: err instanceof Error ? err.message : 'LSEG connection failed',
        details: { configured: true },
      };
    }
  }
}

// ============================================================================
// Provider Manager
// ============================================================================

class PriceDataProviderManager {
  private providers: Map<PriceDataSource, PriceDataProvider> = new Map();
  private activeSource: PriceDataSource = 'fund_registry';

  constructor() {
    // Registrera alla providers
    this.providers.set('mock', new MockPriceDataProvider());
    this.providers.set('csv', new CSVPriceDataProvider());
    this.providers.set('manual', new ManualPriceDataProvider());
    this.providers.set('fund_registry', new FundRegistryPriceDataProvider());
    this.providers.set('lseg', new LSEGPriceDataProvider());

    // Sätt aktiv provider från miljövariabel (default: fund_registry)
    const configuredSource = (process.env.NAV_PRICE_PROVIDER || 'fund_registry').toLowerCase() as PriceDataSource;
    if (this.providers.has(configuredSource)) {
      this.activeSource = configuredSource;
    }
  }

  /**
   * Hämta aktiv provider
   */
  getActiveProvider(): PriceDataProvider {
    return this.providers.get(this.activeSource)!;
  }

  /**
   * Hämta specifik provider
   */
  getProvider(source: PriceDataSource): PriceDataProvider | undefined {
    return this.providers.get(source);
  }

  /**
   * Byt aktiv provider
   */
  setActiveSource(source: PriceDataSource): void {
    if (!this.providers.has(source)) {
      throw new Error(`Unknown price data source: ${source}`);
    }
    this.activeSource = source;
  }

  /**
   * Hämta aktiv källa
   */
  getActiveSource(): PriceDataSource {
    return this.activeSource;
  }

  /**
   * Hämta status för alla providers
   */
  async getAllStatuses(): Promise<Record<PriceDataSource, ProviderStatus>> {
    const statuses: Record<string, ProviderStatus> = {};
    
    const entries = Array.from(this.providers.entries());
    for (const [source, provider] of entries) {
      statuses[source] = await provider.getStatus();
    }
    
    return statuses as Record<PriceDataSource, ProviderStatus>;
  }

  /**
   * Importera CSV-data
   */
  importCSV(rows: CSVPriceRow[]): { imported: number; errors: string[] } {
    const csvProvider = this.providers.get('csv') as CSVPriceDataProvider;
    return csvProvider.importFromCSV(rows);
  }

  /**
   * Sätt manuellt pris
   */
  setManualPrice(data: Parameters<ManualPriceDataProvider['setPrice']>[0]): void {
    const manualProvider = this.providers.get('manual') as ManualPriceDataProvider;
    manualProvider.setPrice(data);
  }
}

// ============================================================================
// Exports
// ============================================================================

let managerInstance: PriceDataProviderManager | null = null;

export function getPriceDataProviderManager(): PriceDataProviderManager {
  if (!managerInstance) {
    managerInstance = new PriceDataProviderManager();
  }
  return managerInstance;
}

export function getPriceDataProvider(): PriceDataProvider {
  return getPriceDataProviderManager().getActiveProvider();
}

export {
  MockPriceDataProvider,
  CSVPriceDataProvider,
  ManualPriceDataProvider,
  FundRegistryPriceDataProvider,
  LSEGPriceDataProvider,
  PriceDataProviderManager,
};
