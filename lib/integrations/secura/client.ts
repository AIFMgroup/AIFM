/**
 * Secura REST API Client
 * 
 * Integration med Secura Fund & Portfolio för NAV-automation
 * Dokumentation: http://194.62.154.68:21023/
 */

// Konfiguration
const SECURA_CONFIG = {
  // Test-miljö (AIFM)
  test: {
    host: '194.62.154.68',
    apiPort: 20023,
    swaggerPort: 21023,
    username: 'RESTAPI_AIFM',
    // Lösenord hämtas från miljövariabler i produktion
  },
  // Produktions-miljö
  production: {
    host: process.env.SECURA_HOST || '194.62.154.68',
    apiPort: parseInt(process.env.SECURA_API_PORT || '20023'),
    username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
  }
};

interface SecuraAuthResponse {
  token: string;
  expiresAt?: string;
  user?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

interface SecuraFund {
  id: string;
  name: string;
  isin?: string;
  currency: string;
  type: string;
}

interface SecuraNAVData {
  fundId: string;
  date: string;
  nav: number;
  aum: number;
  outstandingShares: number;
  currency: string;
}

interface SecuraTransaction {
  id: string;
  fundId: string;
  type: 'SUBSCRIPTION' | 'REDEMPTION';
  amount: number;
  shares: number;
  date: string;
  settlementDate: string;
  status: string;
  investorId: string;
  investorName: string;
}

interface SecuraHolding {
  investorId: string;
  investorName: string;
  fundId: string;
  shares: number;
  value: number;
  percentage: number;
  lastUpdated: string;
}

// Instrumentposition (för custody-avstämning)
interface SecuraPosition {
  isin: string;
  instrumentName: string;
  instrumentType: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  currency: string;
  costBasis?: number;
  unrealizedPL?: number;
  lastUpdated: string;
}

interface SecuraReport {
  id: string;
  type: string;
  fundId: string;
  date: string;
  status: string;
  downloadUrl?: string;
}

export class SecuraAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SecuraAPIError';
  }
}

export class SecuraClient {
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private username: string;
  private password: string;

  constructor(options?: {
    environment?: 'test' | 'production';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  }) {
    const env = options?.environment || 'test';
    const config = SECURA_CONFIG[env];
    
    this.baseUrl = `http://${options?.host || config.host}:${options?.port || config.apiPort}`;
    this.username = options?.username || config.username;
    this.password = options?.password || process.env.SECURA_PASSWORD || '';
  }

  /**
   * Autentisera mot Secura API
   */
  async authenticate(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });

      if (!response.ok) {
        throw new SecuraAPIError(
          'Authentication failed',
          response.status,
          '/user/login'
        );
      }

      const data: SecuraAuthResponse = await response.json();
      this.token = data.token;
      
      // Sätt token utgång (standard 24h om inte specificerat)
      if (data.expiresAt) {
        this.tokenExpiresAt = new Date(data.expiresAt);
      } else {
        this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      console.log('[SecuraClient] Successfully authenticated');
    } catch (error) {
      console.error('[SecuraClient] Authentication error:', error);
      throw error;
    }
  }

  /**
   * Kontrollera och förnya token vid behov
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.token || !this.tokenExpiresAt || this.tokenExpiresAt < new Date()) {
      await this.authenticate();
    }
  }

  /**
   * Generisk API-request med autentisering
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureAuthenticated();

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new SecuraAPIError(
        `API request failed: ${response.statusText}`,
        response.status,
        endpoint,
        errorBody
      );
    }

    return response.json();
  }

  // ============================================
  // FONDER
  // ============================================

  /**
   * Hämta lista över alla fonder
   */
  async getFunds(): Promise<SecuraFund[]> {
    return this.request<SecuraFund[]>('/funds');
  }

  /**
   * Hämta specifik fond
   */
  async getFund(fundId: string): Promise<SecuraFund> {
    return this.request<SecuraFund>(`/funds/${fundId}`);
  }

  // ============================================
  // NAV DATA
  // ============================================

  /**
   * Hämta NAV för en fond på ett specifikt datum
   */
  async getNAV(fundId: string, date: string): Promise<SecuraNAVData> {
    return this.request<SecuraNAVData>(`/funds/${fundId}/nav?date=${date}`);
  }

  /**
   * Hämta NAV-historik för en fond
   */
  async getNAVHistory(
    fundId: string,
    fromDate: string,
    toDate: string
  ): Promise<SecuraNAVData[]> {
    return this.request<SecuraNAVData[]>(
      `/funds/${fundId}/nav/history?from=${fromDate}&to=${toDate}`
    );
  }

  /**
   * Hämta senaste NAV för alla fonder
   */
  async getLatestNAVForAllFunds(): Promise<SecuraNAVData[]> {
    return this.request<SecuraNAVData[]>('/funds/nav/latest');
  }

  // ============================================
  // TRANSAKTIONER (Notor / SubReds)
  // ============================================

  /**
   * Hämta dagens transaktioner (Notor)
   * @param date - Datum i format YYYY-MM-DD
   */
  async getTransactions(
    fundId: string,
    date: string,
    type?: 'SUBSCRIPTION' | 'REDEMPTION'
  ): Promise<SecuraTransaction[]> {
    let endpoint = `/funds/${fundId}/transactions?date=${date}`;
    if (type) {
      endpoint += `&type=${type}`;
    }
    return this.request<SecuraTransaction[]>(endpoint);
  }

  /**
   * Hämta gårdagens in/utflöden (Notor)
   */
  async getYesterdayTransactions(fundId: string): Promise<SecuraTransaction[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    return this.getTransactions(fundId, dateStr);
  }

  /**
   * Hämta morgondagens förväntade transaktioner (SubRed)
   */
  async getTomorrowTransactions(fundId: string): Promise<SecuraTransaction[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    return this.getTransactions(fundId, dateStr);
  }

  /**
   * Hämta subscription/redemption-sammanställning
   */
  async getSubRedSummary(fundId: string, date: string): Promise<{
    subscriptions: { count: number; totalAmount: number; totalShares: number };
    redemptions: { count: number; totalAmount: number; totalShares: number };
    netFlow: number;
  }> {
    return this.request(`/funds/${fundId}/transactions/summary?date=${date}`);
  }

  // ============================================
  // INNEHAV / ÄGARDATA
  // ============================================

  /**
   * Hämta alla innehav för en fond
   */
  async getHoldings(fundId: string): Promise<SecuraHolding[]> {
    return this.request<SecuraHolding[]>(`/funds/${fundId}/holdings`);
  }

  /**
   * Hämta innehav för specifik investerare
   */
  async getInvestorHoldings(investorId: string): Promise<SecuraHolding[]> {
    return this.request<SecuraHolding[]>(`/investors/${investorId}/holdings`);
  }

  /**
   * Hämta Clearstream-specifika innehav
   */
  async getClearstreamHoldings(fundId: string): Promise<SecuraHolding[]> {
    return this.request<SecuraHolding[]>(
      `/funds/${fundId}/holdings?custodian=CLEARSTREAM`
    );
  }

  // ============================================
  // RAPPORTER
  // ============================================

  /**
   * Hämta tillgängliga rapporter för en fond
   */
  async getReports(fundId: string): Promise<SecuraReport[]> {
    return this.request<SecuraReport[]>(`/funds/${fundId}/reports`);
  }

  /**
   * Generera NAV-rapport
   */
  async generateNAVReport(
    fundId: string,
    date: string,
    format: 'PDF' | 'EXCEL' = 'PDF'
  ): Promise<{ reportId: string; downloadUrl: string }> {
    return this.request(`/funds/${fundId}/reports/nav`, {
      method: 'POST',
      body: JSON.stringify({ date, format }),
    });
  }

  /**
   * Generera kontoutdrag
   */
  async generateAccountStatement(
    fundId: string,
    date: string
  ): Promise<{ reportId: string; downloadUrl: string }> {
    return this.request(`/funds/${fundId}/reports/account-statement`, {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  /**
   * Ladda ner rapport som blob
   */
  async downloadReport(reportUrl: string): Promise<Blob> {
    await this.ensureAuthenticated();
    
    const response = await fetch(reportUrl, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new SecuraAPIError(
        'Failed to download report',
        response.status,
        reportUrl
      );
    }

    return response.blob();
  }

  // ============================================
  // PRISDATA
  // ============================================

  /**
   * Hämta prisdata för export
   * Returnerar NAV, AUM, och utstående andelar
   */
  async getPriceData(fundId: string, date?: string): Promise<{
    fundId: string;
    fundName: string;
    isin: string;
    date: string;
    nav: number;
    aum: number;
    outstandingShares: number;
    currency: string;
  }> {
    const dateParam = date || new Date().toISOString().split('T')[0];
    return this.request(`/funds/${fundId}/pricedata?date=${dateParam}`);
  }

  /**
   * Hämta prisdata för alla fonder (för massdistribution)
   */
  async getAllPriceData(date?: string): Promise<Array<{
    fundId: string;
    fundName: string;
    isin: string;
    date: string;
    nav: number;
    aum: number;
    outstandingShares: number;
    currency: string;
  }>> {
    const dateParam = date || new Date().toISOString().split('T')[0];
    return this.request(`/funds/pricedata?date=${dateParam}`);
  }

  // ============================================
  // HJÄLPMETODER
  // ============================================

  /**
   * Testa anslutning till Secura
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Hämta API-version och status
   */
  async getApiStatus(): Promise<{
    version: string;
    status: string;
    serverTime: string;
  }> {
    // Detta endpoint kräver troligen inte autentisering
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  // ============================================
  // POSITIONER (Custody)
  // ============================================

  /**
   * Hämta instrumentpositioner för en fond (för custody-avstämning)
   */
  async getPositions(fundId: string): Promise<SecuraPosition[]> {
    try {
      // Detta är baserat på antagen API-struktur
      // Anpassa endpoint efter faktisk Secura dokumentation
      return this.request<SecuraPosition[]>(`/funds/${fundId}/positions`);
    } catch (error) {
      console.warn(`[SecuraClient] getPositions fallback - endpoint may not exist yet for fund ${fundId}`);
      // Returnera tom array om endpoint inte finns
      return [];
    }
  }

  /**
   * Hämta kassasaldo för en fond
   */
  async getCashBalance(fundId: string): Promise<{
    currency: string;
    balance: number;
    availableBalance: number;
    pendingTransactions: number;
    lastUpdated: string;
  }> {
    try {
      return this.request(`/funds/${fundId}/cash`);
    } catch (error) {
      console.warn(`[SecuraClient] getCashBalance fallback for fund ${fundId}`);
      // Returnera mock-data om endpoint inte finns
      return {
        currency: 'SEK',
        balance: 0,
        availableBalance: 0,
        pendingTransactions: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}

// Singleton-instans för enkel användning
let securaClientInstance: SecuraClient | null = null;

export function getSecuraClient(options?: ConstructorParameters<typeof SecuraClient>[0]): SecuraClient {
  if (!securaClientInstance) {
    securaClientInstance = new SecuraClient(options);
  }
  return securaClientInstance;
}

// Exportera typer
export type {
  SecuraAuthResponse,
  SecuraFund,
  SecuraNAVData,
  SecuraTransaction,
  SecuraHolding,
  SecuraPosition,
  SecuraReport,
};
