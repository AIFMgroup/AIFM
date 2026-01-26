/**
 * Shared Types - Role-based access control, DB model types, etc.
 */
export declare enum ClientTier {
    XL = "XL",
    LARGE = "LARGE"
}
export declare enum Plan {
    AGENT_PORTAL = "AGENT_PORTAL",
    COORDINATOR = "COORDINATOR",
    SPECIALIST = "SPECIALIST"
}
export declare enum Role {
    CLIENT = "CLIENT",
    COORDINATOR = "COORDINATOR",
    SPECIALIST = "SPECIALIST",
    ADMIN = "ADMIN"
}
export declare enum DataSource {
    FORTNOX = "FORTNOX",
    ALLVUE = "ALLVUE",
    BANK = "BANK",
    SKV = "SKV",
    FI = "FI",
    SIGMA = "SIGMA",
    MANUAL = "MANUAL"
}
export declare enum TaskKind {
    QC_CHECK = "QC_CHECK",
    KYC_REVIEW = "KYC_REVIEW",
    REPORT_DRAFT = "REPORT_DRAFT",
    BANK_RECON = "BANK_RECON",
    RISK_CALC = "RISK_CALC",
    COMPLIANCE_CHECK = "COMPLIANCE_CHECK",
    INVESTOR_ONBOARD = "INVESTOR_ONBOARD"
}
export declare enum TaskStatus {
    QUEUED = "QUEUED",
    IN_PROGRESS = "IN_PROGRESS",
    BLOCKED = "BLOCKED",
    NEEDS_REVIEW = "NEEDS_REVIEW",
    DONE = "DONE"
}
export declare enum ReportType {
    FUND_ACCOUNTING = "FUND_ACCOUNTING",
    INVESTOR_REPORT = "INVESTOR_REPORT",
    FINANCIAL = "FINANCIAL",
    REGULATORY = "REGULATORY"
}
export declare enum ReportStatus {
    DRAFT = "DRAFT",
    QC = "QC",
    APPROVAL = "APPROVAL",
    PUBLISHED = "PUBLISHED"
}
export type Permission = "client:read_own" | "client:read_all" | "datafeeds:manage" | "reports:read" | "reports:edit" | "reports:approve" | "tasks:read" | "tasks:review" | "tasks:assign" | "admin:*";
export declare const RolePermissions: Record<Role, Permission[]>;
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    metadata?: {
        timestamp: string;
        traceId?: string;
    };
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
export interface JobOptions {
    attempts?: number;
    backoff?: {
        type: "exponential" | "fixed";
        delay: number;
    };
    timeout?: number;
    priority?: number;
    removeOnComplete?: boolean;
}
export interface JobProgress {
    current: number;
    total: number;
    percentage: number;
}
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "SYNC" | "PUBLISH";
export interface AuditEntry {
    id: string;
    actorId?: string;
    actorRole?: Role;
    action: AuditAction;
    refType: string;
    refId: string;
    diffJson?: {
        before: any;
        after: any;
    };
    ip?: string;
    createdAt: Date;
}
export interface Period {
    start: Date;
    end: Date;
}
export declare function getPeriodString(period: Period): string;
export declare class AppError extends Error {
    code: string;
    statusCode: number;
    details?: any | undefined;
    constructor(code: string, message: string, statusCode?: number, details?: any | undefined);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: any);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
