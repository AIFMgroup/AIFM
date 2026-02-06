import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { checkRateLimit, getClientId } from '@/lib/security/rateLimiter';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

const MAX_CONVERSATION_LENGTH = 50000;

export async function POST(request: NextRequest) {
  let userId = 'anonymous';
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (token) {
      const payload = await verifyIdToken(token);
      userId = payload.sub as string;
    }
  } catch {
    // continue
  }

  const clientId = userId !== 'anonymous' ? `user:${userId}` : await getClientId();
  const rateLimitResult = await checkRateLimit(clientId, 'ai-chat');
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests', retryAfter: rateLimitResult.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  try {
    const body = await request.json();
    const messages = body.messages as { role: string; content: string }[] | undefined;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Användare' : 'Assistent'}: ${(m.content || '').trim()}`)
      .join('\n\n');
    const truncated = conversationText.length > MAX_CONVERSATION_LENGTH
      ? conversationText.slice(0, MAX_CONVERSATION_LENGTH) + '\n\n[... konversationen är avkortad ...]'
      : conversationText;

    const systemPrompt = `Du är en assistent som sammanfattar konversationer. Svara på svenska.
Uppgift: Sammanfatta konversationen i 3–5 tydliga punkter. Varje punkt ska vara en fullständig mening.
Format: Använd numrerad lista (1. 2. 3. ...). Inga rubriker eller inledningar, bara listan.`;

    const userPrompt = `Sammanfatta följande konversation i 3–5 punkter:\n\n${truncated}`;

    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userPrompt }],
    };

    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    }));

    const decoded = new TextDecoder().decode(response.body);
    const parsed = JSON.parse(decoded);
    const summary = parsed.content?.[0]?.text?.trim() || 'Kunde inte generera sammanfattning.';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[summarize]', error);
    return NextResponse.json({ error: 'Failed to summarize', summary: '' }, { status: 500 });
  }
}
