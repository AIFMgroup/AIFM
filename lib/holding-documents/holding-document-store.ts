/**
 * Holding Document Store
 *
 * DynamoDB-backed storage for scraped IR documents per holding (instrument).
 * Table: aifm-holding-documents
 *   PK: instrumentId (String)
 *   SK: documentId (String)
 *   GSI: fundId-index (fundId HASH, documentId RANGE)
 */

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  DeleteItemCommand,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';

const region = process.env.AWS_REGION || 'eu-north-1';
const TABLE =
  process.env.HOLDING_DOCUMENTS_TABLE || 'aifm-holding-documents';

const ddb = new DynamoDBClient({ region });

function isResourceNotFound(err: unknown): boolean {
  return (err as { name?: string })?.name === 'ResourceNotFoundException';
}

export type HoldingDocumentCategory =
  | 'annual_report'
  | 'quarterly_report'
  | 'sustainability_report'
  | 'investor_presentation'
  | 'governance'
  | 'other';

export interface HoldingDocument {
  instrumentId: string;
  documentId: string;
  instrumentName: string;
  fundId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  category: HoldingDocumentCategory;
  sourceUrl: string;
  scrapedAt: string;
  textContent?: string;
}

function marshalItem(doc: HoldingDocument): Record<string, { S: string } | { N: string }> {
  const item: Record<string, { S: string } | { N: string }> = {
    instrumentId: { S: doc.instrumentId },
    documentId: { S: doc.documentId },
    instrumentName: { S: doc.instrumentName },
    fundId: { S: doc.fundId },
    fileName: { S: doc.fileName },
    fileType: { S: doc.fileType },
    fileSize: { N: String(doc.fileSize) },
    s3Key: { S: doc.s3Key },
    category: { S: doc.category },
    sourceUrl: { S: doc.sourceUrl },
    scrapedAt: { S: doc.scrapedAt },
  };
  if (doc.textContent) item.textContent = { S: doc.textContent };
  return item;
}

function unmarshalItem(i: Record<string, { S?: string; N?: string }>): HoldingDocument {
  return {
    instrumentId: i.instrumentId?.S ?? '',
    documentId: i.documentId?.S ?? '',
    instrumentName: i.instrumentName?.S ?? '',
    fundId: i.fundId?.S ?? '',
    fileName: i.fileName?.S ?? '',
    fileType: i.fileType?.S ?? '',
    fileSize: Number(i.fileSize?.N ?? '0'),
    s3Key: i.s3Key?.S ?? '',
    category: (i.category?.S ?? 'other') as HoldingDocumentCategory,
    sourceUrl: i.sourceUrl?.S ?? '',
    scrapedAt: i.scrapedAt?.S ?? '',
    textContent: i.textContent?.S,
  };
}

export async function saveHoldingDocument(doc: HoldingDocument): Promise<void> {
  try {
    await ddb.send(new PutItemCommand({ TableName: TABLE, Item: marshalItem(doc) }));
  } catch (err) {
    if (isResourceNotFound(err)) {
      console.warn(`[HoldingDocumentStore] Table ${TABLE} not found; skipping DynamoDB save. Deploy the table (e.g. aifm-holding-documents) to persist metadata.`);
      return;
    }
    throw err;
  }
}

export async function getHoldingDocuments(
  instrumentId: string,
): Promise<HoldingDocument[]> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'instrumentId = :iid',
        ExpressionAttributeValues: { ':iid': { S: instrumentId } },
      }),
    );
    return (result.Items ?? []).map((i) => unmarshalItem(i as Record<string, { S?: string; N?: string }>));
  } catch (err) {
    if (isResourceNotFound(err)) return [];
    throw err;
  }
}

export async function getHoldingDocument(
  instrumentId: string,
  documentId: string,
): Promise<HoldingDocument | null> {
  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          instrumentId: { S: instrumentId },
          documentId: { S: documentId },
        },
      }),
    );
    if (!result.Item) return null;
    return unmarshalItem(result.Item as Record<string, { S?: string; N?: string }>);
  } catch (err) {
    if (isResourceNotFound(err)) return null;
    throw err;
  }
}

/**
 * List all holding documents for a fund using the fundId-index GSI.
 */
export async function getDocumentsByFund(
  fundId: string,
): Promise<HoldingDocument[]> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'fundId-index',
        KeyConditionExpression: 'fundId = :fid',
        ExpressionAttributeValues: { ':fid': { S: fundId } },
      }),
    );
    return (result.Items ?? []).map((i) => unmarshalItem(i as Record<string, { S?: string; N?: string }>));
  } catch (err) {
    if (isResourceNotFound(err)) return [];
    throw err;
  }
}

/**
 * Check if a document already exists for this instrument (duplicate by fileName).
 * Returns empty set if the table does not exist (e.g. not yet deployed).
 */
export async function getExistingFileNames(
  instrumentId: string,
): Promise<Set<string>> {
  const docs = await getHoldingDocuments(instrumentId);
  return new Set(docs.map((d) => d.fileName.toLowerCase()));
}

export async function deleteHoldingDocument(
  instrumentId: string,
  documentId: string,
): Promise<void> {
  try {
    await ddb.send(
      new DeleteItemCommand({
        TableName: TABLE,
        Key: {
          instrumentId: { S: instrumentId },
          documentId: { S: documentId },
        },
      }),
    );
  } catch (err) {
    if (isResourceNotFound(err)) return;
    throw err;
  }
}

export function holdingCategoryLabel(cat: HoldingDocumentCategory): string {
  const labels: Record<HoldingDocumentCategory, string> = {
    annual_report: 'Årsrapport',
    quarterly_report: 'Kvartalsrapport',
    sustainability_report: 'Hållbarhetsrapport',
    investor_presentation: 'Investor presentation',
    governance: 'Bolagsstyrning',
    other: 'Övrigt',
  };
  return labels[cat] || cat;
}

export function generateDocumentId(): string {
  return randomUUID();
}
