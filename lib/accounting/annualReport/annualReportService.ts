/**
 * Annual Report Service
 * 
 * Generates annual report data from accounting jobs and VAT reporting.
 */

import { jobStore } from '../jobStore';
import { vatReporting } from '../services/vatReporting';
import { closingService } from '../closing/closingService';

export interface FinancialSummary {
  income: number;
  expenses: number;
  result: number;
  vatPayable: number;
  vatRefund: number;
}

export interface ReportSection {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'not_started';
  lastEdited?: string;
  aiGenerated?: boolean;
  content?: string;
  data?: Record<string, number | string>;
}

export interface AnnualReportData {
  year: number;
  companyId: string;
  companyName: string;
  orgNumber?: string;
  sections: ReportSection[];
  financialSummary: FinancialSummary;
  periods: {
    month: number;
    income: number;
    expenses: number;
    result: number;
  }[];
  generatedAt: string;
  status: 'draft' | 'review' | 'approved' | 'submitted';
}

class AnnualReportService {
  /**
   * Generate annual report data for a company
   */
  async generateReportData(
    companyId: string,
    companyName: string,
    year: number,
    orgNumber?: string
  ): Promise<AnnualReportData> {
    // Get all period data for the year
    const periods = await closingService.getYearPeriods(companyId, year);
    
    // Calculate totals
    const totalIncome = periods.reduce((sum, p) => sum + p.income, 0);
    const totalExpenses = periods.reduce((sum, p) => sum + p.expenses, 0);
    const totalResult = totalIncome - totalExpenses;

    // Get VAT summary for the year
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const vatReport = await vatReporting.generateReport(companyId, startDate, endDate, 'yearly');

    // Generate sections
    const sections = await this.generateSections(
      companyId,
      companyName,
      year,
      totalIncome,
      totalExpenses,
      totalResult,
      vatReport.netVAT
    );

    return {
      year,
      companyId,
      companyName,
      orgNumber,
      sections,
      financialSummary: {
        income: totalIncome,
        expenses: totalExpenses,
        result: totalResult,
        vatPayable: vatReport.netVAT > 0 ? vatReport.netVAT : 0,
        vatRefund: vatReport.netVAT < 0 ? Math.abs(vatReport.netVAT) : 0,
      },
      periods: periods.map(p => ({
        month: p.month,
        income: p.income,
        expenses: p.expenses,
        result: p.result,
      })),
      generatedAt: new Date().toISOString(),
      status: 'draft',
    };
  }

  /**
   * Generate report sections
   */
  private async generateSections(
    companyId: string,
    companyName: string,
    year: number,
    income: number,
    expenses: number,
    result: number,
    netVAT: number
  ): Promise<ReportSection[]> {
    const sections: ReportSection[] = [
      {
        id: 'management-report',
        title: 'Förvaltningsberättelse',
        description: 'Beskrivning av verksamheten och väsentliga händelser',
        status: income > 0 || expenses > 0 ? 'completed' : 'not_started',
        lastEdited: new Date().toISOString().split('T')[0],
        aiGenerated: true,
        content: this.generateManagementReport(companyName, year, income, expenses, result),
      },
      {
        id: 'income-statement',
        title: 'Resultaträkning',
        description: 'Intäkter, kostnader och årets resultat',
        status: income > 0 || expenses > 0 ? 'completed' : 'pending',
        lastEdited: new Date().toISOString().split('T')[0],
        content: this.generateIncomeStatement(year, income, expenses, result),
        data: {
          income,
          expenses,
          result,
        },
      },
      {
        id: 'balance-sheet',
        title: 'Balansräkning',
        description: 'Tillgångar, skulder och eget kapital',
        status: 'pending',
        content: 'Balansräkning genereras från Fortnox...',
      },
      {
        id: 'cash-flow',
        title: 'Kassaflödesanalys',
        description: 'In- och utbetalningar under året',
        status: 'pending',
        content: 'Kassaflödesanalys genereras från bokföringsdata...',
      },
      {
        id: 'notes',
        title: 'Noter',
        description: 'Tilläggsupplysningar till årsredovisningen',
        status: 'not_started',
        content: '',
      },
      {
        id: 'signatures',
        title: 'Underskrifter',
        description: 'Styrelsens och VD:s underskrifter',
        status: 'not_started',
        content: '',
      },
    ];

    return sections;
  }

  /**
   * Generate management report text
   */
  private generateManagementReport(
    companyName: string,
    year: number,
    income: number,
    expenses: number,
    result: number
  ): string {
    const formatCurrency = (amount: number) => 
      new Intl.NumberFormat('sv-SE', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);

    return `**Verksamheten**

${companyName} bedriver verksamhet inom fondadministration och förvaltning.

**Väsentliga händelser under räkenskapsåret ${year}**

• Bolagets totala intäkter uppgick till ${formatCurrency(income)} SEK
• De totala kostnaderna uppgick till ${formatCurrency(expenses)} SEK
• Årets resultat blev ${formatCurrency(result)} SEK

**Resultat och ställning**

${result >= 0 
  ? `Bolaget redovisar ett positivt resultat för räkenskapsåret.`
  : `Bolaget redovisar ett negativt resultat för räkenskapsåret.`
}

**Framtidsutsikter**

Styrelsen bedömer att förutsättningarna för fortsatt verksamhet är goda.`;
  }

  /**
   * Generate income statement
   */
  private generateIncomeStatement(
    year: number,
    income: number,
    expenses: number,
    result: number
  ): string {
    const formatCurrency = (amount: number) => 
      new Intl.NumberFormat('sv-SE', { style: 'decimal', minimumFractionDigits: 0 }).format(amount);

    return `**Resultaträkning ${year}**

Rörelseintäkter
  Nettoomsättning: ${formatCurrency(income)} SEK
  
Rörelsekostnader
  Övriga externa kostnader: -${formatCurrency(expenses)} SEK
  
Rörelseresultat: ${formatCurrency(result)} SEK

Resultat före skatt: ${formatCurrency(result)} SEK`;
  }

  /**
   * Get jobs statistics for the year
   */
  async getJobsStatistics(companyId: string, year: number) {
    const jobs = await jobStore.getByCompany(companyId);
    
    const yearJobs = jobs.filter(job => {
      const jobYear = new Date(job.createdAt).getFullYear();
      return jobYear === year;
    });

    return {
      totalJobs: yearJobs.length,
      approvedJobs: yearJobs.filter(j => j.status === 'approved' || j.status === 'sent').length,
      pendingJobs: yearJobs.filter(j => j.status === 'ready').length,
      errorJobs: yearJobs.filter(j => j.status === 'error').length,
    };
  }
}

export const annualReportService = new AnnualReportService();


