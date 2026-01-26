/**
 * Agent 1: Document Type Classifier
 * 
 * Ansvarar ENDAST för att klassificera dokumenttypen.
 * Gör ingen extraktion av data - bara identifierar vad dokumentet är.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { documentStore } from '../jobStore';

const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export type DocumentType = 'INVOICE' | 'RECEIPT' | 'BANK_STATEMENT' | 'CREDIT_NOTE' | 'REMINDER' | 'CONTRACT' | 'OTHER';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  language: 'sv' | 'en' | 'other';
  hasHandwriting: boolean;
  imageQuality: 'good' | 'medium' | 'poor';
  multipleDocuments: boolean;
  documentCount: number;
  keySignals?: string[]; // Nyckelord som AI:n hittade
}

const CLASSIFIER_PROMPT = `Du är en expert på att klassificera svenska bokföringsdokument.

Din ENDA uppgift är att identifiera vilken typ av dokument detta är. Du ska INTE extrahera några siffror eller data.

VIKTIGT: Kontrollera om bilden innehåller FLERA separata dokument (t.ex. två kvitton sida vid sida).

====================================
KRITISKT: FAKTURA vs KVITTO
====================================

FAKTURA (INVOICE) - Formellt kravdokument som skickas INNAN betalning:
✓ Har texten "FAKTURA", "Invoice", "Fakturanummer"
✓ Har FÖRFALLODATUM ("Förfaller", "Betalningsdatum", "Due date")
✓ Har BETALNINGSINFORMATION: Bankgiro, Plusgiro, OCR-nummer
✓ Har organisationsnummer/VAT-nummer på leverantören
✓ Ofta A4-format, professionell layout
✓ Typiska leverantörer: IT-bolag, konsulter, leverantörer, hyresvärdar
✓ Belopp kan vara stort (tusentals till miljoner kr)

KVITTO (RECEIPT) - Bekräftelse på GENOMFÖRD betalning:
✓ Har texten "KVITTO", "Kassakvitto", "Receipt", "GODKÄNT", "GODKÄND"
✓ Visar betalningsmetod: "Kort", "Kontant", "Swish", kortmaskerat nummer (****1234)
✓ Datum OCH TID på samma rad (t.ex. "2024-01-15 14:32")
✓ Ofta smalare format (kassaremsa)
✓ Restaurangkvitton: "Servitör", "Bord", mat-/drycknamn
✓ Bensinkvitton: "Pump", "Liter", drivmedelstyp
✓ Butikskvitton: artiklar med streckkod, "RABATT", "ÅTERBÄRING"
✓ Moms kan visas som "Moms 12%", "25%", "6%"
✓ Typiska belopp: 50-5000 kr (sällan över 10 000 kr för äkta kvitton)

AVGÖRANDE SKILLNADER:
- Faktura: Förfallodatum + Betalningsinfo (BG/PG/OCR) → Betala SENARE
- Kvitto: Betalningsbekräftelse (kort/kontant) + Tidsstämpel → Redan BETALT

====================================
ÖVRIGA DOKUMENTTYPER
====================================

- BANK_STATEMENT: Kontoutdrag
  * Lista med transaktioner från bank
  * Visar saldo (in/ut)
  * Bankens logotyp och kontonummer
  
- CREDIT_NOTE: Kreditnota
  * Texten "KREDITNOTA" eller "Credit Note"
  * Refererar till ursprungsfaktura
  * Negativt belopp (återbetalning)
  
- REMINDER: Betalningspåminnelse
  * "PÅMINNELSE" eller "BETALNINGSPÅMINNELSE"
  * Refererar till obetald faktura
  * Ofta med påminnelseavgift
  
- CONTRACT: Avtal/kontrakt
  * Juridiskt dokument med villkor
  * Signaturlinjer
  * Avtalsperiod
  
- OTHER: Övrigt/oklart

====================================
SVARA MED JSON:
====================================
{
  "documentType": "INVOICE" | "RECEIPT" | "BANK_STATEMENT" | "CREDIT_NOTE" | "REMINDER" | "CONTRACT" | "OTHER",
  "confidence": 0.0-1.0,
  "reasoning": "Beskriv EXAKT vilka signaler du såg (t.ex. 'Såg texten KVITTO och kortbetalning ****4521')",
  "language": "sv" | "en" | "other",
  "hasHandwriting": true/false,
  "imageQuality": "good" | "medium" | "poor",
  "multipleDocuments": true/false,
  "documentCount": antal dokument i bilden,
  "keySignals": ["lista", "med", "nyckelord", "du", "hittade"]
}`;

/**
 * Classify document using vision (for images)
 */
export async function classifyDocumentWithVision(
  s3Key: string,
  ocrText?: string
): Promise<ClassificationResult> {
  const imageBuffer = await documentStore.getBuffer(s3Key);
  const base64Image = imageBuffer.toString('base64');
  
  const extension = s3Key.split('.').pop()?.toLowerCase() || 'jpeg';
  const mediaType = extension === 'png' ? 'image/png' : 
                    extension === 'gif' ? 'image/gif' :
                    extension === 'webp' ? 'image/webp' : 'image/jpeg';

  const prompt = ocrText 
    ? `${CLASSIFIER_PROMPT}\n\nKOMPLETTERANDE OCR-TEXT (som hjälp):\n${ocrText.substring(0, 1000)}`
    : CLASSIFIER_PROMPT;

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 512,
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

  return parseClassificationResponse(response);
}

/**
 * Classify document using text only (for PDFs after OCR)
 */
export async function classifyDocumentWithText(ocrText: string): Promise<ClassificationResult> {
  const prompt = `${CLASSIFIER_PROMPT}\n\nDOKUMENTTEXT:\n${ocrText.substring(0, 2000)}`;

  const response = await bedrockClient.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    })
  }));

  return parseClassificationResponse(response);
}

function parseClassificationResponse(response: { body: Uint8Array }): ClassificationResult {
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const content = responseBody.content?.[0]?.text || '';
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[Classifier] No JSON found:', content);
    return {
      documentType: 'OTHER',
      confidence: 0.3,
      reasoning: 'Kunde inte klassificera dokumentet',
      language: 'sv',
      hasHandwriting: false,
      imageQuality: 'medium',
      multipleDocuments: false,
      documentCount: 1,
      keySignals: [],
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  return {
    documentType: validateDocumentType(parsed.documentType),
    confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    reasoning: parsed.reasoning || '',
    language: parsed.language || 'sv',
    hasHandwriting: parsed.hasHandwriting || false,
    imageQuality: parsed.imageQuality || 'medium',
    multipleDocuments: parsed.multipleDocuments || false,
    documentCount: parsed.documentCount || 1,
    keySignals: parsed.keySignals || [],
  };
}

function validateDocumentType(type: string): DocumentType {
  const valid: DocumentType[] = ['INVOICE', 'RECEIPT', 'BANK_STATEMENT', 'CREDIT_NOTE', 'REMINDER', 'CONTRACT', 'OTHER'];
  return valid.includes(type as DocumentType) ? type as DocumentType : 'OTHER';
}

