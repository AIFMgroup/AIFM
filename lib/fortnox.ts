/**
 * Fortnox API Integration
 * 
 * This module provides integration with Fortnox accounting software.
 * Tokens are managed securely via fortnoxTokenService.
 */

import { getFortnoxTokens, refreshFortnoxTokensIfNeeded } from './accounting/fortnoxTokenService';

// ============================================================================
// TYPES
// ============================================================================

export interface FortnoxConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  companyId?: string;
}

export interface FortnoxVoucher {
  VoucherNumber?: number;
  VoucherSeries: string;
  TransactionDate: string;
  Description: string;
  VoucherRows: FortnoxVoucherRow[];
}

export interface FortnoxVoucherRow {
  Account: number;
  Debit?: number;
  Credit?: number;
  Description?: string;
  Project?: string;
  CostCenter?: string;
}

export interface FortnoxInvoice {
  CustomerNumber: string;
  InvoiceDate: string;
  DueDate: string;
  InvoiceRows: FortnoxInvoiceRow[];
  Currency?: string;
  YourReference?: string;
  OurReference?: string;
}

export interface FortnoxInvoiceRow {
  ArticleNumber?: string;
  Description: string;
  AccountNumber: number;
  DeliveredQuantity: number;
  Price: number;
  VAT?: number;
}

export interface FortnoxSupplierInvoice {
  SupplierNumber: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Total: number;
  VAT: number;
  Currency: string;
  SupplierInvoiceRows: FortnoxSupplierInvoiceRow[];
}

export interface FortnoxSupplierInvoiceRow {
  Account: number;
  Debit: number;
  Credit?: number;
}

export interface FortnoxAccount {
  Number: number;
  Description: string;
  Active: boolean;
  BalanceBroughtForward?: number;
  CostCenter?: string;
  Project?: string;
  SRU?: number;
  Year?: number;
}

export interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  OrganisationNumber?: string;
  Email?: string;
  Address1?: string;
  City?: string;
  ZipCode?: string;
  Country?: string;
  Phone?: string;
}

export interface FortnoxSupplier {
  SupplierNumber: string;
  Name: string;
  OrganisationNumber?: string;
  Email?: string;
  Address1?: string;
  City?: string;
  ZipCode?: string;
  Country?: string;
  Phone?: string;
  BankAccountNumber?: string;
  BG?: string;
  PG?: string;
}

export interface FortnoxAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// BAS ACCOUNT MAPPING
// Swedish BAS Chart of Accounts mapping to Fortnox
// ============================================================================

export const BAS_ACCOUNT_MAPPING = {
  // Tillgångar (Assets)
  '1220': { number: 1220, name: 'Inventarier och verktyg', type: 'ASSET' },
  '1510': { number: 1510, name: 'Kundfordringar', type: 'ASSET' },
  '1910': { number: 1910, name: 'Kassa', type: 'ASSET' },
  '1920': { number: 1920, name: 'PlusGiro', type: 'ASSET' },
  '1930': { number: 1930, name: 'Företagskonto/checkkonto', type: 'ASSET' },
  '1940': { number: 1940, name: 'Övriga bankkonton', type: 'ASSET' },
  
  // Skulder (Liabilities)
  '2440': { number: 2440, name: 'Leverantörsskulder', type: 'LIABILITY' },
  '2510': { number: 2510, name: 'Skatteskulder', type: 'LIABILITY' },
  '2610': { number: 2610, name: 'Utgående moms 25%', type: 'LIABILITY' },
  '2620': { number: 2620, name: 'Utgående moms 12%', type: 'LIABILITY' },
  '2630': { number: 2630, name: 'Utgående moms 6%', type: 'LIABILITY' },
  '2640': { number: 2640, name: 'Ingående moms', type: 'LIABILITY' },
  '2650': { number: 2650, name: 'Redovisningskonto för moms', type: 'LIABILITY' },
  '2710': { number: 2710, name: 'Personalens källskatt', type: 'LIABILITY' },
  '2730': { number: 2730, name: 'Avräkning sociala avgifter', type: 'LIABILITY' },
  
  // Intäkter (Revenue)
  '3010': { number: 3010, name: 'Försäljning varor 25%', type: 'REVENUE' },
  '3040': { number: 3040, name: 'Försäljning tjänster 25%', type: 'REVENUE' },
  '3041': { number: 3041, name: 'Försäljning tjänster inom Sverige', type: 'REVENUE' },
  '3305': { number: 3305, name: 'Försäljning EU 25%', type: 'REVENUE' },
  
  // Inköp (Purchases)
  '4010': { number: 4010, name: 'Inköp varor Sverige', type: 'EXPENSE' },
  '4531': { number: 4531, name: 'Import varor EU', type: 'EXPENSE' },
  '4545': { number: 4545, name: 'Import tjänster EU', type: 'EXPENSE' },
  
  // Övriga kostnader (Expenses)
  '5010': { number: 5010, name: 'Lokalhyra', type: 'EXPENSE' },
  '5020': { number: 5020, name: 'El för lokaler', type: 'EXPENSE' },
  '5090': { number: 5090, name: 'Övriga lokalkostnader', type: 'EXPENSE' },
  '5410': { number: 5410, name: 'Förbrukningsinventarier', type: 'EXPENSE' },
  '5460': { number: 5460, name: 'Förbrukningsmaterial', type: 'EXPENSE' },
  '5610': { number: 5610, name: 'Frakter och transporter', type: 'EXPENSE' },
  '5800': { number: 5800, name: 'Resekostnader', type: 'EXPENSE' },
  '5930': { number: 5930, name: 'Reklamkostnader', type: 'EXPENSE' },
  '6110': { number: 6110, name: 'Kontorsmaterial', type: 'EXPENSE' },
  '6211': { number: 6211, name: 'Telefon', type: 'EXPENSE' },
  '6212': { number: 6212, name: 'Mobiltelefon', type: 'EXPENSE' },
  '6230': { number: 6230, name: 'Datakommunikation', type: 'EXPENSE' },
  '6310': { number: 6310, name: 'Företagsförsäkringar', type: 'EXPENSE' },
  '6410': { number: 6410, name: 'Styrelsearvoden', type: 'EXPENSE' },
  '6420': { number: 6420, name: 'Revisorsarvoden', type: 'EXPENSE' },
  '6530': { number: 6530, name: 'Redovisningstjänster', type: 'EXPENSE' },
  '6540': { number: 6540, name: 'IT-tjänster', type: 'EXPENSE' },
  '6550': { number: 6550, name: 'Konsultarvoden', type: 'EXPENSE' },
  '6570': { number: 6570, name: 'Bankkostnader', type: 'EXPENSE' },
  
  // Personal (Personnel)
  '7010': { number: 7010, name: 'Löner till kollektivanställda', type: 'EXPENSE' },
  '7210': { number: 7210, name: 'Löner till tjänstemän', type: 'EXPENSE' },
  '7220': { number: 7220, name: 'Löner till företagsledare', type: 'EXPENSE' },
  '7510': { number: 7510, name: 'Arbetsgivaravgifter', type: 'EXPENSE' },
  '7533': { number: 7533, name: 'Särskild löneskatt', type: 'EXPENSE' },
  '7570': { number: 7570, name: 'Premier för arbetsmarknadsförsäkringar', type: 'EXPENSE' },
  
  // Avskrivningar (Depreciation)
  '7830': { number: 7830, name: 'Avskrivningar maskiner och inventarier', type: 'EXPENSE' },
  
  // Finansiella poster (Financial)
  '8310': { number: 8310, name: 'Ränteintäkter', type: 'REVENUE' },
  '8410': { number: 8410, name: 'Räntekostnader', type: 'EXPENSE' },
  
  // Skatt (Tax)
  '8910': { number: 8910, name: 'Skatt på årets resultat', type: 'EXPENSE' },
};

// ============================================================================
// VAT CODES
// ============================================================================

export const VAT_CODES = {
  'SE25': { rate: 25, description: 'Svensk moms 25%', account: 2610 },
  'SE12': { rate: 12, description: 'Svensk moms 12%', account: 2620 },
  'SE6': { rate: 6, description: 'Svensk moms 6%', account: 2630 },
  'SE0': { rate: 0, description: 'Momsfritt', account: null },
  'EU25': { rate: 25, description: 'EU-inköp 25%', account: 2614 },
  'EXPORT': { rate: 0, description: 'Export', account: null },
};

// ============================================================================
// FORTNOX API CLIENT
// ============================================================================

class FortnoxClient {
  private config: FortnoxConfig | null = null;
  private baseUrl = 'https://api.fortnox.se/3';
  private useMock = process.env.FORTNOX_USE_MOCK === 'true'; // Set to true for dev/testing

  /**
   * Initialize the Fortnox client with credentials
   */
  initialize(config: FortnoxConfig): void {
    this.config = config;
    console.log('[Fortnox] Client initialized for company:', config.companyId);
  }

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.accessToken;
  }

  /**
   * Get fresh access token (with auto-refresh if needed)
   */
  private async getAccessToken(companyId: string): Promise<string | null> {
    if (this.useMock) {
      return 'mock-token';
    }

    const tokens = await refreshFortnoxTokensIfNeeded(companyId, {
      clientId: process.env.FORTNOX_CLIENT_ID!,
      clientSecret: process.env.FORTNOX_CLIENT_SECRET!,
      companyId,
    });

    if (!tokens) {
      console.error('[Fortnox] No valid tokens available for company:', companyId);
      return null;
    }

    return tokens.accessToken;
  }

  /**
   * Make API request to Fortnox
   */
  private async request<T>(
    companyId: string,
    method: string,
    endpoint: string,
    body?: any
  ): Promise<FortnoxAPIResponse<T>> {
    if (this.useMock) {
      // Return mock responses for development
      console.log('[Fortnox] Mock request:', method, endpoint, body);
      return { success: true, data: {} as T };
    }

    const accessToken = await this.getAccessToken(companyId);
    if (!accessToken) {
      return {
        success: false,
        error: 'Fortnox not connected or token expired',
        errorCode: 'NO_TOKEN',
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Secret': process.env.FORTNOX_CLIENT_SECRET!,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Fortnox] API error:', response.status, errorText);
        return {
          success: false,
          error: `Fortnox API error: ${response.status} ${errorText}`,
          errorCode: `HTTP_${response.status}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('[Fortnox] Request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Create a voucher (verifikation) in Fortnox
   */
  async createVoucher(voucher: FortnoxVoucher, companyId: string): Promise<FortnoxAPIResponse<{ VoucherNumber: number }>> {
    console.log('[Fortnox] Creating voucher:', voucher);
    
    // Validate voucher
    const totalDebit = voucher.VoucherRows.reduce((sum, row) => sum + (row.Debit || 0), 0);
    const totalCredit = voucher.VoucherRows.reduce((sum, row) => sum + (row.Credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `Voucher is not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
        errorCode: 'UNBALANCED_VOUCHER',
      };
    }

    // Mock response in dev mode
    if (this.useMock) {
      return {
        success: true,
        data: {
          VoucherNumber: Math.floor(Math.random() * 10000) + 1,
        },
      };
    }

    return this.request(companyId, 'POST', '/vouchers', { Voucher: voucher });
  }

  /**
   * Create a customer invoice in Fortnox
   */
  async createInvoice(invoice: FortnoxInvoice, companyId: string): Promise<FortnoxAPIResponse<{ InvoiceNumber: string }>> {
    console.log('[Fortnox] Creating invoice:', invoice);
    
    if (this.useMock) {
      return {
        success: true,
        data: {
          InvoiceNumber: `F${new Date().getFullYear()}${Math.floor(Math.random() * 10000)}`,
        },
      };
    }

    return this.request(companyId, 'POST', '/invoices', { Invoice: invoice });
  }

  /**
   * Register a supplier invoice in Fortnox
   */
  async createSupplierInvoice(invoice: FortnoxSupplierInvoice, companyId: string): Promise<FortnoxAPIResponse<{ GivenNumber: number }>> {
    console.log('[Fortnox] Registering supplier invoice:', invoice);
    
    if (this.useMock) {
      return {
        success: true,
        data: {
          GivenNumber: Math.floor(Math.random() * 10000) + 1,
        },
      };
    }

    return this.request(companyId, 'POST', '/supplierinvoices', { SupplierInvoice: invoice });
  }

  /**
   * Get account information
   */
  async getAccount(accountNumber: number, companyId: string): Promise<FortnoxAPIResponse<FortnoxAccount>> {
    const mapping = BAS_ACCOUNT_MAPPING[accountNumber.toString() as keyof typeof BAS_ACCOUNT_MAPPING];
    
    if (!mapping) {
      return {
        success: false,
        error: `Account ${accountNumber} not found`,
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }

    if (this.useMock) {
      return {
        success: true,
        data: {
          Number: mapping.number,
          Description: mapping.name,
          Active: true,
        },
      };
    }

    return this.request(companyId, 'GET', `/accounts/${accountNumber}`, undefined);
  }

  /**
   * Get or create a customer
   */
  async getOrCreateCustomer(customer: Partial<FortnoxCustomer>, companyId: string): Promise<FortnoxAPIResponse<FortnoxCustomer>> {
    console.log('[Fortnox] Getting/creating customer:', customer.Name);
    
    if (this.useMock) {
      return {
        success: true,
        data: {
          CustomerNumber: `C${Math.floor(Math.random() * 10000)}`,
          Name: customer.Name || 'Unknown',
          OrganisationNumber: customer.OrganisationNumber,
          Email: customer.Email,
          Address1: customer.Address1,
          City: customer.City,
          ZipCode: customer.ZipCode,
          Country: customer.Country || 'SE',
        },
      };
    }

    return this.request(companyId, 'POST', '/customers', { Customer: customer });
  }

  /**
   * Get or create a supplier
   */
  async getOrCreateSupplier(supplier: Partial<FortnoxSupplier>, companyId: string): Promise<FortnoxAPIResponse<FortnoxSupplier>> {
    console.log('[Fortnox] Getting/creating supplier:', supplier.Name);
    
    if (this.useMock) {
      return {
        success: true,
        data: {
          SupplierNumber: `S${Math.floor(Math.random() * 10000)}`,
          Name: supplier.Name || 'Unknown',
          OrganisationNumber: supplier.OrganisationNumber,
          Email: supplier.Email,
          Address1: supplier.Address1,
          City: supplier.City,
          ZipCode: supplier.ZipCode,
          Country: supplier.Country || 'SE',
        },
      };
    }

    return this.request(companyId, 'POST', '/suppliers', { Supplier: supplier });
  }

  /**
   * Sync bank transactions (reconciliation)
   */
  async syncBankTransactions(accountNumber: number, fromDate: string, toDate: string, companyId: string): Promise<FortnoxAPIResponse<{ transactionCount: number }>> {
    console.log(`[Fortnox] Syncing bank transactions for account ${accountNumber} from ${fromDate} to ${toDate}`);
    
    if (this.useMock) {
      return {
        success: true,
        data: {
          transactionCount: Math.floor(Math.random() * 50) + 5,
        },
      };
    }

    // Fortnox doesn't have direct bank sync API - this would integrate with bank APIs separately
    return { success: true, data: { transactionCount: 0 } };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert a booking entry to a Fortnox voucher
 */
export function bookingEntryToFortnoxVoucher(
  entry: {
    date: Date;
    description: string;
    entries: Array<{ account: string; debit: number; credit: number; }>;
  },
  voucherSeries: string = 'A'
): FortnoxVoucher {
  return {
    VoucherSeries: voucherSeries,
    TransactionDate: entry.date.toISOString().split('T')[0],
    Description: entry.description,
    VoucherRows: entry.entries.map(e => ({
      Account: parseInt(e.account),
      Debit: e.debit > 0 ? e.debit : undefined,
      Credit: e.credit > 0 ? e.credit : undefined,
    })),
  };
}

/**
 * Get the appropriate VAT account for a transaction
 */
export function getVATAccount(vatRate: number, isIncoming: boolean): number {
  if (vatRate === 25) return isIncoming ? 2640 : 2610;
  if (vatRate === 12) return isIncoming ? 2640 : 2620;
  if (vatRate === 6) return isIncoming ? 2640 : 2630;
  return 0; // No VAT
}

/**
 * Calculate VAT from a gross amount
 */
export function calculateVAT(grossAmount: number, vatRate: number): { net: number; vat: number } {
  const vatMultiplier = vatRate / 100;
  const net = grossAmount / (1 + vatMultiplier);
  const vat = grossAmount - net;
  return { net: Math.round(net * 100) / 100, vat: Math.round(vat * 100) / 100 };
}

/**
 * Suggest account based on description/category
 */
export function suggestAccount(category: string, type: 'INCOME' | 'EXPENSE'): number {
  const categoryMap: Record<string, number> = {
    'IT & Software': 6540,
    'IT-tjänster': 6540,
    'Kontorsmaterial': 6110,
    'Lokalkostnader': 5010,
    'Lokalhyra': 5010,
    'Telefon': 6211,
    'Konsulttjänster': 6550,
    'Revision': 6420,
    'Juridik': 6550,
    'Bank': 6570,
    'Försäkring': 6310,
    'Frakt': 5610,
    'Resa': 5800,
    'Reklam': 5930,
    'Varuinköp': 4010,
    'Löner': 7210,
    'Försäljning': type === 'INCOME' ? 3040 : 4010,
  };

  // Check for partial matches
  for (const [key, account] of Object.entries(categoryMap)) {
    if (category.toLowerCase().includes(key.toLowerCase())) {
      return account;
    }
  }

  // Default accounts
  return type === 'INCOME' ? 3040 : 6990; // 6990 = Övriga externa kostnader
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const fortnoxClient = new FortnoxClient();

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default fortnoxClient;

