/**
 * NAV Automation Service
 * 
 * Automatiserar dagliga NAV-processer:
 * - NAV-rapporter
 * - Notor (gårdagens in/utflöden)
 * - SubReds (dagens/morgondagens in/utflöde)
 * - Prisdata-distribution
 * - Ägardata-uppdatering
 */

import { 
  SecuraClient, 
  getSecuraClient,
  SecuraNAVData,
  SecuraTransaction,
  SecuraHolding,
} from './client';
import { NAVEmailService, getNAVEmailService } from './emailService';
import { 
  generateNotorExcel, 
  generatePriceDataExcel, 
  generateOwnerDataExcel,
  generateSubRedExcel,
  bufferToBlob 
} from './excel-generator';

// ============================================
// TYPER
// ============================================

interface NAVReportConfig {
  fundIds: string[];
  recipients: string[];
  format: 'PDF' | 'EXCEL';
  includeWaterfall?: boolean;
  includeHistorical?: boolean;
}

interface NotorConfig {
  fundIds: string[];
  recipients: string[];
  format: 'PDF' | 'EXCEL';
}

interface SubRedConfig {
  fundIds: string[];
  recipients: string[];
  includeAccountStatement: boolean;
}

interface PriceDataConfig {
  fundIds: string[];
  recipients: string[];
  uploadToWebsite: boolean;
  websiteEndpoint?: string;
}

interface OwnerDataConfig {
  fundIds: string[];
  recipients: string[];
  includeClearstream: boolean;
}

interface AutomationResult {
  success: boolean;
  timestamp: string;
  type: 'NAV_REPORT' | 'NOTOR' | 'SUBRED' | 'PRICE_DATA' | 'OWNER_DATA';
  fundId: string;
  details: {
    reportUrl?: string;
    emailsSent?: number;
    errors?: string[];
  };
}

// ============================================
// NAV AUTOMATION SERVICE
// ============================================

export class NAVAutomationService {
  private securaClient: SecuraClient;
  private emailService: NAVEmailService;

  constructor(securaClient?: SecuraClient) {
    this.securaClient = securaClient || getSecuraClient();
    this.emailService = getNAVEmailService();
  }

  // ============================================
  // NAV-RAPPORTER
  // ============================================

  /**
   * Generera och skicka NAV-rapporter för alla konfigurerade fonder
   */
  async processNAVReports(config: NAVReportConfig): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const fundId of config.fundIds) {
      try {
        // 1. Hämta NAV-data
        const navData = await this.securaClient.getNAV(fundId, today);
        
        // 2. Generera rapport
        const report = await this.securaClient.generateNAVReport(
          fundId,
          today,
          config.format
        );

        // 3. Skicka till mottagare
        await this.emailService.sendNAVReport({
          recipients: config.recipients,
          fundId,
          navData,
          reportUrl: report.downloadUrl,
          date: today,
        });

        results.push({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'NAV_REPORT',
          fundId,
          details: {
            reportUrl: report.downloadUrl,
            emailsSent: config.recipients.length,
          },
        });
      } catch (error) {
        results.push({
          success: false,
          timestamp: new Date().toISOString(),
          type: 'NAV_REPORT',
          fundId,
          details: {
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        });
      }
    }

    return results;
  }

  // ============================================
  // NOTOR (Gårdagens transaktioner)
  // ============================================

  /**
   * Generera och skicka Notor (gårdagens in/utflöden)
   */
  async processNotor(config: NotorConfig): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];

    for (const fundId of config.fundIds) {
      try {
        // 1. Hämta gårdagens transaktioner
        const transactions = await this.securaClient.getYesterdayTransactions(fundId);
        
        // 2. Sammanställ data
        const summary = this.summarizeTransactions(transactions);
        
        // 3. Generera PDF/Excel
        const reportBlob = await this.generateNotorReport(fundId, transactions, config.format);
        
        // 4. Skicka till mottagare
        await this.emailService.sendNotor({
          recipients: config.recipients,
          fundId,
          transactions,
          summary,
          reportBlob,
        });

        results.push({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'NOTOR',
          fundId,
          details: {
            emailsSent: config.recipients.length,
          },
        });
      } catch (error) {
        results.push({
          success: false,
          timestamp: new Date().toISOString(),
          type: 'NOTOR',
          fundId,
          details: {
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        });
      }
    }

    return results;
  }

  // ============================================
  // SUBREDS (Dagens/morgondagens in/utflöde)
  // ============================================

  /**
   * Generera och skicka SubReds med kontoutdrag
   */
  async processSubReds(config: SubRedConfig): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const fundId of config.fundIds) {
      try {
        // 1. Hämta morgondagens transaktioner
        const transactions = await this.securaClient.getTomorrowTransactions(fundId);
        
        // 2. Hämta kontoutdrag om konfigurerat
        let accountStatement = null;
        if (config.includeAccountStatement) {
          accountStatement = await this.securaClient.generateAccountStatement(
            fundId,
            tomorrowStr
          );
        }

        // 3. Sammanställ SubRed-rapport
        const summary = this.summarizeTransactions(transactions);
        
        // 4. Skicka till mottagare
        await this.emailService.sendSubRed({
          recipients: config.recipients,
          fundId,
          transactions,
          summary,
          accountStatementUrl: accountStatement?.downloadUrl,
          date: tomorrowStr,
        });

        results.push({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'SUBRED',
          fundId,
          details: {
            reportUrl: accountStatement?.downloadUrl,
            emailsSent: config.recipients.length,
          },
        });
      } catch (error) {
        results.push({
          success: false,
          timestamp: new Date().toISOString(),
          type: 'SUBRED',
          fundId,
          details: {
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        });
      }
    }

    return results;
  }

  // ============================================
  // PRISDATA
  // ============================================

  /**
   * Extrahera och distribuera prisdata
   */
  async processPriceData(config: PriceDataConfig): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];

    try {
      // 1. Hämta prisdata för alla fonder
      const priceData = await this.securaClient.getAllPriceData();
      
      // Filtrera till konfigurerade fonder
      const filteredData = priceData.filter(p => config.fundIds.includes(p.fundId));

      // 2. Generera Excel-fil
      const excelBlob = await this.generatePriceDataExcel(filteredData);

      // 3. Skicka till mottagare
      await this.emailService.sendPriceData({
        recipients: config.recipients,
        priceData: filteredData,
        excelBlob,
      });

      // 4. Ladda upp till hemsidan om konfigurerat
      if (config.uploadToWebsite && config.websiteEndpoint) {
        await this.uploadPriceDataToWebsite(filteredData, config.websiteEndpoint);
      }

      for (const fundId of config.fundIds) {
        results.push({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'PRICE_DATA',
          fundId,
          details: {
            emailsSent: config.recipients.length,
          },
        });
      }
    } catch (error) {
      for (const fundId of config.fundIds) {
        results.push({
          success: false,
          timestamp: new Date().toISOString(),
          type: 'PRICE_DATA',
          fundId,
          details: {
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        });
      }
    }

    return results;
  }

  // ============================================
  // ÄGARDATA
  // ============================================

  /**
   * Extrahera och distribuera ägardata
   */
  async processOwnerData(config: OwnerDataConfig): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];

    for (const fundId of config.fundIds) {
      try {
        // 1. Hämta ägardata
        let holdings: SecuraHolding[];
        
        if (config.includeClearstream) {
          holdings = await this.securaClient.getClearstreamHoldings(fundId);
        } else {
          holdings = await this.securaClient.getHoldings(fundId);
        }

        // 2. Generera Excel-rapport
        const excelBlob = await this.generateOwnerDataExcel(fundId, holdings);

        // 3. Skicka till mottagare
        await this.emailService.sendOwnerData({
          recipients: config.recipients,
          fundId,
          holdings,
          excelBlob,
        });

        results.push({
          success: true,
          timestamp: new Date().toISOString(),
          type: 'OWNER_DATA',
          fundId,
          details: {
            emailsSent: config.recipients.length,
          },
        });
      } catch (error) {
        results.push({
          success: false,
          timestamp: new Date().toISOString(),
          type: 'OWNER_DATA',
          fundId,
          details: {
            errors: [error instanceof Error ? error.message : 'Unknown error'],
          },
        });
      }
    }

    return results;
  }

  // ============================================
  // DAGLIG AUTOMATION (KÖR ALLT)
  // ============================================

  /**
   * Kör alla dagliga NAV-processer
   * Anropas av scheduler/cron-job
   */
  async runDailyAutomation(config: {
    navReports?: NAVReportConfig;
    notor?: NotorConfig;
    subReds?: SubRedConfig;
    priceData?: PriceDataConfig;
    ownerData?: OwnerDataConfig;
  }): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    results: AutomationResult[];
  }> {
    const allResults: AutomationResult[] = [];

    console.log('[NAVAutomation] Starting daily automation...');
    const startTime = Date.now();

    // 1. NAV-rapporter
    if (config.navReports) {
      console.log('[NAVAutomation] Processing NAV reports...');
      const navResults = await this.processNAVReports(config.navReports);
      allResults.push(...navResults);
    }

    // 2. Notor
    if (config.notor) {
      console.log('[NAVAutomation] Processing Notor...');
      const notorResults = await this.processNotor(config.notor);
      allResults.push(...notorResults);
    }

    // 3. SubReds
    if (config.subReds) {
      console.log('[NAVAutomation] Processing SubReds...');
      const subRedResults = await this.processSubReds(config.subReds);
      allResults.push(...subRedResults);
    }

    // 4. Prisdata
    if (config.priceData) {
      console.log('[NAVAutomation] Processing price data...');
      const priceResults = await this.processPriceData(config.priceData);
      allResults.push(...priceResults);
    }

    // 5. Ägardata
    if (config.ownerData) {
      console.log('[NAVAutomation] Processing owner data...');
      const ownerResults = await this.processOwnerData(config.ownerData);
      allResults.push(...ownerResults);
    }

    const duration = Date.now() - startTime;
    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;

    console.log(`[NAVAutomation] Daily automation completed in ${duration}ms`);
    console.log(`[NAVAutomation] Results: ${successful} successful, ${failed} failed`);

    return {
      totalProcessed: allResults.length,
      successful,
      failed,
      results: allResults,
    };
  }

  // ============================================
  // HJÄLPMETODER
  // ============================================

  private summarizeTransactions(transactions: SecuraTransaction[]): {
    subscriptions: { count: number; totalAmount: number; totalShares: number };
    redemptions: { count: number; totalAmount: number; totalShares: number };
    netFlow: number;
  } {
    const subscriptions = transactions.filter(t => t.type === 'SUBSCRIPTION');
    const redemptions = transactions.filter(t => t.type === 'REDEMPTION');

    const subTotal = subscriptions.reduce((sum, t) => sum + t.amount, 0);
    const redTotal = redemptions.reduce((sum, t) => sum + t.amount, 0);

    return {
      subscriptions: {
        count: subscriptions.length,
        totalAmount: subTotal,
        totalShares: subscriptions.reduce((sum, t) => sum + t.shares, 0),
      },
      redemptions: {
        count: redemptions.length,
        totalAmount: redTotal,
        totalShares: redemptions.reduce((sum, t) => sum + t.shares, 0),
      },
      netFlow: subTotal - redTotal,
    };
  }

  /**
   * Generera Notor-rapport i Excel-format
   */
  private async generateNotorReport(
    fundId: string,
    transactions: SecuraTransaction[],
    format: 'PDF' | 'EXCEL'
  ): Promise<Blob> {
    // Hämta fondnamn (i produktion från Secura)
    const fundName = await this.getFundName(fundId);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // Generera Excel (PDF kan läggas till senare med puppeteer/jspdf)
    const buffer = await generateNotorExcel(fundId, fundName, transactions, dateStr);
    return bufferToBlob(buffer);
  }

  /**
   * Generera prisdata-rapport i Excel-format
   */
  private async generatePriceDataExcel(priceData: Array<{
    fundId: string;
    fundName: string;
    isin: string;
    date: string;
    nav: number;
    aum: number;
    outstandingShares: number;
    currency: string;
  }>): Promise<Blob> {
    const today = new Date().toISOString().split('T')[0];
    const buffer = await generatePriceDataExcel(priceData, today);
    return bufferToBlob(buffer);
  }

  /**
   * Generera ägardata-rapport i Excel-format
   */
  private async generateOwnerDataExcel(
    fundId: string,
    holdings: SecuraHolding[]
  ): Promise<Blob> {
    const fundName = await this.getFundName(fundId);
    const today = new Date().toISOString().split('T')[0];
    const buffer = await generateOwnerDataExcel(fundId, fundName, holdings, today);
    return bufferToBlob(buffer);
  }

  /**
   * Hämta fondnamn från cache eller Secura
   */
  private async getFundName(fundId: string): Promise<string> {
    // I produktion: hämta från Secura eller cache
    // För nu: returnera ett default-namn baserat på ID
    const fundNames: Record<string, string> = {
      'FUND001': 'AUAG Essential Metals',
      'FUND002': 'AuAg Gold Rush',
      'FUND003': 'AuAg Precious Green',
      'FUND004': 'AuAg Silver Bullet',
    };
    return fundNames[fundId] || `Fond ${fundId}`;
  }

  private async uploadPriceDataToWebsite(
    priceData: Array<{
      fundId: string;
      fundName: string;
      isin: string;
      nav: number;
      aum: number;
      outstandingShares: number;
    }>,
    endpoint: string
  ): Promise<void> {
    // TODO: Implementera hemsida-integration
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBSITE_API_KEY}`,
      },
      body: JSON.stringify({ priceData }),
    });

    if (!response.ok) {
      throw new Error(`Failed to upload price data to website: ${response.statusText}`);
    }
  }
}

// Email service is now imported from ./emailService

// ============================================
// EXPORT
// ============================================

export type { NAVReportConfig, NotorConfig, SubRedConfig, PriceDataConfig, OwnerDataConfig, AutomationResult };

// Singleton
let automationServiceInstance: NAVAutomationService | null = null;

export function getNAVAutomationService(): NAVAutomationService {
  if (!automationServiceInstance) {
    automationServiceInstance = new NAVAutomationService();
  }
  return automationServiceInstance;
}
