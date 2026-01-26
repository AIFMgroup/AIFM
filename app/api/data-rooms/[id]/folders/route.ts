import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/folders
 * List all folders in a data room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const folders = await dataRoomStore.getFoldersByRoom(id);

    return NextResponse.json({ folders });

  } catch (error) {
    console.error('Get folders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms/[id]/folders
 * Create a new folder in a data room
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require UPLOAD permission (folders are part of organizing uploads)
    await requireRoomPermission(request, id, 'upload');

    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'System';
    const actorId = session?.email || 'system';

    const { name, parentId } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    const newFolder = await dataRoomStore.createFolder({
      roomId: id,
      name,
      parentId: parentId || undefined,
    });

    // Log activity
    await dataRoomStore.logActivity({
      roomId: id,
      userId: actorId,
      userName: actorName,
      action: 'CREATE_FOLDER',
      targetType: 'FOLDER',
      targetId: newFolder.id,
      targetName: newFolder.name,
    });

    return NextResponse.json({ folder: newFolder }, { status: 201 });

  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


