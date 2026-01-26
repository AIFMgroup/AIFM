/**
 * Fortnox Integration Client
 * 
 * Client for interacting with Fortnox API for accounting, invoicing, and suppliers.
 */

import { BaseIntegrationClient, registerClient } from '../baseClient';
import type { IntegrationApiResponse } from '../types';

// ============================================================================
// Fortnox-Specific Types
// ============================================================================

export interface FortnoxCompanyInfo {
  CompanyName: string;
  OrganizationNumber: string;
  Address: string;
  ZipCode: string;
  City: string;
  Country: string;
  Email: string;
  Phone: string;
  Fax: string;
  VisitAddress: string;
  VisitZipCode: string;
  VisitCity: string;
  VisitCountry: string;
  DatabaseNumber: string;
}

export interface FortnoxVoucher {
  VoucherSeries: string;
  VoucherNumber: number;
  Year: number;
  Description: string;
  TransactionDate: string;
  VoucherRows: FortnoxVoucherRow[];
}

export interface FortnoxVoucherRow {
  Account: number;
  Debit: number;
  Credit: number;
  Description?: string;
  CostCenter?: string;
  Project?: string;
}

export interface FortnoxSupplierInvoice {
  GivenNumber: string;
  SupplierNumber: string;
  SupplierName: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Currency: string;
  Total: number;
  VAT: number;
  Balance: number;
  Cancelled: boolean;
  Booked: boolean;
}

export interface FortnoxSupplier {
  SupplierNumber: string;
  Name: string;
  OrganisationNumber: string;
  Address1: string;
  Address2: string;
  ZipCode: string;
  City: string;
  Country: string;
  Email: string;
  Phone1: string;
  BankAccountNumber: string;
  BG: string;
  PG: string;
}

export interface FortnoxAccount {
  Number: number;
  Description: string;
  Active: boolean;
  BalanceBroughtForward: number;
  BalanceCarriedForward: number;
  CostCenter: string;
  CostCenterSettings: string;
  Project: string;
  ProjectSettings: string;
  SRU: number;
  Year: number;
  VATCode: string;
}

export interface FortnoxInvoice {
  DocumentNumber: string;
  CustomerNumber: string;
  CustomerName: string;
  InvoiceDate: string;
  DueDate: string;
  Currency: string;
  Total: number;
  TotalVAT: number;
  Balance: number;
  Cancelled: boolean;
  Booked: boolean;
  Sent: boolean;
  InvoiceRows: FortnoxInvoiceRow[];
}

export interface FortnoxInvoiceRow {
  ArticleNumber: string;
  Description: string;
  DeliveredQuantity: number;
  Unit: string;
  Price: number;
  Discount: number;
  Total: number;
  VAT: number;
  AccountNumber: number;
}

// ============================================================================
// Fortnox Client
// ============================================================================

export class FortnoxClient extends BaseIntegrationClient {
  constructor(companyId: string) {
    super('fortnox', companyId);
  }

  // ============================================================================
  // Company Info
  // ============================================================================

  async getCompanyInfo(): Promise<IntegrationApiResponse<{ CompanyInformation: FortnoxCompanyInfo }>> {
    return this.get('/companyinformation');
  }

  // ============================================================================
  // Vouchers (Verifikationer)
  // ============================================================================

  async createVoucher(voucher: Partial<FortnoxVoucher>): Promise<IntegrationApiResponse<{ Voucher: FortnoxVoucher }>> {
    return this.post('/vouchers', { Voucher: voucher });
  }

  async getVoucher(series: string, number: number): Promise<IntegrationApiResponse<{ Voucher: FortnoxVoucher }>> {
    return this.get(`/vouchers/${series}/${number}`);
  }

  async listVouchers(params?: {
    financialyear?: number;
    fromdate?: string;
    todate?: string;
  }): Promise<IntegrationApiResponse<{ Vouchers: FortnoxVoucher[] }>> {
    return this.get('/vouchers', { params: params as Record<string, string> });
  }

  // ============================================================================
  // Supplier Invoices (Leverantörsfakturor)
  // ============================================================================

  async createSupplierInvoice(
    invoice: Partial<FortnoxSupplierInvoice> & { SupplierInvoiceRows: unknown[] }
  ): Promise<IntegrationApiResponse<{ SupplierInvoice: FortnoxSupplierInvoice }>> {
    return this.post('/supplierinvoices', { SupplierInvoice: invoice });
  }

  async getSupplierInvoice(givenNumber: string): Promise<IntegrationApiResponse<{ SupplierInvoice: FortnoxSupplierInvoice }>> {
    return this.get(`/supplierinvoices/${givenNumber}`);
  }

  async listSupplierInvoices(params?: {
    filter?: 'cancelled' | 'fullypaid' | 'unpaid' | 'unpaidoverdue' | 'unbooked';
    fromdate?: string;
    todate?: string;
  }): Promise<IntegrationApiResponse<{ SupplierInvoices: FortnoxSupplierInvoice[] }>> {
    return this.get('/supplierinvoices', { params: params as Record<string, string> });
  }

  async bookSupplierInvoice(givenNumber: string): Promise<IntegrationApiResponse<{ SupplierInvoice: FortnoxSupplierInvoice }>> {
    return this.put(`/supplierinvoices/${givenNumber}/bookkeep`);
  }

  // ============================================================================
  // Suppliers (Leverantörer)
  // ============================================================================

  async createSupplier(supplier: Partial<FortnoxSupplier>): Promise<IntegrationApiResponse<{ Supplier: FortnoxSupplier }>> {
    return this.post('/suppliers', { Supplier: supplier });
  }

  async getSupplier(supplierNumber: string): Promise<IntegrationApiResponse<{ Supplier: FortnoxSupplier }>> {
    return this.get(`/suppliers/${supplierNumber}`);
  }

  async listSuppliers(): Promise<IntegrationApiResponse<{ Suppliers: FortnoxSupplier[] }>> {
    return this.get('/suppliers');
  }

  async updateSupplier(supplierNumber: string, supplier: Partial<FortnoxSupplier>): Promise<IntegrationApiResponse<{ Supplier: FortnoxSupplier }>> {
    return this.put(`/suppliers/${supplierNumber}`, { Supplier: supplier });
  }

  // ============================================================================
  // Accounts (Konton)
  // ============================================================================

  async getAccount(accountNumber: number): Promise<IntegrationApiResponse<{ Account: FortnoxAccount }>> {
    return this.get(`/accounts/${accountNumber}`);
  }

  async listAccounts(year?: number): Promise<IntegrationApiResponse<{ Accounts: FortnoxAccount[] }>> {
    const params = year ? { financialyear: String(year) } : undefined;
    return this.get('/accounts', { params });
  }

  // ============================================================================
  // Invoices (Kundfakturor)
  // ============================================================================

  async createInvoice(invoice: Partial<FortnoxInvoice>): Promise<IntegrationApiResponse<{ Invoice: FortnoxInvoice }>> {
    return this.post('/invoices', { Invoice: invoice });
  }

  async getInvoice(documentNumber: string): Promise<IntegrationApiResponse<{ Invoice: FortnoxInvoice }>> {
    return this.get(`/invoices/${documentNumber}`);
  }

  async listInvoices(params?: {
    filter?: 'cancelled' | 'fullypaid' | 'unpaid' | 'unpaidoverdue' | 'unbooked';
    fromdate?: string;
    todate?: string;
  }): Promise<IntegrationApiResponse<{ Invoices: FortnoxInvoice[] }>> {
    return this.get('/invoices', { params: params as Record<string, string> });
  }

  async sendInvoice(documentNumber: string): Promise<IntegrationApiResponse<{ Invoice: FortnoxInvoice }>> {
    return this.get(`/invoices/${documentNumber}/email`);
  }

  // ============================================================================
  // Financial Year
  // ============================================================================

  async listFinancialYears(): Promise<IntegrationApiResponse<{ FinancialYears: Array<{ Id: number; FromDate: string; ToDate: string }> }>> {
    return this.get('/financialyears');
  }

  // ============================================================================
  // Cost Centers
  // ============================================================================

  async listCostCenters(): Promise<IntegrationApiResponse<{ CostCenters: Array<{ Code: string; Description: string; Active: boolean }> }>> {
    return this.get('/costcenters');
  }

  // ============================================================================
  // Projects
  // ============================================================================

  async listProjects(): Promise<IntegrationApiResponse<{ Projects: Array<{ ProjectNumber: string; Description: string; Status: string }> }>> {
    return this.get('/projects');
  }
}

// Register the client
registerClient('fortnox', FortnoxClient);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create and initialize a Fortnox client
 */
export async function createFortnoxClient(companyId: string): Promise<FortnoxClient> {
  const client = new FortnoxClient(companyId);
  await client.init();
  return client;
}

