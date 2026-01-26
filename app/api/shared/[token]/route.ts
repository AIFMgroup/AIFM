import { NextRequest, NextResponse } from 'next/server';
import { sharedLinkServiceV2 } from '@/lib/dataRooms/sharedLinkServiceV2';
import { ndaServiceV2 } from '@/lib/dataRooms/ndaServiceV2';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { generateTrackingCode } from '@/lib/dataRooms/watermarkService';
import { putItem } from '@/lib/dataRooms/persistence';
import { getSession } from '@/lib/auth/session';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders, RateLimitPresets } from '@/lib/rateLimit';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/shared/[token]
 * Access a shared link - returns link info and validates access
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    
    // Rate limit: 60 requests per hour per token
    const rateLimitResult = checkRateLimit(token, RateLimitPresets.SHARED_LINK);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email') || undefined;
    const password = searchParams.get('password') || undefined;

    // Validate the link
    const validation = await sharedLinkServiceV2.validateLink(token, {
      userEmail,
      password,
      // NDA is enforced server-side using ndaServiceV2.verifyNdaAccess (not client-asserted).
      skipNdaCheck: true,
    });

    if (!validation.valid) {
      // Log failed access attempt
      if (validation.link) {
        await sharedLinkServiceV2.logAccess(validation.link.id, {
          userEmail,
          success: false,
          failureReason: validation.error,
        });
      }

      return NextResponse.json({
        valid: false,
        error: validation.error,
        // Even if the validation failed early (e.g. wrong_email), expose what the link requires so the UI can guide the user.
        requiresPassword: validation.requiresPassword ?? validation.link?.requirePassword ?? false,
        requiresNda: validation.requiresNda ?? validation.link?.requireNda ?? false,
        ndaTemplateId: validation.ndaTemplateId ?? validation.link?.ndaTemplateId,
      }, { 
        status: validation.error === 'not_found' ? 404 : 403,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }

    const link = validation.link!;
    const room = await dataRoomStore.getRoomById(link.roomId);
    
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Log successful access
    await sharedLinkServiceV2.logAccess(link.id, {
      userEmail,
      success: true,
    });

    // Get documents to share
    const allDocuments = await dataRoomStore.getDocumentsByRoom(link.roomId);
    let documents = [] as typeof allDocuments;
    
    if (link.documentId) {
      // Single document
      const doc = await dataRoomStore.getDocumentById(link.documentId, link.roomId);
      if (doc) documents = [doc];
    } else if (link.folderId) {
      // Folder documents
      documents = allDocuments.filter(d => d.folderId === link.folderId);
    } else {
      // All documents
      documents = allDocuments;
    }

    // Get NDA info if required + compute if the user has a valid NDA grant (if we have an email)
    let ndaInfo = null;
    let ndaVerified = false;
    if (link.requireNda) {
      const template = await ndaServiceV2.getActiveTemplateForRoom(link.roomId);
      if (template) {
        ndaInfo = {
          templateId: template.id,
          name: template.name,
          requireSignature: template.requireSignature,
          requireInitials: template.requireInitials,
          requireFullName: template.requireFullName,
          requireEmail: template.requireEmail,
          requireCompany: template.requireCompany,
          requireTitle: template.requireTitle,
        };
      }
      if (userEmail) {
        const v = await ndaServiceV2.verifyNdaAccess(link.roomId, userEmail);
        ndaVerified = !!v.valid;
      }
    }

    return NextResponse.json({
      valid: true,
      link: {
        id: link.id,
        roomId: link.roomId,
        roomName: room.name,
        roomDescription: room.description,
        expiresAt: link.expiresAt,
        permissions: link.permissions,
        recipientName: link.recipientName,
        recipientCompany: link.recipientCompany,
        requireNda: link.requireNda,
      },
      documents: documents.map(d => ({
        id: d.id,
        name: d.name,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize,
      })),
      ndaInfo,
      ndaVerified,
    });

  } catch (error) {
    console.error('Shared link access error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shared/[token]
 * Access document through shared link (view/download)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    
    // Rate limit: 60 requests per hour per token
    const rateLimitResult = checkRateLimit(token, RateLimitPresets.SHARED_LINK);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const body = await request.json();

    const validation = await sharedLinkServiceV2.validateLink(token, {
      userEmail: body.userEmail,
      password: body.password,
      // NDA is enforced server-side using ndaServiceV2.verifyNdaAccess (not client-asserted).
      skipNdaCheck: true,
    });

    if (!validation.valid) {
      return NextResponse.json({
        valid: false,
        error: validation.error,
      }, { 
        status: 403,
        headers: getRateLimitHeaders(rateLimitResult),
      });
    }

    const link = validation.link!;
    const { documentId, action, userName, userEmail } = body as {
      documentId: string;
      action: 'view' | 'download';
      userName?: string;
      userEmail?: string;
      password?: string;
    };

    // If the caller is authenticated, prefer verified session identity for watermark/logging.
    const session = await getSession().catch(() => null);
    const verifiedIdentity = session?.email
      ? {
          userName: session.name || session.email,
          userEmail: session.email,
          verified: true as const,
        }
      : null;

    const externalIdentity = {
      userName: (userName || '').trim() || 'Gäst',
      userEmail: (userEmail || '').trim().toLowerCase() || undefined,
      verified: false as const,
    };

    const identity = verifiedIdentity || externalIdentity;

    // Verify document is accessible through this link
    if (link.documentId && link.documentId !== documentId) {
      return NextResponse.json({ error: 'Document not accessible through this link' }, { status: 403 });
    }

    const document = await dataRoomStore.getDocumentById(documentId, link.roomId);
    if (!document || document.roomId !== link.roomId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check permissions
    if (action === 'download' && !link.permissions.canDownload) {
      return NextResponse.json({ error: 'Downloads not allowed' }, { status: 403 });
    }

    if (action === 'view' && !link.permissions.canView) {
      return NextResponse.json({ error: 'Viewing not allowed' }, { status: 403 });
    }

    // Enforce NDA server-side (do not trust client "ndaSigned")
    if (link.requireNda) {
      if (!identity.userEmail) {
        return NextResponse.json({ error: 'nda_required', requiresNda: true }, { status: 403 });
      }
      const v = await ndaServiceV2.verifyNdaAccess(link.roomId, identity.userEmail);
      if (!v.valid) {
        return NextResponse.json({ error: 'nda_required', requiresNda: true }, { status: 403 });
      }
    }

    // Create short-lived access grant (so we avoid putting password/PII in URLs)
    const now = Date.now();
    const accessId = `slink-access-${crypto.randomUUID()}`;
    const ttlSeconds = Math.floor(now / 1000) + 5 * 60; // 5 minutes

    const watermarkTrackingCode = link.permissions.applyWatermark
      ? generateTrackingCode({
          userName: identity.userName,
          userEmail: identity.userEmail || 'unknown',
          accessTimestamp: new Date(),
          documentId,
        })
      : undefined;

    await putItem({
      pk: `SLINKACCESS#${accessId}`,
      sk: 'META',
      ttl: ttlSeconds,
      createdAt: new Date(now).toISOString(),
      linkId: link.id,
      roomId: link.roomId,
      sharedToken: token,
      documentId,
      action,
      identity: {
        userName: identity.userName,
        userEmail: identity.userEmail,
        verified: identity.verified,
      },
      watermarkApplied: !!link.permissions.applyWatermark,
      watermarkTrackingCode,
    }, 'attribute_not_exists(pk) AND attribute_not_exists(sk)');

    return NextResponse.json({
      url: `/api/shared/${token}/access/${accessId}`,
      watermarkTrackingCode,
      watermarkApplied: !!link.permissions.applyWatermark,
    });

  } catch (error) {
    console.error('Shared document access error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







