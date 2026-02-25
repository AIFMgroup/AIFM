/**
 * ISEC SECURA Platform REST API Client
 *
 * Built from the official SECURA OpenAPI 3.0 spec (secura-openapi.json).
 *
 * Base URL pattern: {protocol}://{hostname}:{port}/SecuraV1/
 * Auth: POST /user/login with {USERNAME, PASSWORD} → returns {token}
 * Subsequent requests: header "Authorization: token {TOKEN}"
 *
 * Credentials stored in AWS Secrets Manager.
 * Traffic routes via Site-to-Site IPSec VPN to ISEC network.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const CREDENTIALS_SECRET = 'aifm/isec/api-key';

const ISEC_BASE_URL_TEST = 'http://194.62.154.68:20023/SecuraV1';
const ISEC_BASE_URL_PROD = 'http://194.62.154.72:20023/SecuraV1';

const BASE_URL = process.env.ISEC_API_BASE_URL
  || (process.env.ISEC_ENV === 'prod' ? ISEC_BASE_URL_PROD : ISEC_BASE_URL_TEST);

const secretsClient = new SecretsManagerClient({ region: REGION });

// ---------------------------------------------------------------------------
// Credential + token cache
// ---------------------------------------------------------------------------

interface ISECCredentials {
  username: string;
  password: string;
}

let _cachedCredentials: ISECCredentials | null = null;
let _credentialsCacheExpiry = 0;

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

const CREDENTIALS_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000; // SECURA ISAKMP lifetime: 8 hours
const TOKEN_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

async function getCredentials(): Promise<ISECCredentials> {
  if (_cachedCredentials && Date.now() < _credentialsCacheExpiry) {
    return _cachedCredentials;
  }

  try {
    const result = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: CREDENTIALS_SECRET })
    );
    const parsed = JSON.parse(result.SecretString || '{}');
    const username = parsed.USERNAME || parsed.username || parsed.user || '';
    const password = parsed.PASSWORD || parsed.password || parsed.pass || '';

    if (!username || !password) {
      throw new Error('USERNAME/PASSWORD fields missing from secret');
    }

    _cachedCredentials = { username, password };
    _credentialsCacheExpiry = Date.now() + CREDENTIALS_CACHE_TTL;
    return _cachedCredentials;
  } catch (error) {
    console.error('[SECURA] Failed to retrieve credentials:', error);
    throw new Error('Could not retrieve SECURA credentials from Secrets Manager');
  }
}

async function getAuthToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const creds = await getCredentials();

  try {
    const res = await fetch(`${BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        USERNAME: creds.username,
        PASSWORD: creds.password,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Login failed: HTTP ${res.status} – ${body}`);
    }

    const data = await res.json();
    const token = data.token;

    if (!token) {
      throw new Error('Login response missing "token" field');
    }

    _cachedToken = token;
    _tokenExpiry = Date.now() + TOKEN_LIFETIME_MS - TOKEN_MARGIN_MS;
    console.log(`[SECURA] Authenticated as userId=${data.userid}, isPortfolioUser=${data.isPortfolioUser}, isFundUser=${data.isFundUser}`);
    return _cachedToken!;
  } catch (error) {
    console.error(`[SECURA] Authentication failed against ${BASE_URL}/user/login`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

export interface SecuraRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
  skipAuth?: boolean;
}

export interface SecuraResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function request<T = unknown>(options: SecuraRequestOptions): Promise<SecuraResponse<T>> {
  const { method = 'GET', path, body, params, timeout = 30000, skipAuth } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (!skipAuth) {
    const token = await getAuthToken();
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });

    const contentType = res.headers.get('content-type') || '';
    let data: T;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = (await res.text()) as unknown as T;
    }

    if (!res.ok) {
      console.error(`[SECURA] API error ${res.status} ${method} ${path}:`, data);
      if (res.status === 401) {
        _cachedToken = null;
        _tokenExpiry = 0;
      }
    }

    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
      console.error(`[SECURA] Request timeout: ${method} ${path}`);
      return { ok: false, status: 408, data: { error: 'Request timeout' } as unknown as T };
    }
    console.error(`[SECURA] Request failed: ${method} ${path}`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Type definitions — mapped from SECURA OpenAPI schemas
// ---------------------------------------------------------------------------

export interface SecuraFund {
  FundId: number;
  Active: boolean;
  ExternalAccess: boolean;
  Name: string;
  CurrencyCode: string;
  buyFeePercentage: number;
  sellFeePercentage: number;
  minimumStartAmount: number;
  minimumBuyAmount: number;
  NAVFrequency: string; // 'D', 'M', 'A'
  ISIN: string;
  BankGiro: string;
  FixedFeePercentage: number;
  PerformanceFeePercentage: number;
  LatestNAVRate: number | string;
  LatestNAVDate: string;
  MarketPlaceId: number | string;
  CutOffTime: string;
  CutOffTimeHalfDay: string;
  InstituteNumber: string;
  fundPortfolioId: number;
  IsMainFund: boolean;
  MainFundID: number;
  lastYearsTER: number;
  preliminaryNav?: {
    preliminaryNavRate: number;
    preliminaryNavDate: string;
    preliminaryAssetsValued: number;
  } | null;
  groupBelongings?: Array<{ portfolioGroupTypeId: number; groupTypeName: string; portfolioGroupId: number; groupName: string }>;
  [key: string]: unknown;
}

export interface SecuraHistoricalNavRate {
  FundId: number;
  fund: string; // Fonda fund code
  date: string;
  navRate: number;
}

export interface SecuraNavDetails {
  instrumentId: number;
  portfolioId: number;
  currencyId: number;
  isShareClass: boolean;
  NAV: number;
  outstandingUnits: number;
  totalNAV: number;
  shareClassFX: number;
  shareClassShareOfFund: number;
  feeCurrencyID: number;
  accruedFixedFee: number;
  accruedPerformanceFee: number;
  dividendPerUnit: number;
  totalDividend: number;
  subscription: number;
  subscriptionUnits: number;
  redemption: number;
  redemptionUnits: number;
  compensationUnits: number;
  adminFeePct: number;
  aumBeforeFees: number;
  adminFee: number;
  perfFee: number;
  [key: string]: unknown;
}

export interface SecuraNAVRunItem {
  NAVRunId: number;
  NAVGroupId: number;
  NAVDateTime: string;
  isLockedPrices: boolean;
  isLockedNAV: boolean;
  isSimulated: boolean;
}

export interface SecuraNAVPriceInstrument {
  instrumentId: number;
  price: number;
  priceTime: string;
  navRunId: number;
  priceSource: string;
  navInstrumentPriceId: number;
  navDate: string;
}

export interface SecuraNAVPriceCurrency {
  currencyId: number;
  price: number;
  priceTime: string;
  navRunId: number;
  priceSource: string;
  navCurrencyPriceId: number;
}

export interface SecuraPosition {
  positionType: string;
  designation: string;
  positionId: number;
  subId: number;
  currency: string;
  currencyId: number;
  quantity: number;
  localMarketValue: number;
  marketValue: number;
  totalLocalMarketValue: number;
  totalMarketValue: number;
  localPrice: number;
  localPriceDate: string;
  currencyPrice: number;
  price: number;
  yieldToMaturity: number;
  turnover: number;
  commission: number;
  localPurchasePrice: number;
  purchasePrice: number;
  localUnrealizedProfitLoss: number;
  unrealizedProfitLoss: number;
  averagePrice: number;
  localAveragePrice: number;
  realizedProfitLoss: number;
  localRealizedProfitLoss: number;
  accruedInterest: number;
  localAccruedInterest: number;
  shareOfPortfolio: number;
  shareOfGroup: number;
  isPreliminary: boolean;
  hasOrders: boolean;
  isGroup: boolean;
  [key: string]: unknown;
}

export interface SecuraPortfolio {
  portfolioName: string;
  portfolioId: number;
  portfolioType: string;
  firstName: string;
  lastName: string;
  accountNumber: string;
  nationalIdentificationNumber: string;
  portfolioCurrency: string;
  portfolioCurrencyId: number;
  assetManager: string;
  assetManagerId: number;
  isFundPortfolio: boolean;
  isMainFundPortfolio: boolean;
  isShareClassFundPortfolio: boolean;
  mainFundPortfolioId: number;
  performanceStartDate: string;
  lei: string;
  [key: string]: unknown;
}

export interface SecuraCashFlow {
  description: string;
  tradedate: string;
  settlementdate: string;
  preliminary: boolean;
  amount: number;
  localamount: number;
  marketvalue: number;
  currencyaccountid: number;
  balance: number;
  transactiontype: string;
  id: number;
}

export interface SecuraCurrencyAccount {
  currencyaccountid: number;
  portfolioid: number;
  name: string;
  accountnumber: string;
  currencyid: number;
  iban: string;
  iscollateralaccount: boolean;
  issuerid: number;
}

export interface SecuraFee {
  portfolioid: number;
  portfolioFeeId: string;
  value: number;
  type: string; // e.g. 'pftPercentOfNAV_AVG'
  isPeriodBased: boolean;
  minimumFee: number;
  maximumFee: number;
  hasMaximumFee: boolean;
  frequency: string;
  startDate: string;
  stopDate: string;
  [key: string]: unknown;
}

export interface SecuraTransaction {
  transactionId: number;
  portfolioId: number;
  instrumentId: number;
  instrumentName: string;
  transDate: string;
  settleDate: string;
  currencyAccountId: number;
  currencyId: number;
  currency: string;
  amount: number;
  localAmount: number;
  quantity: number;
  isCancelled: boolean;
  isPreliminary: boolean;
  typeName: string;
  [key: string]: unknown;
}

export interface SecuraFundCustomer {
  customerId: number;
  customerNumber: string;
  name: string;
  customerType: string;
  active: boolean;
  country: string;
  email: string;
  kyccomplete: boolean;
  riskclass: number;
  [key: string]: unknown;
}

export interface SecuraFundCustomerTransaction {
  fundTransactionId: number;
  fundid: number;
  transactionDate: string;
  settlementDate: string;
  transactionType: string;
  quantity: number;
  amount: number;
  mainFundAmount: number;
  fee: number;
  price: number;
  isOrder: boolean;
  isCancelled: boolean;
  customerID: number;
  [key: string]: unknown;
}

export interface SecuraHistoricalPrice {
  date: string;
  price: number;
}

export interface SecuraPerformanceItem {
  date: string;
  nav: number;
  partialPerformance: number;
  accumulatedPerformance: number;
  partialBenchmark: number;
  accumulatedBenchmark: number;
  marketValueInOut: number;
}

export interface SecuraFundPositionMarketValue {
  date: string;
  fundValueItems: Array<{
    fundId: number;
    quantity: number;
    LocalMarketValue: number;
    MarketValue: number;
    NavRate: number;
    FXRate: number;
    TradeDay: boolean;
    Priced: boolean;
    CustomerID: number;
  }>;
  sumMarketValue: number;
}

export interface SecuraSwingPricing {
  fundId: number;
  navDate: string;
  navRateAfterSwing: number;
  navRateBeforeSwing: number;
  lastNavDate: string;
  swingFactor: number;
}

// ---------------------------------------------------------------------------
// Public client — all endpoints mapped to real SECURA paths
// ---------------------------------------------------------------------------

export const securaClient = {

  // ── Session ──

  async testConnection(): Promise<{ connected: boolean; status: number; message: string; env: string }> {
    const env = process.env.ISEC_ENV === 'prod' ? 'PROD' : 'TEST';
    try {
      const token = await getAuthToken();
      if (!token) {
        return { connected: false, status: 401, message: 'Autentisering misslyckades', env };
      }
      const res = await request<SecuraFund[]>({ path: '/fund/list', params: { fundid: 0 }, timeout: 10000 });
      if (res.ok) {
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return { connected: true, status: res.status, message: `Ansluten till SECURA (${env}), ${count} fonder`, env };
      }
      return { connected: false, status: res.status, message: `SECURA svarade med status ${res.status}`, env };
    } catch (error) {
      return { connected: false, status: 0, message: error instanceof Error ? error.message : 'Okänt fel', env };
    }
  },

  // ── Fund accounting static data ──

  async getFunds(fundId?: number): Promise<SecuraResponse<SecuraFund[]>> {
    return request<SecuraFund[]>({
      path: '/fund/list',
      params: { fundid: fundId ?? 0, includeGroupBelongings: false },
    });
  },

  async getFund(fundId: number): Promise<SecuraResponse<SecuraFund[]>> {
    return request<SecuraFund[]>({
      path: '/fund/list',
      params: { fundid: fundId },
    });
  },

  async getHistoricalNavRates(params: {
    fundId?: number;
    fromDate?: string;
    toDate?: string;
    getNAVRateBeforeSwing?: boolean;
  }): Promise<SecuraResponse<SecuraHistoricalNavRate[]>> {
    return request<SecuraHistoricalNavRate[]>({
      path: '/fund/historicalNavRate',
      params: {
        fundId: params.fundId ?? -1,
        fromDate: params.fromDate,
        toDate: params.toDate,
        getNAVRateBeforeSwing: params.getNAVRateBeforeSwing,
      },
    });
  },

  async getNavInformation(portfolioId: number, date: string): Promise<SecuraResponse<SecuraNavDetails[]>> {
    return request<SecuraNavDetails[]>({
      path: '/fund/navinformation',
      params: { portfolioID: portfolioId, date },
    });
  },

  async getSwingPricing(params: {
    fundIds?: number[];
    fromDate: string;
    toDate: string;
  }): Promise<SecuraResponse<SecuraSwingPricing[]>> {
    return request<SecuraSwingPricing[]>({
      path: '/fund/swingPricingInformation',
      params: {
        fundIds: params.fundIds?.join(','),
        fromDate: params.fromDate,
        toDate: params.toDate,
      } as unknown as Record<string, string>,
    });
  },

  // ── Fund accounting unit ledger ──

  async getFundPositions(params?: {
    stopDate?: string;
    customerId?: number;
  }): Promise<SecuraResponse<SecuraFund[]>> {
    return request<SecuraFund[]>({
      path: '/fundposition/list',
      params: {
        stopDate: params?.stopDate,
        customerid: params?.customerId,
      },
    });
  },

  async getFundPositionMarketValues(params: {
    fromDate?: string;
    toDate?: string;
    customerId?: number;
    fundId?: number;
    topPositions?: boolean;
    topNPositions?: number;
  }): Promise<SecuraResponse<SecuraFundPositionMarketValue[]>> {
    return request<SecuraFundPositionMarketValue[]>({
      path: '/fundposition/marketvalueList',
      params: {
        fromDate: params.fromDate,
        toDate: params.toDate,
        customerid: params.customerId,
        fundid: params.fundId ?? 0,
        topPositions: params.topPositions ?? false,
        topNPositions: params.topNPositions ?? 0,
      },
    });
  },

  // ── Fund customers (shareholders) ──

  async getFundCustomers(params?: {
    customerId?: number;
    excludeClosed?: boolean;
  }): Promise<SecuraResponse<SecuraFundCustomer[]>> {
    return request<SecuraFundCustomer[]>({
      path: '/fundcustomer/list',
      params: {
        customerid: params?.customerId,
        excludeClosedCustomers: params?.excludeClosed ?? true,
      },
    });
  },

  async getFundCustomerInfo(customerId: number): Promise<SecuraResponse<SecuraFundCustomer>> {
    return request<SecuraFundCustomer>({
      path: '/fundcustomer/information',
      params: { customerid: customerId },
    });
  },

  async getFundCustomerTransactions(params: {
    customerId?: number;
    fundId?: number;
    fromDate?: string;
    toDate?: string;
    includeOrderTransactions?: boolean;
    includeCancelled?: boolean;
  }): Promise<SecuraResponse<SecuraFundCustomerTransaction[]>> {
    return request<SecuraFundCustomerTransaction[]>({
      path: '/fundcustomer/transactionlist',
      params: {
        customerid: params.customerId ?? 0,
        FundId: params.fundId,
        fromdate: params.fromDate,
        todate: params.toDate,
        includeordertransactions: params.includeOrderTransactions ?? false,
        includecancelled: params.includeCancelled ?? false,
      },
    });
  },

  // ── NAV runs and prices ──

  async getNavRuns(params?: {
    navGroupId?: number;
    navDateTime?: string;
    navRunType?: 'NRTReal' | 'NRTSimulated' | 'NRTUndefined';
  }): Promise<SecuraResponse<SecuraNAVRunItem[]>> {
    return request<SecuraNAVRunItem[]>({
      path: '/fundnavrun/list',
      params: {
        NAVGroupId: params?.navGroupId,
        NAVDateTime: params?.navDateTime,
        NAVRunType: params?.navRunType,
      },
    });
  },

  async getNavRunDetails(id: number): Promise<SecuraResponse<SecuraNAVRunItem>> {
    return request<SecuraNAVRunItem>({
      path: '/fundnavrun/details',
      params: { id },
    });
  },

  async getNavPricesInstrument(params: {
    navRunIds?: number[];
    instrumentId?: number;
    portfolioId?: number;
    date?: string;
  }): Promise<SecuraResponse<SecuraNAVPriceInstrument[]>> {
    return request<SecuraNAVPriceInstrument[]>({
      path: '/fundnavprices/instrument',
      params: {
        NAVrunIds: params.navRunIds?.join(','),
        InstrumentId: params.instrumentId,
        PortfolioId: params.portfolioId,
        Date: params.date,
      } as unknown as Record<string, string>,
    });
  },

  async getNavPricesCurrency(params: {
    navRunIds?: number[];
    portfolioId?: number;
    date?: string;
  }): Promise<SecuraResponse<SecuraNAVPriceCurrency[]>> {
    return request<SecuraNAVPriceCurrency[]>({
      path: '/fundnavprices/currency',
      params: {
        NAVrunIds: params.navRunIds?.join(','),
        PortfolioId: params.portfolioId,
        Date: params.date,
      } as unknown as Record<string, string>,
    });
  },

  // ── Portfolio data ──

  async getPortfolios(): Promise<SecuraResponse<SecuraPortfolio[]>> {
    return request<SecuraPortfolio[]>({ path: '/portfolio/list' });
  },

  async getPortfolioDetails(id: number): Promise<SecuraResponse<SecuraPortfolio>> {
    return request<SecuraPortfolio>({
      path: '/portfolio/details',
      params: { id },
    });
  },

  async getPositions(params: {
    portfolioIds: number[];
    toDate?: string;
    fromDate?: string;
    positionTypes?: string[];
    groupType?: string;
    useNAVPrices?: boolean;
  }): Promise<SecuraResponse<SecuraPosition[]>> {
    return request<SecuraPosition[]>({
      path: '/position/list',
      params: {
        portfolioids: params.portfolioIds.join(','),
        ToDate: params.toDate,
        FromDate: params.fromDate,
        PositionTypes: params.positionTypes?.join(','),
        grouptype: params.groupType,
        useNAVPrices: params.useNAVPrices,
      } as unknown as Record<string, string>,
    });
  },

  async getCashFlows(params: {
    portfolioIds: number[];
    fromDate: string;
    toDate: string;
  }): Promise<SecuraResponse<SecuraCashFlow[]>> {
    return request<SecuraCashFlow[]>({
      path: '/portfolio/cashflowlist',
      params: {
        portfolioids: params.portfolioIds.join(','),
        fromdate: params.fromDate,
        todate: params.toDate,
      } as unknown as Record<string, string>,
    });
  },

  async getCurrencyAccounts(portfolioIds: number[]): Promise<SecuraResponse<SecuraCurrencyAccount[]>> {
    return request<SecuraCurrencyAccount[]>({
      path: '/portfolio/currencyaccountlist',
      params: {
        portfolioids: portfolioIds.join(','),
      } as unknown as Record<string, string>,
    });
  },

  async getFees(portfolioIds: number[]): Promise<SecuraResponse<SecuraFee[]>> {
    return request<SecuraFee[]>({
      path: '/portfolio/feelist',
      params: {
        portfolioids: portfolioIds.join(','),
      } as unknown as Record<string, string>,
    });
  },

  async getTransactions(params: {
    portfolioIds: number[];
    fromDate?: string;
    toDate?: string;
  }): Promise<SecuraResponse<SecuraTransaction[]>> {
    return request<SecuraTransaction[]>({
      path: '/portfolio/transactionlist',
      params: {
        portfolioids: params.portfolioIds.join(','),
        fromdate: params.fromDate,
        todate: params.toDate,
      } as unknown as Record<string, string>,
    });
  },

  // ── Historical prices ──

  async getHistoricalCurrencyPrices(params: {
    currencyId: number;
    historyTypeId: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<SecuraResponse<SecuraHistoricalPrice[]>> {
    return request<SecuraHistoricalPrice[]>({
      path: '/historicalprices/currency',
      params: {
        currencyid: params.currencyId,
        historytypeid: params.historyTypeId,
        fromdate: params.fromDate,
        todate: params.toDate,
      },
    });
  },

  async getHistoricalInstrumentPrices(params: {
    instrumentId: number;
    historyTypeId: number;
    fromDate?: string;
    toDate?: string;
  }): Promise<SecuraResponse<SecuraHistoricalPrice[]>> {
    return request<SecuraHistoricalPrice[]>({
      path: '/historicalprices/instrument',
      params: {
        instrumentid: params.instrumentId,
        historytypeid: params.historyTypeId,
        fromdate: params.fromDate,
        todate: params.toDate,
      },
    });
  },

  // ── Performance ──

  async getPerformance(params: {
    portfolioIds: number[];
    fromDate?: string;
    toDate?: string;
    performanceType?: string;
  }): Promise<SecuraResponse<SecuraPerformanceItem[]>> {
    return request<SecuraPerformanceItem[]>({
      path: '/performance/list',
      params: {
        portfolioIds: params.portfolioIds.join(','),
        fromDate: params.fromDate,
        toDate: params.toDate,
        performanceType: params.performanceType,
      } as unknown as Record<string, string>,
    });
  },

  // ── Raw request for any endpoint ──

  async raw<T = unknown>(options: SecuraRequestOptions): Promise<SecuraResponse<T>> {
    return request<T>(options);
  },
};

// Re-export for backwards compatibility during migration
export const isecClient = securaClient;
export type ISECResponse<T = unknown> = SecuraResponse<T>;
