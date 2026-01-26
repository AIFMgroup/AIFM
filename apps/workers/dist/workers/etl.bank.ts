/**
 * Bank ETL Worker (PSD2)
 * Fetches account statements from Nordigen and normalizes to BankAccount + LedgerEntry
 */
import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import pino from "pino";
import { ETLJobPayload, BankTransactionZ } from "@aifm/shared";
import { redisConnection } from "../lib/queue";

const logger = pino();
const prisma = new PrismaClient();

const NORDIGEN_BASE_URL = "https://api.nordigen.com/api/v2";

// ============================================================================
// BANK WORKER
// ============================================================================

export const bankWorker = new Worker(
  "etl",
  async (job: Job<ETLJobPayload>) => {
    logger.info({ jobId: job.id, clientId: job.data.clientId }, "Starting Bank sync");

    const { clientId, period } = job.data;

    // Get DataFeed config
    const dataFeed = await prisma.dataFeed.findFirst({
      where: {
        clientId,
        source: "BANK",
      },
    });

    if (!dataFeed) {
      logger.warn({ clientId }, "No Bank DataFeed configured");
      return { success: true, skipped: true };
    }

    const config = dataFeed.configJson as any;
    const requisitionId = config.requisitionId; // Nordigen requisition linking accounts
    if (!requisitionId) {
      throw new Error("Bank requisition not configured");
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
          { accountId: account.id, txCount: transactions.length },
          "Fetched transactions"
        );

        // Upsert BankAccount
        const bankAccount = await prisma.bankAccount.upsert({
          where: {
            id: `${clientId}-${account.iban}`,
          },
          update: {
            balance: balance.balanceAmount.amount,
            syncedAt: new Date(),
          },
          create: {
            clientId,
            iban: account.iban,
            currency: account.currency || "EUR",
            balance: balance.balanceAmount.amount,
            syncedAt: new Date(),
            id: `${clientId}-${account.iban}`,
          },
        });

        // Insert transactions as LedgerEntry (bank source)
        for (const tx of transactions) {
          const entry = BankTransactionZ.parse(tx);

          await prisma.ledgerEntry.upsert({
            where: {
              id: `${clientId}-bank-${entry.date}-${entry.iban}-${entry.amount}`,
            },
            update: { ...entry, clientId, source: "BANK" },
            create: {
              id: `${clientId}-bank-${entry.date}-${entry.iban}-${entry.amount}`,
              clientId,
              source: "BANK",
              bookingDate: entry.date,
              account: entry.iban,
              amount: entry.amount,
              currency: entry.currency,
              description: entry.description,
              meta: {
                reference: entry.reference,
                counterpartyIban: entry.counterpartyIban,
                counterpartyName: entry.counterpartyName,
              },
            },
          });
        }
      }

      // Update DataFeed
      await prisma.dataFeed.update({
        where: { id: dataFeed.id },
        data: {
          lastSyncAt: new Date(),
          status: "ACTIVE",
          lastError: null,
        },
      });

      logger.info({ clientId }, "Bank sync completed successfully");

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

    // Get accounts from requisition
    const accountIds = response.data.accounts || [];

    // Fetch account details
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
    return []; // Graceful degrade
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
