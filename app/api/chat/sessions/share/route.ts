import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const SHARE_TABLE = 'aifm-shared-sessions';
const SESSIONS_TABLE = 'aifm-chat-sessions';

// Get user info from token
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

// Generate a short readable share code
function generateShareCode(): string {
  // 8-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST - Create a share link for a session, or join a shared session
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
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { action } = body;

    // === CREATE SHARE LINK ===
    if (action === 'create') {
      const { sessionId } = body;
      if (!sessionId) {
        return NextResponse.json({ error: 'sessionId krävs' }, { status: 400 });
      }

      // Verify the user owns this session
      const sessionResult = await docClient.send(new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { userId: user.userId, sessionId },
      }));

      if (!sessionResult.Item) {
        return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });
      }

      // Check if share already exists for this session (optional: requires GSI sessionId-index)
      let existingShare: { shareCode: string; participants?: unknown[] } | null = null;
      try {
        const existingShares = await docClient.send(new QueryCommand({
          TableName: SHARE_TABLE,
          IndexName: 'sessionId-index',
          KeyConditionExpression: 'sessionId = :sid',
          ExpressionAttributeValues: { ':sid': sessionId },
        }));
        if (existingShares.Items && existingShares.Items.length > 0) {
          existingShare = existingShares.Items[0] as { shareCode: string; participants?: unknown[] };
        }
      } catch {
        // Table or GSI may not exist; continue to create new share
      }

      if (existingShare) {
        return NextResponse.json({
          shareCode: existingShare.shareCode,
          shareUrl: `${request.headers.get('origin') || ''}/chat?share=${existingShare.shareCode}`,
          participants: existingShare.participants,
        });
      }

      // Create new share
      const shareCode = generateShareCode();
      const now = new Date().toISOString();

      const shareRecord = {
        shareCode,
        sessionId,
        ownerUserId: user.userId,
        ownerName: user.name,
        ownerEmail: user.email,
        title: sessionResult.Item.title || 'Delad chatt',
        participants: [
          {
            userId: user.userId,
            name: user.name,
            email: user.email,
            role: 'owner',
            joinedAt: now,
          }
        ],
        createdAt: now,
        updatedAt: now,
      };

      await docClient.send(new PutCommand({
        TableName: SHARE_TABLE,
        Item: shareRecord,
      }));

      return NextResponse.json({
        shareCode,
        shareUrl: `${request.headers.get('origin') || ''}/chat?share=${shareCode}`,
        participants: shareRecord.participants,
      });
    }

    // === JOIN A SHARED SESSION ===
    if (action === 'join') {
      const { shareCode } = body;
      if (!shareCode) {
        return NextResponse.json({ error: 'shareCode krävs' }, { status: 400 });
      }

      // Look up the share
      const shareResult = await docClient.send(new GetCommand({
        TableName: SHARE_TABLE,
        Key: { shareCode },
      }));

      if (!shareResult.Item) {
        return NextResponse.json({ error: 'Delningslänk hittades inte' }, { status: 404 });
      }

      const share = shareResult.Item;

      // Check if user is already a participant
      const isParticipant = share.participants?.some(
        (p: { userId: string }) => p.userId === user.userId
      );

      if (!isParticipant) {
        // Add user as participant
        const now = new Date().toISOString();
        const newParticipant = {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: 'collaborator',
          joinedAt: now,
        };

        share.participants = [...(share.participants || []), newParticipant];

        await docClient.send(new PutCommand({
          TableName: SHARE_TABLE,
          Item: { ...share, updatedAt: now },
        }));
      }

      // Load the original session to get messages
      const sessionResult = await docClient.send(new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { userId: share.ownerUserId, sessionId: share.sessionId },
      }));

      if (!sessionResult.Item) {
        return NextResponse.json({ error: 'Originalsessionen hittades inte' }, { status: 404 });
      }

      return NextResponse.json({
        sessionId: share.sessionId,
        ownerUserId: share.ownerUserId,
        title: sessionResult.Item.title,
        messages: sessionResult.Item.messages || [],
        mode: sessionResult.Item.mode || 'claude',
        participants: share.participants,
        shareCode,
        isShared: true,
      });
    }

    // === REMOVE SHARE ===
    if (action === 'remove') {
      const { shareCode } = body;
      if (!shareCode) {
        return NextResponse.json({ error: 'shareCode krävs' }, { status: 400 });
      }

      const shareResult = await docClient.send(new GetCommand({
        TableName: SHARE_TABLE,
        Key: { shareCode },
      }));

      if (!shareResult.Item || shareResult.Item.ownerUserId !== user.userId) {
        return NextResponse.json({ error: 'Inte behörig' }, { status: 403 });
      }

      await docClient.send(new DeleteCommand({
        TableName: SHARE_TABLE,
        Key: { shareCode },
      }));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ogiltig action' }, { status: 400 });
  } catch (error) {
    console.error('Error in share API:', error);
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 });
  }
}

// GET - Get share info or poll for updates on a shared session
export async function GET(request: NextRequest) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shareCode = searchParams.get('shareCode');
    const sessionId = searchParams.get('sessionId');
    const since = searchParams.get('since'); // ISO timestamp for polling

    // Get share info by code
    if (shareCode) {
      const shareResult = await docClient.send(new GetCommand({
        TableName: SHARE_TABLE,
        Key: { shareCode },
      }));

      if (!shareResult.Item) {
        return NextResponse.json({ error: 'Delning hittades inte' }, { status: 404 });
      }

      const share = shareResult.Item;

      // Load the session messages
      const sessionResult = await docClient.send(new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { userId: share.ownerUserId, sessionId: share.sessionId },
      }));

      if (!sessionResult.Item) {
        return NextResponse.json({ error: 'Session hittades inte' }, { status: 404 });
      }

      const session = sessionResult.Item;

      // If polling (since param), only return if there are changes
      if (since && session.updatedAt <= since) {
        return NextResponse.json({ hasUpdates: false });
      }

      return NextResponse.json({
        hasUpdates: true,
        sessionId: share.sessionId,
        ownerUserId: share.ownerUserId,
        title: session.title,
        messages: session.messages || [],
        mode: session.mode || 'claude',
        participants: share.participants,
        shareCode,
        updatedAt: session.updatedAt,
        isShared: true,
      });
    }

    // Check if a session has shares
    if (sessionId) {
      try {
        const sharesResult = await docClient.send(new QueryCommand({
          TableName: SHARE_TABLE,
          IndexName: 'sessionId-index',
          KeyConditionExpression: 'sessionId = :sid',
          ExpressionAttributeValues: { ':sid': sessionId },
        }));

        if (sharesResult.Items && sharesResult.Items.length > 0) {
          const share = sharesResult.Items[0];
          return NextResponse.json({
            isShared: true,
            shareCode: share.shareCode,
            participants: share.participants,
          });
        }
      } catch {
        // GSI or table may not exist; treat as not shared
      }

      return NextResponse.json({ isShared: false });
    }

    return NextResponse.json({ error: 'shareCode eller sessionId krävs' }, { status: 400 });
  } catch (error) {
    console.error('Error in share GET:', error);
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 });
  }
}
