import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, getTypeLabel } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';

/**
 * GET /api/data-rooms
 * List all data rooms
 */
export async function GET() {
  try {
    const session = await getSession().catch(() => null);
    if (!session?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const email = session.email;
    const rooms = await dataRoomStore.getAllRooms();

    // Show rooms where user is a member OR where user is the creator
    const memberships = await Promise.all(
      rooms.map(async (r) => {
        const isMember = await dataRoomStore.getMemberByEmail(r.id, email!);
        const isCreator = r.createdBy === email;
        return { room: r, visible: !!isMember || isCreator };
      })
    );
    const visibleRooms = memberships.filter((m) => m.visible).map((m) => m.room);

    const roomsWithLabels = visibleRooms.map(room => ({
      ...room,
      typeLabel: getTypeLabel(room.type),
    }));

    return NextResponse.json({ rooms: roomsWithLabels });

  } catch (error) {
    console.error('Get data rooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms
 * Create a new data room
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { name, description, fundId, fundName, type, watermark, downloadEnabled, expiresAt } = body;
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'System';
    const actorId = session?.email || 'system';
    if (!session?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type' },
        { status: 400 }
      );
    }

    const newRoom = await dataRoomStore.createRoom({
      name,
      description: description || '',
      fundId: fundId || 'auag-silver-bullet',
      fundName: fundName || 'AuAg Silver Bullet',
      type,
      status: 'ACTIVE',
      createdBy: actorName,
      watermark: watermark ?? false,
      downloadEnabled: downloadEnabled ?? true,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      ownerEmail: session.email,
      ownerUserId: session.email,
      ownerName: actorName,
    });

    // Log activity
    await dataRoomStore.logActivity({
      roomId: newRoom.id,
      userId: actorId,
      userName: actorName,
      action: 'UPDATE_SETTINGS',
      targetType: 'ROOM',
      targetId: newRoom.id,
      targetName: newRoom.name,
    });

    return NextResponse.json({ room: newRoom }, { status: 201 });

  } catch (error) {
    console.error('Create data room error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


