/**
 * Tax Calculator - Skatteberäkning
 * 
 * Beräknar bolagsskatt, uppskjuten skatt och skatteåterbäring
 * enligt svenska skatteregler.
 */

// Svenska skattesatser 2024/2025
export const TAX_RATES = {
  CORPORATE_TAX: 0.206,          // 20.6% bolagsskatt
  DEFERRED_TAX: 0.206,           // Uppskjuten skatt samma sats
  INTEREST_DEDUCTION_LIMIT: 0.25, // Ränteavdragsbegränsning (EBITDA-regel)
  LOSS_CARRYFORWARD_LIMIT: 1.0,  // 100% av förlust kan föras framåt
} as const;

// Konton för skatteberäkning
export const TAX_ACCOUNTS = {
  // Resultaträkning
  TAX_EXPENSE: '8910',           // Skatt på årets resultat
  DEFERRED_TAX_EXPENSE: '8920',  // Förändring uppskjuten skatt
  
  // Balansräkning - skulder
  TAX_LIABILITY: '2510',         // Skatteskuld
  DEFERRED_TAX_LIABILITY: '2240', // Uppskjuten skatteskuld
  
  // Balansräkning - tillgångar
  TAX_RECEIVABLE: '1640',        // Skattefordran
  DEFERRED_TAX_ASSET: '1370',    // Uppskjuten skattefordran
  
  // Underskottsavdrag
  TAX_LOSS_CARRYFORWARD: '2099', // Realiseras via eget kapital
} as const;

export interface TaxCalculationInput {
  // Resultaträkning
  revenue: number;               // Totala intäkter
  operatingExpenses: number;     // Rörelsekostnader
  depreciation: number;          // Avskrivningar
  financialIncome: number;       // Finansiella intäkter
  financialExpenses: number;     // Finansiella kostnader (räntor)
  
  // Justeringar
  nonDeductibleExpenses: number; // Ej avdragsgilla kostnader
  nonTaxableIncome: number;      // Skattefria intäkter
  
  // Tidigare år
  previousYearLoss: number;      // Underskott från tidigare år
  
  // Periodisering
  isYearEnd: boolean;            // Om det är årsbokslut
  monthsInPeriod: number;        // Antal månader (för periodisering)
}

export interface TaxCalculationResult {
  // Beräknat skattemässigt resultat
  accountingProfit: number;      // Bokföringsmässigt resultat före skatt
  taxableProfit: number;         // Skattemässigt resultat
  
  // Skattebelopp
  currentTax: number;            // Aktuell skatt
  deferredTax: number;           // Uppskjuten skatt
  totalTax: number;              // Total skatt
  
  // Effektiv skattesats
  effectiveTaxRate: number;
  
  // Underskott
  lossCarryforward: number;      // Underskott att föra framåt
  lossUtilized: number;          // Använt underskott
  
  // Detaljer
  adjustments: {
    description: string;
    amount: number;
    type: 'add' | 'subtract';
  }[];
  
  // Periodisering (för månadsbokslut)
  monthlyProvision?: number;
}

export interface TaxVoucher {
  date: string;
  description: string;
  totalAmount: number;
  rows: {
    account: string;
    debit?: number;
    credit?: number;
    description: string;
  }[];
  isYearEnd: boolean;
}

class TaxCalculator {
  /**
   * Beräkna skatt baserat på resultat
   */
  calculateTax(input: TaxCalculationInput): TaxCalculationResult {
    const adjustments: TaxCalculationResult['adjustments'] = [];
    
    // 1. Beräkna bokföringsmässigt resultat
    const operatingResult = input.revenue - input.operatingExpenses - input.depreciation;
    const financialNet = input.financialIncome - input.financialExpenses;
    const accountingProfit = operatingResult + financialNet;
    
    // 2. Justera för skattemässigt resultat
    let taxableProfit = accountingProfit;
    
    // Lägg till ej avdragsgilla kostnader
    if (input.nonDeductibleExpenses > 0) {
      taxableProfit += input.nonDeductibleExpenses;
      adjustments.push({
        description: 'Ej avdragsgilla kostnader (representation, böter, etc)',
        amount: input.nonDeductibleExpenses,
        type: 'add',
      });
    }
    
    // Dra av skattefria intäkter
    if (input.nonTaxableIncome > 0) {
      taxableProfit -= input.nonTaxableIncome;
      adjustments.push({
        description: 'Skattefria intäkter (utdelningar, etc)',
        amount: input.nonTaxableIncome,
        type: 'subtract',
      });
    }
    
    // 3. Ränteavdragsbegränsning (förenklad EBITDA-regel)
    const ebitda = operatingResult + input.depreciation;
    const maxInterestDeduction = ebitda * TAX_RATES.INTEREST_DEDUCTION_LIMIT;
    
    if (input.financialExpenses > maxInterestDeduction && input.financialExpenses > 5000000) {
      // Endast för större bolag med räntor > 5 MSEK
      const disallowedInterest = input.financialExpenses - maxInterestDeduction;
      taxableProfit += disallowedInterest;
      adjustments.push({
        description: 'Ej avdragsgill ränta (EBITDA-regeln)',
        amount: disallowedInterest,
        type: 'add',
      });
    }
    
    // 4. Utnyttja tidigare års underskott
    let lossUtilized = 0;
    let lossCarryforward = input.previousYearLoss;
    
    if (taxableProfit > 0 && input.previousYearLoss > 0) {
      lossUtilized = Math.min(taxableProfit, input.previousYearLoss);
      taxableProfit -= lossUtilized;
      lossCarryforward = input.previousYearLoss - lossUtilized;
      
      adjustments.push({
        description: 'Utnyttjat underskottsavdrag',
        amount: lossUtilized,
        type: 'subtract',
      });
    }
    
    // 5. Beräkna skatt
    let currentTax = 0;
    let deferredTax = 0;
    
    if (taxableProfit > 0) {
      currentTax = Math.round(taxableProfit * TAX_RATES.CORPORATE_TAX);
    } else {
      // Negativt resultat = framtida underskottsavdrag
      lossCarryforward += Math.abs(taxableProfit);
      
      // Uppskjuten skattefordran på underskott (om sannolikt att det utnyttjas)
      deferredTax = -Math.round(Math.abs(taxableProfit) * TAX_RATES.DEFERRED_TAX);
    }
    
    const totalTax = currentTax + deferredTax;
    
    // 6. Beräkna effektiv skattesats
    const effectiveTaxRate = accountingProfit !== 0 
      ? totalTax / accountingProfit 
      : 0;
    
    // 7. Periodisering för månadsbokslut
    let monthlyProvision: number | undefined;
    if (!input.isYearEnd && input.monthsInPeriod > 0) {
      // Fördela skatten jämnt över året
      monthlyProvision = Math.round(currentTax / 12);
    }
    
    return {
      accountingProfit,
      taxableProfit: Math.max(0, taxableProfit),
      currentTax,
      deferredTax,
      totalTax,
      effectiveTaxRate,
      lossCarryforward,
      lossUtilized,
      adjustments,
      monthlyProvision,
    };
  }

  /**
   * Beräkna skatteafsättning för en period
   */
  calculatePeriodTaxProvision(
    periodProfit: number,
    year: number,
    month: number,
    yearToDateProfit: number = 0
  ): {
    provisionAmount: number;
    isCredit: boolean;
    description: string;
  } {
    // Estimera helårsresultat baserat på YTD
    const monthsElapsed = month;
    const estimatedYearProfit = yearToDateProfit > 0 
      ? (yearToDateProfit / monthsElapsed) * 12
      : periodProfit * 12;
    
    // Beräkna helårsskatt
    const estimatedYearTax = estimatedYearProfit > 0 
      ? Math.round(estimatedYearProfit * TAX_RATES.CORPORATE_TAX)
      : 0;
    
    // Månatlig avsättning
    const monthlyProvision = Math.round(estimatedYearTax / 12);
    
    return {
      provisionAmount: monthlyProvision,
      isCredit: monthlyProvision < 0,
      description: `Skatteavsättning period ${month}/${year} (${(TAX_RATES.CORPORATE_TAX * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Generera skatteverifikation
   */
  generateTaxVoucher(
    result: TaxCalculationResult,
    year: number,
    month: number,
    isYearEnd: boolean = false
  ): TaxVoucher | null {
    const amount = isYearEnd ? result.currentTax : (result.monthlyProvision || 0);
    
    if (amount === 0) {
      return null;
    }
    
    const lastDayOfMonth = new Date(year, month, 0);
    const monthNames = [
      'januari', 'februari', 'mars', 'april', 'maj', 'juni',
      'juli', 'augusti', 'september', 'oktober', 'november', 'december'
    ];
    
    const rows: TaxVoucher['rows'] = [];
    
    if (amount > 0) {
      // Skattekostnad (positiv = vinst)
      rows.push({
        account: TAX_ACCOUNTS.TAX_EXPENSE,
        debit: amount,
        description: isYearEnd ? 'Skatt på årets resultat' : 'Skatteavsättning',
      });
      
      rows.push({
        account: TAX_ACCOUNTS.TAX_LIABILITY,
        credit: amount,
        description: isYearEnd ? 'Skatteskuld' : 'Skatteavsättning',
      });
    } else {
      // Skattefordran (negativ = förlust med uppskjuten skatt)
      const absAmount = Math.abs(amount);
      
      rows.push({
        account: TAX_ACCOUNTS.DEFERRED_TAX_ASSET,
        debit: absAmount,
        description: 'Uppskjuten skattefordran',
      });
      
      rows.push({
        account: TAX_ACCOUNTS.DEFERRED_TAX_EXPENSE,
        credit: absAmount,
        description: 'Uppskjuten skatteintäkt',
      });
    }
    
    return {
      date: lastDayOfMonth.toISOString().split('T')[0],
      description: isYearEnd 
        ? `Skatt på årets resultat ${year}`
        : `Skatteavsättning ${monthNames[month - 1]} ${year}`,
      totalAmount: Math.abs(amount),
      rows,
      isYearEnd,
    };
  }

  /**
   * Beräkna skattemässigt resultat från kontobalanserna
   */
  calculateFromAccountBalances(balances: {
    account: string;
    balance: number;
  }[]): TaxCalculationInput {
    // Gruppera per kontoklass
    const getBalance = (accountStart: string): number => {
      return balances
        .filter(b => b.account.startsWith(accountStart))
        .reduce((sum, b) => sum + b.balance, 0);
    };
    
    // Intäkter (klass 3)
    const revenue = Math.abs(getBalance('3'));
    
    // Kostnader (klass 4-6)
    const operatingExpenses = 
      Math.abs(getBalance('4')) + 
      Math.abs(getBalance('5')) + 
      Math.abs(getBalance('6'));
    
    // Personal (klass 7 exkl. avskrivningar)
    const personalCosts = Math.abs(getBalance('70')) + 
                          Math.abs(getBalance('71')) + 
                          Math.abs(getBalance('72')) + 
                          Math.abs(getBalance('73')) + 
                          Math.abs(getBalance('74')) + 
                          Math.abs(getBalance('75')) + 
                          Math.abs(getBalance('76'));
    
    // Avskrivningar (78xx)
    const depreciation = Math.abs(getBalance('78'));
    
    // Finansiella intäkter (83xx)
    const financialIncome = Math.abs(getBalance('83'));
    
    // Finansiella kostnader (84xx)
    const financialExpenses = Math.abs(getBalance('84'));
    
    // Ej avdragsgilla kostnader (representation över gräns, böter, etc)
    // Förenkling: ta 50% av representation (6070) som ej avdragsgill
    const representation = Math.abs(getBalance('6070'));
    const nonDeductibleExpenses = representation * 0.5;
    
    return {
      revenue,
      operatingExpenses: operatingExpenses + personalCosts,
      depreciation,
      financialIncome,
      financialExpenses,
      nonDeductibleExpenses,
      nonTaxableIncome: 0,
      previousYearLoss: 0,
      isYearEnd: false,
      monthsInPeriod: 1,
    };
  }

  /**
   * Generera skatterapport
   */
  generateTaxReport(
    result: TaxCalculationResult,
    year: number
  ): {
    title: string;
    period: string;
    sections: {
      title: string;
      items: { label: string; value: number; isTotal?: boolean }[];
    }[];
  } {
    return {
      title: 'Skatteberäkning',
      period: `Räkenskapsår ${year}`,
      sections: [
        {
          title: 'Resultat',
          items: [
            { label: 'Bokföringsmässigt resultat före skatt', value: result.accountingProfit },
            ...result.adjustments.map(a => ({
              label: `${a.type === 'add' ? '+' : '-'} ${a.description}`,
              value: a.type === 'add' ? a.amount : -a.amount,
            })),
            { label: 'Skattemässigt resultat', value: result.taxableProfit, isTotal: true },
          ],
        },
        {
          title: 'Skatteberäkning',
          items: [
            { label: `Aktuell skatt (${(TAX_RATES.CORPORATE_TAX * 100).toFixed(1)}%)`, value: result.currentTax },
            { label: 'Uppskjuten skatt', value: result.deferredTax },
            { label: 'Total skatt', value: result.totalTax, isTotal: true },
          ],
        },
        {
          title: 'Underskottsavdrag',
          items: [
            { label: 'Ingående underskott', value: result.lossCarryforward + result.lossUtilized },
            { label: 'Utnyttjat under året', value: -result.lossUtilized },
            { label: 'Utgående underskott', value: result.lossCarryforward, isTotal: true },
          ],
        },
        {
          title: 'Nyckeltal',
          items: [
            { label: 'Effektiv skattesats', value: result.effectiveTaxRate * 100 },
          ],
        },
      ],
    };
  }
}

export const taxCalculator = new TaxCalculator();








