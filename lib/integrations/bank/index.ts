/**
 * Bank Integrations
 * 
 * Centraliserad export för alla bank-integrationer:
 * - Swedbank PDF-processor (Textract + Bedrock)
 * - SEB API-klient (Global Custody API)
 * - Reconciliation Engine
 * 
 * Documentation: See README.md in this directory
 */

// ============================================================================
// Swedbank PDF Processor
// ============================================================================

export {
  processSwedBankPDF,
  extractTextFromPDF,
  structureDataWithLLM,
  generateSwedBankExcel,
  saveProcessedReport,
} from './swedbank-pdf-processor';

export type {
  SwedBankCustodyReport,
  SwedBankPosition,
  SwedBankTransaction,
  ProcessingResult,
} from './swedbank-pdf-processor';

// ============================================================================
// SEB API Client
// ============================================================================

export {
  SEBClient,
  SEBMockClient,
  getSEBClient,
  resetSEBClient,
} from './seb-client';

export type {
  SEBConfig,
  SEBAccountBalance,
  SEBCustodyPosition,
  SEBTransaction,
  SEBCustodyReport,
  FundAccountMapping,
} from './seb-client';

// ============================================================================
// Reconciliation Engine
// ============================================================================

export {
  ReconciliationEngine,
  getReconciliationEngine,
} from './reconciliation-engine';

export type {
  ReconciliationConfig,
  PositionComparison,
  CashComparison,
  ReconciliationResult,
} from './reconciliation-engine';

// ============================================================================
// Storage Service
// ============================================================================

export {
  BankStorageService,
  getBankStorageService,
  resetBankStorageService,
} from './storage-service';

export type {
  DataCategory,
  StoredDocument,
  StorageListOptions,
  StorageSaveOptions,
} from './storage-service';

// ============================================================================
// Constants
// ============================================================================

/** Supported bank integrations */
export const SUPPORTED_BANKS = ['SEB', 'SWEDBANK'] as const;
export type SupportedBank = typeof SUPPORTED_BANKS[number];

/** API endpoint base paths */
export const BANK_API_PATHS = {
  SEB: {
    positions: '/api/bank/seb/positions',
    balances: '/api/bank/seb/balances',
    transactions: '/api/bank/seb/transactions',
    testConnection: '/api/bank/seb/test-connection',
    custodySummary: '/api/bank/seb/custody-summary',
  },
  SWEDBANK: {
    processPdf: '/api/bank/swedbank/process-pdf',
    emailWebhook: '/api/bank/swedbank/email-webhook',
  },
  reconciliation: '/api/bank/reconciliation',
} as const;
