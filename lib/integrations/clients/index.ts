/**
 * Integration Clients Index
 * 
 * Re-exports all integration clients for convenient imports.
 */

// Fortnox
export { FortnoxClient, createFortnoxClient } from './fortnox';
export type {
  FortnoxCompanyInfo,
  FortnoxVoucher,
  FortnoxVoucherRow,
  FortnoxSupplierInvoice,
  FortnoxSupplier,
  FortnoxAccount,
  FortnoxInvoice,
  FortnoxInvoiceRow,
} from './fortnox';

// Microsoft
export { MicrosoftClient, createMicrosoftClient } from './microsoft';
export type {
  MicrosoftUser,
  MicrosoftEmail,
  MicrosoftCalendarEvent,
  MicrosoftDriveItem,
  MicrosoftContact,
} from './microsoft';

// Scrive
export { ScriveClient, createScriveClient, sendForSigning } from './scrive';
export type {
  ScriveDocument,
  ScriveDocumentListItem,
  ScriveSignatory,
  ScriveDocumentStatus,
  ScriveSignatoryStatus,
  ScriveAuthenticationMethod,
  ScriveDeliveryMethod,
  ScriveCreateDocumentParams,
} from './scrive';

