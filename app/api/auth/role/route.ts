import { NextResponse } from 'next/server';
import { headers, cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';

export async function GET() {
  const h = await headers();
  const role = (h.get('x-aifm-role') || 'unknown').toLowerCase();

  let email: string | null = null;
  let name: string | null = null;
  const token = (await cookies()).get('__Host-aifm_id_token')?.value;
  if (token) {
    try {
      const payload = await verifyIdToken(token);
      email = (payload.email as string) ?? (payload['cognito:username'] as string) ?? null;
      name = (payload.name as string) ?? (payload['custom:name'] as string) ?? null;
    } catch {
      // token invalid or expired; role still from header
    }
  }

  return NextResponse.json({ role, email, name });
}


