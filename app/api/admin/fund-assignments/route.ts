import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { verifyIdToken } from '@/lib/auth/tokens';

const TABLE_NAME = process.env.USER_FUND_ASSIGNMENTS_TABLE || 'aifm-user-fund-assignments';

let dynamoClient: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-north-1',
    });
    dynamoClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return dynamoClient;
}

export interface FundAssignment {
  email: string;
  fundId: string;
  fundName: string;
  article: '6' | '8' | '9';
  assignedAt: string;
  assignedBy: string;
}

async function getCurrentUserEmail(): Promise<string | null> {
  const token = (await cookies()).get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  try {
    const payload = await verifyIdToken(token);
    return (payload.email as string) ?? (payload['cognito:username'] as string) ?? null;
  } catch {
    return null;
  }
}

// GET ?email={email} | ?fundId={fundId}
export async function GET(request: NextRequest) {
  const role = (request.headers.get('x-aifm-role') || '').toLowerCase();
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');
  const fundId = searchParams.get('fundId');

  const currentEmail = await getCurrentUserEmail();

  if (email) {
    // List assignments for a user: forvaltare can only request their own
    if (role === 'forvaltare') {
      if (!currentEmail || email.toLowerCase() !== currentEmail.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (role !== 'admin' && role !== 'operation') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      const client = getClient();
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${email}`,
            ':sk': 'FUND#',
          },
        })
      );

      const assignments: FundAssignment[] = (result.Items || []).map((item) => ({
      email: item.email as string,
      fundId: item.fundId as string,
      fundName: item.fundName as string,
      article: item.article as '6' | '8' | '9',
      assignedAt: item.assignedAt as string,
      assignedBy: item.assignedBy as string,
    }));

      return NextResponse.json({ assignments });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ResourceNotFoundException') || msg.includes('Table')) {
        return NextResponse.json({ assignments: [] });
      }
      throw err;
    }
  }

  if (fundId) {
    // List users assigned to a fund: admin or operation only
    if (role !== 'admin' && role !== 'operation') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
      const client = getClient();
      const result = await client.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `FUND#${fundId}`,
            ':sk': 'USER#',
          },
        })
      );

      const assignments: FundAssignment[] = (result.Items || []).map((item) => ({
        email: item.email as string,
        fundId: item.fundId as string,
        fundName: item.fundName as string,
        article: item.article as '6' | '8' | '9',
        assignedAt: item.assignedAt as string,
        assignedBy: item.assignedBy as string,
      }));

      return NextResponse.json({ assignments });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ResourceNotFoundException') || msg.includes('Table')) {
        return NextResponse.json({ assignments: [] });
      }
      throw err;
    }
  }

  return NextResponse.json({ error: 'Missing email or fundId' }, { status: 400 });
}

// POST - Create assignment (admin only)
export async function POST(request: NextRequest) {
  const role = (request.headers.get('x-aifm-role') || '').toLowerCase();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const currentEmail = await getCurrentUserEmail();
  if (!currentEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email: string; fundId: string; fundName: string; article: '6' | '8' | '9' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, fundId, fundName, article } = body;
  if (!email || !fundId || !fundName || !article || !['6', '8', '9'].includes(article)) {
    return NextResponse.json(
      { error: 'Missing or invalid: email, fundId, fundName, article (6|8|9)' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const item = {
    PK: `USER#${email}`,
    SK: `FUND#${fundId}`,
    GSI1PK: `FUND#${fundId}`,
    GSI1SK: `USER#${email}`,
    email,
    fundId,
    fundName,
    article,
    assignedAt: now,
    assignedBy: currentEmail,
  };

  try {
    const client = getClient();
    await client.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );
    return NextResponse.json({
      email,
      fundId,
      fundName,
      article,
      assignedAt: now,
      assignedBy: currentEmail,
    });
  } catch (err) {
    console.error('Fund assignment create error:', err);
    return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
  }
}

// DELETE ?email={email}&fundId={fundId} (admin only)
export async function DELETE(request: NextRequest) {
  const role = (request.headers.get('x-aifm-role') || '').toLowerCase();
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get('email');
  const fundId = searchParams.get('fundId');

  if (!email || !fundId) {
    return NextResponse.json({ error: 'Missing email or fundId' }, { status: 400 });
  }

  try {
    const client = getClient();
    await client.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${email}`,
          SK: `FUND#${fundId}`,
        },
      })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Fund assignment delete error:', err);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
