/**
 * Kontoplan Validator
 * 
 * Validerar att valda konton är korrekta för transaktionstypen.
 * Kontrollerar:
 * - Att kontot finns i BAS-kontoplanen
 * - Att kontotyp matchar transaktion (kostnad/intäkt/tillgång/skuld)
 * - Att debet/kredit-regler följs
 * - Att motkonton är korrekta
 */

import { allaKonton, BASKonto } from '../basKontoplan';

// ============ Types ============

export type TransactionType = 
  | 'PURCHASE_INVOICE'    // Leverantörsfaktura
  | 'PURCHASE_RECEIPT'    // Kvitto/utlägg
  | 'SALES_INVOICE'       // Kundfaktura
  | 'SALARY'              // Lön
  | 'BANK_PAYMENT'        // Bankbetalning
  | 'BANK_RECEIPT'        // Bankinbetalning
  | 'JOURNAL'             // Manuell verifikation
  | 'DEPRECIATION'        // Avskrivning
  | 'ACCRUAL'             // Periodisering
  | 'VAT_REPORT';         // Momsredovisning

export interface AccountValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: AccountSuggestion[];
}

export interface ValidationError {
  code: string;
  message: string;
  field: string;
  account?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field: string;
  suggestion?: string;
}

export interface AccountSuggestion {
  account: string;
  name: string;
  reason: string;
  confidence: number;
}

export interface VoucherRow {
  account: string;
  debit: number;
  credit: number;
  description?: string;
  costCenter?: string;
  project?: string;
}

// ============ Account Class Rules ============

// Kontoklass 1: Tillgångar (debet ökar)
// Kontoklass 2: Eget kapital och skulder (kredit ökar)
// Kontoklass 3: Intäkter (kredit ökar)
// Kontoklass 4-7: Kostnader (debet ökar)
// Kontoklass 8: Finansiella poster

const ACCOUNT_CLASS_RULES: Record<string, {
  name: string;
  normalSide: 'debit' | 'credit';
  allowedTransactions: TransactionType[];
}> = {
  '1': {
    name: 'Tillgångar',
    normalSide: 'debit',
    allowedTransactions: ['PURCHASE_INVOICE', 'PURCHASE_RECEIPT', 'BANK_PAYMENT', 'BANK_RECEIPT', 'JOURNAL'],
  },
  '2': {
    name: 'Eget kapital och skulder',
    normalSide: 'credit',
    allowedTransactions: ['PURCHASE_INVOICE', 'SALES_INVOICE', 'SALARY', 'BANK_PAYMENT', 'VAT_REPORT', 'JOURNAL'],
  },
  '3': {
    name: 'Intäkter',
    normalSide: 'credit',
    allowedTransactions: ['SALES_INVOICE', 'BANK_RECEIPT', 'JOURNAL'],
  },
  '4': {
    name: 'Varuinköp och material',
    normalSide: 'debit',
    allowedTransactions: ['PURCHASE_INVOICE', 'PURCHASE_RECEIPT', 'JOURNAL'],
  },
  '5': {
    name: 'Övriga externa kostnader',
    normalSide: 'debit',
    allowedTransactions: ['PURCHASE_INVOICE', 'PURCHASE_RECEIPT', 'JOURNAL'],
  },
  '6': {
    name: 'Övriga externa kostnader',
    normalSide: 'debit',
    allowedTransactions: ['PURCHASE_INVOICE', 'PURCHASE_RECEIPT', 'JOURNAL'],
  },
  '7': {
    name: 'Personalkostnader',
    normalSide: 'debit',
    allowedTransactions: ['SALARY', 'PURCHASE_INVOICE', 'JOURNAL'],
  },
  '8': {
    name: 'Finansiella poster',
    normalSide: 'debit', // Varies
    allowedTransactions: ['BANK_PAYMENT', 'BANK_RECEIPT', 'JOURNAL'],
  },
};

// Specifika kontoregler
const SPECIFIC_ACCOUNT_RULES: Record<string, {
  description: string;
  mustHaveCounterAccount?: string[];
  cannotBeUsedWith?: string[];
  requiresCostCenter?: boolean;
  maxAmount?: number;
}> = {
  // Kassa och bank
  '1910': { description: 'Kassa', maxAmount: 10000 }, // Kontantgräns
  '1930': { description: 'Företagskonto', mustHaveCounterAccount: ['2440', '2710', '2730'] },
  
  // Kundfordringar
  '1510': { description: 'Kundfordringar', mustHaveCounterAccount: ['3010', '3011', '3040'] },
  
  // Leverantörsskulder
  '2440': { description: 'Leverantörsskulder', mustHaveCounterAccount: ['1930', '4010', '5010', '5410', '5800', '6100'] },
  
  // Moms
  '2610': { description: 'Utgående moms 25%' },
  '2620': { description: 'Utgående moms 12%' },
  '2630': { description: 'Utgående moms 6%' },
  '2640': { description: 'Ingående moms' },
  '2650': { description: 'Redovisningskonto moms' },
  
  // Skatter
  '2710': { description: 'Personalskatt' },
  '2730': { description: 'Arbetsgivaravgifter' },
  
  // Representation (kräver kostnadsställe)
  '5860': { description: 'Representation', requiresCostCenter: true, maxAmount: 1200 }, // 90kr/person lunch
  '5890': { description: 'Övrig representation', requiresCostCenter: true },
  
  // Personalkostnader
  '7010': { description: 'Löner', mustHaveCounterAccount: ['2710', '2730', '1930'] },
  '7510': { description: 'Arbetsgivaravgifter', mustHaveCounterAccount: ['2730'] },
};

// ============ Main Validation Function ============

export function validateVoucher(
  rows: VoucherRow[],
  transactionType: TransactionType,
  options?: {
    strictMode?: boolean;
    allowNegative?: boolean;
  }
): AccountValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: AccountSuggestion[] = [];
  const { strictMode = false, allowNegative = false } = options || {};

  // 1. Kontrollera att verifikationen balanserar
  const totalDebit = rows.reduce((sum, r) => sum + (r.debit || 0), 0);
  const totalCredit = rows.reduce((sum, r) => sum + (r.credit || 0), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    errors.push({
      code: 'UNBALANCED',
      message: `Verifikationen balanserar inte. Debet: ${totalDebit.toFixed(2)}, Kredit: ${totalCredit.toFixed(2)}, Differens: ${(totalDebit - totalCredit).toFixed(2)}`,
      field: 'total',
    });
  }

  // 2. Validera varje rad
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors = validateAccountRow(row, transactionType, i, strictMode);
    errors.push(...rowErrors.errors);
    warnings.push(...rowErrors.warnings);
  }

  // 3. Kontrollera kontokombinationer
  const accountNumbers = rows.map(r => r.account);
  const combinationResult = validateAccountCombinations(accountNumbers, transactionType);
  errors.push(...combinationResult.errors);
  warnings.push(...combinationResult.warnings);
  suggestions.push(...combinationResult.suggestions);

  // 4. Kontrollera belopp
  if (!allowNegative) {
    rows.forEach((row, i) => {
      if (row.debit < 0 || row.credit < 0) {
        errors.push({
          code: 'NEGATIVE_AMOUNT',
          message: 'Negativa belopp är inte tillåtna',
          field: `rows[${i}]`,
          account: row.account,
        });
      }
    });
  }

  // 5. Kontrollera maxbelopp för specifika konton
  rows.forEach((row, i) => {
    const rule = SPECIFIC_ACCOUNT_RULES[row.account];
    if (rule?.maxAmount) {
      const amount = row.debit || row.credit;
      if (amount > rule.maxAmount) {
        warnings.push({
          code: 'AMOUNT_EXCEEDS_LIMIT',
          message: `Beloppet ${amount} överstiger normalgräns ${rule.maxAmount} för ${rule.description}`,
          field: `rows[${i}]`,
          suggestion: 'Kontrollera att beloppet är korrekt',
        });
      }
    }
  });

  // 6. Kontrollera kostnadsställe där det krävs
  rows.forEach((row, i) => {
    const rule = SPECIFIC_ACCOUNT_RULES[row.account];
    if (rule?.requiresCostCenter && !row.costCenter) {
      warnings.push({
        code: 'MISSING_COST_CENTER',
        message: `Konto ${row.account} (${rule.description}) bör ha kostnadsställe`,
        field: `rows[${i}].costCenter`,
        suggestion: 'Lägg till kostnadsställe för bättre uppföljning',
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

// ============ Row Validation ============

function validateAccountRow(
  row: VoucherRow,
  transactionType: TransactionType,
  rowIndex: number,
  strictMode: boolean
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  // 1. Kontrollera att kontot finns
  const account = findAccount(row.account);
  if (!account) {
    errors.push({
      code: 'INVALID_ACCOUNT',
      message: `Konto ${row.account} finns inte i kontoplanen`,
      field: `rows[${rowIndex}].account`,
      account: row.account,
    });
    return { errors, warnings };
  }

  // 2. Kontrollera kontoklass
  const accountClass = row.account.charAt(0);
  const classRule = ACCOUNT_CLASS_RULES[accountClass];
  
  if (classRule && strictMode) {
    // Kontrollera om transaktionstypen är tillåten för denna kontoklass
    if (!classRule.allowedTransactions.includes(transactionType)) {
      warnings.push({
        code: 'UNUSUAL_ACCOUNT_CLASS',
        message: `Kontoklass ${accountClass} (${classRule.name}) används normalt inte för ${getTransactionTypeName(transactionType)}`,
        field: `rows[${rowIndex}].account`,
        suggestion: `Överväg ett konto i klass ${getSuggestedAccountClass(transactionType)}`,
      });
    }
  }

  // 3. Kontrollera debet/kredit på rätt sida
  if (classRule) {
    const hasDebit = row.debit > 0;
    const hasCredit = row.credit > 0;
    
    // Normalt ska tillgångar/kostnader debiteras, skulder/intäkter krediteras
    // Men vid t.ex. betalning av faktura är det tvärtom
    if (strictMode) {
      if (classRule.normalSide === 'debit' && hasCredit && !hasDebit) {
        // Kredit på normalt debetkonto - ok vid betalning
        if (!['BANK_PAYMENT', 'BANK_RECEIPT'].includes(transactionType)) {
          warnings.push({
            code: 'UNUSUAL_SIDE',
            message: `Konto ${row.account} krediteras normalt inte (förutom vid betalningar)`,
            field: `rows[${rowIndex}]`,
          });
        }
      }
    }
  }

  // 4. Kontrollera att endast debet ELLER kredit är ifyllt
  if (row.debit > 0 && row.credit > 0) {
    errors.push({
      code: 'BOTH_SIDES',
      message: 'En rad kan inte ha både debet och kredit',
      field: `rows[${rowIndex}]`,
      account: row.account,
    });
  }

  // 5. Kontrollera att minst ett belopp finns
  if (row.debit === 0 && row.credit === 0) {
    errors.push({
      code: 'NO_AMOUNT',
      message: 'Raden saknar belopp',
      field: `rows[${rowIndex}]`,
      account: row.account,
    });
  }

  return { errors, warnings };
}

// ============ Combination Validation ============

function validateAccountCombinations(
  accounts: string[],
  transactionType: TransactionType
): { errors: ValidationError[]; warnings: ValidationWarning[]; suggestions: AccountSuggestion[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: AccountSuggestion[] = [];

  // Kontrollera motkonton
  accounts.forEach(account => {
    const rule = SPECIFIC_ACCOUNT_RULES[account];
    if (rule?.mustHaveCounterAccount) {
      const hasRequiredCounter = rule.mustHaveCounterAccount.some(counter => 
        accounts.includes(counter)
      );
      
      if (!hasRequiredCounter) {
        warnings.push({
          code: 'MISSING_COUNTER_ACCOUNT',
          message: `Konto ${account} (${rule.description}) saknar normalt motkonto`,
          field: 'accounts',
          suggestion: `Förväntat motkonto: ${rule.mustHaveCounterAccount.join(' eller ')}`,
        });
      }
    }
  });

  // Föreslå saknade konton baserat på transaktionstyp
  if (transactionType === 'PURCHASE_INVOICE') {
    // Leverantörsfaktura ska ha: kostnadskonto + moms + leverantörsskuld
    if (!accounts.some(a => a.startsWith('24'))) {
      suggestions.push({
        account: '2440',
        name: 'Leverantörsskulder',
        reason: 'Leverantörsfakturor bokas normalt mot leverantörsskulder',
        confidence: 0.9,
      });
    }
    if (!accounts.some(a => a.startsWith('264'))) {
      suggestions.push({
        account: '2640',
        name: 'Ingående moms',
        reason: 'Ingående moms ska bokföras på fakturor med moms',
        confidence: 0.8,
      });
    }
  }

  if (transactionType === 'SALARY') {
    // Lön ska ha: lönekonto + skattekonto + AG-avgifter + bank
    const requiredAccounts = ['7010', '2710', '7510', '2730'];
    requiredAccounts.forEach(reqAccount => {
      if (!accounts.includes(reqAccount)) {
        const accountInfo = findAccount(reqAccount);
        suggestions.push({
          account: reqAccount,
          name: accountInfo?.namn || reqAccount,
          reason: 'Obligatoriskt konto för lönebokföring',
          confidence: 0.95,
        });
      }
    });
  }

  return { errors, warnings, suggestions };
}

// ============ Helpers ============

function findAccount(accountNumber: string): BASKonto | undefined {
  return allaKonton.find(a => a.konto === accountNumber);
}

function getTransactionTypeName(type: TransactionType): string {
  const names: Record<TransactionType, string> = {
    PURCHASE_INVOICE: 'leverantörsfaktura',
    PURCHASE_RECEIPT: 'kvitto/utlägg',
    SALES_INVOICE: 'kundfaktura',
    SALARY: 'lön',
    BANK_PAYMENT: 'bankbetalning',
    BANK_RECEIPT: 'bankinbetalning',
    JOURNAL: 'manuell verifikation',
    DEPRECIATION: 'avskrivning',
    ACCRUAL: 'periodisering',
    VAT_REPORT: 'momsredovisning',
  };
  return names[type] || type;
}

function getSuggestedAccountClass(type: TransactionType): string {
  const suggestions: Record<TransactionType, string> = {
    PURCHASE_INVOICE: '4-6 (kostnader)',
    PURCHASE_RECEIPT: '4-6 (kostnader)',
    SALES_INVOICE: '3 (intäkter)',
    SALARY: '7 (personalkostnader)',
    BANK_PAYMENT: '1 (tillgångar) eller 2 (skulder)',
    BANK_RECEIPT: '1 (tillgångar)',
    JOURNAL: 'valfri',
    DEPRECIATION: '7 (avskrivningar)',
    ACCRUAL: '1 eller 2 (periodiseringar)',
    VAT_REPORT: '2 (moms)',
  };
  return suggestions[type] || 'okänd';
}

// ============ Quick Validation ============

/**
 * Snabb validering av ett enskilt konto
 */
export function isValidAccount(accountNumber: string): boolean {
  return allaKonton.some(a => a.konto === accountNumber);
}

/**
 * Hämta kontoinformation
 */
export function getAccountInfo(accountNumber: string): BASKonto | null {
  return findAccount(accountNumber) || null;
}

/**
 * Föreslå konton baserat på beskrivning
 */
export function suggestAccountsForDescription(
  description: string,
  transactionType: TransactionType
): AccountSuggestion[] {
  const suggestions: AccountSuggestion[] = [];
  const lowerDesc = description.toLowerCase();

  // Nyckelordsmatchning
  const keywords: Record<string, { account: string; keywords: string[] }[]> = {
    PURCHASE_INVOICE: [
      { account: '4010', keywords: ['varor', 'lager', 'inköp'] },
      { account: '5010', keywords: ['hyra', 'lokal', 'kontor'] },
      { account: '5410', keywords: ['inventarier', 'möbler', 'utrustning'] },
      { account: '5460', keywords: ['förbrukning', 'material'] },
      { account: '5800', keywords: ['resa', 'hotell', 'flyg', 'tåg'] },
      { account: '5860', keywords: ['representation', 'lunch', 'middag', 'fika'] },
      { account: '6100', keywords: ['kontorsmaterial', 'papper', 'pennor'] },
      { account: '6200', keywords: ['telefon', 'mobil', 'bredband'] },
      { account: '6530', keywords: ['redovisning', 'bokföring', 'revision'] },
      { account: '6540', keywords: ['it', 'mjukvara', 'licens', 'saas'] },
    ],
    PURCHASE_RECEIPT: [
      { account: '5460', keywords: ['material', 'förbrukning'] },
      { account: '5800', keywords: ['taxi', 'parkering', 'bensin'] },
      { account: '5860', keywords: ['lunch', 'fika', 'restaurang'] },
      { account: '6100', keywords: ['kontorsmaterial'] },
    ],
  };

  const typeKeywords = keywords[transactionType] || keywords.PURCHASE_INVOICE;
  
  for (const rule of typeKeywords) {
    const matchCount = rule.keywords.filter(kw => lowerDesc.includes(kw)).length;
    if (matchCount > 0) {
      const accountInfo = findAccount(rule.account);
      if (accountInfo) {
        suggestions.push({
          account: rule.account,
          name: accountInfo.namn,
          reason: `Matchar nyckelord: ${rule.keywords.filter(kw => lowerDesc.includes(kw)).join(', ')}`,
          confidence: Math.min(0.9, 0.5 + matchCount * 0.2),
        });
      }
    }
  }

  // Sortera efter confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}















