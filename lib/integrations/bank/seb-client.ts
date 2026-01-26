/**
 * SEB Corporate API Client
 * 
 * Integration mot SEB:s Corporate & Institutional API för:
 * - Custody-information (värdepappersinnehav)
 * - Kontosaldon
 * - Transaktioner
 * - NAV-center data
 * 
 * SETUP:
 * 1. Kontakta SEB för API-access
 * 2. Registrera applikation och få OAuth2-credentials
 * 3. Konfigurera mTLS-certifikat
 * 4. Whitelist-a era IP-adresser
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// Types
// ============================================================================

export interface SEBConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  mtlsCertPath?: string;  // Path to mTLS certificate in S3
  mtlsKeyPath?: string;   // Path to mTLS private key in S3
}

export interface SEBAccountBalance {
  accountId: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  availableBalance: number;
  bookedBalance: number;
  creditLimit?: number;
  lastUpdated: string;
}

export interface SEBCustodyPosition {
  accountId: string;
  isin: string;
  instrumentName: string;
  instrumentType: 'EQUITY' | 'BOND' | 'FUND' | 'DERIVATIVE' | 'OTHER';
  quantity: number;
  marketPrice: number;
  marketValue: number;
  currency: string;
  priceDate: string;
  custodian: string;
  settlementStatus?: 'SETTLED' | 'PENDING';
}

export interface SEBTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  valueDate: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  counterparty?: string;
  isin?: string;
}

export interface SEBCustodyReport {
  reportDate: string;
  accountId: string;
  fundName: string;
  currency: string;
  positions: SEBCustodyPosition[];
  cashBalance: number;
  totalMarketValue: number;
  transactions?: SEBTransaction[];
  generatedAt: string;
}

// OAuth2 Token Response
interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// ============================================================================
// SEB API Client
// ============================================================================

export class SEBClient {
  private config: SEBConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config?: Partial<SEBConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.SEB_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.SEB_CLIENT_SECRET || '',
      baseUrl: config?.baseUrl || process.env.SEB_API_URL || 'https://api.seb.se/v1',
      mtlsCertPath: config?.mtlsCertPath || process.env.SEB_MTLS_CERT_PATH,
      mtlsKeyPath: config?.mtlsKeyPath || process.env.SEB_MTLS_KEY_PATH,
    };
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Hämtar OAuth2 access token från SEB
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('SEB API credentials not configured. Set SEB_CLIENT_ID and SEB_CLIENT_SECRET.');
    }

    console.log('[SEB] Requesting new access token...');

    try {
      const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'custody accounts transactions',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }

      const data: TokenResponse = await response.json();
      
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000); // Refresh 1 min before expiry
      
      console.log('[SEB] Access token obtained, expires:', this.tokenExpiry.toISOString());
      
      return this.accessToken;
    } catch (error) {
      console.error('[SEB] Token request failed:', error);
      throw new Error(`Failed to authenticate with SEB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gör ett autentiserat API-anrop till SEB
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Request-ID': crypto.randomUUID(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SEB API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // ==========================================================================
  // Account Information
  // ==========================================================================

  /**
   * Hämtar saldon för alla konton
   */
  async getAccountBalances(accountIds?: string[]): Promise<SEBAccountBalance[]> {
    console.log('[SEB] Fetching account balances...');
    
    const queryParams = accountIds?.length 
      ? `?accountIds=${accountIds.join(',')}` 
      : '';
    
    const response = await this.apiRequest<{ accounts: SEBAccountBalance[] }>(
      `/accounts/balances${queryParams}`
    );
    
    return response.accounts;
  }

  /**
   * Hämtar transaktioner för ett konto
   */
  async getTransactions(
    accountId: string,
    fromDate: string,
    toDate: string
  ): Promise<SEBTransaction[]> {
    console.log('[SEB] Fetching transactions for account:', accountId);
    
    const response = await this.apiRequest<{ transactions: SEBTransaction[] }>(
      `/accounts/${accountId}/transactions?fromDate=${fromDate}&toDate=${toDate}`
    );
    
    return response.transactions;
  }

  // ==========================================================================
  // Custody Information
  // ==========================================================================

  /**
   * Hämtar alla custody-positioner
   */
  async getCustodyPositions(accountId?: string): Promise<SEBCustodyPosition[]> {
    console.log('[SEB] Fetching custody positions...');
    
    const endpoint = accountId 
      ? `/custody/accounts/${accountId}/positions`
      : '/custody/positions';
    
    const response = await this.apiRequest<{ positions: SEBCustodyPosition[] }>(endpoint);
    
    return response.positions;
  }

  /**
   * Hämtar custody-sammanfattning per fond/konto
   */
  async getCustodySummary(accountId: string, date?: string): Promise<SEBCustodyReport> {
    console.log('[SEB] Fetching custody summary for:', accountId);
    
    const dateParam = date ? `?date=${date}` : '';
    
    const [positions, balances] = await Promise.all([
      this.getCustodyPositions(accountId),
      this.getAccountBalances([accountId]),
    ]);
    
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const cashBalance = balances.find(b => b.accountId === accountId)?.availableBalance || 0;
    
    return {
      reportDate: date || new Date().toISOString().split('T')[0],
      accountId,
      fundName: balances[0]?.accountName || 'Unknown',
      currency: balances[0]?.currency || 'SEK',
      positions,
      cashBalance,
      totalMarketValue: totalMarketValue + cashBalance,
      generatedAt: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // NAV Center Integration
  // ==========================================================================

  /**
   * Hämtar NAV-data från SEB NAV Center
   */
  async getNAVCenterData(isin: string, date?: string): Promise<{
    isin: string;
    navValue: number;
    navDate: string;
    aum: number;
    outstandingShares: number;
    currency: string;
  } | null> {
    console.log('[SEB] Fetching NAV Center data for ISIN:', isin);
    
    try {
      const dateParam = date ? `?date=${date}` : '';
      const response = await this.apiRequest<{
        isin: string;
        nav: number;
        date: string;
        aum: number;
        shares: number;
        currency: string;
      }>(`/navcenter/funds/${isin}${dateParam}`);
      
      return {
        isin: response.isin,
        navValue: response.nav,
        navDate: response.date,
        aum: response.aum,
        outstandingShares: response.shares,
        currency: response.currency,
      };
    } catch (error) {
      console.error('[SEB] NAV Center lookup failed:', error);
      return null;
    }
  }

  // ==========================================================================
  // Connection Test
  // ==========================================================================

  /**
   * Testar anslutningen till SEB API
   */
  async testConnection(): Promise<{
    connected: boolean;
    message: string;
    details?: {
      tokenValid: boolean;
      accountsAccessible: boolean;
      custodyAccessible: boolean;
    };
  }> {
    try {
      // Test 1: Token
      await this.getAccessToken();
      
      // Test 2: Account access
      let accountsAccessible = false;
      try {
        await this.getAccountBalances();
        accountsAccessible = true;
      } catch {
        // May not have access to all endpoints
      }
      
      // Test 3: Custody access
      let custodyAccessible = false;
      try {
        await this.getCustodyPositions();
        custodyAccessible = true;
      } catch {
        // May not have access to all endpoints
      }
      
      return {
        connected: true,
        message: 'Successfully connected to SEB API',
        details: {
          tokenValid: true,
          accountsAccessible,
          custodyAccessible,
        },
      };
    } catch (error) {
      return {
        connected: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

// ============================================================================
// Mock Client for Development
// ============================================================================

export class SEBMockClient extends SEBClient {
  /**
   * Mock implementation för utveckling/testning
   */
  
  async getAccountBalances(): Promise<SEBAccountBalance[]> {
    return [
      {
        accountId: 'SEB-001',
        accountNumber: '5000-1234567',
        accountName: 'AUAG Essential Metals - Custody',
        currency: 'SEK',
        availableBalance: 15234567.89,
        bookedBalance: 15234567.89,
        lastUpdated: new Date().toISOString(),
      },
      {
        accountId: 'SEB-002',
        accountNumber: '5000-7654321',
        accountName: 'AuAg Silver Bullet - Custody',
        currency: 'SEK',
        availableBalance: 8765432.10,
        bookedBalance: 8765432.10,
        lastUpdated: new Date().toISOString(),
      },
    ];
  }

  async getCustodyPositions(): Promise<SEBCustodyPosition[]> {
    return [
      {
        accountId: 'SEB-001',
        isin: 'SE0017832488',
        instrumentName: 'Boliden AB',
        instrumentType: 'EQUITY',
        quantity: 50000,
        marketPrice: 285.50,
        marketValue: 14275000,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
      {
        accountId: 'SEB-001',
        isin: 'CA0679011084',
        instrumentName: 'Barrick Gold Corp',
        instrumentType: 'EQUITY',
        quantity: 25000,
        marketPrice: 178.25,
        marketValue: 4456250,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
      {
        accountId: 'SEB-002',
        isin: 'US8336351056',
        instrumentName: 'SilverCrest Metals Inc',
        instrumentType: 'EQUITY',
        quantity: 100000,
        marketPrice: 65.40,
        marketValue: 6540000,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
    ];
  }

  async getTransactions(): Promise<SEBTransaction[]> {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        transactionId: 'TXN-001',
        accountId: 'SEB-001',
        date: today,
        valueDate: today,
        type: 'CREDIT',
        amount: 500000,
        currency: 'SEK',
        description: 'Subscription - New investor',
        reference: 'SUB-2026-001',
      },
      {
        transactionId: 'TXN-002',
        accountId: 'SEB-001',
        date: today,
        valueDate: today,
        type: 'DEBIT',
        amount: 285500,
        currency: 'SEK',
        description: 'Purchase - Boliden AB',
        reference: 'BUY-2026-001',
        isin: 'SE0017832488',
      },
    ];
  }

  async testConnection(): Promise<{
    connected: boolean;
    message: string;
    details?: {
      tokenValid: boolean;
      accountsAccessible: boolean;
      custodyAccessible: boolean;
    };
  }> {
    return {
      connected: true,
      message: 'Mock client - simulated connection',
      details: {
        tokenValid: true,
        accountsAccessible: true,
        custodyAccessible: true,
      },
    };
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let sebClientInstance: SEBClient | null = null;

export function getSEBClient(useMock: boolean = false): SEBClient {
  if (!sebClientInstance) {
    // Use mock in development or if explicitly requested
    const shouldUseMock = useMock || 
      process.env.NODE_ENV === 'development' || 
      !process.env.SEB_CLIENT_ID;
    
    sebClientInstance = shouldUseMock 
      ? new SEBMockClient() 
      : new SEBClient();
    
    console.log(`[SEB] Initialized ${shouldUseMock ? 'mock' : 'production'} client`);
  }
  return sebClientInstance;
}

// Reset singleton (for testing)
export function resetSEBClient(): void {
  sebClientInstance = null;
}
