/**
 * SEB Custody Data Sync Service
 *
 * Daglig synk av positioner och kassor från SEB Custody API till Fund Registry.
 * Används av NAV-pipelinen före NAV-beräkning.
 *
 * Kräver: SEB_CLIENT_ID, SEB_CLIENT_SECRET, SEB_FUND_ACCOUNT_MAPPINGS (JSON)
 */

import { SEBClient, type FundAccountMapping, type SEBCustodyPosition, type SEBAccountBalance } from './seb-client';
import { getFundRegistry } from '@/lib/fund-registry';
import type { Position, CashBalance } from '@/lib/fund-registry/types';
import type { InstrumentType } from '@/lib/fund-registry/types';

const MAPPINGS_ENV = 'SEB_FUND_ACCOUNT_MAPPINGS';

function parseMappings(): FundAccountMapping[] {
  const raw = process.env[MAPPINGS_ENV];
  if (!raw || raw.trim() === '') return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (m): m is FundAccountMapping =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as FundAccountMapping).fundId === 'string' &&
        typeof (m as FundAccountMapping).sebAccountId === 'string'
    );
  } catch {
    return [];
  }
}

function mapSebInstrumentType(sebType: string): InstrumentType {
  const map: Record<string, InstrumentType> = {
    EQUITY: 'equity',
    BOND: 'bond',
    FUND: 'fund',
    DERIVATIVE: 'derivative',
    OTHER: 'other',
  };
  return map[sebType] ?? 'other';
}

export interface SEBSyncResult {
  date: string;
  fundsSynced: number;
  positionsWritten: number;
  cashBalancesWritten: number;
  errors: string[];
}

/**
 * Sync positions and cash from SEB Custody API to Fund Registry for a given date.
 * Uses SEB_FUND_ACCOUNT_MAPPINGS (JSON array of { fundId, sebAccountId }) to know which SEB account belongs to which fund.
 */
export async function syncSEBCustodyToRegistry(asOfDate?: string): Promise<SEBSyncResult> {
  const date = asOfDate ?? new Date().toISOString().split('T')[0];
  const errors: string[] = [];
  let positionsWritten = 0;
  let cashBalancesWritten = 0;

  const mappings = parseMappings();
  if (mappings.length === 0) {
    return {
      date,
      fundsSynced: 0,
      positionsWritten: 0,
      cashBalancesWritten: 0,
      errors: ['SEB sync skipped: SEB_FUND_ACCOUNT_MAPPINGS not set or invalid (JSON array of { fundId, sebAccountId })'],
    };
  }

  const client = new SEBClient();
  if (!process.env.SEB_CLIENT_ID || !process.env.SEB_CLIENT_SECRET) {
    return {
      date,
      fundsSynced: 0,
      positionsWritten: 0,
      cashBalancesWritten: 0,
      errors: ['SEB sync skipped: SEB_CLIENT_ID and SEB_CLIENT_SECRET required'],
    };
  }

  // Apply mappings to client so getCustodyPositions/getAccountBalances use them
  mappings.forEach((m) => client.setFundMapping(m));

  const registry = getFundRegistry();

  for (const mapping of mappings) {
    const { fundId, sebAccountId } = mapping;
    try {
      const fund = await registry.getFund(fundId);
      if (!fund) {
        errors.push(`Fund ${fundId} not found in registry; skipping SEB account ${sebAccountId}`);
        continue;
      }
      const fundCurrency = fund.currency;

      const [positions, balances] = await Promise.all([
        client.getCustodyPositions(sebAccountId),
        client.getAccountBalances([sebAccountId]),
      ]);

      await registry.clearPositions(fundId, date);
      const registryPositions: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>[] = positions.map(
        (p: SEBCustodyPosition) => ({
          fundId,
          date,
          instrumentId: p.isin,
          instrumentName: p.instrumentName,
          instrumentType: mapSebInstrumentType(p.instrumentType),
          isin: p.isin,
          quantity: p.quantity,
          currency: p.currency as Position['currency'],
          marketPrice: p.marketPrice,
          marketValue: p.marketValue,
          marketValueBase: p.currency === fundCurrency ? p.marketValue : p.marketValue, // NAV service will apply FX
          source: 'custodian' as const,
          priceSource: 'seb',
        })
      );
      await registry.setPositions(fundId, date, registryPositions);
      positionsWritten += registryPositions.length;

      await registry.clearCashBalances(fundId, date);
      for (const b of balances as SEBAccountBalance[]) {
        if (b.accountId !== sebAccountId) continue;
        const cash: Omit<CashBalance, 'id' | 'createdAt' | 'updatedAt'> = {
          fundId,
          date,
          currency: b.currency as CashBalance['currency'],
          balance: b.availableBalance,
          balanceBase: b.currency === fundCurrency ? b.availableBalance : b.availableBalance,
          availableBalance: b.availableBalance,
          pendingInflows: 0,
          pendingOutflows: 0,
          reservedAmount: 0,
          source: 'custodian',
        };
        await registry.setCashBalance(cash);
        cashBalancesWritten += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`SEB sync failed for fund ${fundId} (${sebAccountId}): ${msg}`);
    }
  }

  return {
    date,
    fundsSynced: mappings.length - errors.length,
    positionsWritten,
    cashBalancesWritten,
    errors,
  };
}
