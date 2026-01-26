import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { dataRoomStore, type DataRoomMember } from '@/lib/dataRooms/dataRoomService';

export type RoomPermissionKey = keyof DataRoomMember['permissions'];

export async function requireRoomPermission(
  request: NextRequest,
  roomId: string,
  required: RoomPermissionKey | RoomPermissionKey[]
): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>>; member: DataRoomMember }
  | { ok: false; response: NextResponse }
> {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const member = await dataRoomStore.getMemberByEmail(roomId, session.email);
  if (!member) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const requiredList = Array.isArray(required) ? required : [required];
  const allowed = requiredList.some((perm) => !!member.permissions?.[perm]);

  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, session, member };
}


