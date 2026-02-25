import { NextRequest } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { cookies } from 'next/headers';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const SHARE_TABLE = 'aifm-shared-sessions';
const SESSIONS_TABLE = 'aifm-chat-sessions';

const CHECK_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 15000;
const MAX_STREAM_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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

function formatSSE(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

/** GET: SSE stream for shared session updates. Client reconnects when stream closes. */
export async function GET(request: NextRequest) {
  const user = await getUserInfo();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shareCode = searchParams.get('shareCode');
  let since = searchParams.get('since') || '';

  if (!shareCode) {
    return new Response(JSON.stringify({ error: 'shareCode krävs' }), { status: 400 });
  }

  const shareResult = await docClient.send(new GetCommand({
    TableName: SHARE_TABLE,
    Key: { shareCode },
  }));

  if (!shareResult.Item) {
    return new Response(JSON.stringify({ error: 'Delning hittades inte' }), { status: 404 });
  }

  const share = shareResult.Item as {
    shareCode: string;
    sessionId: string;
    ownerUserId: string;
    participants?: Array<{ userId: string }>;
  };

  const isParticipant = share.participants?.some((p: { userId: string }) => p.userId === user.userId);
  if (!isParticipant) {
    return new Response(JSON.stringify({ error: 'Inte behörig' }), { status: 403 });
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let lastHeartbeat = Date.now();

      const run = async () => {
        if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
          controller.enqueue(encoder.encode(formatSSE('close', JSON.stringify({ reason: 'timeout' }))));
          controller.close();
          return;
        }

        try {
          const [sessionResult, shareResult] = await Promise.all([
            docClient.send(new GetCommand({
              TableName: SESSIONS_TABLE,
              Key: { userId: share.ownerUserId, sessionId: share.sessionId },
            })),
            docClient.send(new GetCommand({
              TableName: SHARE_TABLE,
              Key: { shareCode },
            })),
          ]);

          const session = sessionResult.Item as { updatedAt?: string; messages?: unknown[]; title?: string; mode?: string } | undefined;
          const shareLatest = shareResult.Item as { participants?: unknown[]; typingUsers?: Record<string, { name: string; at: string }> } | undefined;
          const typingUsers = shareLatest?.typingUsers || {};
          const fiveSecAgo = new Date(Date.now() - 5000).toISOString();
          const activeTyping = Object.entries(typingUsers)
            .filter(([, v]) => v?.at && v.at > fiveSecAgo)
            .map(([, v]) => ({ name: v?.name || 'Okänd' }));

          if (session?.updatedAt && (!since || session.updatedAt > since)) {
            since = session.updatedAt;
            controller.enqueue(encoder.encode(formatSSE('update', JSON.stringify({
              hasUpdates: true,
              messages: session.messages || [],
              title: session.title,
              mode: session.mode || 'claude',
              participants: shareLatest?.participants ?? share.participants,
              updatedAt: session.updatedAt,
              typingUsers: activeTyping,
            }))));
          } else if (activeTyping.length > 0) {
            controller.enqueue(encoder.encode(formatSSE('typing', JSON.stringify({ typingUsers: activeTyping }))));
          }

          if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
            lastHeartbeat = Date.now();
            controller.enqueue(encoder.encode(': ping\n\n'));
          }
        } catch (err) {
          console.error('[SSE share stream]', err);
          controller.enqueue(encoder.encode(formatSSE('error', JSON.stringify({ message: 'Serverfel' }))));
          controller.close();
          return;
        }

        if (Date.now() - startTime <= MAX_STREAM_DURATION_MS) {
          setTimeout(run, CHECK_INTERVAL_MS);
        } else {
          controller.enqueue(encoder.encode(formatSSE('close', JSON.stringify({ reason: 'timeout' }))));
          controller.close();
        }
      };

      run();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
    },
  });
}
