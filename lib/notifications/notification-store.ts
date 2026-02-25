import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = 'aifm-notifications';
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });

export type NotificationType =
  | 'security_review_alert'
  | 'security_expiring'
  | 'approval_completed'
  | 'approval_rejected'
  | 'info_requested'
  | 'info_responded'
  | 'approval_comment'
  | 'system';

export interface AppNotification {
  id: string;
  userEmail: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
  createdAt: string;
  metadata?: Record<string, string>;
}

function toItem(n: AppNotification): Record<string, { S: string } | { BOOL: boolean } | { M: Record<string, { S: string }> }> {
  const item: Record<string, unknown> = {
    PK: { S: `USER#${n.userEmail}` },
    SK: { S: `NOTIF#${n.createdAt}#${n.id}` },
    GSI1PK: { S: `TYPE#${n.type}` },
    GSI1SK: { S: `${n.createdAt}#${n.id}` },
    id: { S: n.id },
    userEmail: { S: n.userEmail },
    type: { S: n.type },
    title: { S: n.title },
    message: { S: n.message },
    priority: { S: n.priority },
    read: { BOOL: n.read },
    createdAt: { S: n.createdAt },
  };
  if (n.link) item.link = { S: n.link };
  if (n.metadata) {
    const m: Record<string, { S: string }> = {};
    for (const [k, v] of Object.entries(n.metadata)) {
      m[k] = { S: v };
    }
    item.metadata = { M: m };
  }
  return item as Record<string, { S: string } | { BOOL: boolean } | { M: Record<string, { S: string }> }>;
}

function fromItem(item: Record<string, unknown>): AppNotification {
  const s = (key: string) => ((item[key] as { S?: string })?.S ?? '');
  const b = (key: string) => ((item[key] as { BOOL?: boolean })?.BOOL ?? false);

  const notification: AppNotification = {
    id: s('id'),
    userEmail: s('userEmail'),
    type: s('type') as NotificationType,
    title: s('title'),
    message: s('message'),
    priority: (s('priority') || 'medium') as 'high' | 'medium' | 'low',
    read: b('read'),
    createdAt: s('createdAt'),
  };
  if (s('link')) notification.link = s('link');

  const meta = item.metadata as { M?: Record<string, { S: string }> } | undefined;
  if (meta?.M) {
    notification.metadata = {};
    for (const [k, v] of Object.entries(meta.M)) {
      notification.metadata[k] = v.S;
    }
  }
  return notification;
}

export async function createNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
): Promise<AppNotification> {
  const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const full: AppNotification = {
    ...n,
    id,
    createdAt: new Date().toISOString(),
    read: false,
  };

  await client.send(
    new PutItemCommand({
      TableName: TABLE_NAME,
      Item: toItem(full) as Record<string, never>,
    })
  );

  return full;
}

export async function getNotificationsForUser(
  email: string,
  limit = 50
): Promise<AppNotification[]> {
  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': { S: `USER#${email}` } },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items || []).map((item) => fromItem(item as Record<string, unknown>));
}

export async function markNotificationRead(
  email: string,
  createdAt: string,
  id: string
): Promise<void> {
  await client.send(
    new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: { S: `USER#${email}` },
        SK: { S: `NOTIF#${createdAt}#${id}` },
      },
      UpdateExpression: 'SET #r = :val',
      ExpressionAttributeNames: { '#r': 'read' },
      ExpressionAttributeValues: { ':val': { BOOL: true } },
    })
  );
}

export async function markAllRead(email: string): Promise<void> {
  const notifications = await getNotificationsForUser(email, 100);
  const unread = notifications.filter((n) => !n.read);
  for (const n of unread) {
    await markNotificationRead(email, n.createdAt, n.id);
  }
}

export async function deleteNotification(
  email: string,
  createdAt: string,
  id: string
): Promise<void> {
  await client.send(
    new DeleteItemCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: { S: `USER#${email}` },
        SK: { S: `NOTIF#${createdAt}#${id}` },
      },
    })
  );
}
