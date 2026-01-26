/**
 * Fortnox API Client
 * 
 * Hanterar alla API-anrop till Fortnox med automatisk token-refresh.
 */

import { FORTNOX_CONFIG, FORTNOX_ENDPOINTS } from './config';
import { fortnoxTokenStore, FortnoxTokens } from './tokenStore';
import { safeLog } from '../logging';

interface FortnoxApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface VoucherRow {
  Account: number;
  Debit?: number;
  Credit?: number;
  Description?: string;
  CostCenter?: string;
  Project?: string;
}

interface CreateVoucherRequest {
  VoucherSeries: string;
  TransactionDate: string;
  Description: string;
  VoucherRows: VoucherRow[];
}

interface SupplierInvoiceRow {
  Account: number;
  Debit: number;
  Credit?: number;
  CostCenter?: string;
}

interface CreateSupplierInvoiceRequest {
  SupplierNumber: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Total: number;
  VAT: number;
  Currency?: string;
  YourReference?: string;
  Credit?: boolean;
  Comments?: string;
  ExternalInvoiceReference1?: string;
  ExternalInvoiceReference2?: string;
  SupplierInvoiceRows: SupplierInvoiceRow[];
}

export class FortnoxClient {
  private companyId: string;
  private tokens: FortnoxTokens | null = null;
  private isDryRun = process.env.FORTNOX_DRY_RUN === 'true';

  constructor(companyId: string) {
    this.companyId = companyId;
  }

  /**
   * Initiera klienten med tokens
   */
  async init(): Promise<boolean> {
    this.tokens = await fortnoxTokenStore.getTokens(this.companyId);
    
    if (!this.tokens) {
      safeLog('info', `[FortnoxClient] No tokens for company ${this.companyId}`);
      return false;
    }

    // Check if token needs refresh
    if (this.isTokenExpired()) {
      await this.refreshToken();
    }

    return true;
  }

  /**
   * Kolla om token har gått ut
   */
  private isTokenExpired(): boolean {
    if (!this.tokens) return true;
    
    const expiresAt = new Date(this.tokens.expiresAt);
    const now = new Date();
    
    // Refresh 5 minutes before expiry
    return expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;
  }

  /**
   * Förnya access token
   */
  private async refreshToken(): Promise<void> {
    if (!this.tokens) throw new Error('No tokens to refresh');

    safeLog('info', `[FortnoxClient] Refreshing token for company ${this.companyId}`);

    // Fortnox refresh_token är single-use => skydda mot samtidiga refreshar
    const gotLock = await fortnoxTokenStore.acquireRefreshLock(this.companyId, 30);
    if (!gotLock) {
      // Någon annan request refreshar just nu; vänta kort och läs tokens igen
      await new Promise(r => setTimeout(r, 750));
      const latest = await fortnoxTokenStore.getTokens(this.companyId);
      if (latest) {
        this.tokens = latest;
        return;
      }
      throw new Error('Failed to refresh Fortnox token (lock held and no tokens found)');
    }

    try {
      const response = await fetch(FORTNOX_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${FORTNOX_CONFIG.clientId}:${FORTNOX_CONFIG.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.tokens.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FortnoxClient] Token refresh failed:', errorText);

        // Fortnox kan svara invalid_grant om refresh token är förbrukad/återkallad
        const lower = errorText.toLowerCase();
        if (lower.includes('invalid_grant') || lower.includes('invalid') || response.status === 400 || response.status === 401) {
          await fortnoxTokenStore.markRevoked(this.companyId, 'Fortnox-anslutningen är inte längre giltig. Koppla om Fortnox.');
        } else {
          await fortnoxTokenStore.setError(this.companyId, 'Token refresh failed');
        }
        throw new Error('Failed to refresh Fortnox token');
      }

      const data: {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
      } = await response.json();
      
      const newTokens: FortnoxTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.tokens.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        scope: data.scope,
      };

      await fortnoxTokenStore.updateTokens(this.companyId, newTokens);
      this.tokens = newTokens;
      
      safeLog('info', `[FortnoxClient] Token refreshed for company ${this.companyId}`);
    } finally {
      await fortnoxTokenStore.releaseRefreshLock(this.companyId);
    }
  }

  /**
   * Gör API-anrop till Fortnox
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<FortnoxApiResponse<T>> {
    if (!this.tokens) {
      return { success: false, error: 'Not authenticated' };
    }

    // Dry Run protection for write operations
    if (this.isDryRun && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
      safeLog('warn', `[FortnoxClient][DRY-RUN] Intercepted ${method} request to ${endpoint}`, { body });
      
      // Simulate successful response for common creation endpoints
      if (endpoint.includes('/vouchers')) {
        return { success: true, data: { Voucher: { VoucherNumber: 9999, VoucherSeries: 'DRY' } } as any };
      }
      if (endpoint.includes('/supplierinvoices')) {
        return { success: true, data: { SupplierInvoice: { GivenNumber: 'DRY-123', InvoiceNumber: 'DRY-123' } } as any };
      }
      if (endpoint.includes('/suppliers') && method.toUpperCase() === 'POST') {
        return { success: true, data: { Supplier: { SupplierNumber: 'DRY-SUPP' } } as any };
      }
      
      return { success: true, data: {} as T };
    }

    const maxAttempts = 4;
    const baseDelayMs = 400;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${FORTNOX_CONFIG.apiBaseUrl}${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${this.tokens.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status === 401) {
          // Token expired, try refresh once then retry
          await this.refreshToken();
          continue;
        }

        // Rate limiting / transient errors
        if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
          const retryAfter = response.headers.get('retry-after');
          const delay =
            retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 5000) :
            Math.min(baseDelayMs * Math.pow(2, attempt - 1), 5000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[FortnoxClient] API error: ${response.status}`, errorText);
          return { success: false, error: `Fortnox API error: ${response.status}` };
        }

        const data = await response.json();
        await fortnoxTokenStore.updateLastSync(this.companyId);

        return { success: true, data };
      } catch (error) {
        // Network / transient error: retry
        if (attempt < maxAttempts) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 5000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        console.error('[FortnoxClient] Request error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return { success: false, error: 'Fortnox request failed after retries' };
  }

  // ============ API Methods ============

  /**
   * Hämta bolagsinformation
   */
  async getCompanyInfo(): Promise<FortnoxApiResponse<{
    CompanyName: string;
    OrganizationNumber: string;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.companyInfo);
  }

  /**
   * Hämta alla leverantörer
   */
  async getSuppliers(): Promise<FortnoxApiResponse<{
    Suppliers: Array<{
      SupplierNumber: string;
      Name: string;
      OrganisationNumber?: string;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.suppliers);
  }

  /**
   * Hämta alla konton
   */
  async getAccounts(): Promise<FortnoxApiResponse<{
    Accounts: Array<{
      Number: number;
      Description: string;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.accounts);
  }

  /**
   * Hämta kostnadsställen
   */
  async getCostCenters(): Promise<FortnoxApiResponse<{
    CostCenters: Array<{
      Code: string;
      Description: string;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.costCenters);
  }

  /**
   * Hämta projekt
   */
  async getProjects(): Promise<FortnoxApiResponse<{
    Projects: Array<{
      ProjectNumber: string;
      Description: string;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.projects);
  }

  /**
   * Hämta verifikationsserier
   */
  async getVoucherSeries(): Promise<FortnoxApiResponse<{
    VoucherSeries: Array<{
      Code: string;
      Description: string;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.voucherSeries);
  }

  /**
   * Hämta räkenskapsår
   */
  async getFinancialYears(): Promise<FortnoxApiResponse<{
    FinancialYears: Array<{
      Id?: number;
      FromDate: string;
      ToDate: string;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.financialYears);
  }

  /**
   * Hämta artiklar (för konteringsmallar/kategorisering)
   */
  async getArticles(): Promise<FortnoxApiResponse<{
    Articles: Array<{
      ArticleNumber: string;
      Description: string;
      SalesAccount?: number;
      PurchaseAccount?: number;
    }>;
  }>> {
    return this.request('GET', FORTNOX_ENDPOINTS.articles);
  }

  /**
   * Skapa en verifikation (kvitto/representation)
   */
  async createVoucher(voucher: CreateVoucherRequest): Promise<FortnoxApiResponse<{
    Voucher: {
      VoucherNumber: number;
      VoucherSeries: string;
    };
  }>> {
    return this.request('POST', FORTNOX_ENDPOINTS.vouchers, { Voucher: voucher });
  }

  /**
   * Skapa en leverantörsfaktura
   */
  async createSupplierInvoice(invoice: CreateSupplierInvoiceRequest): Promise<FortnoxApiResponse<{
    SupplierInvoice: {
      GivenNumber: string;
      InvoiceNumber: string;
    };
  }>> {
    return this.request('POST', FORTNOX_ENDPOINTS.supplierInvoices, { SupplierInvoice: invoice });
  }

  /**
   * Hämta leverantörsfakturor
   */
  async getSupplierInvoices(filter?: {
    fromDate?: string;
    toDate?: string;
    filter?: 'unbooked' | 'cancelled' | 'fullypaid' | 'unpaid';
  }): Promise<FortnoxApiResponse<{
    SupplierInvoices: Array<{
      GivenNumber: string;
      DocumentNumber: string;
      SupplierNumber: string;
      SupplierName: string;
      InvoiceNumber: string;
      InvoiceDate: string;
      DueDate: string;
      Total: number;
      VAT: number;
      Currency: string;
      Booked: boolean;
      Cancelled: boolean;
      Credit: boolean;
      Balance: number;
    }>;
  }>> {
    const params = new URLSearchParams();
    if (filter?.fromDate) params.append('fromdate', filter.fromDate);
    if (filter?.toDate) params.append('todate', filter.toDate);
    if (filter?.filter) params.append('filter', filter.filter);
    
    const queryString = params.toString();
    const endpoint = queryString 
      ? `${FORTNOX_ENDPOINTS.supplierInvoices}?${queryString}` 
      : FORTNOX_ENDPOINTS.supplierInvoices;
    
    return this.request('GET', endpoint);
  }

  /**
   * Hämta en specifik leverantörsfaktura (GivenNumber)
   */
  async getSupplierInvoice(givenNumber: string): Promise<FortnoxApiResponse<{
    SupplierInvoice: {
      GivenNumber: string;
      SupplierNumber: string;
      SupplierName?: string;
      InvoiceNumber: string;
      InvoiceDate: string;
      DueDate: string;
      Total: number;
      VAT: number;
      Currency: string;
      Booked: boolean;
      Cancelled: boolean;
      Credit: boolean;
      Balance: number;
      // Additional fields exist in Fortnox; we only type what we use
    };
  }>> {
    const endpoint = `${FORTNOX_ENDPOINTS.supplierInvoices}/${encodeURIComponent(givenNumber)}`;
    return this.request('GET', endpoint);
  }

  /**
   * Hitta eller skapa leverantör
   */
  async findOrCreateSupplier(name: string, orgNumber?: string): Promise<FortnoxApiResponse<{
    SupplierNumber: string;
  }>> {
    // Sök efter befintlig leverantör
    const searchResult = await this.request<{
      Suppliers: Array<{ SupplierNumber: string; Name: string }>;
    }>('GET', `${FORTNOX_ENDPOINTS.suppliers}?name=${encodeURIComponent(name)}`);

    if (searchResult.success && searchResult.data?.Suppliers?.length) {
      return {
        success: true,
        data: { SupplierNumber: searchResult.data.Suppliers[0].SupplierNumber }
      };
    }

    // Skapa ny leverantör
    const createResult = await this.request<{
      Supplier: { SupplierNumber: string };
    }>('POST', FORTNOX_ENDPOINTS.suppliers, {
      Supplier: {
        Name: name,
        OrganisationNumber: orgNumber,
      }
    });

    if (createResult.success && createResult.data) {
      return {
        success: true,
        data: { SupplierNumber: createResult.data.Supplier.SupplierNumber }
      };
    }

    return { success: false, error: 'Failed to find or create supplier' };
  }
}

/**
 * Skapa en Fortnox-klient för ett bolag
 */
export async function getFortnoxClient(companyId: string): Promise<FortnoxClient | null> {
  const client = new FortnoxClient(companyId);
  const initialized = await client.init();
  
  if (!initialized) {
    return null;
  }
  
  return client;
}



