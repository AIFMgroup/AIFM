/**
 * NAV Reconciliation API
 *
 * Compares Fund Registry positions/cash with SEB bank custody data.
 * Returns a structured ReconciliationResult with position-by-position comparison.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getFundRegistry } from '@/lib/fund-registry';
import { getSEBClient } from '@/lib/integrations/bank/seb-client';

// ============================================================================
// Types
// ============================================================================

interface PositionComparison {
  isin: string;
  instrumentName: string;
  registry: { quantity: number; price: number; value: number } | null;
  bank: { quantity: number; price: number; value: number; source: string } | null;
  differences: {
    quantityDiff: number;
    quantityDiffPercent: number;
    priceDiff: number;
    priceDiffPercent: number;
    valueDiff: number;
    valueDiffPercent: number;
  };
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'MISSING_REGISTRY' | 'MISSING_BANK';
  flags: string[];
}

interface CashComparison {
  currency: string;
  registryBalance: number;
  bankBalance: number;
  difference: number;
  differencePercent: number;
  status: string;
  flags: string[];
}

interface ReconciliationResult {
  fundId: string;
  fundName: string;
  reconciliationDate: string;
  generatedAt: string;
  summary: {
    totalPositions: number;
    matchingPositions: number;
    minorDifferences: number;
    majorDifferences: number;
    missingInRegistry: number;
    missingInBank: number;
    registryTotalValue: number;
    bankTotalValue: number;
    totalValueDifference: number;
    totalValueDifferencePercent: number;
    overallStatus: 'APPROVED' | 'REVIEW_REQUIRED' | 'FAILED';
  };
  cashComparison: CashComparison;
  positions: PositionComparison[];
  flags: { level: string; message: string; details?: string }[];
  sources: {
    registry: { timestamp: string; dataPoints: number };
    bank: { source: string; timestamp: string; dataPoints: number };
  };
}

// ============================================================================
// Thresholds
// ============================================================================

const MINOR_DIFF_THRESHOLD = 0.01; // 1%
const MAJOR_DIFF_THRESHOLD = 0.05; // 5%

function pctDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100;
  return ((a - b) / Math.abs(b)) * 100;
}

function classifyDiff(pct: number): PositionComparison['status'] {
  const absPct = Math.abs(pct);
  if (absPct <= MINOR_DIFF_THRESHOLD) return 'MATCH';
  if (absPct <= MAJOR_DIFF_THRESHOLD) return 'MINOR_DIFF';
  return 'MAJOR_DIFF';
}

// ============================================================================
// POST /api/nav-reconciliation
// ============================================================================

export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fundId, date } = body;

    if (!fundId) {
      return NextResponse.json({ error: 'fundId krävs' }, { status: 400 });
    }

    const reconciliationDate = date || new Date().toISOString().split('T')[0];

    // ---- Fund Registry data ----
    const registry = getFundRegistry();
    const fund = await registry.getFund(fundId);
    if (!fund) {
      return NextResponse.json({ error: `Fond ${fundId} hittades inte i Fund Registry` }, { status: 404 });
    }

    const regPositions = await registry.getPositions(fundId, reconciliationDate);
    const regCash = await registry.getCashBalances(fundId, reconciliationDate);

    // ---- SEB bank data ----
    const seb = getSEBClient();
    const sebAccountId = seb.getAccountIdForFund(fundId);

    let bankPositions: Awaited<ReturnType<typeof seb.getCustodyPositions>> = [];
    let bankBalances: Awaited<ReturnType<typeof seb.getAccountBalances>> = [];
    let bankSource = 'SEB Global Custody';

    if (sebAccountId) {
      try {
        [bankPositions, bankBalances] = await Promise.all([
          seb.getCustodyPositions(sebAccountId),
          seb.getAccountBalances([sebAccountId]),
        ]);
      } catch (err) {
        console.warn('[Reconciliation] SEB fetch failed, using empty bank data:', err);
        bankSource = 'SEB (ej tillgänglig)';
      }
    } else {
      bankSource = 'SEB (inget konto mappat)';
    }

    // ---- Build position map (ISIN -> bank) ----
    const bankPosMap = new Map<string, (typeof bankPositions)[number]>();
    for (const bp of bankPositions) {
      bankPosMap.set(bp.isin, bp);
    }

    // ---- Compare positions ----
    const positionComparisons: PositionComparison[] = [];
    const matchedIsins = new Set<string>();

    for (const rp of regPositions) {
      const isin = rp.isin ?? rp.instrumentId;
      matchedIsins.add(isin);
      const bp = bankPosMap.get(isin);

      const regVal = { quantity: rp.quantity, price: rp.marketPrice, value: rp.marketValueBase ?? rp.marketValue };

      if (!bp) {
        positionComparisons.push({
          isin,
          instrumentName: rp.instrumentName,
          registry: regVal,
          bank: null,
          differences: { quantityDiff: 0, quantityDiffPercent: 0, priceDiff: 0, priceDiffPercent: 0, valueDiff: 0, valueDiffPercent: 0 },
          status: 'MISSING_BANK',
          flags: ['Position saknas hos banken'],
        });
        continue;
      }

      const bankVal = { quantity: bp.quantity, price: bp.marketPrice, value: bp.marketValue, source: bankSource };
      const vPct = pctDiff(regVal.value, bankVal.value);

      positionComparisons.push({
        isin,
        instrumentName: rp.instrumentName,
        registry: regVal,
        bank: bankVal,
        differences: {
          quantityDiff: regVal.quantity - bankVal.quantity,
          quantityDiffPercent: pctDiff(regVal.quantity, bankVal.quantity),
          priceDiff: regVal.price - bankVal.price,
          priceDiffPercent: pctDiff(regVal.price, bankVal.price),
          valueDiff: regVal.value - bankVal.value,
          valueDiffPercent: vPct,
        },
        status: classifyDiff(vPct),
        flags: Math.abs(vPct) > MAJOR_DIFF_THRESHOLD * 100 ? ['Stor avvikelse i marknadsvärde'] : [],
      });
    }

    // Positions only in bank
    for (const bp of bankPositions) {
      if (!matchedIsins.has(bp.isin)) {
        positionComparisons.push({
          isin: bp.isin,
          instrumentName: bp.instrumentName,
          registry: null,
          bank: { quantity: bp.quantity, price: bp.marketPrice, value: bp.marketValue, source: bankSource },
          differences: { quantityDiff: 0, quantityDiffPercent: 0, priceDiff: 0, priceDiffPercent: 0, valueDiff: 0, valueDiffPercent: 0 },
          status: 'MISSING_REGISTRY',
          flags: ['Position saknas i Fund Registry'],
        });
      }
    }

    // ---- Cash comparison ----
    const regCashTotal = regCash.reduce((s, c) => s + (c.balanceBase ?? c.balance), 0);
    const bankCashTotal = bankBalances.reduce((s, b) => s + b.bookedBalance, 0);
    const cashPct = pctDiff(regCashTotal, bankCashTotal);
    const cashComparison: CashComparison = {
      currency: fund.currency,
      registryBalance: regCashTotal,
      bankBalance: bankCashTotal,
      difference: regCashTotal - bankCashTotal,
      differencePercent: cashPct,
      status: classifyDiff(cashPct),
      flags: [],
    };

    // ---- Summary ----
    const registryTotalValue = positionComparisons.reduce((s, p) => s + (p.registry?.value ?? 0), 0) + regCashTotal;
    const bankTotalValue = positionComparisons.reduce((s, p) => s + (p.bank?.value ?? 0), 0) + bankCashTotal;
    const matching = positionComparisons.filter(p => p.status === 'MATCH').length;
    const minor = positionComparisons.filter(p => p.status === 'MINOR_DIFF').length;
    const major = positionComparisons.filter(p => p.status === 'MAJOR_DIFF').length;
    const missingReg = positionComparisons.filter(p => p.status === 'MISSING_REGISTRY').length;
    const missingBank = positionComparisons.filter(p => p.status === 'MISSING_BANK').length;
    const totalDiff = registryTotalValue - bankTotalValue;
    const totalDiffPct = bankTotalValue > 0 ? (totalDiff / bankTotalValue) * 100 : 0;

    let overallStatus: 'APPROVED' | 'REVIEW_REQUIRED' | 'FAILED' = 'APPROVED';
    if (major > 0 || missingReg > 0 || missingBank > 0) overallStatus = 'FAILED';
    else if (minor > 0) overallStatus = 'REVIEW_REQUIRED';

    const globalFlags: { level: string; message: string; details?: string }[] = [];
    if (major > 0) globalFlags.push({ level: 'ERROR', message: `${major} positioner med stora avvikelser` });
    if (minor > 0) globalFlags.push({ level: 'WARNING', message: `${minor} positioner med mindre avvikelser` });
    if (matching === positionComparisons.length && positionComparisons.length > 0) {
      globalFlags.push({ level: 'INFO', message: 'Alla positioner matchar' });
    }

    const result: ReconciliationResult = {
      fundId: fund.id,
      fundName: fund.name,
      reconciliationDate,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPositions: positionComparisons.length,
        matchingPositions: matching,
        minorDifferences: minor,
        majorDifferences: major,
        missingInRegistry: missingReg,
        missingInBank: missingBank,
        registryTotalValue,
        bankTotalValue,
        totalValueDifference: totalDiff,
        totalValueDifferencePercent: totalDiffPct,
        overallStatus,
      },
      cashComparison,
      positions: positionComparisons,
      flags: globalFlags,
      sources: {
        registry: { timestamp: new Date().toISOString(), dataPoints: regPositions.length },
        bank: { source: bankSource, timestamp: new Date().toISOString(), dataPoints: bankPositions.length },
      },
    };

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[NAV Reconciliation] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Kunde inte köra avstämning' },
      { status: 500 }
    );
  }
}
