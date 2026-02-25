/**
 * NAV Flows Store
 *
 * DynamoDB storage for daily fund flows (subscriptions/redemptions)
 * and imported NAV prices from AuAg.
 *
 * Tables:
 * - aifm-nav-flows: Daily Sub/Red transactions
 * - aifm-nav-prices: Imported NAV prices (from CSV/XLS)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import type { ParsedNAVPrice, ParsedSubRedEntry, ParsedNAVDetail } from './ingest';

// ============================================================================
// DynamoDB Client
// ============================================================================

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLES = {
  NAV_FLOWS: process.env.NAV_FLOWS_TABLE || 'aifm-nav-flows',
  NAV_PRICES: process.env.NAV_PRICES_TABLE || 'aifm-nav-prices',
  NAV_PIPELINE: process.env.NAV_PIPELINE_TABLE || 'aifm-nav-pipeline',
};

// ============================================================================
// Types
// ============================================================================

export interface StoredFlowEntry {
  pk: string;        // DATE#YYYY-MM-DD
  sk: string;        // FLOW#<uuid>
  date: string;
  fundId: string;
  shareClassId: string;
  fundName: string;
  isin: string;
  type: 'subscription' | 'redemption';
  amount: number;
  currency: string;
  shares: number;
  customer: string;
  status: 'imported' | 'confirmed' | 'settled';
  importedAt: string;
  source: 'xls' | 'manual' | 'api';
}

export interface StoredNAVPrice {
  pk: string;        // DATE#YYYY-MM-DD
  sk: string;        // PRICE#<fundId>#<shareClassId>
  date: string;
  fundId: string;
  shareClassId: string;
  shareClassName: string;
  isin: string;
  currency: string;
  navPerShare: number;
  changePercent: number;
  sharesOutstanding?: number;
  totalNetAssets?: number;
  importedAt: string;
  source: 'csv' | 'xls' | 'manual' | 'ISEC';
  fundName?: string;
}

export interface PipelineRun {
  pk: string;        // DATE#YYYY-MM-DD
  sk: string;        // RUN#<timestamp>
  date: string;
  status: 'started' | 'prices_imported' | 'flows_imported' | 'calculated' | 'pending_approval' | 'approved' | 'distributed' | 'failed';
  steps: PipelineStep[];
  startedAt: string;
  completedAt?: string;
  approvalId?: string;
  error?: string;
}

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  details?: string;
  error?: string;
}

// ============================================================================
// Flows Store
// ============================================================================

export class FlowsStore {
  /**
   * Save parsed SubRed entries
   */
  async saveFlows(entries: ParsedSubRedEntry[]): Promise<number> {
    if (entries.length === 0) return 0;

    const now = new Date().toISOString();
    const batches: StoredFlowEntry[][] = [];

    const items: StoredFlowEntry[] = entries.map((e, idx) => ({
      pk: `DATE#${e.date}`,
      sk: `FLOW#${Date.now()}-${idx}`,
      date: e.date,
      fundId: e.fundId,
      shareClassId: e.shareClassId,
      fundName: e.fundName,
      isin: e.isin,
      type: e.type,
      amount: e.amount,
      currency: e.currency,
      shares: e.shares,
      customer: e.customer,
      status: 'imported',
      importedAt: now,
      source: 'xls',
    }));

    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLES.NAV_FLOWS]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      }));
    }

    return items.length;
  }

  /**
   * Get flows for a specific date
   */
  async getFlowsByDate(date: string): Promise<StoredFlowEntry[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_FLOWS,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `DATE#${date}`,
        ':prefix': 'FLOW#',
      },
    }));

    return (result.Items as StoredFlowEntry[]) || [];
  }

  /**
   * Get flows for a date range
   */
  async getFlowsByDateRange(fromDate: string, toDate: string): Promise<StoredFlowEntry[]> {
    const allFlows: StoredFlowEntry[] = [];
    const current = new Date(fromDate);
    const end = new Date(toDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const flows = await this.getFlowsByDate(dateStr);
      allFlows.push(...flows);
      current.setDate(current.getDate() + 1);
    }

    return allFlows;
  }
}

// ============================================================================
// NAV Prices Store
// ============================================================================

export class NAVPricesStore {
  /**
   * Save parsed NAV prices from CSV
   */
  async savePricesFromCSV(prices: ParsedNAVPrice[]): Promise<number> {
    if (prices.length === 0) return 0;

    const now = new Date().toISOString();
    const items: StoredNAVPrice[] = prices.map((p) => ({
      pk: `DATE#${p.date}`,
      sk: `PRICE#${p.fundId}#${p.shareClassId}`,
      date: p.date,
      fundId: p.fundId,
      shareClassId: p.shareClassId,
      shareClassName: p.shareClassName,
      isin: p.isin,
      currency: p.currency,
      navPerShare: p.navPerShare,
      changePercent: p.changePercent,
      importedAt: now,
      source: 'csv',
    }));

    const batches: StoredNAVPrice[][] = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLES.NAV_PRICES]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      }));
    }

    return items.length;
  }

  /**
   * Save parsed NAV detail from XLS (includes shares outstanding)
   */
  async savePricesFromDetail(details: ParsedNAVDetail[]): Promise<number> {
    if (details.length === 0) return 0;

    const now = new Date().toISOString();
    const items: StoredNAVPrice[] = details.map((d) => ({
      pk: `DATE#${d.date}`,
      sk: `PRICE#${d.fundId}#${d.shareClassId}`,
      date: d.date,
      fundId: d.fundId,
      shareClassId: d.shareClassId,
      shareClassName: d.fundName,
      isin: d.isin,
      currency: d.currency,
      navPerShare: d.navPerShare,
      changePercent: d.navChange,
      sharesOutstanding: d.sharesOutstanding,
      totalNetAssets: d.totalNetAssets,
      importedAt: now,
      source: 'xls',
    }));

    const batches: StoredNAVPrice[][] = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLES.NAV_PRICES]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      }));
    }

    return items.length;
  }

  /**
   * Get all prices for a specific date
   */
  async savePrice(data: {
    navDate: string; fundId: string; shareClassId: string; isin: string;
    fundName: string; shareClassName: string; currency: string;
    navPerShare: number; totalNetAssets?: number; sharesOutstanding?: number;
    changePercent?: number; source?: string;
  }): Promise<void> {
    const item: StoredNAVPrice = {
      pk: `DATE#${data.navDate}`,
      sk: `PRICE#${data.fundId}#${data.shareClassId}`,
      date: data.navDate,
      fundId: data.fundId,
      shareClassId: data.shareClassId,
      shareClassName: data.shareClassName,
      fundName: data.fundName,
      isin: data.isin,
      currency: data.currency,
      navPerShare: data.navPerShare,
      changePercent: data.changePercent ?? 0,
      sharesOutstanding: data.sharesOutstanding,
      totalNetAssets: data.totalNetAssets,
      importedAt: new Date().toISOString(),
      source: (data.source as StoredNAVPrice['source']) || 'manual',
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.NAV_PRICES,
      Item: item,
    }));
  }

  async getPricesByDate(date: string): Promise<StoredNAVPrice[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_PRICES,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `DATE#${date}`,
        ':prefix': 'PRICE#',
      },
    }));

    return (result.Items as StoredNAVPrice[]) || [];
  }

  /**
   * Get price for a specific fund/share class on a date
   */
  async getPrice(date: string, fundId: string, shareClassId: string): Promise<StoredNAVPrice | null> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_PRICES,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `DATE#${date}`,
        ':sk': `PRICE#${fundId}#${shareClassId}`,
      },
    }));

    return (result.Items?.[0] as StoredNAVPrice) ?? null;
  }
}

// ============================================================================
// Pipeline Store
// ============================================================================

export class PipelineStore {
  /**
   * Create a new pipeline run
   */
  async createRun(date: string): Promise<PipelineRun> {
    const now = new Date().toISOString();
    const run: PipelineRun = {
      pk: `DATE#${date}`,
      sk: `RUN#${now}`,
      date,
      status: 'started',
      steps: [
        { name: 'Import NAV-priser (CSV)', status: 'pending' },
        { name: 'Import NAV-detaljer (XLS)', status: 'pending' },
        { name: 'Import Sub/Red (XLS)', status: 'pending' },
        { name: 'Hämta FX-kurser (ECB)', status: 'pending' },
        { name: 'Beräkna NAV', status: 'pending' },
        { name: 'Compliance-check', status: 'pending' },
        { name: 'Skapa godkännandebegäran', status: 'pending' },
      ],
      startedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLES.NAV_PIPELINE,
      Item: run,
    }));

    return run;
  }

  /**
   * Update pipeline run
   */
  async updateRun(run: PipelineRun): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: TABLES.NAV_PIPELINE,
      Item: run,
    }));
  }

  /**
   * Get latest pipeline run for a date
   */
  async getLatestRun(date: string): Promise<PipelineRun | null> {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLES.NAV_PIPELINE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `DATE#${date}`,
        ':prefix': 'RUN#',
      },
      ScanIndexForward: false,
      Limit: 1,
    }));

    return (result.Items?.[0] as PipelineRun) ?? null;
  }

  /**
   * Get recent pipeline runs
   */
  async getRecentRuns(limit: number = 10): Promise<PipelineRun[]> {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLES.NAV_PIPELINE,
      Limit: limit * 2,
    }));

    const runs = (result.Items as PipelineRun[]) || [];
    return runs
      .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
      .slice(0, limit);
  }
}

// ============================================================================
// Singletons
// ============================================================================

let flowsStore: FlowsStore | null = null;
let navPricesStore: NAVPricesStore | null = null;
let pipelineStore: PipelineStore | null = null;

export function getFlowsStore(): FlowsStore {
  if (!flowsStore) flowsStore = new FlowsStore();
  return flowsStore;
}

export function getNAVPricesStore(): NAVPricesStore {
  if (!navPricesStore) navPricesStore = new NAVPricesStore();
  return navPricesStore;
}

export function getPipelineStore(): PipelineStore {
  if (!pipelineStore) pipelineStore = new PipelineStore();
  return pipelineStore;
}
