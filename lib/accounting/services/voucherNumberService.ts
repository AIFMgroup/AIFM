/**
 * Voucher Number Service
 * 
 * Genererar unika, sekventiella verifikationsnummer enligt svenska bokföringsregler.
 * 
 * Format: [Serie][År][Löpnummer]
 * Exempel: A2024-0001, K2024-0042, L2024-0003
 * 
 * Serier:
 * - A: Leverantörsfakturor (Accounts payable)
 * - K: Kvitton/Utlägg (Kassaverifikationer)
 * - L: Löner
 * - B: Bankverifikationer
 * - M: Manuella verifikationer
 * - S: Försäljning (Sales)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  GetCommand, 
  PutCommand, 
  UpdateCommand,
  QueryCommand 
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AIFM_VOUCHER_NUMBERS_TABLE || 'aifm-voucher-numbers';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export type VoucherSeries = 'A' | 'K' | 'L' | 'B' | 'M' | 'S';

export interface VoucherNumber {
  number: string;          // Full number: "A2024-0001"
  series: VoucherSeries;
  year: number;
  sequence: number;
  companyId: string;
  createdAt: string;
  jobId?: string;          // Reference to accounting job
  description?: string;
}

export interface VoucherNumberConfig {
  series: VoucherSeries;
  prefix?: string;         // Optional custom prefix
  startNumber?: number;    // Starting sequence (default: 1)
  padding?: number;        // Number padding (default: 4 = 0001)
  separator?: string;      // Separator between year and sequence (default: "-")
}

// ============ Series Configuration ============

const SERIES_CONFIG: Record<VoucherSeries, { name: string; description: string }> = {
  'A': { name: 'Leverantörsfakturor', description: 'Inkommande fakturor från leverantörer' },
  'K': { name: 'Kvitton/Utlägg', description: 'Kassaverifikationer och utlägg' },
  'L': { name: 'Löner', description: 'Löneverifikationer' },
  'B': { name: 'Bank', description: 'Bankverifikationer, betalningar' },
  'M': { name: 'Manuella', description: 'Manuellt skapade verifikationer' },
  'S': { name: 'Försäljning', description: 'Utgående fakturor och försäljning' },
};

// Map document types to series
export const DOCUMENT_TYPE_TO_SERIES: Record<string, VoucherSeries> = {
  'INVOICE': 'A',
  'RECEIPT': 'K',
  'SALARY': 'L',
  'BANK_STATEMENT': 'B',
  'BANK_PAYMENT': 'B',
  'CREDIT_NOTE': 'A',
  'MANUAL': 'M',
  'SALES_INVOICE': 'S',
};

// ============ Main Functions ============

/**
 * Generera nästa verifikationsnummer för en serie
 */
export async function getNextVoucherNumber(
  companyId: string,
  series: VoucherSeries,
  options?: {
    year?: number;
    jobId?: string;
    description?: string;
  }
): Promise<VoucherNumber> {
  const year = options?.year ?? new Date().getFullYear();
  const padding = 4;
  const separator = '-';
  
  // Atomic increment using DynamoDB conditional update
  const counterKey = `${companyId}#${series}#${year}`;
  
  try {
    // Try to increment existing counter
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: 'COUNTER', sk: counterKey },
      UpdateExpression: 'SET #seq = #seq + :inc, updatedAt = :now',
      ExpressionAttributeNames: { '#seq': 'sequence' },
      ExpressionAttributeValues: { 
        ':inc': 1,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'UPDATED_NEW',
      ConditionExpression: 'attribute_exists(pk)',
    }));
    
    const sequence = updateResult.Attributes?.sequence as number;
    const voucherNumber = formatVoucherNumber(series, year, sequence, separator, padding);
    
    // Save the voucher number record
    await saveVoucherNumber(companyId, {
      number: voucherNumber,
      series,
      year,
      sequence,
      companyId,
      createdAt: new Date().toISOString(),
      jobId: options?.jobId,
      description: options?.description,
    });
    
    return {
      number: voucherNumber,
      series,
      year,
      sequence,
      companyId,
      createdAt: new Date().toISOString(),
      jobId: options?.jobId,
      description: options?.description,
    };
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Counter doesn't exist - create it
      await initializeCounter(companyId, series, year);
      // Retry
      return getNextVoucherNumber(companyId, series, options);
    }
    throw error;
  }
}

/**
 * Generera verifikationsnummer baserat på dokumenttyp
 */
export async function getVoucherNumberForDocument(
  companyId: string,
  documentType: string,
  options?: {
    year?: number;
    jobId?: string;
    description?: string;
  }
): Promise<VoucherNumber> {
  const series = DOCUMENT_TYPE_TO_SERIES[documentType] || 'M';
  return getNextVoucherNumber(companyId, series, options);
}

/**
 * Reservera ett intervall av nummer (för batch-operationer)
 */
export async function reserveVoucherNumbers(
  companyId: string,
  series: VoucherSeries,
  count: number,
  options?: { year?: number }
): Promise<VoucherNumber[]> {
  const year = options?.year ?? new Date().getFullYear();
  const padding = 4;
  const separator = '-';
  const counterKey = `${companyId}#${series}#${year}`;
  
  // Atomic increment by count
  const updateResult = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: 'COUNTER', sk: counterKey },
    UpdateExpression: 'SET #seq = if_not_exists(#seq, :start) + :count, updatedAt = :now',
    ExpressionAttributeNames: { '#seq': 'sequence' },
    ExpressionAttributeValues: { 
      ':count': count,
      ':start': 0,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'UPDATED_NEW',
  }));
  
  const endSequence = updateResult.Attributes?.sequence as number;
  const startSequence = endSequence - count + 1;
  
  const numbers: VoucherNumber[] = [];
  const now = new Date().toISOString();
  
  for (let seq = startSequence; seq <= endSequence; seq++) {
    const voucherNumber: VoucherNumber = {
      number: formatVoucherNumber(series, year, seq, separator, padding),
      series,
      year,
      sequence: seq,
      companyId,
      createdAt: now,
    };
    numbers.push(voucherNumber);
    
    // Save each number
    await saveVoucherNumber(companyId, voucherNumber);
  }
  
  return numbers;
}

/**
 * Hämta senaste verifikationsnummer för en serie
 */
export async function getLastVoucherNumber(
  companyId: string,
  series: VoucherSeries,
  year?: number
): Promise<VoucherNumber | null> {
  const targetYear = year ?? new Date().getFullYear();
  
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `COMPANY#${companyId}`,
      ':prefix': `VOUCHER#${series}${targetYear}`,
    },
    ScanIndexForward: false, // Descending order
    Limit: 1,
  }));
  
  if (result.Items && result.Items.length > 0) {
    return result.Items[0] as VoucherNumber;
  }
  
  return null;
}

/**
 * Kontrollera om ett verifikationsnummer redan används
 */
export async function isVoucherNumberUsed(
  companyId: string,
  voucherNumber: string
): Promise<boolean> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      pk: `COMPANY#${companyId}`,
      sk: `NUMBER#${voucherNumber}`,
    },
  }));
  
  return !!result.Item;
}

/**
 * Hämta alla verifikationsnummer för en period
 */
export async function getVoucherNumbersForPeriod(
  companyId: string,
  year: number,
  month?: number
): Promise<VoucherNumber[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `COMPANY#${companyId}`,
      ':prefix': `VOUCHER#`,
    },
  }));
  
  let numbers = (result.Items || []) as VoucherNumber[];
  
  // Filter by year
  numbers = numbers.filter(n => n.year === year);
  
  // Filter by month if specified
  if (month !== undefined) {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    numbers = numbers.filter(n => n.createdAt.startsWith(monthStr));
  }
  
  return numbers.sort((a, b) => a.sequence - b.sequence);
}

/**
 * Validera verifikationsnummersekvens (inga luckor)
 */
export async function validateVoucherSequence(
  companyId: string,
  series: VoucherSeries,
  year: number
): Promise<{
  isValid: boolean;
  gaps: number[];
  duplicates: number[];
  lastNumber: number;
}> {
  const numbers = await getVoucherNumbersForPeriod(companyId, year);
  const seriesNumbers = numbers.filter(n => n.series === series);
  
  const sequences = seriesNumbers.map(n => n.sequence).sort((a, b) => a - b);
  const gaps: number[] = [];
  const duplicates: number[] = [];
  
  for (let i = 0; i < sequences.length; i++) {
    const expected = i + 1;
    const actual = sequences[i];
    
    if (actual !== expected) {
      // Find gaps
      for (let j = expected; j < actual; j++) {
        gaps.push(j);
      }
    }
    
    // Check for duplicates
    if (i > 0 && sequences[i] === sequences[i - 1]) {
      duplicates.push(sequences[i]);
    }
  }
  
  return {
    isValid: gaps.length === 0 && duplicates.length === 0,
    gaps,
    duplicates,
    lastNumber: sequences[sequences.length - 1] || 0,
  };
}

// ============ Helper Functions ============

function formatVoucherNumber(
  series: VoucherSeries,
  year: number,
  sequence: number,
  separator: string,
  padding: number
): string {
  const paddedSequence = String(sequence).padStart(padding, '0');
  return `${series}${year}${separator}${paddedSequence}`;
}

async function initializeCounter(
  companyId: string,
  series: VoucherSeries,
  year: number
): Promise<void> {
  const counterKey = `${companyId}#${series}#${year}`;
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: 'COUNTER',
        sk: counterKey,
        companyId,
        series,
        year,
        sequence: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));
  } catch (error: any) {
    // Ignore if already exists (race condition)
    if (error.name !== 'ConditionalCheckFailedException') {
      throw error;
    }
  }
}

async function saveVoucherNumber(
  companyId: string,
  voucher: VoucherNumber
): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `VOUCHER#${voucher.number}`,
      ...voucher,
      // GSI for querying by series
      gsi1pk: `COMPANY#${companyId}#SERIES#${voucher.series}`,
      gsi1sk: `${voucher.year}#${String(voucher.sequence).padStart(6, '0')}`,
      // GSI for querying by job
      ...(voucher.jobId && {
        gsi2pk: `JOB#${voucher.jobId}`,
        gsi2sk: voucher.number,
      }),
    },
  }));
  
  // Also save by number for quick lookup
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `NUMBER#${voucher.number}`,
      voucherNumber: voucher.number,
      series: voucher.series,
      sequence: voucher.sequence,
      year: voucher.year,
      createdAt: voucher.createdAt,
    },
  }));
}

// ============ Utility Functions ============

/**
 * Parsa ett verifikationsnummer till komponenter
 */
export function parseVoucherNumber(voucherNumber: string): {
  series: VoucherSeries;
  year: number;
  sequence: number;
} | null {
  const match = voucherNumber.match(/^([AKLBMS])(\d{4})-(\d+)$/);
  if (!match) return null;
  
  return {
    series: match[1] as VoucherSeries,
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}

/**
 * Hämta serienamn
 */
export function getSeriesName(series: VoucherSeries): string {
  return SERIES_CONFIG[series]?.name || series;
}

/**
 * Hämta seriebeskrivning
 */
export function getSeriesDescription(series: VoucherSeries): string {
  return SERIES_CONFIG[series]?.description || '';
}

/**
 * Lista alla serier
 */
export function getAllSeries(): { series: VoucherSeries; name: string; description: string }[] {
  return Object.entries(SERIES_CONFIG).map(([series, config]) => ({
    series: series as VoucherSeries,
    ...config,
  }));
}

/**
 * Formatera verifikationsnummer för visning
 */
export function formatVoucherNumberDisplay(voucherNumber: string): string {
  const parsed = parseVoucherNumber(voucherNumber);
  if (!parsed) return voucherNumber;
  
  const seriesName = getSeriesName(parsed.series);
  return `${voucherNumber} (${seriesName})`;
}












