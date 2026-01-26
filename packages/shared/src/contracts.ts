/**
 * Data Contracts - Zod schemas for type-safe validation
 * Used across ETL, AI workers, and API boundaries
 */
import { z } from "zod";

// ============================================================================
// LEDGER & TRANSACTIONS
// ============================================================================

export const LedgerEntryZ = z.object({
  clientId: z.string().cuid(),
  source: z.enum([
    "FORTNOX",
    "ALLVUE",
    "BANK",
    "SKV",
    "FI",
    "SIGMA",
    "MANUAL",
  ]),
  bookingDate: z.string().datetime(),
  account: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),
  description: z.string().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

export type LedgerEntry = z.infer<typeof LedgerEntryZ>;

export const BankTransactionZ = z.object({
  iban: z.string(),
  date: z.string().datetime(),
  amount: z.number(),
  currency: z.string().length(3),
  description: z.string(),
  counterpartyIban: z.string().optional(),
  counterpartyName: z.string().optional(),
  reference: z.string().optional(),
});

export type BankTransaction = z.infer<typeof BankTransactionZ>;

// ============================================================================
// RECONCILIATION
// ============================================================================

export const ReconciliationMatchZ = z.object({
  bankTxId: z.string(),
  ledgerEntryId: z.string(),
  confidence: z.number().min(0).max(1),
  matchedOn: z.enum(["amount", "date", "description", "fuzzy"]),
  tolerance: z.number().optional(),
});

export type ReconciliationMatch = z.infer<typeof ReconciliationMatchZ>;

export const ReconciliationDeltaZ = z.object({
  id: z.string(),
  type: z.enum(["unmatched_bank", "unmatched_ledger", "amount_mismatch"]),
  severity: z.enum(["error", "warning", "info"]),
  amount: z.number(),
  date: z.string().datetime(),
  description: z.string(),
  context: z.record(z.string(), z.any()).optional(),
});

export type ReconciliationDelta = z.infer<typeof ReconciliationDeltaZ>;

export const ReconciliationResultZ = z.object({
  clientId: z.string().cuid(),
  period: z.string().datetime(),
  matched: z.array(ReconciliationMatchZ),
  deltas: z.array(ReconciliationDeltaZ),
  matchRate: z.number().min(0).max(1),
  totalBank: z.number(),
  totalLedger: z.number(),
  variance: z.number(),
});

export type ReconciliationResult = z.infer<typeof ReconciliationResultZ>;

// ============================================================================
// REPORTS & DRAFTING
// ============================================================================

export const MetricsZ = z.object({
  nav: z.number().optional(),
  inflow: z.number().optional(),
  outflow: z.number().optional(),
  pnl: z.number().optional(),
  feesCharged: z.number().optional(),
  returnPercent: z.number().optional(),
  top5Positions: z
    .array(z.object({ name: z.string(), value: z.number(), weight: z.number() }))
    .optional(),
});

export type Metrics = z.infer<typeof MetricsZ>;

export const ReportDraftZ = z.object({
  clientId: z.string().cuid(),
  type: z.enum([
    "FUND_ACCOUNTING",
    "INVESTOR_REPORT",
    "FINANCIAL",
    "REGULATORY",
  ]),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  text: z.string(),
  html: z.string().optional(),
  metrics: MetricsZ.optional(),
  sections: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
        highlights: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

export type ReportDraft = z.infer<typeof ReportDraftZ>;

// ============================================================================
// DATA QUALITY CHECKS
// ============================================================================

export const QCCheckZ = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  context: z.record(z.string(), z.any()).optional(),
  timestamp: z.string().datetime(),
});

export type QCCheck = z.infer<typeof QCCheckZ>;

export const DataQualityResultZ = z.object({
  clientId: z.string().cuid(),
  period: z.string().datetime(),
  source: z.enum([
    "FORTNOX",
    "ALLVUE",
    "BANK",
    "SKV",
    "FI",
    "SIGMA",
    "MANUAL",
  ]),
  checks: z.array(QCCheckZ),
  summary: z.object({
    totalChecks: z.number(),
    passedChecks: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
  }),
  taskId: z.string().cuid().optional(),
});

export type DataQualityResult = z.infer<typeof DataQualityResultZ>;

// ============================================================================
// KYC & COMPLIANCE
// ============================================================================

export const KYCCheckResultZ = z.object({
  investorId: z.string().cuid(),
  pepStatus: z.enum(["clear", "flagged", "pending_review"]),
  sanctionStatus: z.enum(["clear", "flagged", "pending_review"]),
  riskLevel: z.enum(["low", "medium", "high"]),
  uboTree: z
    .array(
      z.object({
        name: z.string(),
        ownershipPercent: z.number(),
        pepStatus: z.string().optional(),
      })
    )
    .optional(),
  timestamp: z.string().datetime(),
});

export type KYCCheckResult = z.infer<typeof KYCCheckResultZ>;

// ============================================================================
// RISK ENGINE
// ============================================================================

export const RiskMetricsZ = z.object({
  var95: z.number().optional(),
  concentration: z
    .array(
      z.object({
        position: z.string(),
        weight: z.number(),
      })
    )
    .optional(),
  limitBreaches: z
    .array(
      z.object({
        limit: z.string(),
        threshold: z.number(),
        current: z.number(),
        breached: z.boolean(),
      })
    )
    .optional(),
  stressScenarios: z
    .array(
      z.object({
        name: z.string(),
        impact: z.number(),
      })
    )
    .optional(),
});

export type RiskMetrics = z.infer<typeof RiskMetricsZ>;

// ============================================================================
// JOB PAYLOADS
// ============================================================================

export const ETLJobPayloadZ = z.object({
  clientId: z.string().cuid(),
  source: z.enum([
    "FORTNOX",
    "ALLVUE",
    "BANK",
    "SKV",
    "FI",
    "SIGMA",
    "MANUAL",
  ]),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  configJson: z.record(z.string(), z.any()).optional(),
});

export type ETLJobPayload = z.infer<typeof ETLJobPayloadZ>;

export const AIJobPayloadZ = z.object({
  clientId: z.string().cuid(),
  task: z.enum([
    "reconciliation",
    "report_draft",
    "data_quality",
    "kyc_check",
    "risk_calc",
    "compliance_eval",
  ]),
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  artifacts: z
    .object({
      ledgerCsv: z.string().optional(),
      bankCsv: z.string().optional(),
      positionsCsv: z.string().optional(),
    })
    .optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export type AIJobPayload = z.infer<typeof AIJobPayloadZ>;

// ============================================================================
// API REQUESTS/RESPONSES
// ============================================================================

export const CreateClientReqZ = z.object({
  name: z.string().min(1),
  orgNo: z.string(),
  tier: z.enum(["XL", "LARGE"]),
});

export type CreateClientReq = z.infer<typeof CreateClientReqZ>;

export const UpsertDataFeedReqZ = z.object({
  clientId: z.string().cuid(),
  source: z.enum([
    "FORTNOX",
    "ALLVUE",
    "BANK",
    "SKV",
    "FI",
    "SIGMA",
    "MANUAL",
  ]),
  configJson: z.record(z.string(), z.any()),
});

export type UpsertDataFeedReq = z.infer<typeof UpsertDataFeedReqZ>;
