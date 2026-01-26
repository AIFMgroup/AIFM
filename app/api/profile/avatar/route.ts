import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { deleteAvatarObject, getAvatarObject, makeAvatarKey, putAvatarObject } from '@/lib/profile/avatarStorage';
import { getUserProfile, upsertUserProfile } from '@/lib/profile/profileStore';
import { Readable } from 'stream';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  try {
    const payload = await verifyIdToken(token);
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      name: (payload.name as string | undefined) || undefined,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await getUserProfile(user.sub);
  if (!profile?.avatarKey) {
    return NextResponse.json({ error: 'No avatar set' }, { status: 404 });
  }

  try {
    const obj = await getAvatarObject(profile.avatarKey);
    const body = obj.Body;
    if (!body) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });

    const contentType = obj.ContentType || 'application/octet-stream';

    // Convert Node stream to Web stream when needed.
    // Note: TypeScript has multiple ReadableStream types (DOM vs stream/web). We cast to avoid build-time mismatch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream: any =
      typeof (body as any).getReader === 'function'
        ? (body as any)
        : (Readable.toWeb(body as unknown as Readable) as any);

    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    console.error('[Profile Avatar] GET error', err);
    return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
  }

  const profile = await getUserProfile(user.sub);
  const newKey = makeAvatarKey(user.sub, file.name || 'avatar');

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await putAvatarObject({ key: newKey, contentType: file.type, body: bytes });

    // Best-effort delete previous avatar
    if (profile?.avatarKey && profile.avatarKey !== newKey) {
      deleteAvatarObject(profile.avatarKey).catch(() => {});
    }

    const now = new Date().toISOString();
    const updated = await upsertUserProfile(user.sub, {
      email: profile?.email ?? user.email,
      displayName: profile?.displayName ?? user.name,
      avatarKey: newKey,
      avatarUpdatedAt: now,
    });

    return NextResponse.json({
      ok: true,
      avatarKey: updated.avatarKey,
      avatarUpdatedAt: updated.avatarUpdatedAt,
    });
  } catch (err) {
    console.error('[Profile Avatar] POST error', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}


