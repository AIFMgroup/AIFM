/**
 * Data Quality AI Worker
 * Validates ledger entries, detects duplicates, missing fields, and creates QC tasks
 * NOTE: Database operations are mocked - results are logged but not persisted
 */
import { Worker, Job } from "bullmq";
import pino from "pino";
import { AIJobPayload, DataQualityResultZ, QCCheck } from "@aifm/shared";
import { redisConnection } from "../lib/queue";

const logger = pino();

// Use TaskStatus type
type TaskStatus = "QUEUED" | "IN_PROGRESS" | "BLOCKED" | "NEEDS_REVIEW" | "DONE";

// ============================================================================
// DATA QUALITY WORKER
// ============================================================================

export const dataQualityWorker = new Worker(
  "ai",
  async (job: Job<AIJobPayload>) => {
    logger.info(
      { jobId: job.id, clientId: job.data.clientId },
      "Starting data quality check"
    );

    const { clientId, period } = job.data;

    try {
      // Mock: In production, fetch ledger entries from DynamoDB
      const entries: any[] = [];
      
      logger.info({ entriesCount: entries.length }, "Fetched ledger entries (mock)");

      // Run validation checks
      const checks: QCCheck[] = [];

      // Check 1: Duplicate transactions
      checks.push(...detectDuplicates(entries, clientId));

      // Check 2: Missing required fields
      checks.push(...checkMissingFields(entries, clientId));

      // Check 3: Amount validation (no zero or invalid values)
      checks.push(...validateAmounts(entries, clientId));

      // Check 4: Currency consistency
      checks.push(...validateCurrencies(entries, clientId));

      // Check 5: Account code format
      checks.push(...validateAccountCodes(entries, clientId));

      // Check 6: Ledger balancing (sums)
      checks.push(...validateLedgerBalance(entries, clientId));

      const errorCount = checks.filter((c) => c.severity === "error").length;
      const warningCount = checks.filter((c) => c.severity === "warning").length;

      logger.info(
        {
          clientId,
          checksCount: checks.length,
          errorCount,
          warningCount,
        },
        "Data quality check completed - results would be persisted to DynamoDB"
      );

      return {
        success: true,
        checksCount: checks.length,
        errorCount,
        warningCount,
        taskId: `qc-check-${clientId}-${period.start.toISOString().split("T")[0]}`,
      };
    } catch (error) {
      logger.error(
        { clientId, error: (error as Error).message },
        "Data quality check failed"
      );
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function detectDuplicates(entries: any[], clientId: string): QCCheck[] {
  const checks: QCCheck[] = [];
  const seen = new Map<string, any[]>();

  for (const entry of entries) {
    const key = `${entry.account}:${entry.amount}:${entry.bookingDate}`;
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(entry);
  }

  for (const [key, group] of seen) {
    if (group.length > 1) {
      checks.push({
        id: `dup-${key}`,
        code: "DUPLICATE_ENTRY",
        name: "Duplicate Transaction Detected",
        severity: "warning",
        message: `Found ${group.length} identical transactions: account=${key.split(":")[0]}, amount=${
          key.split(":")[1]
        }`,
        context: {
          account: key.split(":")[0],
          amount: key.split(":")[1],
          count: group.length,
          entryIds: group.map((e) => e.id),
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return checks;
}

function checkMissingFields(entries: any[], clientId: string): QCCheck[] {
  const checks: QCCheck[] = [];

  for (const entry of entries) {
    const issues: string[] = [];

    if (!entry.account || entry.account.trim() === "") {
      issues.push("account");
    }
    if (!entry.amount) {
      issues.push("amount");
    }
    if (!entry.currency || entry.currency.trim() === "") {
      issues.push("currency");
    }

    if (issues.length > 0) {
      checks.push({
        id: `missing-${entry.id}`,
        code: "MISSING_FIELD",
        name: "Missing Required Field",
        severity: "error",
        message: `Entry ${entry.id} missing fields: ${issues.join(", ")}`,
        context: {
          entryId: entry.id,
          missingFields: issues,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return checks;
}

function validateAmounts(entries: any[], clientId: string): QCCheck[] {
  const checks: QCCheck[] = [];

  for (const entry of entries) {
    if (entry.amount === 0) {
      checks.push({
        id: `zero-${entry.id}`,
        code: "ZERO_AMOUNT",
        name: "Zero Amount",
        severity: "warning",
        message: `Entry ${entry.id} has zero amount`,
        context: { entryId: entry.id },
        timestamp: new Date().toISOString(),
      });
    }

    if (isNaN(entry.amount) || !isFinite(entry.amount)) {
      checks.push({
        id: `invalid-${entry.id}`,
        code: "INVALID_AMOUNT",
        name: "Invalid Amount",
        severity: "error",
        message: `Entry ${entry.id} has invalid amount: ${entry.amount}`,
        context: { entryId: entry.id, amount: entry.amount },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return checks;
}

function validateCurrencies(entries: any[], clientId: string): QCCheck[] {
  const checks: QCCheck[] = [];
  const currencies = new Set(entries.map((e) => e.currency));

  if (currencies.size > 1 && !entries.some((e) => e.source === "BANK")) {
    checks.push({
      id: `multi-currency-${clientId}`,
      code: "MULTIPLE_CURRENCIES",
      name: "Multiple Currencies",
      severity: "warning",
      message: `Ledger has entries in ${currencies.size} currencies: ${Array.from(
        currencies
      ).join(", ")}`,
      context: { currencies: Array.from(currencies) },
      timestamp: new Date().toISOString(),
    });
  }

  for (const entry of entries) {
    if (!/^[A-Z]{3}$/.test(entry.currency)) {
      checks.push({
        id: `invalid-curr-${entry.id}`,
        code: "INVALID_CURRENCY_CODE",
        name: "Invalid Currency Code",
        severity: "error",
        message: `Entry ${entry.id} has invalid currency code: ${entry.currency}`,
        context: { entryId: entry.id, currency: entry.currency },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return checks;
}

function validateAccountCodes(entries: any[], clientId: string): QCCheck[] {
  const checks: QCCheck[] = [];

  for (const entry of entries) {
    if (entry.source === "FORTNOX" && !/^\d{4,6}$/.test(entry.account)) {
      checks.push({
        id: `invalid-acct-${entry.id}`,
        code: "INVALID_ACCOUNT_CODE",
        name: "Invalid Account Code",
        severity: "warning",
        message: `Entry ${entry.id} has unexpected account code format: ${entry.account}`,
        context: { entryId: entry.id, account: entry.account },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return checks;
}

function validateLedgerBalance(entries: any[], clientId: string): QCCheck[] {
  const checks: QCCheck[] = [];

  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    if (entry.amount > 0) {
      totalDebit += entry.amount;
    } else {
      totalCredit += entry.amount;
    }
  }

  const difference = Math.abs(totalDebit + totalCredit);
  if (difference > 0.01) {
    checks.push({
      id: `unbalanced-${clientId}`,
      code: "LEDGER_UNBALANCED",
      name: "Ledger Unbalanced",
      severity: "error",
      message: `Ledger debit/credit imbalance of ${difference.toFixed(2)} (debit: ${totalDebit.toFixed(
        2
      )}, credit: ${Math.abs(totalCredit).toFixed(2)})`,
      context: {
        totalDebit,
        totalCredit,
        difference,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return checks;
}

export default dataQualityWorker;
