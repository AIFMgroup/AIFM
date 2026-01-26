/**
 * VAT Calculator Service
 * 
 * Hanterar alla momssatser, beräkningar och specialfall enligt svensk lag.
 * Stöd för omvänd skattskyldighet, EU-inköp, byggtjänster m.m.
 */

// Svenska momssatser
export const VAT_RATES = {
  STANDARD: 0.25,      // 25% - Standardmoms
  REDUCED: 0.12,       // 12% - Mat (restaurang), hotell
  LOW: 0.06,           // 6% - Böcker, tidningar, kultur, kollektivtrafik
  ZERO: 0,             // 0% - Export, sjukvård, utbildning
} as const;

export type VatRateType = keyof typeof VAT_RATES;

// Kontokonfiguration för moms
export const VAT_ACCOUNTS = {
  // Ingående moms (avdragsgill)
  INPUT_25: { account: '2641', name: 'Ingående moms 25%' },
  INPUT_12: { account: '2642', name: 'Ingående moms 12%' },
  INPUT_6: { account: '2643', name: 'Ingående moms 6%' },
  
  // Utgående moms (vid försäljning)
  OUTPUT_25: { account: '2611', name: 'Utgående moms 25%' },
  OUTPUT_12: { account: '2621', name: 'Utgående moms 12%' },
  OUTPUT_6: { account: '2631', name: 'Utgående moms 6%' },
  
  // Omvänd skattskyldighet
  REVERSE_CHARGE_INPUT: { account: '2645', name: 'Ingående moms, omvänd skattskyldighet' },
  REVERSE_CHARGE_OUTPUT: { account: '2614', name: 'Utgående moms, omvänd skattskyldighet' },
  
  // EU-inköp
  EU_PURCHASE_INPUT: { account: '2645', name: 'Ingående moms, EU-förvärv' },
  EU_PURCHASE_OUTPUT: { account: '2614', name: 'Utgående moms, EU-förvärv' },
  
  // Inköpskonton för omvänd skattskyldighet
  PURCHASE_EU_GOODS: { account: '4515', name: 'Inköp av varor inom EU' },
  PURCHASE_EU_SERVICES: { account: '4535', name: 'Inköp av tjänster inom EU' },
  PURCHASE_CONSTRUCTION: { account: '4545', name: 'Inköp byggtjänster, omvänd moms' },
} as const;

// Nyckelord för att identifiera momssatser
const VAT_RATE_KEYWORDS: Record<VatRateType, string[]> = {
  STANDARD: ['standard', '25%', '25 %', 'moms', 'vat'],
  REDUCED: ['restaurang', 'hotell', 'mat', 'livsmedel', '12%', '12 %', 'catering'],
  LOW: ['bok', 'tidning', 'teater', 'konsert', 'museum', 'kollektivtrafik', 'sl', 'taxi', '6%', '6 %'],
  ZERO: ['export', 'sjukvård', 'tandvård', 'utbildning', 'försäkring', '0%', '0 %'],
};

// Nyckelord för omvänd skattskyldighet
const REVERSE_CHARGE_KEYWORDS = [
  'reverse charge',
  'omvänd skattskyldighet',
  'omvänd moms',
  'vat reverse',
  'intra-community',
  'eu-tjänst',
];

// Byggtjänster (omvänd skattskyldighet)
const CONSTRUCTION_KEYWORDS = [
  'byggarbete', 'renovering', 'målning', 'el-arbete', 'vvs',
  'entreprenad', 'bygg', 'installation', 'montering',
];

export interface VatCalculation {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  vatRate: number;
  vatRateType: VatRateType;
  vatAccount: { account: string; name: string };
  isReverseCharge: boolean;
  isEuPurchase: boolean;
  isConstruction: boolean;
  additionalLines?: VoucherVatLine[];
}

export interface VoucherVatLine {
  account: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

/**
 * Beräkna moms från bruttobelopp
 */
export function calculateVatFromGross(
  grossAmount: number,
  vatRate: number = VAT_RATES.STANDARD
): { netAmount: number; vatAmount: number } {
  const vatAmount = Math.round(grossAmount * (vatRate / (1 + vatRate)) * 100) / 100;
  const netAmount = Math.round((grossAmount - vatAmount) * 100) / 100;
  
  return { netAmount, vatAmount };
}

/**
 * Beräkna moms från nettobelopp
 */
export function calculateVatFromNet(
  netAmount: number,
  vatRate: number = VAT_RATES.STANDARD
): { vatAmount: number; grossAmount: number } {
  const vatAmount = Math.round(netAmount * vatRate * 100) / 100;
  const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;
  
  return { vatAmount, grossAmount };
}

/**
 * Detektera momssats baserat på dokumentinnehåll
 */
export function detectVatRate(
  description: string,
  supplier?: string,
  lineItemDescription?: string
): VatRateType {
  const textToAnalyze = `${description} ${supplier || ''} ${lineItemDescription || ''}`.toLowerCase();

  // Kontrollera i ordning från mest specifikt till minst
  for (const [rateType, keywords] of Object.entries(VAT_RATE_KEYWORDS) as [VatRateType, string[]][]) {
    for (const keyword of keywords) {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        return rateType;
      }
    }
  }

  // Default till standardmoms
  return 'STANDARD';
}

/**
 * Detektera omvänd skattskyldighet
 */
export function detectReverseCharge(
  description: string,
  supplier?: string,
  supplierCountry?: string
): { isReverseCharge: boolean; type: 'eu_service' | 'eu_goods' | 'construction' | null } {
  const textToAnalyze = `${description} ${supplier || ''}`.toLowerCase();

  // Kontrollera byggtjänster först
  for (const keyword of CONSTRUCTION_KEYWORDS) {
    if (textToAnalyze.includes(keyword)) {
      return { isReverseCharge: true, type: 'construction' };
    }
  }

  // Kontrollera EU-inköp
  const euCountries = [
    'tyskland', 'germany', 'frankrike', 'france', 'spanien', 'spain',
    'italien', 'italy', 'nederländerna', 'netherlands', 'belgien', 'belgium',
    'österrike', 'austria', 'polen', 'poland', 'danmark', 'denmark',
    'finland', 'irland', 'ireland', 'portugal', 'grekland', 'greece',
  ];

  if (supplierCountry) {
    const isEu = euCountries.some(c => supplierCountry.toLowerCase().includes(c));
    if (isEu) {
      // Kolla om det är tjänst eller vara
      const isService = textToAnalyze.includes('service') || 
                        textToAnalyze.includes('tjänst') ||
                        textToAnalyze.includes('licens') ||
                        textToAnalyze.includes('subscription');
      return { 
        isReverseCharge: true, 
        type: isService ? 'eu_service' : 'eu_goods' 
      };
    }
  }

  // Kontrollera reverse charge-nyckelord
  for (const keyword of REVERSE_CHARGE_KEYWORDS) {
    if (textToAnalyze.includes(keyword.toLowerCase())) {
      return { isReverseCharge: true, type: 'eu_service' };
    }
  }

  return { isReverseCharge: false, type: null };
}

/**
 * Komplett momsberäkning med alla specialfall
 */
export function calculateCompleteVat(
  amount: number,
  isGross: boolean,
  description: string,
  supplier?: string,
  supplierCountry?: string,
  explicitVatRate?: number
): VatCalculation {
  // 1. Detektera specialfall
  const reverseChargeResult = detectReverseCharge(description, supplier, supplierCountry);
  
  // 2. Bestäm momssats
  let vatRateType: VatRateType;
  let vatRate: number;
  
  if (explicitVatRate !== undefined) {
    // Använd explicit momssats
    vatRate = explicitVatRate;
    vatRateType = Object.entries(VAT_RATES).find(([_, rate]) => 
      Math.abs(rate - explicitVatRate) < 0.01
    )?.[0] as VatRateType || 'STANDARD';
  } else {
    vatRateType = detectVatRate(description, supplier);
    vatRate = VAT_RATES[vatRateType];
  }

  // 3. Beräkna belopp
  let netAmount: number;
  let vatAmount: number;
  let grossAmount: number;

  if (reverseChargeResult.isReverseCharge) {
    // Omvänd skattskyldighet - ingen ingående moms på fakturan
    netAmount = amount;
    vatAmount = 0;
    grossAmount = amount;
  } else if (isGross) {
    const calc = calculateVatFromGross(amount, vatRate);
    netAmount = calc.netAmount;
    vatAmount = calc.vatAmount;
    grossAmount = amount;
  } else {
    netAmount = amount;
    const calc = calculateVatFromNet(amount, vatRate);
    vatAmount = calc.vatAmount;
    grossAmount = calc.grossAmount;
  }

  // 4. Bestäm momskonto
  let vatAccount = getVatAccount(vatRateType, 'input');
  const additionalLines: VoucherVatLine[] = [];

  // 5. Hantera omvänd skattskyldighet
  if (reverseChargeResult.isReverseCharge) {
    const reverseVatAmount = Math.round(netAmount * VAT_RATES.STANDARD * 100) / 100;
    
    // Vid omvänd skattskyldighet bokförs både ingående OCH utgående moms
    additionalLines.push({
      account: VAT_ACCOUNTS.REVERSE_CHARGE_INPUT.account,
      accountName: VAT_ACCOUNTS.REVERSE_CHARGE_INPUT.name,
      debit: reverseVatAmount,
      credit: 0,
      description: 'Ingående moms, omvänd skattskyldighet',
    });
    
    additionalLines.push({
      account: VAT_ACCOUNTS.REVERSE_CHARGE_OUTPUT.account,
      accountName: VAT_ACCOUNTS.REVERSE_CHARGE_OUTPUT.name,
      debit: 0,
      credit: reverseVatAmount,
      description: 'Utgående moms, omvänd skattskyldighet',
    });

    vatAccount = VAT_ACCOUNTS.REVERSE_CHARGE_INPUT;
  }

  return {
    netAmount,
    vatAmount,
    grossAmount,
    vatRate,
    vatRateType,
    vatAccount,
    isReverseCharge: reverseChargeResult.isReverseCharge,
    isEuPurchase: reverseChargeResult.type === 'eu_service' || reverseChargeResult.type === 'eu_goods',
    isConstruction: reverseChargeResult.type === 'construction',
    additionalLines: additionalLines.length > 0 ? additionalLines : undefined,
  };
}

/**
 * Hämta momskonto baserat på typ och riktning
 */
export function getVatAccount(
  rateType: VatRateType,
  direction: 'input' | 'output'
): { account: string; name: string } {
  if (direction === 'input') {
    switch (rateType) {
      case 'STANDARD': return VAT_ACCOUNTS.INPUT_25;
      case 'REDUCED': return VAT_ACCOUNTS.INPUT_12;
      case 'LOW': return VAT_ACCOUNTS.INPUT_6;
      case 'ZERO': return { account: '', name: '' }; // Ingen moms
    }
  } else {
    switch (rateType) {
      case 'STANDARD': return VAT_ACCOUNTS.OUTPUT_25;
      case 'REDUCED': return VAT_ACCOUNTS.OUTPUT_12;
      case 'LOW': return VAT_ACCOUNTS.OUTPUT_6;
      case 'ZERO': return { account: '', name: '' };
    }
  }
}

/**
 * Validera att momsbeloppet är korrekt
 */
export function validateVatAmount(
  netAmount: number,
  vatAmount: number,
  grossAmount: number,
  tolerance: number = 1 // 1 kr avrundningstolerans
): { isValid: boolean; expectedVat: number; difference: number; suggestedRate: VatRateType } {
  // Beräkna faktisk procentsats
  const actualRate = netAmount > 0 ? vatAmount / netAmount : 0;
  
  // Hitta närmaste standardsats
  const rates = Object.entries(VAT_RATES) as [VatRateType, number][];
  const closest = rates.reduce((prev, curr) => 
    Math.abs(curr[1] - actualRate) < Math.abs(prev[1] - actualRate) ? curr : prev
  );
  
  const [suggestedRate, suggestedRateValue] = closest;
  const expectedVat = Math.round(netAmount * suggestedRateValue * 100) / 100;
  const difference = Math.abs(vatAmount - expectedVat);
  
  return {
    isValid: difference <= tolerance,
    expectedVat,
    difference,
    suggestedRate,
  };
}

/**
 * Generera momsrader för verifikation
 */
export function generateVatVoucherLines(
  vatCalculation: VatCalculation,
  costAccount: string,
  costAccountName: string
): VoucherVatLine[] {
  const lines: VoucherVatLine[] = [];

  // Kostnadskonto (debet)
  lines.push({
    account: costAccount,
    accountName: costAccountName,
    debit: vatCalculation.netAmount,
    credit: 0,
    description: 'Inköp',
  });

  // Momskonto (debet) - om inte omvänd skattskyldighet
  if (vatCalculation.vatAmount > 0 && !vatCalculation.isReverseCharge) {
    lines.push({
      account: vatCalculation.vatAccount.account,
      accountName: vatCalculation.vatAccount.name,
      debit: vatCalculation.vatAmount,
      credit: 0,
      description: `Ingående moms ${Math.round(vatCalculation.vatRate * 100)}%`,
    });
  }

  // Lägg till extra rader för omvänd skattskyldighet
  if (vatCalculation.additionalLines) {
    lines.push(...vatCalculation.additionalLines);
  }

  return lines;
}

/**
 * Beräkna momsperiod för SKV-rapportering
 */
export function getVatReportingPeriod(date: Date): { 
  year: number; 
  period: 'monthly' | 'quarterly' | 'yearly';
  periodNumber: number;
  periodLabel: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  // Standardantagande: månatlig rapportering
  return {
    year,
    period: 'monthly',
    periodNumber: month,
    periodLabel: `${year}-${month.toString().padStart(2, '0')}`,
  };
}


