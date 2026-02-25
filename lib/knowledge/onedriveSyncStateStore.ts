/**
 * OneDrive sync state per company (delta link, last sync time)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.ONEDRIVE_SYNC_STATE_TABLE || 'aifm-onedrive-sync-state';

export interface OneDriveSyncState {
  companyId: string;
  deltaLink?: string;
  folderId?: string;
  lastSyncAt?: string;
  status: 'idle' | 'syncing' | 'success' | 'error';
  error?: string;
  syncedCount?: number;
  updatedAt: string;
}

export async function getOneDriveSyncState(companyId: string): Promise<OneDriveSyncState | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { companyId } })
  );
  return (result.Item as OneDriveSyncState) ?? null;
}

export async function setOneDriveSyncState(
  companyId: string,
  updates: Partial<Omit<OneDriveSyncState, 'companyId' | 'updatedAt'>>
): Promise<OneDriveSyncState> {
  const now = new Date().toISOString();
  const existing = await getOneDriveSyncState(companyId);
  const state: OneDriveSyncState = {
    companyId,
    ...existing,
    ...updates,
    updatedAt: now,
  };
  if (!state.status) state.status = 'idle';
  await docClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: state })
  );
  return state;
}
