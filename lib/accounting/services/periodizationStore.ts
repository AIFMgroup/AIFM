/**
 * Periodization Store (DynamoDB)
 * 
 * Lagrar periodiseringsscheman per företag.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { PeriodizationSchedule, PeriodizationEntry } from './periodizationService';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface StoredPeriodization extends PeriodizationSchedule {
  companyId: string;
  jobId?: string;
  supplierName?: string;
  description?: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

function pk(companyId: string) {
  return `PERIODIZATION#${companyId}`;
}

function sk(id: string) {
  return `SCHEDULE#${id}`;
}

function nowIso() {
  return new Date().toISOString();
}

function ttl7y() {
  return Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60);
}

/**
 * Spara ett nytt periodiseringsschema
 */
export async function savePeriodization(
  companyId: string,
  schedule: PeriodizationSchedule,
  options?: { jobId?: string; supplierName?: string; description?: string }
): Promise<StoredPeriodization> {
  const now = nowIso();
  const stored: StoredPeriodization = {
    ...schedule,
    companyId,
    jobId: options?.jobId,
    supplierName: options?.supplierName,
    description: options?.description,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: pk(companyId),
      sk: sk(schedule.id),
      ...stored,
      ttl: ttl7y(),
    },
  }));

  return stored;
}

/**
 * Hämta ett periodiseringsschema
 */
export async function getPeriodization(companyId: string, id: string): Promise<StoredPeriodization | null> {
  const res = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(id) },
  }));

  return (res.Item as StoredPeriodization) || null;
}

/**
 * Lista alla periodiseringsscheman för ett företag
 */
export async function listPeriodizations(
  companyId: string,
  options?: { status?: 'active' | 'completed' | 'cancelled'; limit?: number }
): Promise<StoredPeriodization[]> {
  const res = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': pk(companyId),
      ':prefix': 'SCHEDULE#',
    },
    Limit: options?.limit || 500,
  }));

  let items = (res.Items || []) as StoredPeriodization[];
  
  if (options?.status) {
    items = items.filter(i => i.status === options.status);
  }

  return items;
}

/**
 * Hämta periodiseringar som ska bokföras för en specifik period
 */
export async function getPeriodizationsForPeriod(
  companyId: string,
  period: string // YYYY-MM
): Promise<Array<{ schedule: StoredPeriodization; entry: PeriodizationEntry }>> {
  const schedules = await listPeriodizations(companyId, { status: 'active' });
  const results: Array<{ schedule: StoredPeriodization; entry: PeriodizationEntry }> = [];

  for (const schedule of schedules) {
    const entry = schedule.entries.find(e => e.period === period && !e.isProcessed);
    if (entry) {
      results.push({ schedule, entry });
    }
  }

  return results;
}

/**
 * Markera en periodiseringspost som bokförd
 */
export async function markEntryProcessed(
  companyId: string,
  scheduleId: string,
  period: string
): Promise<void> {
  const schedule = await getPeriodization(companyId, scheduleId);
  if (!schedule) return;

  const updatedEntries = schedule.entries.map(e => 
    e.period === period ? { ...e, isProcessed: true } : e
  );

  // Kontrollera om alla entries är processade
  const allProcessed = updatedEntries.every(e => e.isProcessed);
  const newStatus = allProcessed ? 'completed' : 'active';

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(scheduleId) },
    UpdateExpression: 'SET entries = :entries, #status = :status, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':entries': updatedEntries,
      ':status': newStatus,
      ':now': nowIso(),
    },
  }));
}

/**
 * Avbryt ett periodiseringsschema
 */
export async function cancelPeriodization(companyId: string, id: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(id) },
    UpdateExpression: 'SET #status = :cancelled, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':cancelled': 'cancelled',
      ':now': nowIso(),
    },
  }));
}

/**
 * Ta bort ett periodiseringsschema
 */
export async function deletePeriodization(companyId: string, id: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(id) },
  }));
}

/**
 * Summera kvarvarande periodiseringssaldo för alla aktiva scheman
 */
export async function getTotalPeriodizationBalance(companyId: string): Promise<{
  prepaidExpenses: number;
  accruedExpenses: number;
  prepaidIncome: number;
  accruedIncome: number;
}> {
  const schedules = await listPeriodizations(companyId, { status: 'active' });
  
  const result = {
    prepaidExpenses: 0,
    accruedExpenses: 0,
    prepaidIncome: 0,
    accruedIncome: 0,
  };

  for (const schedule of schedules) {
    const remaining = schedule.entries
      .filter(e => !e.isProcessed)
      .reduce((sum, e) => sum + e.debitAmount, 0);

    // Bestäm typ baserat på konto
    const account = parseInt(schedule.periodizationAccount);
    if (account >= 1700 && account < 1800) {
      result.prepaidExpenses += remaining;
    } else if (account >= 2900 && account < 3000) {
      result.accruedExpenses += remaining;
    }
  }

  return result;
}


