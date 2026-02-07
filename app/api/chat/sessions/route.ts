import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand, 
  GetCommand,
  DeleteCommand,
  UpdateCommand 
} from '@aws-sdk/lib-dynamodb';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().optional(),
  id: z.string().optional(),
  attachments: z.array(z.object({ name: z.string(), type: z.string() })).optional(),
  feedback: z.string().optional(),
  mode: z.string().optional(),
}).passthrough();

const sessionPostSchema = z.object({
  sessionId: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  mode: z.enum(['regelverksassistent', 'claude', 'chatgpt']).optional(),
  messages: z.array(chatMessageSchema).optional(),
  message: z.any().optional(),
  isNewMessage: z.boolean().optional(),
  ownerUserId: z.string().max(200).optional(),
  shareCode: z.string().max(200).optional(),
  pinned: z.boolean().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  branches: z.array(z.object({
    branchId: z.string(),
    parentMessageId: z.string(),
    messages: z.array(chatMessageSchema),
    createdAt: z.string(),
  })).optional(),
}).passthrough();

/** Safely parse request JSON; returns parsed body or a 400 Response. */
async function safeParseJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = 'aifm-chat-sessions';
const SHARE_TABLE = 'aifm-shared-sessions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  id?: string;
  attachments?: { name: string; type: string }[];
}

/** A conversation branch: fork at a message, then messages continue from there */
export interface ChatBranch {
  branchId: string;
  parentMessageId: string;
  messages: ChatMessage[];
  createdAt: string;
}

interface ChatSession {
  userId: string;
  sessionId: string;
  title: string;
  mode: 'regelverksassistent' | 'claude' | 'chatgpt';
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  pinnedAt?: string;
  tags?: string[];
  branches?: ChatBranch[];
}

// Get user ID from token (simplified - in production use proper JWT validation)
async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) return null;
    
    // Decode JWT to get user ID (sub claim)
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sub || payload.email || null;
  } catch {
    return null;
  }
}

// GET - List user's chat sessions
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    // Get specific session
    if (sessionId) {
      // First try own session
      let result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId, sessionId },
      }));
      
      if (!result.Item) {
        // Check if this is a shared session — look up the owner via share table
        const ownerUserId = searchParams.get('ownerUserId');
        if (ownerUserId) {
          // Verify user is a participant by checking share records for this session
          const sharesResult = await docClient.send(new QueryCommand({
            TableName: SHARE_TABLE,
            IndexName: 'sessionId-index',
            KeyConditionExpression: 'sessionId = :sid',
            ExpressionAttributeValues: { ':sid': sessionId },
          }));
          
          const share = sharesResult.Items?.[0];
          const isParticipant = share?.participants?.some(
            (p: { userId: string }) => p.userId === userId
          );
          
          if (isParticipant) {
            result = await docClient.send(new GetCommand({
              TableName: TABLE_NAME,
              Key: { userId: ownerUserId, sessionId },
            }));
          }
        }
      }
      
      if (!result.Item) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      return NextResponse.json(result.Item);
    }
    
    // Pagination: optional startKey (JSON string) for ExclusiveStartKey
    let exclusiveStartKey: Record<string, unknown> | undefined;
    const startKeyParam = searchParams.get('startKey');
    if (startKeyParam) {
      try {
        exclusiveStartKey = JSON.parse(decodeURIComponent(startKeyParam)) as Record<string, unknown>;
      } catch {
        // ignore invalid startKey
      }
    }

    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
      Limit: limit,
      ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
    }));
    
    const items = (result.Items || []) as ChatSession[];
    // Sort: pinned first, then by updatedAt descending
    items.sort((a, b) => {
      const aPinned = a.pinned === true ? 1 : 0;
      const bPinned = b.pinned === true ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const lastEvaluatedKey = result.LastEvaluatedKey
      ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey))
      : undefined;
    
    return NextResponse.json({
      sessions: items,
      count: result.Count || 0,
      lastEvaluatedKey,
      hasMore: !!result.LastEvaluatedKey,
    });
    
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST - Create or update a chat session
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const rawBody = await safeParseJson(request);
    if (rawBody === null) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = sessionPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;
    const { sessionId, title, mode, messages, message, isNewMessage, ownerUserId: requestedOwnerUserId, shareCode, pinned, tags, branches } = body;
    
    const now = new Date().toISOString();
    
    // Determine the actual owner for shared sessions
    let effectiveUserId = userId;
    if (requestedOwnerUserId && requestedOwnerUserId !== userId && shareCode) {
      // Verify user is a participant in this shared session
      const shareResult = await docClient.send(new GetCommand({
        TableName: SHARE_TABLE,
        Key: { shareCode },
      }));
      
      const isParticipant = shareResult.Item?.participants?.some(
        (p: { userId: string }) => p.userId === userId
      );
      
      if (isParticipant) {
        effectiveUserId = requestedOwnerUserId;
      }
    }
    
    // Create new session
    if (!sessionId) {
      const newSessionId = uuidv4();
      
      // Generate title from first message
      const firstMessage = messages?.[0]?.content || message || 'Ny chatt';
      const autoTitle = title || firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
      
      const newSession: ChatSession = {
        userId,
        sessionId: newSessionId,
        title: autoTitle,
        mode: mode || 'claude',
        messages: messages || [],
        createdAt: now,
        updatedAt: now,
      };
      
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newSession,
      }));
      
      return NextResponse.json(newSession);
    }
    
    // Build a single consolidated update to avoid race conditions
    const updateExprParts: string[] = ['updatedAt = :now'];
    const removeExprParts: string[] = [];
    const exprValues: Record<string, unknown> = { ':now': now };

    if (isNewMessage && message) {
      // Append a new message
      updateExprParts.push('messages = list_append(messages, :newMessage)');
      exprValues[':newMessage'] = [message];
    } else if (messages) {
      // Replace all messages (main thread)
      updateExprParts.push('messages = :messages');
      updateExprParts.push('title = :title');
      exprValues[':messages'] = messages;
      exprValues[':title'] = title || 'Chatt';
    }

    if (Array.isArray(branches)) {
      updateExprParts.push('branches = :branches');
      exprValues[':branches'] = branches;
    }

    if (Array.isArray(tags)) {
      updateExprParts.push('tags = :tags');
      exprValues[':tags'] = tags;
    }

    if (typeof pinned === 'boolean') {
      updateExprParts.push('pinned = :pinned');
      exprValues[':pinned'] = pinned;
      if (pinned) {
        updateExprParts.push('pinnedAt = :pinnedAt');
        exprValues[':pinnedAt'] = now;
      } else {
        removeExprParts.push('pinnedAt');
      }
    }

    if (typeof title === 'string' && title.trim() && !messages && !isNewMessage) {
      updateExprParts.push('title = :title');
      exprValues[':title'] = title.trim();
    }

    let updateExpression = 'SET ' + updateExprParts.join(', ');
    if (removeExprParts.length > 0) {
      updateExpression += ' REMOVE ' + removeExprParts.join(', ');
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userId: effectiveUserId, sessionId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: exprValues,
    }));
    
    // Fetch and return updated session
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { userId: effectiveUserId, sessionId },
    }));
    
    return NextResponse.json(result.Item);
    
  } catch (error) {
    console.error('Error saving chat session:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

// DELETE - Delete a chat session
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }
    
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userId, sessionId },
    }));
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
