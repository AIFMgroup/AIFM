/**
 * Validation Service
 * 
 * Validerar all bokföringsdata innan den skickas till Fortnox.
 * Säkerställer att verifikationer är korrekta och balanserade.
 */

import { Classification, LineItem } from '../jobStore';
import { FortnoxMapping, VoucherLine } from '../agents/fortnoxMapper';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  autoFixable: AutoFix[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  suggestion?: string;
}

export interface AutoFix {
  code: string;
  description: string;
  apply: () => void;
}

// Svenska helgdagar och kända datum
const SWEDISH_HOLIDAYS_2024 = [
  '2024-01-01', '2024-01-06', '2024-03-29', '2024-03-31',
  '2024-04-01', '2024-05-01', '2024-05-09', '2024-05-19',
  '2024-06-06', '2024-06-21', '2024-06-22', '2024-11-02',
  '2024-12-24', '2024-12-25', '2024-12-26', '2024-12-31',
];

// Giltiga momssatser i Sverige
const VALID_VAT_RATES = [0, 6, 12, 25];

// Konton som kräver motkonto
const ACCOUNT_RULES: Record<string, { requiresCounter: string[]; description: string }> = {
  '1930': { requiresCounter: ['2440', '2641', '2645'], description: 'Bankkonto kräver momsbelopp eller leverantörsskuld' },
  '2440': { requiresCounter: ['1930', '1910'], description: 'Leverantörsskuld kräver likvida medel' },
};

/**
 * Validera en klassificering innan Fortnox-synk
 */
export function validateClassification(
  classification: Classification,
  companyFiscalYear?: { start: string; end: string }
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const autoFixable: AutoFix[] = [];
  const isCreditNote = (classification as any).docType === 'CREDIT_NOTE';

  // 1. Validera leverantör
  if (!classification.supplier || classification.supplier.trim().length < 2) {
    errors.push({
      code: 'SUPPLIER_MISSING',
      field: 'supplier',
      message: 'Leverantörsnamn saknas eller är för kort',
      severity: 'critical',
    });
  }

  // 2. Validera belopp
  if (!classification.totalAmount || classification.totalAmount === 0) {
    errors.push({
      code: 'INVALID_AMOUNT',
      field: 'totalAmount',
      message: 'Totalbelopp får inte vara 0',
      severity: 'critical',
    });
  } else if (!isCreditNote && classification.totalAmount < 0) {
    errors.push({
      code: 'INVALID_AMOUNT',
      field: 'totalAmount',
      message: 'Totalbelopp måste vara större än 0',
      severity: 'critical',
    });
  } else if (isCreditNote && classification.totalAmount > 0) {
    warnings.push({
      code: 'CREDIT_NOTE_POSITIVE_AMOUNT',
      field: 'totalAmount',
      message: 'Kreditnota har positivt totalbelopp. Kontrollera att beloppens tecken stämmer.',
      suggestion: 'Om detta är en kreditnota bör beloppen normalt vara negativa.',
    });
  }

  // 3. Validera moms
  const vatValidation = validateVAT(classification);
  errors.push(...vatValidation.errors);
  warnings.push(...vatValidation.warnings);

  // 4. Validera datum
  const dateValidation = validateDates(classification, companyFiscalYear);
  errors.push(...dateValidation.errors);
  warnings.push(...dateValidation.warnings);

  // 5. Validera raderna
  const lineItemValidation = validateLineItems(classification.lineItems, classification.totalAmount, { allowNegative: isCreditNote });
  errors.push(...lineItemValidation.errors);
  warnings.push(...lineItemValidation.warnings);

  // 6. Validera valuta
  if (classification.currency && classification.currency !== 'SEK') {
    warnings.push({
      code: 'FOREIGN_CURRENCY',
      field: 'currency',
      message: `Utländsk valuta (${classification.currency}) kräver växelkursberäkning`,
      suggestion: 'Belopp kommer att konverteras till SEK med aktuell kurs',
    });
  }

  return {
    isValid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    autoFixable,
  };
}

/**
 * Validera Fortnox-mappning (verifikation)
 */
export function validateFortnoxMapping(mapping: FortnoxMapping): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const autoFixable: AutoFix[] = [];

  // 1. Validera balans (debet = kredit)
  const balanceValidation = validateBalance(mapping.voucherLines);
  if (!balanceValidation.isBalanced) {
    errors.push({
      code: 'UNBALANCED_VOUCHER',
      field: 'voucherLines',
      message: `Verifikationen är ej balanserad. Debet: ${balanceValidation.totalDebit.toFixed(2)}, Kredit: ${balanceValidation.totalCredit.toFixed(2)}`,
      severity: 'critical',
    });
  }

  // 2. Validera att alla konton är giltiga (4-siffriga)
  for (const line of mapping.voucherLines) {
    if (!/^\d{4}$/.test(line.account)) {
      errors.push({
        code: 'INVALID_ACCOUNT',
        field: 'account',
        message: `Ogiltigt kontonummer: ${line.account}. Måste vara 4 siffror.`,
        severity: 'critical',
      });
    }
  }

  // 3. Validera att belopp är positiva
  for (const line of mapping.voucherLines) {
    if ((line.debit && line.debit < 0) || (line.credit && line.credit < 0)) {
      errors.push({
        code: 'NEGATIVE_AMOUNT',
        field: 'amount',
        message: 'Belopp får inte vara negativt',
        severity: 'error',
      });
    }
  }

  // 4. Varning för höga belopp
  for (const line of mapping.voucherLines) {
    const amount = line.debit || line.credit || 0;
    if (amount > 100000) {
      warnings.push({
        code: 'HIGH_AMOUNT',
        field: 'amount',
        message: `Högt belopp (${amount.toLocaleString('sv-SE')} kr) på konto ${line.account}`,
        suggestion: 'Kontrollera att beloppet är korrekt',
      });
    }
  }

  // 5. Validera verifikationsdatum
  if (!mapping.voucherDate || !/^\d{4}-\d{2}-\d{2}$/.test(mapping.voucherDate)) {
    errors.push({
      code: 'INVALID_DATE',
      field: 'voucherDate',
      message: 'Ogiltigt verifikationsdatum',
      severity: 'critical',
    });
  }

  // 6. Kontrollera obligatoriska fält för leverantörsfaktura
  if (mapping.voucherType === 'SUPPLIER_INVOICE' && mapping.supplierInvoice) {
    if (!mapping.supplierInvoice.invoiceNumber) {
      errors.push({
        code: 'MISSING_INVOICE_NUMBER',
        field: 'invoiceNumber',
        message: 'Fakturanummer saknas',
        severity: 'error',
      });
    }
    if (!mapping.supplierInvoice.dueDate) {
      warnings.push({
        code: 'MISSING_DUE_DATE',
        field: 'dueDate',
        message: 'Förfallodatum saknas',
        suggestion: 'Standardförfallodatum (30 dagar) kommer att användas',
      });
    }
  }

  return {
    isValid: errors.filter(e => e.severity === 'critical').length === 0,
    errors,
    warnings,
    autoFixable,
  };
}

// ============ Hjälpfunktioner ============

function validateVAT(classification: Classification): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const { totalAmount, vatAmount, lineItems } = classification;

  // Beräkna förväntad moms baserat på nettobelopp
  if (vatAmount !== undefined && vatAmount !== null) {
    const netAmount = totalAmount - vatAmount;
    
    // Kontrollera att momsbeloppet är rimligt (mellan 0% och 25% av netto)
    const absNet = Math.abs(netAmount);
    const absVat = Math.abs(vatAmount);
    if (absNet > 0) {
      const vatPercentage = (absVat / absNet) * 100;
      
      // Hitta närmaste giltiga momssats
      const closestRate = VALID_VAT_RATES.reduce((prev, curr) => 
        Math.abs(curr - vatPercentage) < Math.abs(prev - vatPercentage) ? curr : prev
      );
      
      const expectedVat = absNet * (closestRate / 100);
      const difference = Math.abs(absVat - expectedVat);
      
      // Tillåt 1 kr avrundningsdifferens
      if (difference > 1) {
        warnings.push({
          code: 'VAT_MISMATCH',
          field: 'vatAmount',
          message: `Momsbeloppet (${vatAmount.toFixed(2)}) stämmer inte med beräknad moms (${expectedVat.toFixed(2)}) för ${closestRate}%`,
          suggestion: `Förväntat momsbelopp för ${closestRate}% är ${expectedVat.toFixed(2)} kr`,
        });
      }
    }
  }

  // Kontrollera att radernas moms summerar till totalmomsen
  if (lineItems && lineItems.length > 0) {
    const lineVatSum = lineItems.reduce((sum, item) => sum + (item.vatAmount || 0), 0);
    if (vatAmount !== undefined && Math.abs(lineVatSum - vatAmount) > 1) {
      warnings.push({
        code: 'LINE_VAT_MISMATCH',
        field: 'lineItems',
        message: `Radernas moms (${lineVatSum.toFixed(2)}) matchar inte totalmoms (${vatAmount?.toFixed(2)})`,
      });
    }
  }

  return { errors, warnings };
}

function validateDates(
  classification: Classification,
  fiscalYear?: { start: string; end: string }
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const today = new Date();
  const invoiceDate = new Date(classification.invoiceDate);

  // Kontrollera att datumet är giltigt
  if (isNaN(invoiceDate.getTime())) {
    errors.push({
      code: 'INVALID_INVOICE_DATE',
      field: 'invoiceDate',
      message: 'Ogiltigt fakturadatum',
      severity: 'critical',
    });
    return { errors, warnings };
  }

  // Kontrollera att datumet inte är i framtiden
  if (invoiceDate > today) {
    errors.push({
      code: 'FUTURE_DATE',
      field: 'invoiceDate',
      message: 'Fakturadatum kan inte vara i framtiden',
      severity: 'error',
    });
  }

  // Kontrollera att datumet inte är för gammalt (mer än 2 år)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  if (invoiceDate < twoYearsAgo) {
    warnings.push({
      code: 'OLD_DATE',
      field: 'invoiceDate',
      message: 'Fakturadatum är mer än 2 år gammalt',
      suggestion: 'Kontrollera att datumet är korrekt',
    });
  }

  // Kontrollera räkenskapsår om tillgängligt
  if (fiscalYear) {
    const fyStart = new Date(fiscalYear.start);
    const fyEnd = new Date(fiscalYear.end);
    
    if (invoiceDate < fyStart || invoiceDate > fyEnd) {
      warnings.push({
        code: 'OUTSIDE_FISCAL_YEAR',
        field: 'invoiceDate',
        message: `Fakturadatum ligger utanför räkenskapsåret (${fiscalYear.start} - ${fiscalYear.end})`,
        suggestion: 'Kontrollera att fakturan ska bokföras på detta räkenskapsår',
      });
    }
  }

  // Kontrollera förfallodatum
  if (classification.dueDate) {
    const dueDate = new Date(classification.dueDate);
    if (dueDate < invoiceDate) {
      warnings.push({
        code: 'DUE_BEFORE_INVOICE',
        field: 'dueDate',
        message: 'Förfallodatum är före fakturadatum',
      });
    }
  }

  return { errors, warnings };
}

function validateLineItems(
  lineItems: LineItem[],
  expectedTotal: number,
  options?: { allowNegative?: boolean }
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const allowNegative = options?.allowNegative || false;

  if (!lineItems || lineItems.length === 0) {
    warnings.push({
      code: 'NO_LINE_ITEMS',
      field: 'lineItems',
      message: 'Inga bokföringsrader finns',
      suggestion: 'En standardrad kommer att skapas',
    });
    return { errors, warnings };
  }

  // Kontrollera att varje rad har ett giltigt konto
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    
    if (!item.suggestedAccount || !/^\d{4}$/.test(item.suggestedAccount)) {
      errors.push({
        code: 'INVALID_LINE_ACCOUNT',
        field: `lineItems[${i}].suggestedAccount`,
        message: `Ogiltigt konto på rad ${i + 1}: ${item.suggestedAccount}`,
        severity: 'error',
      });
    }

    if (!item.netAmount || item.netAmount === 0) {
      errors.push({
        code: 'INVALID_LINE_AMOUNT',
        field: `lineItems[${i}].netAmount`,
        message: `Ogiltigt belopp på rad ${i + 1}`,
        severity: 'error',
      });
    } else if (!allowNegative && item.netAmount < 0) {
      errors.push({
        code: 'NEGATIVE_LINE_AMOUNT',
        field: `lineItems[${i}].netAmount`,
        message: `Negativt belopp på rad ${i + 1} är inte tillåtet`,
        severity: 'error',
      });
    }
  }

  // Kontrollera att raderna summerar till totalen
  const lineSum = lineItems.reduce((sum, item) => sum + (item.netAmount || 0) + (item.vatAmount || 0), 0);
  const tolerance = Math.max(1, Math.abs(expectedTotal) * 0.01); // 1% tolerans, minst 1 kr
  
  const diff = allowNegative ? Math.abs(Math.abs(lineSum) - Math.abs(expectedTotal)) : Math.abs(lineSum - expectedTotal);
  if (diff > tolerance) {
    warnings.push({
      code: 'LINE_SUM_MISMATCH',
      field: 'lineItems',
      message: `Radernas summa (${lineSum.toFixed(2)}) matchar inte totalbeloppet (${expectedTotal.toFixed(2)})`,
      suggestion: 'Kontrollera att alla rader är korrekta',
    });
  }

  return { errors, warnings };
}

function validateBalance(voucherLines: VoucherLine[]): {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
} {
  const totalDebit = voucherLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = voucherLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  
  // Tillåt 0.01 kr avrundningsdifferens
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return { isBalanced, totalDebit, totalCredit };
}

/**
 * Automatisk korrigering av vanliga fel
 */
export function autoCorrect(
  classification: Classification,
  mapping: FortnoxMapping
): { classification: Classification; mapping: FortnoxMapping; corrections: string[] } {
  const corrections: string[] = [];
  const correctedClassification = { ...classification };
  const correctedMapping = { ...mapping };

  // 1. Avrunda belopp till 2 decimaler
  correctedClassification.totalAmount = Math.round(classification.totalAmount * 100) / 100;
  if (classification.vatAmount) {
    correctedClassification.vatAmount = Math.round(classification.vatAmount * 100) / 100;
  }

  // 2. Korrigera obalanserad verifikation
  const balance = validateBalance(mapping.voucherLines);
  if (!balance.isBalanced) {
    const diff = balance.totalDebit - balance.totalCredit;
    if (Math.abs(diff) < 1) {
      // Lägg till avrundningsdifferens
      correctedMapping.voucherLines = [
        ...mapping.voucherLines,
        {
          account: diff > 0 ? '3740' : '7690',
          accountName: diff > 0 ? 'Öresutjämning' : 'Övriga kostnader',
          debit: diff < 0 ? Math.abs(diff) : 0,
          credit: diff > 0 ? diff : 0,
          description: 'Avrundning',
        },
      ];
      corrections.push(`Lade till avrundning: ${diff.toFixed(2)} kr`);
    }
  }

  // 3. Sätt standardförfallodatum om det saknas
  if (!correctedClassification.dueDate && classification.invoiceDate) {
    const invoiceDate = new Date(classification.invoiceDate);
    invoiceDate.setDate(invoiceDate.getDate() + 30);
    correctedClassification.dueDate = invoiceDate.toISOString().split('T')[0];
    corrections.push('Satte standardförfallodatum (30 dagar)');
  }

  return { classification: correctedClassification, mapping: correctedMapping, corrections };
}


