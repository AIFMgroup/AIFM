/**
 * ESG data cache using DynamoDB.
 * Table: partition key = isin (identifier), sort key = provider (or provider#exclusion).
 * TTL attribute: expiresAt (Unix timestamp).
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { NormalizedESGData } from './types';
import type { NormalizedExclusionScreening } from './types';

const TABLE_NAME = process.env.ESG_CACHE_TABLE || 'aifm-esg-cache';
const ESG_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const EXCLUSION_TTL_SECONDS = 60 * 60; // 1 hour

let docClient: DynamoDBDocumentClient | null = null;
let dynamoAvailable: boolean | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-north-1',
    });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

async function checkDynamoAvailable(): Promise<boolean> {
  if (dynamoAvailable !== null) return dynamoAvailable;
  try {
    await getDocClient().send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { isin: '__health__', provider: '__health__' },
    }));
    dynamoAvailable = true;
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? (err as { name: string }).name : '';
    if (name === 'ResourceNotFoundException' || name === 'AccessDeniedException') {
      dynamoAvailable = false;
    } else {
      dynamoAvailable = false;
    }
  }
  return dynamoAvailable;
}

export async function getCachedESG(identifier: string, provider: string): Promise<NormalizedESGData | null> {
  if (!(await checkDynamoAvailable())) return null;
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { isin: identifier, provider },
    }));
    const item = result.Item;
    if (!item || !item.data) return null;
    if (item.expiresAt && Number(item.expiresAt) <= now) return null;
    return item.data as NormalizedESGData;
  } catch {
    return null;
  }
}

export async function setCachedESG(identifier: string, provider: string, data: NormalizedESGData): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ESG_TTL_SECONDS;
  if (!(await checkDynamoAvailable())) return;
  try {
    await getDocClient().send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        isin: identifier,
        provider,
        type: 'esg',
        data,
        expiresAt,
        createdAt: new Date().toISOString(),
      },
    }));
  } catch (err) {
    console.warn('[ESG Cache] Put ESG failed:', err);
  }
}

function exclusionSortKey(provider: string): string {
  return `${provider}#exclusion`;
}

export async function getCachedExclusion(identifier: string, provider: string): Promise<NormalizedExclusionScreening | null> {
  if (!(await checkDynamoAvailable())) return null;
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = await getDocClient().send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { isin: identifier, provider: exclusionSortKey(provider) },
    }));
    const item = result.Item;
    if (!item || !item.data) return null;
    if (item.expiresAt && Number(item.expiresAt) <= now) return null;
    return item.data as NormalizedExclusionScreening;
  } catch {
    return null;
  }
}

export async function setCachedExclusion(identifier: string, provider: string, data: NormalizedExclusionScreening): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + EXCLUSION_TTL_SECONDS;
  if (!(await checkDynamoAvailable())) return;
  try {
    await getDocClient().send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        isin: identifier,
        provider: exclusionSortKey(provider),
        type: 'exclusion',
        data,
        expiresAt,
        createdAt: new Date().toISOString(),
      },
    }));
  } catch (err) {
    console.warn('[ESG Cache] Put exclusion failed:', err);
  }
}
