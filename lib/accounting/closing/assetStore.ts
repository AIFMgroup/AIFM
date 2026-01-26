/**
 * Asset Store (DynamoDB) - Anläggningsregister
 *
 * Lagrar anläggningstillgångar per företag för avskrivningsmotorn.
 * Vi använder single-table i `aifm-accounting-jobs` för att undvika ny infra.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { Asset } from './depreciationEngine';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface StoredAsset extends Omit<Asset, 'currentBookValue' | 'accumulatedDepreciation' | 'monthlyDepreciation'> {
  companyId: string;
  status: 'active' | 'disposed';
  disposedDate?: string;
  createdAt: string;
  updatedAt: string;
}

function pk(companyId: string) {
  return `ASSET#${companyId}`;
}

function sk(assetId: string) {
  return `ASSET#${assetId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function ttl7y() {
  return Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60);
}

export async function listAssets(companyId: string, limit: number = 500): Promise<StoredAsset[]> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: { ':pk': pk(companyId), ':prefix': 'ASSET#' },
    Limit: limit,
  }));
  return (res.Items || []) as StoredAsset[];
}

export async function getAsset(companyId: string, assetId: string): Promise<StoredAsset | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(assetId) },
  }));
  return (res.Item as StoredAsset) || null;
}

export async function createAsset(companyId: string, asset: Omit<StoredAsset, 'companyId' | 'status' | 'createdAt' | 'updatedAt'>): Promise<StoredAsset> {
  const now = nowIso();
  const stored: StoredAsset = {
    ...asset,
    companyId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { pk: pk(companyId), sk: sk(stored.id), ...stored, ttl: ttl7y() },
    ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
  }));

  return stored;
}

export async function updateAsset(companyId: string, assetId: string, updates: Partial<StoredAsset>): Promise<void> {
  const now = nowIso();
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(assetId) },
    UpdateExpression: 'SET updatedAt = :now' +
      (updates.name ? ', #name = :name' : '') +
      (updates.account ? ', account = :account' : '') +
      (updates.acquisitionDate ? ', acquisitionDate = :acqDate' : '') +
      (typeof updates.acquisitionValue === 'number' ? ', acquisitionValue = :acqValue' : '') +
      (updates.usefulLifeMonths ? ', usefulLifeMonths = :life' : '') +
      (updates.depreciationMethod ? ', depreciationMethod = :method' : '') +
      (updates.status ? ', #status = :status' : '') +
      (updates.disposedDate ? ', disposedDate = :disposedDate' : ''),
    ExpressionAttributeNames: {
      ...(updates.name ? { '#name': 'name' } : {}),
      ...(updates.status ? { '#status': 'status' } : {}),
    },
    ExpressionAttributeValues: {
      ':now': now,
      ...(updates.name ? { ':name': updates.name } : {}),
      ...(updates.account ? { ':account': updates.account } : {}),
      ...(updates.acquisitionDate ? { ':acqDate': updates.acquisitionDate } : {}),
      ...(typeof updates.acquisitionValue === 'number' ? { ':acqValue': updates.acquisitionValue } : {}),
      ...(updates.usefulLifeMonths ? { ':life': updates.usefulLifeMonths } : {}),
      ...(updates.depreciationMethod ? { ':method': updates.depreciationMethod } : {}),
      ...(updates.status ? { ':status': updates.status } : {}),
      ...(updates.disposedDate ? { ':disposedDate': updates.disposedDate } : {}),
    },
  }));
}

export async function disposeAsset(companyId: string, assetId: string, disposedDate: string): Promise<void> {
  await updateAsset(companyId, assetId, { status: 'disposed', disposedDate });
}

export async function deleteAsset(companyId: string, assetId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(assetId) },
  }));
}



