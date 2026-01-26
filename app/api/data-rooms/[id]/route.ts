import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, getTypeLabel } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]
 * Get a specific data room with folders, documents, members, and activities
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const guard = await requireRoomPermission(request, id, 'view');
    if (!guard.ok) return guard.response;
    const room = await dataRoomStore.getRoomById(id);

    if (!room) {
      return NextResponse.json(
        { error: 'Data room not found' },
        { status: 404 }
      );
    }

    // Get related data
    const folders = await dataRoomStore.getFoldersByRoom(id);
    const documents = await dataRoomStore.getDocumentsByRoom(id);
    const members = await dataRoomStore.getMembersByRoom(id);
    const activities = await dataRoomStore.getActivitiesByRoom(id);

    return NextResponse.json({
      room: {
        ...room,
        typeLabel: getTypeLabel(room.type),
      },
      folders,
      documents,
      members,
      activities,
    });

  } catch (error) {
    console.error('Get data room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/data-rooms/[id]
 * Update a data room
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'System';
    const actorId = session?.email || 'system';
    const guard = await requireRoomPermission(request, id, 'manageSettings');
    if (!guard.ok) return guard.response;

    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json(
        { error: 'Data room not found' },
        { status: 404 }
      );
    }

    const updatedRoom = await dataRoomStore.updateRoom(id, {
      name: body.name,
      description: body.description,
      watermark: body.watermark,
      downloadEnabled: body.downloadEnabled,
      status: body.status,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    // Log activity
    await dataRoomStore.logActivity({
      roomId: id,
      userId: actorId,
      userName: actorName,
      action: 'UPDATE_SETTINGS',
      targetType: 'ROOM',
      targetId: id,
      targetName: room.name,
    });

    return NextResponse.json({ room: updatedRoom });

  } catch (error) {
    console.error('Update data room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-rooms/[id]
 * Delete (archive) a data room
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const guard = await requireRoomPermission(request, id, 'manageSettings');
    if (!guard.ok) return guard.response;
    const room = await dataRoomStore.getRoomById(id);

    if (!room) {
      return NextResponse.json(
        { error: 'Data room not found' },
        { status: 404 }
      );
    }

    // Archive instead of hard delete
    await dataRoomStore.updateRoom(id, { status: 'ARCHIVED' });

    return NextResponse.json({ success: true, message: 'Data room archived' });

  } catch (error) {
    console.error('Delete data room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


