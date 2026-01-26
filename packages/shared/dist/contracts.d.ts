/**
 * Data Contracts - Zod schemas for type-safe validation
 * Used across ETL, AI workers, and API boundaries
 */
import { z } from "zod";
export declare const LedgerEntryZ: z.ZodObject<{
    clientId: z.ZodString;
    source: z.ZodEnum<{
        FORTNOX: "FORTNOX";
        ALLVUE: "ALLVUE";
        BANK: "BANK";
        SKV: "SKV";
        FI: "FI";
        SIGMA: "SIGMA";
        MANUAL: "MANUAL";
    }>;
    bookingDate: z.ZodString;
    account: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type LedgerEntry = z.infer<typeof LedgerEntryZ>;
export declare const BankTransactionZ: z.ZodObject<{
    iban: z.ZodString;
    date: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodString;
    counterpartyIban: z.ZodOptional<z.ZodString>;
    counterpartyName: z.ZodOptional<z.ZodString>;
    reference: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BankTransaction = z.infer<typeof BankTransactionZ>;
export declare const ReconciliationMatchZ: z.ZodObject<{
    bankTxId: z.ZodString;
    ledgerEntryId: z.ZodString;
    confidence: z.ZodNumber;
    matchedOn: z.ZodEnum<{
        amount: "amount";
        description: "description";
        date: "date";
        fuzzy: "fuzzy";
    }>;
    tolerance: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ReconciliationMatch = z.infer<typeof ReconciliationMatchZ>;
export declare const ReconciliationDeltaZ: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        unmatched_bank: "unmatched_bank";
        unmatched_ledger: "unmatched_ledger";
        amount_mismatch: "amount_mismatch";
    }>;
    severity: z.ZodEnum<{
        error: "error";
        warning: "warning";
        info: "info";
    }>;
    amount: z.ZodNumber;
    date: z.ZodString;
    description: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type ReconciliationDelta = z.infer<typeof ReconciliationDeltaZ>;
export declare const ReconciliationResultZ: z.ZodObject<{
    clientId: z.ZodString;
    period: z.ZodString;
    matched: z.ZodArray<z.ZodObject<{
        bankTxId: z.ZodString;
        ledgerEntryId: z.ZodString;
        confidence: z.ZodNumber;
        matchedOn: z.ZodEnum<{
            amount: "amount";
            description: "description";
            date: "date";
            fuzzy: "fuzzy";
        }>;
        tolerance: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    deltas: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<{
            unmatched_bank: "unmatched_bank";
            unmatched_ledger: "unmatched_ledger";
            amount_mismatch: "amount_mismatch";
        }>;
        severity: z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>;
        amount: z.ZodNumber;
        date: z.ZodString;
        description: z.ZodString;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.core.$strip>>;
    matchRate: z.ZodNumber;
    totalBank: z.ZodNumber;
    totalLedger: z.ZodNumber;
    variance: z.ZodNumber;
}, z.core.$strip>;
export type ReconciliationResult = z.infer<typeof ReconciliationResultZ>;
export declare const MetricsZ: z.ZodObject<{
    nav: z.ZodOptional<z.ZodNumber>;
    inflow: z.ZodOptional<z.ZodNumber>;
    outflow: z.ZodOptional<z.ZodNumber>;
    pnl: z.ZodOptional<z.ZodNumber>;
    feesCharged: z.ZodOptional<z.ZodNumber>;
    returnPercent: z.ZodOptional<z.ZodNumber>;
    top5Positions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodNumber;
        weight: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type Metrics = z.infer<typeof MetricsZ>;
export declare const ReportDraftZ: z.ZodObject<{
    clientId: z.ZodString;
    type: z.ZodEnum<{
        FUND_ACCOUNTING: "FUND_ACCOUNTING";
        INVESTOR_REPORT: "INVESTOR_REPORT";
        FINANCIAL: "FINANCIAL";
        REGULATORY: "REGULATORY";
    }>;
    period: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, z.core.$strip>;
    text: z.ZodString;
    html: z.ZodOptional<z.ZodString>;
    metrics: z.ZodOptional<z.ZodObject<{
        nav: z.ZodOptional<z.ZodNumber>;
        inflow: z.ZodOptional<z.ZodNumber>;
        outflow: z.ZodOptional<z.ZodNumber>;
        pnl: z.ZodOptional<z.ZodNumber>;
        feesCharged: z.ZodOptional<z.ZodNumber>;
        returnPercent: z.ZodOptional<z.ZodNumber>;
        top5Positions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodNumber;
            weight: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        content: z.ZodString;
        highlights: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ReportDraft = z.infer<typeof ReportDraftZ>;
export declare const QCCheckZ: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    severity: z.ZodEnum<{
        error: "error";
        warning: "warning";
        info: "info";
    }>;
    message: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type QCCheck = z.infer<typeof QCCheckZ>;
export declare const DataQualityResultZ: z.ZodObject<{
    clientId: z.ZodString;
    period: z.ZodString;
    source: z.ZodEnum<{
        FORTNOX: "FORTNOX";
        ALLVUE: "ALLVUE";
        BANK: "BANK";
        SKV: "SKV";
        FI: "FI";
        SIGMA: "SIGMA";
        MANUAL: "MANUAL";
    }>;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        severity: z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>;
        message: z.ZodString;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        timestamp: z.ZodString;
    }, z.core.$strip>>;
    summary: z.ZodObject<{
        totalChecks: z.ZodNumber;
        passedChecks: z.ZodNumber;
        errorCount: z.ZodNumber;
        warningCount: z.ZodNumber;
    }, z.core.$strip>;
    taskId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type DataQualityResult = z.infer<typeof DataQualityResultZ>;
export declare const KYCCheckResultZ: z.ZodObject<{
    investorId: z.ZodString;
    pepStatus: z.ZodEnum<{
        clear: "clear";
        flagged: "flagged";
        pending_review: "pending_review";
    }>;
    sanctionStatus: z.ZodEnum<{
        clear: "clear";
        flagged: "flagged";
        pending_review: "pending_review";
    }>;
    riskLevel: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    uboTree: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        ownershipPercent: z.ZodNumber;
        pepStatus: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    timestamp: z.ZodString;
}, z.core.$strip>;
export type KYCCheckResult = z.infer<typeof KYCCheckResultZ>;
export declare const RiskMetricsZ: z.ZodObject<{
    var95: z.ZodOptional<z.ZodNumber>;
    concentration: z.ZodOptional<z.ZodArray<z.ZodObject<{
        position: z.ZodString;
        weight: z.ZodNumber;
    }, z.core.$strip>>>;
    limitBreaches: z.ZodOptional<z.ZodArray<z.ZodObject<{
        limit: z.ZodString;
        threshold: z.ZodNumber;
        current: z.ZodNumber;
        breached: z.ZodBoolean;
    }, z.core.$strip>>>;
    stressScenarios: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        impact: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type RiskMetrics = z.infer<typeof RiskMetricsZ>;
export declare const ETLJobPayloadZ: z.ZodObject<{
    clientId: z.ZodString;
    source: z.ZodEnum<{
        FORTNOX: "FORTNOX";
        ALLVUE: "ALLVUE";
        BANK: "BANK";
        SKV: "SKV";
        FI: "FI";
        SIGMA: "SIGMA";
        MANUAL: "MANUAL";
    }>;
    period: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, z.core.$strip>;
    configJson: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type ETLJobPayload = z.infer<typeof ETLJobPayloadZ>;
export declare const AIJobPayloadZ: z.ZodObject<{
    clientId: z.ZodString;
    task: z.ZodEnum<{
        reconciliation: "reconciliation";
        report_draft: "report_draft";
        data_quality: "data_quality";
        kyc_check: "kyc_check";
        risk_calc: "risk_calc";
        compliance_eval: "compliance_eval";
    }>;
    period: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, z.core.$strip>;
    artifacts: z.ZodOptional<z.ZodObject<{
        ledgerCsv: z.ZodOptional<z.ZodString>;
        bankCsv: z.ZodOptional<z.ZodString>;
        positionsCsv: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type AIJobPayload = z.infer<typeof AIJobPayloadZ>;
export declare const CreateClientReqZ: z.ZodObject<{
    name: z.ZodString;
    orgNo: z.ZodString;
    tier: z.ZodEnum<{
        XL: "XL";
        LARGE: "LARGE";
    }>;
}, z.core.$strip>;
export type CreateClientReq = z.infer<typeof CreateClientReqZ>;
export declare const UpsertDataFeedReqZ: z.ZodObject<{
    clientId: z.ZodString;
    source: z.ZodEnum<{
        FORTNOX: "FORTNOX";
        ALLVUE: "ALLVUE";
        BANK: "BANK";
        SKV: "SKV";
        FI: "FI";
        SIGMA: "SIGMA";
        MANUAL: "MANUAL";
    }>;
    configJson: z.ZodRecord<z.ZodString, z.ZodAny>;
}, z.core.$strip>;
export type UpsertDataFeedReq = z.infer<typeof UpsertDataFeedReqZ>;
