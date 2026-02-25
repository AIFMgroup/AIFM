/**
 * Fund Document Store
 *
 * DynamoDB-backed storage for fund-level documents (fund conditions,
 * sustainability reports, placement policies, etc.).
 *
 * Table: aifm-fund-documents
 *   PK: fundId  (String)
 *   SK: documentId (String)
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
const TABLE = process.env.FUND_DOCUMENTS_TABLE || 'aifm-fund-documents';

const ddb = new DynamoDBClient({ region });

export type FundDocumentCategory =
  | 'fondvillkor'
  | 'hallbarhetsrapport'
  | 'placeringspolicy'
  | 'arsredovisning'
  | 'delarsrapport'
  | 'informationsbroschyr'
  | 'faktablad'
  | 'ovrigt';

export interface FundDocument {
  fundId: string;
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  category: FundDocumentCategory;
  uploadedBy: string;
  uploadedAt: string;
  textContent?: string;
  summary?: string;
}

export async function saveFundDocument(doc: FundDocument): Promise<void> {
  const item: Record<string, { S: string } | { N: string }> = {
    fundId: { S: doc.fundId },
    documentId: { S: doc.documentId },
    fileName: { S: doc.fileName },
    fileType: { S: doc.fileType },
    fileSize: { N: String(doc.fileSize) },
    s3Key: { S: doc.s3Key },
    category: { S: doc.category },
    uploadedBy: { S: doc.uploadedBy },
    uploadedAt: { S: doc.uploadedAt },
  };
  if (doc.textContent) item.textContent = { S: doc.textContent };
  if (doc.summary) item.summary = { S: doc.summary };

  await ddb.send(new PutItemCommand({ TableName: TABLE, Item: item }));
}

export async function getFundDocuments(fundId: string): Promise<FundDocument[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'fundId = :fid',
      ExpressionAttributeValues: { ':fid': { S: fundId } },
    }),
  );

  return (result.Items ?? []).map((i) => ({
    fundId: i.fundId?.S ?? '',
    documentId: i.documentId?.S ?? '',
    fileName: i.fileName?.S ?? '',
    fileType: i.fileType?.S ?? '',
    fileSize: Number(i.fileSize?.N ?? '0'),
    s3Key: i.s3Key?.S ?? '',
    category: (i.category?.S ?? 'ovrigt') as FundDocumentCategory,
    uploadedBy: i.uploadedBy?.S ?? '',
    uploadedAt: i.uploadedAt?.S ?? '',
    textContent: i.textContent?.S,
    summary: i.summary?.S,
  }));
}

export async function getFundDocument(
  fundId: string,
  documentId: string,
): Promise<FundDocument | null> {
  const result = await ddb.send(
    new GetItemCommand({
      TableName: TABLE,
      Key: { fundId: { S: fundId }, documentId: { S: documentId } },
    }),
  );
  if (!result.Item) return null;
  const i = result.Item;
  return {
    fundId: i.fundId?.S ?? '',
    documentId: i.documentId?.S ?? '',
    fileName: i.fileName?.S ?? '',
    fileType: i.fileType?.S ?? '',
    fileSize: Number(i.fileSize?.N ?? '0'),
    s3Key: i.s3Key?.S ?? '',
    category: (i.category?.S ?? 'ovrigt') as FundDocumentCategory,
    uploadedBy: i.uploadedBy?.S ?? '',
    uploadedAt: i.uploadedAt?.S ?? '',
    textContent: i.textContent?.S,
    summary: i.summary?.S,
  };
}

export async function deleteFundDocument(
  fundId: string,
  documentId: string,
): Promise<void> {
  await ddb.send(
    new DeleteItemCommand({
      TableName: TABLE,
      Key: { fundId: { S: fundId }, documentId: { S: documentId } },
    }),
  );
}

/**
 * Retrieve combined text content from all documents for a fund.
 * Used by AI review prompts to include real fund conditions.
 */
export async function getFundDocumentText(fundId: string): Promise<string> {
  const docs = await getFundDocuments(fundId);
  const parts: string[] = [];

  for (const doc of docs) {
    if (!doc.textContent) continue;
    parts.push(
      `--- ${doc.fileName} (${categoryLabel(doc.category)}) ---\n${doc.textContent}`,
    );
  }

  return parts.join('\n\n');
}

export function categoryLabel(cat: FundDocumentCategory): string {
  const labels: Record<FundDocumentCategory, string> = {
    fondvillkor: 'Fondvillkor / Prospekt',
    hallbarhetsrapport: 'Hållbarhetsrapport',
    placeringspolicy: 'Placeringspolicy',
    arsredovisning: 'Årsredovisning',
    delarsrapport: 'Delårsrapport',
    informationsbroschyr: 'Informationsbroschyr',
    faktablad: 'Faktablad / PRIIP',
    ovrigt: 'Övrigt',
  };
  return labels[cat] || cat;
}

export function generateDocumentId(): string {
  return randomUUID();
}
