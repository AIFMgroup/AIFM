/**
 * Periodization Service
 * 
 * Hanterar periodisering av intäkter och kostnader.
 * Stöd för förutbetalda kostnader, upplupna intäkter m.m.
 */

// Periodiseringskonton enligt BAS
export const PERIODIZATION_ACCOUNTS = {
  // Förutbetalda kostnader (tillgång)
  PREPAID_EXPENSES: { account: '1790', name: 'Övriga förutbetalda kostnader' },
  PREPAID_RENT: { account: '1710', name: 'Förutbetalda hyreskostnader' },
  PREPAID_INSURANCE: { account: '1720', name: 'Förutbetalda försäkringspremier' },
  PREPAID_LEASING: { account: '1730', name: 'Förutbetalda leasingavgifter' },

  // Upplupna kostnader (skuld)
  ACCRUED_EXPENSES: { account: '2990', name: 'Övriga upplupna kostnader' },
  ACCRUED_SALARIES: { account: '2910', name: 'Upplupna löner' },
  ACCRUED_VACATION: { account: '2920', name: 'Upplupna semesterlöner' },
  ACCRUED_SOCIAL: { account: '2940', name: 'Upplupna arbetsgivaravgifter' },
  ACCRUED_INTEREST: { account: '2960', name: 'Upplupna räntekostnader' },

  // Förutbetalda intäkter (skuld)
  PREPAID_INCOME: { account: '2990', name: 'Förutbetalda intäkter' },

  // Upplupna intäkter (tillgång)
  ACCRUED_INCOME: { account: '1790', name: 'Upplupna intäkter' },
} as const;

// Nyckelord som indikerar periodiseringsbehov
const PERIODIZATION_KEYWORDS: { keywords: string[]; type: PeriodizationType; account: string }[] = [
  { keywords: ['årsabonnemang', 'årslicens', 'årsprenumeration'], type: 'prepaid_expense', account: '1790' },
  { keywords: ['hyra', 'lokal', 'kontorshyra'], type: 'prepaid_expense', account: '1710' },
  { keywords: ['försäkring', 'insurance'], type: 'prepaid_expense', account: '1720' },
  { keywords: ['leasing', 'lease'], type: 'prepaid_expense', account: '1730' },
  { keywords: ['support', 'underhåll', 'service'], type: 'prepaid_expense', account: '1790' },
  { keywords: ['licens', 'license', 'subscription'], type: 'prepaid_expense', account: '1790' },
];

export type PeriodizationType = 
  | 'prepaid_expense'   // Förutbetald kostnad
  | 'accrued_expense'   // Upplupen kostnad
  | 'prepaid_income'    // Förutbetald intäkt
  | 'accrued_income';   // Upplupen intäkt

export interface PeriodizationDetection {
  shouldPeriodize: boolean;
  type?: PeriodizationType;
  periodizationAccount?: { account: string; name: string };
  suggestedPeriod?: { startDate: string; endDate: string; months: number };
  reason?: string;
  confidence: number;
}

export interface PeriodizationSchedule {
  id: string;
  originalAmount: number;
  periodizationAccount: string;
  costAccount: string;
  startDate: string;
  endDate: string;
  totalMonths: number;
  monthlyAmount: number;
  entries: PeriodizationEntry[];
}

export interface PeriodizationEntry {
  date: string;
  period: string; // YYYY-MM
  debitAccount: string;
  debitAmount: number;
  creditAccount: string;
  creditAmount: number;
  description: string;
  isProcessed: boolean;
}

/**
 * Detektera om en kostnad bör periodiseras
 */
export function detectPeriodizationNeed(
  description: string,
  amount: number,
  invoiceDate: string,
  dueDate?: string,
  supplierName?: string
): PeriodizationDetection {
  const text = `${description} ${supplierName || ''}`.toLowerCase();

  // 1. Kontrollera nyckelord
  for (const { keywords, type, account } of PERIODIZATION_KEYWORDS) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Försök extrahera period
        const period = extractPeriod(description);
        
        if (period && period.months > 1) {
          return {
            shouldPeriodize: true,
            type,
            periodizationAccount: { account, name: getPeriodizationAccountName(account) },
            suggestedPeriod: period,
            reason: `Identifierat som ${keyword} som sträcker sig över flera månader`,
            confidence: 0.85,
          };
        }
        
        // Kolla om beloppet indikerar fler månader (t.ex. hög hyreskostnad)
        if (amount > 10000 && keywords.includes('hyra')) {
          const estimatedMonths = estimateMonthsFromAmount(amount, 'rent');
          if (estimatedMonths > 1) {
            return {
              shouldPeriodize: true,
              type,
              periodizationAccount: { account, name: getPeriodizationAccountName(account) },
              suggestedPeriod: {
                startDate: invoiceDate,
                endDate: addMonths(invoiceDate, estimatedMonths),
                months: estimatedMonths,
              },
              reason: `Högt belopp kan indikera förskottsbetalning för ${estimatedMonths} månader`,
              confidence: 0.6,
            };
          }
        }
      }
    }
  }

  // 2. Kontrollera om fakturadatum och förfallodatum indikerar lång period
  if (dueDate && invoiceDate) {
    const months = monthsBetween(invoiceDate, dueDate);
    if (months > 3) {
      return {
        shouldPeriodize: true,
        type: 'prepaid_expense',
        periodizationAccount: PERIODIZATION_ACCOUNTS.PREPAID_EXPENSES,
        suggestedPeriod: {
          startDate: invoiceDate,
          endDate: dueDate,
          months,
        },
        reason: `Period mellan fakturadatum och förfallodatum är ${months} månader`,
        confidence: 0.5,
      };
    }
  }

  // 3. Kontrollera specifika mönster i texten
  const periodPattern = extractPeriod(description);
  if (periodPattern && periodPattern.months > 1) {
    return {
      shouldPeriodize: true,
      type: 'prepaid_expense',
      periodizationAccount: PERIODIZATION_ACCOUNTS.PREPAID_EXPENSES,
      suggestedPeriod: periodPattern,
      reason: `Identifierad period: ${periodPattern.startDate} - ${periodPattern.endDate}`,
      confidence: 0.75,
    };
  }

  return {
    shouldPeriodize: false,
    confidence: 0,
  };
}

/**
 * Skapa periodiseringsschema
 */
export function createPeriodizationSchedule(
  amount: number,
  costAccount: string,
  periodizationAccount: string,
  startDate: string,
  endDate: string
): PeriodizationSchedule {
  const totalMonths = monthsBetween(startDate, endDate) || 1;
  const monthlyAmount = Math.round((amount / totalMonths) * 100) / 100;
  const entries: PeriodizationEntry[] = [];

  // Skapa en entry per månad
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  let remainingAmount = amount;

  while (currentDate <= end) {
    const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const isLast = currentDate.getMonth() === end.getMonth() && currentDate.getFullYear() === end.getFullYear();
    
    // Sista månaden får resterande belopp (för att undvika avrundningsfel)
    const entryAmount = isLast ? remainingAmount : monthlyAmount;
    remainingAmount -= entryAmount;

    entries.push({
      date: `${period}-01`,
      period,
      debitAccount: costAccount,
      debitAmount: entryAmount,
      creditAccount: periodizationAccount,
      creditAmount: entryAmount,
      description: `Periodisering ${period}`,
      isProcessed: false,
    });

    // Flytta till nästa månad
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return {
    id: `period-${Date.now()}`,
    originalAmount: amount,
    periodizationAccount,
    costAccount,
    startDate,
    endDate,
    totalMonths,
    monthlyAmount,
    entries,
  };
}

/**
 * Generera initiala bokföringsrader för periodisering
 * (när fakturan betalas/bokförs)
 */
export function generateInitialPeriodizationVoucher(
  amount: number,
  periodizationAccount: string,
  paymentAccount: string = '1930'
): {
  lines: { account: string; debit: number; credit: number; description: string }[];
} {
  return {
    lines: [
      {
        account: periodizationAccount,
        debit: amount,
        credit: 0,
        description: 'Förutbetald kostnad',
      },
      {
        account: paymentAccount,
        debit: 0,
        credit: amount,
        description: 'Betalning',
      },
    ],
  };
}

/**
 * Generera månatlig periodiseringsverifikation
 */
export function generateMonthlyPeriodizationVoucher(
  entry: PeriodizationEntry
): {
  lines: { account: string; debit: number; credit: number; description: string }[];
} {
  return {
    lines: [
      {
        account: entry.debitAccount,
        debit: entry.debitAmount,
        credit: 0,
        description: entry.description,
      },
      {
        account: entry.creditAccount,
        debit: 0,
        credit: entry.creditAmount,
        description: entry.description,
      },
    ],
  };
}

/**
 * Beräkna kvarvarande periodiseringssaldo
 */
export function calculateRemainingBalance(schedule: PeriodizationSchedule): number {
  const processed = schedule.entries.filter(e => e.isProcessed);
  const processedAmount = processed.reduce((sum, e) => sum + e.debitAmount, 0);
  return schedule.originalAmount - processedAmount;
}

/**
 * Hämta periodiseringar som ska bokföras denna månad
 */
export function getDuePeriodizations(
  schedules: PeriodizationSchedule[],
  targetMonth: string // YYYY-MM format
): PeriodizationEntry[] {
  const due: PeriodizationEntry[] = [];

  for (const schedule of schedules) {
    for (const entry of schedule.entries) {
      if (entry.period === targetMonth && !entry.isProcessed) {
        due.push(entry);
      }
    }
  }

  return due;
}

// ============ Hjälpfunktioner ============

function extractPeriod(text: string): { startDate: string; endDate: string; months: number } | null {
  // Mönster: "2024-01-01 - 2024-12-31", "jan 2024 - dec 2024", "Q1 2024"
  const patterns = [
    // ISO-format
    /(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/,
    // Månadsnamn
    /(\w+)\s+(\d{4})\s*[-–]\s*(\w+)\s+(\d{4})/i,
    // Kvartal
    /Q([1-4])\s+(\d{4})/i,
    // År
    /(\d{4})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('ISO')) {
        // ISO-format
        const start = match[1];
        const end = match[2];
        return { startDate: start, endDate: end, months: monthsBetween(start, end) };
      }
      
      if (match[0].startsWith('Q')) {
        // Kvartal
        const quarter = parseInt(match[1]);
        const year = parseInt(match[2]);
        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = quarter * 3;
        return {
          startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
          endDate: `${year}-${String(endMonth).padStart(2, '0')}-28`,
          months: 3,
        };
      }
    }
  }

  return null;
}

function monthsBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
         (endDate.getMonth() - startDate.getMonth()) + 1;
}

function addMonths(date: string, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function estimateMonthsFromAmount(amount: number, type: 'rent' | 'license' | 'insurance'): number {
  // Uppskatta månader baserat på typiska belopp
  const typicalMonthly: Record<string, number> = {
    rent: 15000,      // Typisk kontorshyra
    license: 1000,    // Typisk mjukvarulicens
    insurance: 5000,  // Typisk försäkringspremie
  };

  const monthly = typicalMonthly[type] || 5000;
  return Math.round(amount / monthly);
}

function getPeriodizationAccountName(account: string): string {
  for (const [key, value] of Object.entries(PERIODIZATION_ACCOUNTS)) {
    if (value.account === account) {
      return value.name;
    }
  }
  return 'Periodiseringskonto';
}

/**
 * Föreslå periodiseringskonto baserat på kostnadskonto
 */
export function suggestPeriodizationAccount(costAccount: string): { account: string; name: string } {
  // Mappa kostnadskonton till lämpliga periodiseringskonton
  const mapping: Record<string, typeof PERIODIZATION_ACCOUNTS[keyof typeof PERIODIZATION_ACCOUNTS]> = {
    '5010': PERIODIZATION_ACCOUNTS.PREPAID_RENT,       // Lokalhyra
    '5020': PERIODIZATION_ACCOUNTS.PREPAID_RENT,       // Hyra av anläggningstillgångar
    '6310': PERIODIZATION_ACCOUNTS.PREPAID_INSURANCE,  // Företagsförsäkringar
    '6311': PERIODIZATION_ACCOUNTS.PREPAID_INSURANCE,  // Försäkringspremier
    '5210': PERIODIZATION_ACCOUNTS.PREPAID_LEASING,    // Leasing av personbilar
    '5220': PERIODIZATION_ACCOUNTS.PREPAID_LEASING,    // Leasing av inventarier
    '6250': PERIODIZATION_ACCOUNTS.PREPAID_EXPENSES,   // IT-tjänster (licenser)
  };

  const prefix = costAccount.substring(0, 2);
  
  // Kontrollera exakt match först
  if (mapping[costAccount]) {
    return mapping[costAccount];
  }
  
  // Fallback baserat på kontogrupp
  switch (prefix) {
    case '50': return PERIODIZATION_ACCOUNTS.PREPAID_RENT;
    case '63': return PERIODIZATION_ACCOUNTS.PREPAID_INSURANCE;
    case '52': return PERIODIZATION_ACCOUNTS.PREPAID_LEASING;
    default: return PERIODIZATION_ACCOUNTS.PREPAID_EXPENSES;
  }
}


