import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { applyPdfWatermark } from '@/lib/dataRooms/watermarkService';
import { s3Client, S3_BUCKET } from '@/lib/dataRooms/s3';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string; docId: string }>;
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream || typeof stream !== 'object' || !(Symbol.asyncIterator in stream)) {
    throw new Error('Unsupported S3 Body stream type');
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array | Buffer | string>) {
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

/**
 * GET /api/data-rooms/[id]/documents/[docId]/download/watermarked
 *
 * Streams a WATERMARKED PDF (server-side).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: roomId, docId } = await params;
    
    // Require DOWNLOAD permission
    await requireRoomPermission(request, roomId, 'download');

    const session = await getSession().catch(() => null);
    const requestedBy = session?.name || session?.email || 'Unknown';
    const requestedEmail = session?.email || 'unknown@aifm';

    const room = await dataRoomStore.getRoomById(roomId);
    if (!room) return NextResponse.json({ error: 'Data room not found' }, { status: 404 });

    // Downloads enabled check
    if (!room.downloadEnabled) {
      return NextResponse.json({ error: 'Downloads are disabled for this data room' }, { status: 403 });
    }

    const document = await dataRoomStore.getDocumentById(docId, roomId);
    if (!document || document.roomId !== roomId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Only watermark PDFs
    const isPdf =
      document.fileType?.toLowerCase().includes('pdf') ||
      document.fileName?.toLowerCase().endsWith('.pdf') ||
      document.name?.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      return NextResponse.json({ error: 'Watermarking only supported for PDF' }, { status: 400 });
    }

    const obj = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: document.s3Key }));
    if (!obj.Body) return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });

    const originalBytes = await streamToBuffer(obj.Body);
    const watermarked = await applyPdfWatermark(new Uint8Array(originalBytes), {
      userName: requestedBy,
      userEmail: requestedEmail,
      companyName: room.fundName || undefined,
      accessTimestamp: new Date(),
      roomName: room.name,
      documentId: document.id,
      pattern: 'diagonal',
    });

    // Log download activity + stats
    await dataRoomStore.incrementDocumentDownloads(docId, roomId);
    await dataRoomStore.logActivity({
      roomId,
      userId: requestedEmail,
      userName: requestedBy,
      action: 'DOWNLOAD',
      targetType: 'DOCUMENT',
      targetId: docId,
      targetName: document.name,
    });

    return new NextResponse(Buffer.from(watermarked), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.fileName || 'document.pdf'}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[DataRooms] Watermarked download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


