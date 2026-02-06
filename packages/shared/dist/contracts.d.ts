/**
 * Data Contracts - Zod schemas for type-safe validation
 * Used across ETL, AI workers, and API boundaries
 */
import { z } from "zod";
export declare const LedgerEntryZ: z.ZodObject<{
    clientId: z.ZodString;
    source: z.ZodEnum<["FORTNOX", "ALLVUE", "BANK", "SKV", "FI", "SIGMA", "MANUAL"]>;
    bookingDate: z.ZodString;
    account: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    bookingDate: string;
    account: string;
    amount: number;
    currency: string;
    description?: string | undefined;
    meta?: Record<string, any> | undefined;
}, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    bookingDate: string;
    account: string;
    amount: number;
    currency: string;
    description?: string | undefined;
    meta?: Record<string, any> | undefined;
}>;
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
}, "strip", z.ZodTypeAny, {
    date: string;
    amount: number;
    currency: string;
    description: string;
    iban: string;
    counterpartyIban?: string | undefined;
    counterpartyName?: string | undefined;
    reference?: string | undefined;
}, {
    date: string;
    amount: number;
    currency: string;
    description: string;
    iban: string;
    counterpartyIban?: string | undefined;
    counterpartyName?: string | undefined;
    reference?: string | undefined;
}>;
export type BankTransaction = z.infer<typeof BankTransactionZ>;
export declare const ReconciliationMatchZ: z.ZodObject<{
    bankTxId: z.ZodString;
    ledgerEntryId: z.ZodString;
    confidence: z.ZodNumber;
    matchedOn: z.ZodEnum<["amount", "date", "description", "fuzzy"]>;
    tolerance: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    bankTxId: string;
    ledgerEntryId: string;
    confidence: number;
    matchedOn: "date" | "amount" | "description" | "fuzzy";
    tolerance?: number | undefined;
}, {
    bankTxId: string;
    ledgerEntryId: string;
    confidence: number;
    matchedOn: "date" | "amount" | "description" | "fuzzy";
    tolerance?: number | undefined;
}>;
export type ReconciliationMatch = z.infer<typeof ReconciliationMatchZ>;
export declare const ReconciliationDeltaZ: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["unmatched_bank", "unmatched_ledger", "amount_mismatch"]>;
    severity: z.ZodEnum<["error", "warning", "info"]>;
    amount: z.ZodNumber;
    date: z.ZodString;
    description: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "unmatched_bank" | "unmatched_ledger" | "amount_mismatch";
    date: string;
    amount: number;
    description: string;
    id: string;
    severity: "error" | "warning" | "info";
    context?: Record<string, any> | undefined;
}, {
    type: "unmatched_bank" | "unmatched_ledger" | "amount_mismatch";
    date: string;
    amount: number;
    description: string;
    id: string;
    severity: "error" | "warning" | "info";
    context?: Record<string, any> | undefined;
}>;
export type ReconciliationDelta = z.infer<typeof ReconciliationDeltaZ>;
export declare const ReconciliationResultZ: z.ZodObject<{
    clientId: z.ZodString;
    period: z.ZodString;
    matched: z.ZodArray<z.ZodObject<{
        bankTxId: z.ZodString;
        ledgerEntryId: z.ZodString;
        confidence: z.ZodNumber;
        matchedOn: z.ZodEnum<["amount", "date", "description", "fuzzy"]>;
        tolerance: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        bankTxId: string;
        ledgerEntryId: string;
        confidence: number;
        matchedOn: "date" | "amount" | "description" | "fuzzy";
        tolerance?: number | undefined;
    }, {
        bankTxId: string;
        ledgerEntryId: string;
        confidence: number;
        matchedOn: "date" | "amount" | "description" | "fuzzy";
        tolerance?: number | undefined;
    }>, "many">;
    deltas: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["unmatched_bank", "unmatched_ledger", "amount_mismatch"]>;
        severity: z.ZodEnum<["error", "warning", "info"]>;
        amount: z.ZodNumber;
        date: z.ZodString;
        description: z.ZodString;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "unmatched_bank" | "unmatched_ledger" | "amount_mismatch";
        date: string;
        amount: number;
        description: string;
        id: string;
        severity: "error" | "warning" | "info";
        context?: Record<string, any> | undefined;
    }, {
        type: "unmatched_bank" | "unmatched_ledger" | "amount_mismatch";
        date: string;
        amount: number;
        description: string;
        id: string;
        severity: "error" | "warning" | "info";
        context?: Record<string, any> | undefined;
    }>, "many">;
    matchRate: z.ZodNumber;
    totalBank: z.ZodNumber;
    totalLedger: z.ZodNumber;
    variance: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    period: string;
    matched: {
        bankTxId: string;
        ledgerEntryId: string;
        confidence: number;
        matchedOn: "date" | "amount" | "description" | "fuzzy";
        tolerance?: number | undefined;
    }[];
    deltas: {
        type: "unmatched_bank" | "unmatched_ledger" | "amount_mismatch";
        date: string;
        amount: number;
        description: string;
        id: string;
        severity: "error" | "warning" | "info";
        context?: Record<string, any> | undefined;
    }[];
    matchRate: number;
    totalBank: number;
    totalLedger: number;
    variance: number;
}, {
    clientId: string;
    period: string;
    matched: {
        bankTxId: string;
        ledgerEntryId: string;
        confidence: number;
        matchedOn: "date" | "amount" | "description" | "fuzzy";
        tolerance?: number | undefined;
    }[];
    deltas: {
        type: "unmatched_bank" | "unmatched_ledger" | "amount_mismatch";
        date: string;
        amount: number;
        description: string;
        id: string;
        severity: "error" | "warning" | "info";
        context?: Record<string, any> | undefined;
    }[];
    matchRate: number;
    totalBank: number;
    totalLedger: number;
    variance: number;
}>;
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
    }, "strip", z.ZodTypeAny, {
        value: number;
        name: string;
        weight: number;
    }, {
        value: number;
        name: string;
        weight: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    nav?: number | undefined;
    inflow?: number | undefined;
    outflow?: number | undefined;
    pnl?: number | undefined;
    feesCharged?: number | undefined;
    returnPercent?: number | undefined;
    top5Positions?: {
        value: number;
        name: string;
        weight: number;
    }[] | undefined;
}, {
    nav?: number | undefined;
    inflow?: number | undefined;
    outflow?: number | undefined;
    pnl?: number | undefined;
    feesCharged?: number | undefined;
    returnPercent?: number | undefined;
    top5Positions?: {
        value: number;
        name: string;
        weight: number;
    }[] | undefined;
}>;
export type Metrics = z.infer<typeof MetricsZ>;
export declare const ReportDraftZ: z.ZodObject<{
    clientId: z.ZodString;
    type: z.ZodEnum<["FUND_ACCOUNTING", "INVESTOR_REPORT", "FINANCIAL", "REGULATORY"]>;
    period: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        start: string;
        end: string;
    }, {
        start: string;
        end: string;
    }>;
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
        }, "strip", z.ZodTypeAny, {
            value: number;
            name: string;
            weight: number;
        }, {
            value: number;
            name: string;
            weight: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        nav?: number | undefined;
        inflow?: number | undefined;
        outflow?: number | undefined;
        pnl?: number | undefined;
        feesCharged?: number | undefined;
        returnPercent?: number | undefined;
        top5Positions?: {
            value: number;
            name: string;
            weight: number;
        }[] | undefined;
    }, {
        nav?: number | undefined;
        inflow?: number | undefined;
        outflow?: number | undefined;
        pnl?: number | undefined;
        feesCharged?: number | undefined;
        returnPercent?: number | undefined;
        top5Positions?: {
            value: number;
            name: string;
            weight: number;
        }[] | undefined;
    }>>;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        content: z.ZodString;
        highlights: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        content: string;
        highlights?: string[] | undefined;
    }, {
        title: string;
        content: string;
        highlights?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    type: "FUND_ACCOUNTING" | "INVESTOR_REPORT" | "FINANCIAL" | "REGULATORY";
    period: {
        start: string;
        end: string;
    };
    text: string;
    html?: string | undefined;
    metrics?: {
        nav?: number | undefined;
        inflow?: number | undefined;
        outflow?: number | undefined;
        pnl?: number | undefined;
        feesCharged?: number | undefined;
        returnPercent?: number | undefined;
        top5Positions?: {
            value: number;
            name: string;
            weight: number;
        }[] | undefined;
    } | undefined;
    sections?: {
        title: string;
        content: string;
        highlights?: string[] | undefined;
    }[] | undefined;
}, {
    clientId: string;
    type: "FUND_ACCOUNTING" | "INVESTOR_REPORT" | "FINANCIAL" | "REGULATORY";
    period: {
        start: string;
        end: string;
    };
    text: string;
    html?: string | undefined;
    metrics?: {
        nav?: number | undefined;
        inflow?: number | undefined;
        outflow?: number | undefined;
        pnl?: number | undefined;
        feesCharged?: number | undefined;
        returnPercent?: number | undefined;
        top5Positions?: {
            value: number;
            name: string;
            weight: number;
        }[] | undefined;
    } | undefined;
    sections?: {
        title: string;
        content: string;
        highlights?: string[] | undefined;
    }[] | undefined;
}>;
export type ReportDraft = z.infer<typeof ReportDraftZ>;
export declare const QCCheckZ: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    severity: z.ZodEnum<["error", "warning", "info"]>;
    message: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    id: string;
    severity: "error" | "warning" | "info";
    name: string;
    timestamp: string;
    context?: Record<string, any> | undefined;
}, {
    code: string;
    message: string;
    id: string;
    severity: "error" | "warning" | "info";
    name: string;
    timestamp: string;
    context?: Record<string, any> | undefined;
}>;
export type QCCheck = z.infer<typeof QCCheckZ>;
export declare const DataQualityResultZ: z.ZodObject<{
    clientId: z.ZodString;
    period: z.ZodString;
    source: z.ZodEnum<["FORTNOX", "ALLVUE", "BANK", "SKV", "FI", "SIGMA", "MANUAL"]>;
    checks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        severity: z.ZodEnum<["error", "warning", "info"]>;
        message: z.ZodString;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        id: string;
        severity: "error" | "warning" | "info";
        name: string;
        timestamp: string;
        context?: Record<string, any> | undefined;
    }, {
        code: string;
        message: string;
        id: string;
        severity: "error" | "warning" | "info";
        name: string;
        timestamp: string;
        context?: Record<string, any> | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalChecks: z.ZodNumber;
        passedChecks: z.ZodNumber;
        errorCount: z.ZodNumber;
        warningCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalChecks: number;
        passedChecks: number;
        errorCount: number;
        warningCount: number;
    }, {
        totalChecks: number;
        passedChecks: number;
        errorCount: number;
        warningCount: number;
    }>;
    taskId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    period: string;
    checks: {
        code: string;
        message: string;
        id: string;
        severity: "error" | "warning" | "info";
        name: string;
        timestamp: string;
        context?: Record<string, any> | undefined;
    }[];
    summary: {
        totalChecks: number;
        passedChecks: number;
        errorCount: number;
        warningCount: number;
    };
    taskId?: string | undefined;
}, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    period: string;
    checks: {
        code: string;
        message: string;
        id: string;
        severity: "error" | "warning" | "info";
        name: string;
        timestamp: string;
        context?: Record<string, any> | undefined;
    }[];
    summary: {
        totalChecks: number;
        passedChecks: number;
        errorCount: number;
        warningCount: number;
    };
    taskId?: string | undefined;
}>;
export type DataQualityResult = z.infer<typeof DataQualityResultZ>;
export declare const KYCCheckResultZ: z.ZodObject<{
    investorId: z.ZodString;
    pepStatus: z.ZodEnum<["clear", "flagged", "pending_review"]>;
    sanctionStatus: z.ZodEnum<["clear", "flagged", "pending_review"]>;
    riskLevel: z.ZodEnum<["low", "medium", "high"]>;
    uboTree: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        ownershipPercent: z.ZodNumber;
        pepStatus: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        ownershipPercent: number;
        pepStatus?: string | undefined;
    }, {
        name: string;
        ownershipPercent: number;
        pepStatus?: string | undefined;
    }>, "many">>;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    investorId: string;
    pepStatus: "clear" | "flagged" | "pending_review";
    sanctionStatus: "clear" | "flagged" | "pending_review";
    riskLevel: "low" | "medium" | "high";
    uboTree?: {
        name: string;
        ownershipPercent: number;
        pepStatus?: string | undefined;
    }[] | undefined;
}, {
    timestamp: string;
    investorId: string;
    pepStatus: "clear" | "flagged" | "pending_review";
    sanctionStatus: "clear" | "flagged" | "pending_review";
    riskLevel: "low" | "medium" | "high";
    uboTree?: {
        name: string;
        ownershipPercent: number;
        pepStatus?: string | undefined;
    }[] | undefined;
}>;
export type KYCCheckResult = z.infer<typeof KYCCheckResultZ>;
export declare const RiskMetricsZ: z.ZodObject<{
    var95: z.ZodOptional<z.ZodNumber>;
    concentration: z.ZodOptional<z.ZodArray<z.ZodObject<{
        position: z.ZodString;
        weight: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        weight: number;
        position: string;
    }, {
        weight: number;
        position: string;
    }>, "many">>;
    limitBreaches: z.ZodOptional<z.ZodArray<z.ZodObject<{
        limit: z.ZodString;
        threshold: z.ZodNumber;
        current: z.ZodNumber;
        breached: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        limit: string;
        threshold: number;
        current: number;
        breached: boolean;
    }, {
        limit: string;
        threshold: number;
        current: number;
        breached: boolean;
    }>, "many">>;
    stressScenarios: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        impact: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        impact: number;
    }, {
        name: string;
        impact: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    var95?: number | undefined;
    concentration?: {
        weight: number;
        position: string;
    }[] | undefined;
    limitBreaches?: {
        limit: string;
        threshold: number;
        current: number;
        breached: boolean;
    }[] | undefined;
    stressScenarios?: {
        name: string;
        impact: number;
    }[] | undefined;
}, {
    var95?: number | undefined;
    concentration?: {
        weight: number;
        position: string;
    }[] | undefined;
    limitBreaches?: {
        limit: string;
        threshold: number;
        current: number;
        breached: boolean;
    }[] | undefined;
    stressScenarios?: {
        name: string;
        impact: number;
    }[] | undefined;
}>;
export type RiskMetrics = z.infer<typeof RiskMetricsZ>;
export declare const ETLJobPayloadZ: z.ZodObject<{
    clientId: z.ZodString;
    source: z.ZodEnum<["FORTNOX", "ALLVUE", "BANK", "SKV", "FI", "SIGMA", "MANUAL"]>;
    period: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        start: string;
        end: string;
    }, {
        start: string;
        end: string;
    }>;
    configJson: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    period: {
        start: string;
        end: string;
    };
    configJson?: Record<string, any> | undefined;
}, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    period: {
        start: string;
        end: string;
    };
    configJson?: Record<string, any> | undefined;
}>;
export type ETLJobPayload = z.infer<typeof ETLJobPayloadZ>;
export declare const AIJobPayloadZ: z.ZodObject<{
    clientId: z.ZodString;
    task: z.ZodEnum<["reconciliation", "report_draft", "data_quality", "kyc_check", "risk_calc", "compliance_eval"]>;
    period: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        start: string;
        end: string;
    }, {
        start: string;
        end: string;
    }>;
    artifacts: z.ZodOptional<z.ZodObject<{
        ledgerCsv: z.ZodOptional<z.ZodString>;
        bankCsv: z.ZodOptional<z.ZodString>;
        positionsCsv: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ledgerCsv?: string | undefined;
        bankCsv?: string | undefined;
        positionsCsv?: string | undefined;
    }, {
        ledgerCsv?: string | undefined;
        bankCsv?: string | undefined;
        positionsCsv?: string | undefined;
    }>>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    period: {
        start: string;
        end: string;
    };
    task: "reconciliation" | "report_draft" | "data_quality" | "kyc_check" | "risk_calc" | "compliance_eval";
    context?: Record<string, any> | undefined;
    artifacts?: {
        ledgerCsv?: string | undefined;
        bankCsv?: string | undefined;
        positionsCsv?: string | undefined;
    } | undefined;
}, {
    clientId: string;
    period: {
        start: string;
        end: string;
    };
    task: "reconciliation" | "report_draft" | "data_quality" | "kyc_check" | "risk_calc" | "compliance_eval";
    context?: Record<string, any> | undefined;
    artifacts?: {
        ledgerCsv?: string | undefined;
        bankCsv?: string | undefined;
        positionsCsv?: string | undefined;
    } | undefined;
}>;
export type AIJobPayload = z.infer<typeof AIJobPayloadZ>;
export declare const CreateClientReqZ: z.ZodObject<{
    name: z.ZodString;
    orgNo: z.ZodString;
    tier: z.ZodEnum<["XL", "LARGE"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    orgNo: string;
    tier: "XL" | "LARGE";
}, {
    name: string;
    orgNo: string;
    tier: "XL" | "LARGE";
}>;
export type CreateClientReq = z.infer<typeof CreateClientReqZ>;
export declare const UpsertDataFeedReqZ: z.ZodObject<{
    clientId: z.ZodString;
    source: z.ZodEnum<["FORTNOX", "ALLVUE", "BANK", "SKV", "FI", "SIGMA", "MANUAL"]>;
    configJson: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    configJson: Record<string, any>;
}, {
    clientId: string;
    source: "FORTNOX" | "ALLVUE" | "BANK" | "SKV" | "FI" | "SIGMA" | "MANUAL";
    configJson: Record<string, any>;
}>;
export type UpsertDataFeedReq = z.infer<typeof UpsertDataFeedReqZ>;
