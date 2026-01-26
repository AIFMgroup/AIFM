/**
 * Fortnox ETL Worker
 * Fetches vouchers from Fortnox API and normalizes to LedgerEntry
 */
import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import pino from "pino";
import { ETLJobPayload, LedgerEntry, LedgerEntryZ } from "@aifm/shared";
import { redisConnection } from "../lib/queue";

const logger = pino();
const prisma = new PrismaClient();

const FORTNOX_BASE_URL = "https://api.fortnox.se/3";

// ============================================================================
// FORTNOX WORKER
// ============================================================================

export const fortnoxWorker = new Worker(
  "etl",
  async (job: Job<ETLJobPayload>) => {
    logger.info({ jobId: job.id, clientId: job.data.clientId }, "Starting Fortnox sync");

    const { clientId, period } = job.data;

    // Get DataFeed config with API key
    const dataFeed = await prisma.dataFeed.findFirst({
      where: {
        clientId,
        source: "FORTNOX",
      },
    });

    if (!dataFeed) {
      throw new Error(`No Fortnox DataFeed configured for client ${clientId}`);
    }

    const config = dataFeed.configJson as any;
    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new Error("Fortnox API key not configured");
    }

    try {
      // Fetch vouchers from Fortnox
      const vouchers = await fetchFortnoxVouchers(apiKey, period);
      logger.info({ count: vouchers.length }, "Fetched vouchers from Fortnox");

      // Normalize to LedgerEntry
      const entries: LedgerEntry[] = vouchers.map(normalizeFortnoxVoucher);

      // Validate using Zod
      const validatedEntries = entries.map((e) => LedgerEntryZ.parse(e));

      // Insert into DB (upsert to avoid duplicates)
      for (const entry of validatedEntries) {
        await prisma.ledgerEntry.upsert({
          where: {
            // Composite key: clientId + source + bookingDate + account + amount
            // For demo, use a hash instead
            id: `${clientId}-fortnox-${entry.bookingDate}-${entry.account}-${entry.amount}`,
          },
          update: { ...entry },
          create: { ...entry, id: `${clientId}-fortnox-${entry.bookingDate}-${entry.account}-${entry.amount}` },
        });
      }

      // Update DataFeed sync status
      await prisma.dataFeed.update({
        where: { id: dataFeed.id },
        data: {
          lastSyncAt: new Date(),
          status: "ACTIVE",
          lastError: null,
        },
      });

      logger.info(
        { clientId, entriesCount: validatedEntries.length },
        "Fortnox sync completed successfully"
      );

      return {
        success: true,
        entriesCount: validatedEntries.length,
        period,
      };
    } catch (error) {
      logger.error(
        { clientId, error: (error as Error).message },
        "Fortnox sync failed"
      );

      // Update DataFeed with error
      await prisma.dataFeed.update({
        where: { id: dataFeed.id },
        data: {
          status: "ERROR",
          lastError: (error as Error).message,
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

// ============================================================================
// FORTNOX API HELPERS
// ============================================================================

async function fetchFortnoxVouchers(apiKey: string, period: { start: Date; end: Date }) {
  try {
    const response = await axios.get(`${FORTNOX_BASE_URL}/vouchers`, {
      headers: {
        "X-API-Version": "1.0",
        Authorization: `Bearer ${apiKey}`,
      },
      params: {
        // Filter by period (example - adjust based on Fortnox API)
        fromDate: period.start.toISOString().split("T")[0],
        toDate: period.end.toISOString().split("T")[0],
      },
    });

    // Fortnox returns { Vouchers: [...] }
    return response.data.Vouchers || [];
  } catch (error) {
    logger.error({ error }, "Failed to fetch vouchers from Fortnox");
    throw new Error(`Fortnox API error: ${(error as any).message}`);
  }
}

interface FortnoxVoucher {
  VoucherNumber: number;
  VoucherDate: string;
  VoucherLine: Array<{
    LineNumber: number;
    AccountNumber: string;
    Debit?: number;
    Credit?: number;
    Description?: string;
  }>;
  Description?: string;
}

function normalizeFortnoxVoucher(voucher: FortnoxVoucher): Partial<LedgerEntry> {
  // Flatten voucher lines to individual LedgerEntry records
  return (voucher.VoucherLine || []).map((line) => ({
    bookingDate: new Date(voucher.VoucherDate),
    account: line.AccountNumber,
    amount: line.Debit || -(line.Credit || 0),
    currency: "SEK",
    source: "FORTNOX" as const,
    description: line.Description || voucher.Description,
    meta: {
      voucherNumber: voucher.VoucherNumber,
      lineNumber: line.LineNumber,
    },
  }))[0]; // Return first (in prod, this would return array and caller would flatten)
}

// Export worker for main process
export default fortnoxWorker;
