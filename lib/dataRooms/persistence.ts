import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
// Default to the existing production table name. Can be overridden via AIFM_DATAROOMS_TABLE.
export const DATAROOMS_TABLE = process.env.AIFM_DATAROOMS_TABLE || 'aifm-datarooms';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type Key = { pk: string; sk: string };

export function nowIso() {
  return new Date().toISOString();
}

export function requirePersistenceOrFallback(label: string): boolean {
  const require = process.env.AIFM_DATAROOMS_REQUIRE_PERSISTENCE === 'true';
  if (!DATAROOMS_TABLE || DATAROOMS_TABLE.trim().length === 0) {
    if (require) throw new Error(`[DataRooms] Missing AIFM_DATAROOMS_TABLE for ${label}`);
    console.warn(`[DataRooms] Persistence disabled (missing AIFM_DATAROOMS_TABLE) for ${label}; using in-memory fallback.`);
    return false;
  }
  return true;
}

export async function getItem<T>(key: Key): Promise<T | null> {
  const res = await docClient.send(new GetCommand({ TableName: DATAROOMS_TABLE, Key: key }));
  return (res.Item as T) || null;
}

export async function putItem(item: Record<string, any>, conditionExpression?: string): Promise<void> {
  await docClient.send(new PutCommand({
    TableName: DATAROOMS_TABLE,
    Item: item,
    ...(conditionExpression ? { ConditionExpression: conditionExpression } : {}),
  }));
}

export async function deleteItem(key: Key): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: DATAROOMS_TABLE, Key: key }));
}

export async function queryPk<T>(pk: string, beginsWithSk?: string, limit?: number, scanForward?: boolean): Promise<T[]> {
  const res = await docClient.send(new QueryCommand({
    TableName: DATAROOMS_TABLE,
    KeyConditionExpression: beginsWithSk ? 'pk = :pk AND begins_with(sk, :sk)' : 'pk = :pk',
    ExpressionAttributeValues: beginsWithSk ? { ':pk': pk, ':sk': beginsWithSk } : { ':pk': pk },
    ...(typeof limit === 'number' ? { Limit: limit } : {}),
    ...(typeof scanForward === 'boolean' ? { ScanIndexForward: scanForward } : {}),
  }));
  return (res.Items || []) as T[];
}

export async function updateItem(
  key: Key,
  updateExpression: string,
  exprValues: Record<string, any>,
  exprNames?: Record<string, string>
): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: DATAROOMS_TABLE,
    Key: key,
    UpdateExpression: updateExpression,
    ...(exprNames ? { ExpressionAttributeNames: exprNames } : {}),
    ExpressionAttributeValues: exprValues,
  }));
}


