import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AIFM_ACCOUNTING_TABLE || 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface PaymentRecipient {
  companyId: string;
  supplierName: string;
  supplierKey: string;
  iban?: string;
  bic?: string;
  bankgiro?: string;
  plusgiro?: string;
  referenceHint?: string;
  updatedAt: string;
}

function normalizeSupplierKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'unknown';
}

function pk(companyId: string) {
  return `COMPANY#${companyId}#PAYRECIPIENT`;
}

function sk(supplierKey: string) {
  return `SUPPLIER#${supplierKey}`;
}

export const paymentRecipientStore = {
  normalizeSupplierKey,

  async list(companyId: string): Promise<PaymentRecipient[]> {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk(companyId) },
      ScanIndexForward: true,
    }));

    return (res.Items || []) as PaymentRecipient[];
  },

  async get(companyId: string, supplierKey: string): Promise<PaymentRecipient | null> {
    const res = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(supplierKey) },
    }));
    return (res.Item as PaymentRecipient) || null;
  },

  async upsert(companyId: string, input: Omit<PaymentRecipient, 'companyId' | 'supplierKey' | 'updatedAt'> & { supplierKey?: string }): Promise<PaymentRecipient> {
    const now = new Date().toISOString();
    const supplierKey = input.supplierKey || normalizeSupplierKey(input.supplierName);

    const item: PaymentRecipient = {
      companyId,
      supplierName: input.supplierName,
      supplierKey,
      iban: input.iban,
      bic: input.bic,
      bankgiro: input.bankgiro,
      plusgiro: input.plusgiro,
      referenceHint: input.referenceHint,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk: pk(companyId), sk: sk(supplierKey), entityType: 'PAYMENT_RECIPIENT', ...item },
    }));

    return item;
  },

  async remove(companyId: string, supplierKey: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(supplierKey) },
    }));
  },
};



