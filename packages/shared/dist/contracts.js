"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpsertDataFeedReqZ = exports.CreateClientReqZ = exports.AIJobPayloadZ = exports.ETLJobPayloadZ = exports.RiskMetricsZ = exports.KYCCheckResultZ = exports.DataQualityResultZ = exports.QCCheckZ = exports.ReportDraftZ = exports.MetricsZ = exports.ReconciliationResultZ = exports.ReconciliationDeltaZ = exports.ReconciliationMatchZ = exports.BankTransactionZ = exports.LedgerEntryZ = void 0;
/**
 * Data Contracts - Zod schemas for type-safe validation
 * Used across ETL, AI workers, and API boundaries
 */
const zod_1 = require("zod");
// ============================================================================
// LEDGER & TRANSACTIONS
// ============================================================================
exports.LedgerEntryZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    source: zod_1.z.enum([
        "FORTNOX",
        "ALLVUE",
        "BANK",
        "SKV",
        "FI",
        "SIGMA",
        "MANUAL",
    ]),
    bookingDate: zod_1.z.string().datetime(),
    account: zod_1.z.string().min(1),
    amount: zod_1.z.number(),
    currency: zod_1.z.string().length(3),
    description: zod_1.z.string().optional(),
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.BankTransactionZ = zod_1.z.object({
    iban: zod_1.z.string(),
    date: zod_1.z.string().datetime(),
    amount: zod_1.z.number(),
    currency: zod_1.z.string().length(3),
    description: zod_1.z.string(),
    counterpartyIban: zod_1.z.string().optional(),
    counterpartyName: zod_1.z.string().optional(),
    reference: zod_1.z.string().optional(),
});
// ============================================================================
// RECONCILIATION
// ============================================================================
exports.ReconciliationMatchZ = zod_1.z.object({
    bankTxId: zod_1.z.string(),
    ledgerEntryId: zod_1.z.string(),
    confidence: zod_1.z.number().min(0).max(1),
    matchedOn: zod_1.z.enum(["amount", "date", "description", "fuzzy"]),
    tolerance: zod_1.z.number().optional(),
});
exports.ReconciliationDeltaZ = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(["unmatched_bank", "unmatched_ledger", "amount_mismatch"]),
    severity: zod_1.z.enum(["error", "warning", "info"]),
    amount: zod_1.z.number(),
    date: zod_1.z.string().datetime(),
    description: zod_1.z.string(),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.ReconciliationResultZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    period: zod_1.z.string().datetime(),
    matched: zod_1.z.array(exports.ReconciliationMatchZ),
    deltas: zod_1.z.array(exports.ReconciliationDeltaZ),
    matchRate: zod_1.z.number().min(0).max(1),
    totalBank: zod_1.z.number(),
    totalLedger: zod_1.z.number(),
    variance: zod_1.z.number(),
});
// ============================================================================
// REPORTS & DRAFTING
// ============================================================================
exports.MetricsZ = zod_1.z.object({
    nav: zod_1.z.number().optional(),
    inflow: zod_1.z.number().optional(),
    outflow: zod_1.z.number().optional(),
    pnl: zod_1.z.number().optional(),
    feesCharged: zod_1.z.number().optional(),
    returnPercent: zod_1.z.number().optional(),
    top5Positions: zod_1.z
        .array(zod_1.z.object({ name: zod_1.z.string(), value: zod_1.z.number(), weight: zod_1.z.number() }))
        .optional(),
});
exports.ReportDraftZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    type: zod_1.z.enum([
        "FUND_ACCOUNTING",
        "INVESTOR_REPORT",
        "FINANCIAL",
        "REGULATORY",
    ]),
    period: zod_1.z.object({
        start: zod_1.z.string().datetime(),
        end: zod_1.z.string().datetime(),
    }),
    text: zod_1.z.string(),
    html: zod_1.z.string().optional(),
    metrics: exports.MetricsZ.optional(),
    sections: zod_1.z
        .array(zod_1.z.object({
        title: zod_1.z.string(),
        content: zod_1.z.string(),
        highlights: zod_1.z.array(zod_1.z.string()).optional(),
    }))
        .optional(),
});
// ============================================================================
// DATA QUALITY CHECKS
// ============================================================================
exports.QCCheckZ = zod_1.z.object({
    id: zod_1.z.string(),
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    severity: zod_1.z.enum(["error", "warning", "info"]),
    message: zod_1.z.string(),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    timestamp: zod_1.z.string().datetime(),
});
exports.DataQualityResultZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    period: zod_1.z.string().datetime(),
    source: zod_1.z.enum([
        "FORTNOX",
        "ALLVUE",
        "BANK",
        "SKV",
        "FI",
        "SIGMA",
        "MANUAL",
    ]),
    checks: zod_1.z.array(exports.QCCheckZ),
    summary: zod_1.z.object({
        totalChecks: zod_1.z.number(),
        passedChecks: zod_1.z.number(),
        errorCount: zod_1.z.number(),
        warningCount: zod_1.z.number(),
    }),
    taskId: zod_1.z.string().cuid().optional(),
});
// ============================================================================
// KYC & COMPLIANCE
// ============================================================================
exports.KYCCheckResultZ = zod_1.z.object({
    investorId: zod_1.z.string().cuid(),
    pepStatus: zod_1.z.enum(["clear", "flagged", "pending_review"]),
    sanctionStatus: zod_1.z.enum(["clear", "flagged", "pending_review"]),
    riskLevel: zod_1.z.enum(["low", "medium", "high"]),
    uboTree: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        ownershipPercent: zod_1.z.number(),
        pepStatus: zod_1.z.string().optional(),
    }))
        .optional(),
    timestamp: zod_1.z.string().datetime(),
});
// ============================================================================
// RISK ENGINE
// ============================================================================
exports.RiskMetricsZ = zod_1.z.object({
    var95: zod_1.z.number().optional(),
    concentration: zod_1.z
        .array(zod_1.z.object({
        position: zod_1.z.string(),
        weight: zod_1.z.number(),
    }))
        .optional(),
    limitBreaches: zod_1.z
        .array(zod_1.z.object({
        limit: zod_1.z.string(),
        threshold: zod_1.z.number(),
        current: zod_1.z.number(),
        breached: zod_1.z.boolean(),
    }))
        .optional(),
    stressScenarios: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        impact: zod_1.z.number(),
    }))
        .optional(),
});
// ============================================================================
// JOB PAYLOADS
// ============================================================================
exports.ETLJobPayloadZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    source: zod_1.z.enum([
        "FORTNOX",
        "ALLVUE",
        "BANK",
        "SKV",
        "FI",
        "SIGMA",
        "MANUAL",
    ]),
    period: zod_1.z.object({
        start: zod_1.z.string().datetime(),
        end: zod_1.z.string().datetime(),
    }),
    configJson: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.AIJobPayloadZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    task: zod_1.z.enum([
        "reconciliation",
        "report_draft",
        "data_quality",
        "kyc_check",
        "risk_calc",
        "compliance_eval",
    ]),
    period: zod_1.z.object({
        start: zod_1.z.string().datetime(),
        end: zod_1.z.string().datetime(),
    }),
    artifacts: zod_1.z
        .object({
        ledgerCsv: zod_1.z.string().optional(),
        bankCsv: zod_1.z.string().optional(),
        positionsCsv: zod_1.z.string().optional(),
    })
        .optional(),
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
// ============================================================================
// API REQUESTS/RESPONSES
// ============================================================================
exports.CreateClientReqZ = zod_1.z.object({
    name: zod_1.z.string().min(1),
    orgNo: zod_1.z.string(),
    tier: zod_1.z.enum(["XL", "LARGE"]),
});
exports.UpsertDataFeedReqZ = zod_1.z.object({
    clientId: zod_1.z.string().cuid(),
    source: zod_1.z.enum([
        "FORTNOX",
        "ALLVUE",
        "BANK",
        "SKV",
        "FI",
        "SIGMA",
        "MANUAL",
    ]),
    configJson: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
});
