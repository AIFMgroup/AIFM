import { getFortnoxClient } from './client';
import { jobStore } from '../accounting/jobStore';

/**
 * Pull SupplierInvoice status from Fortnox and persist it on the job.
 * Fortnox is treated as source-of-truth for Booked/Cancelled/Balance/Credit.
 */
export async function syncSupplierInvoiceStatus(companyId: string, jobId: string) {
  const job = await jobStore.get(jobId);
  if (!job) return { success: false, error: 'Job not found' as const };
  if (job.companyId !== companyId) return { success: false, error: 'Company mismatch' as const };
  if (!job.fortnoxInvoiceId) return { success: false, error: 'Missing fortnoxInvoiceId' as const };

  const client = await getFortnoxClient(companyId);
  if (!client) return { success: false, error: 'Fortnox client not available' as const };

  const res = await client.getSupplierInvoice(job.fortnoxInvoiceId);
  if (!res.success || !res.data) return { success: false, error: res.error || 'Fortnox error' as const };

  const si = res.data.SupplierInvoice;
  const now = new Date().toISOString();

  await jobStore.update(jobId, {
    fortnoxInvoiceStatus: {
      booked: si.Booked,
      cancelled: si.Cancelled,
      credit: si.Credit,
      balance: si.Balance,
      lastSyncedAt: now,
    },
    updatedAt: now,
  });

  return { success: true as const, status: si };
}


