/**
 * API: Process Swedbank PDF
 * 
 * Tar emot en PDF-fil (uppladdad eller från S3) och:
 * 1. Extraherar text med Textract
 * 2. Strukturerar data med Bedrock Claude
 * 3. Genererar Excel-rapport
 * 4. Returnerar strukturerad data
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  processSwedBankPDF, 
  saveProcessedReport,
  SwedBankCustodyReport 
} from '@/lib/integrations/bank/swedbank-pdf-processor';

// Route segment config
export const maxDuration = 120; // 2 minuter timeout för Textract + Bedrock
export const dynamic = 'force-dynamic';

interface ProcessPDFRequest {
  // Antingen s3Source ELLER base64Data
  s3Source?: {
    bucket: string;
    key: string;
  };
  base64Data?: string;
  fundId?: string;
  saveToS3?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let pdfBuffer: Buffer;
    let fundId: string | undefined;
    let saveToS3 = false;
    
    // Hantera multipart form data (fil-uppladdning)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      fundId = formData.get('fundId') as string | undefined;
      saveToS3 = formData.get('saveToS3') === 'true';
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      
      const arrayBuffer = await file.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
      
    } else {
      // JSON request med base64 eller S3-referens
      const body: ProcessPDFRequest = await request.json();
      
      if (body.s3Source) {
        // Processa direkt från S3
        const result = await processSwedBankPDF(body.s3Source);
        
        if (!result.success) {
          return NextResponse.json(
            { error: 'PDF processing failed', details: result.errors },
            { status: 500 }
          );
        }
        
        // Spara till S3 om begärt
        let savedFiles;
        if (body.saveToS3 && result.report && result.excelBuffer) {
          savedFiles = await saveProcessedReport(
            result.report,
            result.excelBuffer,
            process.env.DATA_BUCKET || 'aifm-data'
          );
        }
        
        return NextResponse.json({
          success: true,
          report: result.report,
          savedFiles,
          processingTimeMs: result.processingTimeMs,
        });
      }
      
      if (!body.base64Data) {
        return NextResponse.json(
          { error: 'Either file, s3Source, or base64Data must be provided' },
          { status: 400 }
        );
      }
      
      pdfBuffer = Buffer.from(body.base64Data, 'base64');
      fundId = body.fundId;
      saveToS3 = body.saveToS3 || false;
    }
    
    // Validera att det är en PDF
    const pdfMagic = pdfBuffer.slice(0, 4).toString();
    if (pdfMagic !== '%PDF') {
      return NextResponse.json(
        { error: 'Invalid file format. Expected PDF.' },
        { status: 400 }
      );
    }
    
    console.log(`[SwedBank API] Processing PDF, size: ${pdfBuffer.length} bytes, fundId: ${fundId}`);
    
    // Processa PDF
    const result = await processSwedBankPDF(pdfBuffer);
    
    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'PDF processing failed', 
          details: result.errors,
          processingTimeMs: result.processingTimeMs,
        },
        { status: 500 }
      );
    }
    
    // Spara till S3 om begärt
    let savedFiles;
    if (saveToS3 && result.report && result.excelBuffer) {
      savedFiles = await saveProcessedReport(
        result.report,
        result.excelBuffer,
        process.env.DATA_BUCKET || 'aifm-data'
      );
    }
    
    // Returnera resultat
    // OBS: Excel-buffern skickas som base64 om klienten vill ladda ner den direkt
    const response: {
      success: boolean;
      report: SwedBankCustodyReport | undefined;
      excelBase64?: string;
      savedFiles?: { jsonKey: string; excelKey: string };
      processingTimeMs: number;
      warnings?: string[];
    } = {
      success: true,
      report: result.report,
      processingTimeMs: result.processingTimeMs,
    };
    
    if (result.excelBuffer) {
      response.excelBase64 = Buffer.from(result.excelBuffer).toString('base64');
    }
    
    if (savedFiles) {
      response.savedFiles = savedFiles;
    }
    
    if (result.errors && result.errors.length > 0) {
      response.warnings = result.errors;
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[SwedBank API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Hämta senaste processade rapporter
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fundId = searchParams.get('fundId');
  const date = searchParams.get('date');
  
  // TODO: Implementera hämtning av historiska rapporter från S3/DynamoDB
  
  return NextResponse.json({
    message: 'Use POST to process a PDF',
    endpoints: {
      process: 'POST /api/bank/swedbank/process-pdf',
      body: {
        option1: 'multipart/form-data with file field',
        option2: 'JSON with base64Data field',
        option3: 'JSON with s3Source { bucket, key }',
      },
      optionalParams: {
        fundId: 'Fund ID to associate with the report',
        saveToS3: 'Whether to save processed files to S3',
      },
    },
  });
}
