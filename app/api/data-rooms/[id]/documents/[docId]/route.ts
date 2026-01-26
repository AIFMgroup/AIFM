import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, deleteFromS3 } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

/**
 * GET /api/data-rooms/[id]/documents/[docId]
 * Get a specific document
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, docId } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const document = await dataRoomStore.getDocumentById(docId, id);
    if (!document || document.roomId !== id) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ document });

  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-rooms/[id]/documents/[docId]
 * Delete a document
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, docId } = await params;
    
    // Require DELETE permission
    await requireRoomPermission(request, id, 'delete');

    const session = await getSession().catch(() => null);
    const deletedBy = session?.name || session?.email || 'Unknown';
    const actorId = session?.email || 'system';

    const document = await dataRoomStore.getDocumentById(docId, id);
    if (!document || document.roomId !== id) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Try to delete from S3
    try {
      await deleteFromS3(document.s3Key);
    } catch (s3Error) {
      console.warn('Failed to delete from S3:', s3Error);
      // Continue with metadata deletion even if S3 fails
    }

    // Delete from store (soft delete)
    await dataRoomStore.deleteDocument(docId, id);

    // Log activity
    await dataRoomStore.logActivity({
      roomId: id,
      userId: actorId,
      userName: deletedBy,
      action: 'DELETE',
      targetType: 'DOCUMENT',
      targetId: docId,
      targetName: document.name,
    });

    return NextResponse.json({ success: true, message: 'Document deleted' });

  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


