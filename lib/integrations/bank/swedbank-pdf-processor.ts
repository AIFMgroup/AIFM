/**
 * Swedbank PDF Processor
 * 
 * Automatiserad pipeline för att:
 * 1. Ta emot PDF:er från Swedbank via email
 * 2. Extrahera text med AWS Textract
 * 3. Strukturera data med AWS Bedrock (Claude)
 * 4. Generera Excel för NAV-avstämning
 */

import { TextractClient, AnalyzeDocumentCommand, FeatureType } from '@aws-sdk/client-textract';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// Types
// ============================================================================

export interface SwedBankCustodyReport {
  reportDate: string;
  accountNumber: string;
  fundName: string;
  currency: string;
  
  // Positioner
  positions: SwedBankPosition[];
  
  // Saldon
  cashBalance: number;
  totalMarketValue: number;
  
  // Transaktioner (om inkluderat)
  transactions?: SwedBankTransaction[];
  
  // Metadata
  extractedAt: string;
  confidence: number;
  rawText?: string;
}

export interface SwedBankPosition {
  isin: string;
  instrumentName: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  currency: string;
  priceDate?: string;
}

export interface SwedBankTransaction {
  date: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE' | 'TRANSFER' | 'OTHER';
  description: string;
  amount: number;
  currency: string;
  isin?: string;
}

export interface ProcessingResult {
  success: boolean;
  report?: SwedBankCustodyReport;
  excelBuffer?: ArrayBuffer;
  errors?: string[];
  processingTimeMs: number;
}

// ============================================================================
// Configuration
// ============================================================================

const TEXTRACT_CONFIG = {
  region: process.env.AWS_REGION || 'eu-north-1',
};

const BEDROCK_CONFIG = {
  region: process.env.BEDROCK_REGION || 'eu-west-1', // Bedrock might be in different region
  modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
};

// ============================================================================
// Clients
// ============================================================================

let textractClient: TextractClient | null = null;
let bedrockClient: BedrockRuntimeClient | null = null;
let s3Client: S3Client | null = null;

function getTextractClient(): TextractClient {
  if (!textractClient) {
    textractClient = new TextractClient({ region: TEXTRACT_CONFIG.region });
  }
  return textractClient;
}

function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_CONFIG.region });
  }
  return bedrockClient;
}

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: TEXTRACT_CONFIG.region });
  }
  return s3Client;
}

// ============================================================================
// PDF Text Extraction (Textract)
// ============================================================================

/**
 * Extraherar text från PDF med AWS Textract
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer | Uint8Array
): Promise<{ text: string; tables: string[][]; confidence: number }> {
  const client = getTextractClient();
  
  try {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: pdfBuffer instanceof Buffer ? pdfBuffer : Buffer.from(pdfBuffer),
      },
      FeatureTypes: [FeatureType.TABLES, FeatureType.FORMS],
    });
    
    const response = await client.send(command);
    
    // Extrahera all text
    let fullText = '';
    const blocks = response.Blocks || [];
    let totalConfidence = 0;
    let confidenceCount = 0;
    
    // Extrahera text från LINE-block
    for (const block of blocks) {
      if (block.BlockType === 'LINE' && block.Text) {
        fullText += block.Text + '\n';
        if (block.Confidence) {
          totalConfidence += block.Confidence;
          confidenceCount++;
        }
      }
    }
    
    // Extrahera tabeller
    const tables: string[][] = [];
    const tableBlocks = blocks.filter(b => b.BlockType === 'TABLE');
    
    for (const table of tableBlocks) {
      const tableData: string[][] = [];
      const cellBlocks = blocks.filter(b => 
        b.BlockType === 'CELL' && 
        table.Relationships?.some(r => r.Ids?.includes(b.Id || ''))
      );
      
      // Gruppera celler per rad
      const rows = new Map<number, { col: number; text: string }[]>();
      for (const cell of cellBlocks) {
        const row = cell.RowIndex || 0;
        const col = cell.ColumnIndex || 0;
        
        // Hämta text för cellen
        const childIds = cell.Relationships?.find(r => r.Type === 'CHILD')?.Ids || [];
        const cellText = childIds
          .map(id => blocks.find(b => b.Id === id)?.Text || '')
          .join(' ')
          .trim();
        
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row)!.push({ col, text: cellText });
      }
      
      // Konvertera till 2D-array
      for (const [, cells] of Array.from(rows.entries()).sort((a, b) => a[0] - b[0])) {
        const rowData = cells.sort((a, b) => a.col - b.col).map(c => c.text);
        tableData.push(rowData);
      }
      
      if (tableData.length > 0) {
        tables.push(...tableData);
      }
    }
    
    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    
    return {
      text: fullText,
      tables,
      confidence: avgConfidence / 100, // Normalisera till 0-1
    };
  } catch (error) {
    console.error('[SwedBankPDF] Textract error:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// LLM Data Structuring (Bedrock Claude)
// ============================================================================

const EXTRACTION_PROMPT = `Du är en expert på att extrahera finansiell data från custody-rapporter.

Analysera följande text som kommer från en Swedbank custody-rapport och extrahera all relevant information i JSON-format.

TEXT ATT ANALYSERA:
<document>
{TEXT}
</document>

TABELLDATA (om tillgänglig):
<tables>
{TABLES}
</tables>

Extrahera följande information och returnera ENDAST valid JSON (ingen annan text):

{
  "reportDate": "YYYY-MM-DD (datumet rapporten avser)",
  "accountNumber": "Kontonummer/depånummer",
  "fundName": "Fondnamn om specificerat",
  "currency": "Huvudvaluta (SEK/EUR/USD)",
  "positions": [
    {
      "isin": "ISIN-kod",
      "instrumentName": "Instrumentnamn",
      "quantity": 0.00,
      "marketPrice": 0.00,
      "marketValue": 0.00,
      "currency": "SEK",
      "priceDate": "YYYY-MM-DD eller null"
    }
  ],
  "cashBalance": 0.00,
  "totalMarketValue": 0.00,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "type": "BUY|SELL|DIVIDEND|FEE|TRANSFER|OTHER",
      "description": "Beskrivning",
      "amount": 0.00,
      "currency": "SEK",
      "isin": "ISIN om tillämpligt"
    }
  ]
}

VIKTIGT:
- Om du inte hittar ett värde, använd null
- Belopp ska vara numeriska (ej strängar)
- Datumet ska vara i format YYYY-MM-DD
- Gissa INTE värden - extrahera endast det som finns i dokumentet
- Om transaktioner inte finns med, lämna transactions som tom array []

Returnera ENDAST JSON, ingen annan text.`;

/**
 * Använder Bedrock Claude för att strukturera extraherad text
 */
export async function structureDataWithLLM(
  text: string,
  tables: string[][]
): Promise<Partial<SwedBankCustodyReport>> {
  const client = getBedrockClient();
  
  // Formatera tabeller för prompten
  const tablesText = tables.length > 0
    ? tables.map((row, i) => `Rad ${i + 1}: ${row.join(' | ')}`).join('\n')
    : 'Inga tabeller extraherade';
  
  const prompt = EXTRACTION_PROMPT
    .replace('{TEXT}', text)
    .replace('{TABLES}', tablesText);
  
  try {
    const command = new InvokeModelCommand({
      modelId: BEDROCK_CONFIG.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Låg temperatur för konsistent extraktion
      }),
    });
    
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extrahera JSON från svaret
    const content = responseBody.content?.[0]?.text || '';
    
    // Försök parse:a JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in LLM response');
    }
    
    const extractedData = JSON.parse(jsonMatch[0]);
    
    return {
      reportDate: extractedData.reportDate || new Date().toISOString().split('T')[0],
      accountNumber: extractedData.accountNumber || 'UNKNOWN',
      fundName: extractedData.fundName || 'Unknown Fund',
      currency: extractedData.currency || 'SEK',
      positions: (extractedData.positions || []).map((p: Record<string, unknown>) => ({
        isin: String(p.isin || ''),
        instrumentName: String(p.instrumentName || ''),
        quantity: Number(p.quantity) || 0,
        marketPrice: Number(p.marketPrice) || 0,
        marketValue: Number(p.marketValue) || 0,
        currency: String(p.currency || 'SEK'),
        priceDate: p.priceDate ? String(p.priceDate) : undefined,
      })),
      cashBalance: Number(extractedData.cashBalance) || 0,
      totalMarketValue: Number(extractedData.totalMarketValue) || 0,
      transactions: (extractedData.transactions || []).map((t: Record<string, unknown>) => ({
        date: String(t.date || ''),
        type: t.type as SwedBankTransaction['type'] || 'OTHER',
        description: String(t.description || ''),
        amount: Number(t.amount) || 0,
        currency: String(t.currency || 'SEK'),
        isin: t.isin ? String(t.isin) : undefined,
      })),
    };
  } catch (error) {
    console.error('[SwedBankPDF] Bedrock error:', error);
    throw new Error(`Failed to structure data with LLM: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Excel Generation
// ============================================================================

import ExcelJS from 'exceljs';

const COLORS = {
  gold: 'C9A227',
  charcoal: '1F2937',
  lightGray: 'F9FAFB',
  mediumGray: 'E5E7EB',
  green: '10B981',
  red: 'EF4444',
};

/**
 * Genererar en professionell Excel-rapport från extraherad data
 */
export async function generateSwedBankExcel(
  report: SwedBankCustodyReport
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AIFM - Swedbank Integration';
  workbook.created = new Date();
  
  // ========== ÖVERSIKT ==========
  const overviewSheet = workbook.addWorksheet('Översikt', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  
  // Header
  overviewSheet.mergeCells('A1:F1');
  const headerCell = overviewSheet.getCell('A1');
  headerCell.value = 'Swedbank Custody-rapport';
  headerCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: COLORS.gold } };
  headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.charcoal } };
  headerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  overviewSheet.getRow(1).height = 40;
  
  // Rapport-info
  const infoData = [
    ['Rapportdatum:', report.reportDate],
    ['Kontonummer:', report.accountNumber],
    ['Fond:', report.fundName],
    ['Valuta:', report.currency],
    ['Extraherad:', report.extractedAt],
    ['Konfidensgrad:', `${(report.confidence * 100).toFixed(1)}%`],
  ];
  
  let row = 3;
  for (const [label, value] of infoData) {
    overviewSheet.getCell(`A${row}`).value = label;
    overviewSheet.getCell(`A${row}`).font = { bold: true, size: 10 };
    overviewSheet.getCell(`B${row}`).value = value;
    row++;
  }
  
  // Sammanfattning
  row += 2;
  overviewSheet.mergeCells(`A${row}:D${row}`);
  overviewSheet.getCell(`A${row}`).value = 'Sammanfattning';
  overviewSheet.getCell(`A${row}`).font = { bold: true, size: 14 };
  row++;
  
  const summaryData = [
    ['Antal positioner:', report.positions.length],
    ['Kassasaldo:', formatCurrency(report.cashBalance)],
    ['Totalt marknadsvärde:', formatCurrency(report.totalMarketValue)],
  ];
  
  for (const [label, value] of summaryData) {
    overviewSheet.getCell(`A${row}`).value = label;
    overviewSheet.getCell(`B${row}`).value = value;
    overviewSheet.getCell(`B${row}`).font = { bold: true };
    row++;
  }
  
  overviewSheet.getColumn(1).width = 20;
  overviewSheet.getColumn(2).width = 25;
  
  // ========== POSITIONER ==========
  const posSheet = workbook.addWorksheet('Positioner', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  
  // Header
  posSheet.mergeCells('A1:G1');
  const posHeader = posSheet.getCell('A1');
  posHeader.value = 'Värdepapperspositioner';
  posHeader.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.charcoal } };
  posSheet.getRow(1).height = 30;
  
  // Kolumnrubriker
  const posColumns = [
    { key: 'isin', header: 'ISIN', width: 16 },
    { key: 'name', header: 'Instrument', width: 35 },
    { key: 'qty', header: 'Antal', width: 15 },
    { key: 'price', header: 'Kurs', width: 15 },
    { key: 'value', header: 'Marknadsvärde', width: 18 },
    { key: 'currency', header: 'Valuta', width: 10 },
    { key: 'priceDate', header: 'Prisdatum', width: 12 },
  ];
  
  const headerRow = 3;
  posColumns.forEach((col, i) => {
    const cell = posSheet.getCell(headerRow, i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 11, color: { argb: COLORS.charcoal } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLORS.mediumGray } },
    };
    posSheet.getColumn(i + 1).width = col.width;
  });
  
  // Data
  report.positions.forEach((pos, i) => {
    const dataRow = headerRow + 1 + i;
    const isAlt = i % 2 === 1;
    
    const values = [
      pos.isin,
      pos.instrumentName,
      pos.quantity,
      pos.marketPrice,
      pos.marketValue,
      pos.currency,
      pos.priceDate || '-',
    ];
    
    values.forEach((val, j) => {
      const cell = posSheet.getCell(dataRow, j + 1);
      cell.value = val;
      
      // Formatera nummer
      if (j === 2) cell.numFmt = '#,##0.0000';
      if (j === 3 || j === 4) cell.numFmt = '#,##0.00';
      
      if (isAlt) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
      }
    });
  });
  
  // Total-rad
  const totalRow = headerRow + 1 + report.positions.length + 1;
  posSheet.getCell(totalRow, 1).value = 'TOTALT';
  posSheet.getCell(totalRow, 1).font = { bold: true };
  posSheet.getCell(totalRow, 5).value = report.totalMarketValue;
  posSheet.getCell(totalRow, 5).numFmt = '#,##0.00';
  posSheet.getCell(totalRow, 5).font = { bold: true };
  posSheet.getRow(totalRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.charcoal } };
  posSheet.getRow(totalRow).font = { color: { argb: 'FFFFFF' }, bold: true };
  
  // ========== TRANSAKTIONER (om finns) ==========
  if (report.transactions && report.transactions.length > 0) {
    const txSheet = workbook.addWorksheet('Transaktioner', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });
    
    txSheet.mergeCells('A1:F1');
    const txHeader = txSheet.getCell('A1');
    txHeader.value = 'Transaktioner';
    txHeader.font = { name: 'Calibri', size: 16, bold: true };
    txSheet.getRow(1).height = 30;
    
    const txColumns = [
      { key: 'date', header: 'Datum', width: 12 },
      { key: 'type', header: 'Typ', width: 12 },
      { key: 'desc', header: 'Beskrivning', width: 40 },
      { key: 'amount', header: 'Belopp', width: 18 },
      { key: 'currency', header: 'Valuta', width: 10 },
      { key: 'isin', header: 'ISIN', width: 16 },
    ];
    
    txColumns.forEach((col, i) => {
      const cell = txSheet.getCell(3, i + 1);
      cell.value = col.header;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } };
      txSheet.getColumn(i + 1).width = col.width;
    });
    
    report.transactions.forEach((tx, i) => {
      const dataRow = 4 + i;
      txSheet.getCell(dataRow, 1).value = tx.date;
      txSheet.getCell(dataRow, 2).value = tx.type;
      txSheet.getCell(dataRow, 3).value = tx.description;
      txSheet.getCell(dataRow, 4).value = tx.amount;
      txSheet.getCell(dataRow, 4).numFmt = '#,##0.00';
      txSheet.getCell(dataRow, 5).value = tx.currency;
      txSheet.getCell(dataRow, 6).value = tx.isin || '-';
    });
  }
  
  // ========== RÅDATA (för debugging) ==========
  if (report.rawText) {
    const rawSheet = workbook.addWorksheet('Rådata', {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
    });
    rawSheet.getCell('A1').value = 'Extraherad råtext från PDF';
    rawSheet.getCell('A1').font = { bold: true };
    rawSheet.getCell('A3').value = report.rawText;
    rawSheet.getColumn(1).width = 100;
  }
  
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// Main Processing Pipeline
// ============================================================================

/**
 * Huvudfunktion: Processar en PDF från Swedbank och returnerar strukturerad data + Excel
 */
export async function processSwedBankPDF(
  pdfSource: Buffer | Uint8Array | { bucket: string; key: string }
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  
  try {
    // 1. Hämta PDF-data
    let pdfBuffer: Buffer | Uint8Array;
    
    if ('bucket' in pdfSource) {
      // Hämta från S3
      const s3 = getS3Client();
      const response = await s3.send(new GetObjectCommand({
        Bucket: pdfSource.bucket,
        Key: pdfSource.key,
      }));
      pdfBuffer = await response.Body?.transformToByteArray() || new Uint8Array();
    } else {
      pdfBuffer = pdfSource;
    }
    
    console.log('[SwedBankPDF] Starting processing, PDF size:', pdfBuffer.length);
    
    // 2. Extrahera text med Textract
    console.log('[SwedBankPDF] Extracting text with Textract...');
    const { text, tables, confidence } = await extractTextFromPDF(pdfBuffer);
    console.log('[SwedBankPDF] Extracted', text.length, 'chars,', tables.length, 'table rows');
    
    if (text.length < 100) {
      errors.push('Warning: Very little text extracted from PDF');
    }
    
    // 3. Strukturera data med LLM
    console.log('[SwedBankPDF] Structuring data with Bedrock...');
    const structuredData = await structureDataWithLLM(text, tables);
    
    // 4. Bygg komplett rapport
    const report: SwedBankCustodyReport = {
      reportDate: structuredData.reportDate || new Date().toISOString().split('T')[0],
      accountNumber: structuredData.accountNumber || 'UNKNOWN',
      fundName: structuredData.fundName || 'Unknown',
      currency: structuredData.currency || 'SEK',
      positions: structuredData.positions || [],
      cashBalance: structuredData.cashBalance || 0,
      totalMarketValue: structuredData.totalMarketValue || 0,
      transactions: structuredData.transactions,
      extractedAt: new Date().toISOString(),
      confidence,
      rawText: text,
    };
    
    // 5. Generera Excel
    console.log('[SwedBankPDF] Generating Excel report...');
    const excelBuffer = await generateSwedBankExcel(report);
    
    const processingTimeMs = Date.now() - startTime;
    console.log('[SwedBankPDF] Processing complete in', processingTimeMs, 'ms');
    
    return {
      success: true,
      report,
      excelBuffer,
      errors: errors.length > 0 ? errors : undefined,
      processingTimeMs,
    };
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    console.error('[SwedBankPDF] Processing failed:', error);
    
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      processingTimeMs,
    };
  }
}

// ============================================================================
// S3 Integration for processed files
// ============================================================================

/**
 * Sparar processad rapport till S3
 */
export async function saveProcessedReport(
  report: SwedBankCustodyReport,
  excelBuffer: ArrayBuffer,
  bucket: string
): Promise<{ jsonKey: string; excelKey: string }> {
  const s3 = getS3Client();
  const datePrefix = report.reportDate.replace(/-/g, '/');
  const timestamp = Date.now();
  
  // Spara JSON
  const jsonKey = `swedbank/processed/${datePrefix}/${timestamp}-report.json`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: jsonKey,
    Body: JSON.stringify(report, null, 2),
    ContentType: 'application/json',
  }));
  
  // Spara Excel
  const excelKey = `swedbank/processed/${datePrefix}/${timestamp}-report.xlsx`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: excelKey,
    Body: Buffer.from(excelBuffer),
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  
  return { jsonKey, excelKey };
}

// Types already exported above via interface declarations
