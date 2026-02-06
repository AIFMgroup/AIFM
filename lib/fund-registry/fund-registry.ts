/**
 * Fund Registry Service
 * 
 * Modern fondregister med stöd för:
 * - Fonddata och andelsklasser
 * - NAV-hantering och historik
 * - Positioner och innehav
 * - Transaktioner
 * - Investerare
 */

import {
  Fund,
  ShareClass,
  NAVRecord,
  Position,
  CashBalance,
  Transaction,
  Investor,
  Holding,
  NAVSource,
  NAVStatus,
  Currency,
  PaginatedResponse,
} from './types';

// ============================================================================
// Storage Interface (abstraction for different backends)
// ============================================================================

interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list<T>(prefix: string): Promise<T[]>;
  query<T>(prefix: string, filter: (item: T) => boolean): Promise<T[]>;
}

// In-memory storage for development/demo
class InMemoryStorage implements StorageAdapter {
  private data: Map<string, unknown> = new Map();

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) || null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list<T>(prefix: string): Promise<T[]> {
    const results: T[] = [];
    this.data.forEach((value, key) => {
      if (key.startsWith(prefix)) {
        results.push(value as T);
      }
    });
    return results;
  }

  async query<T>(prefix: string, filter: (item: T) => boolean): Promise<T[]> {
    const all = await this.list<T>(prefix);
    return all.filter(filter);
  }
}

// ============================================================================
// Fund Registry Service
// ============================================================================

export class FundRegistry {
  private storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this.storage = storage || new InMemoryStorage();
    this.initializeDemoData();
  }

  // ============================================
  // FUNDS
  // ============================================

  async getFund(id: string): Promise<Fund | null> {
    return this.storage.get<Fund>(`fund:${id}`);
  }

  async getFundByISIN(isin: string): Promise<Fund | null> {
    const funds = await this.listFunds();
    return funds.find(f => f.isin === isin) || null;
  }

  async listFunds(): Promise<Fund[]> {
    return this.storage.list<Fund>('fund:');
  }

  async createFund(fund: Omit<Fund, 'id' | 'createdAt' | 'updatedAt'>): Promise<Fund> {
    const newFund: Fund = {
      ...fund,
      id: this.generateId('fund'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.set(`fund:${newFund.id}`, newFund);
    return newFund;
  }

  async updateFund(id: string, updates: Partial<Fund>): Promise<Fund | null> {
    const fund = await this.getFund(id);
    if (!fund) return null;

    const updated: Fund = {
      ...fund,
      ...updates,
      id: fund.id,
      createdAt: fund.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.storage.set(`fund:${id}`, updated);
    return updated;
  }

  // ============================================
  // SHARE CLASSES
  // ============================================

  async getShareClass(id: string): Promise<ShareClass | null> {
    return this.storage.get<ShareClass>(`shareclass:${id}`);
  }

  async getShareClassByISIN(isin: string): Promise<ShareClass | null> {
    const classes = await this.listShareClasses();
    return classes.find(sc => sc.isin === isin) || null;
  }

  async listShareClasses(fundId?: string): Promise<ShareClass[]> {
    const all = await this.storage.list<ShareClass>('shareclass:');
    if (fundId) {
      return all.filter(sc => sc.fundId === fundId);
    }
    return all;
  }

  async createShareClass(shareClass: Omit<ShareClass, 'id' | 'createdAt' | 'updatedAt'>): Promise<ShareClass> {
    const newClass: ShareClass = {
      ...shareClass,
      id: this.generateId('sc'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.set(`shareclass:${newClass.id}`, newClass);
    return newClass;
  }

  // ============================================
  // NAV RECORDS
  // ============================================

  async getNAV(shareClassId: string, date?: string): Promise<NAVRecord | null> {
    if (date) {
      return this.storage.get<NAVRecord>(`nav:${shareClassId}:${date}`);
    }
    // Get latest
    const navs = await this.getNAVHistory(shareClassId, 1);
    return navs[0] || null;
  }

  async getNAVHistory(shareClassId: string, limit?: number): Promise<NAVRecord[]> {
    const all = await this.storage.query<NAVRecord>(
      'nav:',
      (nav) => nav.shareClassId === shareClassId
    );
    const sorted = all.sort((a, b) => b.date.localeCompare(a.date));
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getAllNAVs(date?: string): Promise<NAVRecord[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.storage.query<NAVRecord>(
      'nav:',
      (nav) => nav.date === targetDate
    );
  }

  async setNAV(nav: Omit<NAVRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<NAVRecord> {
    // Get previous NAV for calculating change
    const previousNAV = await this.getNAV(nav.shareClassId);
    
    const navChange = previousNAV 
      ? nav.navPerShare - previousNAV.navPerShare 
      : undefined;
    const navChangePercent = previousNAV && previousNAV.navPerShare > 0
      ? ((nav.navPerShare - previousNAV.navPerShare) / previousNAV.navPerShare) * 100
      : undefined;

    const newNAV: NAVRecord = {
      ...nav,
      id: this.generateId('nav'),
      previousNav: previousNAV?.navPerShare,
      navChange,
      navChangePercent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.set(`nav:${nav.shareClassId}:${nav.date}`, newNAV);
    return newNAV;
  }

  async approveNAV(shareClassId: string, date: string, approvedBy: string): Promise<NAVRecord | null> {
    const nav = await this.getNAV(shareClassId, date);
    if (!nav) return null;

    const updated: NAVRecord = {
      ...nav,
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.storage.set(`nav:${shareClassId}:${date}`, updated);
    return updated;
  }

  // ============================================
  // POSITIONS
  // ============================================

  async getPositions(fundId: string, date?: string): Promise<Position[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.storage.query<Position>(
      'position:',
      (pos) => pos.fundId === fundId && pos.date === targetDate
    );
  }

  async setPositions(fundId: string, date: string, positions: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Position[]> {
    const created: Position[] = [];
    
    for (const pos of positions) {
      const newPos: Position = {
        ...pos,
        id: this.generateId('pos'),
        fundId,
        date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.storage.set(`position:${fundId}:${date}:${newPos.instrumentId}`, newPos);
      created.push(newPos);
    }

    return created;
  }

  // ============================================
  // CASH BALANCES
  // ============================================

  async getCashBalances(fundId: string, date?: string): Promise<CashBalance[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.storage.query<CashBalance>(
      'cash:',
      (cash) => cash.fundId === fundId && cash.date === targetDate
    );
  }

  async setCashBalance(cash: Omit<CashBalance, 'id' | 'createdAt' | 'updatedAt'>): Promise<CashBalance> {
    const newCash: CashBalance = {
      ...cash,
      id: this.generateId('cash'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.set(`cash:${cash.fundId}:${cash.date}:${cash.currency}`, newCash);
    return newCash;
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  async getTransaction(id: string): Promise<Transaction | null> {
    return this.storage.get<Transaction>(`tx:${id}`);
  }

  async listTransactions(
    fundId: string,
    options?: {
      shareClassId?: string;
      dateFrom?: string;
      dateTo?: string;
      type?: Transaction['type'];
      status?: Transaction['status'];
    }
  ): Promise<Transaction[]> {
    return this.storage.query<Transaction>('tx:', (tx) => {
      if (tx.fundId !== fundId) return false;
      if (options?.shareClassId && tx.shareClassId !== options.shareClassId) return false;
      if (options?.dateFrom && tx.tradeDate < options.dateFrom) return false;
      if (options?.dateTo && tx.tradeDate > options.dateTo) return false;
      if (options?.type && tx.type !== options.type) return false;
      if (options?.status && tx.status !== options.status) return false;
      return true;
    });
  }

  async createTransaction(tx: Omit<Transaction, 'id' | 'internalRef' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const newTx: Transaction = {
      ...tx,
      id: this.generateId('tx'),
      internalRef: this.generateRef('TXN'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.storage.set(`tx:${newTx.id}`, newTx);
    return newTx;
  }

  async getTransactionSummary(
    fundId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<{
    subscriptions: { count: number; totalAmount: number; totalShares: number };
    redemptions: { count: number; totalAmount: number; totalShares: number };
    netFlow: number;
    netShares: number;
  }> {
    const transactions = await this.listTransactions(fundId, { dateFrom, dateTo });

    const subs = transactions.filter(t => t.type === 'subscription' && t.status === 'settled');
    const reds = transactions.filter(t => t.type === 'redemption' && t.status === 'settled');

    const subscriptions = {
      count: subs.length,
      totalAmount: subs.reduce((sum, t) => sum + t.amount, 0),
      totalShares: subs.reduce((sum, t) => sum + t.shares, 0),
    };

    const redemptions = {
      count: reds.length,
      totalAmount: reds.reduce((sum, t) => sum + t.amount, 0),
      totalShares: reds.reduce((sum, t) => sum + t.shares, 0),
    };

    return {
      subscriptions,
      redemptions,
      netFlow: subscriptions.totalAmount - redemptions.totalAmount,
      netShares: subscriptions.totalShares - redemptions.totalShares,
    };
  }

  // ============================================
  // INVESTORS & HOLDINGS
  // ============================================

  async getInvestor(id: string): Promise<Investor | null> {
    return this.storage.get<Investor>(`investor:${id}`);
  }

  async listInvestors(): Promise<Investor[]> {
    return this.storage.list<Investor>('investor:');
  }

  async getHoldings(fundId: string, shareClassId?: string): Promise<Holding[]> {
    return this.storage.query<Holding>('holding:', (h) => {
      if (h.fundId !== fundId) return false;
      if (shareClassId && h.shareClassId !== shareClassId) return false;
      return true;
    });
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  /**
   * Get complete fund overview with NAV, positions, and cash
   */
  async getFundOverview(fundId: string, date?: string): Promise<{
    fund: Fund;
    shareClasses: ShareClass[];
    navRecords: NAVRecord[];
    positions: Position[];
    cashBalances: CashBalance[];
  } | null> {
    const fund = await this.getFund(fundId);
    if (!fund) return null;

    const shareClasses = await this.listShareClasses(fundId);
    const navRecords: NAVRecord[] = [];

    for (const sc of shareClasses) {
      const nav = await this.getNAV(sc.id, date);
      if (nav) navRecords.push(nav);
    }

    const positions = await this.getPositions(fundId, date);
    const cashBalances = await this.getCashBalances(fundId, date);

    return { fund, shareClasses, navRecords, positions, cashBalances };
  }

  /**
   * Get all price data for NAV reporting
   */
  async getPriceData(date?: string): Promise<Array<{
    fundId: string;
    fundName: string;
    isin: string;
    date: string;
    nav: number;
    navChange?: number;
    aum: number;
    outstandingShares: number;
    currency: Currency;
    source: NAVSource;
    lastUpdated: string;
  }>> {
    const navRecords = await this.getAllNAVs(date);
    const result = [];

    for (const nav of navRecords) {
      const shareClass = await this.getShareClass(nav.shareClassId);
      const fund = shareClass ? await this.getFund(shareClass.fundId) : null;

      if (shareClass && fund) {
        result.push({
          fundId: shareClass.isin,
          fundName: `${fund.name} ${shareClass.name}`,
          isin: shareClass.isin,
          date: nav.date,
          nav: nav.navPerShare,
          navChange: nav.navChangePercent,
          aum: nav.shareClassNetAssets,
          outstandingShares: nav.outstandingShares,
          currency: shareClass.currency,
          source: nav.source,
          lastUpdated: nav.updatedAt,
        });
      }
    }

    return result;
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateRef(prefix: string): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${date}-${seq}`;
  }

  // ============================================
  // DEMO DATA INITIALIZATION
  // ============================================

  private async initializeDemoData(): Promise<void> {
    // Check if already initialized
    const existing = await this.listFunds();
    if (existing.length > 0) return;

    // Create demo funds and share classes
    const demoFunds = [
      {
        name: 'AuAg Silver Bullet',
        shortName: 'Silver Bullet',
        legalName: 'AuAg Silver Bullet Fund',
        isin: 'SE0013358181',
        currency: 'SEK' as Currency,
        status: 'active' as const,
        type: 'commodity' as const,
        ucits: true,
        aifmd: false,
        countryOfDomicile: 'SE',
        inceptionDate: '2020-03-15',
        fiscalYearEnd: '12-31',
      },
      {
        name: 'AuAg Gold Rush',
        shortName: 'Gold Rush',
        legalName: 'AuAg Gold Rush Fund',
        isin: 'SE0020677946',
        currency: 'SEK' as Currency,
        status: 'active' as const,
        type: 'commodity' as const,
        ucits: true,
        aifmd: false,
        countryOfDomicile: 'SE',
        inceptionDate: '2021-09-01',
        fiscalYearEnd: '12-31',
      },
      {
        name: 'AuAg Precious Green',
        shortName: 'Precious Green',
        legalName: 'AuAg Precious Green Fund',
        isin: 'SE0014808440',
        currency: 'SEK' as Currency,
        status: 'active' as const,
        type: 'commodity' as const,
        ucits: true,
        aifmd: false,
        countryOfDomicile: 'SE',
        inceptionDate: '2020-11-01',
        fiscalYearEnd: '12-31',
      },
      {
        name: 'AUAG Essential Metals',
        shortName: 'Essential Metals',
        legalName: 'AUAG Essential Metals Fund',
        isin: 'SE0019175563',
        currency: 'SEK' as Currency,
        status: 'active' as const,
        type: 'commodity' as const,
        ucits: true,
        aifmd: false,
        countryOfDomicile: 'SE',
        inceptionDate: '2022-06-01',
        fiscalYearEnd: '12-31',
      },
    ];

    const demoShareClasses = [
      // Silver Bullet
      { fundIsin: 'SE0013358181', name: 'A', isin: 'SE0013358181', currency: 'SEK' as Currency, fee: 1.5, nav: 378.33, aum: 3400248947.80, shares: 8987586.35 },
      { fundIsin: 'SE0013358181', name: 'B', isin: 'SE0013358199', currency: 'EUR' as Currency, fee: 1.5, nav: 37.23, aum: 921562837.38, shares: 2265711.61 },
      // Gold Rush
      { fundIsin: 'SE0020677946', name: 'A', isin: 'SE0020677946', currency: 'SEK' as Currency, fee: 1.5, nav: 208.71, aum: 505494096.59, shares: 2422025.74 },
      { fundIsin: 'SE0020677946', name: 'B', isin: 'SE0020677953', currency: 'EUR' as Currency, fee: 1.5, nav: 22.63, aum: 98912.81, shares: 400.00 },
      { fundIsin: 'SE0020677946', name: 'C', isin: 'SE0020677961', currency: 'SEK' as Currency, fee: 1.0, nav: 170.52, aum: 12710988.85, shares: 74543.90 },
      { fundIsin: 'SE0020677946', name: 'H', isin: 'SE0020678001', currency: 'NOK' as Currency, fee: 1.5, nav: 197.23, aum: 87854781.97, shares: 488103.97 },
      // Precious Green
      { fundIsin: 'SE0014808440', name: 'A', isin: 'SE0014808440', currency: 'SEK' as Currency, fee: 1.5, nav: 198.87, aum: 328924859.33, shares: 1653996.37 },
      { fundIsin: 'SE0014808440', name: 'B', isin: 'SE0014808457', currency: 'EUR' as Currency, fee: 1.5, nav: 18.88, aum: 12524335.34, shares: 60729.92 },
      { fundIsin: 'SE0014808440', name: 'C', isin: 'SE0015948641', currency: 'SEK' as Currency, fee: 1.0, nav: 140.36, aum: 5845893.25, shares: 41648.44 },
      // Essential Metals
      { fundIsin: 'SE0019175563', name: 'A', isin: 'SE0019175563', currency: 'SEK' as Currency, fee: 1.5, nav: 142.42, aum: 349892028.52, shares: 2456766.31 },
      { fundIsin: 'SE0019175563', name: 'B', isin: 'SE0019175571', currency: 'EUR' as Currency, fee: 1.5, nav: 14.65, aum: 43120778.87, shares: 269451.12 },
      { fundIsin: 'SE0019175563', name: 'C', isin: 'SE0019175589', currency: 'SEK' as Currency, fee: 1.0, nav: 128.56, aum: 2571291.72, shares: 20000.00 },
    ];

    // Create funds
    const fundMap = new Map<string, Fund>();
    for (const fundData of demoFunds) {
      const fund = await this.createFund(fundData);
      fundMap.set(fund.isin, fund);
    }

    // Create share classes and NAV records
    const today = new Date().toISOString().split('T')[0];
    for (const scData of demoShareClasses) {
      const fund = fundMap.get(scData.fundIsin);
      if (!fund) continue;

      const shareClass = await this.createShareClass({
        fundId: fund.id,
        name: scData.name,
        isin: scData.isin,
        currency: scData.currency,
        status: 'active',
        managementFee: scData.fee,
        distributionPolicy: 'accumulating',
      });

      // Create NAV record
      await this.setNAV({
        fundId: fund.id,
        shareClassId: shareClass.id,
        date: today,
        navPerShare: scData.nav,
        totalNetAssets: scData.aum * 1.1, // Approximate fund total
        shareClassNetAssets: scData.aum,
        outstandingShares: scData.shares,
        source: 'manual',
        status: 'approved',
      });
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let registryInstance: FundRegistry | null = null;

export function getFundRegistry(): FundRegistry {
  if (!registryInstance) {
    registryInstance = new FundRegistry();
  }
  return registryInstance;
}

export default FundRegistry;
