/**
 * VAT Reporting Service (Momsrapportering)
 * 
 * Hanterar momsberakning och rapportering for svenska bolag.
 * Stodjer manads-, kvartals- och arsrapportering.
 */

import { jobStore, AccountingJob, Classification } from '../jobStore';
import { calculateCompleteVat, detectReverseCharge } from './vatCalculator';

// Svenska momssatser
export const VAT_RATES = {
  STANDARD: 0.25,      // 25% - De flesta varor och tjanster
  REDUCED: 0.12,       // 12% - Mat, restaurang, hotell
  LOW: 0.06,           // 6% - Bocker, tidningar, kultur, kollektivtrafik
  ZERO: 0,             // 0% - Sjukvard, utbildning, export
} as const;

// BAS-konton for moms
export const VAT_ACCOUNTS = {
  OUTPUT_25: '2610',   // Utgaende moms 25%
  OUTPUT_12: '2620',   // Utgaende moms 12%
  OUTPUT_6: '2630',    // Utgaende moms 6%
  INPUT: '2640',       // Ingaende moms
  SETTLEMENT: '2650',  // Redovisningskonto for moms
  EU_PURCHASE: '2645', // Ingaende moms EU-inkop
  EU_SALES: '2615',    // Utgaende moms EU-forsaljning
  REVERSE_OUTPUT: '2614', // Utgaende moms omvand/EU-forvarv
} as const;

// Rapporteringsperioder
export type ReportingPeriod = 'monthly' | 'quarterly' | 'yearly';

export interface VATEntry {
  jobId: string;
  documentDate: string;
  supplier: string;
  description: string;
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  vatAccount: string;
  isInputVAT: boolean;
}

export interface VATSummary {
  period: {
    start: string;
    end: string;
    type: ReportingPeriod;
  };
  
  outputVAT: {
    rate25: { net: number; vat: number; count: number };
    rate12: { net: number; vat: number; count: number };
    rate6: { net: number; vat: number; count: number };
    total: number;
  };
  
  inputVAT: {
    domestic: { net: number; vat: number; count: number };
    eu: { net: number; vat: number; count: number };
    total: number;
  };
  
  netVAT: number;
  entries: VATEntry[];
  generatedAt: string;
  companyId: string;
}

export interface SKVExportData {
  period: string;
  organisationNumber: string;
  box05_sales_25: number;
  box06_sales_12: number;
  box07_sales_6: number;
  box08_self_supply: number;
  box10_vat_25: number;
  box11_vat_12: number;
  box12_vat_6: number;
  box20_eu_purchase_goods: number;
  box21_eu_purchase_services: number;
  box22_import: number;
  box23_eu_sales_goods: number;
  box24_eu_sales_services: number;
  box48_input_vat: number;
  box49_total_deduct: number;
  box50_net_vat: number;
}

class VATReportingService {
  
  async generateReport(
    companyId: string,
    startDate: string,
    endDate: string,
    periodType: ReportingPeriod = 'monthly'
  ): Promise<VATSummary> {
    
    const allJobs = await jobStore.getByCompany(companyId);
    const approvedJobs = allJobs.filter(job => 
      job.status === 'approved' || job.status === 'sent'
    );
    
    const periodJobs = approvedJobs.filter(job => {
      const docDate = job.classification?.invoiceDate || job.createdAt;
      return docDate >= startDate && docDate <= endDate;
    });
    
    const entries = this.extractVATEntries(periodJobs);
    const summary = this.calculateSummary(entries, companyId, startDate, endDate, periodType);
    
    return summary;
  }
  
  private extractVATEntries(jobs: AccountingJob[]): VATEntry[] {
    const entries: VATEntry[] = [];
    
    for (const job of jobs) {
      if (!job.classification) continue;
      
      const classification = job.classification;
      const docDate = classification.invoiceDate || job.createdAt.split('T')[0];

      const vatInfos = this.detectVATEntriesFromDocument(classification);
      for (const vatInfo of vatInfos) {
        if (vatInfo.vatAmount <= 0) continue;
        entries.push({
          jobId: job.id,
          documentDate: docDate,
          supplier: classification.supplier || 'Unknown',
          description: classification.docType || 'Document',
          netAmount: vatInfo.netAmount,
          vatAmount: vatInfo.vatAmount,
          vatRate: vatInfo.vatRate,
          vatAccount: vatInfo.vatAccount,
          isInputVAT: vatInfo.isInputVAT,
        });
      }
    }
    
    return entries;
  }
  
  private detectVATEntriesFromDocument(classification: Classification): Array<{
    netAmount: number;
    vatAmount: number;
    vatRate: number;
    vatAccount: string;
    isInputVAT: boolean;
  }> {
    const totalAmount = classification.totalAmount || 0;
    const supplierCountry = classification.supplierCountry;

    // If we have explicit VAT amount, treat total as gross.
    const isGross = (classification.vatAmount || 0) > 0;
    const description = `${classification.supplier || ''} ${classification.invoiceNumber || ''}`.trim();

    const reverse = detectReverseCharge(description, classification.supplier, supplierCountry);
    const vatCalc = calculateCompleteVat(
      totalAmount,
      isGross,
      description,
      classification.supplier,
      supplierCountry
    );

    // Reverse charge / EU acquisition: report both input and output VAT legs
    if (reverse.isReverseCharge || vatCalc.isReverseCharge) {
      const net = vatCalc.netAmount;
      const reverseVat = Math.round(net * VAT_RATES.STANDARD * 100) / 100;
      return [
        {
          netAmount: net,
          vatAmount: reverseVat,
          vatRate: VAT_RATES.STANDARD,
          vatAccount: VAT_ACCOUNTS.EU_PURCHASE,
          isInputVAT: true,
        },
        {
          netAmount: net,
          vatAmount: reverseVat,
          vatRate: VAT_RATES.STANDARD,
          vatAccount: VAT_ACCOUNTS.REVERSE_OUTPUT,
          isInputVAT: false,
        },
      ];
    }

    // Normal domestic purchase
    const vatAmount = classification.vatAmount || vatCalc.vatAmount || 0;
    const netAmount = vatCalc.netAmount || (vatAmount > 0 ? (totalAmount - vatAmount) : totalAmount);

    // If no VAT, skip
    if (vatAmount <= 0) return [];

    return [{
      netAmount: Math.round(netAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      vatRate: vatCalc.vatRate,
      vatAccount: VAT_ACCOUNTS.INPUT,
      isInputVAT: true,
    }];
  }
  
  private calculateSummary(
    entries: VATEntry[],
    companyId: string,
    startDate: string,
    endDate: string,
    periodType: ReportingPeriod
  ): VATSummary {
    
    const outputVAT = {
      rate25: { net: 0, vat: 0, count: 0 },
      rate12: { net: 0, vat: 0, count: 0 },
      rate6: { net: 0, vat: 0, count: 0 },
      total: 0,
    };
    
    const inputVAT = {
      domestic: { net: 0, vat: 0, count: 0 },
      eu: { net: 0, vat: 0, count: 0 },
      total: 0,
    };
    
    for (const entry of entries) {
      if (entry.isInputVAT) {
        if (entry.vatAccount === VAT_ACCOUNTS.EU_PURCHASE) {
          inputVAT.eu.net += entry.netAmount;
          inputVAT.eu.vat += entry.vatAmount;
          inputVAT.eu.count++;
        } else {
          inputVAT.domestic.net += entry.netAmount;
          inputVAT.domestic.vat += entry.vatAmount;
          inputVAT.domestic.count++;
        }
        inputVAT.total += entry.vatAmount;
      } else {
        if (entry.vatRate === VAT_RATES.STANDARD) {
          outputVAT.rate25.net += entry.netAmount;
          outputVAT.rate25.vat += entry.vatAmount;
          outputVAT.rate25.count++;
        } else if (entry.vatRate === VAT_RATES.REDUCED) {
          outputVAT.rate12.net += entry.netAmount;
          outputVAT.rate12.vat += entry.vatAmount;
          outputVAT.rate12.count++;
        } else if (entry.vatRate === VAT_RATES.LOW) {
          outputVAT.rate6.net += entry.netAmount;
          outputVAT.rate6.vat += entry.vatAmount;
          outputVAT.rate6.count++;
        }
        outputVAT.total += entry.vatAmount;
      }
    }
    
    const netVAT = outputVAT.total - inputVAT.total;
    
    return {
      period: { start: startDate, end: endDate, type: periodType },
      outputVAT,
      inputVAT,
      netVAT: Math.round(netVAT * 100) / 100,
      entries,
      generatedAt: new Date().toISOString(),
      companyId,
    };
  }
  
  async generateSKVExport(
    companyId: string,
    startDate: string,
    endDate: string,
    organisationNumber: string
  ): Promise<SKVExportData> {
    
    const summary = await this.generateReport(companyId, startDate, endDate);
    
    const periodStart = new Date(startDate);
    const year = periodStart.getFullYear();
    const month = periodStart.getMonth() + 1;
    const period = `${year}${month.toString().padStart(2, '0')}`;
    
    return {
      period,
      organisationNumber,
      box05_sales_25: Math.round(summary.outputVAT.rate25.net),
      box06_sales_12: Math.round(summary.outputVAT.rate12.net),
      box07_sales_6: Math.round(summary.outputVAT.rate6.net),
      box08_self_supply: 0,
      box10_vat_25: Math.round(summary.outputVAT.rate25.vat),
      box11_vat_12: Math.round(summary.outputVAT.rate12.vat),
      box12_vat_6: Math.round(summary.outputVAT.rate6.vat),
      box20_eu_purchase_goods: Math.round(summary.inputVAT.eu.net),
      box21_eu_purchase_services: 0,
      box22_import: 0,
      box23_eu_sales_goods: 0,
      box24_eu_sales_services: 0,
      box48_input_vat: Math.round(summary.inputVAT.total),
      box49_total_deduct: Math.round(summary.inputVAT.total),
      box50_net_vat: Math.round(summary.netVAT),
    };
  }
  
  generateXML(data: SKVExportData): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Momsdeklaration xmlns="http://xmls.skatteverket.se/moms">
  <Period>${data.period}</Period>
  <Organisationsnummer>${data.organisationNumber}</Organisationsnummer>
  <ForsaljningMomsplikt25>${data.box05_sales_25}</ForsaljningMomsplikt25>
  <ForsaljningMomsplikt12>${data.box06_sales_12}</ForsaljningMomsplikt12>
  <ForsaljningMomsplikt6>${data.box07_sales_6}</ForsaljningMomsplikt6>
  <UtgaendeMoms25>${data.box10_vat_25}</UtgaendeMoms25>
  <UtgaendeMoms12>${data.box11_vat_12}</UtgaendeMoms12>
  <UtgaendeMoms6>${data.box12_vat_6}</UtgaendeMoms6>
  <IngaendeMoms>${data.box48_input_vat}</IngaendeMoms>
  <MomsAttBetala>${data.box50_net_vat}</MomsAttBetala>
</Momsdeklaration>`;
  }
  
  async getHistoricalReports(
    companyId: string,
    numberOfPeriods: number = 6,
    periodType: ReportingPeriod = 'monthly'
  ): Promise<VATSummary[]> {
    const reports: VATSummary[] = [];
    const now = new Date();
    
    for (let i = 0; i < numberOfPeriods; i++) {
      let startDate: Date;
      let endDate: Date;
      
      if (periodType === 'monthly') {
        const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
        startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
        endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
      } else if (periodType === 'quarterly') {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const targetQuarter = currentQuarter - i;
        const year = now.getFullYear() + Math.floor(targetQuarter / 4);
        const quarter = ((targetQuarter % 4) + 4) % 4;
        startDate = new Date(year, quarter * 3, 1);
        endDate = new Date(year, quarter * 3 + 3, 0);
      } else {
        startDate = new Date(now.getFullYear() - i, 0, 1);
        endDate = new Date(now.getFullYear() - i, 11, 31);
      }
      
      const report = await this.generateReport(
        companyId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        periodType
      );
      
      reports.push(report);
    }
    
    return reports;
  }
}

export const vatReporting = new VATReportingService();

