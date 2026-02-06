/**
 * Fortnox ETL Worker
 * Fetches vouchers from Fortnox API and normalizes to LedgerEntry
 * NOTE: Database operations are mocked - data is logged but not persisted
 */
import { Worker, Job } from "bullmq";
import axios from "axios";
import pino from "pino";
import { ETLJobPayload, LedgerEntry, LedgerEntryZ } from "@aifm/shared";
import { redisConnection } from "../lib/queue";

const logger = pino();

const FORTNOX_BASE_URL = "https://api.fortnox.se/3";

// Mock data store (in production, use AWS DynamoDB)
const mockDataFeeds = new Map<string, { id: string; clientId: string; source: string; configJson: any; status: string }>();

// ============================================================================
// FORTNOX WORKER
// ============================================================================

export const fortnoxWorker = new Worker(
  "etl",
  async (job: Job<ETLJobPayload>) => {
    logger.info({ jobId: job.id, clientId: job.data.clientId }, "Starting Fortnox sync");

    const { clientId, period } = job.data;

    // Mock: Get DataFeed config (in production, fetch from DynamoDB)
    const dataFeed = mockDataFeeds.get(`${clientId}-FORTNOX`) || {
      id: `${clientId}-fortnox-feed`,
      clientId,
      source: "FORTNOX",
      configJson: { apiKey: process.env.FORTNOX_API_KEY },
      status: "ACTIVE",
    };

    const config = dataFeed.configJson as any;
    const apiKey = config.apiKey;
    
    if (!apiKey) {
      logger.warn({ clientId }, "Fortnox API key not configured - using mock data");
      return {
        success: true,
        entriesCount: 0,
        period,
        mock: true,
      };
    }

    try {
      // Fetch vouchers from Fortnox
      const vouchers = await fetchFortnoxVouchers(apiKey, period);
      logger.info({ count: vouchers.length }, "Fetched vouchers from Fortnox");

      // Normalize to LedgerEntry
      const entries: LedgerEntry[] = vouchers.map(normalizeFortnoxVoucher);

      // Validate using Zod
      const validatedEntries = entries.map((e) => LedgerEntryZ.parse(e));

      // Log entries (in production, persist to DynamoDB)
      logger.info(
        { clientId, entriesCount: validatedEntries.length },
        "Fortnox sync completed - entries would be persisted to DynamoDB"
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
        fromDate: period.start.toISOString().split("T")[0],
        toDate: period.end.toISOString().split("T")[0],
      },
    });

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
  }))[0];
}

export default fortnoxWorker;
