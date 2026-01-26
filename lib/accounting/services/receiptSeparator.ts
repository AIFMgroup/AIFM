/**
 * Receipt Separator Service
 * 
 * Detekterar och separerar flera kvitton i en och samma bild.
 * Använder AI-vision för att identifiera individuella kvitton och deras positioner.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || 'eu-north-1';
// Keep bucket naming consistent across the accounting pipeline.
// Prefer S3_BUCKET (used elsewhere), fallback to ACCOUNTING_BUCKET for backwards compatibility.
const S3_BUCKET = process.env.S3_BUCKET || process.env.ACCOUNTING_BUCKET || 'aifm-accounting-docs';

const s3Client = new S3Client({ region: REGION });
const bedrockClient = new BedrockRuntimeClient({ region: REGION });

export interface ReceiptBoundingBox {
  id: number;
  x: number;      // 0-100 (percentage)
  y: number;      // 0-100 (percentage)
  width: number;  // 0-100 (percentage)
  height: number; // 0-100 (percentage)
  confidence: number;
  estimatedType: 'receipt' | 'invoice' | 'unknown';
  estimatedSupplier?: string;
  estimatedAmount?: string;
}

export interface ReceiptDetectionResult {
  imageKey: string;
  receiptCount: number;
  receipts: ReceiptBoundingBox[];
  needsSeparation: boolean;
  confidence: number;
  rawAnalysis?: string;
}

export interface SeparatedReceipt {
  originalImageKey: string;
  separatedImageKey: string;
  receiptIndex: number;
  boundingBox: ReceiptBoundingBox;
}

/**
 * Analysera en bild för att detektera flera kvitton
 */
export async function detectMultipleReceipts(
  imageKey: string
): Promise<ReceiptDetectionResult> {
  console.log(`[ReceiptSeparator] Analyzing image for multiple receipts: ${imageKey}`);
  
  try {
    // Hämta bilden från S3
    const imageData = await getImageFromS3(imageKey);
    if (!imageData) {
      return {
        imageKey,
        receiptCount: 1,
        receipts: [],
        needsSeparation: false,
        confidence: 0.5,
      };
    }
    
    // Använd Claude Vision för att analysera bilden
    const prompt = `Du är en expert på att analysera bilder av kvitton och fakturor.

Analysera denna bild noggrant och identifiera ALLA separata kvitton/fakturor som syns.

VIKTIGT: Många användare fotograferar flera kvitton samtidigt för att spara tid.
Leta efter:
- Flera separata pappersdokument i samma bild
- Olika logotyper/företagsnamn
- Tydliga kanter mellan kvitton
- Olika bakgrunder/skuggor som separerar kvitton
- Olika datum eller belopp som indikerar separata transaktioner

För VARJE kvitto du hittar, ange dess ungefärliga position i bilden som procent (0-100):
- x: Vänsterkant (0 = vänster bildkant, 100 = höger bildkant)
- y: Överkant (0 = övre bildkant, 100 = undre bildkant)  
- width: Bredd i procent av bilden
- height: Höjd i procent av bilden

Svara ENDAST med JSON i detta format:
{
  "receiptCount": <antal kvitton>,
  "receipts": [
    {
      "id": 1,
      "x": <vänsterkant %>,
      "y": <överkant %>,
      "width": <bredd %>,
      "height": <höjd %>,
      "confidence": <0.0-1.0>,
      "estimatedType": "receipt" | "invoice" | "unknown",
      "estimatedSupplier": "<leverantörsnamn om synligt>",
      "estimatedAmount": "<belopp om synligt>"
    }
  ],
  "reasoning": "<kort förklaring>"
}

Om du bara ser ETT kvitto, sätt receiptCount till 1.
Om du ser FLERA kvitton, lista alla med deras positioner.`;

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
              source: {
                type: 'base64',
                media_type: getMediaType(imageKey),
                data: imageData,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text || '';
    
    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      const receipts: ReceiptBoundingBox[] = (result.receipts || []).map((r: ReceiptBoundingBox, idx: number) => ({
        id: r.id || idx + 1,
        x: Math.max(0, Math.min(100, r.x || 0)),
        y: Math.max(0, Math.min(100, r.y || 0)),
        width: Math.max(5, Math.min(100, r.width || 100)),
        height: Math.max(5, Math.min(100, r.height || 100)),
        confidence: r.confidence || 0.7,
        estimatedType: r.estimatedType || 'unknown',
        estimatedSupplier: r.estimatedSupplier,
        estimatedAmount: r.estimatedAmount,
      }));
      
      const receiptCount = result.receiptCount || receipts.length || 1;
      
      console.log(`[ReceiptSeparator] Detected ${receiptCount} receipt(s) in image`);
      
      return {
        imageKey,
        receiptCount,
        receipts,
        needsSeparation: receiptCount > 1,
        confidence: receipts.length > 0 
          ? receipts.reduce((sum, r) => sum + r.confidence, 0) / receipts.length 
          : 0.8,
        rawAnalysis: result.reasoning,
      };
    }
  } catch (error) {
    console.error('[ReceiptSeparator] Error analyzing image:', error);
  }
  
  // Fallback: assume single receipt
  return {
    imageKey,
    receiptCount: 1,
    receipts: [{
      id: 1,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      confidence: 0.5,
      estimatedType: 'unknown',
    }],
    needsSeparation: false,
    confidence: 0.5,
  };
}

/**
 * Separera kvitton från en bild baserat på detektionsresultat
 * Returnerar S3-nycklar för de separerade bilderna
 */
export async function separateReceipts(
  imageKey: string,
  detection: ReceiptDetectionResult,
  companyId: string
): Promise<SeparatedReceipt[]> {
  if (!detection.needsSeparation || detection.receiptCount <= 1) {
    console.log(`[ReceiptSeparator] No separation needed for ${imageKey}`);
    return [{
      originalImageKey: imageKey,
      separatedImageKey: imageKey,
      receiptIndex: 0,
      boundingBox: detection.receipts[0] || {
        id: 1, x: 0, y: 0, width: 100, height: 100, confidence: 1, estimatedType: 'unknown'
      },
    }];
  }
  
  console.log(`[ReceiptSeparator] Separating ${detection.receiptCount} receipts from ${imageKey}`);
  
  const separatedReceipts: SeparatedReceipt[] = [];
  
  // Hämta originalbilden
  const originalImage = await getImageBufferFromS3(imageKey);
  if (!originalImage) {
    console.error(`[ReceiptSeparator] Could not get original image: ${imageKey}`);
    return [];
  }
  
  // Importera sharp dynamiskt (för bildmanipulering)
  // Note: I produktion skulle vi använda sharp eller liknande bibliotek
  // Här använder vi en förenklad approach där vi skapar cropping-instruktioner
  
  for (let i = 0; i < detection.receipts.length; i++) {
    const receipt = detection.receipts[i];
    
    try {
      // Skapa en unik nyckel för det separerade kvittot
      const timestamp = Date.now();
      const baseName = imageKey.replace(/\.[^.]+$/, '');
      const extension = imageKey.match(/\.[^.]+$/)?.[0] || '.jpg';
      const separatedKey = `${baseName}_receipt${i + 1}_${timestamp}${extension}`;
      
      // Spara cropping-metadata med originalbilden
      // I produktion: använd sharp för att faktiskt croopa bilden
      const cropMetadata = {
        originalKey: imageKey,
        cropRegion: {
          x: receipt.x,
          y: receipt.y,
          width: receipt.width,
          height: receipt.height,
        },
        receiptIndex: i,
        estimatedSupplier: receipt.estimatedSupplier,
        estimatedAmount: receipt.estimatedAmount,
      };
      
      // Ladda upp metadata som en JSON-fil
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `${separatedKey}.meta.json`,
        Body: JSON.stringify(cropMetadata),
        ContentType: 'application/json',
        Metadata: {
          'receipt-separator': 'true',
          'original-image': imageKey,
          'receipt-index': String(i),
        },
      }));
      
      // För nu, kopiera originalbilden och notera crop-regionen
      // Textract och AI kommer analysera hela bilden men vi märker vad som är vad
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: separatedKey,
        Body: originalImage,
        ContentType: getMediaType(imageKey),
        Metadata: {
          'receipt-separator': 'true',
          'original-image': imageKey,
          'receipt-index': String(i),
          'crop-x': String(receipt.x),
          'crop-y': String(receipt.y),
          'crop-width': String(receipt.width),
          'crop-height': String(receipt.height),
        },
      }));
      
      separatedReceipts.push({
        originalImageKey: imageKey,
        separatedImageKey: separatedKey,
        receiptIndex: i,
        boundingBox: receipt,
      });
      
      console.log(`[ReceiptSeparator] Created separated receipt ${i + 1}: ${separatedKey}`);
      
    } catch (error) {
      console.error(`[ReceiptSeparator] Error separating receipt ${i + 1}:`, error);
    }
  }
  
  return separatedReceipts;
}

/**
 * Huvudfunktion: Analysera och separera kvitton om nödvändigt
 */
export async function analyzeAndSeparateReceipts(
  imageKey: string,
  companyId: string
): Promise<{
  needsSeparation: boolean;
  originalKey: string;
  separatedKeys: string[];
  receipts: SeparatedReceipt[];
  detection: ReceiptDetectionResult;
}> {
  // Steg 1: Detektera kvitton
  const detection = await detectMultipleReceipts(imageKey);
  
  // Steg 2: Separera om flera hittades
  const receipts = await separateReceipts(imageKey, detection, companyId);
  
  return {
    needsSeparation: detection.needsSeparation,
    originalKey: imageKey,
    separatedKeys: receipts.map(r => r.separatedImageKey),
    receipts,
    detection,
  };
}

/**
 * Skapa separata jobb för varje kvitto
 */
export async function createJobsForSeparatedReceipts(
  companyId: string,
  originalFileName: string,
  separatedReceipts: SeparatedReceipt[],
  createJobFn: (fileKey: string, fileName: string, metadata: Record<string, unknown>) => Promise<string>
): Promise<string[]> {
  const jobIds: string[] = [];
  
  for (const receipt of separatedReceipts) {
    const baseName = originalFileName.replace(/\.[^.]+$/, '');
    const extension = originalFileName.match(/\.[^.]+$/)?.[0] || '';
    
    // Generera filnamn för varje kvitto
    const receiptFileName = separatedReceipts.length > 1
      ? `${baseName}_kvitto${receipt.receiptIndex + 1}${extension}`
      : originalFileName;
    
    try {
      const jobId = await createJobFn(
        receipt.separatedImageKey,
        receiptFileName,
        {
          isFromMultiReceiptImage: separatedReceipts.length > 1,
          originalImageKey: receipt.originalImageKey,
          receiptIndex: receipt.receiptIndex,
          boundingBox: receipt.boundingBox,
          estimatedSupplier: receipt.boundingBox.estimatedSupplier,
          estimatedAmount: receipt.boundingBox.estimatedAmount,
        }
      );
      jobIds.push(jobId);
      
      console.log(`[ReceiptSeparator] Created job ${jobId} for receipt ${receipt.receiptIndex + 1}`);
    } catch (error) {
      console.error(`[ReceiptSeparator] Error creating job for receipt ${receipt.receiptIndex + 1}:`, error);
    }
  }
  
  return jobIds;
}

// ============ Helper Functions ============

async function getImageFromS3(key: string): Promise<string | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    
    const body = await response.Body?.transformToByteArray();
    if (!body) return null;
    
    return Buffer.from(body).toString('base64');
  } catch (error) {
    console.error(`[ReceiptSeparator] Error getting image ${key}:`, error);
    return null;
  }
}

async function getImageBufferFromS3(key: string): Promise<Buffer | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    
    const body = await response.Body?.transformToByteArray();
    if (!body) return null;
    
    return Buffer.from(body);
  } catch (error) {
    console.error(`[ReceiptSeparator] Error getting image buffer ${key}:`, error);
    return null;
  }
}

function getMediaType(key: string): string {
  const ext = key.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}



