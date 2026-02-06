/**
 * Bank ETL Worker (PSD2)
 * Fetches account statements from Nordigen and normalizes to BankAccount + LedgerEntry
 * NOTE: Database operations are mocked - data is logged but not persisted
 */
import { Worker, Job } from "bullmq";
import axios from "axios";
import pino from "pino";
import { ETLJobPayload, BankTransactionZ } from "@aifm/shared";
import { redisConnection } from "../lib/queue";

const logger = pino();

const NORDIGEN_BASE_URL = "https://api.nordigen.com/api/v2";

// ============================================================================
// BANK WORKER
// ============================================================================

export const bankWorker = new Worker(
  "etl",
  async (job: Job<ETLJobPayload>) => {
    logger.info({ jobId: job.id, clientId: job.data.clientId }, "Starting Bank sync");

    const { clientId, period } = job.data;

    // Mock: Check for Bank DataFeed config (in production, fetch from DynamoDB)
    const requisitionId = process.env.NORDIGEN_REQUISITION_ID;
    
    if (!requisitionId) {
      logger.warn({ clientId }, "No Bank requisition configured - skipping");
      return { success: true, skipped: true };
    }

    try {
      // Get access token from Nordigen
      const token = await getTokenFromNordigen();

      // Get linked accounts
      const accounts = await getNordigeAccounts(token, requisitionId);
      logger.info({ count: accounts.length }, "Fetched bank accounts");

      // For each account, fetch transactions and balances
      for (const account of accounts) {
        const transactions = await getNordigeTransactions(
          token,
          account.id,
          period
        );
        const balance = await getNordigeBalance(token, account.id);

        logger.info(
          { accountId: account.id, txCount: transactions.length, balance: balance.balanceAmount.amount },
          "Fetched transactions - would persist to DynamoDB"
        );

        // Validate transactions
        for (const tx of transactions) {
          BankTransactionZ.parse(tx);
        }
      }

      logger.info({ clientId, accountsCount: accounts.length }, "Bank sync completed successfully");

      return {
        success: true,
        accountsCount: accounts.length,
        period,
      };
    } catch (error) {
      logger.error(
        { clientId, error: (error as Error).message },
        "Bank sync failed"
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
// NORDIGEN API HELPERS
// ============================================================================

async function getTokenFromNordigen(): Promise<string> {
  const secretId = process.env.NORDIGEN_SECRET_ID;
  const secretKey = process.env.NORDIGEN_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error("Nordigen credentials not configured");
  }

  try {
    const response = await axios.post(
      `${NORDIGEN_BASE_URL}/token/new/`,
      {
        secret_id: secretId,
        secret_key: secretKey,
      }
    );

    return response.data.access;
  } catch (error) {
    throw new Error(`Nordigen auth failed: ${(error as any).message}`);
  }
}

interface NordigeAccount {
  id: string;
  iban: string;
  currency?: string;
}

async function getNordigeAccounts(
  token: string,
  requisitionId: string
): Promise<NordigeAccount[]> {
  try {
    const response = await axios.get(
      `${NORDIGEN_BASE_URL}/requisitions/${requisitionId}/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const accountIds = response.data.accounts || [];

    const accounts = await Promise.all(
      accountIds.map((id: string) =>
        axios
          .get(`${NORDIGEN_BASE_URL}/accounts/${id}/details/`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => ({
            id,
            iban: res.data.account.iban,
            currency: res.data.account.currency,
          }))
      )
    );

    return accounts;
  } catch (error) {
    throw new Error(`Failed to get Nordigen accounts: ${(error as any).message}`);
  }
}

interface NordigeTransaction {
  transactionId?: string;
  bookingDate: string;
  amount: string;
  currency: string;
  description: string;
  counterpartyAccount?: string;
  counterpartyName?: string;
  reference?: string;
}

async function getNordigeTransactions(
  token: string,
  accountId: string,
  period: { start: Date; end: Date }
): Promise<NordigeTransaction[]> {
  try {
    const response = await axios.get(
      `${NORDIGEN_BASE_URL}/accounts/${accountId}/transactions/`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          date_from: period.start.toISOString().split("T")[0],
          date_to: period.end.toISOString().split("T")[0],
        },
      }
    );

    const txList = response.data.transactions?.booked || [];
    return txList.map((tx: any) => ({
      date: new Date(tx.bookingDate),
      amount: parseFloat(tx.transactionAmount.amount),
      currency: tx.transactionAmount.currency,
      description: tx.remittanceInformationUnstructured || "",
      counterpartyIban: tx.counterpartyAccount?.iban,
      counterpartyName: tx.counterpartyName,
      reference: tx.endToEndIdentification,
    }));
  } catch (error) {
    logger.warn(
      { accountId, error: (error as any).message },
      "Failed to get transactions"
    );
    return [];
  }
}

interface NordigeBalance {
  balanceAmount: { amount: number; currency: string };
}

async function getNordigeBalance(
  token: string,
  accountId: string
): Promise<NordigeBalance> {
  try {
    const response = await axios.get(
      `${NORDIGEN_BASE_URL}/accounts/${accountId}/balances/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const balance = response.data.balances?.[0];
    return {
      balanceAmount: {
        amount: parseFloat(balance.balanceAmount.amount),
        currency: balance.balanceAmount.currency,
      },
    };
  } catch (error) {
    throw new Error(`Failed to get balance: ${(error as any).message}`);
  }
}

export default bankWorker;
