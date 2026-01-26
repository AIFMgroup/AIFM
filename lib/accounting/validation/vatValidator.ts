/**
 * VAT Validator
 * 
 * Validerar momsberäkningar enligt svenska regler.
 * Kontrollerar:
 * - Att momsbelopp matchar momssats och nettobelopp
 * - Att rätt momskonto används
 * - Att momsregistreringsnummer är giltigt
 * - Omvänd moms vid EU-handel
 */

// ============ Types ============

export interface VATValidationResult {
  isValid: boolean;
  errors: VATError[];
  warnings: VATWarning[];
  calculations: VATCalculation;
}

export interface VATError {
  code: string;
  message: string;
  expected?: number;
  actual?: number;
  difference?: number;
}

export interface VATWarning {
  code: string;
  message: string;
  suggestion?: string;
}

export interface VATCalculation {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  vatRate: number;
  calculatedVat: number;
  difference: number;
  isWithinTolerance: boolean;
}

export interface InvoiceVATData {
  netAmount: number;      // Exkl. moms
  vatAmount: number;      // Momsbelopp
  grossAmount: number;    // Inkl. moms
  vatRate?: number;       // Om känd (25, 12, 6, 0)
  currency?: string;      // SEK default
  supplierVatNumber?: string;
  isEU?: boolean;
  isReverseCharge?: boolean;
}

// ============ Swedish VAT Rates ============

export const SWEDISH_VAT_RATES = {
  STANDARD: 25,           // Standard rate
  REDUCED_12: 12,         // Mat, hotell, restaurang
  REDUCED_6: 6,           // Böcker, tidningar, kultur, kollektivtrafik
  ZERO: 0,                // Export, vissa tjänster
} as const;

// Vanliga kombinationer av varor/tjänster och momssatser
const VAT_RATE_CATEGORIES: Record<number, string[]> = {
  25: [
    'kontorsmaterial', 'inventarier', 'it', 'mjukvara', 'konsulttjänster',
    'telefon', 'el', 'hyra', 'reparation', 'städning', 'transport',
    'marknadsföring', 'reklam', 'försäkring', 'bank',
  ],
  12: [
    'mat', 'livsmedel', 'restaurang', 'lunch', 'fika', 'hotell',
    'camping', 'konferens',
  ],
  6: [
    'bok', 'tidning', 'tidskrift', 'kultur', 'teater', 'bio',
    'kollektivtrafik', 'persontransport', 'taxi',
  ],
  0: [
    'export', 'utland', 'eu-försäljning', 'sjukvård', 'utbildning',
    'bank', 'finans', 'försäkring',
  ],
};

// Tolerans för avrundningsdifferenser
const VAT_TOLERANCE = 1.0; // 1 kr tolerans

// ============ Main Validation Function ============

export function validateVAT(data: InvoiceVATData): VATValidationResult {
  const errors: VATError[] = [];
  const warnings: VATWarning[] = [];
  
  // 1. Bestäm momssats om inte angiven
  const vatRate = data.vatRate ?? detectVATRate(data.netAmount, data.vatAmount, data.grossAmount);
  
  // 2. Beräkna förväntat momsbelopp
  const calculatedVat = calculateVAT(data.netAmount, vatRate);
  const difference = Math.abs(data.vatAmount - calculatedVat);
  const isWithinTolerance = difference <= VAT_TOLERANCE;
  
  // 3. Validera att beloppen stämmer
  if (!isWithinTolerance && data.vatAmount > 0) {
    errors.push({
      code: 'VAT_MISMATCH',
      message: `Momsbeloppet (${data.vatAmount.toFixed(2)}) matchar inte beräknad moms (${calculatedVat.toFixed(2)}) för ${vatRate}%`,
      expected: calculatedVat,
      actual: data.vatAmount,
      difference: difference,
    });
  }
  
  // 4. Validera brutto = netto + moms
  const expectedGross = data.netAmount + data.vatAmount;
  const grossDifference = Math.abs(data.grossAmount - expectedGross);
  
  if (grossDifference > VAT_TOLERANCE) {
    errors.push({
      code: 'GROSS_MISMATCH',
      message: `Bruttobelopp (${data.grossAmount.toFixed(2)}) ≠ Netto (${data.netAmount.toFixed(2)}) + Moms (${data.vatAmount.toFixed(2)})`,
      expected: expectedGross,
      actual: data.grossAmount,
      difference: grossDifference,
    });
  }
  
  // 5. Validera momssats
  if (!isValidVATRate(vatRate)) {
    errors.push({
      code: 'INVALID_VAT_RATE',
      message: `Momssatsen ${vatRate}% är inte giltig i Sverige. Giltiga satser: 25%, 12%, 6%, 0%`,
    });
  }
  
  // 6. Kontrollera EU-handel
  if (data.isEU && !data.isReverseCharge && data.vatAmount > 0) {
    warnings.push({
      code: 'EU_VAT_CHECK',
      message: 'EU-inköp med moms bör kontrolleras - kan vara omvänd skattskyldighet',
      suggestion: 'Kontrollera om leverantören är momsregistrerad och om omvänd moms gäller',
    });
  }
  
  // 7. Validera momsregistreringsnummer om angivet
  if (data.supplierVatNumber) {
    const vatNumberValidation = validateVATNumber(data.supplierVatNumber);
    if (!vatNumberValidation.isValid) {
      warnings.push({
        code: 'INVALID_VAT_NUMBER',
        message: `Momsregistreringsnummer "${data.supplierVatNumber}" verkar ogiltigt`,
        suggestion: vatNumberValidation.suggestion,
      });
    }
  }
  
  // 8. Varning för stora belopp utan moms
  if (data.vatAmount === 0 && data.grossAmount > 10000) {
    warnings.push({
      code: 'LARGE_AMOUNT_NO_VAT',
      message: 'Stort belopp utan moms - kontrollera att momsfrihet gäller',
      suggestion: 'Verifiera att varan/tjänsten är momsfri eller att omvänd moms tillämpas',
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    calculations: {
      netAmount: data.netAmount,
      vatAmount: data.vatAmount,
      grossAmount: data.grossAmount,
      vatRate,
      calculatedVat,
      difference,
      isWithinTolerance,
    },
  };
}

// ============ VAT Calculation ============

/**
 * Beräkna moms från nettobelopp
 */
export function calculateVAT(netAmount: number, vatRate: number): number {
  return Math.round(netAmount * (vatRate / 100) * 100) / 100;
}

/**
 * Beräkna nettobelopp från bruttobelopp
 */
export function calculateNetFromGross(grossAmount: number, vatRate: number): number {
  return Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100;
}

/**
 * Beräkna moms från bruttobelopp
 */
export function calculateVATFromGross(grossAmount: number, vatRate: number): number {
  const net = calculateNetFromGross(grossAmount, vatRate);
  return Math.round((grossAmount - net) * 100) / 100;
}

/**
 * Detektera momssats från beloppen
 */
export function detectVATRate(
  netAmount: number,
  vatAmount: number,
  grossAmount?: number
): number {
  if (vatAmount === 0 || netAmount === 0) return 0;
  
  const calculatedRate = (vatAmount / netAmount) * 100;
  
  // Matcha mot svenska standardsatser med tolerans
  const rates = [25, 12, 6, 0];
  const tolerance = 1; // 1% tolerans
  
  for (const rate of rates) {
    if (Math.abs(calculatedRate - rate) <= tolerance) {
      return rate;
    }
  }
  
  // Om ingen standardsats matchar, returnera närmaste
  return rates.reduce((closest, rate) => 
    Math.abs(rate - calculatedRate) < Math.abs(closest - calculatedRate) ? rate : closest
  );
}

/**
 * Kontrollera om momssats är giltig i Sverige
 */
export function isValidVATRate(rate: number): boolean {
  return [25, 12, 6, 0].includes(rate);
}

// ============ VAT Number Validation ============

/**
 * Validera svenskt momsregistreringsnummer (SE + 12 siffror)
 */
export function validateVATNumber(vatNumber: string): {
  isValid: boolean;
  country?: string;
  suggestion?: string;
} {
  const cleaned = vatNumber.replace(/[\s.-]/g, '').toUpperCase();
  
  // Svenskt format: SE + 12 siffror (org.nr + 01)
  if (cleaned.startsWith('SE')) {
    const digits = cleaned.slice(2);
    if (/^\d{12}$/.test(digits)) {
      // Kontrollera Luhn för org.nr (första 10 siffror)
      const orgNr = digits.slice(0, 10);
      if (validateLuhn(orgNr)) {
        return { isValid: true, country: 'SE' };
      }
      return { 
        isValid: false, 
        country: 'SE',
        suggestion: 'Kontrollsiffran stämmer inte - verifiera numret',
      };
    }
    return { 
      isValid: false, 
      country: 'SE',
      suggestion: 'Svenskt momsnummer ska vara SE + 12 siffror',
    };
  }
  
  // EU-länders format
  const euPatterns: Record<string, RegExp> = {
    'AT': /^ATU\d{8}$/,           // Österrike
    'BE': /^BE0\d{9}$/,           // Belgien
    'DE': /^DE\d{9}$/,            // Tyskland
    'DK': /^DK\d{8}$/,            // Danmark
    'FI': /^FI\d{8}$/,            // Finland
    'FR': /^FR[A-Z0-9]{2}\d{9}$/, // Frankrike
    'NL': /^NL\d{9}B\d{2}$/,      // Nederländerna
    'NO': /^NO\d{9}MVA$/,         // Norge (EES)
    'PL': /^PL\d{10}$/,           // Polen
    'UK': /^GB\d{9}$/,            // Storbritannien
  };
  
  for (const [country, pattern] of Object.entries(euPatterns)) {
    if (pattern.test(cleaned)) {
      return { isValid: true, country };
    }
  }
  
  // Okänt format
  if (/^[A-Z]{2}/.test(cleaned)) {
    const country = cleaned.slice(0, 2);
    return {
      isValid: false,
      country,
      suggestion: `Kunde inte validera momsnummer för ${country}`,
    };
  }
  
  return {
    isValid: false,
    suggestion: 'Momsnummer ska börja med landskod (t.ex. SE för Sverige)',
  };
}

/**
 * Luhn-algoritm för kontrollsiffra (används för svenska org.nr)
 */
function validateLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  
  return sum % 10 === 0;
}

// ============ VAT Account Mapping ============

/**
 * Hämta rätt momskonto baserat på momssats
 */
export function getVATAccount(vatRate: number, type: 'input' | 'output'): string {
  if (type === 'input') {
    return '2640'; // Ingående moms (alltid samma konto)
  }
  
  // Utgående moms
  switch (vatRate) {
    case 25: return '2610';
    case 12: return '2620';
    case 6: return '2630';
    default: return '2610'; // Default till 25%
  }
}

/**
 * Föreslå momssats baserat på leverantör/beskrivning
 */
export function suggestVATRate(description: string, supplier?: string): {
  rate: number;
  confidence: number;
  reason: string;
} {
  const lowerDesc = (description + ' ' + (supplier || '')).toLowerCase();
  
  // Kontrollera mot kategorier
  for (const [rate, keywords] of Object.entries(VAT_RATE_CATEGORIES)) {
    const matchedKeywords = keywords.filter(kw => lowerDesc.includes(kw));
    if (matchedKeywords.length > 0) {
      return {
        rate: parseInt(rate),
        confidence: Math.min(0.9, 0.5 + matchedKeywords.length * 0.15),
        reason: `Matchar kategori för ${rate}% moms (${matchedKeywords.join(', ')})`,
      };
    }
  }
  
  // Default till 25%
  return {
    rate: 25,
    confidence: 0.5,
    reason: 'Standardmoms (ingen specifik kategori identifierad)',
  };
}

// ============ VAT Recalculation ============

/**
 * Räkna om moms med korrekt momssats
 */
export function recalculateVAT(
  grossAmount: number,
  currentVatAmount: number,
  newVatRate: number
): {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  difference: number;
} {
  const newNetAmount = calculateNetFromGross(grossAmount, newVatRate);
  const newVatAmount = calculateVATFromGross(grossAmount, newVatRate);
  
  return {
    netAmount: newNetAmount,
    vatAmount: newVatAmount,
    grossAmount,
    difference: newVatAmount - currentVatAmount,
  };
}

/**
 * Validera en hel verifikation ur momsperspektiv
 */
export function validateVoucherVAT(rows: {
  account: string;
  debit: number;
  credit: number;
}[]): {
  isValid: boolean;
  inputVAT: number;
  outputVAT: number;
  errors: string[];
} {
  let inputVAT = 0;
  let outputVAT = 0;
  const errors: string[] = [];
  
  rows.forEach(row => {
    // Ingående moms (2640)
    if (row.account === '2640') {
      inputVAT += row.debit - row.credit;
    }
    // Utgående moms (2610, 2620, 2630)
    if (['2610', '2620', '2630'].includes(row.account)) {
      outputVAT += row.credit - row.debit;
    }
  });
  
  // Kontrollera att moms är positiv (normalt)
  if (inputVAT < 0) {
    errors.push('Ingående moms är negativ - kontrollera bokföring');
  }
  
  return {
    isValid: errors.length === 0,
    inputVAT,
    outputVAT,
    errors,
  };
}















