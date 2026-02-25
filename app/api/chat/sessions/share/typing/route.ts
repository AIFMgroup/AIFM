import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { cookies } from 'next/headers';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const SHARE_TABLE = 'aifm-shared-sessions';

async function getUserInfo(): Promise<{ userId: string; email: string; name: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const userId = payload.sub || payload.email;
    if (!userId) return null;
    return {
      userId,
      email: payload.email || '',
      name: payload.name || payload.email || 'Okänd användare',
    };
  } catch {
    return null;
  }
}

/** POST: Set or clear typing indicator for the current user in a shared session. */
export async function POST(request: NextRequest) {
  const user = await getUserInfo();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { shareCode?: string; typing?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { shareCode, typing } = body;
  if (!shareCode) {
    return NextResponse.json({ error: 'shareCode krävs' }, { status: 400 });
  }

  const shareResult = await docClient.send(new GetCommand({
    TableName: SHARE_TABLE,
    Key: { shareCode },
  }));

  if (!shareResult.Item) {
    return NextResponse.json({ error: 'Delning hittades inte' }, { status: 404 });
  }

  const share = shareResult.Item as { participants?: Array<{ userId: string }> };
  const isParticipant = share.participants?.some((p: { userId: string }) => p.userId === user.userId);
  if (!isParticipant) {
    return NextResponse.json({ error: 'Inte behörig' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const value = typing ? { name: user.name, at: now } : null;

  if (typing) {
    await docClient.send(new UpdateCommand({
      TableName: SHARE_TABLE,
      Key: { shareCode },
      UpdateExpression: 'SET typingUsers.#uid = :val',
      ExpressionAttributeNames: { '#uid': user.userId },
      ExpressionAttributeValues: { ':val': value },
    }));
  } else {
    await docClient.send(new UpdateCommand({
      TableName: SHARE_TABLE,
      Key: { shareCode },
      UpdateExpression: 'REMOVE typingUsers.#uid',
      ExpressionAttributeNames: { '#uid': user.userId },
    }));
  }

  return NextResponse.json({ ok: true });
}
