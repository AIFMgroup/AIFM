import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AIFM_ACCOUNTING_TABLE || 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type SkatteverketSubmissionStatus = 'queued' | 'submitted' | 'failed' | 'cancelled';
export type SkatteverketSubmissionType = 'VAT';

export interface SkatteverketSubmission {
  companyId: string;
  id: string;
  type: SkatteverketSubmissionType;
  periodKey: string; // e.g. "2025-12" or "2025-Q4"
  createdAtIso: string;
  updatedAtIso: string;
  status: SkatteverketSubmissionStatus;
  payloadXml: string;
  payloadHash: string;
  externalReference?: string;
  error?: string;
}

function pk(companyId: string) {
  return `COMPANY#${companyId}#SKV_SUBMISSION`;
}

function sk(type: SkatteverketSubmissionType, periodKey: string, id: string) {
  return `${type}#${periodKey}#${id}`;
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export const skatteverketSubmissionStore = {
  async list(companyId: string): Promise<SkatteverketSubmission[]> {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk(companyId) },
      ScanIndexForward: false,
    }));
    return (res.Items || []) as SkatteverketSubmission[];
  },

  async get(companyId: string, type: SkatteverketSubmissionType, periodKey: string, id: string): Promise<SkatteverketSubmission | null> {
    const res = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(type, periodKey, id) },
    }));
    return (res.Item as SkatteverketSubmission) || null;
  },

  async upsertQueued(companyId: string, type: SkatteverketSubmissionType, periodKey: string, payloadXml: string): Promise<SkatteverketSubmission> {
    const now = new Date().toISOString();
    const payloadHash = sha256(payloadXml);
    const id = `skv-${payloadHash.slice(0, 12)}`;

    const item: SkatteverketSubmission = {
      companyId,
      id,
      type,
      periodKey,
      createdAtIso: now,
      updatedAtIso: now,
      status: 'queued',
      payloadXml,
      payloadHash,
    };

    // Idempotent: same period+payloadHash => same id => overwrite OK
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk: pk(companyId), sk: sk(type, periodKey, id), entityType: 'SKV_SUBMISSION', ...item },
    }));

    return item;
  },

  async markSubmitted(companyId: string, type: SkatteverketSubmissionType, periodKey: string, id: string, externalReference?: string): Promise<void> {
    const now = new Date().toISOString();
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(type, periodKey, id) },
      UpdateExpression: 'SET #status = :s, updatedAtIso = :u, externalReference = :r REMOVE #error',
      ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
      ExpressionAttributeValues: { ':s': 'submitted', ':u': now, ':r': externalReference ?? null },
    }));
  },

  async markFailed(companyId: string, type: SkatteverketSubmissionType, periodKey: string, id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(type, periodKey, id) },
      UpdateExpression: 'SET #status = :s, updatedAtIso = :u, #error = :e',
      ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
      ExpressionAttributeValues: { ':s': 'failed', ':u': now, ':e': error },
    }));
  },
};



