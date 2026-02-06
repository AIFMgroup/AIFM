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
    
    // List all sessions for user (sorted by most recent)
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    }));
    
    const items = (result.Items || []) as ChatSession[];
    // Sort: pinned first, then by updatedAt descending
    items.sort((a, b) => {
      const aPinned = a.pinned === true ? 1 : 0;
      const bPinned = b.pinned === true ? 1 : 0;
      if (bPinned !== aPinned) return bPinned - aPinned;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    
    return NextResponse.json({
      sessions: items,
      count: result.Count || 0,
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
    
    const body = await request.json();
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
    
    // Update existing session
    if (isNewMessage && message) {
      // Add new message to existing session
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId: effectiveUserId, sessionId },
        UpdateExpression: 'SET messages = list_append(messages, :newMessage), updatedAt = :now',
        ExpressionAttributeValues: {
          ':newMessage': [message],
          ':now': now,
        },
      }));
    } else if (messages) {
      // Replace all messages (main thread)
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId: effectiveUserId, sessionId },
        UpdateExpression: 'SET messages = :messages, updatedAt = :now, title = :title',
        ExpressionAttributeValues: {
          ':messages': messages,
          ':now': now,
          ':title': title || 'Chatt',
        },
      }));
    }
    if (Array.isArray(branches)) {
      // Store/update branches (conversation forks)
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId: effectiveUserId, sessionId },
        UpdateExpression: 'SET branches = :branches, updatedAt = :now',
        ExpressionAttributeValues: {
          ':branches': branches,
          ':now': now,
        },
      }));
    }
    if (Array.isArray(tags)) {
      // Update tags only
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { userId: effectiveUserId, sessionId },
        UpdateExpression: 'SET tags = :tags, updatedAt = :now',
        ExpressionAttributeValues: {
          ':tags': tags,
          ':now': now,
        },
      }));
    } else if (typeof pinned === 'boolean') {
      // Toggle pinned only
      if (pinned) {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { userId: effectiveUserId, sessionId },
          UpdateExpression: 'SET pinned = :pinned, pinnedAt = :pinnedAt, updatedAt = :now',
          ExpressionAttributeValues: {
            ':pinned': true,
            ':pinnedAt': now,
            ':now': now,
          },
        }));
      } else {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { userId: effectiveUserId, sessionId },
          UpdateExpression: 'SET pinned = :pinned, updatedAt = :now REMOVE pinnedAt',
          ExpressionAttributeValues: {
            ':pinned': false,
            ':now': now,
          },
        }));
      }
    }
    
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
