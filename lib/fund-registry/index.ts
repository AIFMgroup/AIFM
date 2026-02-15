/**
 * Fund Registry Module
 *
 * Modern fondregister som ersätter externa system
 */

export { FundRegistry, getFundRegistry } from './fund-registry';
export { DynamoDBStorage } from './dynamo-storage';
export type { StorageAdapter } from './storage-types';

export type {
  // Core entities
  Fund,
  ShareClass,
  NAVRecord,
  Position,
  CashBalance,
  Transaction,
  Investor,
  Holding,
  
  // Enums
  Currency,
  FundStatus,
  FundType,
  ShareClassStatus,
  NAVSource,
  NAVStatus,
  InstrumentType,
  DataSource,
  TransactionType,
  TransactionStatus,
  InvestorType,
  KYCStatus,
  
  // API types
  PaginatedResponse,
  APIResponse,
  
  // Report types
  NAVReport,
  HoldingsReport,
  TransactionReport,
} from './types';
