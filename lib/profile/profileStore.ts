import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

export type UserProfile = {
  sub: string;
  email?: string;
  displayName?: string;
  title?: string;
  avatarKey?: string;
  avatarUpdatedAt?: string;
  updatedAt: string;
};

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.USER_PROFILE_TABLE_NAME || 'aifm-user-profiles';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function getUserProfile(sub: string): Promise<UserProfile | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: sub },
    })
  );
  const item = res.Item as any;
  if (!item) return null;
  return {
    sub: item.pk,
    email: item.email,
    displayName: item.displayName,
    title: item.title,
    avatarKey: item.avatarKey,
    avatarUpdatedAt: item.avatarUpdatedAt,
    updatedAt: item.updatedAt,
  };
}

export async function upsertUserProfile(sub: string, patch: Partial<UserProfile>): Promise<UserProfile> {
  const existing = await getUserProfile(sub);
  const now = new Date().toISOString();
  const merged: UserProfile = {
    sub,
    updatedAt: now,
    ...existing,
    ...patch,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: sub,
        email: merged.email,
        displayName: merged.displayName,
        title: merged.title,
        avatarKey: merged.avatarKey,
        avatarUpdatedAt: merged.avatarUpdatedAt,
        updatedAt: merged.updatedAt,
      },
    })
  );

  return merged;
}


