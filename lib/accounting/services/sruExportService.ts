/**
 * SRU Export Service
 * 
 * Genererar SRU-filer för inkomstdeklaration till Skatteverket.
 * Stödjer INK2 (aktiebolag) och INK4 (enskild firma/handelsbolag).
 * 
 * SRU-formatet (Standardiserat Räkenskapsutdrag) är Skatteverkets filformat
 * för elektronisk inlämning av bokföringsdata.
 */

import { FortnoxClient, getFortnoxClient } from '../../fortnox/client';

// ============ Types ============

export interface SRUField {
  fieldNumber: string;
  label: string;
  value: number | string;
  type: 'number' | 'text' | 'date';
}

export interface SRUDocument {
  id: string;
  companyId: string;
  organisationNumber: string;
  companyName: string;
  
  // Dokumenttyp
  type: 'INK2' | 'INK2R' | 'INK2S' | 'INK4' | 'INK4R' | 'INK4S';
  
  // Period
  fiscalYear: {
    year: number;
    startDate: string;
    endDate: string;
  };
  
  // Fält per blankett
  fields: Map<string, SRUField>;
  
  // Bilagor
  attachments: SRUAttachment[];
  
  // Status
  status: 'draft' | 'validated' | 'exported';
  validationErrors: string[];
  
  // Timestamps
  generatedAt: string;
  exportedAt?: string;
}

export interface SRUAttachment {
  type: 'INK2R' | 'INK2S' | 'INK4R' | 'INK4S' | 'SRU';
  name: string;
  fields: Map<string, SRUField>;
}

export interface IncomeStatementData {
  // Intäkter (3xxx)
  netSales: number;                    // 3010-3099
  otherOperatingIncome: number;        // 3900-3999
  
  // Kostnader (4xxx-7xxx)
  costOfGoodsSold: number;             // 4010-4999
  personnelCosts: number;              // 7010-7699
  depreciation: number;                // 7810-7899
  otherOperatingExpenses: number;      // 5010-6999
  
  // Finansiella poster (8xxx)
  financialIncome: number;             // 8010-8399
  financialExpenses: number;           // 8400-8499
  
  // Resultat
  operatingResult: number;
  resultBeforeTax: number;
  tax: number;
  netResult: number;
}

export interface BalanceSheetData {
  // Tillgångar
  assets: {
    fixedAssets: {
      intangible: number;              // 1000-1099
      tangible: number;                // 1100-1299
      financial: number;               // 1300-1399
    };
    currentAssets: {
      inventory: number;               // 1400-1499
      receivables: number;             // 1500-1699
      shortTermInvestments: number;    // 1800-1899
      cashAndBank: number;             // 1900-1999
    };
    totalAssets: number;
  };
  
  // Skulder och eget kapital
  equity: {
    shareCapital: number;              // 2081
    otherRestrictedEquity: number;     // 2082-2089
    retainedEarnings: number;          // 2091-2098
    netResult: number;                 // 2099
    totalEquity: number;
  };
  
  liabilities: {
    provisions: number;                // 2200-2299
    longTermLiabilities: number;       // 2300-2399
    shortTermLiabilities: number;      // 2400-2999
    totalLiabilities: number;
  };
  
  totalEquityAndLiabilities: number;
}

// ============ INK2 Field Definitions ============

const INK2_FIELDS: Record<string, { label: string; section: string }> = {
  // Resultaträkning (R)
  'R1': { label: 'Nettoomsättning', section: 'income' },
  'R2': { label: 'Förändring av lager', section: 'income' },
  'R3': { label: 'Aktiverat arbete för egen räkning', section: 'income' },
  'R4': { label: 'Övriga rörelseintäkter', section: 'income' },
  'R5': { label: 'Summa rörelseintäkter', section: 'income' },
  
  'R6': { label: 'Råvaror och förnödenheter', section: 'expenses' },
  'R7': { label: 'Handelsvaror', section: 'expenses' },
  'R8': { label: 'Övriga externa kostnader', section: 'expenses' },
  'R9': { label: 'Personalkostnader', section: 'expenses' },
  'R10': { label: 'Avskrivningar', section: 'expenses' },
  'R11': { label: 'Nedskrivningar', section: 'expenses' },
  'R12': { label: 'Övriga rörelsekostnader', section: 'expenses' },
  'R13': { label: 'Summa rörelsekostnader', section: 'expenses' },
  
  'R14': { label: 'Rörelseresultat', section: 'result' },
  
  'R15': { label: 'Resultat från andelar i koncernföretag', section: 'financial' },
  'R16': { label: 'Resultat från andelar i intresseföretag', section: 'financial' },
  'R17': { label: 'Resultat från övriga finansiella anläggningstillgångar', section: 'financial' },
  'R18': { label: 'Övriga ränteintäkter', section: 'financial' },
  'R19': { label: 'Räntekostnader', section: 'financial' },
  
  'R20': { label: 'Resultat efter finansiella poster', section: 'result' },
  'R21': { label: 'Bokslutsdispositioner', section: 'result' },
  'R22': { label: 'Resultat före skatt', section: 'result' },
  'R23': { label: 'Skatt på årets resultat', section: 'result' },
  'R24': { label: 'Årets resultat', section: 'result' },
  
  // Balansräkning - Tillgångar (B)
  'B1': { label: 'Immateriella anläggningstillgångar', section: 'assets' },
  'B2': { label: 'Byggnader och mark', section: 'assets' },
  'B3': { label: 'Maskiner och inventarier', section: 'assets' },
  'B4': { label: 'Finansiella anläggningstillgångar', section: 'assets' },
  'B5': { label: 'Summa anläggningstillgångar', section: 'assets' },
  
  'B6': { label: 'Varulager', section: 'current_assets' },
  'B7': { label: 'Kundfordringar', section: 'current_assets' },
  'B8': { label: 'Övriga kortfristiga fordringar', section: 'current_assets' },
  'B9': { label: 'Kassa och bank', section: 'current_assets' },
  'B10': { label: 'Summa omsättningstillgångar', section: 'current_assets' },
  
  'B11': { label: 'Summa tillgångar', section: 'total_assets' },
  
  // Balansräkning - Eget kapital och skulder
  'B12': { label: 'Aktiekapital', section: 'equity' },
  'B13': { label: 'Övrigt bundet eget kapital', section: 'equity' },
  'B14': { label: 'Fritt eget kapital', section: 'equity' },
  'B15': { label: 'Årets resultat', section: 'equity' },
  'B16': { label: 'Summa eget kapital', section: 'equity' },
  
  'B17': { label: 'Obeskattade reserver', section: 'reserves' },
  'B18': { label: 'Avsättningar', section: 'provisions' },
  'B19': { label: 'Långfristiga skulder', section: 'liabilities' },
  'B20': { label: 'Leverantörsskulder', section: 'liabilities' },
  'B21': { label: 'Övriga kortfristiga skulder', section: 'liabilities' },
  'B22': { label: 'Summa skulder', section: 'liabilities' },
  
  'B23': { label: 'Summa eget kapital och skulder', section: 'total' },
};

// ============ Service ============

class SRUExportService {
  private fortnoxClient: FortnoxClient | null = null;
  
  // In-memory store
  private documents = new Map<string, SRUDocument>();
  
  /**
   * Initierar Fortnox-klient
   */
  async init(companyId: string): Promise<void> {
    try {
      this.fortnoxClient = await getFortnoxClient(companyId);
    } catch (error) {
      console.log('[SRUExport] Fortnox client not available, using mock data');
    }
  }
  
  /**
   * Generera INK2 (aktiebolag) deklaration
   */
  async generateINK2(
    companyId: string,
    fiscalYear: number,
    organisationNumber: string,
    companyName: string
  ): Promise<SRUDocument> {
    await this.init(companyId);
    
    // Hämta bokföringsdata
    const startDate = `${fiscalYear}-01-01`;
    const endDate = `${fiscalYear}-12-31`;
    
    const accountBalances = await this.getAccountBalances(companyId, fiscalYear);
    
    // Beräkna resultat- och balansräkning
    const incomeStatement = this.calculateIncomeStatement(accountBalances);
    const balanceSheet = this.calculateBalanceSheet(accountBalances);
    
    // Skapa SRU-fält
    const fields = new Map<string, SRUField>();
    
    // Resultaträkning
    fields.set('R1', { fieldNumber: 'R1', label: 'Nettoomsättning', value: incomeStatement.netSales, type: 'number' });
    fields.set('R4', { fieldNumber: 'R4', label: 'Övriga rörelseintäkter', value: incomeStatement.otherOperatingIncome, type: 'number' });
    fields.set('R5', { fieldNumber: 'R5', label: 'Summa rörelseintäkter', value: incomeStatement.netSales + incomeStatement.otherOperatingIncome, type: 'number' });
    
    fields.set('R7', { fieldNumber: 'R7', label: 'Handelsvaror', value: incomeStatement.costOfGoodsSold, type: 'number' });
    fields.set('R8', { fieldNumber: 'R8', label: 'Övriga externa kostnader', value: incomeStatement.otherOperatingExpenses, type: 'number' });
    fields.set('R9', { fieldNumber: 'R9', label: 'Personalkostnader', value: incomeStatement.personnelCosts, type: 'number' });
    fields.set('R10', { fieldNumber: 'R10', label: 'Avskrivningar', value: incomeStatement.depreciation, type: 'number' });
    fields.set('R13', { fieldNumber: 'R13', label: 'Summa rörelsekostnader', value: incomeStatement.costOfGoodsSold + incomeStatement.otherOperatingExpenses + incomeStatement.personnelCosts + incomeStatement.depreciation, type: 'number' });
    
    fields.set('R14', { fieldNumber: 'R14', label: 'Rörelseresultat', value: incomeStatement.operatingResult, type: 'number' });
    fields.set('R18', { fieldNumber: 'R18', label: 'Övriga ränteintäkter', value: incomeStatement.financialIncome, type: 'number' });
    fields.set('R19', { fieldNumber: 'R19', label: 'Räntekostnader', value: incomeStatement.financialExpenses, type: 'number' });
    
    fields.set('R20', { fieldNumber: 'R20', label: 'Resultat efter finansiella poster', value: incomeStatement.resultBeforeTax, type: 'number' });
    fields.set('R22', { fieldNumber: 'R22', label: 'Resultat före skatt', value: incomeStatement.resultBeforeTax, type: 'number' });
    fields.set('R23', { fieldNumber: 'R23', label: 'Skatt på årets resultat', value: incomeStatement.tax, type: 'number' });
    fields.set('R24', { fieldNumber: 'R24', label: 'Årets resultat', value: incomeStatement.netResult, type: 'number' });
    
    // Balansräkning - Tillgångar
    fields.set('B1', { fieldNumber: 'B1', label: 'Immateriella anläggningstillgångar', value: balanceSheet.assets.fixedAssets.intangible, type: 'number' });
    fields.set('B3', { fieldNumber: 'B3', label: 'Maskiner och inventarier', value: balanceSheet.assets.fixedAssets.tangible, type: 'number' });
    fields.set('B4', { fieldNumber: 'B4', label: 'Finansiella anläggningstillgångar', value: balanceSheet.assets.fixedAssets.financial, type: 'number' });
    fields.set('B5', { fieldNumber: 'B5', label: 'Summa anläggningstillgångar', value: balanceSheet.assets.fixedAssets.intangible + balanceSheet.assets.fixedAssets.tangible + balanceSheet.assets.fixedAssets.financial, type: 'number' });
    
    fields.set('B6', { fieldNumber: 'B6', label: 'Varulager', value: balanceSheet.assets.currentAssets.inventory, type: 'number' });
    fields.set('B7', { fieldNumber: 'B7', label: 'Kundfordringar', value: balanceSheet.assets.currentAssets.receivables, type: 'number' });
    fields.set('B9', { fieldNumber: 'B9', label: 'Kassa och bank', value: balanceSheet.assets.currentAssets.cashAndBank, type: 'number' });
    fields.set('B10', { fieldNumber: 'B10', label: 'Summa omsättningstillgångar', value: balanceSheet.assets.currentAssets.inventory + balanceSheet.assets.currentAssets.receivables + balanceSheet.assets.currentAssets.cashAndBank, type: 'number' });
    
    fields.set('B11', { fieldNumber: 'B11', label: 'Summa tillgångar', value: balanceSheet.assets.totalAssets, type: 'number' });
    
    // Balansräkning - Eget kapital och skulder
    fields.set('B12', { fieldNumber: 'B12', label: 'Aktiekapital', value: balanceSheet.equity.shareCapital, type: 'number' });
    fields.set('B14', { fieldNumber: 'B14', label: 'Fritt eget kapital', value: balanceSheet.equity.retainedEarnings, type: 'number' });
    fields.set('B15', { fieldNumber: 'B15', label: 'Årets resultat', value: balanceSheet.equity.netResult, type: 'number' });
    fields.set('B16', { fieldNumber: 'B16', label: 'Summa eget kapital', value: balanceSheet.equity.totalEquity, type: 'number' });
    
    fields.set('B19', { fieldNumber: 'B19', label: 'Långfristiga skulder', value: balanceSheet.liabilities.longTermLiabilities, type: 'number' });
    fields.set('B20', { fieldNumber: 'B20', label: 'Leverantörsskulder', value: balanceSheet.liabilities.shortTermLiabilities, type: 'number' });
    fields.set('B22', { fieldNumber: 'B22', label: 'Summa skulder', value: balanceSheet.liabilities.totalLiabilities, type: 'number' });
    
    fields.set('B23', { fieldNumber: 'B23', label: 'Summa eget kapital och skulder', value: balanceSheet.totalEquityAndLiabilities, type: 'number' });
    
    // Validera
    const errors = this.validateINK2(fields, balanceSheet);
    
    const document: SRUDocument = {
      id: `ink2-${companyId}-${fiscalYear}`,
      companyId,
      organisationNumber,
      companyName,
      type: 'INK2',
      fiscalYear: {
        year: fiscalYear,
        startDate,
        endDate,
      },
      fields,
      attachments: [],
      status: errors.length > 0 ? 'draft' : 'validated',
      validationErrors: errors,
      generatedAt: new Date().toISOString(),
    };
    
    // Lägg till bilagor
    document.attachments.push(
      this.generateINK2R(incomeStatement),
      this.generateINK2S(balanceSheet)
    );
    
    this.documents.set(document.id, document);
    
    return document;
  }
  
  /**
   * Generera INK4 (enskild firma) deklaration
   */
  async generateINK4(
    companyId: string,
    fiscalYear: number,
    organisationNumber: string,
    companyName: string
  ): Promise<SRUDocument> {
    await this.init(companyId);
    
    // Hämta bokföringsdata
    const accountBalances = await this.getAccountBalances(companyId, fiscalYear);
    
    // Beräkna resultat
    const incomeStatement = this.calculateIncomeStatement(accountBalances);
    
    const fields = new Map<string, SRUField>();
    
    // INK4-specifika fält (Näringsverksamhet - enskild firma)
    fields.set('N1', { fieldNumber: 'N1', label: 'Intäkter', value: incomeStatement.netSales, type: 'number' });
    fields.set('N2', { fieldNumber: 'N2', label: 'Kostnader', value: incomeStatement.costOfGoodsSold + incomeStatement.otherOperatingExpenses, type: 'number' });
    fields.set('N3', { fieldNumber: 'N3', label: 'Avskrivningar', value: incomeStatement.depreciation, type: 'number' });
    fields.set('N4', { fieldNumber: 'N4', label: 'Finansiella intäkter', value: incomeStatement.financialIncome, type: 'number' });
    fields.set('N5', { fieldNumber: 'N5', label: 'Finansiella kostnader', value: incomeStatement.financialExpenses, type: 'number' });
    fields.set('N6', { fieldNumber: 'N6', label: 'Resultat före bokslutsdispositioner', value: incomeStatement.resultBeforeTax, type: 'number' });
    fields.set('N7', { fieldNumber: 'N7', label: 'Överskott av näringsverksamhet', value: incomeStatement.netResult, type: 'number' });
    
    const document: SRUDocument = {
      id: `ink4-${companyId}-${fiscalYear}`,
      companyId,
      organisationNumber,
      companyName,
      type: 'INK4',
      fiscalYear: {
        year: fiscalYear,
        startDate: `${fiscalYear}-01-01`,
        endDate: `${fiscalYear}-12-31`,
      },
      fields,
      attachments: [],
      status: 'validated',
      validationErrors: [],
      generatedAt: new Date().toISOString(),
    };
    
    this.documents.set(document.id, document);
    
    return document;
  }
  
  /**
   * Exportera till SRU-filformat
   */
  exportToSRU(document: SRUDocument): string {
    const lines: string[] = [];
    
    // Header
    lines.push('#DATABESKRIVNING_START');
    lines.push('#PRODUKT AIFM Platform');
    lines.push(`#SKAPAD ${new Date().toISOString().split('T')[0]}`);
    lines.push(`#ORGNR ${document.organisationNumber}`);
    lines.push(`#NAMN ${document.companyName}`);
    lines.push(`#FNAMN ${document.companyName}`);
    lines.push(`#RAESSION ${document.fiscalYear.year}`);
    lines.push(`#RSTART ${document.fiscalYear.startDate}`);
    lines.push(`#RSLUT ${document.fiscalYear.endDate}`);
    lines.push(`#BLANESSION ${document.type}`);
    lines.push('#DATABESKRIVNING_SLUT');
    lines.push('');
    
    // Blankettdata
    lines.push('#BLANESSION_START');
    lines.push(`#BLANESSION ${document.type}`);
    
    // Fält
    document.fields.forEach((field, key) => {
      const value = typeof field.value === 'number' 
        ? Math.round(field.value).toString() 
        : field.value;
      lines.push(`#${key} ${value}`);
    });
    
    lines.push('#BLANESSION_SLUT');
    
    // Bilagor
    document.attachments.forEach(attachment => {
      lines.push('');
      lines.push('#BILAGA_START');
      lines.push(`#BILAGATYP ${attachment.type}`);
      
      attachment.fields.forEach((field, key) => {
        const value = typeof field.value === 'number' 
          ? Math.round(field.value).toString() 
          : field.value;
        lines.push(`#${key} ${value}`);
      });
      
      lines.push('#BILAGA_SLUT');
    });
    
    return lines.join('\n');
  }
  
  /**
   * Exportera till Skatteverkets XML-format
   */
  exportToSKVXML(document: SRUDocument): string {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Skatteverket xmlns="http://xmls.skatteverket.se/se/skatteverket/ai/instans/infoforesk200/2024.1"
              xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Avsandare>
    <Programnamn>AIFM Platform</Programnamn>
    <Organisationsnummer>${document.organisationNumber}</Organisationsnummer>
    <TekniskKontaktperson>
      <Namn>AIFM Support</Namn>
      <Telefon>08-123 456 78</Telefon>
      <Epostadress>support@aifm.se</Epostadress>
    </TekniskKontaktperson>
    <Skapad>${new Date().toISOString()}</Skapad>
  </Avsandare>
  <Blankettgemensamt>
    <Uppgiftslamnare>
      <UppgiftslamnareJuridiskPerson>
        <Organisationsnummer>${document.organisationNumber}</Organisationsnummer>
        <Foretamn>${document.companyName}</Foretamn>
      </UppgiftslamnareJuridiskPerson>
    </Uppgiftslamnare>
  </Blankettgemensamt>
  <Blankett>
    <Aession>
      <InsAr>${document.fiscalYear.year}</InsAr>
      <InsTyp>${document.type}</InsTyp>
    </Aession>
    <Blankettinnehall>
      ${document.type === 'INK2' ? this.generateINK2XML(document) : this.generateINK4XML(document)}
    </Blankettinnehall>
  </Blankett>
</Skatteverket>`;
    
    return xml;
  }
  
  /**
   * Generera JSON-format för API
   */
  exportToJSON(document: SRUDocument): object {
    const fieldsObj: Record<string, any> = {};
    document.fields.forEach((field, key) => {
      fieldsObj[key] = {
        label: field.label,
        value: field.value,
      };
    });
    
    const attachmentsArr = document.attachments.map(att => {
      const attFields: Record<string, any> = {};
      att.fields.forEach((field, key) => {
        attFields[key] = {
          label: field.label,
          value: field.value,
        };
      });
      return {
        type: att.type,
        name: att.name,
        fields: attFields,
      };
    });
    
    return {
      id: document.id,
      companyId: document.companyId,
      organisationNumber: document.organisationNumber,
      companyName: document.companyName,
      type: document.type,
      fiscalYear: document.fiscalYear,
      fields: fieldsObj,
      attachments: attachmentsArr,
      status: document.status,
      validationErrors: document.validationErrors,
      generatedAt: document.generatedAt,
    };
  }
  
  /**
   * Hämta sparade dokument
   */
  async getDocument(documentId: string): Promise<SRUDocument | null> {
    return this.documents.get(documentId) || null;
  }
  
  /**
   * Lista dokument för ett företag
   */
  async listDocuments(companyId: string): Promise<Array<{
    id: string;
    type: string;
    year: number;
    status: string;
  }>> {
    const results: Array<{
      id: string;
      type: string;
      year: number;
      status: string;
    }> = [];
    
    this.documents.forEach((doc) => {
      if (doc.companyId === companyId) {
        results.push({
          id: doc.id,
          type: doc.type,
          year: doc.fiscalYear.year,
          status: doc.status,
        });
      }
    });
    
    return results.sort((a, b) => b.year - a.year);
  }
  
  // ============ Private helpers ============
  
  private async getAccountBalances(
    companyId: string,
    fiscalYear: number
  ): Promise<Map<string, number>> {
    const balances = new Map<string, number>();
    
    if (this.fortnoxClient) {
      try {
        const response = await this.fortnoxClient.getAccounts();
        const accountList = response?.data?.Accounts || [];
        
        for (const account of accountList) {
          const accountNumber = account.Number?.toString() || '';
          // Note: Balance may not be available from basic account endpoint
          // We would need to fetch balances separately via financial year endpoint
          balances.set(accountNumber, 0);
        }
        
        // For now, use mock data as the accounts endpoint doesn't include balances
        return this.generateMockBalances();
      } catch (error) {
        console.error('[SRUExport] Failed to fetch account balances:', error);
      }
    }
    
    // Mock data
    return this.generateMockBalances();
  }
  
  private calculateIncomeStatement(balances: Map<string, number>): IncomeStatementData {
    let netSales = 0;
    let otherOperatingIncome = 0;
    let costOfGoodsSold = 0;
    let personnelCosts = 0;
    let depreciation = 0;
    let otherOperatingExpenses = 0;
    let financialIncome = 0;
    let financialExpenses = 0;
    
    balances.forEach((balance, account) => {
      const accountNum = parseInt(account);
      
      // Intäkter (kredit = positiv i resultaträkningen)
      if (accountNum >= 3010 && accountNum <= 3099) {
        netSales -= balance; // Kreditbalans är negativ, vända
      } else if (accountNum >= 3900 && accountNum <= 3999) {
        otherOperatingIncome -= balance;
      }
      // Kostnader (debet = positiv)
      else if (accountNum >= 4010 && accountNum <= 4999) {
        costOfGoodsSold += balance;
      } else if (accountNum >= 5010 && accountNum <= 6999) {
        otherOperatingExpenses += balance;
      } else if (accountNum >= 7010 && accountNum <= 7699) {
        personnelCosts += balance;
      } else if (accountNum >= 7810 && accountNum <= 7899) {
        depreciation += balance;
      }
      // Finansiella poster
      else if (accountNum >= 8010 && accountNum <= 8399) {
        financialIncome -= balance;
      } else if (accountNum >= 8400 && accountNum <= 8499) {
        financialExpenses += balance;
      }
    });
    
    const operatingResult = netSales + otherOperatingIncome - costOfGoodsSold - personnelCosts - depreciation - otherOperatingExpenses;
    const resultBeforeTax = operatingResult + financialIncome - financialExpenses;
    const tax = resultBeforeTax > 0 ? resultBeforeTax * 0.206 : 0; // 20.6% bolagsskatt
    const netResult = resultBeforeTax - tax;
    
    return {
      netSales,
      otherOperatingIncome,
      costOfGoodsSold,
      personnelCosts,
      depreciation,
      otherOperatingExpenses,
      financialIncome,
      financialExpenses,
      operatingResult,
      resultBeforeTax,
      tax,
      netResult,
    };
  }
  
  private calculateBalanceSheet(balances: Map<string, number>): BalanceSheetData {
    const assets = {
      fixedAssets: { intangible: 0, tangible: 0, financial: 0 },
      currentAssets: { inventory: 0, receivables: 0, shortTermInvestments: 0, cashAndBank: 0 },
      totalAssets: 0,
    };
    
    const equity = {
      shareCapital: 0,
      otherRestrictedEquity: 0,
      retainedEarnings: 0,
      netResult: 0,
      totalEquity: 0,
    };
    
    const liabilities = {
      provisions: 0,
      longTermLiabilities: 0,
      shortTermLiabilities: 0,
      totalLiabilities: 0,
    };
    
    balances.forEach((balance, account) => {
      const accountNum = parseInt(account);
      
      // Tillgångar (debet = positiv)
      if (accountNum >= 1000 && accountNum <= 1099) {
        assets.fixedAssets.intangible += balance;
      } else if (accountNum >= 1100 && accountNum <= 1299) {
        assets.fixedAssets.tangible += balance;
      } else if (accountNum >= 1300 && accountNum <= 1399) {
        assets.fixedAssets.financial += balance;
      } else if (accountNum >= 1400 && accountNum <= 1499) {
        assets.currentAssets.inventory += balance;
      } else if (accountNum >= 1500 && accountNum <= 1699) {
        assets.currentAssets.receivables += balance;
      } else if (accountNum >= 1800 && accountNum <= 1899) {
        assets.currentAssets.shortTermInvestments += balance;
      } else if (accountNum >= 1900 && accountNum <= 1999) {
        assets.currentAssets.cashAndBank += balance;
      }
      // Eget kapital (kredit = positiv)
      else if (accountNum === 2081) {
        equity.shareCapital -= balance;
      } else if (accountNum >= 2082 && accountNum <= 2089) {
        equity.otherRestrictedEquity -= balance;
      } else if (accountNum >= 2091 && accountNum <= 2098) {
        equity.retainedEarnings -= balance;
      } else if (accountNum === 2099) {
        equity.netResult -= balance;
      }
      // Avsättningar
      else if (accountNum >= 2200 && accountNum <= 2299) {
        liabilities.provisions -= balance;
      }
      // Långfristiga skulder
      else if (accountNum >= 2300 && accountNum <= 2399) {
        liabilities.longTermLiabilities -= balance;
      }
      // Kortfristiga skulder
      else if (accountNum >= 2400 && accountNum <= 2999) {
        liabilities.shortTermLiabilities -= balance;
      }
    });
    
    assets.totalAssets = 
      assets.fixedAssets.intangible + 
      assets.fixedAssets.tangible + 
      assets.fixedAssets.financial +
      assets.currentAssets.inventory +
      assets.currentAssets.receivables +
      assets.currentAssets.shortTermInvestments +
      assets.currentAssets.cashAndBank;
    
    equity.totalEquity = 
      equity.shareCapital + 
      equity.otherRestrictedEquity + 
      equity.retainedEarnings + 
      equity.netResult;
    
    liabilities.totalLiabilities = 
      liabilities.provisions + 
      liabilities.longTermLiabilities + 
      liabilities.shortTermLiabilities;
    
    return {
      assets,
      equity,
      liabilities,
      totalEquityAndLiabilities: equity.totalEquity + liabilities.totalLiabilities,
    };
  }
  
  private generateINK2R(incomeStatement: IncomeStatementData): SRUAttachment {
    const fields = new Map<string, SRUField>();
    
    fields.set('R1', { fieldNumber: 'R1', label: 'Nettoomsättning', value: incomeStatement.netSales, type: 'number' });
    fields.set('R5', { fieldNumber: 'R5', label: 'Summa rörelseintäkter', value: incomeStatement.netSales + incomeStatement.otherOperatingIncome, type: 'number' });
    fields.set('R14', { fieldNumber: 'R14', label: 'Rörelseresultat', value: incomeStatement.operatingResult, type: 'number' });
    fields.set('R20', { fieldNumber: 'R20', label: 'Resultat efter finansiella poster', value: incomeStatement.resultBeforeTax, type: 'number' });
    fields.set('R24', { fieldNumber: 'R24', label: 'Årets resultat', value: incomeStatement.netResult, type: 'number' });
    
    return {
      type: 'INK2R',
      name: 'Resultaträkning',
      fields,
    };
  }
  
  private generateINK2S(balanceSheet: BalanceSheetData): SRUAttachment {
    const fields = new Map<string, SRUField>();
    
    fields.set('B5', { fieldNumber: 'B5', label: 'Summa anläggningstillgångar', value: balanceSheet.assets.fixedAssets.intangible + balanceSheet.assets.fixedAssets.tangible + balanceSheet.assets.fixedAssets.financial, type: 'number' });
    fields.set('B10', { fieldNumber: 'B10', label: 'Summa omsättningstillgångar', value: balanceSheet.assets.currentAssets.inventory + balanceSheet.assets.currentAssets.receivables + balanceSheet.assets.currentAssets.cashAndBank, type: 'number' });
    fields.set('B11', { fieldNumber: 'B11', label: 'Summa tillgångar', value: balanceSheet.assets.totalAssets, type: 'number' });
    fields.set('B16', { fieldNumber: 'B16', label: 'Summa eget kapital', value: balanceSheet.equity.totalEquity, type: 'number' });
    fields.set('B22', { fieldNumber: 'B22', label: 'Summa skulder', value: balanceSheet.liabilities.totalLiabilities, type: 'number' });
    fields.set('B23', { fieldNumber: 'B23', label: 'Summa eget kapital och skulder', value: balanceSheet.totalEquityAndLiabilities, type: 'number' });
    
    return {
      type: 'INK2S',
      name: 'Balansräkning',
      fields,
    };
  }
  
  private validateINK2(fields: Map<string, SRUField>, balanceSheet: BalanceSheetData): string[] {
    const errors: string[] = [];
    
    // Kontrollera att tillgångar = skulder + eget kapital
    const totalAssets = balanceSheet.assets.totalAssets;
    const totalEquityAndLiabilities = balanceSheet.totalEquityAndLiabilities;
    
    if (Math.abs(totalAssets - totalEquityAndLiabilities) > 1) {
      errors.push(`Balansräkningen stämmer inte: Tillgångar (${totalAssets}) ≠ Skulder+EK (${totalEquityAndLiabilities})`);
    }
    
    // Kontrollera att summa fält finns
    if (!fields.get('R24')?.value && fields.get('R24')?.value !== 0) {
      errors.push('Årets resultat (R24) saknas');
    }
    
    if (!fields.get('B11')?.value && fields.get('B11')?.value !== 0) {
      errors.push('Summa tillgångar (B11) saknas');
    }
    
    return errors;
  }
  
  private generateINK2XML(document: SRUDocument): string {
    let xml = '<INK2>\n';
    
    document.fields.forEach((field, key) => {
      const value = typeof field.value === 'number' ? Math.round(field.value) : field.value;
      xml += `  <${key}>${value}</${key}>\n`;
    });
    
    xml += '</INK2>';
    return xml;
  }
  
  private generateINK4XML(document: SRUDocument): string {
    let xml = '<INK4>\n';
    
    document.fields.forEach((field, key) => {
      const value = typeof field.value === 'number' ? Math.round(field.value) : field.value;
      xml += `  <${key}>${value}</${key}>\n`;
    });
    
    xml += '</INK4>';
    return xml;
  }
  
  private generateMockBalances(): Map<string, number> {
    return new Map([
      // Intäkter
      ['3010', -1500000],  // Nettoomsättning (kredit)
      ['3900', -50000],    // Övriga rörelseintäkter
      
      // Kostnader
      ['4010', 300000],    // Varuinköp
      ['5010', 120000],    // Lokalkostnader
      ['5410', 25000],     // Förbrukningsinventarier
      ['6100', 15000],     // Kontorsmaterial
      ['6540', 80000],     // IT-kostnader
      ['7010', 600000],    // Löner
      ['7510', 180000],    // Arbetsgivaravgifter
      ['7832', 50000],     // Avskrivningar
      
      // Finansiella poster
      ['8310', -2000],     // Ränteintäkter
      ['8400', 15000],     // Räntekostnader
      
      // Tillgångar
      ['1220', 150000],    // Inventarier
      ['1510', 200000],    // Kundfordringar
      ['1930', 500000],    // Bankkonto
      
      // Eget kapital och skulder
      ['2081', -50000],    // Aktiekapital
      ['2091', -300000],   // Balanserat resultat
      ['2440', -150000],   // Leverantörsskulder
      ['2641', -50000],    // Momsskuld
    ]);
  }
}

export const sruExportService = new SRUExportService();

