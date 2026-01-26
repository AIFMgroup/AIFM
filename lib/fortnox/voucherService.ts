/**
 * Fortnox Voucher Service
 * 
 * Hanterar skapande av verifikationer och leverantörsfakturor i Fortnox.
 */

import { getFortnoxClient } from './client';
import { fortnoxTokenStore } from './tokenStore';
import { AccountingJob, Classification, jobStore } from '../accounting/jobStore';
import { fortnoxBootstrapStore } from './bootstrapStore';
import { evaluateAccountingPolicyForCompany } from '../accounting/services/accountingPolicyEngine';
import { validateClassification } from '../accounting/services/validationService';
import crypto from 'crypto';
import {
  claimPosting,
  completePosting,
  failPosting,
  deadLetterPosting,
} from './postingQueueStore';
import { auditLog } from '../accounting/auditLogger';
import { assertPeriodWritable } from '../accounting/services/periodClosingService';

interface SendToFortnoxResult {
  success: boolean;
  voucherId?: string;
  invoiceId?: string;
  error?: string;
}

type AccountsPayload = { Accounts?: Array<{ Number: number; Description?: string }> };
type CostCentersPayload = { CostCenters?: Array<{ Code: string; Description?: string }> };
type VoucherSeriesPayload = { VoucherSeries?: Array<{ Code: string; Description?: string }> };

function pickVoucherSeries(series?: VoucherSeriesPayload): string {
  const list = series?.VoucherSeries || [];
  // Prefer A if exists, else first available, else fallback A
  if (list.some(s => s.Code === 'A')) return 'A';
  return list[0]?.Code || 'A';
}

function hasAccount(accounts: AccountsPayload | null, accountNumber: number): boolean {
  return !!accounts?.Accounts?.some(a => a.Number === accountNumber);
}

function normalizeCostCenter(code?: string | null, costCenters?: CostCentersPayload | null): string | undefined {
  if (!code) return undefined;
  if (!costCenters?.CostCenters?.length) return code;
  return costCenters.CostCenters.some(cc => cc.Code === code) ? code : undefined;
}

/**
 * Skicka ett bokföringsjobb till Fortnox
 */
export async function sendToFortnox(
  companyId: string,
  job: AccountingJob
): Promise<SendToFortnoxResult> {
  // Idempotency: if already sent, do nothing
  if (job.status === 'sent' && job.fortnoxVoucherId) {
    return { success: true, voucherId: job.fortnoxVoucherId };
  }

  // Period guardrail: prevent posting into closed/locked periods
  const docDate = job.classification?.invoiceDate || job.createdAt.split('T')[0];
  try {
    await assertPeriodWritable(companyId, docDate);
  } catch (e) {
    return { success: false, error: `Perioden är stängd/låst för ${docDate}: ${String(e)}` };
  }

  // Check connection
  const connection = await fortnoxTokenStore.getConnection(companyId);
  if (!connection.connected) {
    return {
      success: false,
      error: 'Fortnox är inte kopplat för detta bolag. Gå till Inställningar för att koppla.',
    };
  }

  // Ensure bootstrap is ready (kontoplan m.m.)
  const bootstrap = await fortnoxBootstrapStore.getState(companyId);
  if (bootstrap.status !== 'ready') {
    return {
      success: false,
      error: 'Fortnox är kopplat men inte färdig-konfigurerat ännu. Gå till Bokföring → Inställningar och kör “Förberedelse (kontoplan m.m.)”.',
    };
  }

  // Get client
  const client = await getFortnoxClient(companyId);
  if (!client) {
    return {
      success: false,
      error: 'Kunde inte ansluta till Fortnox. Försök koppla om.',
    };
  }

  const classification = job.classification;
  if (!classification) {
    return {
      success: false,
      error: 'Dokumentet saknar klassificering.',
    };
  }

  try {
    // Deterministic fiscal-year guard: posting date must be inside a known Fortnox financial year (if available)
    const fyCache = await fortnoxBootstrapStore.getCache<any>(companyId, 'FINANCIALYEARS');
    const financialYears: any[] =
      (fyCache?.payload?.FinancialYears as any[]) ||
      (fyCache?.payload?.financialYears as any[]) ||
      [];

    if (financialYears.length > 0) {
      const d = classification.invoiceDate;
      const inYear = financialYears.some((fy: any) => {
        const from = new Date(fy.FromDate ?? fy.fromDate);
        const to = new Date(fy.ToDate ?? fy.toDate);
        const dt = new Date(d);
        return !isNaN(dt.getTime()) && !isNaN(from.getTime()) && !isNaN(to.getTime()) && dt >= from && dt <= to;
      });
      if (!inYear) {
        await deadLetterPosting(companyId, job.id, `InvoiceDate ${d} ligger utanför Fortnox räkenskapsår.`);
        return { success: false, error: `Validering: datum ${d} ligger utanför bolagets räkenskapsår i Fortnox.` };
      }
    }

    // Currency: require SEK for posting (pipeline converts foreign currency deterministically to SEK)
    if (classification.currency && classification.currency !== 'SEK') {
      await deadLetterPosting(companyId, job.id, `Valuta (${classification.currency}) är inte konverterad till SEK innan Fortnox-postning.`);
      await auditLog.jobPrecheckFailed(companyId, job.id, `FOREIGN_CURRENCY_NOT_CONVERTED: ${classification.currency}`);
      return { success: false, error: `Validering: dokumentet måste vara konverterat till SEK innan Fortnox-postning.` };
    }

    // Invoice guardrail: require invoiceNumber for supplier invoices / credit notes
    if ((classification.docType === 'INVOICE' || classification.docType === 'CREDIT_NOTE') && (!classification.invoiceNumber || classification.invoiceNumber.trim().length < 1)) {
      await deadLetterPosting(companyId, job.id, `Fakturanummer saknas för leverantörsfaktura.`);
      await auditLog.jobPrecheckFailed(companyId, job.id, `MISSING_INVOICE_NUMBER`);
      return { success: false, error: 'Validering: fakturanummer saknas för leverantörsfaktura.' };
    }

    // Deterministic preflight validation BEFORE any Fortnox posting attempts
    const preflight = validateClassification(classification);
    const preflightErrors = preflight.errors.filter(e => e.severity === 'critical' || e.severity === 'error');
    if (preflightErrors.length > 0) {
      const msg = preflightErrors.map(e => `${e.code}: ${e.message}`).join(' | ');
      await deadLetterPosting(companyId, job.id, `Preflight validation failed: ${msg}`);
      await auditLog.jobPrecheckFailed(companyId, job.id, msg);
      return { success: false, error: `Validering misslyckades: ${msg}` };
    }

    // Enforce per-company accounting policy before posting to Fortnox (hard guardrail)
    const { evaluation } = await evaluateAccountingPolicyForCompany(companyId, classification);
    const blocked = evaluation.reject || evaluation.violations.some(v => v.severity === 'error');
    if (blocked) {
      await deadLetterPosting(companyId, job.id, `Policy blocked: ${evaluation.summary}`);
      await auditLog.jobPolicyBlocked(companyId, job.id, evaluation.summary);
      return {
        success: false,
        error: `Utanför bokföringspolicy: ${evaluation.summary}`,
      };
    }

    // Idempotency / replay safety: claim posting "slot" per (company, job)
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        jobId: job.id,
        companyId,
        docType: classification.docType,
        supplier: classification.supplier,
        invoiceNumber: classification.invoiceNumber,
        invoiceDate: classification.invoiceDate,
        dueDate: classification.dueDate,
        currency: classification.currency,
        totalAmount: classification.totalAmount,
        vatAmount: classification.vatAmount,
        lineItems: classification.lineItems.map(li => ({
          description: li.description,
          netAmount: li.netAmount,
          vatAmount: li.vatAmount,
          suggestedAccount: li.suggestedAccount,
          suggestedCostCenter: li.suggestedCostCenter,
        })),
      }))
      .digest('hex');

    const claim = await claimPosting(companyId, job.id, requestHash);
    if (claim.state === 'already_completed') {
      return { success: true, voucherId: claim.resultId };
    }
    if (claim.state === 'blocked_running') {
      return { success: false, error: 'Fortnox-postning pågår redan för detta dokument. Försök igen om en stund.' };
    }
    if (claim.state === 'wait_retry') {
      return { success: false, error: `Fortnox-postning misslyckades nyligen. Försök igen efter ${claim.nextRetryAt}.` };
    }
    if (claim.state === 'blocked_conflict') {
      return { success: false, error: 'Idempotens-konflikt: dokumentet har redan postats med annan kontering. Skapa ett nytt jobb eller återställ status.' };
    }
    if (claim.state === 'dead_letter') {
      return { success: false, error: `Dokumentet är i “dead-letter” efter flera försök: ${claim.lastError || 'Okänt fel'}` };
    }

    await auditLog.fortnoxPostingStarted(companyId, job.id);

    // Different handling based on document type
    const result =
      classification.docType === 'INVOICE'
        ? await createSupplierInvoice(client, job, classification, { credit: false })
        : classification.docType === 'CREDIT_NOTE'
          ? await createSupplierInvoice(client, job, classification, { credit: true, fallbackToVoucher: true })
          : await createVoucher(client, job, classification);

    if (result.success) {
      const rid = result.voucherId || result.invoiceId;
      if (rid) await completePosting(companyId, job.id, rid);
      if (rid) await auditLog.fortnoxPostingCompleted(companyId, job.id, rid);
      return result;
    }

    await failPosting(companyId, job.id, result.error || 'Fortnox posting failed');
    await auditLog.fortnoxPostingFailed(companyId, job.id, result.error || 'Fortnox posting failed');
    return result;
  } catch (error) {
    console.error('[FortnoxVoucher] Error:', error);
    const msg = error instanceof Error ? error.message : 'Okänt fel';
    await failPosting(companyId, job.id, msg);
    await auditLog.fortnoxPostingFailed(companyId, job.id, msg);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Skapa leverantörsfaktura i Fortnox
 */
async function createSupplierInvoice(
  client: Awaited<ReturnType<typeof getFortnoxClient>>,
  job: AccountingJob,
  classification: Classification,
  options?: { credit?: boolean; fallbackToVoucher?: boolean }
): Promise<SendToFortnoxResult> {
  if (!client) return { success: false, error: 'No client' };

  const isCredit = !!options?.credit;
  const fallbackToVoucher = !!options?.fallbackToVoucher;

  const [accountsCache, costCentersCache] = await Promise.all([
    fortnoxBootstrapStore.getCache<AccountsPayload>(job.companyId, 'ACCOUNTS'),
    fortnoxBootstrapStore.getCache<CostCentersPayload>(job.companyId, 'COSTCENTERS'),
  ]);
  const accounts = accountsCache?.payload || null;
  const costCenters = costCentersCache?.payload || null;

  // Find or create supplier
  const supplierResult = await client.findOrCreateSupplier(classification.supplier);
  if (!supplierResult.success || !supplierResult.data) {
    return {
      success: false,
      error: `Kunde inte hitta/skapa leverantör: ${classification.supplier}`,
    };
  }

  // Build invoice rows
  const rows: Array<{
    Account: number;
    Debit: number;
    Credit?: number;
    CostCenter?: string;
  }> = classification.lineItems.map(item => ({
    Account: (() => {
      const suggested = parseInt(item.suggestedAccount) || 6550;
      if (hasAccount(accounts, suggested)) return suggested;
      // fallback
      return hasAccount(accounts, 6550) ? 6550 : suggested;
    })(),
    Debit: Math.abs(item.netAmount),
    CostCenter: normalizeCostCenter(item.suggestedCostCenter, costCenters),
  }));

  // Add VAT row if exists
  if (Math.abs(classification.vatAmount) > 0) {
    rows.push({
      Account: hasAccount(accounts, 2640) ? 2640 : 2640, // Ingående moms (fallback to same)
      Debit: Math.abs(classification.vatAmount),
    });
  }

  // Deterministic sanity: invoice rows should sum approximately to total (Fortnox auto-creates liability)
  const debitSum = rows.reduce((sum, r) => sum + (r.Debit || 0), 0);
  const absTotal = Math.abs(classification.totalAmount);
  if (Math.abs(debitSum - absTotal) > 1) {
    const err = `Validering: rader (${debitSum.toFixed(2)}) matchar inte total (${absTotal.toFixed(2)}).`;
    if (!fallbackToVoucher) return { success: false, error: err };
    console.warn(`[FortnoxVoucher] ${job.id}: SupplierInvoice validation failed for credit-note; falling back to voucher. ${err}`);
    return await createCreditNoteVoucher(client, job, classification);
  }

  // Build document link for Fortnox comments
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '') || 'https://d31zvrvfawczta.cloudfront.net';
  const documentUrl = `${baseUrl}/accounting/inbox?job=${job.id}`;

  // Create invoice
  const result = await client.createSupplierInvoice({
    SupplierNumber: supplierResult.data.SupplierNumber,
    InvoiceNumber: classification.invoiceNumber,
    InvoiceDate: classification.invoiceDate,
    DueDate: classification.dueDate,
    Total: absTotal,
    VAT: Math.abs(classification.vatAmount || 0),
    Currency: classification.currency,
    YourReference: `AIFM:${job.id}`,
    Comments: `Originaldokument: ${documentUrl}`,
    ExternalInvoiceReference1: job.id,
    Credit: isCredit ? true : undefined,
    SupplierInvoiceRows: rows,
  });

  if (result.success && result.data) {
    console.log(`[FortnoxVoucher] Created supplier invoice: ${result.data.SupplierInvoice.GivenNumber}`);
    // Store invoice id on job for bidirectional sync
    try {
      await jobStore.update(job.id, {
        fortnoxInvoiceId: result.data.SupplierInvoice.GivenNumber,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[FortnoxVoucher] Could not persist fortnoxInvoiceId:', e);
    }
    return {
      success: true,
      invoiceId: result.data.SupplierInvoice.GivenNumber,
    };
  }

  // If Fortnox rejected credit supplier invoice, fall back to voucher so we still can book
  if (isCredit && fallbackToVoucher) {
    console.warn(`[FortnoxVoucher] ${job.id}: createSupplierInvoice credit rejected; falling back to voucher.`, result.error);
    return await createCreditNoteVoucher(client, job, classification);
  }

  return { success: false, error: result.error || 'Kunde inte skapa leverantörsfaktura' };
}

/**
 * Skapa verifikation i Fortnox (för kvitton, representation etc.)
 */
async function createVoucher(
  client: Awaited<ReturnType<typeof getFortnoxClient>>,
  job: AccountingJob,
  classification: Classification
): Promise<SendToFortnoxResult> {
  if (!client) return { success: false, error: 'No client' };

  const [accountsCache, costCentersCache, voucherSeriesCache] = await Promise.all([
    fortnoxBootstrapStore.getCache<AccountsPayload>(job.companyId, 'ACCOUNTS'),
    fortnoxBootstrapStore.getCache<CostCentersPayload>(job.companyId, 'COSTCENTERS'),
    fortnoxBootstrapStore.getCache<VoucherSeriesPayload>(job.companyId, 'VOUCHERSERIES'),
  ]);
  const accounts = accountsCache?.payload || null;
  const costCenters = costCentersCache?.payload || null;
  const voucherSeries = voucherSeriesCache?.payload || undefined;

  // Build voucher rows
  const voucherRows: Array<{
    Account: number;
    Debit?: number;
    Credit?: number;
    Description?: string;
    CostCenter?: string;
  }> = [];

  // Expense rows (debit)
  for (const item of classification.lineItems) {
    voucherRows.push({
      Account: (() => {
        const suggested = parseInt(item.suggestedAccount) || 6550;
        if (hasAccount(accounts, suggested)) return suggested;
        return hasAccount(accounts, 6550) ? 6550 : suggested;
      })(),
      Debit: item.netAmount,
      Description: item.description.substring(0, 50),
      CostCenter: normalizeCostCenter(item.suggestedCostCenter, costCenters),
    });
  }

  // VAT row (debit) if exists
  if (classification.vatAmount > 0) {
    voucherRows.push({
      Account: hasAccount(accounts, 2640) ? 2640 : 2640, // Ingående moms
      Debit: classification.vatAmount,
    });
  }

  // Credit row (usually bank/card)
  voucherRows.push({
    Account: hasAccount(accounts, 1930) ? 1930 : (hasAccount(accounts, 1910) ? 1910 : 1930), // Bank
    Credit: classification.totalAmount,
    Description: classification.supplier,
  });

  // Deterministic preflight: voucher must be balanced
  const totalDebit = voucherRows.reduce((sum, r) => sum + (r.Debit || 0), 0);
  const totalCredit = voucherRows.reduce((sum, r) => sum + (r.Credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `Validering: verifikation ej balanserad (debet ${totalDebit.toFixed(2)} / kredit ${totalCredit.toFixed(2)}).`,
    };
  }

  // Create voucher
  const result = await client.createVoucher({
    VoucherSeries: pickVoucherSeries(voucherSeries),
    TransactionDate: classification.invoiceDate,
    Description: `${classification.supplier} - ${job.fileName}`,
    VoucherRows: voucherRows,
  });

  if (result.success && result.data) {
    console.log(`[FortnoxVoucher] Created voucher: ${result.data.Voucher.VoucherNumber}`);
    return {
      success: true,
      voucherId: `${result.data.Voucher.VoucherSeries}${result.data.Voucher.VoucherNumber}`,
    };
  }

  return {
    success: false,
    error: result.error || 'Kunde inte skapa verifikation',
  };
}

/**
 * Skapa kreditnota som verifikation (reversal)
 * - Debet 2440 (minskar leverantörsskuld)
 * - Kredit kostnadskonton (minskar kostnad)
 * - Kredit 2640 (minskar ingående moms) om moms finns
 */
async function createCreditNoteVoucher(
  client: Awaited<ReturnType<typeof getFortnoxClient>>,
  job: AccountingJob,
  classification: Classification
): Promise<SendToFortnoxResult> {
  if (!client) return { success: false, error: 'No client' };

  const [accountsCache, costCentersCache, voucherSeriesCache] = await Promise.all([
    fortnoxBootstrapStore.getCache<AccountsPayload>(job.companyId, 'ACCOUNTS'),
    fortnoxBootstrapStore.getCache<CostCentersPayload>(job.companyId, 'COSTCENTERS'),
    fortnoxBootstrapStore.getCache<VoucherSeriesPayload>(job.companyId, 'VOUCHERSERIES'),
  ]);
  const accounts = accountsCache?.payload || null;
  const costCenters = costCentersCache?.payload || null;
  const voucherSeries = voucherSeriesCache?.payload || undefined;

  const absTotal = Math.abs(classification.totalAmount);
  const absVat = Math.abs(classification.vatAmount || 0);

  const voucherRows: Array<{
    Account: number;
    Debit?: number;
    Credit?: number;
    Description?: string;
    CostCenter?: string;
  }> = [];

  // Debit supplier liability (2440)
  voucherRows.push({
    Account: hasAccount(accounts, 2440) ? 2440 : 2440,
    Debit: absTotal,
    Description: `Kreditnota ${classification.invoiceNumber}`,
  });

  // Credit expense rows
  for (const item of classification.lineItems) {
    const absNet = Math.abs(item.netAmount || 0);
    if (absNet === 0) continue;
    voucherRows.push({
      Account: (() => {
        const suggested = parseInt(item.suggestedAccount) || 6550;
        if (hasAccount(accounts, suggested)) return suggested;
        return hasAccount(accounts, 6550) ? 6550 : suggested;
      })(),
      Credit: absNet,
      Description: item.description.substring(0, 50),
      CostCenter: normalizeCostCenter(item.suggestedCostCenter, costCenters),
    });
  }

  // Credit input VAT (2640) if applicable
  if (absVat > 0) {
    voucherRows.push({
      Account: hasAccount(accounts, 2640) ? 2640 : 2640,
      Credit: absVat,
      Description: 'Ingående moms (kreditnota)',
    });
  }

  // Balance check
  const totalDebit = voucherRows.reduce((sum, r) => sum + (r.Debit || 0), 0);
  const totalCredit = voucherRows.reduce((sum, r) => sum + (r.Credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `Validering: kreditnota ej balanserad (debet ${totalDebit.toFixed(2)} / kredit ${totalCredit.toFixed(2)}).`,
    };
  }

  const result = await client.createVoucher({
    VoucherSeries: pickVoucherSeries(voucherSeries),
    TransactionDate: classification.invoiceDate,
    Description: `Kreditnota ${classification.invoiceNumber} - ${classification.supplier}`,
    VoucherRows: voucherRows,
  });

  if (result.success && result.data) {
    return {
      success: true,
      voucherId: `${result.data.Voucher.VoucherSeries}${result.data.Voucher.VoucherNumber}`,
    };
  }

  return { success: false, error: result.error || 'Kunde inte skapa kreditnota-verifikation' };
}

/**
 * Kontrollera om Fortnox är kopplat för ett bolag
 */
export async function isFortnoxConnected(companyId: string): Promise<boolean> {
  const connection = await fortnoxTokenStore.getConnection(companyId);
  return connection.connected;
}

