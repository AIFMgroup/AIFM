import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, generateUploadUrl } from '@/lib/dataRooms/dataRoomService';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/data-rooms/[id]/documents/upload-url
 * Get a presigned URL for uploading a document to S3
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require UPLOAD permission
    await requireRoomPermission(request, id, 'upload');

    const body = await request.json();

    const { fileName, contentType, folderId } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, contentType' },
        { status: 400 }
      );
    }

    // Generate presigned URL for upload
    const { uploadUrl, s3Key } = await generateUploadUrl(id, folderId || null, fileName, contentType);

    return NextResponse.json({ uploadUrl, s3Key });

  } catch (error) {
    console.error('Generate upload URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


