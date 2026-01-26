/**
 * Agent 2: Data Extractor
 * 
 * Ansvarar för att extrahera ALL relevant data från dokumentet.
 * Använder dokumenttypen från Agent 1 för att veta vad som ska extraheras.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { documentStore } from '../jobStore';
import { DocumentType } from './documentClassifier';

const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export interface ExtractedLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  netAmount: number;
  vatRate?: number;
  vatAmount?: number;
}

export interface ExtractedData {
  // Gemensamma fält
  supplier: string;
  supplierOrgNumber?: string;
  supplierCountry?: string;
  supplierVatId?: string;
  documentNumber: string;
  documentDate: string;
  currency: string;
  
  // Belopp
  totalAmount: number;
  netAmount?: number;
  vatAmount?: number;
  vatRate?: number;
  
  // Faktura-specifika
  dueDate?: string;
  paymentReference?: string; // OCR/bankgiro
  bankgiro?: string;
  plusgiro?: string;
  
  // Rader
  lineItems: ExtractedLineItem[];
  
  // Kvitto-specifika
  paymentMethod?: 'card' | 'cash' | 'swish' | 'invoice' | 'other';
  cardLastFour?: string;
  
  // Metadata
  rawTextSummary: string;
  extractionConfidence: number;
}

const EXTRACTION_PROMPTS: Record<DocumentType, string> = {
  INVOICE: `Du ska extrahera data från en FAKTURA (leverantörsfaktura).

FAKTURA är ett formellt kravdokument som skickas INNAN betalning sker.

EXTRAHERA:
1. LEVERANTÖR:
   - Företagsnamn (överst eller i sidhuvud)
   - Organisationsnummer (556xxx-xxxx) om svenskt bolag
   - OBSERVERA: Internationella bolag (USA, UK, etc.) saknar svenskt org.nr
   
2. FAKTURANUMMER:
   - Leta efter "Fakturanr", "Faktura nr", "Invoice no", "Invoice #"
   
3. DATUM:
   - Fakturadatum: när fakturan utfärdades
   - Förfallodatum: "Förfaller", "Betalas senast", "Due date", "Payment due"
   
4. BETALNINGSINFORMATION:
   - Bankgiro (BG): 5-8 siffror med bindestreck (endast svenska fakturor)
   - Plusgiro (PG): siffror (endast svenska fakturor)
   - OCR/Referensnummer: lång sifferserie för betalning
   - Internationella fakturor: IBAN, SWIFT, wire transfer info
   
5. VALUTA - KRITISKT VIKTIGT:
   - Leta efter valutasymbol vid beloppen: $, €, £, kr, SEK, USD, EUR, GBP
   - Amerikanska bolag (USA): Använder $ eller USD
   - Brittiska bolag: Använder £ eller GBP  
   - Europeiska bolag: Använder € eller EUR
   - Svenska bolag: Använder kr eller SEK
   - ANTA ALDRIG SEK för utländska leverantörer!
   
6. BELOPP:
   - Nettobelopp (exkl. moms/VAT/tax)
   - Momsbelopp och momssats (VAT, tax, moms)
   - Totalbelopp (inkl. moms)
   
7. FAKTURARADER:
   - Alla rader med beskrivning, antal, enhetspris och belopp`,

  RECEIPT: `Du ska extrahera data från ett KVITTO (kassakvitto/betalningsbekräftelse).

KVITTO är en bekräftelse på GENOMFÖRD betalning.

KRITISKA INSTRUKTIONER:

1. LEVERANTÖRSNAMN:
   - Butikens/restaurangens namn står ÖVERST på kvittot
   - Det är INTE kvittonumret, terminalnumret eller org.numret
   - Exempel: "Espresso House", "Circle K", "ICA Maxi", "Sturehof"
   
2. TOTALBELOPP:
   - Leta efter "TOTAL", "Summa", "Att betala", "Tot"
   - På restaurangkvitton: totalen står ofta FÖRE momsraden
   - Returnera som NUMMER (144.00 inte "144 kr")

3. MOMS:
   - Leta efter "Moms", "VAT", procent (25%, 12%, 6%)
   - Mat/restaurang: oftast 12%
   - Övrigt: oftast 25%
   - Böcker/tidningar: 6%
   
4. DATUM OCH TID:
   - Kvitton har ofta BÅDE datum OCH tid
   - "2024-01-15 14:32" → extrahera endast datum: "2024-01-15"
   
5. BETALNINGSMETOD:
   - "Kort", "VISA", "Mastercard" → "card"
   - "Kontant", "Cash" → "cash"  
   - "Swish" → "swish"
   - Om kortnummer syns: "****1234" → cardLastFour: "1234"

6. KVITTORADER:
   - Lista artiklarna som köpts
   - Restaurang: maträtter, drycker
   - Butik: produkter med ev. streckkod
   
7. FLERA KVITTON:
   - Om bilden har flera kvitton, extrahera ENDAST det VÄNSTRA/ÖVERSTA

EXEMPEL - Restaurangkvitto:
"Villa Romana" ← leverantör
"1 x Pasta Carbonara  145,00"
"1 x Coca-Cola         39,00"
"TOTAL                184,00" ← totalbelopp
"Moms 12%              19,71" ← momsbelopp
"VISA ****4521" ← paymentMethod: "card", cardLastFour: "4521"
"2024-03-23 19:45" ← datum`,

  BANK_STATEMENT: `Du ska extrahera data från ett KONTOUTDRAG. Fokusera på:
- Bankens namn
- Kontonummer
- Period (från-till datum)
- Ingående saldo
- Utgående saldo
- Alla transaktioner med datum, beskrivning och belopp`,

  CREDIT_NOTE: `Du ska extrahera data från en KREDITNOTA. Fokusera på:
- Leverantörsnamn
- Kreditnotanummer
- Datum
- Referens till ursprungsfaktura
- Krediterat belopp (negativt)
- Moms`,

  REMINDER: `Du ska extrahera data från en BETALNINGSPÅMINNELSE. Fokusera på:
- Leverantörsnamn
- Ursprungligt fakturanummer
- Ursprungligt belopp
- Påminnelseavgift
- Nytt totalbelopp
- Nytt förfallodatum`,

  CONTRACT: `Du ska extrahera data från ett AVTAL. Fokusera på:
- Avtalsparterna
- Avtalsdatum
- Avtalsperiod
- Belopp (om relevant)
- Betalningsvillkor`,

  OTHER: `Extrahera all relevant ekonomisk information du kan hitta:
- Eventuella belopp
- Datum
- Parter/företagsnamn
- Referensnummer`
};

/**
 * Extract data using vision (for images)
 */
export async function extractDataWithVision(
  s3Key: string,
  documentType: DocumentType,
  ocrText?: string
): Promise<ExtractedData> {
  const imageBuffer = await documentStore.getBuffer(s3Key);
  const base64Image = imageBuffer.toString('base64');
  
  const extension = s3Key.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaType = extension === 'png' ? 'image/png' : 
                    extension === 'gif' ? 'image/gif' :
                    extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const prompt = buildExtractionPrompt(documentType, ocrText);

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
  }));

  return parseExtractionResponse(response, documentType);
}

/**
 * Extract data using text only (for PDFs)
 */
export async function extractDataWithText(
  ocrText: string,
  documentType: DocumentType
): Promise<ExtractedData> {
  const prompt = buildExtractionPrompt(documentType, ocrText);

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  }));

  return parseExtractionResponse(response, documentType);
}

function buildExtractionPrompt(documentType: DocumentType, ocrText?: string): string {
  const typePrompt = EXTRACTION_PROMPTS[documentType] || EXTRACTION_PROMPTS.OTHER;
  
  return `Du är en expert på att läsa av svenska bokföringsunderlag.

${typePrompt}

KRITISKT VIKTIGT - FÖLJ DESSA REGLER:
1. LEVERANTÖRSNAMN: Läs EXAKT vad som står ÖVERST på dokumentet. Gissa ALDRIG!
2. TOTALBELOPP: Hitta raden med "Total", "Summa" eller "Att betala". Ange som NUMMER (144.00, inte "144 kr")
3. FLERA DOKUMENT: Om flera dokument syns, extrahera ENDAST det VÄNSTRA/ÖVERSTA
4. DATUM: Konvertera till YYYY-MM-DD format (t.ex. "23 mar 22" → "2022-03-23")
5. MOMS: Restauranger har oftast 12% moms, övriga 25%

VALUTA - KRITISKT VIKTIGT ATT IDENTIFIERA RÄTT:
- USD (Amerikanska dollar): "$", "USD", "US$", "dollar" → currency: "USD"
  VIKTIGT: Amerikanska bolag (t.ex. Anthropic, OpenAI, Google, AWS, Stripe) fakturerar ALLTID i USD!
- EUR (Euro): "€", "EUR", "euro" → currency: "EUR"  
- GBP (Brittiska pund): "£", "GBP", "pound" → currency: "GBP"
- SEK (Svenska kronor): "kr", "SEK", ":-", "kronor" → currency: "SEK"
- DKK (Danska kronor): "DKK" → currency: "DKK"
- NOK (Norska kronor): "NOK" → currency: "NOK"

LOGIK FÖR VALUTA:
1. Titta FÖRST på vilken valutasymbol som står vid beloppen ($, €, £, kr)
2. Titta på leverantörens land/ursprung
3. Anta ENDAST SEK om det är ett SVENSKT bolag med svensk adress

VIKTIGT OM BELOPP:
- Returnera alltid som nummer, inte sträng!
- "144,00" ska bli 144.00
- "1 234,56" ska bli 1234.56
- Om du INTE hittar beloppet, sätt till 0 och ange låg confidence

${ocrText ? `\nKOMPLETTERANDE OCR-TEXT:\n${ocrText.substring(0, 2000)}\n` : ''}

Svara ENDAST med JSON (alla belopp som nummer, inte strängar!):
{
  "supplier": "Restaurang/Butiksnamn som står ÖVERST på kvittot",
  "supplierOrgNumber": "556xxx-xxxx eller null",
  "supplierCountry": "Land (t.ex. Sweden, Sverige, USA, Germany) eller null om okänt",
  "supplierVatId": "VAT-nummer om det finns (t.ex. SE123..., DE123...) annars null",
  "documentNumber": "kvittonummer om det finns",
  "documentDate": "YYYY-MM-DD",
  "currency": "SEK eller EUR eller USD eller DKK eller NOK eller GBP",
  "detectedCurrencySymbol": "Skriv exakt vilken valutasymbol/text du såg (t.ex. '€', 'kr', '$')",
  "totalAmount": 144.00,
  "netAmount": 115.20,
  "vatAmount": 28.80,
  "vatRate": 25,
  "dueDate": null,
  "paymentReference": null,
  "bankgiro": null,
  "plusgiro": null,
  "paymentMethod": "card",
  "cardLastFour": "1234 eller null",
  "lineItems": [
    {
      "description": "Beskrivning av vara/tjänst",
      "quantity": 1,
      "unitPrice": 144.00,
      "netAmount": 115.20,
      "vatRate": 25,
      "vatAmount": 28.80
    }
  ],
  "rawTextSummary": "Kort beskrivning av vad kvittot gäller",
  "extractionConfidence": 0.85,
  "multipleDocumentsDetected": false
}`;
}

function parseExtractionResponse(response: { body: Uint8Array }, documentType: DocumentType): ExtractedData {
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const content = responseBody.content?.[0]?.text || '';
  
  console.log('[Extractor] Raw AI response:', content.substring(0, 500));
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[Extractor] No JSON found in response');
    return createEmptyExtraction(documentType);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    
    console.log('[Extractor] Parsed JSON:', {
      supplier: parsed.supplier,
      totalAmount: parsed.totalAmount,
      vatAmount: parsed.vatAmount,
      documentDate: parsed.documentDate,
    });
    
    // Parse amounts - handle both numbers and strings
    const totalAmount = parseNumber(parsed.totalAmount);
    const vatAmount = parsed.vatAmount ? parseNumber(parsed.vatAmount) : undefined;
    const netAmount = parsed.netAmount ? parseNumber(parsed.netAmount) : 
                      (totalAmount > 0 && vatAmount ? totalAmount - vatAmount : undefined);
    
    console.log('[Extractor] Parsed amounts:', { totalAmount, vatAmount, netAmount });
    
    // If total is 0 but we have line items, calculate from them
    let finalTotal = totalAmount;
    if (finalTotal === 0 && parsed.lineItems?.length > 0) {
      finalTotal = parsed.lineItems.reduce((sum: number, li: Record<string, unknown>) => {
        return sum + parseNumber(li.netAmount || li.amount || li.unitPrice || 0);
      }, 0);
      console.log('[Extractor] Calculated total from line items:', finalTotal);
    }
    
    // Normalize currency
    const detectedCurrency = normalizeCurrency(parsed.currency, parsed.detectedCurrencySymbol);
    console.log('[Extractor] Detected currency:', { 
      raw: parsed.currency, 
      symbol: parsed.detectedCurrencySymbol, 
      normalized: detectedCurrency 
    });
    
    return {
      supplier: parsed.supplier || 'Okänd',
      supplierOrgNumber: parsed.supplierOrgNumber || undefined,
      supplierCountry: parsed.supplierCountry || undefined,
      supplierVatId: parsed.supplierVatId || undefined,
      documentNumber: parsed.documentNumber || `AUTO-${Date.now()}`,
      documentDate: parseDate(parsed.documentDate),
      currency: detectedCurrency,
      totalAmount: finalTotal,
      netAmount,
      vatAmount,
      vatRate: parsed.vatRate || undefined,
      dueDate: parsed.dueDate ? parseDate(parsed.dueDate) : undefined,
      paymentReference: parsed.paymentReference || undefined,
      bankgiro: parsed.bankgiro || undefined,
      plusgiro: parsed.plusgiro || undefined,
      paymentMethod: parsed.paymentMethod || undefined,
      cardLastFour: parsed.cardLastFour || undefined,
      lineItems: (parsed.lineItems || []).map((li: Record<string, unknown>) => ({
        description: li.description as string || 'Okänd post',
        quantity: li.quantity as number || undefined,
        unitPrice: li.unitPrice as number || undefined,
        netAmount: parseNumber(li.netAmount),
        vatRate: li.vatRate as number || undefined,
        vatAmount: li.vatAmount ? parseNumber(li.vatAmount) : undefined,
      })),
      rawTextSummary: parsed.rawTextSummary || '',
      extractionConfidence: Math.min(1, Math.max(0, parsed.extractionConfidence || 0.7)),
    };
  } catch (error) {
    console.error('[Extractor] JSON parse error:', error);
    return createEmptyExtraction(documentType);
  }
}

function parseDate(value: unknown): string {
  if (!value || typeof value !== 'string') {
    return new Date().toISOString().split('T')[0];
  }
  
  const dateStr = value.trim();
  
  // Already in ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // European format: DD.MM.YYYY or DD/MM/YYYY
  const euroMatch = dateStr.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (euroMatch) {
    const [, day, month, year] = euroMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Swedish format: YYYY.MM.DD
  const sweMatch = dateStr.match(/^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})$/);
  if (sweMatch) {
    const [, year, month, day] = sweMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Swedish text format: "14 mars 2022", "23 mar 22", "ons 23 mar 22"
  const sweMonths: Record<string, string> = {
    'jan': '01', 'januari': '01',
    'feb': '02', 'februari': '02',
    'mar': '03', 'mars': '03',
    'apr': '04', 'april': '04',
    'maj': '05',
    'jun': '06', 'juni': '06',
    'jul': '07', 'juli': '07',
    'aug': '08', 'augusti': '08',
    'sep': '09', 'september': '09',
    'okt': '10', 'oktober': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12',
  };
  
  // Match patterns like "14 mars 2022" or "23 mar 22"
  const sweTextMatch = dateStr.toLowerCase().match(/(\d{1,2})\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec|januari|februari|mars|april|juni|juli|augusti|september|oktober|november|december)\s*(\d{2,4})/);
  if (sweTextMatch) {
    const [, day, monthStr, yearStr] = sweTextMatch;
    const month = sweMonths[monthStr] || '01';
    const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  
  // Try native parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove currency symbols and extra whitespace
    let cleaned = value.replace(/[^\d\s,.\-]/g, '').trim();
    
    // Handle different formats:
    // Swedish: "1 234,56" or "1234,56" (comma = decimal)
    // European thousand sep: "1.234,56" (dot = thousand, comma = decimal)
    // US format: "1,234.56" (comma = thousand, dot = decimal)
    // Simple: "1049" or "1,049" (comma could be thousand or decimal)
    
    // Remove spaces (thousand separators in Swedish)
    cleaned = cleaned.replace(/\s/g, '');
    
    // Check if it's European format (dot as thousand sep, comma as decimal)
    if (/^\d{1,3}\.\d{3}(,\d+)?$/.test(cleaned)) {
      // "1.234,56" → "1234.56"
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Check if comma is followed by exactly 3 digits (likely thousand separator)
    else if (/^\d{1,3},\d{3}$/.test(cleaned)) {
      // "1,049" where it means 1049 (no decimals) - thousand separator
      cleaned = cleaned.replace(',', '');
    }
    // Check if comma is followed by 1-2 digits (decimal separator)
    else if (/,\d{1,2}$/.test(cleaned)) {
      // "123,45" → "123.45"
      cleaned = cleaned.replace(',', '.');
    }
    // Fallback: treat comma as decimal
    else {
      cleaned = cleaned.replace(',', '.');
    }
    
    const result = parseFloat(cleaned) || 0;
    
    // Sanity check: if result is very small (< 1) but original had large numbers, something went wrong
    if (result > 0 && result < 1) {
      // Try parsing as integer (remove all non-digits except minus)
      const intValue = parseInt(value.toString().replace(/[^\d\-]/g, ''), 10);
      if (intValue > 100) {
        return intValue;
      }
    }
    
    return result;
  }
  return 0;
}

/**
 * Normalize currency to standard ISO code
 */
function normalizeCurrency(currency?: string, detectedSymbol?: string): string {
  // First check the detected symbol
  if (detectedSymbol) {
    const symbolLower = detectedSymbol.toLowerCase().trim();
    
    // Euro
    if (symbolLower === '€' || symbolLower.includes('eur') || symbolLower === 'euro') {
      return 'EUR';
    }
    
    // US Dollar
    if (symbolLower === '$' || symbolLower === 'usd' || symbolLower.includes('dollar')) {
      return 'USD';
    }
    
    // British Pound
    if (symbolLower === '£' || symbolLower === 'gbp' || symbolLower.includes('pound')) {
      return 'GBP';
    }
    
    // Danish Krone
    if (symbolLower === 'dkk' || (symbolLower === 'kr' && currency?.toUpperCase() === 'DKK')) {
      return 'DKK';
    }
    
    // Norwegian Krone
    if (symbolLower === 'nok' || (symbolLower === 'kr' && currency?.toUpperCase() === 'NOK')) {
      return 'NOK';
    }
    
    // Swedish Krona (default for "kr", ":-", "kronor")
    if (symbolLower === 'kr' || symbolLower === ':-' || symbolLower.includes('kronor') || symbolLower === 'sek') {
      return 'SEK';
    }
  }
  
  // Fall back to currency field
  if (currency) {
    const currencyUpper = currency.toUpperCase().trim();
    
    // Check for valid ISO codes
    const validCurrencies = ['SEK', 'EUR', 'USD', 'GBP', 'DKK', 'NOK', 'CHF', 'JPY'];
    if (validCurrencies.includes(currencyUpper)) {
      return currencyUpper;
    }
    
    // Check for common variations
    if (currencyUpper.includes('EURO') || currencyUpper === 'E') return 'EUR';
    if (currencyUpper.includes('DOLLAR') || currencyUpper === 'US') return 'USD';
    if (currencyUpper.includes('KRONOR') || currencyUpper === 'KR') return 'SEK';
    if (currencyUpper.includes('POUND') || currencyUpper === 'STERLING') return 'GBP';
  }
  
  // Default to SEK for Swedish documents
  return 'SEK';
}

function createEmptyExtraction(documentType: DocumentType): ExtractedData {
  return {
    supplier: 'Okänd',
    documentNumber: `AUTO-${Date.now()}`,
    documentDate: new Date().toISOString().split('T')[0],
    currency: 'SEK',
    totalAmount: 0,
    lineItems: [],
    rawTextSummary: `Kunde inte extrahera data från ${documentType}`,
    extractionConfidence: 0.5, // Höjd från 0.3 - låt andra faktorer påverka mer
  };
}

