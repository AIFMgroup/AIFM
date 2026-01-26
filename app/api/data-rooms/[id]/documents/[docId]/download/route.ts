import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, generateDownloadUrl, generateViewUrl } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

/**
 * GET /api/data-rooms/[id]/documents/[docId]/download
 * Get a presigned URL to download a document
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, docId } = await params;
    const { searchParams } = new URL(request.url);
    const viewOnly = searchParams.get('view') === 'true';

    // Require DOWNLOAD permission (or VIEW if viewOnly)
    await requireRoomPermission(request, id, viewOnly ? 'view' : 'download');

    const session = await getSession().catch(() => null);
    const requestedBy = session?.name || session?.email || 'Unknown';
    const requestedEmail = session?.email || 'unknown@aifm';
    const watermarkRequested = searchParams.get('watermark') === 'true';

    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json(
        { error: 'Data room not found' },
        { status: 404 }
      );
    }

    // Check if downloads are enabled for non-view requests
    if (!viewOnly && !room.downloadEnabled) {
      return NextResponse.json(
        { error: 'Downloads are disabled for this data room' },
        { status: 403 }
      );
    }

    const document = await dataRoomStore.getDocumentById(docId, id);
    if (!document || document.roomId !== id) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const isPdf =
      document.fileType?.toLowerCase().includes('pdf') ||
      document.fileName?.toLowerCase().endsWith('.pdf') ||
      document.name?.toLowerCase().endsWith('.pdf');

    const shouldWatermark = !viewOnly && isPdf && (watermarkRequested || room.watermark);

    if (shouldWatermark) {
      // Avoid leaking PII in URLs; the watermarked endpoint derives identity from session.
      const url = `/api/data-rooms/${id}/documents/${docId}/download/watermarked`;
      return NextResponse.json({ url });
    }

    // Generate URL
    const url = viewOnly
      ? await generateViewUrl(document.s3Key)
      : await generateDownloadUrl(document.s3Key, document.fileName);

    // Update stats and log activity
    if (viewOnly) {
      await dataRoomStore.incrementDocumentViews(docId, id, requestedBy);
      await dataRoomStore.logActivity({
        roomId: id,
        userId: requestedEmail,
        userName: requestedBy,
        action: 'VIEW',
        targetType: 'DOCUMENT',
        targetId: docId,
        targetName: document.name,
      });
    } else {
      await dataRoomStore.incrementDocumentDownloads(docId, id);
      await dataRoomStore.logActivity({
        roomId: id,
        userId: requestedEmail,
        userName: requestedBy,
        action: 'DOWNLOAD',
        targetType: 'DOCUMENT',
        targetId: docId,
        targetName: document.name,
      });
    }

    return NextResponse.json({ url });

  } catch (error) {
    console.error('Generate download URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


