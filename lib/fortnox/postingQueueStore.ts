/**
 * Fortnox Posting Queue Store (DynamoDB)
 *
 * Provides:
 * - Idempotency per (companyId, jobId) with requestHash
 * - Retry/backoff (nextRetryAt, attempts)
 * - Dead-letter (status=dead_letter after max attempts)
 *
 * Stored in `aifm-accounting-jobs` to avoid extra infra.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type FortnoxPostingStatus = 'pending' | 'running' | 'completed' | 'error' | 'dead_letter';

export interface FortnoxPostingRecord {
  companyId: string;
  jobId: string;
  status: FortnoxPostingStatus;
  requestHash?: string;
  resultId?: string;
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  createdAt: string;
  updatedAt: string;
  ttl: number;
}

function pk(companyId: string) {
  return `FORTNOX_POST#${companyId}`;
}
function sk(jobId: string) {
  return `JOB#${jobId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function ttl7y() {
  return Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60);
}

function computeNextRetry(attempts: number): string {
  // Exponential backoff with cap
  const baseMs = 10_000; // 10s
  const maxMs = 30 * 60_000; // 30 min
  const delay = Math.min(baseMs * Math.pow(2, Math.max(0, attempts - 1)), maxMs);
  return new Date(Date.now() + delay).toISOString();
}

export async function getPostingRecord(companyId: string, jobId: string): Promise<FortnoxPostingRecord | null> {
  try {
    const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { pk: pk(companyId), sk: sk(jobId) } }));
    return (res.Item as FortnoxPostingRecord) || null;
  } catch (e) {
    console.error('[FortnoxPostingQueue] get error:', e);
    return null;
  }
}

/**
 * Ensure a record exists (pending) for a job.
 */
export async function enqueuePosting(companyId: string, jobId: string, requestHash?: string): Promise<FortnoxPostingRecord> {
  const existing = await getPostingRecord(companyId, jobId);
  if (existing) return existing;

  const createdAt = nowIso();
  const record: FortnoxPostingRecord = {
    companyId,
    jobId,
    status: 'pending',
    requestHash,
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
    ttl: ttl7y(),
  };

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { pk: pk(companyId), sk: sk(jobId), ...record },
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }));
    return record;
  } catch (e) {
    // If race, return latest
    const latest = await getPostingRecord(companyId, jobId);
    if (latest) return latest;
    throw e;
  }
}

/**
 * Claim a posting record for processing if allowed.
 */
export async function claimPosting(
  companyId: string,
  jobId: string,
  requestHash: string,
  options?: { maxAttempts?: number }
): Promise<
  | { state: 'already_completed'; resultId: string }
  | { state: 'blocked_running' }
  | { state: 'blocked_conflict' }
  | { state: 'wait_retry'; nextRetryAt: string }
  | { state: 'dead_letter'; lastError?: string }
  | { state: 'claimed' }
> {
  const maxAttempts = options?.maxAttempts ?? 6;
  const record = await enqueuePosting(companyId, jobId, requestHash);

  // Completed: return idempotent result if hash matches
  if (record.status === 'completed' && record.resultId) {
    if (record.requestHash && record.requestHash === requestHash) {
      return { state: 'already_completed', resultId: record.resultId };
    }
    return { state: 'blocked_conflict' };
  }

  if (record.status === 'dead_letter') return { state: 'dead_letter', lastError: record.lastError };
  if (record.status === 'running') return { state: 'blocked_running' };

  // Error with backoff
  if (record.status === 'error' && record.nextRetryAt) {
    if (new Date(record.nextRetryAt).getTime() > Date.now()) {
      return { state: 'wait_retry', nextRetryAt: record.nextRetryAt };
    }
  }

  const nextAttempts = (record.attempts || 0) + 1;
  if (nextAttempts > maxAttempts) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(jobId) },
      UpdateExpression: 'SET #status = :dead, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':dead': 'dead_letter', ':now': nowIso() },
    }));
    return { state: 'dead_letter', lastError: record.lastError };
  }

  // Try claim (optimistic; safe enough with status condition)
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(jobId) },
      ConditionExpression: '#status <> :running',
      UpdateExpression: 'SET #status = :running, requestHash = :hash, attempts = :attempts, lastError = :null, nextRetryAt = :null, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':running': 'running',
        ':hash': requestHash,
        ':attempts': nextAttempts,
        ':null': null,
        ':now': nowIso(),
      },
    }));
    return { state: 'claimed' };
  } catch (e) {
    // If someone else claimed, treat as running
    return { state: 'blocked_running' };
  }
}

export async function completePosting(companyId: string, jobId: string, resultId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(jobId) },
    UpdateExpression: 'SET #status = :done, resultId = :rid, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':done': 'completed', ':rid': resultId, ':now': nowIso() },
  }));
}

export async function failPosting(companyId: string, jobId: string, errorMessage: string): Promise<void> {
  const record = await getPostingRecord(companyId, jobId);
  const attempts = (record?.attempts || 0);
  const nextRetryAt = computeNextRetry(attempts);

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(jobId) },
    UpdateExpression: 'SET #status = :err, lastError = :msg, nextRetryAt = :next, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':err': 'error', ':msg': errorMessage, ':next': nextRetryAt, ':now': nowIso() },
  }));
}

export async function deadLetterPosting(companyId: string, jobId: string, errorMessage: string): Promise<void> {
  await enqueuePosting(companyId, jobId);
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(jobId) },
    UpdateExpression: 'SET #status = :dead, lastError = :msg, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':dead': 'dead_letter', ':msg': errorMessage, ':now': nowIso() },
  }));
}

export async function listPostingRecords(companyId: string, limit: number = 200): Promise<FortnoxPostingRecord[]> {
  try {
    const res = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk(companyId) },
      Limit: limit,
    }));
    return (res.Items || []) as FortnoxPostingRecord[];
  } catch (e) {
    console.error('[FortnoxPostingQueue] list error:', e);
    return [];
  }
}

/**
 * Retry a failed/dead_letter posting by resetting it to pending.
 */
export async function retryPosting(companyId: string, jobId: string): Promise<FortnoxPostingRecord | null> {
  const existing = await getPostingRecord(companyId, jobId);
  if (!existing) return null;

  // Only allow retry from error or dead_letter states
  if (existing.status !== 'error' && existing.status !== 'dead_letter') {
    return existing;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: pk(companyId), sk: sk(jobId) },
    UpdateExpression: 'SET #status = :pending, attempts = :zero, lastError = :null, nextRetryAt = :null, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':pending': 'pending',
      ':zero': 0,
      ':null': null,
      ':now': nowIso(),
    },
  }));

  return { ...existing, status: 'pending', attempts: 0, lastError: undefined, nextRetryAt: undefined, updatedAt: nowIso() };
}

/**
 * Get posting records that are ready for processing (pending or error past retry time).
 */
export async function getPendingPostingRecords(companyId: string, limit: number = 50): Promise<FortnoxPostingRecord[]> {
  const all = await listPostingRecords(companyId, 500);
  const now = Date.now();

  return all.filter(r => {
    if (r.status === 'pending') return true;
    if (r.status === 'error') {
      if (!r.nextRetryAt) return true;
      return new Date(r.nextRetryAt).getTime() <= now;
    }
    return false;
  }).slice(0, limit);
}


