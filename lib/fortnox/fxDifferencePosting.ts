import { getFortnoxClient } from './client';
import { fortnoxBootstrapStore } from './bootstrapStore';
import { jobStore } from '../accounting/jobStore';

type VoucherSeriesPayload = { VoucherSeries?: Array<{ Code: string; Description?: string }> };

function pickVoucherSeries(series?: VoucherSeriesPayload): string {
  const list = series?.VoucherSeries || [];
  if (list.some(s => s.Code === 'A')) return 'A';
  return list[0]?.Code || 'A';
}

/**
 * Post FX exchange difference (3960/7960) as a Fortnox voucher.
 * Idempotent: if job.fortnoxFxVoucherId exists, no-op.
 */
export async function postFxDifferenceVoucher(companyId: string, jobId: string) {
  const job = await jobStore.get(jobId);
  if (!job) return { success: false as const, error: 'Job not found' };
  if (job.companyId !== companyId) return { success: false as const, error: 'Company mismatch' };
  if (job.fortnoxFxVoucherId) return { success: true as const, voucherId: job.fortnoxFxVoucherId, alreadyPosted: true as const };

  const payment = job.payment;
  const diff = payment?.exchangeDifference;
  if (!payment || payment.status !== 'completed') return { success: false as const, error: 'Payment not completed' };
  if (!diff || !diff.voucherSuggestion) return { success: false as const, error: 'No exchangeDifference voucherSuggestion available' };
  if (!diff.difference || diff.difference <= 0) return { success: false as const, error: 'No FX difference to post' };

  const client = await getFortnoxClient(companyId);
  if (!client) return { success: false as const, error: 'Fortnox client not available' };

  const voucherSeriesCache = await fortnoxBootstrapStore.getCache<VoucherSeriesPayload>(companyId, 'VOUCHERSERIES');
  const series = pickVoucherSeries(voucherSeriesCache?.payload);

  const transactionDate = payment.paymentDate || (payment.paidAt ? payment.paidAt.split('T')[0] : undefined) || new Date().toISOString().split('T')[0];
  const v = diff.voucherSuggestion;

  const res = await client.createVoucher({
    VoucherSeries: series,
    TransactionDate: transactionDate,
    Description: v.description,
    VoucherRows: [
      { Account: parseInt(v.debitAccount, 10), Debit: v.debitAmount, Description: v.description },
      { Account: parseInt(v.creditAccount, 10), Credit: v.creditAmount, Description: v.description },
    ],
  });

  if (!res.success || !res.data) return { success: false as const, error: res.error || 'Failed to create Fortnox voucher' };

  const voucherId = `${res.data.Voucher.VoucherSeries}${res.data.Voucher.VoucherNumber}`;
  const now = new Date().toISOString();
  await jobStore.update(jobId, {
    fortnoxFxVoucherId: voucherId,
    updatedAt: now,
  });

  return { success: true as const, voucherId, alreadyPosted: false as const };
}


