/**
 * Reconciliation Engine
 * 
 * Jämför NAV-data från Secura med bankdata (SEB/Swedbank) för att:
 * - Identifiera avvikelser i positioner
 * - Validera kassasaldon
 * - Flagga misstänkta fel
 * - Generera avstämningsrapporter
 */

import { SecuraClient, getSecuraClient, SecuraNAVData, SecuraPosition } from '../secura/client';
import { SEBClient, getSEBClient, SEBCustodyPosition, SEBAccountBalance } from './seb-client';
import { SwedBankCustodyReport, SwedBankPosition } from './swedbank-pdf-processor';

// ============================================================================
// Types
// ============================================================================

export interface ReconciliationConfig {
  // Tröskelvärden för flaggning
  thresholds: {
    cashDifferencePercent: number;      // Max avvikelse för kassa (%)
    cashDifferenceAbsolute: number;     // Max avvikelse för kassa (absolut)
    positionDifferencePercent: number;  // Max avvikelse för position (%)
    priceDifferencePercent: number;     // Max avvikelse för kurs (%)
    missingPositionValue: number;       // Min värde för flaggning av saknad position
  };
  // Automatisk godkännande
  autoApproveWithinThreshold: boolean;
}

export interface PositionComparison {
  isin: string;
  instrumentName: string;
  
  // Secura-data
  secura: {
    quantity: number;
    price: number;
    value: number;
  } | null;
  
  // Bank-data
  bank: {
    quantity: number;
    price: number;
    value: number;
    source: 'SEB' | 'SWEDBANK';
  } | null;
  
  // Avvikelser
  differences: {
    quantityDiff: number;
    quantityDiffPercent: number;
    priceDiff: number;
    priceDiffPercent: number;
    valueDiff: number;
    valueDiffPercent: number;
  };
  
  // Status
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'MISSING_SECURA' | 'MISSING_BANK';
  flags: string[];
}

export interface CashComparison {
  currency: string;
  securaBalance: number;
  bankBalance: number;
  difference: number;
  differencePercent: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF';
  flags: string[];
}

export interface ReconciliationResult {
  fundId: string;
  fundName: string;
  reconciliationDate: string;
  generatedAt: string;
  
  // Sammanfattning
  summary: {
    totalPositions: number;
    matchingPositions: number;
    minorDifferences: number;
    majorDifferences: number;
    missingInSecura: number;
    missingInBank: number;
    
    securaTotalValue: number;
    bankTotalValue: number;
    totalValueDifference: number;
    totalValueDifferencePercent: number;
    
    overallStatus: 'APPROVED' | 'REVIEW_REQUIRED' | 'FAILED';
  };
  
  // Kassaavstämning
  cashComparison: CashComparison;
  
  // Positionsavstämning
  positions: PositionComparison[];
  
  // Flaggor och varningar
  flags: {
    level: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    details?: string;
  }[];
  
  // Datakällor
  sources: {
    secura: { timestamp: string; dataPoints: number };
    bank: { source: 'SEB' | 'SWEDBANK'; timestamp: string; dataPoints: number };
  };
}

// Default configuration
const DEFAULT_CONFIG: ReconciliationConfig = {
  thresholds: {
    cashDifferencePercent: 0.1,        // 0.1%
    cashDifferenceAbsolute: 10000,     // 10,000 SEK
    positionDifferencePercent: 0.5,    // 0.5%
    priceDifferencePercent: 1.0,       // 1%
    missingPositionValue: 100000,      // 100,000 SEK
  },
  autoApproveWithinThreshold: true,
};

// ============================================================================
// Reconciliation Engine
// ============================================================================

export class ReconciliationEngine {
  private securaClient: SecuraClient;
  private sebClient: SEBClient;
  private config: ReconciliationConfig;

  constructor(config?: Partial<ReconciliationConfig>) {
    this.securaClient = getSecuraClient();
    this.sebClient = getSEBClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Main Reconciliation
  // ==========================================================================

  /**
   * Utför fullständig avstämning mellan Secura och SEB
   */
  async reconcileWithSEB(
    fundId: string,
    sebAccountId: string,
    date?: string
  ): Promise<ReconciliationResult> {
    const reconciliationDate = date || new Date().toISOString().split('T')[0];
    console.log(`[Reconciliation] Starting SEB reconciliation for fund ${fundId} on ${reconciliationDate}`);

    // 1. Hämta data från båda källor parallellt
    const [securaData, sebData, sebBalances] = await Promise.all([
      this.getSecuraData(fundId, reconciliationDate),
      this.sebClient.getCustodyPositions(sebAccountId),
      this.sebClient.getAccountBalances([sebAccountId]),
    ]);

    // 2. Jämför positioner
    const positions = this.comparePositions(
      securaData.holdings,
      sebData,
      'SEB'
    );

    // 3. Jämför kassa
    const cashComparison = this.compareCash(
      securaData.cashBalance,
      sebBalances[0]?.availableBalance || 0,
      securaData.currency
    );

    // 4. Generera sammanfattning
    const summary = this.generateSummary(positions, cashComparison, securaData, sebData);

    // 5. Generera flaggor
    const flags = this.generateFlags(positions, cashComparison, summary);

    return {
      fundId,
      fundName: securaData.fundName,
      reconciliationDate,
      generatedAt: new Date().toISOString(),
      summary,
      cashComparison,
      positions,
      flags,
      sources: {
        secura: {
          timestamp: new Date().toISOString(),
          dataPoints: securaData.holdings.length + 1,
        },
        bank: {
          source: 'SEB',
          timestamp: new Date().toISOString(),
          dataPoints: sebData.length + 1,
        },
      },
    };
  }

  /**
   * Utför avstämning mellan Secura och Swedbank PDF-data
   */
  async reconcileWithSwedbank(
    fundId: string,
    swedbankReport: SwedBankCustodyReport
  ): Promise<ReconciliationResult> {
    const reconciliationDate = swedbankReport.reportDate;
    console.log(`[Reconciliation] Starting Swedbank reconciliation for fund ${fundId} on ${reconciliationDate}`);

    // 1. Hämta Secura-data
    const securaData = await this.getSecuraData(fundId, reconciliationDate);

    // 2. Konvertera Swedbank-data till jämförbart format
    const swedbankPositions: SEBCustodyPosition[] = swedbankReport.positions.map(p => ({
      accountId: swedbankReport.accountNumber,
      isin: p.isin,
      instrumentName: p.instrumentName,
      instrumentType: 'OTHER' as const,
      quantity: p.quantity,
      marketPrice: p.marketPrice,
      marketValue: p.marketValue,
      currency: p.currency,
      priceDate: swedbankReport.reportDate,
      custodian: 'Swedbank',
    }));

    // 3. Jämför positioner
    const positions = this.comparePositions(
      securaData.holdings,
      swedbankPositions,
      'SWEDBANK'
    );

    // 4. Jämför kassa
    const cashComparison = this.compareCash(
      securaData.cashBalance,
      swedbankReport.cashBalance,
      securaData.currency
    );

    // 5. Generera sammanfattning
    const summary = this.generateSummary(positions, cashComparison, securaData, swedbankPositions);

    // 6. Generera flaggor
    const flags = this.generateFlags(positions, cashComparison, summary);

    return {
      fundId,
      fundName: securaData.fundName,
      reconciliationDate,
      generatedAt: new Date().toISOString(),
      summary,
      cashComparison,
      positions,
      flags,
      sources: {
        secura: {
          timestamp: new Date().toISOString(),
          dataPoints: securaData.holdings.length + 1,
        },
        bank: {
          source: 'SWEDBANK',
          timestamp: swedbankReport.extractedAt,
          dataPoints: swedbankReport.positions.length + 1,
        },
      },
    };
  }

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  private async getSecuraData(fundId: string, date: string): Promise<{
    fundName: string;
    holdings: SecuraPosition[];
    cashBalance: number;
    currency: string;
  }> {
    try {
      const [navData, holdings] = await Promise.all([
        this.securaClient.getNAV(fundId, date),
        this.securaClient.getPositions(fundId),
      ]);

      // Fund name mapping (in production, this should come from a fund registry)
      const fundNames: Record<string, string> = {
        'FUND001': 'AUAG Essential Metals',
        'FUND002': 'AuAg Gold Rush',
        'FUND003': 'AuAg Precious Green',
        'FUND004': 'AuAg Silver Bullet',
      };

      return {
        fundName: fundNames[fundId] || `Fund ${fundId}`,
        holdings,
        cashBalance: navData.aum * 0.02, // Approximation - should come from actual cash position
        currency: navData.currency,
      };
    } catch (error) {
      console.error('[Reconciliation] Failed to fetch Secura data:', error);
      throw new Error(`Failed to fetch Secura data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ==========================================================================
  // Comparison Logic
  // ==========================================================================

  private comparePositions(
    securaHoldings: SecuraPosition[],
    bankPositions: SEBCustodyPosition[],
    bankSource: 'SEB' | 'SWEDBANK'
  ): PositionComparison[] {
    const comparisons: PositionComparison[] = [];
    const processedISINs = new Set<string>();

    // 1. Jämför Secura-positioner mot bank
    for (const securaPos of securaHoldings) {
      processedISINs.add(securaPos.isin);
      
      const bankPos = bankPositions.find(b => b.isin === securaPos.isin);
      
      if (bankPos) {
        // Position finns i båda
        const comparison = this.createPositionComparison(
          securaPos,
          bankPos,
          bankSource
        );
        comparisons.push(comparison);
      } else {
        // Saknas i bank
        comparisons.push({
          isin: securaPos.isin,
          instrumentName: securaPos.instrumentName,
          secura: {
            quantity: securaPos.quantity,
            price: securaPos.marketPrice,
            value: securaPos.marketValue,
          },
          bank: null,
          differences: {
            quantityDiff: securaPos.quantity,
            quantityDiffPercent: 100,
            priceDiff: securaPos.marketPrice,
            priceDiffPercent: 100,
            valueDiff: securaPos.marketValue,
            valueDiffPercent: 100,
          },
          status: securaPos.marketValue >= this.config.thresholds.missingPositionValue
            ? 'MAJOR_DIFF'
            : 'MINOR_DIFF',
          flags: [`Position saknas i ${bankSource}`],
        });
      }
    }

    // 2. Hitta positioner som bara finns i bank
    for (const bankPos of bankPositions) {
      if (!processedISINs.has(bankPos.isin)) {
        comparisons.push({
          isin: bankPos.isin,
          instrumentName: bankPos.instrumentName,
          secura: null,
          bank: {
            quantity: bankPos.quantity,
            price: bankPos.marketPrice,
            value: bankPos.marketValue,
            source: bankSource,
          },
          differences: {
            quantityDiff: -bankPos.quantity,
            quantityDiffPercent: -100,
            priceDiff: -bankPos.marketPrice,
            priceDiffPercent: -100,
            valueDiff: -bankPos.marketValue,
            valueDiffPercent: -100,
          },
          status: bankPos.marketValue >= this.config.thresholds.missingPositionValue
            ? 'MAJOR_DIFF'
            : 'MISSING_SECURA',
          flags: ['Position saknas i Secura'],
        });
      }
    }

    return comparisons.sort((a, b) => 
      Math.abs(b.differences.valueDiff) - Math.abs(a.differences.valueDiff)
    );
  }

  private createPositionComparison(
    securaPos: SecuraPosition,
    bankPos: SEBCustodyPosition,
    bankSource: 'SEB' | 'SWEDBANK'
  ): PositionComparison {
    const quantityDiff = securaPos.quantity - bankPos.quantity;
    const quantityDiffPercent = bankPos.quantity !== 0 
      ? (quantityDiff / bankPos.quantity) * 100 
      : 0;
    
    const priceDiff = securaPos.marketPrice - bankPos.marketPrice;
    const priceDiffPercent = bankPos.marketPrice !== 0 
      ? (priceDiff / bankPos.marketPrice) * 100 
      : 0;
    
    const valueDiff = securaPos.marketValue - bankPos.marketValue;
    const valueDiffPercent = bankPos.marketValue !== 0 
      ? (valueDiff / bankPos.marketValue) * 100 
      : 0;

    const flags: string[] = [];
    let status: PositionComparison['status'] = 'MATCH';

    // Kontrollera antal
    if (Math.abs(quantityDiffPercent) > this.config.thresholds.positionDifferencePercent) {
      flags.push(`Antal avviker ${quantityDiffPercent.toFixed(2)}%`);
      status = Math.abs(quantityDiffPercent) > 5 ? 'MAJOR_DIFF' : 'MINOR_DIFF';
    }

    // Kontrollera pris
    if (Math.abs(priceDiffPercent) > this.config.thresholds.priceDifferencePercent) {
      flags.push(`Kurs avviker ${priceDiffPercent.toFixed(2)}%`);
      if (status !== 'MAJOR_DIFF') {
        status = Math.abs(priceDiffPercent) > 5 ? 'MAJOR_DIFF' : 'MINOR_DIFF';
      }
    }

    return {
      isin: securaPos.isin,
      instrumentName: securaPos.instrumentName,
      secura: {
        quantity: securaPos.quantity,
        price: securaPos.marketPrice,
        value: securaPos.marketValue,
      },
      bank: {
        quantity: bankPos.quantity,
        price: bankPos.marketPrice,
        value: bankPos.marketValue,
        source: bankSource,
      },
      differences: {
        quantityDiff,
        quantityDiffPercent,
        priceDiff,
        priceDiffPercent,
        valueDiff,
        valueDiffPercent,
      },
      status,
      flags,
    };
  }

  private compareCash(
    securaBalance: number,
    bankBalance: number,
    currency: string
  ): CashComparison {
    const difference = securaBalance - bankBalance;
    const differencePercent = bankBalance !== 0 
      ? (difference / bankBalance) * 100 
      : 0;

    const flags: string[] = [];
    let status: CashComparison['status'] = 'MATCH';

    if (Math.abs(differencePercent) > this.config.thresholds.cashDifferencePercent ||
        Math.abs(difference) > this.config.thresholds.cashDifferenceAbsolute) {
      flags.push(`Kassadifferens: ${difference.toLocaleString('sv-SE')} ${currency}`);
      status = Math.abs(differencePercent) > 1 ? 'MAJOR_DIFF' : 'MINOR_DIFF';
    }

    return {
      currency,
      securaBalance,
      bankBalance,
      difference,
      differencePercent,
      status,
      flags,
    };
  }

  // ==========================================================================
  // Summary & Flags
  // ==========================================================================

  private generateSummary(
    positions: PositionComparison[],
    cashComparison: CashComparison,
    securaData: { holdings: SecuraPosition[] },
    bankData: SEBCustodyPosition[]
  ): ReconciliationResult['summary'] {
    const matchingPositions = positions.filter(p => p.status === 'MATCH').length;
    const minorDifferences = positions.filter(p => p.status === 'MINOR_DIFF').length;
    const majorDifferences = positions.filter(p => p.status === 'MAJOR_DIFF').length;
    const missingInSecura = positions.filter(p => p.status === 'MISSING_SECURA').length;
    const missingInBank = positions.filter(p => p.bank === null).length;

    const securaTotalValue = securaData.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const bankTotalValue = bankData.reduce((sum, p) => sum + p.marketValue, 0);
    const totalValueDifference = securaTotalValue - bankTotalValue;
    const totalValueDifferencePercent = bankTotalValue !== 0 
      ? (totalValueDifference / bankTotalValue) * 100 
      : 0;

    // Bestäm övergripande status
    let overallStatus: ReconciliationResult['summary']['overallStatus'] = 'APPROVED';
    
    if (majorDifferences > 0 || cashComparison.status === 'MAJOR_DIFF') {
      overallStatus = 'REVIEW_REQUIRED';
    }
    
    if (majorDifferences > positions.length * 0.1 || 
        Math.abs(totalValueDifferencePercent) > 5) {
      overallStatus = 'FAILED';
    }

    return {
      totalPositions: positions.length,
      matchingPositions,
      minorDifferences,
      majorDifferences,
      missingInSecura,
      missingInBank,
      securaTotalValue,
      bankTotalValue,
      totalValueDifference,
      totalValueDifferencePercent,
      overallStatus,
    };
  }

  private generateFlags(
    positions: PositionComparison[],
    cashComparison: CashComparison,
    summary: ReconciliationResult['summary']
  ): ReconciliationResult['flags'] {
    const flags: ReconciliationResult['flags'] = [];

    // Övergripande status
    if (summary.overallStatus === 'APPROVED') {
      flags.push({
        level: 'INFO',
        message: 'Avstämning godkänd',
        details: `${summary.matchingPositions}/${summary.totalPositions} positioner matchar`,
      });
    }

    // Kassaavvikelse
    if (cashComparison.status !== 'MATCH') {
      flags.push({
        level: cashComparison.status === 'MAJOR_DIFF' ? 'ERROR' : 'WARNING',
        message: `Kassadifferens: ${cashComparison.difference.toLocaleString('sv-SE')} ${cashComparison.currency}`,
        details: `Secura: ${cashComparison.securaBalance.toLocaleString('sv-SE')}, Bank: ${cashComparison.bankBalance.toLocaleString('sv-SE')}`,
      });
    }

    // Stora positionsavvikelser
    const majorPositions = positions.filter(p => p.status === 'MAJOR_DIFF');
    if (majorPositions.length > 0) {
      flags.push({
        level: 'ERROR',
        message: `${majorPositions.length} positioner har stora avvikelser`,
        details: majorPositions.map(p => p.instrumentName).join(', '),
      });
    }

    // Saknade positioner
    if (summary.missingInBank > 0) {
      flags.push({
        level: 'WARNING',
        message: `${summary.missingInBank} positioner saknas i bankdata`,
      });
    }

    if (summary.missingInSecura > 0) {
      flags.push({
        level: 'WARNING',
        message: `${summary.missingInSecura} positioner saknas i Secura`,
      });
    }

    // Total värdeavvikelse
    if (Math.abs(summary.totalValueDifferencePercent) > 1) {
      flags.push({
        level: 'ERROR',
        message: `Totalt värde avviker ${summary.totalValueDifferencePercent.toFixed(2)}%`,
        details: `Differens: ${summary.totalValueDifference.toLocaleString('sv-SE')} SEK`,
      });
    }

    return flags;
  }
}

// ============================================================================
// Factory
// ============================================================================

let reconciliationEngineInstance: ReconciliationEngine | null = null;

export function getReconciliationEngine(config?: Partial<ReconciliationConfig>): ReconciliationEngine {
  if (!reconciliationEngineInstance || config) {
    reconciliationEngineInstance = new ReconciliationEngine(config);
  }
  return reconciliationEngineInstance;
}
