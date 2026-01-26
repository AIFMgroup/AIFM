/**
 * Multi-Page PDF Handler
 * 
 * Hanterar PDF-filer med flera sidor genom att:
 * 1. Detektera antal sidor
 * 2. Konvertera varje sida till bild
 * 3. Klassificera om varje sida är ett separat dokument eller del av samma
 * 4. Skapa separata jobb eller sammanslagen data baserat på klassificering
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const REGION = process.env.AWS_REGION || 'eu-north-1';
// Keep bucket naming consistent across the accounting pipeline.
// Prefer S3_BUCKET (used elsewhere), fallback to ACCOUNTING_BUCKET for backwards compatibility.
const S3_BUCKET = process.env.S3_BUCKET || process.env.ACCOUNTING_BUCKET || 'aifm-accounting-docs';

const s3Client = new S3Client({ region: REGION });
const bedrockClient = new BedrockRuntimeClient({ region: REGION });
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface PageInfo {
  pageNumber: number;
  imageKey: string;
  isNewDocument: boolean;
  documentType?: string;
  confidence: number;
}

export interface MultiPageResult {
  totalPages: number;
  documentsDetected: number;
  pages: PageInfo[];
  splitStrategy: 'single' | 'multiple' | 'merged';
  jobIds: string[]; // IDs of created jobs
}

/**
 * Analyze a multi-page PDF to determine how to split it
 */
export async function analyzeMultiPagePdf(
  companyId: string,
  fileKey: string,
  fileName: string
): Promise<MultiPageResult> {
  console.log(`[MultiPagePdf] Analyzing ${fileName}`);
  
  // Convert PDF pages to images
  const pageImages = await extractPdfPages(fileKey);
  
  if (pageImages.length === 0) {
    throw new Error('Kunde inte extrahera sidor från PDF');
  }
  
  if (pageImages.length === 1) {
    // Single page - no special handling needed
    return {
      totalPages: 1,
      documentsDetected: 1,
      pages: [{
        pageNumber: 1,
        imageKey: pageImages[0],
        isNewDocument: true,
        confidence: 1.0,
      }],
      splitStrategy: 'single',
      jobIds: [],
    };
  }
  
  // Multiple pages - analyze each to determine document boundaries
  const pages: PageInfo[] = [];
  let currentDocumentType: string | null = null;
  
  for (let i = 0; i < pageImages.length; i++) {
    const pageAnalysis = await analyzePageContent(pageImages[i], i + 1, currentDocumentType);
    
    pages.push({
      pageNumber: i + 1,
      imageKey: pageImages[i],
      isNewDocument: pageAnalysis.isNewDocument,
      documentType: pageAnalysis.documentType,
      confidence: pageAnalysis.confidence,
    });
    
    if (pageAnalysis.isNewDocument) {
      currentDocumentType = pageAnalysis.documentType;
    }
  }
  
  // Count distinct documents
  const documentsDetected = pages.filter(p => p.isNewDocument).length;
  
  // Determine strategy
  let splitStrategy: 'single' | 'multiple' | 'merged' = 'single';
  if (documentsDetected === 1) {
    splitStrategy = 'merged'; // All pages are one document
  } else if (documentsDetected > 1) {
    splitStrategy = 'multiple'; // Multiple documents detected
  }
  
  console.log(`[MultiPagePdf] Detected ${documentsDetected} document(s) in ${pageImages.length} pages, strategy: ${splitStrategy}`);
  
  return {
    totalPages: pageImages.length,
    documentsDetected,
    pages,
    splitStrategy,
    jobIds: [],
  };
}

/**
 * Extract pages from PDF as images
 */
async function extractPdfPages(fileKey: string): Promise<string[]> {
  // Note: In production, this would use a PDF library like pdf-lib or pdf2pic
  // For now, we'll use a placeholder that assumes the PDF has been pre-processed
  
  try {
    // Check for pre-extracted pages
    const baseKey = fileKey.replace('.pdf', '');
    const pageKeys: string[] = [];
    
    // Try to find page images (assumes naming convention: document_p1.jpg, document_p2.jpg, etc.)
    for (let i = 1; i <= 100; i++) { // Max 100 pages
      const pageKey = `${baseKey}_p${i}.jpg`;
      
      try {
        await s3Client.send(new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: pageKey,
        }));
        pageKeys.push(pageKey);
      } catch {
        // No more pages
        break;
      }
    }
    
    // If no pre-extracted pages, try to extract using AWS Textract or similar
    if (pageKeys.length === 0) {
      // Fall back to treating the PDF as a single document
      // The main processing pipeline will handle it
      console.log(`[MultiPagePdf] No pre-extracted pages found for ${fileKey}, treating as single document`);
      return [fileKey];
    }
    
    return pageKeys;
  } catch (error) {
    console.error('[MultiPagePdf] Error extracting pages:', error);
    return [fileKey];
  }
}

/**
 * Analyze page content to determine if it's a new document
 */
async function analyzePageContent(
  imageKey: string,
  pageNumber: number,
  previousDocType: string | null
): Promise<{
  isNewDocument: boolean;
  documentType: string;
  confidence: number;
}> {
  try {
    // Get image from S3
    const imageData = await getImageFromS3(imageKey);
    if (!imageData) {
      return { isNewDocument: pageNumber === 1, documentType: 'UNKNOWN', confidence: 0.5 };
    }
    
    // Use Claude to analyze
    const prompt = `Analysera denna sida (sida ${pageNumber}) i en PDF.

${previousDocType ? `Föregående dokument var en ${previousDocType}.` : 'Detta är första sidan.'}

Bestäm:
1. Är detta BÖRJAN på ett NYTT dokument, eller en fortsättning av föregående?
2. Vilken typ av dokument är det?

Tecken på NYTT dokument:
- Nytt företagsnamn/logotyp överst
- Nytt fakturanummer
- Nytt datum
- Ny leverantör
- Tydlig rubrik (FAKTURA, KVITTO, etc.)

Tecken på FORTSÄTTNING:
- "Sida 2 av 3" eller liknande
- Fortsatta radposter
- Samma leverantör/stil
- Ingen ny rubrik

Svara med JSON:
{
  "isNewDocument": true/false,
  "documentType": "INVOICE" | "RECEIPT" | "CREDIT_NOTE" | "BANK_STATEMENT" | "OTHER",
  "reasoning": "Kort förklaring",
  "confidence": 0.0-1.0
}`;

    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
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
      return {
        isNewDocument: pageNumber === 1 ? true : Boolean(result.isNewDocument),
        documentType: result.documentType || 'OTHER',
        confidence: result.confidence || 0.7,
      };
    }
  } catch (error) {
    console.error(`[MultiPagePdf] Error analyzing page ${pageNumber}:`, error);
  }
  
  // Default: first page is always new document
  return {
    isNewDocument: pageNumber === 1,
    documentType: previousDocType || 'OTHER',
    confidence: 0.5,
  };
}

/**
 * Get image data from S3 as base64
 */
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
    console.error(`[MultiPagePdf] Error getting image ${key}:`, error);
    return null;
  }
}

/**
 * Create accounting jobs from multi-page analysis
 */
export async function createJobsFromMultiPage(
  companyId: string,
  originalFileKey: string,
  originalFileName: string,
  analysis: MultiPageResult
): Promise<string[]> {
  const jobIds: string[] = [];
  const now = new Date().toISOString();
  
  if (analysis.splitStrategy === 'single' || analysis.splitStrategy === 'merged') {
    // Single job for all pages
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await docClient.send(new PutCommand({
      TableName: 'aifm-accounting-jobs',
      Item: {
        pk: `COMPANY#${companyId}`,
        sk: `JOB#${jobId}`,
        id: jobId,
        companyId,
        fileName: originalFileName,
        fileKey: originalFileKey,
        status: 'processing',
        createdAt: now,
        pageCount: analysis.totalPages,
        pageKeys: analysis.pages.map(p => p.imageKey),
        isMultiPage: analysis.totalPages > 1,
      },
    }));
    
    jobIds.push(jobId);
  } else {
    // Multiple jobs for multiple documents
    let currentDocPages: PageInfo[] = [];
    let docIndex = 0;
    
    for (const page of analysis.pages) {
      if (page.isNewDocument && currentDocPages.length > 0) {
        // Save previous document
        const jobId = await createJobForPages(
          companyId,
          originalFileName,
          originalFileKey,
          currentDocPages,
          docIndex
        );
        jobIds.push(jobId);
        docIndex++;
        currentDocPages = [];
      }
      currentDocPages.push(page);
    }
    
    // Save last document
    if (currentDocPages.length > 0) {
      const jobId = await createJobForPages(
        companyId,
        originalFileName,
        originalFileKey,
        currentDocPages,
        docIndex
      );
      jobIds.push(jobId);
    }
  }
  
  return jobIds;
}

async function createJobForPages(
  companyId: string,
  originalFileName: string,
  originalFileKey: string,
  pages: PageInfo[],
  docIndex: number
): Promise<string> {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  // Generate name for split document
  const baseName = originalFileName.replace(/\.[^.]+$/, '');
  const extension = originalFileName.match(/\.[^.]+$/)?.[0] || '';
  const fileName = pages.length === 1 
    ? `${baseName}_dok${docIndex + 1}${extension}`
    : `${baseName}_dok${docIndex + 1}_${pages.length}sidor${extension}`;
  
  await docClient.send(new PutCommand({
    TableName: 'aifm-accounting-jobs',
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `JOB#${jobId}`,
      id: jobId,
      companyId,
      fileName,
      fileKey: pages[0].imageKey, // Primary page
      originalFileKey,
      status: 'processing',
      createdAt: now,
      pageCount: pages.length,
      pageKeys: pages.map(p => p.imageKey),
      pageNumbers: pages.map(p => p.pageNumber),
      isMultiPage: pages.length > 1,
      splitFromOriginal: true,
      documentIndex: docIndex,
    },
  }));
  
  return jobId;
}

/**
 * Merge pages into a single document view
 */
export function mergePageContents(
  pages: { text: string; confidence: number }[]
): { mergedText: string; confidence: number } {
  const mergedText = pages.map(p => p.text).join('\n\n--- Nästa sida ---\n\n');
  const avgConfidence = pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length;
  
  return {
    mergedText,
    confidence: avgConfidence,
  };
}








