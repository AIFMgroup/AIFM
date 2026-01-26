"use strict";
/**
 * Shared Types - Role-based access control, DB model types, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = exports.RolePermissions = exports.ReportStatus = exports.ReportType = exports.TaskStatus = exports.TaskKind = exports.DataSource = exports.Role = exports.Plan = exports.ClientTier = void 0;
exports.getPeriodString = getPeriodString;
// ============================================================================
// ENUMS (mirroring Prisma enums)
// ============================================================================
var ClientTier;
(function (ClientTier) {
    ClientTier["XL"] = "XL";
    ClientTier["LARGE"] = "LARGE";
})(ClientTier || (exports.ClientTier = ClientTier = {}));
var Plan;
(function (Plan) {
    Plan["AGENT_PORTAL"] = "AGENT_PORTAL";
    Plan["COORDINATOR"] = "COORDINATOR";
    Plan["SPECIALIST"] = "SPECIALIST";
})(Plan || (exports.Plan = Plan = {}));
var Role;
(function (Role) {
    Role["CLIENT"] = "CLIENT";
    Role["COORDINATOR"] = "COORDINATOR";
    Role["SPECIALIST"] = "SPECIALIST";
    Role["ADMIN"] = "ADMIN";
})(Role || (exports.Role = Role = {}));
var DataSource;
(function (DataSource) {
    DataSource["FORTNOX"] = "FORTNOX";
    DataSource["ALLVUE"] = "ALLVUE";
    DataSource["BANK"] = "BANK";
    DataSource["SKV"] = "SKV";
    DataSource["FI"] = "FI";
    DataSource["SIGMA"] = "SIGMA";
    DataSource["MANUAL"] = "MANUAL";
})(DataSource || (exports.DataSource = DataSource = {}));
var TaskKind;
(function (TaskKind) {
    TaskKind["QC_CHECK"] = "QC_CHECK";
    TaskKind["KYC_REVIEW"] = "KYC_REVIEW";
    TaskKind["REPORT_DRAFT"] = "REPORT_DRAFT";
    TaskKind["BANK_RECON"] = "BANK_RECON";
    TaskKind["RISK_CALC"] = "RISK_CALC";
    TaskKind["COMPLIANCE_CHECK"] = "COMPLIANCE_CHECK";
    TaskKind["INVESTOR_ONBOARD"] = "INVESTOR_ONBOARD";
})(TaskKind || (exports.TaskKind = TaskKind = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["QUEUED"] = "QUEUED";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["BLOCKED"] = "BLOCKED";
    TaskStatus["NEEDS_REVIEW"] = "NEEDS_REVIEW";
    TaskStatus["DONE"] = "DONE";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var ReportType;
(function (ReportType) {
    ReportType["FUND_ACCOUNTING"] = "FUND_ACCOUNTING";
    ReportType["INVESTOR_REPORT"] = "INVESTOR_REPORT";
    ReportType["FINANCIAL"] = "FINANCIAL";
    ReportType["REGULATORY"] = "REGULATORY";
})(ReportType || (exports.ReportType = ReportType = {}));
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["DRAFT"] = "DRAFT";
    ReportStatus["QC"] = "QC";
    ReportStatus["APPROVAL"] = "APPROVAL";
    ReportStatus["PUBLISHED"] = "PUBLISHED";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
exports.RolePermissions = {
    [Role.CLIENT]: ["client:read_own", "datafeeds:manage", "reports:read"],
    [Role.COORDINATOR]: [
        "client:read_all",
        "datafeeds:manage",
        "reports:read",
        "tasks:read",
        "tasks:review",
    ],
    [Role.SPECIALIST]: [
        "client:read_all",
        "reports:read",
        "reports:edit",
        "reports:approve",
        "tasks:read",
        "tasks:assign",
    ],
    [Role.ADMIN]: ["admin:*"],
};
function getPeriodString(period) {
    return `${period.start.toISOString().split("T")[0]}_${period.end
        .toISOString()
        .split("T")[0]}`;
}
// ============================================================================
// ERROR TYPES
// ============================================================================
class AppError extends Error {
    constructor(code, message, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details) {
        super("VALIDATION_ERROR", message, 400, details);
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(resource, id) {
        super("NOT_FOUND", `${resource} with id ${id} not found`, 404);
        this.name = "NotFoundError";
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super("UNAUTHORIZED", message, 401);
        this.name = "UnauthorizedError";
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super("FORBIDDEN", message, 403);
        this.name = "ForbiddenError";
    }
}
exports.ForbiddenError = ForbiddenError;
