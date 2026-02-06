import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { getUserProfile, upsertUserProfile } from '@/lib/profile/profileStore';

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

  try {
    const profile = (await getUserProfile(user.sub)) || (await upsertUserProfile(user.sub, {
      email: user.email,
      displayName: user.name,
    }));

    return NextResponse.json({
      sub: profile.sub,
      email: profile.email,
      displayName: profile.displayName,
      title: profile.title,
      avatarKey: profile.avatarKey,
      avatarUpdatedAt: profile.avatarUpdatedAt,
      updatedAt: profile.updatedAt,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    // Return basic profile from token if DynamoDB fails
    return NextResponse.json({
      sub: user.sub,
      email: user.email,
      displayName: user.name,
      title: null,
      avatarKey: null,
      avatarUpdatedAt: null,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function PUT(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const patch: any = {};
  if (typeof body.displayName === 'string') patch.displayName = body.displayName;
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.email === 'string') patch.email = body.email;

  // Avatar is set by the avatar route; but allow explicit set if needed.
  if (typeof body.avatarKey === 'string') patch.avatarKey = body.avatarKey;
  if (typeof body.avatarUpdatedAt === 'string') patch.avatarUpdatedAt = body.avatarUpdatedAt;

  const profile = await upsertUserProfile(user.sub, {
    ...patch,
    email: patch.email ?? user.email,
  });

  return NextResponse.json(profile);
}


