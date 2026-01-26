/**
 * Salary Specification Classifier & Extractor
 * 
 * Klassificerar och extraherar data från lönespecifikationer.
 * Stödjer svenska lönespecar med:
 * - Grundlön
 * - Tillägg (OB, övertid, provision, etc.)
 * - Avdrag (skatt, pension, fackavgift, etc.)
 * - Arbetsgivaravgifter
 * - Semesterdagar
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const bedrockClient = new BedrockRuntimeClient({ region: REGION });

export interface SalarySpecification {
  // Identifikation
  employeeName: string;
  employeeId?: string;
  personalNumber?: string; // Personnummer
  period: string; // "2024-01" format
  payDate: string; // Utbetalningsdatum
  
  // Lönedelar
  grossSalary: number; // Bruttolön
  netSalary: number; // Nettolön
  
  // Inkomster
  earnings: {
    type: string;
    description: string;
    amount: number;
    hours?: number;
    rate?: number;
  }[];
  
  // Avdrag
  deductions: {
    type: string;
    description: string;
    amount: number;
  }[];
  
  // Skatter
  taxes: {
    incomeTax: number; // Preliminärskatt
    taxTable?: string; // Skattetabell
    taxColumn?: string; // Kolumn
  };
  
  // Semester
  vacation: {
    earnedDays?: number;
    usedDays?: number;
    remainingDays?: number;
    vacationPay?: number;
  };
  
  // Arbetsgivaravgifter (för bokföring)
  employerContributions: {
    total: number;
    socialFees: number; // Arbetsgivaravgift
    pensionFees: number; // Tjänstepension
    other: number;
  };
  
  // Bokföring
  accounting: {
    salaryAccount: string;
    taxAccount: string;
    employerContributionAccount: string;
    bankAccount: string;
  };
  
  // Meta
  confidence: number;
  documentLanguage: string;
  warnings: string[];
}

// Svenska lönetyper
const SWEDISH_EARNING_TYPES: Record<string, { account: string; description: string }> = {
  'grundlön': { account: '7010', description: 'Löner till tjänstemän' },
  'månadslön': { account: '7010', description: 'Löner till tjänstemän' },
  'timlön': { account: '7010', description: 'Löner till tjänstemän' },
  'ob-tillägg': { account: '7010', description: 'OB-tillägg' },
  'övertid': { account: '7010', description: 'Övertidsersättning' },
  'provision': { account: '7010', description: 'Provision' },
  'bonus': { account: '7010', description: 'Bonus' },
  'semesterlön': { account: '7010', description: 'Semesterlön' },
  'semestertillägg': { account: '7010', description: 'Semestertillägg' },
  'sjuklön': { account: '7010', description: 'Sjuklön' },
  'föräldralön': { account: '7010', description: 'Föräldralön' },
  'restidsersättning': { account: '7010', description: 'Restidsersättning' },
  'traktamente': { account: '7010', description: 'Traktamente' },
  'bilersättning': { account: '7320', description: 'Bilersättning' },
};

const SWEDISH_DEDUCTION_TYPES: Record<string, { account: string; description: string }> = {
  'preliminärskatt': { account: '2710', description: 'Personalskatt' },
  'skatt': { account: '2710', description: 'Personalskatt' },
  'fackavgift': { account: '7090', description: 'Fackavgift' },
  'pension': { account: '7412', description: 'Tjänstepension' },
  'nettolöneavdrag': { account: '2890', description: 'Nettolöneavdrag' },
  'förmånsbil': { account: '7385', description: 'Förmån bil' },
};

const EXTRACTION_PROMPT = `Du är expert på svenska lönespecifikationer. Extrahera all data från denna lönespec.

VIKTIGA FÄLT ATT HITTA:
1. ANSTÄLLD: Namn, anställningsnummer, personnummer
2. PERIOD: Vilken månad/period avser lönen
3. UTBETALNINGSDAG: När betalas lönen ut

4. INKOMSTER (lista alla):
   - Grundlön/Månadslön
   - Tillägg (OB, övertid, provision, bonus)
   - Semesterersättning
   - Reseersättning, traktamente
   - Förmåner

5. AVDRAG (lista alla):
   - Preliminärskatt
   - Fackavgift
   - Pensionsavdrag
   - Andra avdrag

6. SUMMOR:
   - Bruttolön (före skatt)
   - Nettolön (utbetalt belopp)

7. SEMESTER:
   - Intjänade dagar
   - Använda dagar
   - Kvarstående dagar

8. ARBETSGIVARAVGIFTER (om de visas):
   - Sociala avgifter
   - Pensionsavsättningar

Svara ENDAST med JSON:
{
  "employeeName": "string",
  "employeeId": "string eller null",
  "personalNumber": "YYMMDD-XXXX eller null",
  "period": "YYYY-MM",
  "payDate": "YYYY-MM-DD",
  "grossSalary": nummer,
  "netSalary": nummer,
  "earnings": [
    {
      "type": "grundlön|ob|övertid|etc",
      "description": "beskrivning",
      "amount": nummer,
      "hours": nummer eller null,
      "rate": nummer eller null
    }
  ],
  "deductions": [
    {
      "type": "skatt|fackavgift|pension|etc",
      "description": "beskrivning",
      "amount": nummer
    }
  ],
  "incomeTax": nummer,
  "taxTable": "string eller null",
  "vacationEarnedDays": nummer eller null,
  "vacationUsedDays": nummer eller null,
  "vacationRemainingDays": nummer eller null,
  "employerSocialFees": nummer eller null,
  "employerPensionFees": nummer eller null,
  "confidence": 0.0-1.0,
  "warnings": ["eventuella varningar"]
}`;

/**
 * Classify if document is a salary specification
 */
export async function isSalarySpecification(
  imageBase64: string
): Promise<{ isSalary: boolean; confidence: number }> {
  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            {
              type: 'text',
              text: `Är detta en LÖNESPECIFIKATION (lönebesked, löneutbetalning)?

Tecken på lönespec:
- "Lönespecifikation", "Lönebesked", "Löneutbetalning"
- Bruttolön, Nettolön
- Preliminärskatt
- Anställds namn/personnummer
- Period (månad/år)

Svara med JSON: { "isSalary": true/false, "confidence": 0.0-1.0, "reason": "kort förklaring" }`,
            },
          ],
        }],
      }),
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        isSalary: Boolean(result.isSalary),
        confidence: result.confidence || 0.5,
      };
    }
  } catch (error) {
    console.error('[SalaryClassifier] Error:', error);
  }
  
  return { isSalary: false, confidence: 0 };
}

/**
 * Extract salary specification data
 */
export async function extractSalarySpecification(
  imageBase64: string
): Promise<SalarySpecification> {
  const warnings: string[] = [];
  
  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Kunde inte parsa svar');
    }
    
    const data = JSON.parse(jsonMatch[0]);
    
    // Build structured result
    const spec: SalarySpecification = {
      employeeName: data.employeeName || 'Okänd',
      employeeId: data.employeeId,
      personalNumber: maskPersonalNumber(data.personalNumber),
      period: data.period || getCurrentPeriod(),
      payDate: data.payDate || '',
      
      grossSalary: parseNumber(data.grossSalary),
      netSalary: parseNumber(data.netSalary),
      
      earnings: (data.earnings || []).map((e: any) => ({
        type: e.type || 'other',
        description: e.description || '',
        amount: parseNumber(e.amount),
        hours: e.hours ? parseNumber(e.hours) : undefined,
        rate: e.rate ? parseNumber(e.rate) : undefined,
      })),
      
      deductions: (data.deductions || []).map((d: any) => ({
        type: d.type || 'other',
        description: d.description || '',
        amount: parseNumber(d.amount),
      })),
      
      taxes: {
        incomeTax: parseNumber(data.incomeTax),
        taxTable: data.taxTable,
        taxColumn: data.taxColumn,
      },
      
      vacation: {
        earnedDays: data.vacationEarnedDays,
        usedDays: data.vacationUsedDays,
        remainingDays: data.vacationRemainingDays,
      },
      
      employerContributions: {
        total: parseNumber(data.employerSocialFees) + parseNumber(data.employerPensionFees),
        socialFees: parseNumber(data.employerSocialFees),
        pensionFees: parseNumber(data.employerPensionFees),
        other: 0,
      },
      
      // Standard Swedish accounts
      accounting: {
        salaryAccount: '7010', // Löner till tjänstemän
        taxAccount: '2710',    // Personalens källskatt
        employerContributionAccount: '7510', // Arbetsgivaravgifter
        bankAccount: '1930',   // Företagskonto
      },
      
      confidence: data.confidence || 0.7,
      documentLanguage: 'sv',
      warnings: data.warnings || [],
    };
    
    // Validate
    if (!spec.grossSalary || spec.grossSalary === 0) {
      warnings.push('Kunde inte hitta bruttolön');
    }
    if (!spec.netSalary || spec.netSalary === 0) {
      warnings.push('Kunde inte hitta nettolön');
    }
    if (Math.abs(spec.grossSalary - spec.netSalary - spec.taxes.incomeTax) > 100) {
      warnings.push('Brutto - Skatt ≠ Netto (kontrollera manuellt)');
    }
    
    spec.warnings = [...spec.warnings, ...warnings];
    
    return spec;
  } catch (error) {
    console.error('[SalaryExtractor] Error:', error);
    
    return {
      employeeName: 'Okänd',
      period: getCurrentPeriod(),
      payDate: '',
      grossSalary: 0,
      netSalary: 0,
      earnings: [],
      deductions: [],
      taxes: { incomeTax: 0 },
      vacation: {},
      employerContributions: { total: 0, socialFees: 0, pensionFees: 0, other: 0 },
      accounting: {
        salaryAccount: '7010',
        taxAccount: '2710',
        employerContributionAccount: '7510',
        bankAccount: '1930',
      },
      confidence: 0,
      documentLanguage: 'sv',
      warnings: ['Kunde inte extrahera data från lönespecifikationen'],
    };
  }
}

/**
 * Generate accounting voucher for salary
 */
export function generateSalaryVoucher(spec: SalarySpecification): {
  description: string;
  transactionDate: string;
  rows: { account: string; debit: number; credit: number; description: string }[];
} {
  const rows: { account: string; debit: number; credit: number; description: string }[] = [];
  
  // Debit: Lönekostnad
  rows.push({
    account: spec.accounting.salaryAccount,
    debit: spec.grossSalary,
    credit: 0,
    description: `Lön ${spec.period} - ${spec.employeeName}`,
  });
  
  // Credit: Skattskuld
  rows.push({
    account: spec.accounting.taxAccount,
    debit: 0,
    credit: spec.taxes.incomeTax,
    description: 'Personalskatt',
  });
  
  // Credit: Nettolön till bankkonto
  rows.push({
    account: spec.accounting.bankAccount,
    debit: 0,
    credit: spec.netSalary,
    description: 'Nettolön utbetalning',
  });
  
  // Övriga avdrag
  const otherDeductions = spec.grossSalary - spec.taxes.incomeTax - spec.netSalary;
  if (Math.abs(otherDeductions) > 1) {
    rows.push({
      account: '2890', // Övriga skulder
      debit: 0,
      credit: otherDeductions,
      description: 'Övriga löneavdrag',
    });
  }
  
  // Arbetsgivaravgifter (separat verifikat)
  if (spec.employerContributions.total > 0) {
    rows.push({
      account: spec.accounting.employerContributionAccount,
      debit: spec.employerContributions.total,
      credit: 0,
      description: 'Arbetsgivaravgifter',
    });
    rows.push({
      account: '2730', // Lagstadgade sociala avgifter
      debit: 0,
      credit: spec.employerContributions.total,
      description: 'Skuld arbetsgivaravgifter',
    });
  }
  
  return {
    description: `Lön ${spec.period} - ${spec.employeeName}`,
    transactionDate: spec.payDate || new Date().toISOString().split('T')[0],
    rows,
  };
}

// Helpers
function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const cleaned = value.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function maskPersonalNumber(pn: string | null): string | undefined {
  if (!pn) return undefined;
  // Mask last 4 digits for privacy: YYMMDD-XXXX -> YYMMDD-****
  return pn.replace(/(\d{6}[-]?)(\d{4})/, '$1****');
}















