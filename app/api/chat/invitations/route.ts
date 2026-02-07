import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE = 'aifm-chat-invitations';

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
    return { userId, email: payload.email || '', name: payload.name || payload.email || 'Okänd' };
  } catch {
    return null;
  }
}

// POST - Create a new invitation
export async function POST(request: NextRequest) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { action } = body;

    // === CREATE INVITATION ===
    if (action === 'create') {
      const { recipientEmail, recipientName, shareCode, sessionTitle } = body;
      if (!recipientEmail || !shareCode) {
        return NextResponse.json({ error: 'recipientEmail och shareCode krävs' }, { status: 400 });
      }

      const invitationId = uuidv4();
      const now = new Date().toISOString();

      const invitation = {
        invitationId,
        recipientEmail: recipientEmail.toLowerCase(),
        senderUserId: user.userId,
        senderName: user.name,
        senderEmail: user.email,
        shareCode,
        sessionTitle: sessionTitle || 'Delad chatt',
        status: 'pending', // pending | accepted | dismissed
        createdAt: now,
        updatedAt: now,
        // TTL: auto-delete after 30 days
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      await docClient.send(new PutCommand({
        TableName: TABLE,
        Item: invitation,
      }));

      return NextResponse.json({ success: true, invitationId });
    }

    // === MARK INVITATION AS ACCEPTED ===
    if (action === 'accept') {
      const { invitationId } = body;
      if (!invitationId) {
        return NextResponse.json({ error: 'invitationId krävs' }, { status: 400 });
      }

      await docClient.send(new UpdateCommand({
        TableName: TABLE,
        Key: { invitationId },
        UpdateExpression: 'SET #s = :status, updatedAt = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':status': 'accepted',
          ':now': new Date().toISOString(),
        },
      }));

      return NextResponse.json({ success: true });
    }

    // === DISMISS INVITATION ===
    if (action === 'dismiss') {
      const { invitationId } = body;
      if (!invitationId) {
        return NextResponse.json({ error: 'invitationId krävs' }, { status: 400 });
      }

      await docClient.send(new UpdateCommand({
        TableName: TABLE,
        Key: { invitationId },
        UpdateExpression: 'SET #s = :status, updatedAt = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':status': 'dismissed',
          ':now': new Date().toISOString(),
        },
      }));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ogiltig action' }, { status: 400 });
  } catch (error) {
    console.error('Error in invitations API:', error);
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 });
  }
}

// GET - List pending invitations for the current user
export async function GET() {
  try {
    const user = await getUserInfo();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query by recipientEmail (GSI: recipientEmail-index)
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'recipientEmail-index',
      KeyConditionExpression: 'recipientEmail = :email',
      FilterExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':email': user.email.toLowerCase(),
        ':pending': 'pending',
      },
      ScanIndexForward: false, // newest first
    }));

    return NextResponse.json({
      invitations: result.Items || [],
      count: result.Items?.length || 0,
    });
  } catch (error) {
    console.error('Error listing invitations:', error);
    // If table doesn't exist yet, return empty
    return NextResponse.json({ invitations: [], count: 0 });
  }
}
