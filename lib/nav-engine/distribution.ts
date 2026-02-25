/**
 * NAV Distribution – after second approval
 *
 * Triggers: NAV report email, price data CSV, Notor/SubRed summary, compliance email.
 */

import type { NAVApproval } from './nav-store';
import { getNAVRecordStore } from './nav-store';
import type { NAVRecord } from './nav-store';
import { sendNAVReportEmail } from './email-service';
import type { NAVCalculationResult } from './types';
import { getNAVPricesStore, getFlowsStore, getPipelineStore } from './flows-store';
import { getAllShareClasses, AUAG_FUNDS } from './auag-funds';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

const DISTRIBUTION_RECIPIENTS = (process.env.NAV_DISTRIBUTION_EMAILS || process.env.NAV_SENDER_EMAIL || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const AUAG_RECIPIENTS = (process.env.AUAG_NAV_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const SENDER_EMAIL = process.env.NAV_SENDER_EMAIL || 'nav@aifm.se';

/**
 * Called when an approval is fully approved (second approval).
 * Runs distribution steps: NAV report email, price data CSV, Notor, SubRed, compliance.
 */
export async function triggerDistributionAfterApproval(approval: NAVApproval): Promise<void> {
  if (approval.status !== 'APPROVED') return;
  console.log(`[NAV Distribution] Starting distribution for approval ${approval.approvalId} (${approval.navDate})`);
  await runDistributionPipeline(approval);
}

function recordToNavResult(record: NAVRecord): NAVCalculationResult {
  return {
    fundId: record.fundId,
    shareClassId: record.shareClassId,
    navDate: record.navDate,
    calculatedAt: record.calculatedAt,
    grossAssets: record.grossAssets,
    totalLiabilities: record.totalLiabilities,
    netAssetValue: record.netAssetValue,
    sharesOutstanding: record.sharesOutstanding,
    navPerShare: record.navPerShare,
    navChange: record.navChange,
    navChangePercent: record.navChangePercent,
    breakdown:
      record.breakdown ??
      ({
        assets: { equities: 0, bonds: 0, funds: 0, derivatives: 0, cash: 0, receivables: 0, other: 0, total: 0 },
        liabilities: {
          managementFee: 0, performanceFee: 0, depositaryFee: 0, adminFee: 0, auditFee: 0,
          taxLiability: 0, pendingRedemptions: 0, otherLiabilities: 0, total: 0,
        },
        accruals: { accruedIncome: 0, accruedExpenses: 0, dividendsReceivable: 0, interestReceivable: 0, total: 0 },
      } as NAVCalculationResult['breakdown']),
    validationErrors: [],
    warnings: [],
    status: 'VALID',
    calculationDetails: [],
  };
}

async function runDistributionPipeline(approval: NAVApproval): Promise<void> {
  const recordStore = getNAVRecordStore();
  const navResults: NAVCalculationResult[] = [];

  for (const nav of approval.navSummary) {
    const record = await recordStore.getNAVRecord(nav.fundId, nav.shareClassId, approval.navDate);
    if (record) navResults.push(recordToNavResult(record));
  }

  // 1. Send NAV report email to internal recipients
  if (navResults.length === 0) {
    console.warn('[NAV Distribution] No NAV records found for approval; skipping report email');
  } else if (DISTRIBUTION_RECIPIENTS.length > 0) {
    await sendNAVReportEmail({
      navDate: approval.navDate,
      navResults,
      recipients: DISTRIBUTION_RECIPIENTS.map((email) => ({ email, name: email, type: 'TO' as const })),
    }).then((r) => {
      if (r.success) console.log('[NAV Distribution] NAV report email sent');
      else console.warn('[NAV Distribution] NAV report email failed:', r.error);
    });
  }

  // 2. Generate and send NAV price CSV to AuAg
  if (AUAG_RECIPIENTS.length > 0) {
    try {
      await sendNAVPriceCSVToAuAg(approval.navDate);
      console.log('[NAV Distribution] NAV price CSV sent to AuAg');
    } catch (err) {
      console.warn('[NAV Distribution] Failed to send NAV CSV to AuAg:', err);
    }
  }

  // 3. Generate and send Sub/Red summary
  try {
    await sendSubRedSummary(approval.navDate);
    console.log('[NAV Distribution] Sub/Red summary sent');
  } catch (err) {
    console.warn('[NAV Distribution] Failed to send Sub/Red summary:', err);
  }

  // 4. Send compliance confirmation email
  if (DISTRIBUTION_RECIPIENTS.length > 0) {
    try {
      await sendComplianceConfirmation(approval.navDate, navResults);
      console.log('[NAV Distribution] Compliance confirmation sent');
    } catch (err) {
      console.warn('[NAV Distribution] Failed to send compliance confirmation:', err);
    }
  }

  // 5. Update pipeline status
  try {
    const pipelineStore = getPipelineStore();
    const run = await pipelineStore.getLatestRun(approval.navDate);
    if (run) {
      run.status = 'distributed';
      run.completedAt = new Date().toISOString();
      await pipelineStore.updateRun(run);
    }
  } catch {
    // Non-critical
  }
}

// ============================================================================
// NAV Price CSV for AuAg
// ============================================================================

/**
 * Generate the NAV price CSV in AuAg format and send via email.
 * Format: name;date;percentage;price
 */
async function sendNAVPriceCSVToAuAg(navDate: string): Promise<void> {
  const prices = await getNAVPricesStore().getPricesByDate(navDate);
  if (prices.length === 0) return;

  // Build CSV in AuAg format
  const lines = ['name;date;percentage;price'];
  for (const p of prices) {
    const pctStr = p.changePercent >= 0 ? `+${p.changePercent.toFixed(5)}` : p.changePercent.toFixed(5);
    lines.push(`${p.shareClassName};${p.date};${pctStr};${p.navPerShare}`);
  }
  const csvContent = lines.join('\n');

  // Send via SES with CSV attachment
  const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-north-1' });
  const boundary = `boundary_${Date.now()}`;
  const subject = `NAV Prices ${navDate} - AIFM`;

  const rawEmail = [
    `From: ${SENDER_EMAIL}`,
    `To: ${AUAG_RECIPIENTS.join(', ')}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    `NAV-priser för ${navDate} bifogas som CSV.`,
    '',
    `Godkänt och distribuerat av AIFM NAV System.`,
    '',
    `--${boundary}`,
    `Content-Type: text/csv; name="NAV_${navDate.replace(/-/g, '')}.csv"`,
    `Content-Disposition: attachment; filename="NAV_${navDate.replace(/-/g, '')}.csv"`,
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(csvContent).toString('base64'),
    '',
    `--${boundary}--`,
  ].join('\r\n');

  await ses.send(new SendRawEmailCommand({
    RawMessage: { Data: Buffer.from(rawEmail) },
  }));
}

// ============================================================================
// Sub/Red Summary
// ============================================================================

async function sendSubRedSummary(navDate: string): Promise<void> {
  const flows = await getFlowsStore().getFlowsByDate(navDate);
  if (flows.length === 0) {
    console.log('[NAV Distribution] No Sub/Red flows for this date');
    return;
  }

  const recipients = [...DISTRIBUTION_RECIPIENTS, ...AUAG_RECIPIENTS].filter(Boolean);
  if (recipients.length === 0) return;

  // Build summary
  const summary: Record<string, { subs: number; reds: number; netFlow: number; count: number }> = {};
  for (const flow of flows) {
    const key = flow.fundName || flow.fundId;
    if (!summary[key]) summary[key] = { subs: 0, reds: 0, netFlow: 0, count: 0 };
    if (flow.type === 'subscription') {
      summary[key].subs += flow.amount;
      summary[key].netFlow += flow.amount;
    } else {
      summary[key].reds += flow.amount;
      summary[key].netFlow -= flow.amount;
    }
    summary[key].count++;
  }

  const lines = [`Sub/Red Summary for ${navDate}`, ''];
  for (const [fund, data] of Object.entries(summary)) {
    lines.push(`${fund}:`);
    lines.push(`  Subscriptions: ${formatSEK(data.subs)}`);
    lines.push(`  Redemptions:   ${formatSEK(data.reds)}`);
    lines.push(`  Net flow:      ${formatSEK(data.netFlow)}`);
    lines.push(`  Transactions:  ${data.count}`);
    lines.push('');
  }

  const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-north-1' });
  await ses.send(new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from([
        `From: ${SENDER_EMAIL}`,
        `To: ${recipients.join(', ')}`,
        `Subject: Sub/Red Summary ${navDate} - AIFM`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        lines.join('\n'),
      ].join('\r\n')),
    },
  }));
}

// ============================================================================
// Compliance Confirmation
// ============================================================================

async function sendComplianceConfirmation(
  navDate: string,
  navResults: NAVCalculationResult[]
): Promise<void> {
  const recipients = DISTRIBUTION_RECIPIENTS;
  if (recipients.length === 0) return;

  const allWarnings: string[] = [];
  for (const r of navResults) {
    if (Math.abs(r.navChangePercent) > 5) {
      allWarnings.push(`${r.fundId}/${r.shareClassId}: NAV change ${r.navChangePercent.toFixed(2)}% exceeds 5%`);
    }
  }

  const status = allWarnings.length === 0 ? 'OK' : `${allWarnings.length} VARNINGAR`;

  const body = [
    `NAV Compliance-bekräftelse för ${navDate}`,
    '',
    `Status: ${status}`,
    `Antal fonder beräknade: ${navResults.length}`,
    '',
    ...(allWarnings.length > 0 ? ['Varningar:', ...allWarnings.map((w) => `  - ${w}`), ''] : []),
    'NAV-beräkningen har godkänts och distribuerats.',
    '',
    'AIFM NAV System',
  ].join('\n');

  const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-north-1' });
  await ses.send(new SendRawEmailCommand({
    RawMessage: {
      Data: Buffer.from([
        `From: ${SENDER_EMAIL}`,
        `To: ${recipients.join(', ')}`,
        `Subject: NAV Compliance ${navDate} - ${status}`,
        'Content-Type: text/plain; charset=UTF-8',
        '',
        body,
      ].join('\r\n')),
    },
  }));
}

// ============================================================================
// Helpers
// ============================================================================

function formatSEK(amount: number): string {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(amount);
}
