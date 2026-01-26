/**
 * Fortnox Bootstrap
 *
 * Hämtar och cachar de viktigaste Fortnox-resurserna per bolag så att
 * bokföringsagenten kan jobba snabbt och deterministiskt (kontoplan, dimensioner osv).
 */

import { FortnoxClient } from './client';
import { fortnoxBootstrapStore } from './bootstrapStore';

export interface FortnoxBootstrapOptions {
  includeSuppliers?: boolean;
  includeArticles?: boolean;
}

export async function bootstrapFortnoxCompany(companyId: string, options?: FortnoxBootstrapOptions): Promise<void> {
  const startedAt = new Date().toISOString();

  await fortnoxBootstrapStore.setState(companyId, {
    status: 'running',
    startedAt,
    finishedAt: undefined,
    lastError: undefined,
    stats: {},
  });

  const client = new FortnoxClient(companyId);
  const ok = await client.init();
  if (!ok) {
    await fortnoxBootstrapStore.setState(companyId, {
      status: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      lastError: 'Fortnox är inte kopplat för detta bolag.',
      stats: {},
    });
    return;
  }

  const stats: Record<string, number> = {};

  try {
    // Accounts
    const accounts = await client.getAccounts();
    if (accounts.success && accounts.data) {
      const payload = accounts.data as unknown as { Accounts?: unknown[] };
      stats.accounts = Array.isArray(payload.Accounts) ? payload.Accounts.length : 0;
      await fortnoxBootstrapStore.putCache(companyId, 'ACCOUNTS', accounts.data);
    }

    // Cost centers
    const costCenters = await client.getCostCenters();
    if (costCenters.success && costCenters.data) {
      const payload = costCenters.data as unknown as { CostCenters?: unknown[] };
      stats.costCenters = Array.isArray(payload.CostCenters) ? payload.CostCenters.length : 0;
      await fortnoxBootstrapStore.putCache(companyId, 'COSTCENTERS', costCenters.data);
    }

    // Projects
    const projects = await client.getProjects();
    if (projects.success && projects.data) {
      const payload = projects.data as unknown as { Projects?: unknown[] };
      stats.projects = Array.isArray(payload.Projects) ? payload.Projects.length : 0;
      await fortnoxBootstrapStore.putCache(companyId, 'PROJECTS', projects.data);
    }

    // Voucher series
    const voucherSeries = await client.getVoucherSeries();
    if (voucherSeries.success && voucherSeries.data) {
      const payload = voucherSeries.data as unknown as { VoucherSeries?: unknown[] };
      stats.voucherSeries = Array.isArray(payload.VoucherSeries) ? payload.VoucherSeries.length : 0;
      await fortnoxBootstrapStore.putCache(companyId, 'VOUCHERSERIES', voucherSeries.data);
    }

    // Financial years
    const financialYears = await client.getFinancialYears();
    if (financialYears.success && financialYears.data) {
      const payload = financialYears.data as unknown as { FinancialYears?: unknown[] };
      stats.financialYears = Array.isArray(payload.FinancialYears) ? payload.FinancialYears.length : 0;
      await fortnoxBootstrapStore.putCache(companyId, 'FINANCIALYEARS', financialYears.data);
    }

    // Suppliers (optional, can be large)
    if (options?.includeSuppliers !== false) {
      const suppliers = await client.getSuppliers();
      if (suppliers.success && suppliers.data) {
        const payload = suppliers.data as unknown as { Suppliers?: unknown[] };
        stats.suppliers = Array.isArray(payload.Suppliers) ? payload.Suppliers.length : 0;
        await fortnoxBootstrapStore.putCache(companyId, 'SUPPLIERS', suppliers.data);
      }
    }

    // Articles (optional, can be large)
    if (options?.includeArticles !== false) {
      const articles = await client.getArticles();
      if (articles.success && articles.data) {
        const payload = articles.data as unknown as { Articles?: unknown[] };
        stats.articles = Array.isArray(payload.Articles) ? payload.Articles.length : 0;
        await fortnoxBootstrapStore.putCache(companyId, 'ARTICLES', articles.data);
      }
    }

    await fortnoxBootstrapStore.setState(companyId, {
      status: 'ready',
      startedAt,
      finishedAt: new Date().toISOString(),
      lastError: undefined,
      stats,
    });
  } catch (err) {
    await fortnoxBootstrapStore.setState(companyId, {
      status: 'error',
      startedAt,
      finishedAt: new Date().toISOString(),
      lastError: err instanceof Error ? err.message : 'Bootstrap failed',
      stats,
    });
  }
}


