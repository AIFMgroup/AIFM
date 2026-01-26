/**
 * Closing Reporter - Rapportgenerering för bokslut
 * 
 * Genererar balansräkning, resultaträkning och andra
 * bokslutsdokument enligt K2/K3 format.
 */

import { FortnoxClient } from '@/lib/fortnox/client';

// Rapportformat
export interface ReportSection {
  title: string;
  level: number;
  accounts?: AccountLine[];
  subtotal?: number;
  isTotal?: boolean;
}

export interface AccountLine {
  account: string;
  name: string;
  currentPeriod: number;
  previousPeriod?: number;
  isSubtotal?: boolean;
}

export interface BalanceSheet {
  title: string;
  companyName: string;
  date: string;
  currency: string;
  
  assets: {
    fixedAssets: ReportSection[];
    currentAssets: ReportSection[];
    totalAssets: number;
  };
  
  equityAndLiabilities: {
    equity: ReportSection[];
    provisions: ReportSection[];
    liabilities: ReportSection[];
    totalEquityAndLiabilities: number;
  };
  
  generatedAt: string;
}

export interface IncomeStatement {
  title: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  
  sections: ReportSection[];
  
  operatingResult: number;
  resultBeforeTax: number;
  netResult: number;
  
  generatedAt: string;
}

export interface TrialBalance {
  title: string;
  companyName: string;
  date: string;
  
  accounts: {
    account: string;
    name: string;
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
  }[];
  
  totals: {
    openingBalance: number;
    periodDebit: number;
    periodCredit: number;
    closingBalance: number;
  };
  
  generatedAt: string;
}

// BAS-konton för balansräkning (förenklad)
const BALANCE_SHEET_STRUCTURE = {
  assets: {
    fixedAssets: [
      { group: '10', title: 'Immateriella anläggningstillgångar', accounts: ['1010', '1020', '1030', '1040', '1050'] },
      { group: '11', title: 'Byggnader och mark', accounts: ['1110', '1130', '1150'] },
      { group: '12', title: 'Maskiner och inventarier', accounts: ['1210', '1220', '1230', '1240', '1250'] },
      { group: '13', title: 'Finansiella anläggningstillgångar', accounts: ['1310', '1320', '1350'] },
    ],
    currentAssets: [
      { group: '14', title: 'Lager', accounts: ['1410', '1420', '1460'] },
      { group: '15', title: 'Kundfordringar', accounts: ['1510', '1519'] },
      { group: '16', title: 'Övriga fordringar', accounts: ['1610', '1640', '1650'] },
      { group: '17', title: 'Förutbetalda kostnader', accounts: ['1710', '1720', '1730', '1790'] },
      { group: '19', title: 'Kassa och bank', accounts: ['1910', '1920', '1930', '1940'] },
    ],
  },
  equityAndLiabilities: {
    equity: [
      { group: '20', title: 'Eget kapital', accounts: ['2010', '2081', '2091', '2099'] },
    ],
    provisions: [
      { group: '22', title: 'Avsättningar', accounts: ['2210', '2220', '2240'] },
    ],
    liabilities: [
      { group: '23', title: 'Långfristiga skulder', accounts: ['2310', '2330', '2350'] },
      { group: '24', title: 'Kortfristiga skulder', accounts: ['2410', '2440'] },
      { group: '25', title: 'Skatteskulder', accounts: ['2510', '2512'] },
      { group: '26', title: 'Momsskulder', accounts: ['2610', '2620', '2630', '2640', '2650'] },
      { group: '27', title: 'Personalskatter', accounts: ['2710', '2730', '2731'] },
      { group: '29', title: 'Upplupna kostnader', accounts: ['2910', '2920', '2940', '2990'] },
    ],
  },
};

// Resultaträkningsstruktur (funktionsindelad)
const INCOME_STATEMENT_STRUCTURE = [
  { group: '3', title: 'Nettoomsättning', accounts: ['30', '31', '32', '33', '34', '35'] },
  { group: '4', title: 'Kostnad sålda varor', accounts: ['40', '41', '42', '43', '44', '45'] },
  { group: '5', title: 'Övriga externa kostnader', accounts: ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'] },
  { group: '6', title: 'Personalkostnader', accounts: ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69'] },
  { group: '7', title: 'Avskrivningar', accounts: ['78'] },
  { group: '8-fin-income', title: 'Finansiella intäkter', accounts: ['80', '81', '82', '83'] },
  { group: '8-fin-expense', title: 'Finansiella kostnader', accounts: ['84', '85', '86', '87'] },
  { group: '8-tax', title: 'Skatt på årets resultat', accounts: ['89'] },
];

class ClosingReporter {
  private fortnoxClient: FortnoxClient | null = null;
  private accountBalances: Map<string, { name: string; balance: number }> = new Map();

  /**
   * Initiera med Fortnox-klient
   */
  async init(fortnoxClient: FortnoxClient): Promise<void> {
    this.fortnoxClient = fortnoxClient;
  }

  /**
   * Ladda kontosaldon (från Fortnox eller simulerade)
   */
  async loadAccountBalances(companyId: string, year: number, month: number): Promise<void> {
    this.accountBalances.clear();
    
    // I verklig implementation: hämta från Fortnox eller databas
    // För nu: använd simulerade saldon
    const simulatedBalances = this.getSimulatedBalances(year, month);
    
    for (const [account, data] of Object.entries(simulatedBalances)) {
      this.accountBalances.set(account, data);
    }
  }

  /**
   * Simulerade kontosaldon för demo
   */
  private getSimulatedBalances(year: number, month: number): Record<string, { name: string; balance: number }> {
    return {
      // Tillgångar
      '1220': { name: 'Inventarier och verktyg', balance: 250000 },
      '1229': { name: 'Ack avskrivning inventarier', balance: -100000 },
      '1250': { name: 'Datorer', balance: 120000 },
      '1259': { name: 'Ack avskrivning datorer', balance: -80000 },
      '1510': { name: 'Kundfordringar', balance: 450000 },
      '1710': { name: 'Förutbetalda hyreskostnader', balance: 25000 },
      '1930': { name: 'Företagskonto', balance: 850000 },
      
      // Eget kapital
      '2081': { name: 'Aktiekapital', balance: -100000 },
      '2091': { name: 'Balanserad vinst', balance: -350000 },
      '2099': { name: 'Årets resultat', balance: -180000 },
      
      // Skulder
      '2440': { name: 'Leverantörsskulder', balance: -185000 },
      '2510': { name: 'Skatteskuld', balance: -45000 },
      '2610': { name: 'Utgående moms 25%', balance: -95000 },
      '2640': { name: 'Ingående moms', balance: 65000 },
      '2710': { name: 'Personalskatt', balance: -35000 },
      '2731': { name: 'Arbetsgivaravgifter', balance: -28000 },
      '2910': { name: 'Upplupna löner', balance: -42000 },
      '2920': { name: 'Upplupna semesterlöner', balance: -85000 },
      
      // Intäkter (resultaträkning - negativa = kredit)
      '3010': { name: 'Försäljning varor 25%', balance: -1200000 },
      '3040': { name: 'Försäljning tjänster 25%', balance: -800000 },
      
      // Kostnader (resultaträkning - positiva = debet)
      '4010': { name: 'Inköp varor', balance: 450000 },
      '5010': { name: 'Lokalhyra', balance: 180000 },
      '5120': { name: 'El', balance: 25000 },
      '5410': { name: 'Förbrukningsinventarier', balance: 35000 },
      '5420': { name: 'Programvaror', balance: 85000 },
      '6212': { name: 'Mobiltelefon', balance: 18000 },
      '6540': { name: 'IT-tjänster', balance: 95000 },
      '6550': { name: 'Konsultarvoden', balance: 120000 },
      '6570': { name: 'Banktjänster', balance: 8000 },
      '7010': { name: 'Löner', balance: 720000 },
      '7510': { name: 'Arbetsgivaravgifter', balance: 227000 },
      '7821': { name: 'Avskrivning inventarier', balance: 50000 },
      '7825': { name: 'Avskrivning datorer', balance: 40000 },
      '8380': { name: 'Ränteintäkter', balance: -5000 },
      '8480': { name: 'Räntekostnader', balance: 2000 },
      '8910': { name: 'Skatt på årets resultat', balance: 45000 },
    };
  }

  /**
   * Hämta saldo för ett konto
   */
  private getBalance(account: string): number {
    return this.accountBalances.get(account)?.balance || 0;
  }

  /**
   * Hämta saldo för kontogrupp (prefix)
   */
  private getGroupBalance(prefix: string): number {
    let total = 0;
    for (const [account, data] of this.accountBalances) {
      if (account.startsWith(prefix)) {
        total += data.balance;
      }
    }
    return total;
  }

  /**
   * Generera balansräkning
   */
  async generateBalanceSheet(
    companyId: string,
    companyName: string,
    year: number,
    month: number
  ): Promise<BalanceSheet> {
    await this.loadAccountBalances(companyId, year, month);
    
    const lastDayOfMonth = new Date(year, month, 0);
    
    // Bygg tillgångssektioner
    const fixedAssetSections: ReportSection[] = [];
    let totalFixedAssets = 0;
    
    for (const group of BALANCE_SHEET_STRUCTURE.assets.fixedAssets) {
      const accounts: AccountLine[] = [];
      let groupTotal = 0;
      
      for (const account of group.accounts) {
        const balance = this.getBalance(account);
        if (balance !== 0) {
          const name = this.accountBalances.get(account)?.name || account;
          accounts.push({ account, name, currentPeriod: balance });
          groupTotal += balance;
        }
        
        // Lägg till ackumulerade avskrivningar
        const accAccount = account.slice(0, 3) + '9';
        const accBalance = this.getBalance(accAccount);
        if (accBalance !== 0) {
          const name = this.accountBalances.get(accAccount)?.name || `Ack avskr ${account}`;
          accounts.push({ account: accAccount, name, currentPeriod: accBalance });
          groupTotal += accBalance;
        }
      }
      
      if (accounts.length > 0) {
        fixedAssetSections.push({
          title: group.title,
          level: 2,
          accounts,
          subtotal: groupTotal,
        });
        totalFixedAssets += groupTotal;
      }
    }
    
    // Omsättningstillgångar
    const currentAssetSections: ReportSection[] = [];
    let totalCurrentAssets = 0;
    
    for (const group of BALANCE_SHEET_STRUCTURE.assets.currentAssets) {
      const accounts: AccountLine[] = [];
      let groupTotal = 0;
      
      for (const account of group.accounts) {
        const balance = this.getBalance(account);
        if (balance !== 0) {
          const name = this.accountBalances.get(account)?.name || account;
          accounts.push({ account, name, currentPeriod: balance });
          groupTotal += balance;
        }
      }
      
      if (accounts.length > 0) {
        currentAssetSections.push({
          title: group.title,
          level: 2,
          accounts,
          subtotal: groupTotal,
        });
        totalCurrentAssets += groupTotal;
      }
    }
    
    const totalAssets = totalFixedAssets + totalCurrentAssets;
    
    // Eget kapital och skulder
    const equitySections: ReportSection[] = [];
    let totalEquity = 0;
    
    for (const group of BALANCE_SHEET_STRUCTURE.equityAndLiabilities.equity) {
      const accounts: AccountLine[] = [];
      let groupTotal = 0;
      
      for (const account of group.accounts) {
        const balance = this.getBalance(account);
        if (balance !== 0) {
          const name = this.accountBalances.get(account)?.name || account;
          // Eget kapital visas som positivt (vända tecknet)
          accounts.push({ account, name, currentPeriod: -balance });
          groupTotal -= balance;
        }
      }
      
      if (accounts.length > 0) {
        equitySections.push({
          title: group.title,
          level: 2,
          accounts,
          subtotal: groupTotal,
        });
        totalEquity += groupTotal;
      }
    }
    
    // Avsättningar
    const provisionSections: ReportSection[] = [];
    let totalProvisions = 0;
    
    for (const group of BALANCE_SHEET_STRUCTURE.equityAndLiabilities.provisions) {
      const accounts: AccountLine[] = [];
      let groupTotal = 0;
      
      for (const account of group.accounts) {
        const balance = this.getBalance(account);
        if (balance !== 0) {
          const name = this.accountBalances.get(account)?.name || account;
          accounts.push({ account, name, currentPeriod: -balance });
          groupTotal -= balance;
        }
      }
      
      if (accounts.length > 0) {
        provisionSections.push({
          title: group.title,
          level: 2,
          accounts,
          subtotal: groupTotal,
        });
        totalProvisions += groupTotal;
      }
    }
    
    // Skulder
    const liabilitySections: ReportSection[] = [];
    let totalLiabilities = 0;
    
    for (const group of BALANCE_SHEET_STRUCTURE.equityAndLiabilities.liabilities) {
      const accounts: AccountLine[] = [];
      let groupTotal = 0;
      
      for (const account of group.accounts) {
        const balance = this.getBalance(account);
        if (balance !== 0) {
          const name = this.accountBalances.get(account)?.name || account;
          // Skulder visas som positiva (vända tecknet)
          accounts.push({ account, name, currentPeriod: -balance });
          groupTotal -= balance;
        }
      }
      
      if (accounts.length > 0) {
        liabilitySections.push({
          title: group.title,
          level: 2,
          accounts,
          subtotal: groupTotal,
        });
        totalLiabilities += groupTotal;
      }
    }
    
    return {
      title: 'Balansräkning',
      companyName,
      date: lastDayOfMonth.toISOString().split('T')[0],
      currency: 'SEK',
      
      assets: {
        fixedAssets: fixedAssetSections,
        currentAssets: currentAssetSections,
        totalAssets,
      },
      
      equityAndLiabilities: {
        equity: equitySections,
        provisions: provisionSections,
        liabilities: liabilitySections,
        totalEquityAndLiabilities: totalEquity + totalProvisions + totalLiabilities,
      },
      
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generera resultaträkning
   */
  async generateIncomeStatement(
    companyId: string,
    companyName: string,
    year: number,
    month: number
  ): Promise<IncomeStatement> {
    await this.loadAccountBalances(companyId, year, month);
    
    const periodStart = `${year}-01-01`;
    const lastDayOfMonth = new Date(year, month, 0);
    const periodEnd = lastDayOfMonth.toISOString().split('T')[0];
    
    const sections: ReportSection[] = [];
    let operatingResult = 0;
    let financialNet = 0;
    let taxExpense = 0;
    
    // Process each section
    for (const sectionDef of INCOME_STATEMENT_STRUCTURE) {
      const accounts: AccountLine[] = [];
      let sectionTotal = 0;
      
      for (const prefix of sectionDef.accounts) {
        for (const [account, data] of this.accountBalances) {
          if (account.startsWith(prefix) && !account.endsWith('9')) {
            // Intäkter (klass 3) är kredit = negativa i rådata, visas som positiva
            // Kostnader är debet = positiva i rådata, visas som positiva
            const displayValue = account.startsWith('3') ? -data.balance : data.balance;
            
            if (data.balance !== 0) {
              accounts.push({
                account,
                name: data.name,
                currentPeriod: displayValue,
              });
              sectionTotal += displayValue;
            }
          }
        }
      }
      
      if (accounts.length > 0) {
        sections.push({
          title: sectionDef.title,
          level: 2,
          accounts,
          subtotal: sectionTotal,
        });
        
        // Kategorisera för totaler
        if (['3', '4', '5', '6', '7'].includes(sectionDef.group.charAt(0))) {
          operatingResult += (sectionDef.group === '3' ? sectionTotal : -sectionTotal);
        } else if (sectionDef.group.includes('fin-income')) {
          financialNet += sectionTotal;
        } else if (sectionDef.group.includes('fin-expense')) {
          financialNet -= sectionTotal;
        } else if (sectionDef.group === '8-tax') {
          taxExpense = sectionTotal;
        }
      }
    }
    
    // Beräkna rörelseresultat
    let revenue = 0;
    let expenses = 0;
    
    for (const [account, data] of this.accountBalances) {
      if (account.startsWith('3')) {
        revenue -= data.balance; // Vända tecken för intäkter
      } else if (account.match(/^[4-7]/) && !account.startsWith('78')) {
        expenses += data.balance;
      } else if (account.startsWith('78')) {
        expenses += data.balance; // Avskrivningar
      }
    }
    
    operatingResult = revenue - expenses;
    const resultBeforeTax = operatingResult + financialNet;
    const netResult = resultBeforeTax - taxExpense;
    
    // Lägg till totalsektioner
    sections.push({
      title: 'Rörelseresultat',
      level: 1,
      subtotal: operatingResult,
      isTotal: true,
    });
    
    sections.push({
      title: 'Resultat före skatt',
      level: 1,
      subtotal: resultBeforeTax,
      isTotal: true,
    });
    
    sections.push({
      title: 'Årets resultat',
      level: 1,
      subtotal: netResult,
      isTotal: true,
    });
    
    return {
      title: 'Resultaträkning',
      companyName,
      periodStart,
      periodEnd,
      currency: 'SEK',
      sections,
      operatingResult,
      resultBeforeTax,
      netResult,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generera huvudbok/råbalans
   */
  async generateTrialBalance(
    companyId: string,
    companyName: string,
    year: number,
    month: number
  ): Promise<TrialBalance> {
    await this.loadAccountBalances(companyId, year, month);
    
    const lastDayOfMonth = new Date(year, month, 0);
    
    const accounts: TrialBalance['accounts'] = [];
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Sortera konton
    const sortedAccounts = Array.from(this.accountBalances.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    
    for (const [account, data] of sortedAccounts) {
      const balance = data.balance;
      const isDebit = balance > 0;
      
      accounts.push({
        account,
        name: data.name,
        openingBalance: 0, // Förenkling
        periodDebit: isDebit ? balance : 0,
        periodCredit: isDebit ? 0 : Math.abs(balance),
        closingBalance: balance,
      });
      
      if (isDebit) {
        totalDebit += balance;
      } else {
        totalCredit += Math.abs(balance);
      }
    }
    
    return {
      title: 'Huvudbok / Råbalans',
      companyName,
      date: lastDayOfMonth.toISOString().split('T')[0],
      accounts,
      totals: {
        openingBalance: 0,
        periodDebit: totalDebit,
        periodCredit: totalCredit,
        closingBalance: totalDebit - totalCredit,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generera SIE-export (förenklad)
   */
  async generateSIEExport(
    companyId: string,
    companyName: string,
    orgNumber: string,
    year: number,
    month: number
  ): Promise<string> {
    await this.loadAccountBalances(companyId, year, month);
    
    const lines: string[] = [];
    
    // SIE header
    lines.push('#FLAGGA 0');
    lines.push('#FORMAT PC8');
    lines.push('#SIETYP 4');
    lines.push('#PROGRAM "AIFM Bokföring" 1.0');
    lines.push(`#GEN ${new Date().toISOString().split('T')[0].replace(/-/g, '')}`);
    lines.push(`#FNAMN "${companyName}"`);
    lines.push(`#ORGNR ${orgNumber.replace(/-/g, '')}`);
    lines.push(`#RAR 0 ${year}0101 ${year}1231`);
    lines.push('#KPTYP BAS2015');
    
    // Kontoplan
    for (const [account, data] of this.accountBalances) {
      lines.push(`#KONTO ${account} "${data.name}"`);
    }
    
    // Saldon
    for (const [account, data] of this.accountBalances) {
      if (data.balance !== 0) {
        lines.push(`#IB 0 ${account} ${data.balance.toFixed(2)}`);
        lines.push(`#UB 0 ${account} ${data.balance.toFixed(2)}`);
      }
    }
    
    return lines.join('\n');
  }
}

export const closingReporter = new ClosingReporter();








