/**
 * Depreciation Engine - Avskrivningsmotor
 * 
 * Beräknar och bokför avskrivningar på anläggningstillgångar
 * enligt svenska regler och BAS-kontoplan.
 */

import { FortnoxClient } from '@/lib/fortnox/client';
import { listAssets, type StoredAsset } from './assetStore';

// Avskrivningsregler per tillgångstyp
export interface DepreciationRule {
  assetAccount: string;        // Tillgångskonto (t.ex. 1220)
  accumulatedAccount: string;  // Ackumulerade avskrivningar (t.ex. 1229)
  expenseAccount: string;      // Avskrivningskostnad (t.ex. 7821)
  annualRate: number;          // Årlig avskrivningsprocent
  method: 'linear' | 'declining'; // Avskrivningsmetod
  description: string;
}

// Svenska standardregler för avskrivningar
export const DEPRECIATION_RULES: Record<string, DepreciationRule> = {
  // 1210 - Maskiner och tekniska anläggningar
  '1210': {
    assetAccount: '1210',
    accumulatedAccount: '1219',
    expenseAccount: '7821',
    annualRate: 0.20,
    method: 'linear',
    description: 'Maskiner och tekniska anläggningar',
  },
  // 1220 - Inventarier och verktyg
  '1220': {
    assetAccount: '1220',
    accumulatedAccount: '1229',
    expenseAccount: '7822',
    annualRate: 0.20,
    method: 'linear',
    description: 'Inventarier och verktyg',
  },
  // 1230 - Installationer
  '1230': {
    assetAccount: '1230',
    accumulatedAccount: '1239',
    expenseAccount: '7823',
    annualRate: 0.10,
    method: 'linear',
    description: 'Installationer',
  },
  // 1240 - Bilar och transportmedel
  '1240': {
    assetAccount: '1240',
    accumulatedAccount: '1249',
    expenseAccount: '7824',
    annualRate: 0.20,
    method: 'declining',
    description: 'Bilar och transportmedel',
  },
  // 1250 - Datorer
  '1250': {
    assetAccount: '1250',
    accumulatedAccount: '1259',
    expenseAccount: '7825',
    annualRate: 0.33,
    method: 'linear',
    description: 'Datorer och IT-utrustning',
  },
  // 1110 - Byggnader
  '1110': {
    assetAccount: '1110',
    accumulatedAccount: '1119',
    expenseAccount: '7811',
    annualRate: 0.04,
    method: 'linear',
    description: 'Byggnader',
  },
  // Immateriella tillgångar
  '1010': {
    assetAccount: '1010',
    accumulatedAccount: '1019',
    expenseAccount: '7810',
    annualRate: 0.20,
    method: 'linear',
    description: 'Utvecklingsutgifter',
  },
  '1030': {
    assetAccount: '1030',
    accumulatedAccount: '1039',
    expenseAccount: '7810',
    annualRate: 0.20,
    method: 'linear',
    description: 'Licenser och programvaror',
  },
};

export interface Asset {
  id: string;
  name: string;
  account: string;
  acquisitionDate: string;
  acquisitionValue: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  monthlyDepreciation: number;
  usefulLifeMonths: number;
  depreciationMethod: 'linear' | 'declining';
}

export interface DepreciationCalculation {
  asset: Asset;
  periodAmount: number;
  newBookValue: number;
  newAccumulatedDepreciation: number;
  isFullyDepreciated: boolean;
}

export interface DepreciationVoucher {
  date: string;
  description: string;
  totalAmount: number;
  rows: {
    account: string;
    debit?: number;
    credit?: number;
    description: string;
  }[];
  details: DepreciationCalculation[];
}

export interface AccountBalance {
  account: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

class DepreciationEngine {
  private fortnoxClient: FortnoxClient | null = null;

  /**
   * Initiera med Fortnox-klient
   */
  async init(fortnoxClient: FortnoxClient): Promise<void> {
    this.fortnoxClient = fortnoxClient;
  }

  /**
   * Hämta alla anläggningstillgångar från bokföringen
   */
  async getAssets(companyId: string, year: number): Promise<Asset[]> {
    // Backward compatible: return assets "as of" end of year (Dec) for reporting.
    return this.getAssetsForPeriod(companyId, year, 12);
  }

  /**
   * Hämta anläggningstillgångar för en specifik period (för korrekt avskrivning)
   */
  async getAssetsForPeriod(companyId: string, year: number, month: number): Promise<Asset[]> {
    const stored = await listAssets(companyId);
    const active = stored.filter(a => a.status !== 'disposed');

    return active.map(a => this.hydrateAssetForPeriod(a, year, month));
  }

  private hydrateAssetForPeriod(stored: StoredAsset, year: number, month: number): Asset {
    const rule = DEPRECIATION_RULES[stored.account];
    const usefulLifeMonths = stored.usefulLifeMonths || Math.round(1 / ((rule?.annualRate || 0.2) / 12));

    const monthlyDepreciation = Math.round((stored.acquisitionValue / usefulLifeMonths) * 100) / 100;

    const monthsElapsed = monthsBetweenInclusive(stored.acquisitionDate, `${year}-${String(month).padStart(2, '0')}-01`) - 1;
    const accumulatedDepreciation = Math.min(stored.acquisitionValue, Math.max(0, monthsElapsed) * monthlyDepreciation);
    const currentBookValue = Math.max(0, stored.acquisitionValue - accumulatedDepreciation);

    return {
      id: stored.id,
      name: stored.name,
      account: stored.account,
      acquisitionDate: stored.acquisitionDate,
      acquisitionValue: stored.acquisitionValue,
      currentBookValue,
      accumulatedDepreciation,
      monthlyDepreciation,
      usefulLifeMonths,
      depreciationMethod: stored.depreciationMethod,
    };
  }

  /**
   * Hämta kontosaldo från Fortnox eller fallback till estimat
   */
  private async getAccountBalance(account: string, year: number): Promise<number> {
    if (this.fortnoxClient) {
      try {
        // Försök hämta från Fortnox
        const response = await this.fortnoxClient.getAccounts();
        if (response.success && response.data) {
          const accountData = response.data.Accounts?.find(
            a => a.Number.toString() === account
          );
          // Note: I verklig implementation skulle vi hämta saldon via specifikt API
          // För nu returnerar vi 0 och använder fallback-estimat
        }
      } catch (error) {
        console.warn(`[DepreciationEngine] Could not fetch balance for ${account}:`, error);
      }
    }
    
    // Fallback: Returnera estimerade värden baserat på typiska SME-värden
    return this.getEstimatedBalance(account);
  }

  /**
   * Estimerade saldon för demo/test
   */
  private getEstimatedBalance(account: string): number {
    const estimates: Record<string, number> = {
      '1210': 150000,  // Maskiner
      '1219': -45000,  // Ack. avskr. maskiner
      '1220': 250000,  // Inventarier
      '1229': -100000, // Ack. avskr. inventarier
      '1250': 120000,  // Datorer
      '1259': -80000,  // Ack. avskr. datorer
      '1240': 0,       // Bilar
      '1249': 0,       // Ack. avskr. bilar
    };
    
    return estimates[account] || 0;
  }

  /**
   * Beräkna avskrivningar för en period
   */
  calculateDepreciation(
    asset: Asset,
    year: number,
    month: number
  ): DepreciationCalculation {
    let periodAmount: number;
    
    if (asset.depreciationMethod === 'linear') {
      // Linjär avskrivning - samma belopp varje månad
      periodAmount = asset.monthlyDepreciation;
    } else {
      // Degressiv avskrivning - baseras på restvärde
      const rule = DEPRECIATION_RULES[asset.account];
      periodAmount = Math.round(asset.currentBookValue * (rule?.annualRate || 0.20) / 12);
    }
    
    // Begränsa till restvärde
    periodAmount = Math.min(periodAmount, asset.currentBookValue);
    
    const newAccumulatedDepreciation = asset.accumulatedDepreciation + periodAmount;
    const newBookValue = asset.acquisitionValue - newAccumulatedDepreciation;
    const isFullyDepreciated = newBookValue <= 0;
    
    return {
      asset,
      periodAmount,
      newBookValue: Math.max(0, newBookValue),
      newAccumulatedDepreciation,
      isFullyDepreciated,
    };
  }

  /**
   * Generera avskrivningsverifikation för en period
   */
  async generateDepreciationVoucher(
    companyId: string,
    year: number,
    month: number
  ): Promise<DepreciationVoucher | null> {
    const assets = await this.getAssetsForPeriod(companyId, year, month);
    
    if (assets.length === 0) {
      return null;
    }
    
    const calculations: DepreciationCalculation[] = [];
    const voucherRows: DepreciationVoucher['rows'] = [];
    let totalAmount = 0;
    
    // Gruppera per kontotyp för att konsolidera verifikationsrader
    const byAccount: Record<string, { expense: string; accumulated: string; amount: number; description: string }> = {};
    
    for (const asset of assets) {
      if (asset.currentBookValue <= 0) continue;
      
      const calc = this.calculateDepreciation(asset, year, month);
      
      if (calc.periodAmount > 0) {
        calculations.push(calc);
        totalAmount += calc.periodAmount;
        
        const rule = DEPRECIATION_RULES[asset.account];
        if (rule) {
          const key = asset.account;
          if (!byAccount[key]) {
            byAccount[key] = {
              expense: rule.expenseAccount,
              accumulated: rule.accumulatedAccount,
              amount: 0,
              description: rule.description,
            };
          }
          byAccount[key].amount += calc.periodAmount;
        }
      }
    }
    
    if (totalAmount === 0) {
      return null;
    }
    
    // Skapa konsoliderade verifikationsrader
    for (const [account, data] of Object.entries(byAccount)) {
      // Debet: Avskrivningskostnad
      voucherRows.push({
        account: data.expense,
        debit: data.amount,
        description: `Avskrivning ${data.description}`,
      });
      
      // Kredit: Ackumulerade avskrivningar
      voucherRows.push({
        account: data.accumulated,
        credit: data.amount,
        description: `Ack. avskrivning ${data.description}`,
      });
    }
    
    const lastDayOfMonth = new Date(year, month, 0);
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    return {
      date: lastDayOfMonth.toISOString().split('T')[0],
      description: `Avskrivningar ${monthNames[month - 1]} ${year}`,
      totalAmount,
      rows: voucherRows,
      details: calculations,
    };
  }

  /**
   * Bokför avskrivningar till Fortnox
   */
  async bookDepreciation(
    companyId: string,
    voucher: DepreciationVoucher
  ): Promise<{ success: boolean; voucherNumber?: string; error?: string }> {
    if (!this.fortnoxClient) {
      return { success: false, error: 'Fortnox client not initialized' };
    }
    
    try {
      const response = await this.fortnoxClient.createVoucher({
        VoucherSeries: 'A', // Automatiska verifikationer
        TransactionDate: voucher.date,
        Description: voucher.description,
        VoucherRows: voucher.rows.map(row => ({
          Account: parseInt(row.account),
          Debit: row.debit,
          Credit: row.credit,
          Description: row.description,
        })),
      });
      
      if (response.success && response.data) {
        return {
          success: true,
          voucherNumber: `${response.data.Voucher.VoucherSeries}${response.data.Voucher.VoucherNumber}`,
        };
      }
      
      return { success: false, error: response.error || 'Unknown error' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generera avskrivningsrapport
   */
  generateDepreciationReport(
    assets: Asset[],
    calculations: DepreciationCalculation[],
    year: number,
    month: number
  ): {
    summary: {
      totalAssetValue: number;
      totalAccumulatedDepreciation: number;
      totalBookValue: number;
      periodDepreciation: number;
      fullyDepreciatedAssets: number;
    };
    details: {
      account: string;
      description: string;
      acquisitionValue: number;
      accumulatedBefore: number;
      periodAmount: number;
      accumulatedAfter: number;
      bookValue: number;
    }[];
  } {
    const totalAssetValue = assets.reduce((sum, a) => sum + a.acquisitionValue, 0);
    const totalAccumulatedDepreciation = calculations.reduce((sum, c) => sum + c.newAccumulatedDepreciation, 0);
    const periodDepreciation = calculations.reduce((sum, c) => sum + c.periodAmount, 0);
    const fullyDepreciatedAssets = calculations.filter(c => c.isFullyDepreciated).length;
    
    return {
      summary: {
        totalAssetValue,
        totalAccumulatedDepreciation,
        totalBookValue: totalAssetValue - totalAccumulatedDepreciation,
        periodDepreciation,
        fullyDepreciatedAssets,
      },
      details: calculations.map(c => ({
        account: c.asset.account,
        description: c.asset.name,
        acquisitionValue: c.asset.acquisitionValue,
        accumulatedBefore: c.asset.accumulatedDepreciation,
        periodAmount: c.periodAmount,
        accumulatedAfter: c.newAccumulatedDepreciation,
        bookValue: c.newBookValue,
      })),
    };
  }
}

function monthsBetweenInclusive(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}

export const depreciationEngine = new DepreciationEngine();








