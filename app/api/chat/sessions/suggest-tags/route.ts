import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { cookies } from 'next/headers';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sub || payload.email || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const messages = body.messages as { role: string; content: string }[] | undefined;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Användare' : 'Assistent'}: ${(m.content || '').slice(0, 500)}`)
      .join('\n\n');
    const truncated = conversationText.slice(0, 4000);

    const systemPrompt = 'Du är en assistent som föreslår taggar för konversationer. Svara ENDAST med 3–5 korta taggar på svenska (ett ord vardera), separerade med kommatecken. Inga förklaringar.';
    const userPrompt = `Föreslå taggar för denna konversation:\n\n${truncated}`;

    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user' as const, content: userPrompt }],
    };

    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: 'eu.anthropic.claude-opus-4-6-v1',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    }));

    const decoded = new TextDecoder().decode(response.body);
    const parsed = JSON.parse(decoded);
    const text = parsed.content?.[0]?.text?.trim() || '';
    const tags = text
      .split(/[,;]/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0 && t.length < 30)
      .slice(0, 5);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('[suggest-tags]', error);
    return NextResponse.json({ error: 'Failed to suggest tags', tags: [] }, { status: 500 });
  }
}
