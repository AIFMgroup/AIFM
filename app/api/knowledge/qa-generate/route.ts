import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { generateQAPairsFromText, saveQAPairsToKnowledge } from '@/lib/knowledge/qaGeneratorService';

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  try {
    const payload = await verifyIdToken(token);
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      name: (payload.name as string | undefined) || (payload.email as string | undefined),
    };
  } catch {
    return null;
  }
}

/**
 * POST /api/knowledge/qa-generate
 * Body: { text: string, maxPairs?: number }
 * Generates Q&A pairs from document text and saves them to the knowledge base.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: string; maxPairs?: number } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length < 200) {
    return NextResponse.json(
      { error: 'text is required and must be at least 200 characters' },
      { status: 400 }
    );
  }

  try {
    const pairs = await generateQAPairsFromText(text, { maxPairs: body.maxPairs ?? 15 });
    const { saved } = await saveQAPairsToKnowledge({
      pairs,
      userId: user.sub,
      userEmail: user.email,
      userName: user.name,
      sourceLabel: 'manually_generated',
    });
    return NextResponse.json({ success: true, generated: pairs.length, saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
