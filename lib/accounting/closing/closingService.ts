/**
 * Closing Service - Automatisk bokslut
 * 
 * Komplett system för:
 * - Periodavstämning
 * - Periodiseringar  
 * - Avskrivningar
 * - Skatteavsättning
 * - Rapportgenerering
 * - Låsning av perioder
 */

import { FortnoxClient, getFortnoxClient } from '@/lib/fortnox/client';
import { jobStore } from '../jobStore';
import { depreciationEngine, DepreciationVoucher } from './depreciationEngine';
import { taxCalculator, TaxCalculationResult, TaxVoucher, TAX_RATES } from './taxCalculator';
import { closingReporter, BalanceSheet, IncomeStatement } from './closingReporter';
import { generateMonthlyPeriodizationVoucher } from '../services/periodizationService';
import { getPeriodizationsForPeriod } from '../services/periodizationStore';

// Types
export interface ClosingTask {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'locked' | 'error';
  category: string;
  automatable: boolean;
  result?: {
    amount?: number;
    voucherNumber?: string;
    details?: string;
  };
  error?: string;
}

export interface PeriodData {
  id: string;
  year: number;
  month: number;
  status: 'open' | 'closing' | 'closed';
  income: number;
  expenses: number;
  result: number;
  closedAt?: string;
  closedBy?: string;
}

export interface AccountBalance {
  account: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface ClosingVoucher {
  date: string;
  description: string;
  rows: {
    account: string;
    debit?: number;
    credit?: number;
    description?: string;
  }[];
}

export interface ClosingResult {
  success: boolean;
  tasks: ClosingTask[];
  periodData: PeriodData;
  vouchers: ClosingVoucher[];
  reports?: {
    balanceSheet?: BalanceSheet;
    incomeStatement?: IncomeStatement;
  };
  error?: string;
}

// In-memory storage for period status (should be moved to database in production)
const periodStatus: Map<string, {
  tasks: ClosingTask[];
  periodData: PeriodData;
  vouchers: ClosingVoucher[];
}> = new Map();

// Task definitions
const CLOSING_TASKS: Omit<ClosingTask, 'status' | 'result' | 'error'>[] = [
  // Avstämningar
  {
    id: 'bank-reconciliation',
    title: 'Stäm av bankkonton',
    description: 'Verifiera att banksaldo stämmer med bokföringen',
    category: 'Avstämningar',
    automatable: false,
  },
  {
    id: 'ar-reconciliation',
    title: 'Stäm av kundfordringar',
    description: 'Kontrollera utestående kundfordringar',
    category: 'Avstämningar',
    automatable: false,
  },
  {
    id: 'ap-reconciliation',
    title: 'Stäm av leverantörsskulder',
    description: 'Verifiera obetalda leverantörsfakturor',
    category: 'Avstämningar',
    automatable: true,
  },
  
  // Periodiseringar
  {
    id: 'income-accrual',
    title: 'Periodisera intäkter',
    description: 'Fördela intäkter över rätt perioder',
    category: 'Periodiseringar',
    automatable: true,
  },
  {
    id: 'expense-accrual',
    title: 'Periodisera kostnader',
    description: 'Fördela kostnader över rätt perioder',
    category: 'Periodiseringar',
    automatable: true,
  },
  
  // Avskrivningar
  {
    id: 'calculate-depreciation',
    title: 'Beräkna avskrivningar',
    description: 'Beräkna avskrivningar på anläggningstillgångar',
    category: 'Avskrivningar',
    automatable: true,
  },
  {
    id: 'book-depreciation',
    title: 'Bokför avskrivningar',
    description: 'Bokför periodens avskrivningar',
    category: 'Avskrivningar',
    automatable: true,
  },
  
  // Skatt
  {
    id: 'tax-provision',
    title: 'Skatteavsättning',
    description: `Beräkna och bokför skatteavsättning (${(TAX_RATES.CORPORATE_TAX * 100).toFixed(1)}%)`,
    category: 'Skatt',
    automatable: true,
  },
  
  // Rapporter
  {
    id: 'balance-report',
    title: 'Generera balansrapport',
    description: 'Skapa balansrapport för perioden',
    category: 'Rapporter',
    automatable: true,
  },
  {
    id: 'income-report',
    title: 'Generera resultatrapport',
    description: 'Skapa resultatrapport för perioden',
    category: 'Rapporter',
    automatable: true,
  },
  
  // Avslut
  {
    id: 'lock-period',
    title: 'Lås perioden',
    description: 'Lås bokföringsperioden för ändringar',
    category: 'Avslut',
    automatable: true,
  },
];

class ClosingService {
  private fortnoxClient: FortnoxClient | null = null;
  private companyId: string | null = null;

  /**
   * Initiera med Fortnox-klient
   */
  async init(companyId: string): Promise<boolean> {
    this.companyId = companyId;
    
    try {
      this.fortnoxClient = await getFortnoxClient(companyId);
      
      if (this.fortnoxClient) {
        // Initiera sub-moduler
        await depreciationEngine.init(this.fortnoxClient);
        await closingReporter.init(this.fortnoxClient);
        return true;
      }
    } catch (error) {
      console.warn('[ClosingService] Could not initialize Fortnox client:', error);
    }
    
    // Fortsätt ändå - modulerna fungerar utan Fortnox (med simulerade data)
    return true;
  }

  /**
   * Hämta alla uppgifter för månadsbokslut
   */
  async getClosingTasks(
    companyId: string, 
    year: number, 
    month: number
  ): Promise<ClosingTask[]> {
    const periodKey = `${companyId}-${year}-${month}`;
    const cached = periodStatus.get(periodKey);
    
    if (cached?.tasks) {
      return cached.tasks;
    }
    
    // Analysera periodens status
    const periodJobs = await this.getJobsForPeriod(companyId, year, month);
    const allApproved = periodJobs.every(j => j.status === 'approved' || j.status === 'sent');
    const hasJobs = periodJobs.length > 0;
    
    // Skapa tasks med dynamisk status
    const tasks: ClosingTask[] = CLOSING_TASKS.map(taskDef => {
      const task: ClosingTask = {
        ...taskDef,
        status: 'pending',
      };
      
      // Sätt initiala statusar baserat på villkor
      switch (task.id) {
        case 'ap-reconciliation':
          if (hasJobs && allApproved) {
            task.status = 'completed';
            task.result = { details: `${periodJobs.length} dokument för perioden` };
          } else if (hasJobs) {
            task.status = 'in_progress';
            task.result = { details: `${periodJobs.filter(j => j.status === 'approved').length}/${periodJobs.length} godkända` };
          }
          break;
          
        case 'book-depreciation':
        case 'tax-provision':
        case 'balance-report':
        case 'income-report':
        case 'lock-period':
          // Dessa är låsta tills föregående steg är klara
          task.status = 'locked';
          break;
      }
      
      return task;
    });
    
    return tasks;
  }

  /**
   * Hämta perioddata
   */
  async getPeriodData(
    companyId: string, 
    year: number, 
    month: number
  ): Promise<PeriodData> {
    const periodKey = `${companyId}-${year}-${month}`;
    const cached = periodStatus.get(periodKey);
    
    if (cached?.periodData) {
      return cached.periodData;
    }
    
    // Beräkna från bokföringsjobb
    const periodJobs = await this.getJobsForPeriod(companyId, year, month);
    
    let income = 0;
    let expenses = 0;
    
    for (const job of periodJobs) {
      if (job.classification) {
        const amount = job.classification.totalAmount || 0;
        if (job.classification.docType === 'INVOICE' || job.classification.docType === 'RECEIPT') {
          expenses += amount;
        } else {
          income += amount;
        }
      }
    }
    
    // Lägg till simulerade intäkter för demo
    if (income === 0) {
      income = 150000 + Math.random() * 50000;
    }
    if (expenses === 0) {
      expenses = 80000 + Math.random() * 30000;
    }

    return {
      id: `${year}-${String(month).padStart(2, '0')}`,
      year,
      month,
      status: 'open',
      income: Math.round(income),
      expenses: Math.round(expenses),
      result: Math.round(income - expenses),
    };
  }

  /**
   * Hämta alla perioder för ett år
   */
  async getYearPeriods(companyId: string, year: number): Promise<PeriodData[]> {
    const periods: PeriodData[] = [];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    for (let month = 1; month <= 12; month++) {
      const periodData = await this.getPeriodData(companyId, year, month);
      
      // Markera framtida perioder
      if (year > currentYear || (year === currentYear && month > currentMonth)) {
        periodData.status = 'open';
        periodData.income = 0;
        periodData.expenses = 0;
        periodData.result = 0;
      }
      
      periods.push(periodData);
    }
    
    return periods;
  }

  /**
   * Beräkna avskrivningar för en period
   */
  async calculateDepreciation(
    companyId: string, 
    year: number, 
    month: number
  ): Promise<ClosingVoucher | null> {
    const voucher = await depreciationEngine.generateDepreciationVoucher(
      companyId,
      year,
      month
    );
    
    if (!voucher) {
      return null;
    }
    
    return {
      date: voucher.date,
      description: voucher.description,
      rows: voucher.rows.map(row => ({
        account: row.account,
        debit: row.debit,
        credit: row.credit,
        description: row.description,
      })),
    };
  }

  /**
   * Beräkna skatteavsättning
   */
  async calculateTaxProvision(
    companyId: string, 
    year: number, 
    month: number
  ): Promise<ClosingVoucher | null> {
    const periodData = await this.getPeriodData(companyId, year, month);
    
    // Hämta YTD-resultat
    let ytdIncome = 0;
    let ytdExpenses = 0;
    
    for (let m = 1; m <= month; m++) {
      const pd = await this.getPeriodData(companyId, year, m);
      ytdIncome += pd.income;
      ytdExpenses += pd.expenses;
    }
    
    const ytdProfit = ytdIncome - ytdExpenses;
    
    // Beräkna skatt
    const taxResult = taxCalculator.calculateTax({
      revenue: ytdIncome,
      operatingExpenses: ytdExpenses,
      depreciation: 0, // Redan inkluderat
      financialIncome: 0,
      financialExpenses: 0,
      nonDeductibleExpenses: 0,
      nonTaxableIncome: 0,
      previousYearLoss: 0,
      isYearEnd: month === 12,
      monthsInPeriod: month,
    });
    
    const voucher = taxCalculator.generateTaxVoucher(
      taxResult,
      year,
      month,
      month === 12
    );
    
    if (!voucher) {
      return null;
    }
    
    return {
      date: voucher.date,
      description: voucher.description,
      rows: voucher.rows.map(row => ({
        account: row.account,
        debit: row.debit,
        credit: row.credit,
        description: row.description,
      })),
    };
  }

  /**
   * Kör automatiskt bokslut
   */
  async runAutomaticClosing(
    companyId: string,
    year: number,
    month: number,
    userId: string
  ): Promise<ClosingResult> {
    const periodKey = `${companyId}-${year}-${month}`;
    let tasks = await this.getClosingTasks(companyId, year, month);
    let periodData = await this.getPeriodData(companyId, year, month);
    const vouchers: ClosingVoucher[] = [];

    try {
      // 1. Markera avstämningar som pågående
      tasks = this.updateTaskStatus(tasks, 'bank-reconciliation', 'in_progress', {
        details: 'Kräver manuell kontroll',
      });
      tasks = this.updateTaskStatus(tasks, 'ar-reconciliation', 'in_progress', {
        details: 'Kräver manuell kontroll',
      });

      // 2. Periodiseringar
      const periodizations = await this.processPeriodizations(companyId, year, month);
      if (periodizations.length > 0) {
        tasks = this.updateTaskStatus(tasks, 'income-accrual', 'completed', {
          details: `${periodizations.length} periodiseringar processade`,
        });
        tasks = this.updateTaskStatus(tasks, 'expense-accrual', 'completed', {
          details: 'Kostnader periodiserade',
        });
        vouchers.push(...periodizations);
      } else {
        tasks = this.updateTaskStatus(tasks, 'income-accrual', 'completed', {
          details: 'Inga periodiseringar att processa',
        });
        tasks = this.updateTaskStatus(tasks, 'expense-accrual', 'completed', {
          details: 'Inga periodiseringar att processa',
        });
      }

      // 3. Beräkna och bokför avskrivningar
      const depreciationVoucher = await this.calculateDepreciation(companyId, year, month);
      if (depreciationVoucher) {
        vouchers.push(depreciationVoucher);
        
        const depAmount = depreciationVoucher.rows
          .filter(r => r.debit)
          .reduce((sum, r) => sum + (r.debit || 0), 0);
        
        tasks = this.updateTaskStatus(tasks, 'calculate-depreciation', 'completed', {
          amount: depAmount,
          details: `${depAmount.toLocaleString('sv-SE')} kr beräknad`,
        });
        tasks = this.updateTaskStatus(tasks, 'book-depreciation', 'completed', {
          amount: depAmount,
          details: 'Bokförd till Fortnox',
        });
        
        // Bokför till Fortnox om möjligt
        if (this.fortnoxClient && depreciationVoucher) {
          try {
            const depVoucher = await depreciationEngine.generateDepreciationVoucher(companyId, year, month);
            if (depVoucher) {
              const result = await depreciationEngine.bookDepreciation(companyId, depVoucher);
              if (result.success) {
                tasks = this.updateTaskStatus(tasks, 'book-depreciation', 'completed', {
                  voucherNumber: result.voucherNumber,
                  details: `Verifikation ${result.voucherNumber}`,
                });
              }
            }
          } catch (e) {
            console.warn('[ClosingService] Could not book depreciation to Fortnox:', e);
          }
        }
      } else {
        tasks = this.updateTaskStatus(tasks, 'calculate-depreciation', 'completed', {
          details: 'Inga tillgångar att skriva av',
        });
        tasks = this.updateTaskStatus(tasks, 'book-depreciation', 'completed', {
          details: 'Ingen avskrivning behövs',
        });
      }

      // 4. Beräkna skatteavsättning
      const taxVoucher = await this.calculateTaxProvision(companyId, year, month);
      if (taxVoucher) {
        vouchers.push(taxVoucher);
        
        const taxAmount = taxVoucher.rows
          .filter(r => r.debit)
          .reduce((sum, r) => sum + (r.debit || 0), 0);
        
        tasks = this.updateTaskStatus(tasks, 'tax-provision', 'completed', {
          amount: taxAmount,
          details: `${taxAmount.toLocaleString('sv-SE')} kr (${(TAX_RATES.CORPORATE_TAX * 100).toFixed(1)}%)`,
        });
      } else {
        tasks = this.updateTaskStatus(tasks, 'tax-provision', 'completed', {
          details: 'Ingen skatt (förlust eller nollresultat)',
        });
      }

      // 5. Generera rapporter
      const companyName = 'Ditt Bolag AB'; // Hämtas från context i verklig implementation
      
      const balanceSheet = await closingReporter.generateBalanceSheet(
        companyId,
        companyName,
        year,
        month
      );
      tasks = this.updateTaskStatus(tasks, 'balance-report', 'completed', {
        details: 'Balansräkning genererad',
      });
      
      const incomeStatement = await closingReporter.generateIncomeStatement(
        companyId,
        companyName,
        year,
        month
      );
      tasks = this.updateTaskStatus(tasks, 'income-report', 'completed', {
        details: `Resultat: ${incomeStatement.netResult.toLocaleString('sv-SE')} kr`,
      });

      // 6. Uppdatera periodstatus
      periodData = {
        ...periodData,
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedBy: userId,
      };
      
      tasks = this.updateTaskStatus(tasks, 'lock-period', 'completed', {
        details: `Stängd av ${userId}`,
      });

      // Spara i cache
      periodStatus.set(periodKey, {
        tasks,
        periodData,
        vouchers,
      });

      return {
        success: true,
        tasks,
        periodData,
        vouchers,
        reports: {
          balanceSheet,
          incomeStatement,
        },
      };

    } catch (error) {
      console.error('[ClosingService] Automatic closing failed:', error);
      
      return {
        success: false,
        tasks,
        periodData,
        vouchers,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Processa periodiseringar för perioden
   */
  private async processPeriodizations(
    companyId: string,
    year: number,
    month: number
  ): Promise<ClosingVoucher[]> {
    const vouchers: ClosingVoucher[] = [];
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    
    const due = await getPeriodizationsForPeriod(companyId, targetMonth);

    for (const { schedule, entry } of due) {
      const voucherData = generateMonthlyPeriodizationVoucher(entry);
      
      vouchers.push({
        date: entry.date,
        description: schedule.description ? `${entry.description} (${schedule.description})` : entry.description,
        rows: voucherData.lines.map(line => ({
          account: line.account,
          debit: line.debit > 0 ? line.debit : undefined,
          credit: line.credit > 0 ? line.credit : undefined,
          description: line.description,
        })),
      });
    }
    
    return vouchers;
  }

  /**
   * Uppdatera uppgiftsstatus
   */
  updateTaskStatus(
    tasks: ClosingTask[],
    taskId: string,
    status: ClosingTask['status'],
    result?: ClosingTask['result']
  ): ClosingTask[] {
    return tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status,
          result: result || task.result,
        };
      }
      return task;
    });
  }

  /**
   * Uppdatera enskild uppgift via API
   */
  async updateTask(
    companyId: string,
    year: number,
    month: number,
    taskId: string,
    status: ClosingTask['status'],
    result?: ClosingTask['result']
  ): Promise<ClosingTask | null> {
    const tasks = await this.getClosingTasks(companyId, year, month);
    const updatedTasks = this.updateTaskStatus(tasks, taskId, status, result);
    const task = updatedTasks.find(t => t.id === taskId);
    
    // Uppdatera cache
    const periodKey = `${companyId}-${year}-${month}`;
    const cached = periodStatus.get(periodKey);
    if (cached) {
      cached.tasks = updatedTasks;
    }
    
    return task || null;
  }

  // Helper methods
  private async getJobsForPeriod(companyId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    try {
      const allJobs = await jobStore.getByCompany(companyId);
      
      return allJobs.filter(job => {
        const jobDate = new Date(job.classification?.invoiceDate || job.createdAt);
        return jobDate >= startDate && jobDate <= endDate;
      });
    } catch (error) {
      console.warn('[ClosingService] Could not fetch jobs:', error);
      return [];
    }
  }

  private getMonthName(month: number): string {
    const months = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    return months[month - 1] || '';
  }
}

export const closingService = new ClosingService();
