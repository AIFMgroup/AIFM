import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/documents
 * List all documents in a data room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    const documents = folderId
      ? await dataRoomStore.getDocumentsByFolder(folderId, id)
      : await dataRoomStore.getDocumentsByRoom(id);

    return NextResponse.json({ documents });

  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms/[id]/documents
 * Create a new document (after uploading to S3)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require UPLOAD permission
    await requireRoomPermission(request, id, 'upload');

    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'Unknown';
    const actorId = session?.email || 'system';

    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json(
        { error: 'Data room not found' },
        { status: 404 }
      );
    }

    const { name, fileName, fileType, fileSize, folderId, s3Key } = body;

    if (!name || !fileName || !fileType || !fileSize || !s3Key) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const newDocument = await dataRoomStore.createDocument({
      roomId: id,
      name,
      fileName,
      fileType,
      fileSize,
      folderId: folderId || undefined,
      s3Key,
      uploadedBy: actorName,
      watermarked: room.watermark,
    });

    // Log activity
    await dataRoomStore.logActivity({
      roomId: id,
      userId: actorId,
      userName: actorName,
      action: 'UPLOAD',
      targetType: 'DOCUMENT',
      targetId: newDocument.id,
      targetName: newDocument.name,
    });

    return NextResponse.json({ document: newDocument }, { status: 201 });

  } catch (error) {
    console.error('Create document error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


