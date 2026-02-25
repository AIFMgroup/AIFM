/**
 * NAV Calculation API
 *
 * Beräknar NAV via ISEC SECURA (primary) eller Fund Registry + PriceProvider.
 *
 * POST: Calculate NAV for a single fund/share class
 *   body: { fundId, shareClassId, navDate?, source?: 'isec' | 'registry' | 'auto' }
 *
 * GET: Run daily NAV for all funds
 *   ?date=YYYY-MM-DD&source=isec|registry|auto
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNAVService } from '@/lib/nav-engine/nav-service';
import { createNAVCalculator } from '@/lib/nav-engine/nav-calculator';
import type {
  NAVCalculationInput,
  NAVCalculationResult,
  PositionValuation,
  CashBalance as NAVCashBalance,
  AccruedFee,
  FXRate,
} from '@/lib/nav-engine/types';

// ============================================================================
// ISEC → NAV Engine bridge
// ============================================================================

async function calculateNAVFromISEC(
  fundId: string,
  shareClassId: string,
  navDate: string
): Promise<NAVCalculationResult | null> {
  const { getISECNAVCalculationData } = await import('@/lib/integrations/isec/isec-data-service');
  const data = await getISECNAVCalculationData(fundId, navDate);
  if (!data) return null;

  const sc = data.shareClasses.find(s => s.id === shareClassId) || data.shareClasses[0];
  if (!sc) return null;

  const mapInstrumentType = (t: string): PositionValuation['securityType'] => {
    const map: Record<string, PositionValuation['securityType']> = {
      equity: 'EQUITY', bond: 'BOND', etf: 'ETF', fund: 'FUND',
      derivative: 'DERIVATIVE', fx_forward: 'FX_FORWARD', cash: 'CASH',
    };
    return map[t.toLowerCase()] ?? 'OTHER';
  };

  const mapAssetClass = (t: string): PositionValuation['assetClass'] => {
    const map: Record<string, PositionValuation['assetClass']> = {
      equity: 'EQUITIES', etf: 'EQUITIES', bond: 'FIXED_INCOME',
      fund: 'FUNDS', derivative: 'DERIVATIVES', fx_forward: 'DERIVATIVES', cash: 'CASH',
    };
    return map[t.toLowerCase()] ?? 'OTHER';
  };

  const positions: PositionValuation[] = data.positions.map(p => ({
    positionId: p.id,
    securityId: p.securityId,
    isin: p.isin || p.securityId,
    name: p.securityName,
    securityType: mapInstrumentType(p.instrumentType),
    quantity: p.quantity,
    price: p.marketPrice,
    priceCurrency: p.priceCurrency,
    priceDate: p.priceDate || navDate,
    priceSource: p.priceSource || 'ISEC',
    marketValue: p.marketValue,
    marketValueFundCurrency: p.marketValue,
    accruedInterest: p.accruedInterest,
    assetClass: mapAssetClass(p.instrumentType),
    country: p.country,
    sector: p.sector,
  }));

  const cashBalances: NAVCashBalance[] = data.cashBalances.map(c => ({
    accountId: c.accountId,
    accountName: c.bankName,
    bankName: c.bankName,
    currency: c.currency,
    balance: c.balance,
    balanceFundCurrency: c.balance,
    valueDate: c.valueDate || navDate,
    accountType: 'CUSTODY' as const,
  }));

  const fxRates: FXRate[] = data.fxRates.map(r => ({
    baseCurrency: r.baseCurrency,
    quoteCurrency: r.quoteCurrency,
    rate: r.rate,
    rateDate: r.date,
    source: r.source,
  }));

  const mapFeeType = (t: string): AccruedFee['feeType'] => {
    const map: Record<string, AccruedFee['feeType']> = {
      management: 'MANAGEMENT_FEE', management_fee: 'MANAGEMENT_FEE',
      performance: 'PERFORMANCE_FEE', performance_fee: 'PERFORMANCE_FEE',
      depositary: 'DEPOSITARY_FEE', depositary_fee: 'DEPOSITARY_FEE',
      admin: 'ADMIN_FEE', admin_fee: 'ADMIN_FEE',
      audit: 'AUDIT_FEE', audit_fee: 'AUDIT_FEE',
      tax: 'TAX',
    };
    return map[t.toLowerCase()] ?? 'OTHER';
  };

  const accruedFees: AccruedFee[] = data.accruedFees.map(f => ({
    feeType: mapFeeType(f.feeType),
    periodStart: f.periodStart || navDate,
    periodEnd: f.periodEnd || navDate,
    annualRate: f.annualRate,
    baseAmount: 0,
    accruedAmount: f.accruedAmount,
    currency: f.currency,
  }));

  const sharesOutstanding = sc.outstandingShares || data.shareholders.reduce((s, sh) => s + sh.shares, 0) || 1_000_000;

  const input: NAVCalculationInput = {
    fundId,
    shareClassId: sc.id,
    navDate,
    positions,
    cashBalances,
    receivables: [],
    liabilities: [],
    accruedFees,
    pendingRedemptions: [],
    sharesOutstanding,
    fxRates,
    fundCurrency: data.currency,
    managementFeeRate: sc.managementFee,
    performanceFeeRate: sc.performanceFee,
  };

  const calculator = createNAVCalculator();
  const result = calculator.calculate(input);

  // Override NAV per share with ISEC's authoritative value if available
  if (sc.navPerShare && sc.navPerShare > 0) {
    result.calculationDetails.push({
      step: 'ISEC_REFERENCE',
      description: 'ISEC SECURA referensvärde jämfört med beräknat',
      inputValues: { calculated: result.navPerShare, isecReference: sc.navPerShare },
      outputValue: sc.navPerShare,
      formula: 'Referensvärde från ISEC SECURA fondadministration',
    });
  }

  return result;
}

// ============================================================================
// POST - Calculate NAV for a single fund/share class
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundId, shareClassId, navDate, source = 'auto' } = body;

    if (!fundId || !shareClassId) {
      return NextResponse.json(
        { success: false, error: 'fundId and shareClassId are required' },
        { status: 400 }
      );
    }

    const date = navDate || new Date().toISOString().split('T')[0];

    // Try ISEC first
    if (source === 'isec' || source === 'auto') {
      try {
        const result = await calculateNAVFromISEC(fundId, shareClassId, date);
        if (result) {
          return NextResponse.json({ success: true, result, source: 'isec' });
        }
      } catch (err) {
        console.warn('[NAV Calculate API] ISEC calculation failed, trying registry:', err);
      }
    }

    // Fallback to Fund Registry
    const navService = getNAVService();
    const result = await navService.calculateNAV(fundId, shareClassId, date);

    return NextResponse.json({ success: true, result, source: 'fund_registry' });
  } catch (error) {
    console.error('[NAV Calculate API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate NAV', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Run daily NAV for all funds
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const navDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const source = searchParams.get('source') || 'auto';

    // Try ISEC for all funds
    if (source === 'isec' || source === 'auto') {
      try {
        const { getAllISECNAVData } = await import('@/lib/integrations/isec/isec-data-service');
        const allData = await getAllISECNAVData();

        if (allData.length > 0) {
          const results: Record<string, NAVCalculationResult> = {};
          let completedFunds = 0;
          let failedFunds = 0;
          const errors: string[] = [];

          for (const fundData of allData) {
            for (const sc of fundData.shareClasses) {
              try {
                const calcResult = await calculateNAVFromISEC(fundData.fundId, sc.id, navDate);
                if (calcResult) {
                  results[`${fundData.fundId}/${sc.id}`] = calcResult;
                  completedFunds++;
                }
              } catch (err) {
                failedFunds++;
                errors.push(`${fundData.fundId}/${sc.id}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }

          if (completedFunds > 0) {
            return NextResponse.json({
              success: true,
              source: 'isec',
              run: {
                runId: `ISEC-NAV-${navDate}-${Date.now()}`,
                navDate,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                status: failedFunds > 0 ? 'FAILED' : 'AWAITING_APPROVAL',
                fundResults: results,
                totalFunds: completedFunds + failedFunds,
                completedFunds,
                failedFunds,
                errors,
              },
            });
          }
        }
      } catch (err) {
        console.warn('[NAV Calculate API] ISEC daily run failed, falling back:', err);
      }
    }

    // Fallback to registry-based calculation
    const navService = getNAVService();
    const run = await navService.runDailyNAV(navDate);

    const results: Record<string, unknown> = {};
    run.fundResults.forEach((value, key) => {
      results[key] = value;
    });

    return NextResponse.json({
      success: run.status !== 'FAILED',
      source: 'fund_registry',
      run: { ...run, fundResults: results },
    });
  } catch (error) {
    console.error('[NAV Calculate API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run daily NAV', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
