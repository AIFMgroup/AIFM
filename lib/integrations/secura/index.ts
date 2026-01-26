/**
 * Secura Integration Module
 * 
 * Centraliserad export för Secura-integration
 */

// Client
export { 
  SecuraClient, 
  getSecuraClient,
  SecuraAPIError,
} from './client';

export type {
  SecuraAuthResponse,
  SecuraFund,
  SecuraNAVData,
  SecuraTransaction,
  SecuraHolding,
  SecuraReport,
} from './client';

// NAV Automation
export {
  NAVAutomationService,
  getNAVAutomationService,
} from './nav-automation';

export type {
  NAVReportConfig,
  NotorConfig,
  SubRedConfig,
  PriceDataConfig,
  OwnerDataConfig,
  AutomationResult,
} from './nav-automation';

// NAV Approval
export {
  navApprovalService,
} from './nav-approval';

export type {
  FundNAV,
  NAVApprovalRequest,
  NAVApprovalVote,
  NAVApprovalConfig,
} from './nav-approval';

// Scheduler
export {
  navScheduler,
  DEFAULT_NAV_SCHEDULE,
} from './scheduler';

export type {
  ScheduledJob,
  SchedulerConfig,
} from './scheduler';

// Report Generator
export {
  generateCSV,
  generateExcelXML,
  generateNotorReport,
  generatePriceDataReport,
  generateOwnerDataReport,
  createCSVBlob,
  createExcelBlob,
  downloadReport,
} from './report-generator';

export type {
  ReportColumn,
  ReportData,
  NotorEntry,
  PriceDataEntry,
  OwnerDataEntry,
} from './report-generator';

// Email Service
export {
  NAVEmailService,
  getNAVEmailService,
} from './emailService';

// Excel Generator
export {
  generateNotorExcel,
  generatePriceDataExcel,
  generateOwnerDataExcel,
  generateSubRedExcel,
  bufferToBlob,
} from './excel-generator';
