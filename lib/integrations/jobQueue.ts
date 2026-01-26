import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AIFM_ACCOUNTING_TABLE || 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type IntegrationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead_letter';

export type IntegrationJobType =
  | 'TINK_WEBHOOK_EVENT'
  | 'FORTNOX_POST_JOB'
  | 'FORTNOX_SYNC'
  | 'SKATTEVERKET_SUBMIT'
  | 'BANK_SYNC';

export interface IntegrationJob<TPayload = Record<string, unknown>> {
  id: string;
  companyId: string;
  type: IntegrationJobType;
  status: IntegrationJobStatus;
  createdAt: string;
  updatedAt: string;

  // execution
  attempts: number;
  maxAttempts: number;
  nextRunAt: string; // ISO
  lockUntil?: string; // ISO
  claimedBy?: string;

  // idempotency
  idempotencyKey?: string;

  // payload + results
  payload: TPayload;
  lastError?: string;
  result?: Record<string, unknown>;

  // retention
  ttl?: number;
}

function nowIso() {
  return new Date().toISOString();
}

function ttlDays(days: number) {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

function pk(companyId: string) {
  return `INTJOB#${companyId}`;
}

function sk(jobId: string) {
  return `JOB#${jobId}`;
}

function idempPk(companyId: string) {
  return `INTJOB_IDEMP#${companyId}`;
}

function idempSk(key: string) {
  return `KEY#${key}`;
}

function gsi1pk(companyId: string, status: IntegrationJobStatus) {
  return `INTJOB#${companyId}#STATUS#${status}`;
}

function gsi1sk(nextRunAtIso: string, jobId: string) {
  return `${nextRunAtIso}#${jobId}`;
}

function computeBackoffMs(attempts: number) {
  const base = 5_000;
  const max = 10 * 60_000;
  return Math.min(base * Math.pow(2, Math.max(0, attempts - 1)), max);
}

export function stableIdempotencyKeyFromBytes(bytes: Buffer) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function getIntegrationJob(companyId: string, jobId: string): Promise<IntegrationJob | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(jobId) },
    })
  );
  return (res.Item as IntegrationJob) || null;
}

export async function enqueueIntegrationJob(params: {
  companyId: string;
  type: IntegrationJobType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
  runAt?: string; // ISO
  ttlDays?: number;
}): Promise<{ job: IntegrationJob; deduped: boolean }> {
  const companyId = params.companyId;
  const now = nowIso();
  const maxAttempts = Math.min(Math.max(params.maxAttempts ?? 8, 1), 50);
  const runAt = params.runAt || now;
  const ttl = ttlDays(params.ttlDays ?? 90);

  // Idempotency: if key exists, return existing job
  if (params.idempotencyKey) {
    const key = params.idempotencyKey;
    const existing = await docClient
      .send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: idempPk(companyId), sk: idempSk(key) },
        })
      )
      .catch(() => null);

    const existingJobId = (existing as any)?.Item?.jobId as string | undefined;
    if (existingJobId) {
      const job = await getIntegrationJob(companyId, existingJobId);
      if (job) return { job, deduped: true };
    }
  }

  const jobId = `intjob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: IntegrationJob = {
    id: jobId,
    companyId,
    type: params.type,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    maxAttempts,
    nextRunAt: runAt,
    idempotencyKey: params.idempotencyKey,
    payload: params.payload,
    ttl,
  };

  // Transaction-free approach: write job + idempotency mapping (if present)
  // If mapping write fails due to conditional check, read and return existing.
  if (params.idempotencyKey) {
    const key = params.idempotencyKey;
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk: idempPk(companyId),
            sk: idempSk(key),
            companyId,
            idempotencyKey: key,
            jobId,
            createdAt: now,
            ttl: ttlDays(365), // keep mapping longer than jobs
          },
          ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
        })
      );
    } catch (e) {
      // Another writer won the race → return their job
      const winner = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk: idempPk(companyId), sk: idempSk(key) },
        })
      );
      const winnerJobId = (winner.Item as any)?.jobId as string | undefined;
      if (winnerJobId) {
        const existingJob = await getIntegrationJob(companyId, winnerJobId);
        if (existingJob) return { job: existingJob, deduped: true };
      }
      throw e;
    }
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: pk(companyId),
        sk: sk(jobId),
        gsi1pk: gsi1pk(companyId, job.status),
        gsi1sk: gsi1sk(job.nextRunAt, jobId),
        ...job,
      },
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    })
  );

  return { job, deduped: false };
}

export async function listIntegrationJobs(companyId: string, limit: number = 200): Promise<IntegrationJob[]> {
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': pk(companyId), ':prefix': 'JOB#' },
      Limit: Math.min(Math.max(limit, 1), 500),
      ScanIndexForward: false,
    })
  );
  return (res.Items || []) as IntegrationJob[];
}

export async function listDueJobs(companyId: string, status: 'queued' | 'failed', limit: number): Promise<IntegrationJob[]> {
  const now = nowIso();
  const res = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'gsi1pk-gsi1sk-index',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk <= :max',
      ExpressionAttributeValues: {
        ':pk': gsi1pk(companyId, status),
        ':max': `${now}~`, // tilde sorts after '#'
      },
      Limit: Math.min(Math.max(limit, 1), 100),
      ScanIndexForward: true,
    })
  );
  return (res.Items || []) as IntegrationJob[];
}

export async function claimJob(companyId: string, jobId: string, claimedBy: string, lockMs: number = 60_000): Promise<boolean> {
  const now = Date.now();
  const nowS = new Date(now).toISOString();
  const lockUntil = new Date(now + lockMs).toISOString();

  // Claim only if queued/failed and not already locked (or lock expired)
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: pk(companyId), sk: sk(jobId) },
        UpdateExpression: 'SET #status = :running, lockUntil = :lockUntil, claimedBy = :claimedBy, updatedAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':running': 'running',
          ':lockUntil': lockUntil,
          ':claimedBy': claimedBy,
          ':now': nowS,
          ':queued': 'queued',
          ':failed': 'failed',
          ':nowIso': nowS,
        },
        ConditionExpression:
          '(#status = :queued OR #status = :failed) AND (attribute_not_exists(lockUntil) OR lockUntil < :nowIso)',
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function completeJob(companyId: string, jobId: string, result?: Record<string, unknown>): Promise<void> {
  const now = nowIso();
  const job = await getIntegrationJob(companyId, jobId);
  if (!job) return;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(jobId) },
      UpdateExpression:
        'SET #status = :s, updatedAt = :now, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk, #result = :result REMOVE lockUntil, claimedBy',
      ExpressionAttributeNames: { '#status': 'status', '#result': 'result' },
      ExpressionAttributeValues: {
        ':s': 'succeeded',
        ':now': now,
        ':gsi1pk': gsi1pk(companyId, 'succeeded'),
        ':gsi1sk': gsi1sk(job.nextRunAt, jobId),
        ':result': result || null,
      },
    })
  );
}

export async function failJob(companyId: string, jobId: string, errorMessage: string): Promise<void> {
  const now = nowIso();
  const job = await getIntegrationJob(companyId, jobId);
  if (!job) return;

  const attempts = (job.attempts || 0) + 1;
  const maxAttempts = job.maxAttempts || 8;

  if (attempts >= maxAttempts) {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: pk(companyId), sk: sk(jobId) },
        UpdateExpression:
          'SET #status = :dlq, attempts = :attempts, updatedAt = :now, lastError = :err, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk REMOVE lockUntil, claimedBy',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':dlq': 'dead_letter',
          ':attempts': attempts,
          ':now': now,
          ':err': errorMessage,
          ':gsi1pk': gsi1pk(companyId, 'dead_letter'),
          ':gsi1sk': gsi1sk(job.nextRunAt, jobId),
        },
      })
    );
    return;
  }

  const delay = computeBackoffMs(attempts);
  const nextRunAt = new Date(Date.now() + delay).toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(jobId) },
      UpdateExpression:
        'SET #status = :failed, attempts = :attempts, updatedAt = :now, lastError = :err, nextRunAt = :nextRunAt, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk REMOVE lockUntil, claimedBy',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':failed': 'failed',
        ':attempts': attempts,
        ':now': now,
        ':err': errorMessage,
        ':nextRunAt': nextRunAt,
        ':gsi1pk': gsi1pk(companyId, 'failed'),
        ':gsi1sk': gsi1sk(nextRunAt, jobId),
      },
    })
  );
}

export async function requeueJob(companyId: string, jobId: string): Promise<void> {
  const now = nowIso();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: pk(companyId), sk: sk(jobId) },
      UpdateExpression:
        'SET #status = :queued, updatedAt = :now, nextRunAt = :now, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk REMOVE lockUntil, claimedBy, lastError',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':queued': 'queued',
        ':now': now,
        ':gsi1pk': gsi1pk(companyId, 'queued'),
        ':gsi1sk': gsi1sk(now, jobId),
      },
    })
  );
}


