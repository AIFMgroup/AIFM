import { NextRequest, NextResponse } from 'next/server';
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as XLSX from 'xlsx';

// Dynamic imports for server-side only modules
let mammoth: typeof import('mammoth') | null = null;
let pdfParse: typeof import('pdf-parse') | null = null;

// Initialize AWS clients
const textractClient = new TextractClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'aifm-documents';

// ============================================================================
// PDF Extraction - Multiple methods for best results
// ============================================================================

async function extractTextFromPDF(buffer: Buffer, fileName: string): Promise<string> {
  const results: string[] = [];
  let bestResult = '';

  // Method 1: Try pdf-parse first (fast, works for most PDFs)
  try {
    if (!pdfParse) {
      pdfParse = (await import('pdf-parse')).default;
    }
    const pdfData = await pdfParse(buffer);
    if (pdfData.text && pdfData.text.trim().length > 100) {
      bestResult = pdfData.text;
      results.push(`[pdf-parse] Extracted ${pdfData.text.length} characters from ${pdfData.numpages} pages`);
    }
  } catch (error) {
    console.log('[PDF] pdf-parse failed, trying Textract...');
  }

  // Method 2: If pdf-parse didn't work well, use AWS Textract
  if (bestResult.length < 100) {
    try {
      const s3Key = `temp-parse/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      // Upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
      }));

      // Use Textract AnalyzeDocument for better structure
      const command = new AnalyzeDocumentCommand({
        Document: {
          S3Object: {
            Bucket: BUCKET_NAME,
            Name: s3Key,
          },
        },
        FeatureTypes: ['TABLES', 'FORMS'],
      });

      try {
        const response = await textractClient.send(command);
        
        // Extract text preserving structure
        const lines: string[] = [];
        const tables: string[] = [];
        
        response.Blocks?.forEach(block => {
          if (block.BlockType === 'LINE' && block.Text) {
            lines.push(block.Text);
          }
          if (block.BlockType === 'TABLE') {
            // Process table cells
            const tableContent = response.Blocks
              ?.filter(b => b.BlockType === 'CELL' && 
                block.Relationships?.some(r => r.Ids?.includes(b.Id || '')))
              .map(cell => cell.Text || '')
              .join(' | ');
            if (tableContent) {
              tables.push(`[Tabell] ${tableContent}`);
            }
          }
        });

        const textractResult = [...lines, ...tables].join('\n');
        if (textractResult.length > bestResult.length) {
          bestResult = textractResult;
        }
      } catch (analyzeError) {
        // Fallback to simple text detection
        const simpleCommand = new DetectDocumentTextCommand({
          Document: {
            S3Object: {
              Bucket: BUCKET_NAME,
              Name: s3Key,
            },
          },
        });
        
        const response = await textractClient.send(simpleCommand);
        const textractResult = response.Blocks
          ?.filter(block => block.BlockType === 'LINE')
          .map(block => block.Text)
          .join('\n') || '';
        
        if (textractResult.length > bestResult.length) {
          bestResult = textractResult;
        }
      }

      // Clean up temp file
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      }));
      
    } catch (error) {
      console.error('[PDF] Textract error:', error);
    }
  }

  if (!bestResult || bestResult.length < 50) {
    return '[PDF kunde inte läsas. Filen kan vara skannad utan OCR eller skyddad. Försök med en annan version av dokumentet.]';
  }

  // Clean up the result
  return cleanExtractedText(bestResult);
}

// ============================================================================
// Word Document Extraction - Using Mammoth for best results
// ============================================================================

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  console.log('[DOCX] Starting extraction, buffer size:', buffer.length);
  
  try {
    // Use mammoth for high-quality extraction
    if (!mammoth) {
      console.log('[DOCX] Loading mammoth...');
      mammoth = await import('mammoth');
      console.log('[DOCX] Mammoth loaded successfully');
    }
    
    console.log('[DOCX] Extracting raw text...');
    const result = await mammoth.extractRawText({ buffer });
    console.log('[DOCX] Raw text extracted, length:', result.value?.length || 0);
    
    if (result.value && result.value.trim().length > 50) {
      // Also try to get HTML for better structure understanding
      console.log('[DOCX] Converting to HTML for structure...');
      const htmlResult = await mammoth.convertToHtml({ buffer });
      
      // Extract headers and structure from HTML
      const structuredText = extractStructureFromHtml(htmlResult.value, result.value);
      console.log('[DOCX] Final extracted text length:', structuredText.length);
      
      return cleanExtractedText(structuredText);
    }
    
    console.log('[DOCX] Document appears empty or too short');
    return '[Word-dokument verkar vara tomt eller skadat.]';
  } catch (error) {
    console.error('[DOCX] Mammoth error:', error);
    
    // Fallback: try basic XML extraction
    try {
      const content = buffer.toString('utf-8');
      const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (textMatches) {
        const text = textMatches
          .map(match => match.replace(/<[^>]+>/g, ''))
          .join(' ');
        return cleanExtractedText(text);
      }
    } catch (fallbackError) {
      console.error('[DOCX] Fallback extraction error:', fallbackError);
    }
    
    return '[Word-dokument kunde inte läsas. Kontrollera att filen är en giltig .docx-fil.]';
  }
}

function extractStructureFromHtml(html: string, plainText: string): string {
  // Extract headers and structure from HTML
  const headerMatches = html.match(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/gi) || [];
  const headers = headerMatches.map(h => h.replace(/<[^>]+>/g, '').trim());
  
  // If we found headers, add structure markers
  if (headers.length > 0) {
    let structured = plainText;
    headers.forEach(header => {
      if (header.length > 0) {
        structured = structured.replace(header, `\n\n## ${header}\n`);
      }
    });
    return structured;
  }
  
  return plainText;
}

// ============================================================================
// Excel Extraction - Advanced with structure preservation
// ============================================================================

async function extractTextFromExcel(buffer: Buffer, fileName: string): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellStyles: true,
    });
    
    const output: string[] = [];
    output.push(`📊 Excel-fil: ${fileName}`);
    output.push(`📑 Antal flikar: ${workbook.SheetNames.length}`);
    output.push('');
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      
      output.push(`\n${'═'.repeat(60)}`);
      output.push(`📋 FLIK: ${sheetName}`);
      output.push(`   Område: ${sheet['!ref'] || 'Tom'}`);
      output.push(`   Rader: ${range.e.r - range.s.r + 1}, Kolumner: ${range.e.c - range.s.c + 1}`);
      output.push('═'.repeat(60));
      
      // Get data as JSON for structured output
      const jsonData = XLSX.utils.sheet_to_json(sheet, { 
        header: 1,
        defval: '',
        blankrows: false,
      }) as unknown[][];
      
      if (jsonData.length === 0) {
        output.push('(Tom flik)');
        continue;
      }
      
      // Identify headers (first row)
      const headers = jsonData[0] as string[];
      if (headers && headers.length > 0) {
        output.push(`\n📊 Kolumner: ${headers.filter(h => h).join(' | ')}`);
      }
      
      // Format as readable table
      output.push('\n--- DATA ---');
      
      // Limit rows for very large sheets
      const maxRows = 500;
      const dataRows = jsonData.slice(0, maxRows);
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] as unknown[];
        const formattedRow = row.map((cell, idx) => {
          if (cell === null || cell === undefined || cell === '') return '';
          
          // Format dates
          if (cell instanceof Date) {
            return cell.toISOString().split('T')[0];
          }
          
          // Format numbers
          if (typeof cell === 'number') {
            if (Number.isInteger(cell)) return cell.toString();
            return cell.toFixed(2);
          }
          
          return String(cell);
        }).filter(c => c !== '');
        
        if (formattedRow.length > 0) {
          if (i === 0 && headers.length > 0) {
            output.push(`[RUBRIK] ${formattedRow.join(' | ')}`);
          } else {
            output.push(`[Rad ${i + 1}] ${formattedRow.join(' | ')}`);
          }
        }
      }
      
      if (jsonData.length > maxRows) {
        output.push(`\n... (${jsonData.length - maxRows} fler rader visas inte)`);
      }
      
      // Summary statistics for numeric columns
      const numericSummary = getNumericSummary(jsonData, headers);
      if (numericSummary) {
        output.push('\n📈 SAMMANFATTNING:');
        output.push(numericSummary);
      }
    }
    
    return output.join('\n');
    
  } catch (error) {
    console.error('[Excel] Extraction error:', error);
    return '[Excel-fil kunde inte läsas. Kontrollera att filen är en giltig Excel-fil.]';
  }
}

function getNumericSummary(data: unknown[][], headers: string[]): string | null {
  if (data.length < 2) return null;
  
  const summaries: string[] = [];
  const dataRows = data.slice(1);
  
  for (let col = 0; col < headers.length; col++) {
    const values = dataRows
      .map(row => (row as unknown[])[col])
      .filter(v => typeof v === 'number') as number[];
    
    if (values.length > 2) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      const header = headers[col] || `Kolumn ${col + 1}`;
      summaries.push(`  ${header}: Summa=${sum.toFixed(2)}, Medel=${avg.toFixed(2)}, Min=${min}, Max=${max}`);
    }
  }
  
  return summaries.length > 0 ? summaries.join('\n') : null;
}

// ============================================================================
// CSV Extraction - With intelligent parsing
// ============================================================================

function extractTextFromCSV(buffer: Buffer, fileName: string): string {
  const content = buffer.toString('utf-8');
  
  // Detect delimiter
  const firstLine = content.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  
  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';
  
  const output: string[] = [];
  output.push(`📄 CSV-fil: ${fileName}`);
  output.push(`   Avgränsare: ${delimiter === ',' ? 'komma' : delimiter === ';' ? 'semikolon' : 'tab'}`);
  output.push('');
  
  const lines = content.split('\n').filter(line => line.trim());
  output.push(`   Antal rader: ${lines.length}`);
  
  // Parse and format
  const maxRows = 500;
  const displayLines = lines.slice(0, maxRows);
  
  output.push('\n--- DATA ---');
  
  displayLines.forEach((line, idx) => {
    const cells = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (idx === 0) {
      output.push(`[RUBRIK] ${cells.join(' | ')}`);
    } else {
      output.push(`[Rad ${idx + 1}] ${cells.join(' | ')}`);
    }
  });
  
  if (lines.length > maxRows) {
    output.push(`\n... (${lines.length - maxRows} fler rader visas inte)`);
  }
  
  return output.join('\n');
}

// ============================================================================
// Image Extraction - Prepare for Claude Vision
// ============================================================================

async function extractTextFromImage(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  // For images, we'll use Textract for OCR if there's text
  try {
    const s3Key = `temp-parse/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    }));

    // Use Textract for OCR
    const command = new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: BUCKET_NAME,
          Name: s3Key,
        },
      },
    });

    const response = await textractClient.send(command);
    
    // Clean up
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    }));

    const extractedText = response.Blocks
      ?.filter(block => block.BlockType === 'LINE')
      .map(block => block.Text)
      .join('\n') || '';

    if (extractedText.length > 50) {
      return `🖼️ Bild: ${fileName}\n📝 Extraherad text (OCR):\n\n${extractedText}`;
    }
    
    // If no text found, return image info for vision analysis
    return `🖼️ Bild: ${fileName}\n📐 Typ: ${mimeType}\n📦 Storlek: ${buffer.length} bytes\n\n[Bilden innehåller ingen läsbar text. Den kan analyseras visuellt av AI:n.]`;
    
  } catch (error) {
    console.error('[Image] Textract error:', error);
    return `🖼️ Bild: ${fileName}\n[Bilden kunde inte OCR-behandlas men kan analyseras visuellt av AI:n.]`;
  }
}

// ============================================================================
// Text Extraction - With encoding detection
// ============================================================================

function extractTextFromText(buffer: Buffer, fileName: string): string {
  // Try different encodings
  let content = '';
  
  try {
    content = buffer.toString('utf-8');
  } catch {
    try {
      content = buffer.toString('latin1');
    } catch {
      content = buffer.toString('ascii');
    }
  }
  
  // Remove BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  const lines = content.split('\n').length;
  const words = content.split(/\s+/).length;
  
  return `📄 Textfil: ${fileName}\n📏 ${lines} rader, ${words} ord\n\n${content}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/[ \t]+/g, ' ')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Clean up common OCR artifacts
    .replace(/[^\S\n]+$/gm, '')
    // Trim
    .trim();
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  console.log('[Parse] Request received');
  
  try {
    const formData = await request.formData();
    console.log('[Parse] FormData parsed');
    
    const file = formData.get('file') as File;

    if (!file) {
      console.error('[Parse] No file in request');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`[Parse] File received: ${file.name}, type: ${file.type}, size: ${file.size}`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const fileNameLower = fileName.toLowerCase();
    const fileType = file.type;

    console.log(`[Parse] Processing: ${fileName} (${fileType}, ${buffer.length} bytes)`);

    let extractedText = '';
    let parseMethod = 'unknown';

    // Route to appropriate parser based on file type
    if (fileType === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      parseMethod = 'pdf';
      extractedText = await extractTextFromPDF(buffer, fileName);
    } 
    else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileNameLower.endsWith('.docx')
    ) {
      parseMethod = 'docx';
      extractedText = await extractTextFromDocx(buffer);
    }
    else if (
      fileType === 'application/msword' || 
      fileNameLower.endsWith('.doc')
    ) {
      parseMethod = 'doc';
      // Old .doc format - try Textract
      extractedText = '[Äldre .doc-format. Konvertera till .docx för bäst resultat.]';
    }
    else if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      fileType === 'application/vnd.ms-excel' ||
      fileNameLower.endsWith('.xlsx') || 
      fileNameLower.endsWith('.xls')
    ) {
      parseMethod = 'excel';
      extractedText = await extractTextFromExcel(buffer, fileName);
    }
    else if (fileType === 'text/csv' || fileNameLower.endsWith('.csv')) {
      parseMethod = 'csv';
      extractedText = extractTextFromCSV(buffer, fileName);
    }
    else if (
      fileType === 'text/plain' || 
      fileNameLower.endsWith('.txt') ||
      fileNameLower.endsWith('.md') ||
      fileNameLower.endsWith('.json') ||
      fileNameLower.endsWith('.xml')
    ) {
      parseMethod = 'text';
      extractedText = extractTextFromText(buffer, fileName);
    }
    else if (fileType.startsWith('image/')) {
      parseMethod = 'image';
      extractedText = await extractTextFromImage(buffer, fileName, fileType);
    }
    else {
      // Try to extract as text
      parseMethod = 'fallback';
      extractedText = extractTextFromText(buffer, fileName);
    }

    // Truncate if too long
    const MAX_LENGTH = 150000; // ~150k characters for better context
    let truncated = false;
    if (extractedText.length > MAX_LENGTH) {
      extractedText = extractedText.slice(0, MAX_LENGTH) + 
        `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ Dokumentet är för långt (${Math.round(extractedText.length / 1000)}k tecken).\n` +
        `Endast första ${Math.round(MAX_LENGTH / 1000)}k tecken visas.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      truncated = true;
    }

    console.log(`[Parse] Completed: ${parseMethod}, ${extractedText.length} chars extracted`);
    console.log(`[Parse] First 200 chars: ${extractedText.substring(0, 200)}`);

    const responseData = {
      content: extractedText,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      parseMethod,
      truncated,
      extractedLength: extractedText.length,
    };
    
    console.log('[Parse] Sending response with content length:', responseData.content.length);
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Parse] Error:', error);
    console.error('[Parse] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      { 
        error: 'Failed to parse file',
        details: error instanceof Error ? error.message : 'Unknown error',
        content: '[Filen kunde inte läsas. Ett tekniskt fel uppstod.]'
      },
      { status: 500 }
    );
  }
}
