/**
 * Document Classification Service
 * Uses Amazon Bedrock (Claude) with Vision capability to classify accounting documents
 * Supports both text-based OCR and direct image analysis for photographed receipts
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Classification, LineItem, documentStore } from './jobStore';
import { TextractResult } from './textractService';
import { allaKonton, hittaBastaKonto, vanligaKostnadskonton } from './basKontoplan';

// Bedrock med Claude Sonnet 4.5 - stödjer Vision för bildanalys
const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export interface ClassificationRequest {
  ocrText: string;
  textractData?: TextractResult;
  companyContext?: string;
  s3Key?: string; // For vision-based analysis of images
  fileType?: string;
}

export async function classifyDocument(request: ClassificationRequest): Promise<Classification> {
  const { ocrText, textractData, s3Key, fileType } = request;

  // For images (photographed receipts), try vision-based analysis first
  const isImage = fileType && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase());
  
  if (isImage && s3Key) {
    try {
      console.log('[Classification] Using Claude Vision for image analysis');
      return await classifyWithVision(s3Key, ocrText);
    } catch (error) {
      console.error('[Classification] Vision analysis failed, falling back to OCR:', error);
    }
  }

  // Try structured data from Textract for PDFs and scanned documents
  if (textractData?.expenses) {
    const expenses = textractData.expenses;
    
    // If we have good Textract data, use it directly with rule-based classification
    if (expenses.vendorName && expenses.total) {
      console.log('[Classification] Using Textract structured data');
      return createClassificationFromTextract(expenses, ocrText);
    }
  }

  // Fall back to LLM text classification
  console.log('[Classification] Using LLM text classification');
  return classifyWithBedrock(ocrText);
}

/**
 * Create classification from Textract expense data
 */
function createClassificationFromTextract(
  expenses: NonNullable<TextractResult['expenses']>,
  ocrText: string
): Classification {
  const netAmount = expenses.total ? expenses.total - (expenses.tax || 0) : 0;
  const vatAmount = expenses.tax || 0;
  
  // Determine document type
  const docType = determineDocType(ocrText);
  
  // Suggest account based on vendor and content
  const suggestedAccount = suggestAccount(expenses.vendorName || '', ocrText);
  
  // Parse dates
  const invoiceDate = parseSwedishDate(expenses.invoiceDate);
  const dueDate = parseSwedishDate(expenses.dueDate) || addDays(invoiceDate, 30);

  const lineItems: LineItem[] = expenses.lineItems.length > 0 
    ? expenses.lineItems.map((item, i) => ({
        id: `li-${Date.now()}-${i}`,
        description: item.description || 'Okänd post',
        netAmount: item.amount || netAmount,
        vatAmount: Math.round(item.amount * 0.25) || vatAmount,
        suggestedAccount,
        suggestedCostCenter: null,
        confidence: 0.85,
      }))
    : [{
        id: `li-${Date.now()}-0`,
        description: 'Enligt faktura',
        netAmount,
        vatAmount,
        suggestedAccount,
        suggestedCostCenter: null,
        confidence: 0.80,
      }];

  return {
    docType,
    supplier: expenses.vendorName || 'Okänd leverantör',
    invoiceNumber: expenses.invoiceNumber || `AUTO-${Date.now()}`,
    invoiceDate,
    dueDate,
    currency: 'SEK',
    totalAmount: expenses.total || 0,
    vatAmount: vatAmount,
    lineItems,
    overallConfidence: 0.85,
  };
}

/**
 * Enhanced prompt for Swedish accounting classification
 */
const CLASSIFICATION_SYSTEM_PROMPT = `Du är en expert på svensk bokföring och redovisning. Din uppgift är att analysera underlag (fakturor, kvitton, kontoutdrag) och klassificera dem korrekt för bokföring i Fortnox enligt svensk BAS-kontoplan.

DOKUMENTTYPER:
- INVOICE: Faktura från leverantör (har fakturanummer, förfallodatum, ofta moms specificerad)
- RECEIPT: Kvitto/kassakvitto (kortare, ofta från butik/restaurang, direkt betalning)
- BANK: Kontoutdrag, överföring, bankavgift
- OTHER: Kreditnota, påminnelse, övrigt

VANLIGA BAS-KONTON FÖR KOSTNADER:
- 4000-4999: Inköp av varor och material
- 5010: Lokalkostnader (hyra, el, städning)
- 5400: Förbrukningsinventarier
- 5800: Resekostnader (flyg, tåg, hotell)
- 5831: Kost och logi vid tjänsteresa
- 5832: Representation
- 6100: Kontorsmaterial
- 6200: Telefon och internet
- 6250: Programvaror, IT-tjänster, molntjänster
- 6310: Marknadsföring, reklam
- 6530: Redovisningstjänster
- 6540: Juridiska tjänster
- 6550: Konsultarvoden
- 6570: Bankkostnader
- 6991: Övriga externa kostnader

LEVERANTÖRSMATCHNING:
- AWS/Amazon Web Services → 6250 (IT-tjänster)
- Microsoft/Azure/Office 365 → 6250 (IT-tjänster)  
- Google Cloud/Workspace → 6250 (IT-tjänster)
- Slack/Notion/Figma → 6250 (IT-tjänster)
- SAS/Norwegian/Lufthansa → 5800 (Resekostnader)
- Uber/Bolt/taxi → 5800 (Resekostnader)
- Hotels.com/Booking → 5831 (Kost och logi)
- Restaurang/café → 5832 (Representation) eller 5831 (Tjänsteresa)
- ICA/Coop/Willys → 5410 (Förbrukningsvaror) eller 5831
- Ellevio/Vattenfall → 5010 (Lokalkostnader)
- Telia/Tele2 → 6200 (Telefon)
- PostNord/DHL → 6250 eller 5710 (Frakt)`;

/**
 * Classify document using Amazon Bedrock (Claude) - text only
 */
async function classifyWithBedrock(ocrText: string): Promise<Classification> {
  const prompt = `${CLASSIFICATION_SYSTEM_PROMPT}

Analysera följande OCR-text från ett underlag och extrahera all relevant information.

OCR-TEXT:
${ocrText}

Svara ENDAST med JSON i exakt detta format (inga kommentarer eller förklaringar):
{
  "docType": "INVOICE" | "RECEIPT" | "BANK" | "OTHER",
  "supplier": "leverantörens fullständiga namn",
  "invoiceNumber": "faktura-/kvittonummer",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currency": "SEK",
  "totalAmount": nummer (totalt inkl moms),
  "vatAmount": nummer (endast moms),
  "lineItems": [
    {
      "description": "beskrivning av varan/tjänsten",
      "netAmount": nummer (belopp exkl moms),
      "suggestedAccount": "4-siffrigt BAS-kontonummer",
      "confidence": nummer mellan 0.0 och 1.0
    }
  ],
  "overallConfidence": nummer mellan 0.0 och 1.0
}`;

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and transform
    return {
      docType: parsed.docType || 'OTHER',
      supplier: parsed.supplier || 'Okänd leverantör',
      invoiceNumber: parsed.invoiceNumber || `AUTO-${Date.now()}`,
      invoiceDate: parsed.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: parsed.dueDate || addDays(new Date().toISOString().split('T')[0], 30),
      currency: parsed.currency || 'SEK',
      totalAmount: parsed.totalAmount || 0,
      vatAmount: parsed.vatAmount || 0,
      lineItems: (parsed.lineItems || []).map((li: Record<string, unknown>, i: number) => ({
        id: `li-${Date.now()}-${i}`,
        description: li.description as string || 'Okänd post',
        netAmount: li.netAmount as number || 0,
        vatAmount: Math.round((li.netAmount as number || 0) * 0.25),
        suggestedAccount: validateAccount(li.suggestedAccount as string) || '6550',
        suggestedCostCenter: null,
        confidence: li.confidence as number || 0.7,
      })),
      overallConfidence: parsed.overallConfidence || 0.7,
    };

  } catch (error) {
    console.error('Bedrock classification error:', error);
    
    // Return fallback classification
    return createFallbackClassification(ocrText);
  }
}

/**
 * Classify document using Claude Vision - for photographed receipts and images
 * This is superior for handwritten receipts, blurry images, and complex layouts
 */
async function classifyWithVision(s3Key: string, fallbackOcrText: string): Promise<Classification> {
  // Fetch image from S3
  const imageBuffer = await documentStore.getBuffer(s3Key);
  const base64Image = imageBuffer.toString('base64');
  
  // Determine media type
  const extension = s3Key.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaType = extension === 'png' ? 'image/png' : 
                    extension === 'gif' ? 'image/gif' :
                    extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const prompt = `${CLASSIFICATION_SYSTEM_PROMPT}

Analysera denna bild av ett kvitto, en faktura eller annat bokföringsunderlag.

Läs av ALL text i bilden noggrant - även om den är:
- Handskriven
- Suddig eller i dålig kvalitet
- I ovanlig layout
- På flera språk

Om du OCKSÅ får OCR-text nedan, använd den som hjälp men lita främst på vad du ser i bilden.

${fallbackOcrText ? `\nKOMPLETTERANDE OCR-TEXT:\n${fallbackOcrText}\n` : ''}

Svara ENDAST med JSON i exakt detta format:
{
  "docType": "INVOICE" | "RECEIPT" | "BANK" | "OTHER",
  "supplier": "leverantörens fullständiga namn",
  "invoiceNumber": "faktura-/kvittonummer",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD",
  "currency": "SEK",
  "totalAmount": nummer (totalt inkl moms),
  "vatAmount": nummer (endast moms),
  "lineItems": [
    {
      "description": "beskrivning av varan/tjänsten",
      "netAmount": nummer (belopp exkl moms),
      "suggestedAccount": "4-siffrigt BAS-kontonummer",
      "confidence": nummer mellan 0.0 och 1.0
    }
  ],
  "overallConfidence": nummer mellan 0.0 och 1.0
}`;

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text || '';
    
    console.log('[Vision] Raw response:', content.substring(0, 200));
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in vision response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and transform
    return {
      docType: validateDocType(parsed.docType),
      supplier: parsed.supplier || 'Okänd leverantör',
      invoiceNumber: parsed.invoiceNumber || `AUTO-${Date.now()}`,
      invoiceDate: parsed.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: parsed.dueDate || addDays(parsed.invoiceDate || new Date().toISOString().split('T')[0], 30),
      currency: parsed.currency || 'SEK',
      totalAmount: parsed.totalAmount || 0,
      vatAmount: parsed.vatAmount || 0,
      lineItems: (parsed.lineItems || []).map((li: Record<string, unknown>, i: number) => ({
        id: `li-${Date.now()}-${i}`,
        description: li.description as string || 'Okänd post',
        netAmount: li.netAmount as number || 0,
        vatAmount: Math.round((li.netAmount as number || 0) * 0.25),
        suggestedAccount: validateAccount(li.suggestedAccount as string) || suggestAccountFromDescription(li.description as string || ''),
        suggestedCostCenter: null,
        confidence: li.confidence as number || 0.8,
      })),
      overallConfidence: parsed.overallConfidence || 0.85,
    };

  } catch (error) {
    console.error('Vision classification error:', error);
    throw error;
  }
}

function validateDocType(docType: string): Classification['docType'] {
  const valid = ['INVOICE', 'RECEIPT', 'BANK', 'OTHER'];
  return valid.includes(docType) ? docType as Classification['docType'] : 'OTHER';
}

function suggestAccountFromDescription(description: string): string {
  const lower = description.toLowerCase();
  
  // IT och programvara
  if (lower.includes('software') || lower.includes('saas') || lower.includes('cloud') || 
      lower.includes('licens') || lower.includes('subscription')) return '6250';
  
  // Resor
  if (lower.includes('flyg') || lower.includes('flight') || lower.includes('tåg') || 
      lower.includes('train') || lower.includes('taxi') || lower.includes('uber')) return '5800';
  
  // Hotell och boende
  if (lower.includes('hotel') || lower.includes('hotell') || lower.includes('boende')) return '5831';
  
  // Mat och representation
  if (lower.includes('lunch') || lower.includes('middag') || lower.includes('fika') || 
      lower.includes('restaurang')) return '5832';
  
  // Kontorsmaterial
  if (lower.includes('papper') || lower.includes('kontors') || lower.includes('office')) return '6100';
  
  // Telefon
  if (lower.includes('telefon') || lower.includes('mobil') || lower.includes('abonnemang')) return '6200';
  
  return '6550'; // Default: Konsultarvoden
}

// ============ Helper Functions ============

function determineDocType(text: string): Classification['docType'] {
  const lower = text.toLowerCase();
  if (lower.includes('faktura') || lower.includes('invoice')) return 'INVOICE';
  if (lower.includes('kvitto') || lower.includes('receipt')) return 'RECEIPT';
  if (lower.includes('kontoutdrag') || lower.includes('bank')) return 'BANK';
  return 'OTHER';
}

function suggestAccount(vendor: string, text: string): string {
  const match = hittaBastaKonto(text, vendor);
  return match?.konto || '6550'; // Default: Konsultarvoden
}

function validateAccount(account: string): string | null {
  const valid = allaKonton.find(k => k.konto === account);
  return valid ? account : null;
}

function parseSwedishDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Try to parse various Swedish date formats
  // 2024-12-11, 11/12/2024, 11 dec 2024, etc.
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return dateStr;
  
  const euMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function createFallbackClassification(ocrText: string): Classification {
  const docType = determineDocType(ocrText);
  const account = suggestAccount('', ocrText);
  
  // Try to extract amounts from text
  const amountMatch = ocrText.match(/(\d[\d\s]*[,\.]\d{2})/g);
  const amounts = (amountMatch || [])
    .map(a => parseFloat(a.replace(/\s/g, '').replace(',', '.')))
    .filter(a => a > 0)
    .sort((a, b) => b - a);
  
  const total = amounts[0] || 0;
  const vat = Math.round(total * 0.2); // Assume 20% VAT if unclear
  const net = total - vat;

  return {
    docType,
    supplier: 'Okänd leverantör',
    invoiceNumber: `AUTO-${Date.now()}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: addDays(new Date().toISOString().split('T')[0], 30),
    currency: 'SEK',
    totalAmount: total,
    vatAmount: vat,
    lineItems: [{
      id: `li-${Date.now()}-0`,
      description: 'Enligt underlag',
      netAmount: net,
      vatAmount: vat,
      suggestedAccount: account,
      suggestedCostCenter: null,
      confidence: 0.5,
    }],
    overallConfidence: 0.5,
  };
}

