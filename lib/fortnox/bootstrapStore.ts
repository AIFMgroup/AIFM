/**
 * Fortnox Bootstrap Store
 *
 * Lagrar "bootstrap readiness" och cache för viktiga Fortnox-resurser per bolag.
 * För att undvika ny infrastruktur använder vi samma DynamoDB-tabell som tokens
 * men med andra sort keys.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { FORTNOX_DDB_TABLE_NAME } from './tokenStore';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type FortnoxBootstrapStatus = 'not_started' | 'queued' | 'running' | 'ready' | 'error';

export interface FortnoxBootstrapState {
  companyId: string;
  status: FortnoxBootstrapStatus;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
  stats?: Record<string, number>;
}

type CacheKey =
  | 'ACCOUNTS'
  | 'COSTCENTERS'
  | 'PROJECTS'
  | 'VOUCHERSERIES'
  | 'FINANCIALYEARS'
  | 'SUPPLIERS'
  | 'ARTICLES';

export const fortnoxBootstrapStore = {
  async getState(companyId: string): Promise<FortnoxBootstrapState> {
    const res = await docClient.send(new GetCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: { pk: `COMPANY#${companyId}`, sk: 'FORTNOX_BOOTSTRAP' },
    }));

    if (!res.Item) {
      return { companyId, status: 'not_started' };
    }

    return {
      companyId,
      status: (res.Item.status as FortnoxBootstrapStatus) || 'not_started',
      startedAt: res.Item.startedAt as string,
      finishedAt: res.Item.finishedAt as string,
      lastError: res.Item.lastError as string,
      stats: res.Item.stats as Record<string, number>,
    };
  },

  async setState(companyId: string, state: Omit<FortnoxBootstrapState, 'companyId'>): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Item: {
        pk: `COMPANY#${companyId}`,
        sk: 'FORTNOX_BOOTSTRAP',
        companyId,
        ...state,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  async putCache(companyId: string, key: CacheKey, payload: unknown): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Item: {
        pk: `COMPANY#${companyId}`,
        sk: `FORTNOX_CACHE#${key}`,
        companyId,
        key,
        payload,
        fetchedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  async getCache<T = unknown>(companyId: string, key: CacheKey): Promise<{ payload: T; fetchedAt?: string } | null> {
    const res = await docClient.send(new GetCommand({
      TableName: FORTNOX_DDB_TABLE_NAME,
      Key: { pk: `COMPANY#${companyId}`, sk: `FORTNOX_CACHE#${key}` },
    }));

    if (!res.Item) return null;
    return {
      payload: res.Item.payload as T,
      fetchedAt: res.Item.fetchedAt as string,
    };
  },
};


