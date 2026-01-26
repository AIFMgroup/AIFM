/**
 * Line Item Extractor Service
 * 
 * Avancerad extraktion av fakturarader med stöd för:
 * - Artikelnummer
 * - Kvantitet och enhetspris
 * - Rabatter
 * - Validering mot totalsumma
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { VAT_RATES, VatRateType, detectVatRate, calculateVatFromGross } from './vatCalculator';
import { hittaBastaKonto } from '../basKontoplan';

const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export interface ExtractedLineItem {
  // Identifiering
  lineNumber: number;
  articleNumber?: string;
  
  // Beskrivning
  description: string;
  unit?: string;
  
  // Kvantitet & Pris
  quantity: number;
  unitPrice: number;
  
  // Belopp
  lineTotal: number;
  netAmount: number;
  vatAmount: number;
  vatRate: number;
  grossAmount: number;
  
  // Rabatt
  discountPercent?: number;
  discountAmount?: number;
  
  // Kontomappning
  suggestedAccount: string;
  suggestedAccountName: string;
  accountConfidence: number;
  
  // Metadata
  rawText?: string;
  confidence: number;
}

export interface LineItemExtractionResult {
  success: boolean;
  lineItems: ExtractedLineItem[];
  summary: {
    totalLines: number;
    totalNetAmount: number;
    totalVatAmount: number;
    totalGrossAmount: number;
    totalDiscount: number;
    vatBreakdown: { rate: number; amount: number }[];
  };
  validation: {
    isBalanced: boolean;
    expectedTotal: number;
    calculatedTotal: number;
    difference: number;
    issues: string[];
  };
}

/**
 * Extrahera fakturarader från OCR-text
 */
export async function extractLineItems(
  ocrText: string,
  expectedTotal?: number,
  currency: string = 'SEK'
): Promise<LineItemExtractionResult> {
  try {
    // 1. Använd AI för initial extraktion
    const aiExtraction = await extractWithAI(ocrText);
    
    if (!aiExtraction.success || aiExtraction.lines.length === 0) {
      return createEmptyResult('Kunde inte extrahera rader från dokumentet');
    }

    // 2. Bearbeta och validera varje rad
    const lineItems: ExtractedLineItem[] = [];
    let lineNumber = 1;

    for (const line of aiExtraction.lines) {
      const processed = processLineItem(line, lineNumber);
      if (processed) {
        lineItems.push(processed);
        lineNumber++;
      }
    }

    // 3. Beräkna summeringar
    const summary = calculateSummary(lineItems);

    // 4. Validera mot förväntad total
    const validation = validateAgainstTotal(lineItems, expectedTotal);

    // 5. Om det inte balanserar, försök justera
    if (!validation.isBalanced && Math.abs(validation.difference) < 10) {
      // Liten differens - justera sista raden
      adjustForRounding(lineItems, validation.difference);
      validation.isBalanced = true;
      validation.difference = 0;
    }

    return {
      success: true,
      lineItems,
      summary,
      validation,
    };

  } catch (error) {
    console.error('[LineItemExtractor] Error:', error);
    return createEmptyResult(error instanceof Error ? error.message : 'Okänt fel');
  }
}

/**
 * Validera och korrigera extraherade rader
 */
export function validateAndCorrectLines(
  lines: ExtractedLineItem[],
  expectedTotal: number
): { corrected: ExtractedLineItem[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const corrected = [...lines];

  // 1. Kontrollera att alla rader har positiva belopp
  for (const line of corrected) {
    if (line.netAmount < 0) {
      line.netAmount = Math.abs(line.netAmount);
      adjustments.push(`Rad ${line.lineNumber}: Negativ nettosumma korrigerad`);
    }
  }

  // 2. Kontrollera momsberäkning per rad
  for (const line of corrected) {
    const expectedVat = calculateVatFromGross(line.grossAmount, line.vatRate);
    if (Math.abs(line.vatAmount - expectedVat.vatAmount) > 0.5) {
      const oldVat = line.vatAmount;
      line.vatAmount = expectedVat.vatAmount;
      line.netAmount = expectedVat.netAmount;
      adjustments.push(`Rad ${line.lineNumber}: Moms korrigerad från ${oldVat} till ${line.vatAmount}`);
    }
  }

  // 3. Kontrollera att kvantitet * enhetspris = radsumma
  for (const line of corrected) {
    if (line.quantity > 0 && line.unitPrice > 0) {
      const calculatedTotal = line.quantity * line.unitPrice;
      const discountedTotal = calculatedTotal * (1 - (line.discountPercent || 0) / 100);
      
      if (Math.abs(discountedTotal - line.lineTotal) > 1) {
        adjustments.push(`Rad ${line.lineNumber}: Kvantitet × Pris matchar inte radsumma`);
      }
    }
  }

  // 4. Balansera mot förväntad total
  const currentTotal = corrected.reduce((sum, l) => sum + l.grossAmount, 0);
  const diff = expectedTotal - currentTotal;

  if (Math.abs(diff) > 0 && Math.abs(diff) < 100) {
    // Fördela differensen på raderna proportionellt
    const proportion = diff / currentTotal;
    for (const line of corrected) {
      const adjustment = Math.round(line.grossAmount * proportion * 100) / 100;
      line.grossAmount += adjustment;
      // Justera netto/moms proportionellt
      const vatPart = line.grossAmount * (line.vatRate / (1 + line.vatRate));
      line.vatAmount = Math.round(vatPart * 100) / 100;
      line.netAmount = line.grossAmount - line.vatAmount;
    }
    adjustments.push(`Justerade rader proportionellt för att matcha total (${diff.toFixed(2)} kr)`);
  }

  return { corrected, adjustments };
}

/**
 * Gruppera rader efter momssats för momsrapportering
 */
export function groupByVatRate(lines: ExtractedLineItem[]): Record<number, {
  lines: ExtractedLineItem[];
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
}> {
  const groups: Record<number, {
    lines: ExtractedLineItem[];
    netTotal: number;
    vatTotal: number;
    grossTotal: number;
  }> = {};

  for (const line of lines) {
    const rate = line.vatRate;
    
    if (!groups[rate]) {
      groups[rate] = { lines: [], netTotal: 0, vatTotal: 0, grossTotal: 0 };
    }
    
    groups[rate].lines.push(line);
    groups[rate].netTotal += line.netAmount;
    groups[rate].vatTotal += line.vatAmount;
    groups[rate].grossTotal += line.grossAmount;
  }

  // Avrunda totaler
  for (const group of Object.values(groups)) {
    group.netTotal = Math.round(group.netTotal * 100) / 100;
    group.vatTotal = Math.round(group.vatTotal * 100) / 100;
    group.grossTotal = Math.round(group.grossTotal * 100) / 100;
  }

  return groups;
}

/**
 * Generera bokföringsrader från extraherade rader
 */
export function generateVoucherLines(lines: ExtractedLineItem[]): {
  account: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  vatRate?: number;
}[] {
  const voucherLines: ReturnType<typeof generateVoucherLines> = [];
  const grouped = groupByVatRate(lines);

  for (const [rate, group] of Object.entries(grouped)) {
    const vatRate = parseFloat(rate);
    
    // Gruppera per konto
    const accountGroups: Record<string, { amount: number; descriptions: string[] }> = {};
    
    for (const line of group.lines) {
      if (!accountGroups[line.suggestedAccount]) {
        accountGroups[line.suggestedAccount] = { amount: 0, descriptions: [] };
      }
      accountGroups[line.suggestedAccount].amount += line.netAmount;
      accountGroups[line.suggestedAccount].descriptions.push(line.description);
    }

    // Skapa kostnadsrader
    for (const [account, data] of Object.entries(accountGroups)) {
      const accountInfo = hittaBastaKonto(data.descriptions[0]);
      voucherLines.push({
        account,
        accountName: accountInfo?.namn || 'Kostnad',
        debit: Math.round(data.amount * 100) / 100,
        credit: 0,
        description: data.descriptions.length > 1 
          ? `${data.descriptions[0]} m.fl.` 
          : data.descriptions[0],
        vatRate,
      });
    }

    // Skapa momsrad (om moms finns)
    if (group.vatTotal > 0) {
      const vatAccountMap: Record<number, { account: string; name: string }> = {
        0.25: { account: '2641', name: 'Ingående moms 25%' },
        0.12: { account: '2642', name: 'Ingående moms 12%' },
        0.06: { account: '2643', name: 'Ingående moms 6%' },
      };

      const vatAccount = vatAccountMap[vatRate] || { account: '2640', name: 'Ingående moms' };
      
      voucherLines.push({
        account: vatAccount.account,
        accountName: vatAccount.name,
        debit: group.vatTotal,
        credit: 0,
        description: `Ingående moms ${Math.round(vatRate * 100)}%`,
        vatRate,
      });
    }
  }

  return voucherLines;
}

// ============ Interna hjälpfunktioner ============

async function extractWithAI(ocrText: string): Promise<{
  success: boolean;
  lines: Partial<ExtractedLineItem>[];
}> {
  const prompt = `Du är expert på att extrahera fakturarader. Analysera följande OCR-text och extrahera ALLA fakturarader.

OCR-TEXT:
${ocrText.slice(0, 4000)} ${ocrText.length > 4000 ? '... [trunkerad]' : ''}

För varje rad, extrahera:
- description: Beskrivning/artikelnamn
- articleNumber: Artikelnummer (om finns)
- quantity: Antal (default 1)
- unit: Enhet (st, kg, tim, etc.)
- unitPrice: Styckpris
- lineTotal: Radbelopp (inkl. ev. rabatt)
- discountPercent: Rabattprocent (om finns)
- vatRate: Momssats (0.25, 0.12, 0.06, eller 0)

VIKTIGT:
- Extrahera ALLA rader, inte bara de första
- Belopp ska vara NUMBER, inte STRING
- Om momsen inte anges explicit, anta 25%
- Hoppa över rubrikrader, summeringsrader och fraktrader (om inte frakten är separat)

Svara ENDAST med JSON-array:
[
  {
    "description": "...",
    "articleNumber": "...",
    "quantity": 1,
    "unit": "st",
    "unitPrice": 100,
    "lineTotal": 100,
    "discountPercent": 0,
    "vatRate": 0.25
  }
]`;

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text || '';

    // Extrahera JSON-array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { success: true, lines: parsed };
    }

    return { success: false, lines: [] };

  } catch (error) {
    console.error('[LineItemExtractor] AI extraction error:', error);
    return { success: false, lines: [] };
  }
}

function processLineItem(raw: Partial<ExtractedLineItem>, lineNumber: number): ExtractedLineItem | null {
  if (!raw.description) return null;

  const quantity = raw.quantity || 1;
  const unitPrice = raw.unitPrice || 0;
  const discountPercent = raw.discountPercent || 0;
  const vatRate = raw.vatRate || 0.25;

  // Beräkna belopp
  let lineTotal = raw.lineTotal || (quantity * unitPrice);
  const discountAmount = lineTotal * (discountPercent / 100);
  lineTotal -= discountAmount;

  const { netAmount, vatAmount } = calculateVatFromGross(lineTotal, vatRate);
  const grossAmount = lineTotal;

  // Hitta lämpligt konto
  const accountMatch = hittaBastaKonto(raw.description);
  const suggestedAccount = accountMatch?.konto || '4010';
  const suggestedAccountName = accountMatch?.namn || 'Inköp';

  return {
    lineNumber,
    articleNumber: raw.articleNumber,
    description: raw.description,
    unit: raw.unit || 'st',
    quantity,
    unitPrice,
    lineTotal: Math.round(lineTotal * 100) / 100,
    netAmount: Math.round(netAmount * 100) / 100,
    vatAmount: Math.round(vatAmount * 100) / 100,
    vatRate,
    grossAmount: Math.round(grossAmount * 100) / 100,
    discountPercent,
    discountAmount: Math.round(discountAmount * 100) / 100,
    suggestedAccount,
    suggestedAccountName,
    accountConfidence: accountMatch ? 0.8 : 0.5,
    rawText: raw.rawText,
    confidence: 0.85,
  };
}

function calculateSummary(lines: ExtractedLineItem[]): LineItemExtractionResult['summary'] {
  const vatBreakdownMap: Record<number, number> = {};

  let totalNetAmount = 0;
  let totalVatAmount = 0;
  let totalGrossAmount = 0;
  let totalDiscount = 0;

  for (const line of lines) {
    totalNetAmount += line.netAmount;
    totalVatAmount += line.vatAmount;
    totalGrossAmount += line.grossAmount;
    totalDiscount += line.discountAmount || 0;

    // Gruppera moms
    const rate = Math.round(line.vatRate * 100);
    vatBreakdownMap[rate] = (vatBreakdownMap[rate] || 0) + line.vatAmount;
  }

  const vatBreakdown = Object.entries(vatBreakdownMap).map(([rate, amount]) => ({
    rate: parseInt(rate),
    amount: Math.round(amount * 100) / 100,
  }));

  return {
    totalLines: lines.length,
    totalNetAmount: Math.round(totalNetAmount * 100) / 100,
    totalVatAmount: Math.round(totalVatAmount * 100) / 100,
    totalGrossAmount: Math.round(totalGrossAmount * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    vatBreakdown,
  };
}

function validateAgainstTotal(
  lines: ExtractedLineItem[],
  expectedTotal?: number
): LineItemExtractionResult['validation'] {
  const calculatedTotal = lines.reduce((sum, l) => sum + l.grossAmount, 0);
  const expected = expectedTotal || calculatedTotal;
  const difference = expected - calculatedTotal;
  const issues: string[] = [];

  if (Math.abs(difference) > 1) {
    issues.push(`Total matchar inte: Förväntat ${expected}, Beräknat ${calculatedTotal.toFixed(2)}`);
  }

  // Kolla om moms ser rimlig ut
  const totalVat = lines.reduce((sum, l) => sum + l.vatAmount, 0);
  const totalNet = lines.reduce((sum, l) => sum + l.netAmount, 0);
  const avgVatRate = totalNet > 0 ? totalVat / totalNet : 0;

  if (avgVatRate > 0.26) {
    issues.push('Genomsnittlig momssats verkar för hög');
  } else if (avgVatRate < 0.05 && avgVatRate > 0) {
    issues.push('Genomsnittlig momssats verkar för låg');
  }

  return {
    isBalanced: Math.abs(difference) <= 1,
    expectedTotal: expected,
    calculatedTotal: Math.round(calculatedTotal * 100) / 100,
    difference: Math.round(difference * 100) / 100,
    issues,
  };
}

function adjustForRounding(lines: ExtractedLineItem[], difference: number): void {
  if (lines.length === 0) return;
  
  // Justera sista raden
  const lastLine = lines[lines.length - 1];
  lastLine.grossAmount += difference;
  
  // Fördela på netto och moms
  const vatPart = lastLine.grossAmount * (lastLine.vatRate / (1 + lastLine.vatRate));
  lastLine.vatAmount = Math.round(vatPart * 100) / 100;
  lastLine.netAmount = Math.round((lastLine.grossAmount - lastLine.vatAmount) * 100) / 100;
}

function createEmptyResult(error: string): LineItemExtractionResult {
  return {
    success: false,
    lineItems: [],
    summary: {
      totalLines: 0,
      totalNetAmount: 0,
      totalVatAmount: 0,
      totalGrossAmount: 0,
      totalDiscount: 0,
      vatBreakdown: [],
    },
    validation: {
      isBalanced: false,
      expectedTotal: 0,
      calculatedTotal: 0,
      difference: 0,
      issues: [error],
    },
  };
}


