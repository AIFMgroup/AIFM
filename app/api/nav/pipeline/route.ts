/**
 * NAV Daily Pipeline API
 *
 * POST /api/nav/pipeline
 *
 * Orchestrates the full daily NAV process:
 * 1. Import NAV prices (from CSV or already-imported data)
 * 2. Import Sub/Red flows (from XLS or already-imported data)
 * 3. Fetch FX rates from ECB
 * 4. Run NAV calculation for all AuAg funds
 * 5. Run compliance checks
 * 6. Create approval request (4-eye principle)
 * 7. Wait for manual approval
 * 8. After approval → distribute (NAV prices, Notor, compliance email)
 *
 * GET /api/nav/pipeline?date=YYYY-MM-DD
 * Returns pipeline status for a given date.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUAG_FUNDS, getAllShareClasses } from '@/lib/nav-engine/auag-funds';
import { getNAVPricesStore, getFlowsStore, getPipelineStore, type PipelineRun, type PipelineStep } from '@/lib/nav-engine/flows-store';
import { getNAVRecordStore, getNAVApprovalStore, getNAVRunStore, type NAVRecord } from '@/lib/nav-engine/nav-store';
import type { NAVCalculationResult } from '@/lib/nav-engine/types';
import { sendApprovalNotification } from '@/lib/nav-engine/email-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ============================================================================
// Auth
// ============================================================================

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.AIFM_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-aifm-cron-secret') === secret;
}

// ============================================================================
// POST — Run daily pipeline
// ============================================================================

interface PipelineRequest {
  navDate?: string;
  csvContent?: string;
  subRedRows?: (string | number | null)[][];
  navDetailRows?: (string | number | null)[][];
  skipFxFetch?: boolean;
  source?: 'auto' | 'isec' | 'csv';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cronOk = isAuthorizedCron(request);
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!cronOk && !authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PipelineRequest = await request.json().catch(() => ({}));
    const navDate = body.navDate || new Date().toISOString().split('T')[0];

    // Create pipeline run
    const pipelineStore = getPipelineStore();
    const run = await pipelineStore.createRun(navDate);

    try {
      // Step 1: Import NAV prices (ISEC → CSV → existing)
      await runStep(run, 0, async () => {
        const pipelineSource = body.source || 'auto';

        // 1a) Try ISEC SECURA as primary data source
        if (pipelineSource === 'isec' || pipelineSource === 'auto') {
          try {
            const { getAllISECNAVData } = await import('@/lib/integrations/isec/isec-data-service');
            const isecFunds = await getAllISECNAVData();
            if (isecFunds.length > 0) {
              let imported = 0;
              for (const fund of isecFunds) {
                for (const sc of fund.shareClasses) {
                  if (sc.navPerShare && sc.navPerShare > 0) {
                    const positionsTotal = fund.positions.reduce((s, p) => s + p.marketValue, 0);
                    const cashTotal = fund.cashBalances.reduce((s, c) => s + c.balance, 0);
                    await getNAVPricesStore().savePrice({
                      navDate,
                      fundId: fund.fundId,
                      shareClassId: sc.id,
                      isin: sc.isin,
                      fundName: fund.fundName,
                      shareClassName: sc.name,
                      currency: sc.currency,
                      navPerShare: sc.navPerShare,
                      totalNetAssets: sc.totalNav || (positionsTotal + cashTotal),
                      sharesOutstanding: sc.outstandingShares || 0,
                      changePercent: 0,
                      source: 'ISEC',
                    });
                    imported++;
                  }
                }
              }
              if (imported > 0) {
                (run as any)._isecSource = true;
                return `${imported} priser importerade från ISEC SECURA (${isecFunds.length} fonder)`;
              }
            }
          } catch (err) {
            console.warn('[Pipeline] ISEC import failed, trying CSV fallback:', err);
          }
        }

        // 1b) CSV import
        if (body.csvContent) {
          const { parseAuAgNAVCSV } = await import('@/lib/nav-engine/ingest');
          const result = parseAuAgNAVCSV(body.csvContent);
          if (result.data.length > 0) {
            const stored = await getNAVPricesStore().savePricesFromCSV(result.data as import('@/lib/nav-engine/ingest').ParsedNAVPrice[]);
            return `${stored} priser importerade från CSV`;
          }
          return `CSV parsad men inga priser hittades`;
        }

        // 1c) Check existing
        const existing = await getNAVPricesStore().getPricesByDate(navDate);
        if (existing.length > 0) {
          return `${existing.length} priser redan importerade`;
        }
        return 'Inga priser att importera (ISEC ej tillgängligt, skicka csvContent eller importera via /api/nav/ingest först)';
      });

      // Step 2: Import NAV details (XLS)
      await runStep(run, 1, async () => {
        if (body.navDetailRows && body.navDetailRows.length > 1) {
          const { parseNAVDetailRows } = await import('@/lib/nav-engine/ingest');
          const result = parseNAVDetailRows(body.navDetailRows, navDate);
          if (result.data.length > 0) {
            const stored = await getNAVPricesStore().savePricesFromDetail(result.data as import('@/lib/nav-engine/ingest').ParsedNAVDetail[]);
            return `${stored} NAV-detaljer importerade`;
          }
        }
        return 'Inga NAV-detaljer att importera (valfritt steg)';
      });

      // Step 3: Import Sub/Red flows
      await runStep(run, 2, async () => {
        if (body.subRedRows && body.subRedRows.length > 1) {
          const { parseSubRedRows } = await import('@/lib/nav-engine/ingest');
          const result = parseSubRedRows(body.subRedRows, navDate);
          if (result.data.length > 0) {
            const stored = await getFlowsStore().saveFlows(result.data as import('@/lib/nav-engine/ingest').ParsedSubRedEntry[]);
            return `${stored} Sub/Red-transaktioner importerade`;
          }
        }
        // Check existing
        const existing = await getFlowsStore().getFlowsByDate(navDate);
        if (existing.length > 0) {
          return `${existing.length} transaktioner redan importerade`;
        }
        return 'Inga Sub/Red-transaktioner (kan vara 0 för dagen)';
      });

      // Step 4: Fetch FX rates
      await runStep(run, 3, async () => {
        if (body.skipFxFetch) return 'FX-hämtning överhoppad';
        try {
          const fxRes = await fetch(`${getBaseUrl(request)}/api/nav/fx-rates?base=SEK&action=common`, {
            headers: { Cookie: request.headers.get('cookie') || '' },
          });
          if (fxRes.ok) {
            const fxData = await fxRes.json();
            return `FX-kurser hämtade: ${fxData.rates?.length ?? 0} par`;
          }
          return 'FX-hämtning misslyckades (använder cachade kurser)';
        } catch {
          return 'FX-hämtning misslyckades (använder cachade kurser)';
        }
      });

      // Step 5: Build NAV records — full ISEC calculation or import-based
      await runStep(run, 4, async () => {
        const prices = await getNAVPricesStore().getPricesByDate(navDate);
        if (prices.length === 0) {
          throw new Error('Inga priser importerade för detta datum — kan inte beräkna NAV');
        }

        const results: NAVCalculationResult[] = [];
        const isFromISEC = (run as any)._isecSource === true;

        if (isFromISEC) {
          // Use full NAV calculation engine with ISEC data
          const { createNAVCalculator } = await import('@/lib/nav-engine/nav-calculator');
          const { getISECNAVCalculationData } = await import('@/lib/integrations/isec/isec-data-service');

          for (const price of prices) {
            try {
              const isecData = await getISECNAVCalculationData(price.fundId, navDate);
              if (isecData) {
                const sc = isecData.shareClasses.find(s => s.id === price.shareClassId) || isecData.shareClasses[0];
                if (sc) {
                  const calculator = createNAVCalculator();

                  const positionValuations = isecData.positions.map(p => ({
                    positionId: p.id,
                    securityId: p.securityId,
                    isin: p.isin || p.securityId,
                    name: p.securityName,
                    securityType: 'OTHER' as const,
                    quantity: p.quantity,
                    price: p.marketPrice,
                    priceCurrency: p.priceCurrency,
                    priceDate: p.priceDate || navDate,
                    priceSource: p.priceSource || 'ISEC',
                    marketValue: p.marketValue,
                    marketValueFundCurrency: p.marketValue,
                    assetClass: 'OTHER' as const,
                  }));

                  const cashBals = isecData.cashBalances.map(c => ({
                    accountId: c.accountId,
                    accountName: c.bankName,
                    bankName: c.bankName,
                    currency: c.currency,
                    balance: c.balance,
                    balanceFundCurrency: c.balance,
                    valueDate: c.valueDate || navDate,
                    accountType: 'CUSTODY' as const,
                  }));

                  const fxRates = isecData.fxRates.map(r => ({
                    baseCurrency: r.baseCurrency,
                    quoteCurrency: r.quoteCurrency,
                    rate: r.rate,
                    rateDate: r.date,
                    source: r.source,
                  }));

                  const accruedFees = isecData.accruedFees.map(f => ({
                    feeType: 'OTHER' as const,
                    periodStart: f.periodStart || navDate,
                    periodEnd: f.periodEnd || navDate,
                    annualRate: f.annualRate,
                    baseAmount: 0,
                    accruedAmount: f.accruedAmount,
                    currency: f.currency,
                  }));

                  const prevDate = getPreviousBusinessDay(navDate);
                  const prevPrice = await getNAVPricesStore().getPrice(prevDate, price.fundId, price.shareClassId);

                  const calcResult = calculator.calculate({
                    fundId: price.fundId,
                    shareClassId: price.shareClassId,
                    navDate,
                    positions: positionValuations,
                    cashBalances: cashBals,
                    receivables: [],
                    liabilities: [],
                    accruedFees,
                    pendingRedemptions: [],
                    sharesOutstanding: sc.outstandingShares || price.sharesOutstanding || 1_000_000,
                    fxRates,
                    fundCurrency: isecData.currency,
                    managementFeeRate: sc.managementFee,
                    performanceFeeRate: sc.performanceFee,
                  }, {
                    previousNavPerShare: prevPrice?.navPerShare,
                  });

                  calcResult.calculationDetails.unshift({
                    step: 'ISEC_SOURCE',
                    description: 'Data hämtad från ISEC SECURA fondadministration',
                    inputValues: { positions: isecData.positions.length, cashAccounts: isecData.cashBalances.length },
                    outputValue: calcResult.navPerShare,
                  });

                  results.push(calcResult);
                  continue;
                }
              }
            } catch (err) {
              console.warn(`[Pipeline] ISEC calc failed for ${price.fundId}/${price.shareClassId}, using import:`, err);
            }

            // Fallback to import-based result for this share class
            results.push(buildImportResult(price, navDate));
          }
        } else {
          // Standard import-based records
          const allSC = getAllShareClasses();
          for (const price of prices) {
            const sc = allSC.find(
              (s) => s.fundId === price.fundId && s.shareClassId === price.shareClassId
            );
            if (!sc) continue;
            results.push(buildImportResult(price, navDate));
          }
        }

        // Save NAV records
        if (results.length > 0) {
          await getNAVRecordStore().batchSaveNAVRecords(results);
        }

        const runId = `NAV-${navDate}-${Date.now()}`;
        await getNAVRunStore().saveRun({
          runId,
          navDate,
          startedAt: run.startedAt,
          completedAt: new Date().toISOString(),
          status: 'AWAITING_APPROVAL',
          fundResults: new Map(results.map((r) => [`${r.fundId}/${r.shareClassId}`, r])),
          totalFunds: results.length,
          completedFunds: results.length,
          failedFunds: 0,
          errors: [],
          approvalStatus: 'PENDING',
        });

        const sourceLabel = isFromISEC ? 'ISEC SECURA beräkning' : 'CSV-import';
        return `NAV beräknad för ${results.length} andelsklasser via ${sourceLabel} (run: ${runId})`;
      });

      // Step 6: Compliance check
      await runStep(run, 5, async () => {
        const prices = await getNAVPricesStore().getPricesByDate(navDate);
        const warnings: string[] = [];

        for (const price of prices) {
          // Check for unusual NAV movements (> 5%)
          if (Math.abs(price.changePercent) > 5) {
            warnings.push(`${price.shareClassName}: NAV-förändring ${price.changePercent.toFixed(2)}% överstiger 5%`);
          }
          // Check for zero NAV
          if (price.navPerShare <= 0) {
            warnings.push(`${price.shareClassName}: NAV är ${price.navPerShare} (≤ 0)`);
          }
        }

        // Check all expected share classes have prices
        const allSC = getAllShareClasses();
        const importedISINs = new Set(prices.map((p) => p.isin));
        for (const sc of allSC) {
          if (!importedISINs.has(sc.isin)) {
            warnings.push(`Saknar pris för ${sc.name} (${sc.isin})`);
          }
        }

        if (warnings.length > 0) {
          return `Compliance-check klar med ${warnings.length} varningar:\n${warnings.join('\n')}`;
        }
        return `Compliance-check OK — alla ${prices.length} priser inom normala gränser`;
      });

      // Step 7: Create approval request
      await runStep(run, 6, async () => {
        const prices = await getNAVPricesStore().getPricesByDate(navDate);
        const allSC = getAllShareClasses();

        const navSummary = prices.map((p) => {
          const sc = allSC.find((s) => s.fundId === p.fundId && s.shareClassId === p.shareClassId);
          return {
            fundId: p.fundId,
            shareClassId: p.shareClassId,
            navPerShare: p.navPerShare,
            navChange: p.changePercent,
          };
        });

        const approval = await getNAVApprovalStore().createApproval(
          `NAV-${navDate}-${Date.now()}`,
          navDate,
          prices.map((p) => ({
            fundId: p.fundId,
            shareClassId: p.shareClassId,
            navDate,
            calculatedAt: new Date().toISOString(),
            grossAssets: p.totalNetAssets ?? 0,
            totalLiabilities: 0,
            netAssetValue: p.totalNetAssets ?? 0,
            sharesOutstanding: p.sharesOutstanding ?? 0,
            navPerShare: p.navPerShare,
            navChange: p.changePercent,
            navChangePercent: p.changePercent,
            breakdown: {
              assets: { equities: 0, bonds: 0, funds: 0, derivatives: 0, cash: 0, receivables: 0, other: 0, total: 0 },
              liabilities: { managementFee: 0, performanceFee: 0, depositaryFee: 0, adminFee: 0, auditFee: 0, taxLiability: 0, pendingRedemptions: 0, otherLiabilities: 0, total: 0 },
              accruals: { accruedIncome: 0, accruedExpenses: 0, dividendsReceivable: 0, interestReceivable: 0, total: 0 },
            },
            validationErrors: [],
            warnings: [],
            status: 'VALID' as const,
            calculationDetails: [],
          }))
        );

        run.approvalId = approval.approvalId;
        run.status = 'pending_approval';

        // Send notification email
        const notifyEmails = (process.env.NAV_NOTIFICATION_EMAILS || '').split(',').filter(Boolean);
        if (notifyEmails.length > 0) {
          try {
            await sendApprovalNotification({
              approval,
              action: 'CREATED',
              recipients: notifyEmails.map((email) => ({ email: email.trim(), name: email.trim(), type: 'TO' as const })),
            });
          } catch (emailErr) {
            console.warn('[Pipeline] Failed to send approval notification:', emailErr);
          }
        }

        return `Godkännandebegäran skapad: ${approval.approvalId} — väntar på 4-ögon-godkännande`;
      });

      // Pipeline complete (waiting for approval)
      run.status = 'pending_approval';
      await pipelineStore.updateRun(run);

      return NextResponse.json({
        success: true,
        navDate,
        status: run.status,
        approvalId: run.approvalId,
        steps: run.steps.map((s) => ({
          name: s.name,
          status: s.status,
          details: s.details,
          error: s.error,
        })),
        message: `NAV-pipeline klar för ${navDate}. Väntar på godkännande i plattformen.`,
      });

    } catch (err) {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : String(err);
      await pipelineStore.updateRun(run);

      return NextResponse.json({
        success: false,
        navDate,
        status: 'failed',
        error: run.error,
        steps: run.steps.map((s) => ({
          name: s.name,
          status: s.status,
          details: s.details,
          error: s.error,
        })),
      }, { status: 500 });
    }
  } catch (err) {
    console.error('[NAV Pipeline]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET — Pipeline status
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const authed = !!cookieStore.get('__Host-aifm_id_token')?.value;
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const action = searchParams.get('action');

    const pipelineStore = getPipelineStore();

    if (action === 'recent') {
      const runs = await pipelineStore.getRecentRuns(20);
      return NextResponse.json({ runs });
    }

    if (date) {
      const run = await pipelineStore.getLatestRun(date);
      if (!run) {
        return NextResponse.json({ error: `Ingen pipeline-körning för ${date}` }, { status: 404 });
      }
      return NextResponse.json(run);
    }

    // Default: today
    const today = new Date().toISOString().split('T')[0];
    const run = await pipelineStore.getLatestRun(today);
    return NextResponse.json(run || { message: 'Ingen pipeline-körning idag' });
  } catch (err) {
    console.error('[NAV Pipeline GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

async function runStep(
  run: PipelineRun,
  stepIndex: number,
  fn: () => Promise<string>
): Promise<void> {
  const step = run.steps[stepIndex];
  step.status = 'running';
  step.startedAt = new Date().toISOString();

  const pipelineStore = getPipelineStore();
  await pipelineStore.updateRun(run);

  try {
    const details = await fn();
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.details = details;
  } catch (err) {
    step.status = 'failed';
    step.completedAt = new Date().toISOString();
    step.error = err instanceof Error ? err.message : String(err);
    throw err;
  }

  await pipelineStore.updateRun(run);
}

function getBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function getPreviousBusinessDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date.toISOString().split('T')[0];
}

function buildImportResult(price: any, navDate: string): NAVCalculationResult {
  return {
    fundId: price.fundId,
    shareClassId: price.shareClassId,
    navDate,
    calculatedAt: new Date().toISOString(),
    grossAssets: price.totalNetAssets ?? 0,
    totalLiabilities: 0,
    netAssetValue: price.totalNetAssets ?? 0,
    sharesOutstanding: price.sharesOutstanding ?? 0,
    navPerShare: price.navPerShare,
    previousNAV: undefined,
    navChange: 0,
    navChangePercent: price.changePercent || 0,
    breakdown: {
      assets: { equities: 0, bonds: 0, funds: 0, derivatives: 0, cash: 0, receivables: 0, other: price.totalNetAssets ?? 0, total: price.totalNetAssets ?? 0 },
      liabilities: { managementFee: 0, performanceFee: 0, depositaryFee: 0, adminFee: 0, auditFee: 0, taxLiability: 0, pendingRedemptions: 0, otherLiabilities: 0, total: 0 },
      accruals: { accruedIncome: 0, accruedExpenses: 0, dividendsReceivable: 0, interestReceivable: 0, total: 0 },
    },
    validationErrors: [],
    warnings: [],
    status: 'VALID',
    calculationDetails: [
      {
        step: 'NAV_IMPORT',
        description: `NAV importerad från ${price.source || 'daglig fil'}`,
        inputValues: { navPerShare: price.navPerShare, changePercent: price.changePercent || 0 },
        outputValue: price.navPerShare,
      },
    ],
  };
}
