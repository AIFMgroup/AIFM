/**
 * SEB Corporate API Client
 * 
 * Integration mot SEB:s Corporate & Institutional API för:
 * - Custody-information (värdepappersinnehav)
 * - Kontosaldon
 * - Transaktioner
 * - NAV-center data
 * 
 * SEB Developer Portal: https://developer.sebgroup.com
 * 
 * Available APIs:
 * - Global Custody Positions: GET /custody/v1/accounts/{accountId}/positions
 * - Global Custody Cash: GET /custody/v1/accounts/{accountId}/cash
 * - Global Custody Safekeeping: GET /custody/v1/accounts/{accountId}
 * - Global Custody Transactions: GET /custody/v1/accounts/{accountId}/transactions
 * 
 * SETUP:
 * 1. Register at developer.sebgroup.com
 * 2. Create an application and get OAuth2 credentials
 * 3. Request access to Global Custody APIs
 * 4. Configure mTLS certificates (for production)
 * 5. Whitelist your IP addresses
 * 
 * Environment Variables:
 * - SEB_CLIENT_ID: OAuth2 client ID
 * - SEB_CLIENT_SECRET: OAuth2 client secret
 * - SEB_API_URL: API base URL (sandbox: https://api-sandbox.sebgroup.com)
 * - SEB_CUSTODY_ACCOUNT_ID: Default custody account ID
 */

// ============================================================================
// Types
// ============================================================================

export interface SEBConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  sandboxUrl: string;
  useSandbox: boolean;
  mtlsCertPath?: string;  // Path to mTLS certificate in S3
  mtlsKeyPath?: string;   // Path to mTLS private key in S3
  defaultAccountId?: string;
}

// Fund to SEB Account mapping
export interface FundAccountMapping {
  fundId: string;
  fundName: string;
  sebAccountId: string;
  isin?: string;
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

// SEB API Response wrapper
interface SEBApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

// Default fund-to-account mappings (should be moved to database/config)
const DEFAULT_FUND_MAPPINGS: FundAccountMapping[] = [
  { fundId: 'FUND001', fundName: 'AUAG Essential Metals', sebAccountId: 'SEB-001', isin: 'SE0019175563' },
  { fundId: 'FUND002', fundName: 'AuAg Gold Rush', sebAccountId: 'SEB-002', isin: 'SE0020677946' },
  { fundId: 'FUND003', fundName: 'AuAg Precious Green', sebAccountId: 'SEB-003', isin: 'SE0014808440' },
  { fundId: 'FUND004', fundName: 'AuAg Silver Bullet', sebAccountId: 'SEB-004', isin: 'SE0013358181' },
];

// ============================================================================
// SEB API Client
// ============================================================================

export class SEBClient {
  private config: SEBConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private fundMappings: FundAccountMapping[];

  constructor(config?: Partial<SEBConfig>) {
    const useSandbox = config?.useSandbox ?? process.env.SEB_USE_SANDBOX === 'true';
    
    this.config = {
      clientId: config?.clientId || process.env.SEB_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.SEB_CLIENT_SECRET || '',
      baseUrl: config?.baseUrl || process.env.SEB_API_URL || 'https://api.seb.se',
      sandboxUrl: config?.sandboxUrl || 'https://api-sandbox.sebgroup.com',
      useSandbox,
      mtlsCertPath: config?.mtlsCertPath || process.env.SEB_MTLS_CERT_PATH,
      mtlsKeyPath: config?.mtlsKeyPath || process.env.SEB_MTLS_KEY_PATH,
      defaultAccountId: config?.defaultAccountId || process.env.SEB_CUSTODY_ACCOUNT_ID,
    };
    
    this.fundMappings = DEFAULT_FUND_MAPPINGS;
  }

  /**
   * Get the API base URL based on sandbox setting
   */
  private getApiBaseUrl(): string {
    return this.config.useSandbox ? this.config.sandboxUrl : this.config.baseUrl;
  }

  /**
   * Get SEB account ID for a fund
   */
  getAccountIdForFund(fundId: string): string | undefined {
    return this.fundMappings.find(m => m.fundId === fundId)?.sebAccountId;
  }

  /**
   * Get fund mapping
   */
  getFundMapping(fundId: string): FundAccountMapping | undefined {
    return this.fundMappings.find(m => m.fundId === fundId);
  }

  /**
   * Get all fund mappings
   */
  getAllFundMappings(): FundAccountMapping[] {
    return [...this.fundMappings];
  }

  /**
   * Add or update a fund mapping
   */
  setFundMapping(mapping: FundAccountMapping): void {
    const index = this.fundMappings.findIndex(m => m.fundId === mapping.fundId);
    if (index >= 0) {
      this.fundMappings[index] = mapping;
    } else {
      this.fundMappings.push(mapping);
    }
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Hämtar OAuth2 access token från SEB
   * 
   * SEB uses standard OAuth2 client_credentials flow
   * Sandbox: POST https://api-sandbox.sebgroup.com/oauth/token
   * Production: POST https://api.seb.se/oauth/token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('SEB API credentials not configured. Set SEB_CLIENT_ID and SEB_CLIENT_SECRET.');
    }

    const baseUrl = this.getApiBaseUrl();
    console.log(`[SEB] Requesting new access token from ${baseUrl}...`);

    try {
      const response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          // Request scopes for Global Custody APIs
          scope: 'custody:read accounts:read transactions:read',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${errorBody}`);
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
   * 
   * SEB Global Custody API endpoints:
   * - GET /custody/v1/accounts/{accountId}/positions
   * - GET /custody/v1/accounts/{accountId}/cash
   * - GET /custody/v1/accounts/{accountId}
   * - GET /custody/v1/accounts/{accountId}/transactions
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const baseUrl = this.getApiBaseUrl();
    const requestId = crypto.randomUUID();

    console.log(`[SEB] API Request: ${options.method || 'GET'} ${endpoint} (${requestId})`);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Request-ID': requestId,
        'X-Correlation-ID': requestId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SEB] API Error: ${response.status} - ${errorText}`);
      throw new Error(`SEB API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  }

  // ==========================================================================
  // Account Information (Global Custody Cash API)
  // ==========================================================================

  /**
   * Hämtar saldon för alla konton
   * 
   * SEB Global Custody Cash Information API:
   * GET /custody/v1/accounts/{accountId}/cash
   */
  async getAccountBalances(accountIds?: string[]): Promise<SEBAccountBalance[]> {
    console.log('[SEB] Fetching account balances...');
    
    // If specific accounts requested, fetch each one
    // Otherwise use default account or fetch all known accounts
    const accountsToFetch = accountIds?.length 
      ? accountIds 
      : this.config.defaultAccountId 
        ? [this.config.defaultAccountId]
        : this.fundMappings.map(m => m.sebAccountId);
    
    const balances: SEBAccountBalance[] = [];
    
    for (const accountId of accountsToFetch) {
      try {
        const response = await this.apiRequest<{
          accountId: string;
          accountNumber: string;
          accountName: string;
          currency: string;
          cashPositions: Array<{
            currency: string;
            availableBalance: number;
            bookedBalance: number;
            creditLimit?: number;
          }>;
          lastUpdated: string;
        }>(`/custody/v1/accounts/${accountId}/cash`);
        
        // Convert SEB response to our format
        for (const cashPos of response.cashPositions || []) {
          balances.push({
            accountId: response.accountId,
            accountNumber: response.accountNumber,
            accountName: response.accountName,
            currency: cashPos.currency,
            availableBalance: cashPos.availableBalance,
            bookedBalance: cashPos.bookedBalance,
            creditLimit: cashPos.creditLimit,
            lastUpdated: response.lastUpdated,
          });
        }
      } catch (error) {
        console.warn(`[SEB] Failed to fetch balance for account ${accountId}:`, error);
      }
    }
    
    return balances;
  }

  /**
   * Hämtar transaktioner för ett konto
   * 
   * SEB Global Custody Securities Transactions API:
   * GET /custody/v1/accounts/{accountId}/transactions
   */
  async getTransactions(
    accountId: string,
    fromDate: string,
    toDate: string
  ): Promise<SEBTransaction[]> {
    console.log('[SEB] Fetching transactions for account:', accountId);
    
    const response = await this.apiRequest<{ 
      transactions: Array<{
        transactionId: string;
        accountId: string;
        tradeDate: string;
        settlementDate: string;
        transactionType: string;
        amount: number;
        currency: string;
        description: string;
        reference?: string;
        counterparty?: string;
        isin?: string;
      }>;
    }>(`/custody/v1/accounts/${accountId}/transactions?fromDate=${fromDate}&toDate=${toDate}`);
    
    // Convert to our format
    return (response.transactions || []).map(t => ({
      transactionId: t.transactionId,
      accountId: t.accountId,
      date: t.tradeDate,
      valueDate: t.settlementDate,
      type: t.amount >= 0 ? 'CREDIT' as const : 'DEBIT' as const,
      amount: Math.abs(t.amount),
      currency: t.currency,
      description: t.description,
      reference: t.reference,
      counterparty: t.counterparty,
      isin: t.isin,
    }));
  }

  // ==========================================================================
  // Custody Information (Global Custody Positions API)
  // ==========================================================================

  /**
   * Hämtar alla custody-positioner
   * 
   * SEB Global Custody Positions API:
   * GET /custody/v1/accounts/{accountId}/positions
   */
  async getCustodyPositions(accountId?: string): Promise<SEBCustodyPosition[]> {
    console.log('[SEB] Fetching custody positions...');
    
    // Use provided accountId, default, or fetch for all mapped funds
    const accountsToFetch = accountId 
      ? [accountId]
      : this.config.defaultAccountId
        ? [this.config.defaultAccountId]
        : this.fundMappings.map(m => m.sebAccountId);
    
    const allPositions: SEBCustodyPosition[] = [];
    
    for (const accId of accountsToFetch) {
      try {
        const response = await this.apiRequest<{
          accountId: string;
          positions: Array<{
            isin: string;
            instrumentName: string;
            instrumentType: string;
            quantity: number;
            marketPrice: number;
            marketValue: number;
            currency: string;
            priceDate: string;
            custodian: string;
            settlementStatus?: string;
          }>;
        }>(`/custody/v1/accounts/${accId}/positions`);
        
        // Convert to our format
        const positions = (response.positions || []).map(p => ({
          accountId: response.accountId,
          isin: p.isin,
          instrumentName: p.instrumentName,
          instrumentType: this.mapInstrumentType(p.instrumentType),
          quantity: p.quantity,
          marketPrice: p.marketPrice,
          marketValue: p.marketValue,
          currency: p.currency,
          priceDate: p.priceDate,
          custodian: p.custodian || 'SEB',
          settlementStatus: p.settlementStatus === 'PENDING' ? 'PENDING' as const : 'SETTLED' as const,
        }));
        
        allPositions.push(...positions);
      } catch (error) {
        console.warn(`[SEB] Failed to fetch positions for account ${accId}:`, error);
      }
    }
    
    return allPositions;
  }

  /**
   * Map SEB instrument type to our enum
   */
  private mapInstrumentType(type: string): SEBCustodyPosition['instrumentType'] {
    const typeMap: Record<string, SEBCustodyPosition['instrumentType']> = {
      'EQUITY': 'EQUITY',
      'SHARE': 'EQUITY',
      'STOCK': 'EQUITY',
      'BOND': 'BOND',
      'FIXED_INCOME': 'BOND',
      'FUND': 'FUND',
      'MUTUAL_FUND': 'FUND',
      'ETF': 'FUND',
      'DERIVATIVE': 'DERIVATIVE',
      'OPTION': 'DERIVATIVE',
      'FUTURE': 'DERIVATIVE',
    };
    return typeMap[type.toUpperCase()] || 'OTHER';
  }

  /**
   * Hämtar custody-sammanfattning per fond/konto
   */
  async getCustodySummary(accountId: string, date?: string): Promise<SEBCustodyReport> {
    console.log('[SEB] Fetching custody summary for:', accountId);
    
    const [positions, balances] = await Promise.all([
      this.getCustodyPositions(accountId),
      this.getAccountBalances([accountId]),
    ]);
    
    const totalMarketValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
    const cashBalance = balances
      .filter(b => b.accountId === accountId)
      .reduce((sum, b) => sum + b.availableBalance, 0);
    
    // Find fund name from mapping
    const fundMapping = this.fundMappings.find(m => m.sebAccountId === accountId);
    
    return {
      reportDate: date || new Date().toISOString().split('T')[0],
      accountId,
      fundName: fundMapping?.fundName || balances[0]?.accountName || 'Unknown',
      currency: balances[0]?.currency || 'SEK',
      positions,
      cashBalance,
      totalMarketValue: totalMarketValue + cashBalance,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get custody summary for a fund by fund ID
   */
  async getCustodySummaryByFund(fundId: string, date?: string): Promise<SEBCustodyReport | null> {
    const mapping = this.getFundMapping(fundId);
    if (!mapping) {
      console.warn(`[SEB] No SEB account mapping found for fund ${fundId}`);
      return null;
    }
    return this.getCustodySummary(mapping.sebAccountId, date);
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
   * Returnerar realistisk mock-data för AuAg fonder
   */
  
  async getAccountBalances(): Promise<SEBAccountBalance[]> {
    await this.simulateLatency();
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
        accountNumber: '5000-2345678',
        accountName: 'AuAg Gold Rush - Custody',
        currency: 'SEK',
        availableBalance: 24567890.12,
        bookedBalance: 24567890.12,
        lastUpdated: new Date().toISOString(),
      },
      {
        accountId: 'SEB-003',
        accountNumber: '5000-3456789',
        accountName: 'AuAg Precious Green - Custody',
        currency: 'SEK',
        availableBalance: 12345678.90,
        bookedBalance: 12345678.90,
        lastUpdated: new Date().toISOString(),
      },
      {
        accountId: 'SEB-004',
        accountNumber: '5000-4567890',
        accountName: 'AuAg Silver Bullet - Custody',
        currency: 'SEK',
        availableBalance: 87654321.00,
        bookedBalance: 87654321.00,
        lastUpdated: new Date().toISOString(),
      },
    ];
  }

  async getCustodyPositions(accountId?: string): Promise<SEBCustodyPosition[]> {
    await this.simulateLatency();
    
    const allPositions: SEBCustodyPosition[] = [
      // AUAG Essential Metals positions (SEB-001)
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
        accountId: 'SEB-001',
        isin: 'CA6091251046',
        instrumentName: 'MAG Silver Corp',
        instrumentType: 'EQUITY',
        quantity: 35000,
        marketPrice: 125.80,
        marketValue: 4403000,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
      // AuAg Gold Rush positions (SEB-002)
      {
        accountId: 'SEB-002',
        isin: 'CA68827L1013',
        instrumentName: 'OceanaGold Corp',
        instrumentType: 'EQUITY',
        quantity: 80000,
        marketPrice: 45.60,
        marketValue: 3648000,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
      {
        accountId: 'SEB-002',
        isin: 'CA3499151080',
        instrumentName: 'Franco-Nevada Corp',
        instrumentType: 'EQUITY',
        quantity: 15000,
        marketPrice: 1450.00,
        marketValue: 21750000,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
      // AuAg Silver Bullet positions (SEB-004)
      {
        accountId: 'SEB-004',
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
      {
        accountId: 'SEB-004',
        isin: 'CA3518581051',
        instrumentName: 'First Majestic Silver Corp',
        instrumentType: 'EQUITY',
        quantity: 150000,
        marketPrice: 85.20,
        marketValue: 12780000,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
      {
        accountId: 'SEB-004',
        isin: 'MX01KI020004',
        instrumentName: 'Industrias Peñoles',
        instrumentType: 'EQUITY',
        quantity: 45000,
        marketPrice: 320.50,
        marketValue: 14422500,
        currency: 'SEK',
        priceDate: new Date().toISOString().split('T')[0],
        custodian: 'SEB',
        settlementStatus: 'SETTLED',
      },
    ];
    
    // Filter by accountId if provided
    if (accountId) {
      return allPositions.filter(p => p.accountId === accountId);
    }
    
    return allPositions;
  }

  async getTransactions(accountId: string, fromDate: string, toDate: string): Promise<SEBTransaction[]> {
    await this.simulateLatency();
    
    const today = new Date().toISOString().split('T')[0];
    const allTransactions: SEBTransaction[] = [
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
      {
        transactionId: 'TXN-003',
        accountId: 'SEB-002',
        date: today,
        valueDate: today,
        type: 'CREDIT',
        amount: 1200000,
        currency: 'SEK',
        description: 'Subscription - Institutional',
        reference: 'SUB-2026-002',
      },
      {
        transactionId: 'TXN-004',
        accountId: 'SEB-004',
        date: today,
        valueDate: today,
        type: 'DEBIT',
        amount: 850000,
        currency: 'SEK',
        description: 'Redemption',
        reference: 'RED-2026-001',
      },
    ];
    
    return allTransactions.filter(t => t.accountId === accountId);
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
    await this.simulateLatency();
    return {
      connected: true,
      message: 'Mock client - simulated connection (development mode)',
      details: {
        tokenValid: true,
        accountsAccessible: true,
        custodyAccessible: true,
      },
    };
  }

  /**
   * Simulate network latency for realistic behavior
   */
  private async simulateLatency(): Promise<void> {
    const latency = 100 + Math.random() * 200; // 100-300ms
    await new Promise(resolve => setTimeout(resolve, latency));
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
