/**
 * Payment Service
 * 
 * Hanterar betalningar av leverantörsfakturor.
 * Förberedd för Tink/Open Banking integration.
 */

import { jobStore, AccountingJob } from '../jobStore';
import { auditLog } from '../auditLogger';
import { calculateExchangeDifference, generateExchangeDifferenceVoucher, Currency } from '../services/currencyService';
import { postFxDifferenceVoucher } from '@/lib/fortnox/fxDifferencePosting';

export interface PendingPayment {
  id: string;
  jobId: string;
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';
  paymentMethod?: 'manual' | 'tink' | 'fortnox';
  scheduledDate?: string;
  paidAt?: string;
  bankReference?: string;
  error?: string;
  exchangeDifference?: AccountingJob['payment'] extends { exchangeDifference?: infer T } ? T : unknown;
}

export interface PaymentSummary {
  totalPending: number;
  totalOverdue: number;
  totalScheduled: number;
  totalPaid: number;
  overdueCount: number;
  pendingCount: number;
  scheduledCount: number;
}

class PaymentService {
  /**
   * Get all pending payments for a company
   */
  async getPendingPayments(companyId: string): Promise<PendingPayment[]> {
    const jobs = await jobStore.getByCompany(companyId);
    
    // Filter to approved/sent invoices that might need payment
    const invoiceJobs = jobs.filter(job => 
      job.classification?.docType === 'INVOICE' &&
      (job.status === 'approved' || job.status === 'sent')
    );

    // Convert to pending payments
    const payments = invoiceJobs.map(job => {
      const base = this.jobToPayment(job);
      const persisted = job.payment;
      return persisted ? { ...base, ...persisted } : base;
    });

    return payments;
  }

  /**
   * Get payment summary
   */
  async getPaymentSummary(companyId: string): Promise<PaymentSummary> {
    const payments = await this.getPendingPayments(companyId);
    const now = new Date();

    const pending = payments.filter(p => p.status === 'pending');
    const overdue = pending.filter(p => new Date(p.dueDate) < now);
    const scheduled = payments.filter(p => p.status === 'scheduled');
    const completed = payments.filter(p => p.status === 'completed');

    return {
      totalPending: pending.reduce((sum, p) => sum + p.amount, 0),
      totalOverdue: overdue.reduce((sum, p) => sum + p.amount, 0),
      totalScheduled: scheduled.reduce((sum, p) => sum + p.amount, 0),
      totalPaid: completed.reduce((sum, p) => sum + p.amount, 0),
      overdueCount: overdue.length,
      pendingCount: pending.length,
      scheduledCount: scheduled.length,
    };
  }

  /**
   * Schedule a payment
   */
  async schedulePayment(
    paymentId: string, 
    scheduledDate: string,
    paymentMethod: 'manual' | 'tink' | 'fortnox' = 'manual'
  ): Promise<PendingPayment> {
    const jobId = this.getJobIdFromPaymentId(paymentId);
    if (!jobId) throw new Error('Invalid paymentId');

    const job = await jobStore.get(jobId);
    if (!job) throw new Error('Job not found');

    const now = new Date().toISOString();
    await jobStore.update(jobId, {
      payment: {
        status: 'scheduled',
        scheduledDate,
        paymentMethod,
      },
      updatedAt: now,
    });

    const updatedJob = await jobStore.get(jobId);
    if (!updatedJob) throw new Error('Job not found after update');
    const base = this.jobToPayment(updatedJob);
    return updatedJob.payment ? ({ ...base, ...updatedJob.payment } as PendingPayment) : base;
  }

  /**
   * Mark payment as completed
   */
  async markAsPaid(
    paymentId: string, 
    bankReference?: string,
    paymentDate?: string
  ): Promise<PendingPayment> {
    const jobId = this.getJobIdFromPaymentId(paymentId);
    if (!jobId) throw new Error('Invalid paymentId');

    const job = await jobStore.get(jobId);
    if (!job) throw new Error('Job not found');

    // Delegate to the canonical helper so bank-match and manual mark-paid share logic.
    return await this.completeJobPayment(job.companyId, jobId, {
      bankReference,
      paymentDate,
      paymentMethod: 'manual',
    });
  }

  /**
   * Canonical way to mark an accounting job as paid.
   * Used by Payments UI and by Bank matching when a transaction is confirmed.
   */
  async completeJobPayment(
    companyId: string,
    jobId: string,
    params?: {
      bankReference?: string;
      paymentDate?: string; // YYYY-MM-DD
      paymentMethod?: PendingPayment['paymentMethod'];
    }
  ): Promise<PendingPayment> {
    const job = await jobStore.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.companyId !== companyId) throw new Error('Company mismatch');

    const paymentId = `payment-${jobId}`;

    // Idempotent: if already completed, return merged state
    if (job.payment?.status === 'completed') {
      return {
        ...this.jobToPayment(job),
        ...(job.payment as any),
      } as PendingPayment;
    }

    const paidAtIso = new Date().toISOString();
    const payDate = params?.paymentDate || paidAtIso.split('T')[0];
    const bankReference = params?.bankReference;

    let exchangeDifference: AccountingJob['payment'] extends { exchangeDifference?: infer T } ? T : any = undefined;

    if (job.classification) {
      // FX difference only if we have original currency metadata (pipeline converts to SEK and keeps originals)
      const origAmt = job.classification.originalAmount;
      const origCur = job.classification.originalCurrency;
      const bookingDate = job.classification.exchangeRateDate || job.classification.invoiceDate;

      if (origAmt && origCur && origCur !== 'SEK') {
        const diff = await calculateExchangeDifference(
          origAmt,
          origCur as Currency,
          bookingDate,
          payDate
        );
        const voucherSuggestion = generateExchangeDifferenceVoucher(diff, '2440');
        exchangeDifference = {
          currency: origCur,
          bookingDate,
          paymentDate: payDate,
          bookingRate: diff.bookingRate,
          paymentRate: diff.paymentRate,
          originalAmount: diff.originalAmount,
          difference: diff.difference,
          isGain: diff.isGain,
          account: diff.account,
          voucherSuggestion,
        };
      }
    }

    const updatedPayment: PendingPayment = {
      id: paymentId,
      jobId,
      supplier: job.classification?.supplier || 'Okänd',
      invoiceNumber: job.classification?.invoiceNumber || '',
      invoiceDate: job.classification?.invoiceDate || payDate,
      dueDate: job.classification?.dueDate || payDate,
      amount: job.classification?.totalAmount ?? 0,
      currency: job.classification?.currency ?? 'SEK',
      status: 'completed',
      paidAt: paidAtIso,
      bankReference,
      paymentMethod: params?.paymentMethod,
      exchangeDifference,
    };

    await jobStore.update(jobId, {
      payment: {
        status: 'completed',
        paidAt: paidAtIso,
        paymentDate: payDate,
        bankReference,
        paymentMethod: params?.paymentMethod,
        exchangeDifference,
      },
      updatedAt: paidAtIso,
    });

    if (job.classification) {
      await auditLog.paymentCompleted(companyId, paymentId, job.classification.totalAmount, job.classification.supplier, {
        jobId,
        details: exchangeDifference ? { exchangeDifference } : undefined,
      } as any);
    }

    // Optional: auto-post FX difference voucher to Fortnox when enabled.
    // Guarded by env var to avoid surprising postings in production.
    if (process.env.AIFM_AUTO_POST_FX_DIFF === 'true' && exchangeDifference && exchangeDifference.difference > 0) {
      try {
        await postFxDifferenceVoucher(companyId, jobId);
      } catch (e) {
        console.warn('[Payments] Auto-post FX diff failed (non-fatal):', e);
      }
    }

    return updatedPayment;
  }

  /**
   * Cancel scheduled payment
   */
  async cancelPayment(paymentId: string): Promise<PendingPayment> {
    const jobId = this.getJobIdFromPaymentId(paymentId);
    if (!jobId) throw new Error('Invalid paymentId');

    const job = await jobStore.get(jobId);
    if (!job) throw new Error('Job not found');

    const now = new Date().toISOString();
    await jobStore.update(jobId, {
      payment: {
        status: 'pending',
        scheduledDate: undefined,
        paymentMethod: job.payment?.paymentMethod,
      },
      updatedAt: now,
    });

    const updatedJob = await jobStore.get(jobId);
    if (!updatedJob) throw new Error('Job not found after update');
    const base = this.jobToPayment(updatedJob);
    return updatedJob.payment ? ({ ...base, ...updatedJob.payment } as PendingPayment) : base;
  }

  /**
   * Initiate payment via Tink (placeholder)
   */
  async initiatePaymentViaTink(
    paymentId: string,
    _bankAccountId: string
  ): Promise<{ success: boolean; redirectUrl?: string; error?: string }> {
    // This would integrate with Tink's Payment Initiation API
    // For now, return a placeholder response
    
    const jobId = this.getJobIdFromPaymentId(paymentId);
    if (!jobId) return { success: false, error: 'Invalid paymentId' };
    const job = await jobStore.get(jobId);
    if (!job) return { success: false, error: 'Job not found' };

    // In a real implementation:
    // 1. Create payment request with Tink API
    // 2. Get redirect URL for bank authorization
    // 3. User authorizes in bank
    // 4. Tink confirms payment and calls webhook
    
    return {
      success: false,
      error: 'Tink integration not yet configured. Please use manual payment.',
    };
  }

  /**
   * Get payments due soon (next 7 days)
   */
  async getPaymentsDueSoon(companyId: string): Promise<PendingPayment[]> {
    const payments = await this.getPendingPayments(companyId);
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return payments.filter(p => {
      const dueDate = new Date(p.dueDate);
      return p.status === 'pending' && dueDate <= sevenDaysLater;
    });
  }

  /**
   * Get overdue payments
   */
  async getOverduePayments(companyId: string): Promise<PendingPayment[]> {
    const payments = await this.getPendingPayments(companyId);
    const now = new Date();

    return payments.filter(p => {
      const dueDate = new Date(p.dueDate);
      return p.status === 'pending' && dueDate < now;
    });
  }

  // Helper: Convert accounting job to payment
  private jobToPayment(job: AccountingJob): PendingPayment {
    const classification = job.classification!;
    
    return {
      id: `payment-${job.id}`,
      jobId: job.id,
      supplier: classification.supplier,
      invoiceNumber: classification.invoiceNumber,
      invoiceDate: classification.invoiceDate,
      dueDate: classification.dueDate,
      amount: classification.totalAmount,
      currency: classification.currency,
      status: 'pending',
    };
  }

  private getJobIdFromPaymentId(paymentId: string): string | null {
    if (!paymentId.startsWith('payment-')) return null;
    const jobId = paymentId.replace(/^payment-/, '');
    return jobId || null;
  }
}

export const paymentService = new PaymentService();


