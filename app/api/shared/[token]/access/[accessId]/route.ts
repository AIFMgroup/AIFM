import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { sharedLinkServiceV2 } from '@/lib/dataRooms/sharedLinkServiceV2';
import { ndaServiceV2 } from '@/lib/dataRooms/ndaServiceV2';
import { dataRoomStore, generateDownloadUrl, generateViewUrl } from '@/lib/dataRooms/dataRoomService';
import { activityLogService } from '@/lib/dataRooms/activityLogService';
import { applyPdfWatermark } from '@/lib/dataRooms/watermarkService';
import { s3Client, S3_BUCKET } from '@/lib/dataRooms/s3';
import { getItem, updateItem } from '@/lib/dataRooms/persistence';
import { getSession } from '@/lib/auth/session';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ token: string; accessId: string }>;
}

type AccessRecord = {
  pk: string;
  sk: string;
  ttl: number;
  createdAt: string;
  consumedAt?: string;
  linkId: string;
  roomId: string;
  sharedToken: string;
  documentId: string;
  action: 'view' | 'download';
  identity: { userName: string; userEmail?: string; verified: boolean };
  watermarkApplied: boolean;
  watermarkTrackingCode?: string;
};

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream || typeof stream !== 'object' || !(Symbol.asyncIterator in stream)) {
    throw new Error('Unsupported S3 Body stream type');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array | Buffer | string>) {
    if (Buffer.isBuffer(chunk)) chunks.push(chunk);
    else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk));
    else chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function safeFilename(name: string): string {
  // Very small sanitation; avoid CRLF/header injection + weird quotes.
  return String(name || 'document').replace(/[\r\n"]/g, '').trim() || 'document';
}

function hashExternalUserId(email?: string): string {
  const v = (email || 'unknown').toLowerCase().trim();
  return crypto.createHash('sha256').update(v).digest('hex').slice(0, 16);
}

/**
 * GET /api/shared/[token]/access/[accessId]
 * Streams/redirects the actual content after server-side validation in POST created a short-lived access record.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token, accessId } = await params;

    const rec = await getItem<AccessRecord>({ pk: `SLINKACCESS#${accessId}`, sk: 'META' });
    if (!rec || rec.sharedToken !== token) {
      return NextResponse.json({ error: 'Access not found' }, { status: 404 });
    }

    if (rec.consumedAt) {
      return NextResponse.json({ error: 'Access already used' }, { status: 410 });
    }

    // Mark consumed (best-effort; prevents accidental double downloads)
    try {
      await updateItem(
        { pk: `SLINKACCESS#${accessId}`, sk: 'META' },
        'SET consumedAt = :ts',
        { ':ts': new Date().toISOString() }
      );
    } catch (e) {
      // If update fails, continue; TTL still limits exposure.
      console.warn('[SharedAccess] failed to mark consumed:', e);
    }

    // Re-check link still exists + is not expired/revoked/exhausted (skip NDA here; we enforce it ourselves)
    const validation = await sharedLinkServiceV2.validateLink(token, {
      userEmail: rec.identity.userEmail,
      skipNdaCheck: true,
    });
    if (!validation.valid || !validation.link) {
      return NextResponse.json({ error: validation.error || 'forbidden' }, { status: 403 });
    }
    const link = validation.link;

    // Enforce NDA again (defense in depth, handles revocation/expiration)
    if (link.requireNda) {
      if (!rec.identity.userEmail) return NextResponse.json({ error: 'nda_required' }, { status: 403 });
      const v = await ndaServiceV2.verifyNdaAccess(link.roomId, rec.identity.userEmail);
      if (!v.valid) return NextResponse.json({ error: 'nda_required' }, { status: 403 });
    }

    const room = await dataRoomStore.getRoomById(link.roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // Verify document is accessible through this link
    if (link.documentId && link.documentId !== rec.documentId) {
      return NextResponse.json({ error: 'Document not accessible through this link' }, { status: 403 });
    }

    const document = await dataRoomStore.getDocumentById(rec.documentId, link.roomId);
    if (!document || document.roomId !== link.roomId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Permission enforcement
    if (rec.action === 'download' && !link.permissions.canDownload) {
      return NextResponse.json({ error: 'Downloads not allowed' }, { status: 403 });
    }
    if (rec.action === 'view' && !link.permissions.canView) {
      return NextResponse.json({ error: 'Viewing not allowed' }, { status: 403 });
    }

    // Identity (verified session overrides external identity if present)
    const session = await getSession().catch(() => null);
    const actor = session?.email
      ? {
          userId: session.email,
          userName: session.name || session.email,
          userEmail: session.email,
          verified: true,
        }
      : {
          userId: `external_unverified:${hashExternalUserId(rec.identity.userEmail)}`,
          userName: rec.identity.userName || 'Gäst',
          userEmail: rec.identity.userEmail || '',
          verified: false,
        };

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Log activity + stats only when the file is actually delivered
    activityLogService.logActivity({
      roomId: link.roomId,
      documentId: document.id,
      documentName: document.name,
      userId: actor.userId,
      userName: actor.userName,
      userEmail: actor.userEmail,
      action: rec.action === 'download' ? 'DOWNLOAD_DOCUMENT' : 'VIEW_DOCUMENT',
      accessMethod: actor.verified ? 'shared_link' : 'shared_link' as const,
      sharedLinkId: link.id,
      watermarkApplied: !!rec.watermarkApplied,
      watermarkTrackingCode: rec.watermarkTrackingCode,
      ipAddress,
      userAgent,
    });

    if (rec.action === 'view') {
      await dataRoomStore.incrementDocumentViews(document.id, link.roomId, actor.userName);
    } else {
      await dataRoomStore.incrementDocumentDownloads(document.id, link.roomId);
    }

    const isPdf =
      document.fileType?.toLowerCase().includes('pdf') ||
      document.fileName?.toLowerCase().endsWith('.pdf') ||
      document.name?.toLowerCase().endsWith('.pdf');

    // If watermark applies and it's a PDF, stream a watermarked copy
    if (rec.watermarkApplied && isPdf) {
      const obj = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: document.s3Key }));
      if (!obj.Body) return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });

      const originalBytes = await streamToBuffer(obj.Body);
      const watermarked = await applyPdfWatermark(new Uint8Array(originalBytes), {
        userName: actor.userName,
        userEmail: actor.userEmail || '',
        companyName: room.fundName || undefined,
        accessTimestamp: new Date(),
        roomName: room.name,
        documentId: document.id,
        pattern: 'diagonal',
      });

      const filename = safeFilename(document.fileName || 'document.pdf');
      const disposition = rec.action === 'download' ? 'attachment' : 'inline';
      return new NextResponse(Buffer.from(watermarked), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Otherwise redirect to a presigned URL (view/download)
    const url =
      rec.action === 'download'
        ? await generateDownloadUrl(document.s3Key, document.fileName)
        : await generateViewUrl(document.s3Key);

    const resp = NextResponse.redirect(url, 302);
    resp.headers.set('Cache-Control', 'no-store');
    return resp;
  } catch (error) {
    console.error('[SharedAccess] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


