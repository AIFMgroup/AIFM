/**
 * ISEC SECURA REST API Client
 * 
 * Klient för att kommunicera med SECURA Platform REST API
 * Hanterar autentisering, requests och felhantering
 */

import {
  SecuraConfig,
  SecuraAuthResponse,
  SecuraConnectionStatus,
  SecuraFund,
  SecuraPosition,
  SecuraCashSummary,
  SecuraNAV,
  SecuraNAVHistory,
  SecuraTransaction,
  SecuraShareholder,
  SecuraSubscriptionOrder,
  SecuraPrice,
  SecuraFXRate,
  SecuraReport,
  SecuraApiResponse,
  SecuraQueryParams,
  SecuraPositionQuery,
  SecuraTransactionQuery,
  SecuraNAVQuery,
} from './types';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Partial<SecuraConfig> = {
  timeout: 30000,
  retryAttempts: 3,
};

// ============================================================================
// SECURA API Client Class
// ============================================================================

export class SecuraClient {
  private config: SecuraConfig;
  private authToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl: string;

  constructor(config: SecuraConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = `https://${config.host}:${config.port}/api/v1`;
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Authenticate with SECURA API
   */
  async authenticate(): Promise<SecuraAuthResponse> {
    const response = await this.rawRequest<SecuraAuthResponse>('/auth/token', {
      method: 'POST',
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
      skipAuth: true,
    });

    this.authToken = response.token;
    this.tokenExpiry = new Date(response.expiresAt);

    return response;
  }

  /**
   * Check if current token is valid
   */
  private isTokenValid(): boolean {
    if (!this.authToken || !this.tokenExpiry) return false;
    // Refresh 5 minutes before expiry
    const bufferTime = 5 * 60 * 1000;
    return new Date().getTime() < this.tokenExpiry.getTime() - bufferTime;
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.isTokenValid()) {
      await this.authenticate();
    }
  }

  /**
   * Test connection to SECURA
   */
  async testConnection(): Promise<SecuraConnectionStatus> {
    try {
      await this.authenticate();
      const healthResponse = await this.rawRequest<{ version: string }>('/health', {
        method: 'GET',
      });

      return {
        connected: true,
        lastConnected: new Date().toISOString(),
        version: healthResponse.version,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // HTTP Request Handler
  // ==========================================================================

  private async rawRequest<T>(
    endpoint: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: string;
      skipAuth?: boolean;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const { method, body, skipAuth, params } = options;

    // Build URL with query params
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (!skipAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Make request with retry logic
    let lastError: Error | null = null;
    const maxRetries = this.config.retryAttempts || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new SecuraApiError(
            `SECURA API error: ${response.status} ${response.statusText}`,
            response.status,
            errorBody
          );
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on auth errors or client errors
        if (error instanceof SecuraApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: string;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<SecuraApiResponse<T>> {
    await this.ensureAuthenticated();
    return this.rawRequest<SecuraApiResponse<T>>(endpoint, options);
  }

  // ==========================================================================
  // Fund Operations
  // ==========================================================================

  /**
   * Get all funds
   */
  async getFunds(): Promise<SecuraFund[]> {
    const response = await this.request<SecuraFund[]>('/funds', { method: 'GET' });
    return response.data;
  }

  /**
   * Get single fund by ID
   */
  async getFund(fundId: string): Promise<SecuraFund> {
    const response = await this.request<SecuraFund>(`/funds/${fundId}`, { method: 'GET' });
    return response.data;
  }

  // ==========================================================================
  // Position Operations
  // ==========================================================================

  /**
   * Get positions for a fund
   */
  async getPositions(fundId: string, query?: SecuraPositionQuery): Promise<SecuraPosition[]> {
    const response = await this.request<SecuraPosition[]>(`/funds/${fundId}/positions`, {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  /**
   * Get positions for all funds
   */
  async getAllPositions(query?: SecuraPositionQuery): Promise<SecuraPosition[]> {
    const response = await this.request<SecuraPosition[]>('/positions', {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  /**
   * Get position by security
   */
  async getPositionBySecurity(fundId: string, isin: string): Promise<SecuraPosition | null> {
    const positions = await this.getPositions(fundId, { fromDate: new Date().toISOString().split('T')[0] });
    return positions.find(p => p.isin === isin) || null;
  }

  // ==========================================================================
  // Cash Operations
  // ==========================================================================

  /**
   * Get cash balances for a fund
   */
  async getCashBalances(fundId: string): Promise<SecuraCashSummary> {
    const response = await this.request<SecuraCashSummary>(`/funds/${fundId}/cash`, {
      method: 'GET',
    });
    return response.data;
  }

  /**
   * Get cash balances for all funds
   */
  async getAllCashBalances(): Promise<SecuraCashSummary[]> {
    const response = await this.request<SecuraCashSummary[]>('/cash', { method: 'GET' });
    return response.data;
  }

  // ==========================================================================
  // NAV Operations
  // ==========================================================================

  /**
   * Get current NAV for a fund/share class
   */
  async getNAV(fundId: string, shareClassId?: string): Promise<SecuraNAV> {
    const endpoint = shareClassId 
      ? `/funds/${fundId}/shareclasses/${shareClassId}/nav`
      : `/funds/${fundId}/nav`;
    
    const response = await this.request<SecuraNAV>(endpoint, { method: 'GET' });
    return response.data;
  }

  /**
   * Get NAV history
   */
  async getNAVHistory(
    fundId: string, 
    shareClassId: string, 
    query?: SecuraNAVQuery
  ): Promise<SecuraNAVHistory> {
    const response = await this.request<SecuraNAVHistory>(
      `/funds/${fundId}/shareclasses/${shareClassId}/nav/history`,
      {
        method: 'GET',
        params: query as Record<string, string | number | boolean | undefined>,
      }
    );
    return response.data;
  }

  /**
   * Get NAV for all funds on a specific date
   */
  async getNAVByDate(date: string): Promise<SecuraNAV[]> {
    const response = await this.request<SecuraNAV[]>('/nav', {
      method: 'GET',
      params: { navDate: date },
    });
    return response.data;
  }

  /**
   * Get detailed NAV breakdown
   */
  async getNAVBreakdown(fundId: string, shareClassId: string, date?: string): Promise<SecuraNAV> {
    const response = await this.request<SecuraNAV>(
      `/funds/${fundId}/shareclasses/${shareClassId}/nav/breakdown`,
      {
        method: 'GET',
        params: { navDate: date },
      }
    );
    return response.data;
  }

  // ==========================================================================
  // Transaction Operations
  // ==========================================================================

  /**
   * Get transactions for a fund
   */
  async getTransactions(fundId: string, query?: SecuraTransactionQuery): Promise<SecuraTransaction[]> {
    const response = await this.request<SecuraTransaction[]>(`/funds/${fundId}/transactions`, {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  /**
   * Get all pending transactions
   */
  async getPendingTransactions(): Promise<SecuraTransaction[]> {
    const response = await this.request<SecuraTransaction[]>('/transactions', {
      method: 'GET',
      params: { status: 'PENDING' },
    });
    return response.data;
  }

  // ==========================================================================
  // Shareholder Operations
  // ==========================================================================

  /**
   * Get shareholders for a fund/share class
   */
  async getShareholders(
    fundId: string, 
    shareClassId?: string,
    query?: SecuraQueryParams
  ): Promise<SecuraShareholder[]> {
    const endpoint = shareClassId
      ? `/funds/${fundId}/shareclasses/${shareClassId}/shareholders`
      : `/funds/${fundId}/shareholders`;

    const response = await this.request<SecuraShareholder[]>(endpoint, {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  /**
   * Get subscription/redemption orders
   */
  async getOrders(fundId: string, query?: SecuraQueryParams): Promise<SecuraSubscriptionOrder[]> {
    const response = await this.request<SecuraSubscriptionOrder[]>(`/funds/${fundId}/orders`, {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  /**
   * Get pending orders
   */
  async getPendingOrders(): Promise<SecuraSubscriptionOrder[]> {
    const response = await this.request<SecuraSubscriptionOrder[]>('/orders', {
      method: 'GET',
      params: { status: 'PENDING' },
    });
    return response.data;
  }

  // ==========================================================================
  // Price Operations
  // ==========================================================================

  /**
   * Get prices for securities
   */
  async getPrices(isins: string[], date?: string): Promise<SecuraPrice[]> {
    const response = await this.request<SecuraPrice[]>('/prices', {
      method: 'POST',
      body: JSON.stringify({ isins, priceDate: date }),
    });
    return response.data;
  }

  /**
   * Get FX rates
   */
  async getFXRates(baseCurrency: string, quoteCurrencies: string[], date?: string): Promise<SecuraFXRate[]> {
    const response = await this.request<SecuraFXRate[]>('/fx-rates', {
      method: 'GET',
      params: {
        baseCurrency,
        quoteCurrencies: quoteCurrencies.join(','),
        rateDate: date,
      },
    });
    return response.data;
  }

  // ==========================================================================
  // Report Operations
  // ==========================================================================

  /**
   * Generate a report
   */
  async generateReport(
    fundId: string,
    reportType: string,
    params: { fromDate?: string; toDate?: string; format?: string }
  ): Promise<SecuraReport> {
    const response = await this.request<SecuraReport>(`/funds/${fundId}/reports`, {
      method: 'POST',
      body: JSON.stringify({ reportType, ...params }),
    });
    return response.data;
  }

  /**
   * Get report status
   */
  async getReportStatus(reportId: string): Promise<SecuraReport> {
    const response = await this.request<SecuraReport>(`/reports/${reportId}`, {
      method: 'GET',
    });
    return response.data;
  }

  /**
   * List available reports
   */
  async listReports(fundId: string, query?: SecuraQueryParams): Promise<SecuraReport[]> {
    const response = await this.request<SecuraReport[]>(`/funds/${fundId}/reports`, {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
    return response.data;
  }

  // ==========================================================================
  // Bulk Operations (for NAV calculation)
  // ==========================================================================

  /**
   * Get all data needed for NAV calculation
   */
  async getNAVCalculationData(fundId: string, date?: string): Promise<{
    fund: SecuraFund;
    positions: SecuraPosition[];
    cash: SecuraCashSummary;
    pendingOrders: SecuraSubscriptionOrder[];
    currentNav?: SecuraNAV;
  }> {
    const [fund, positions, cash, pendingOrders] = await Promise.all([
      this.getFund(fundId),
      this.getPositions(fundId, { toDate: date }),
      this.getCashBalances(fundId),
      this.getOrders(fundId, { status: 'PENDING' } as SecuraQueryParams),
    ]);

    let currentNav: SecuraNAV | undefined;
    try {
      currentNav = await this.getNAV(fundId);
    } catch {
      // NAV might not exist yet
    }

    return { fund, positions, cash, pendingOrders, currentNav };
  }

  /**
   * Get snapshot of all funds for daily NAV run
   */
  async getDailyNAVSnapshot(): Promise<{
    funds: SecuraFund[];
    positions: Map<string, SecuraPosition[]>;
    cash: Map<string, SecuraCashSummary>;
    orders: SecuraSubscriptionOrder[];
    fxRates: SecuraFXRate[];
  }> {
    const funds = await this.getFunds();
    const activeFunds = funds.filter(f => f.status === 'ACTIVE');

    // Fetch data for all active funds in parallel
    const positionsPromises = activeFunds.map(f => 
      this.getPositions(f.fundId).then(p => ({ fundId: f.fundId, positions: p }))
    );
    const cashPromises = activeFunds.map(f => 
      this.getCashBalances(f.fundId).then(c => ({ fundId: f.fundId, cash: c }))
    );

    const [positionsResults, cashResults, orders, fxRates] = await Promise.all([
      Promise.all(positionsPromises),
      Promise.all(cashPromises),
      this.getPendingOrders(),
      this.getFXRates('SEK', ['USD', 'EUR', 'GBP', 'NOK', 'DKK', 'CHF', 'JPY']),
    ]);

    const positions = new Map<string, SecuraPosition[]>();
    positionsResults.forEach(r => positions.set(r.fundId, r.positions));

    const cash = new Map<string, SecuraCashSummary>();
    cashResults.forEach(r => cash.set(r.fundId, r.cash));

    return { funds, positions, cash, orders, fxRates };
  }
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class SecuraApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'SecuraApiError';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let clientInstance: SecuraClient | null = null;

/**
 * Get SECURA client instance (singleton)
 */
export function getSecuraClient(config?: SecuraConfig): SecuraClient {
  if (!clientInstance && config) {
    clientInstance = new SecuraClient(config);
  }
  
  if (!clientInstance) {
    throw new Error('SECURA client not initialized. Call with config first.');
  }
  
  return clientInstance;
}

/**
 * Create new SECURA client instance
 */
export function createSecuraClient(config: SecuraConfig): SecuraClient {
  return new SecuraClient(config);
}

/**
 * Get SECURA client from environment variables
 */
export function getSecuraClientFromEnv(): SecuraClient {
  const config: SecuraConfig = {
    host: process.env.SECURA_HOST || '194.62.154.68',
    port: parseInt(process.env.SECURA_PORT || '20023', 10),
    username: process.env.SECURA_USERNAME || 'RESTAPI_AIFM',
    password: process.env.SECURA_PASSWORD || '',
    timeout: parseInt(process.env.SECURA_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.SECURA_RETRY_ATTEMPTS || '3', 10),
  };

  if (!config.password) {
    throw new Error('SECURA_PASSWORD environment variable is required');
  }

  return getSecuraClient(config);
}
