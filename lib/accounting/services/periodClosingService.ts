/**
 * Period Closing Service
 * 
 * Hanterar periodstängning enligt svenska bokföringsregler.
 * 
 * Steg för periodstängning:
 * 1. Verifiera alla dokument godkända
 * 2. Kontrollera momsavstämning
 * 3. Verifiera verifikationsnummersekvens
 * 4. Kontrollera bankavstämning
 * 5. Generera periodrapport
 * 6. Lås perioden
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { validateVoucherSequence } from './voucherNumberService';
import { generateReconciliationSummary } from './bankMatchingService';
import { jobStore } from '../jobStore';
import { vatReporting } from './vatReporting';
import { validateClassification } from './validationService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-period-status';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export type PeriodStatus = 'OPEN' | 'CLOSING' | 'CLOSED' | 'LOCKED';

export interface Period {
  companyId: string;
  year: number;
  month: number;
  periodKey: string;          // "2024-01"
  status: PeriodStatus;
  openedAt: string;
  closedAt?: string;
  lockedAt?: string;
  closedBy?: string;
  
  // Pre-close checks
  preCloseChecks: PreCloseCheck[];
  allChecksPassed: boolean;
  
  // Period summary
  summary?: PeriodSummary;
  
  // Audit trail
  history: PeriodHistoryEntry[];
}

export interface PreCloseCheck {
  id: string;
  name: string;
  description: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED';
  message?: string;
  details?: Record<string, unknown>;
  checkedAt?: string;
  isBlocking: boolean;        // Om failed blockerar stängning
}

export interface PeriodSummary {
  // Dokument
  totalDocuments: number;
  approvedDocuments: number;
  pendingDocuments: number;
  sentToFortnox: number;
  
  // Belopp
  totalInvoiceAmount: number;
  totalReceiptAmount: number;
  totalVATInput: number;      // Ingående moms
  totalVATOutput: number;     // Utgående moms
  vatToPay: number;           // Netto moms
  
  // Per konto
  accountSummary: {
    account: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
  
  // Verifikationer
  voucherSeries: {
    series: string;
    firstNumber: number;
    lastNumber: number;
    count: number;
    gaps: number[];
  }[];
  
  // Bank
  bankReconciliation?: {
    matchedTransactions: number;
    unmatchedTransactions: number;
    totalMatched: number;
    totalUnmatched: number;
  };
  
  generatedAt: string;
}

export interface PeriodHistoryEntry {
  action: string;
  performedBy: string;
  performedAt: string;
  details?: string;
}

export interface ClosingResult {
  success: boolean;
  period: Period;
  blockers: PreCloseCheck[];
  warnings: PreCloseCheck[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month)}-01`;
  // JS: day 0 of next month = last day of current month
  const endDate = new Date(year, month, 0);
  const end = `${year}-${pad2(month)}-${pad2(endDate.getDate())}`;
  return { start, end };
}

function getJobDocDate(job: { createdAt: string; classification?: { invoiceDate?: string } }): string {
  return job.classification?.invoiceDate || job.createdAt.split('T')[0];
}

export async function getPeriodForDate(companyId: string, date: string): Promise<Period> {
  const [y, m] = date.split('-');
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  if (!year || !month) throw new Error(`Invalid date: ${date}`);
  return getOrCreatePeriod(companyId, year, month);
}

/**
 * Guardrail: only allow bookkeeping changes in OPEN periods.
 * CLOSED/LOCKED must be reopened (LOCKED cannot be reopened without auditor).
 */
export async function assertPeriodWritable(companyId: string, date: string): Promise<void> {
  const period = await getPeriodForDate(companyId, date);
  if (period.status === 'OPEN') return;
  if (period.status === 'LOCKED') throw new Error(`Period ${period.periodKey} is LOCKED`);
  throw new Error(`Period ${period.periodKey} is ${period.status}`);
}

// ============ Pre-Close Checks ============

const PRE_CLOSE_CHECKS: Omit<PreCloseCheck, 'status' | 'message' | 'details' | 'checkedAt'>[] = [
  {
    id: 'pending_documents',
    name: 'Ej godkända dokument',
    description: 'Kontrollerar att alla dokument är godkända',
    isBlocking: true,
  },
  {
    id: 'voucher_sequence',
    name: 'Verifikationsnummersekvens',
    description: 'Kontrollerar att det inte finns luckor i verifikationsnumren',
    isBlocking: true,
  },
  {
    id: 'vat_reconciliation',
    name: 'Momsavstämning',
    description: 'Verifierar att ingående och utgående moms stämmer',
    isBlocking: true,
  },
  {
    id: 'bank_reconciliation',
    name: 'Bankavstämning',
    description: 'Kontrollerar att alla banktransaktioner är matchade',
    isBlocking: true, // Phase 2: make this blocking (can be relaxed later per customer)
  },
  {
    id: 'balance_check',
    name: 'Balansräkning',
    description: 'Verifierar att debet = kredit för alla verifikationer',
    isBlocking: true,
  },
  {
    id: 'future_dates',
    name: 'Framtida datum',
    description: 'Kontrollerar att inga verifikationer har datum i framtiden',
    isBlocking: false,
  },
  {
    id: 'large_amounts',
    name: 'Stora belopp',
    description: 'Flaggar ovanligt stora belopp för granskning',
    isBlocking: false,
  },
];

// ============ Main Functions ============

/**
 * Hämta eller skapa period
 */
export async function getOrCreatePeriod(
  companyId: string,
  year: number,
  month: number
): Promise<Period> {
  const periodKey = `${year}-${String(month).padStart(2, '0')}`;
  
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `PERIOD#${periodKey}` },
  }));
  
  if (result.Item) {
    return result.Item as Period;
  }
  
  // Skapa ny period
  const newPeriod: Period = {
    companyId,
    year,
    month,
    periodKey,
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    preCloseChecks: PRE_CLOSE_CHECKS.map(check => ({
      ...check,
      status: 'PENDING' as const,
    })),
    allChecksPassed: false,
    history: [{
      action: 'PERIOD_CREATED',
      performedBy: 'system',
      performedAt: new Date().toISOString(),
    }],
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `PERIOD#${periodKey}`,
      ...newPeriod,
    },
  }));
  
  return newPeriod;
}

/**
 * Kör alla pre-close kontroller
 */
export async function runPreCloseChecks(
  companyId: string,
  year: number,
  month: number
): Promise<{ checks: PreCloseCheck[]; allPassed: boolean; blockers: PreCloseCheck[] }> {
  const period = await getOrCreatePeriod(companyId, year, month);
  const checks: PreCloseCheck[] = [];
  const now = new Date().toISOString();
  
  // 1. Kontrollera pending dokument
  const pendingCheck = await checkPendingDocuments(companyId, year, month);
  checks.push({ ...pendingCheck, checkedAt: now });
  
  // 2. Kontrollera verifikationsnummersekvens
  const voucherCheck = await checkVoucherSequence(companyId, year);
  checks.push({ ...voucherCheck, checkedAt: now });
  
  // 3. Momsavstämning
  const vatCheck = await checkVATReconciliation(companyId, year, month);
  checks.push({ ...vatCheck, checkedAt: now });
  
  // 4. Bankavstämning
  const bankCheck = await checkBankReconciliation(companyId, year, month);
  checks.push({ ...bankCheck, checkedAt: now });
  
  // 5. Balansräkning
  const balanceCheck = await checkBalance(companyId, year, month);
  checks.push({ ...balanceCheck, checkedAt: now });
  
  // 6. Framtida datum
  const futureDatesCheck = await checkFutureDates(companyId, year, month);
  checks.push({ ...futureDatesCheck, checkedAt: now });
  
  // 7. Stora belopp
  const largeAmountsCheck = await checkLargeAmounts(companyId, year, month);
  checks.push({ ...largeAmountsCheck, checkedAt: now });
  
  // Uppdatera period med kontroller
  const blockers = checks.filter(c => c.isBlocking && c.status === 'FAILED');
  const allPassed = blockers.length === 0;
  
  await updatePeriodChecks(companyId, period.periodKey, checks, allPassed);
  
  return { checks, allPassed, blockers };
}

/**
 * Stäng period
 */
export async function closePeriod(
  companyId: string,
  year: number,
  month: number,
  closedBy: string,
  force = false
): Promise<ClosingResult> {
  const period = await getOrCreatePeriod(companyId, year, month);
  
  // Kontrollera att perioden inte redan är stängd
  if (period.status === 'CLOSED' || period.status === 'LOCKED') {
    return {
      success: false,
      period,
      blockers: [{
        id: 'already_closed',
        name: 'Period redan stängd',
        description: 'Perioden är redan stängd eller låst',
        status: 'FAILED',
        isBlocking: true,
        message: `Perioden stängdes ${period.closedAt}`,
      }],
      warnings: [],
    };
  }
  
  // Kör pre-close kontroller
  const { checks, allPassed, blockers } = await runPreCloseChecks(companyId, year, month);
  
  if (!allPassed && !force) {
    return {
      success: false,
      period: await getOrCreatePeriod(companyId, year, month),
      blockers,
      warnings: checks.filter(c => c.status === 'WARNING'),
    };
  }
  
  // Generera periodsammanfattning
  const summary = await generatePeriodSummary(companyId, year, month);
  
  // Stäng perioden
  const now = new Date().toISOString();
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `PERIOD#${period.periodKey}` },
    UpdateExpression: `
      SET #status = :status, 
          closedAt = :closedAt, 
          closedBy = :closedBy,
          summary = :summary,
          allChecksPassed = :allPassed,
          history = list_append(history, :historyEntry)
    `,
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'CLOSED',
      ':closedAt': now,
      ':closedBy': closedBy,
      ':summary': summary,
      ':allPassed': true,
      ':historyEntry': [{
        action: 'PERIOD_CLOSED',
        performedBy: closedBy,
        performedAt: now,
        details: force ? 'Forcerad stängning' : undefined,
      }],
    },
  }));
  
  return {
    success: true,
    period: {
      ...period,
      status: 'CLOSED',
      closedAt: now,
      closedBy,
      summary,
    },
    blockers: [],
    warnings: checks.filter(c => c.status === 'WARNING'),
  };
}

/**
 * Lås period (permanent - kräver revisorsgodkännande för upplåsning)
 */
export async function lockPeriod(
  companyId: string,
  year: number,
  month: number,
  lockedBy: string
): Promise<{ success: boolean; message: string }> {
  const period = await getOrCreatePeriod(companyId, year, month);
  
  if (period.status !== 'CLOSED') {
    return { success: false, message: 'Perioden måste vara stängd innan den kan låsas' };
  }
  
  const now = new Date().toISOString();
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `PERIOD#${period.periodKey}` },
    UpdateExpression: `
      SET #status = :status, 
          lockedAt = :lockedAt,
          history = list_append(history, :historyEntry)
    `,
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'LOCKED',
      ':lockedAt': now,
      ':historyEntry': [{
        action: 'PERIOD_LOCKED',
        performedBy: lockedBy,
        performedAt: now,
      }],
    },
  }));
  
  return { success: true, message: 'Perioden är nu låst' };
}

/**
 * Öppna en stängd period (kräver behörighet)
 */
export async function reopenPeriod(
  companyId: string,
  year: number,
  month: number,
  openedBy: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const period = await getOrCreatePeriod(companyId, year, month);
  
  if (period.status === 'LOCKED') {
    return { success: false, message: 'Låsta perioder kan inte öppnas utan revisorsgodkännande' };
  }
  
  if (period.status !== 'CLOSED') {
    return { success: false, message: 'Perioden är inte stängd' };
  }
  
  const now = new Date().toISOString();
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `PERIOD#${period.periodKey}` },
    UpdateExpression: `
      SET #status = :status, 
          history = list_append(history, :historyEntry)
      REMOVE closedAt, closedBy
    `,
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status': 'OPEN',
      ':historyEntry': [{
        action: 'PERIOD_REOPENED',
        performedBy: openedBy,
        performedAt: now,
        details: reason,
      }],
    },
  }));
  
  return { success: true, message: 'Perioden är nu öppen igen' };
}

// ============ Check Functions ============

async function checkPendingDocuments(
  companyId: string,
  year: number,
  month: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'pending_documents')!;
  
  try {
    const { start, end } = getMonthRange(year, month);
    const jobs = await jobStore.getByCompany(companyId);
    const periodJobs = jobs.filter(j => {
      const d = getJobDocDate(j);
      return d >= start && d <= end;
    });

    const okStatuses = new Set(['approved', 'sent', 'completed']);
    const pending = periodJobs.filter(j => !okStatuses.has(j.status));

    if (pending.length > 0) {
      return {
        ...check,
        status: 'FAILED',
        message: `${pending.length} dokument är inte klara (måste vara godkända/skickade)`,
        details: {
          start,
          end,
          pendingCount: pending.length,
          pendingByStatus: pending.reduce<Record<string, number>>((acc, j) => {
            acc[j.status] = (acc[j.status] || 0) + 1;
            return acc;
          }, {}),
          sampleJobIds: pending.slice(0, 10).map(j => j.id),
        },
      };
    }
    
    return {
      ...check,
      status: 'PASSED',
      message: 'Alla dokument är godkända',
    };
  } catch (error) {
    return {
      ...check,
      status: 'FAILED',
      message: `Kunde inte kontrollera dokument: ${error}`,
    };
  }
}

async function checkVoucherSequence(
  companyId: string,
  year: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'voucher_sequence')!;
  
  try {
    const series: ('A' | 'K' | 'L' | 'B' | 'M' | 'S')[] = ['A', 'K', 'L', 'B', 'M', 'S'];
    const allGaps: { series: string; gaps: number[] }[] = [];
    
    for (const s of series) {
      const result = await validateVoucherSequence(companyId, s, year);
      if (result.gaps.length > 0) {
        allGaps.push({ series: s, gaps: result.gaps });
      }
    }
    
    if (allGaps.length > 0) {
      return {
        ...check,
        status: 'FAILED',
        message: `Luckor i verifikationsnummersekvens för ${allGaps.map(g => g.series).join(', ')}`,
        details: { gaps: allGaps },
      };
    }
    
    return {
      ...check,
      status: 'PASSED',
      message: 'Verifikationsnummersekvens är komplett',
    };
  } catch (error) {
    return {
      ...check,
      status: 'WARNING',
      message: `Kunde inte verifiera sekvens: ${error}`,
    };
  }
}

async function checkVATReconciliation(
  companyId: string,
  year: number,
  month: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'vat_reconciliation')!;
  
  try {
    const { start, end } = getMonthRange(year, month);
    const report = await vatReporting.generateReport(companyId, start, end, 'monthly');

    const vatInput = report.inputVAT.total;
    const vatOutput = report.outputVAT.total;
    const netVAT = report.netVAT;

    // Sanity: if we have jobs with VAT but report shows 0, fail (blocking)
    const jobs = await jobStore.getByCompany(companyId);
    const periodJobs = jobs.filter(j => {
      const d = getJobDocDate(j);
      return d >= start && d <= end;
    });
    const jobsWithVat = periodJobs.filter(j => (j.classification?.vatAmount || 0) !== 0);
    const reportHasVat = (vatInput + vatOutput) !== 0;
    if (jobsWithVat.length > 0 && !reportHasVat) {
      return {
        ...check,
        status: 'FAILED',
        message: 'Momsavstämning: dokument har moms men rapporten visar 0',
        details: {
          start,
          end,
          jobsWithVat: jobsWithVat.length,
          sampleJobIds: jobsWithVat.slice(0, 10).map(j => j.id),
        },
      };
    }

    return {
      ...check,
      status: 'PASSED',
      message: `Ingående moms: ${vatInput.toFixed(2)} kr, Utgående moms: ${vatOutput.toFixed(2)} kr, Netto: ${netVAT.toFixed(2)} kr`,
      details: {
        start,
        end,
        vatInput,
        vatOutput,
        netVAT,
        entryCount: report.entries.length,
      },
    };
  } catch (error) {
    return {
      ...check,
      status: 'FAILED',
      message: `Kunde inte verifiera moms: ${error}`,
    };
  }
}

async function checkBankReconciliation(
  companyId: string,
  year: number,
  month: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'bank_reconciliation')!;
  
  try {
    const reconciliation = await generateReconciliationSummary(companyId, year, month);
    
    if (reconciliation.unmatchedCount > 0) {
      return {
        ...check,
        status: check.isBlocking ? 'FAILED' : 'WARNING',
        message: `${reconciliation.unmatchedCount} banktransaktioner är inte matchade`,
        details: { 
          total: reconciliation.totalTransactions,
          matched: reconciliation.matchedCount,
          unmatched: reconciliation.unmatchedCount,
        },
      };
    }
    
    return {
      ...check,
      status: 'PASSED',
      message: `Alla ${reconciliation.totalTransactions} banktransaktioner är matchade`,
    };
  } catch (error) {
    return {
      ...check,
      status: check.isBlocking ? 'FAILED' : 'WARNING',
      message: `Kunde inte kontrollera bankavstämning: ${error}`,
    };
  }
}

async function checkBalance(
  companyId: string,
  year: number,
  month: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'balance_check')!;
  
  try {
    const { start, end } = getMonthRange(year, month);
    const jobs = await jobStore.getByCompany(companyId);
    const periodJobs = jobs
      .filter(j => {
        const d = getJobDocDate(j);
        return d >= start && d <= end;
      })
      .filter(j => j.status === 'approved' || j.status === 'sent');

    const invalid: Array<{ jobId: string; errorCodes: string[] }> = [];
    for (const j of periodJobs) {
      if (!j.classification) {
        invalid.push({ jobId: j.id, errorCodes: ['MISSING_CLASSIFICATION'] });
        continue;
      }
      const res = validateClassification(j.classification);
      if (!res.isValid) {
        invalid.push({ jobId: j.id, errorCodes: res.errors.map(e => e.code) });
      }
    }

    if (invalid.length > 0) {
      return {
        ...check,
        status: 'FAILED',
        message: `${invalid.length} dokument/verifikationer har valideringsfel (debet/kredit/moms/datum)`,
        details: { start, end, invalid: invalid.slice(0, 20) },
      };
    }

    return {
      ...check,
      status: 'PASSED',
      message: `Alla ${periodJobs.length} godkända/skickade dokument passerar validering`,
      details: { start, end, validatedCount: periodJobs.length },
    };
  } catch (e) {
    return {
      ...check,
      status: 'FAILED',
      message: `Kunde inte köra balans/validering: ${e}`,
    };
  }
}

async function checkFutureDates(
  companyId: string,
  year: number,
  month: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'future_dates')!;
  
  try {
    const { start, end } = getMonthRange(year, month);
    const today = toYmd(new Date());
    const jobs = await jobStore.getByCompany(companyId);
    const periodJobs = jobs.filter(j => {
      const d = getJobDocDate(j);
      return d >= start && d <= end;
    });
    const future = periodJobs.filter(j => getJobDocDate(j) > today);
    if (future.length > 0) {
      return {
        ...check,
        status: 'WARNING',
        message: `${future.length} dokument har datum i framtiden (kontrollera)`,
        details: { today, sampleJobIds: future.slice(0, 10).map(j => j.id) },
      };
    }
    return {
      ...check,
      status: 'PASSED',
      message: 'Inga dokument med framtida datum',
    };
  } catch (e) {
    return {
      ...check,
      status: 'WARNING',
      message: `Kunde inte kontrollera framtida datum: ${e}`,
    };
  }
}

async function checkLargeAmounts(
  companyId: string,
  year: number,
  month: number
): Promise<PreCloseCheck> {
  const check = PRE_CLOSE_CHECKS.find(c => c.id === 'large_amounts')!;
  
  try {
    const { start, end } = getMonthRange(year, month);
    const threshold = Number(process.env.AIFM_LARGE_AMOUNT_THRESHOLD || '100000');
    const jobs = await jobStore.getByCompany(companyId);
    const periodJobs = jobs.filter(j => {
      const d = getJobDocDate(j);
      return d >= start && d <= end;
    });
    const large = periodJobs.filter(j => Math.abs(j.classification?.totalAmount || 0) >= threshold);
    if (large.length > 0) {
      return {
        ...check,
        status: 'WARNING',
        message: `${large.length} dokument har stora belopp (>= ${threshold.toLocaleString('sv-SE')} kr)`,
        details: {
          threshold,
          sample: large.slice(0, 10).map(j => ({ jobId: j.id, amount: j.classification?.totalAmount })),
        },
      };
    }
    return {
      ...check,
      status: 'PASSED',
      message: 'Inga ovanligt stora belopp',
    };
  } catch (e) {
    return {
      ...check,
      status: 'WARNING',
      message: `Kunde inte kontrollera stora belopp: ${e}`,
    };
  }
}

// ============ Helper Functions ============

async function updatePeriodChecks(
  companyId: string,
  periodKey: string,
  checks: PreCloseCheck[],
  allPassed: boolean
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `PERIOD#${periodKey}` },
    UpdateExpression: 'SET preCloseChecks = :checks, allChecksPassed = :allPassed',
    ExpressionAttributeValues: {
      ':checks': checks,
      ':allPassed': allPassed,
    },
  }));
}

async function generatePeriodSummary(
  companyId: string,
  year: number,
  month: number
): Promise<PeriodSummary> {
  const { start, end } = getMonthRange(year, month);
  const jobs = await jobStore.getByCompany(companyId);
  const periodJobs = jobs.filter(j => {
    const d = getJobDocDate(j);
    return d >= start && d <= end;
  });

  const approvedOrSent = periodJobs.filter(j => j.status === 'approved' || j.status === 'sent');
  const sent = periodJobs.filter(j => j.status === 'sent');
  const pending = periodJobs.filter(j => !(j.status === 'approved' || j.status === 'sent' || j.status === 'completed'));

  const invoiceJobs = periodJobs.filter(j => j.classification?.docType === 'INVOICE' || j.classification?.docType === 'CREDIT_NOTE');
  const receiptJobs = periodJobs.filter(j => j.classification?.docType === 'RECEIPT');

  const vat = await vatReporting.generateReport(companyId, start, end, 'monthly');
  const bank = await generateReconciliationSummary(companyId, year, month).catch(() => null);

  return {
    totalDocuments: periodJobs.length,
    approvedDocuments: approvedOrSent.length,
    pendingDocuments: pending.length,
    sentToFortnox: sent.length,
    totalInvoiceAmount: invoiceJobs.reduce((sum, j) => sum + (j.classification?.totalAmount || 0), 0),
    totalReceiptAmount: receiptJobs.reduce((sum, j) => sum + (j.classification?.totalAmount || 0), 0),
    totalVATInput: vat.inputVAT.total,
    totalVATOutput: vat.outputVAT.total,
    vatToPay: vat.netVAT,
    accountSummary: [],
    voucherSeries: [],
    bankReconciliation: bank
      ? {
          matchedTransactions: bank.matchedCount,
          unmatchedTransactions: bank.unmatchedCount,
          totalMatched: bank.matchedOutgoing + bank.matchedIncoming,
          totalUnmatched: (bank.totalIncoming + bank.totalOutgoing) - (bank.matchedIncoming + bank.matchedOutgoing),
        }
      : undefined,
    generatedAt: new Date().toISOString(),
  };
}

// ============ Query Functions ============

/**
 * Hämta alla perioder för ett företag
 */
export async function getAllPeriods(companyId: string): Promise<Period[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `COMPANY#${companyId}`,
      ':prefix': 'PERIOD#',
    },
    ScanIndexForward: false, // Newest first
  }));
  
  return (result.Items || []) as Period[];
}

/**
 * Hämta öppna perioder
 */
export async function getOpenPeriods(companyId: string): Promise<Period[]> {
  const periods = await getAllPeriods(companyId);
  return periods.filter(p => p.status === 'OPEN');
}

/**
 * Kontrollera om en period är öppen för bokföring
 */
export async function isPeriodOpen(
  companyId: string,
  year: number,
  month: number
): Promise<boolean> {
  const period = await getOrCreatePeriod(companyId, year, month);
  return period.status === 'OPEN';
}

/**
 * Hämta senaste stängda period
 */
export async function getLastClosedPeriod(companyId: string): Promise<Period | null> {
  const periods = await getAllPeriods(companyId);
  const closed = periods.filter(p => p.status === 'CLOSED' || p.status === 'LOCKED');
  return closed[0] || null;
}








