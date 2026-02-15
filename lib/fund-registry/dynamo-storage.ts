/**
 * DynamoDB Storage Adapter for Fund Registry
 *
 * Table: aifm-fund-registry (or FUND_REGISTRY_TABLE env)
 * - pk: key prefix (fund, shareclass, nav, position, cash, tx, investor, holding)
 * - sk: key suffix (id or composite id)
 * - data: JSON value
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { StorageAdapter } from './storage-types';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.FUND_REGISTRY_TABLE || 'aifm-fund-registry';

function splitKey(key: string): { pk: string; sk: string } {
  const i = key.indexOf(':');
  if (i === -1) return { pk: key, sk: '' };
  return { pk: key.substring(0, i), sk: key.substring(i + 1) };
}

export class DynamoDBStorage implements StorageAdapter {
  private tableName: string;

  constructor(tableName?: string) {
    this.tableName = tableName || TABLE_NAME;
  }

  async get<T>(key: string): Promise<T | null> {
    const { pk, sk } = splitKey(key);
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk, sk },
      })
    );
    if (!result.Item || result.Item.data === undefined) return null;
    return result.Item.data as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const { pk, sk } = splitKey(key);
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk, sk, data: value },
      })
    );
  }

  async delete(key: string): Promise<void> {
    const { pk, sk } = splitKey(key);
    await docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk, sk },
      })
    );
  }

  async list<T>(prefix: string): Promise<T[]> {
    const pk = prefix.endsWith(':') ? prefix.slice(0, -1) : prefix;
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': pk },
      })
    );
    const items = (result.Items || []).map((item) => item.data as T);
    return items;
  }

  async query<T>(prefix: string, filter: (item: T) => boolean): Promise<T[]> {
    const all = await this.list<T>(prefix);
    return all.filter(filter);
  }
}
