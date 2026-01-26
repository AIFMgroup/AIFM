/**
 * Agent 3: Fortnox Mapper
 * 
 * Ansvarar för att mappa extraherad data till rätt BAS-konton
 * och förbereda verifikationer för Fortnox.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DocumentType } from './documentClassifier';
import { ExtractedData, ExtractedLineItem } from './dataExtractor';
import { allaKonton, hittaBastaKonto, vanligaKostnadskonton } from '../basKontoplan';

const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export interface AccountSuggestion {
  account: string;
  accountName: string;
  confidence: number;
  reasoning: string;
}

export interface VoucherLine {
  account: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  costCenter?: string;
  project?: string;
}

export interface FortnoxMapping {
  // Dokumentinfo
  documentType: DocumentType;
  voucherType: 'SUPPLIER_INVOICE' | 'RECEIPT' | 'BANK' | 'JOURNAL' | 'OTHER';
  
  // Verifikation
  voucherDate: string;
  voucherText: string;
  voucherLines: VoucherLine[];
  
  // Leverantörsreskontra (för fakturor)
  supplierInvoice?: {
    supplierName: string;
    supplierOrgNumber?: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    paymentReference?: string;
  };
  
  // Kontoförslag per rad
  lineItemMappings: {
    description: string;
    amount: number;
    suggestedAccount: AccountSuggestion;
    alternativeAccounts: AccountSuggestion[];
    suggestedCostCenter: string | null;
  }[];
  
  // Kostnadsställe för hela dokumentet
  suggestedCostCenter: string | null;
  
  // Metadata
  overallConfidence: number;
  warnings: string[];
  requiresReview: boolean;
}

// Vanliga leverantörer och deras typiska konton + kostnadsställe
const SUPPLIER_ACCOUNT_MAP: Record<string, { account: string; category: string; costCenter?: string }> = {
  // IT & Molntjänster
  'aws': { account: '6250', category: 'IT-tjänster, molninfrastruktur', costCenter: 'IT' },
  'amazon web services': { account: '6250', category: 'IT-tjänster, molninfrastruktur', costCenter: 'IT' },
  'microsoft': { account: '6250', category: 'IT-tjänster, programvara', costCenter: 'IT' },
  'azure': { account: '6250', category: 'IT-tjänster, molninfrastruktur', costCenter: 'IT' },
  'google': { account: '6250', category: 'IT-tjänster', costCenter: 'IT' },
  'google cloud': { account: '6250', category: 'IT-tjänster, molninfrastruktur', costCenter: 'IT' },
  'slack': { account: '6250', category: 'IT-tjänster, kommunikation', costCenter: 'IT' },
  'notion': { account: '6250', category: 'IT-tjänster, produktivitet', costCenter: 'IT' },
  'figma': { account: '6250', category: 'IT-tjänster, design', costCenter: 'IT' },
  'github': { account: '6250', category: 'IT-tjänster, utveckling', costCenter: 'IT' },
  'vercel': { account: '6250', category: 'IT-tjänster, hosting', costCenter: 'IT' },
  'heroku': { account: '6250', category: 'IT-tjänster, hosting', costCenter: 'IT' },
  'openai': { account: '6250', category: 'IT-tjänster, AI', costCenter: 'IT' },
  'anthropic': { account: '6250', category: 'IT-tjänster, AI', costCenter: 'IT' },
  
  // Elektronik & Kontor
  'elgiganten': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'KONTOR' },
  'mediamarkt': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'KONTOR' },
  'netonnet': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'KONTOR' },
  'inet': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'IT' },
  'komplett': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'IT' },
  'dustin': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'IT' },
  'kjell': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'KONTOR' },
  'clas ohlson': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'KONTOR' },
  'ikea': { account: '5410', category: 'Förbrukningsinventarier', costCenter: 'KONTOR' },
  'staples': { account: '5460', category: 'Kontorsmaterial', costCenter: 'KONTOR' },
  'lyreco': { account: '5460', category: 'Kontorsmaterial', costCenter: 'KONTOR' },
  
  // Resor
  'sas': { account: '5800', category: 'Resekostnader, flyg', costCenter: 'RESA' },
  'norwegian': { account: '5800', category: 'Resekostnader, flyg', costCenter: 'RESA' },
  'lufthansa': { account: '5800', category: 'Resekostnader, flyg', costCenter: 'RESA' },
  'sj': { account: '5800', category: 'Resekostnader, tåg', costCenter: 'RESA' },
  'uber': { account: '5800', category: 'Resekostnader, taxi', costCenter: 'RESA' },
  'bolt': { account: '5800', category: 'Resekostnader, taxi', costCenter: 'RESA' },
  'taxi': { account: '5800', category: 'Resekostnader, taxi', costCenter: 'RESA' },
  
  // Hotell & Boende
  'hotels.com': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'booking.com': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'airbnb': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'scandic': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'nordic choice': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'park inn': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'radisson': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'clarion': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  'elite hotels': { account: '5831', category: 'Kost och logi', costCenter: 'RESA' },
  
  // Restauranger & Representation (kvitton)
  'villa romana': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'sjöbaren': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'espresso house': { account: '5860', category: 'Representation, fika', costCenter: 'REP' },
  'starbucks': { account: '5860', category: 'Representation, fika', costCenter: 'REP' },
  'max': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'mcdonalds': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'burger king': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'subway': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'bastard': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'sturehof': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'operakällaren': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'riche': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'brasserie': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'trattoria': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'ristorante': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'pizzeria': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'bar': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'pub': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'kök': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'fisk': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  'skaldjur': { account: '5860', category: 'Representation, mat', costCenter: 'REP' },
  
  // Telekom
  'telia': { account: '6200', category: 'Telefon och internet', costCenter: 'ADM' },
  'tele2': { account: '6200', category: 'Telefon och internet', costCenter: 'ADM' },
  'tre': { account: '6200', category: 'Telefon och internet', costCenter: 'ADM' },
  'telenor': { account: '6200', category: 'Telefon och internet', costCenter: 'ADM' },
  
  // El & Lokalkostnader
  'vattenfall': { account: '5010', category: 'Lokalkostnader, el', costCenter: 'LOKAL' },
  'ellevio': { account: '5010', category: 'Lokalkostnader, el', costCenter: 'LOKAL' },
  'fortum': { account: '5010', category: 'Lokalkostnader, el', costCenter: 'LOKAL' },
  
  // Frakt
  'postnord': { account: '5710', category: 'Frakt och transport', costCenter: 'ADM' },
  'dhl': { account: '5710', category: 'Frakt och transport', costCenter: 'ADM' },
  'ups': { account: '5710', category: 'Frakt och transport', costCenter: 'ADM' },
  'bring': { account: '5710', category: 'Frakt och transport', costCenter: 'ADM' },
  
  // Konsulter
  'pwc': { account: '6530', category: 'Revisionstjänster', costCenter: 'ADM' },
  'kpmg': { account: '6530', category: 'Revisionstjänster', costCenter: 'ADM' },
  'ey': { account: '6530', category: 'Revisionstjänster', costCenter: 'ADM' },
  'deloitte': { account: '6530', category: 'Revisionstjänster', costCenter: 'ADM' },
  
  // Bank
  'nordea': { account: '6570', category: 'Bankkostnader', costCenter: 'ADM' },
  'seb': { account: '6570', category: 'Bankkostnader', costCenter: 'ADM' },
  'swedbank': { account: '6570', category: 'Bankkostnader', costCenter: 'ADM' },
  'handelsbanken': { account: '6570', category: 'Bankkostnader', costCenter: 'ADM' },
};

// Nyckelord för att identifiera restauranger/mat från kvitton
const RESTAURANT_KEYWORDS = [
  'lunch', 'middag', 'dinner', 'breakfast', 'frukost', 'fika', 
  'kaffe', 'coffee', 'latte', 'cappuccino', 'espresso',
  'mat', 'food', 'meal', 'dish', 'menu', 'meny',
  'vin', 'wine', 'öl', 'beer', 'dryck', 'drink',
  'servitör', 'servitor', 'notan', 'nota', 'bord', 'table',
  'restaurang', 'restaurant', 'cafe', 'café', 'bistro', 'krog',
  'pizza', 'pasta', 'sallad', 'soppa', 'biff', 'fisk', 'kyckling',
  'moms%', 'moms 12%', '12%', 'servering'
];

// Funktion för att detektera om det är ett restaurangkvitto
function isRestaurantReceipt(supplier: string, lineItems: string[], rawText: string): boolean {
  const lowerSupplier = supplier.toLowerCase();
  const lowerText = rawText.toLowerCase();
  
  // Kolla leverantörsnamn
  for (const keyword of RESTAURANT_KEYWORDS) {
    if (lowerSupplier.includes(keyword)) return true;
  }
  
  // Kolla line items
  for (const item of lineItems) {
    const lowerItem = item.toLowerCase();
    for (const keyword of RESTAURANT_KEYWORDS) {
      if (lowerItem.includes(keyword)) return true;
    }
  }
  
  // Kolla rå-text
  let keywordCount = 0;
  for (const keyword of RESTAURANT_KEYWORDS) {
    if (lowerText.includes(keyword)) keywordCount++;
  }
  
  // Om flera restaurang-nyckelord hittas, är det troligen ett restaurangkvitto
  return keywordCount >= 2;
}

// Funktion för att föreslå kostnadsställe baserat på dokument
function suggestCostCenter(
  documentType: DocumentType,
  supplier: string,
  lineItemDescriptions: string[],
  rawText: string
): string | null {
  // Kolla först om leverantören har ett definierat kostnadsställe
  const supplierMatch = findSupplierMatch(supplier);
  if (supplierMatch?.costCenter) {
    return supplierMatch.costCenter;
  }
  
  // För kvitton, analysera innehållet
  if (documentType === 'RECEIPT') {
    if (isRestaurantReceipt(supplier, lineItemDescriptions, rawText)) {
      return 'REP'; // Representation
    }
  }
  
  // Default baserat på dokumenttyp
  switch (documentType) {
    case 'INVOICE':
      return 'ADM'; // Administration som default för fakturor
    case 'RECEIPT':
      return null; // Behöver granskas
    default:
      return null;
  }
}

/**
 * Map extracted data to Fortnox accounts
 */
export async function mapToFortnox(
  documentType: DocumentType,
  extractedData: ExtractedData
): Promise<FortnoxMapping> {
  const warnings: string[] = [];
  
  // Bestäm verifikationstyp
  const voucherType = getVoucherType(documentType);
  
  // Föreslå kostnadsställe för hela dokumentet
  const lineItemDescriptions = extractedData.lineItems.map(li => li.description);
  const documentCostCenter = suggestCostCenter(
    documentType,
    extractedData.supplier,
    lineItemDescriptions,
    extractedData.rawTextSummary || ''
  );
  
  // Mappa varje rad till konto och kostnadsställe
  const lineItemMappings = await Promise.all(
    extractedData.lineItems.map(async (item) => {
      const suggestion = await suggestAccount(item, extractedData.supplier, documentType);
      const alternatives = getAlternativeAccounts(item.description, suggestion.account);
      
      return {
        description: item.description,
        amount: item.netAmount,
        suggestedAccount: suggestion,
        alternativeAccounts: alternatives,
        suggestedCostCenter: documentCostCenter, // Använd dokumentets kostnadsställe
      };
    })
  );
  
  // Om inga rader, skapa en baserad på totalen
  if (lineItemMappings.length === 0 && extractedData.totalAmount > 0) {
    const defaultSuggestion = await suggestAccountForSupplier(extractedData.supplier);
    lineItemMappings.push({
      description: extractedData.rawTextSummary || 'Enligt underlag',
      amount: extractedData.netAmount || extractedData.totalAmount * 0.8,
      suggestedAccount: defaultSuggestion,
      alternativeAccounts: getAlternativeAccounts('', defaultSuggestion.account),
      suggestedCostCenter: documentCostCenter,
    });
  }
  
  // Bygg verifikationsrader
  const voucherLines = buildVoucherLines(documentType, extractedData, lineItemMappings);
  
  // Kontrollera balans
  const totalDebit = voucherLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = voucherLines.reduce((sum, l) => sum + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    warnings.push(`Verifikationen balanserar inte: Debet ${totalDebit.toFixed(2)}, Kredit ${totalCredit.toFixed(2)}`);
  }
  
  // Kontrollera om granskning behövs
  const requiresReview = 
    extractedData.extractionConfidence < 0.7 ||
    lineItemMappings.some(m => m.suggestedAccount.confidence < 0.7) ||
    warnings.length > 0;

  return {
    documentType,
    voucherType,
    voucherDate: extractedData.documentDate,
    voucherText: `${extractedData.supplier} - ${extractedData.documentNumber}`,
    voucherLines,
    supplierInvoice: documentType === 'INVOICE' ? {
      supplierName: extractedData.supplier,
      supplierOrgNumber: extractedData.supplierOrgNumber,
      invoiceNumber: extractedData.documentNumber,
      invoiceDate: extractedData.documentDate,
      dueDate: extractedData.dueDate || addDays(extractedData.documentDate, 30),
      totalAmount: extractedData.totalAmount,
      paymentReference: extractedData.paymentReference,
    } : undefined,
    lineItemMappings,
    suggestedCostCenter: documentCostCenter,
    overallConfidence: calculateOverallConfidence(extractedData, lineItemMappings),
    warnings,
    requiresReview,
  };
}

function getVoucherType(documentType: DocumentType): FortnoxMapping['voucherType'] {
  switch (documentType) {
    case 'INVOICE': return 'SUPPLIER_INVOICE';
    case 'RECEIPT': return 'RECEIPT';
    case 'BANK_STATEMENT': return 'BANK';
    case 'CREDIT_NOTE': return 'SUPPLIER_INVOICE';
    default: return 'JOURNAL';
  }
}

async function suggestAccount(
  lineItem: ExtractedLineItem,
  supplier: string,
  documentType: DocumentType
): Promise<AccountSuggestion> {
  // Först: kolla leverantörsmappning
  const supplierMatch = findSupplierMatch(supplier);
  if (supplierMatch) {
    const accountInfo = allaKonton.find(k => k.konto === supplierMatch.account);
    return {
      account: supplierMatch.account,
      accountName: accountInfo?.namn || supplierMatch.category,
      confidence: 0.9,
      reasoning: `Känd leverantör: ${supplierMatch.category}`,
    };
  }
  
  // Sedan: använd BAS-kontoplan matchning
  const basMatch = hittaBastaKonto(lineItem.description, supplier);
  if (basMatch) {
    return {
      account: basMatch.konto,
      accountName: basMatch.namn,
      confidence: 0.8,
      reasoning: `Matchade kategori: ${basMatch.kategori}`,
    };
  }
  
  // Fallback: använd LLM för svåra fall
  return await suggestAccountWithLLM(lineItem.description, supplier, documentType);
}

async function suggestAccountForSupplier(supplier: string): Promise<AccountSuggestion> {
  const supplierMatch = findSupplierMatch(supplier);
  if (supplierMatch) {
    const accountInfo = allaKonton.find(k => k.konto === supplierMatch.account);
    return {
      account: supplierMatch.account,
      accountName: accountInfo?.namn || supplierMatch.category,
      confidence: 0.9,
      reasoning: `Känd leverantör: ${supplierMatch.category}`,
    };
  }
  
  return {
    account: '6550',
    accountName: 'Konsultarvoden',
    confidence: 0.65,
    reasoning: 'Standardkonto för okänd leverantör',
  };
}

function findSupplierMatch(supplier: string): { account: string; category: string; costCenter?: string } | null {
  const lowerSupplier = supplier.toLowerCase();
  
  for (const [key, value] of Object.entries(SUPPLIER_ACCOUNT_MAP)) {
    if (lowerSupplier.includes(key)) {
      return value;
    }
  }
  
  return null;
}

async function suggestAccountWithLLM(
  description: string,
  supplier: string,
  documentType: DocumentType
): Promise<AccountSuggestion> {
  const accountList = vanligaKostnadskonton
    .map(k => `${k.konto}: ${k.namn} (${k.kategori})`)
    .join('\n');

  const prompt = `Du är en svensk bokföringsexpert. Vilket BAS-konto passar bäst för denna kostnad?

Leverantör: ${supplier}
Beskrivning: ${description}
Dokumenttyp: ${documentType}

VANLIGA KOSTNADSKONTON:
${accountList}

Svara ENDAST med JSON:
{
  "account": "4-siffrigt kontonummer",
  "reasoning": "kort förklaring"
}`;

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const accountInfo = allaKonton.find(k => k.konto === parsed.account);
      
      return {
        account: parsed.account || '6550',
        accountName: accountInfo?.namn || 'Okänt konto',
        confidence: 0.75,
        reasoning: parsed.reasoning || 'LLM-förslag',
      };
    }
  } catch (error) {
    console.error('[FortnoxMapper] LLM error:', error);
  }
  
  return {
    account: '6550',
    accountName: 'Konsultarvoden',
    confidence: 0.6,
    reasoning: 'Standardkonto (behöver granskning)',
  };
}

function getAlternativeAccounts(description: string, primaryAccount: string): AccountSuggestion[] {
  // Hitta relaterade konton baserat på kategori
  const primary = allaKonton.find(k => k.konto === primaryAccount);
  if (!primary) return [];
  
  return vanligaKostnadskonton
    .filter(k => k.konto !== primaryAccount && k.kategori === primary.kategori)
    .slice(0, 3)
    .map(k => ({
      account: k.konto,
      accountName: k.namn,
      confidence: 0.5,
      reasoning: 'Alternativt konto i samma kategori',
    }));
}

function buildVoucherLines(
  documentType: DocumentType,
  extractedData: ExtractedData,
  lineItemMappings: FortnoxMapping['lineItemMappings']
): VoucherLine[] {
  const lines: VoucherLine[] = [];
  
  if (documentType === 'INVOICE' || documentType === 'CREDIT_NOTE') {
    // Leverantörsfaktura: Debet kostnad/moms, Kredit leverantörsskuld
    
    // Kostnadsrader
    for (const mapping of lineItemMappings) {
      lines.push({
        account: mapping.suggestedAccount.account,
        accountName: mapping.suggestedAccount.accountName,
        debit: mapping.amount,
        credit: 0,
        description: mapping.description,
      });
    }
    
    // Moms (ingående)
    if (extractedData.vatAmount && extractedData.vatAmount > 0) {
      lines.push({
        account: '2640',
        accountName: 'Ingående moms',
        debit: extractedData.vatAmount,
        credit: 0,
        description: 'Ingående moms',
      });
    }
    
    // Leverantörsskuld
    lines.push({
      account: '2440',
      accountName: 'Leverantörsskulder',
      debit: 0,
      credit: extractedData.totalAmount,
      description: `${extractedData.supplier} - ${extractedData.documentNumber}`,
    });
    
  } else if (documentType === 'RECEIPT') {
    // Kvitto: Debet kostnad/moms, Kredit kassa/bank
    
    // Kostnadsrader
    for (const mapping of lineItemMappings) {
      lines.push({
        account: mapping.suggestedAccount.account,
        accountName: mapping.suggestedAccount.accountName,
        debit: mapping.amount,
        credit: 0,
        description: mapping.description,
      });
    }
    
    // Moms
    if (extractedData.vatAmount && extractedData.vatAmount > 0) {
      lines.push({
        account: '2640',
        accountName: 'Ingående moms',
        debit: extractedData.vatAmount,
        credit: 0,
        description: 'Ingående moms',
      });
    }
    
    // Betalning
    const paymentAccount = extractedData.paymentMethod === 'card' ? '1930' : '1910';
    const paymentName = extractedData.paymentMethod === 'card' ? 'Företagskort' : 'Kassa';
    
    lines.push({
      account: paymentAccount,
      accountName: paymentName,
      debit: 0,
      credit: extractedData.totalAmount,
      description: 'Betalning',
    });
  }
  
  return lines;
}

function calculateOverallConfidence(
  extractedData: ExtractedData,
  lineItemMappings: FortnoxMapping['lineItemMappings']
): number {
  // Basera confidence på faktiskt extraherade data
  let dataQualityScore = 0.5; // Start
  
  // +0.1 för varje viktig fält som extraherades korrekt
  if (extractedData.supplier && extractedData.supplier !== 'Okänd') dataQualityScore += 0.1;
  if (extractedData.totalAmount > 0) dataQualityScore += 0.15;
  if (extractedData.documentDate) dataQualityScore += 0.05;
  if (extractedData.documentNumber && !extractedData.documentNumber.startsWith('AUTO-')) dataQualityScore += 0.1;
  if (extractedData.vatAmount && extractedData.vatAmount > 0) dataQualityScore += 0.05;
  
  // Mapping confidence
  const mappingConf = lineItemMappings.length > 0
    ? lineItemMappings.reduce((sum, m) => sum + m.suggestedAccount.confidence, 0) / lineItemMappings.length
    : 0.7; // Default 70% för känd leverantör
  
  // Kombinera - men aldrig under 50% om vi har grunddata
  const extractionConf = Math.max(extractedData.extractionConfidence, dataQualityScore);
  const combined = (extractionConf * 0.5 + mappingConf * 0.5);
  
  // Minst 55% om vi har leverantör och belopp
  if (extractedData.supplier && extractedData.supplier !== 'Okänd' && extractedData.totalAmount > 0) {
    return Math.max(0.55, combined);
  }
  
  return Math.max(0.4, combined); // Aldrig under 40%
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

