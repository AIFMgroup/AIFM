/**
 * Bank Integrations
 * 
 * Centraliserad export för alla bank-integrationer:
 * - Swedbank PDF-processor (Textract + Bedrock)
 * - SEB API-klient
 * - Reconciliation Engine
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
