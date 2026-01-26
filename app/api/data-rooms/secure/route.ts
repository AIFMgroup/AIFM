/**
 * Secure Data Room API
 * 
 * Enterprise-grade document sharing with:
 * - Watermarking
 * - Expiring links
 * - Viewer permissions
 * - Full access logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildTenantContext } from '@/lib/tenancy/tenantContext';
import { secureDataRoomService, type SecureDataRoom, type ViewerPermissions } from '@/lib/dataRooms/secureDataRoomService';

// ============================================================================
// GET - Get data rooms, documents, viewers, or access logs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'rooms';
    const companyId = searchParams.get('companyId');
    const roomId = searchParams.get('roomId');
    const documentId = searchParams.get('documentId');

    const userId = request.headers.get('x-aifm-user') || session.email;
    const tenantId = searchParams.get('tenantId') || request.headers.get('x-aifm-tenant');

    const context = await buildTenantContext({
      userId,
      userEmail: session.email,
      tenantId: tenantId || undefined,
      companyId: companyId || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    if (!context) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    switch (type) {
      case 'rooms': {
        if (!companyId) {
          return NextResponse.json({ error: 'companyId required' }, { status: 400 });
        }
        const rooms = await secureDataRoomService.getDataRoomsForCompany(context, companyId);
        return NextResponse.json({ rooms });
      }

      case 'room': {
        if (!roomId) {
          return NextResponse.json({ error: 'roomId required' }, { status: 400 });
        }
        const room = await secureDataRoomService.getDataRoom(context, roomId);
        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }
        return NextResponse.json({ room });
      }

      case 'access-logs': {
        if (!roomId) {
          return NextResponse.json({ error: 'roomId required' }, { status: 400 });
        }
        
        const logs = await secureDataRoomService.getAccessLogs(context, {
          dataRoomId: roomId,
          documentId: documentId || undefined,
          startDate: searchParams.get('startDate') || undefined,
          endDate: searchParams.get('endDate') || undefined,
          limit: parseInt(searchParams.get('limit') || '100'),
        });
        
        return NextResponse.json({ logs });
      }

      case 'view-url': {
        if (!roomId || !documentId) {
          return NextResponse.json({ error: 'roomId and documentId required' }, { status: 400 });
        }

        const result = await secureDataRoomService.getSecureViewUrl(context, {
          dataRoomId: roomId,
          documentId,
          viewerEmail: session.email,
        });

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('[SecureDataRoom API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create data room, add viewer, upload document, create secure link
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const userId = request.headers.get('x-aifm-user') || session.email;
    const tenantId = body.tenantId || request.headers.get('x-aifm-tenant');

    const context = await buildTenantContext({
      userId,
      userEmail: session.email,
      tenantId: tenantId || undefined,
      companyId: body.companyId || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    if (!context) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    switch (action) {
      case 'create-room': {
        const { companyId, name, description, roomType, watermarkEnabled, downloadEnabled, expiresAt, fundId, fundName, ndaRequired } = body;
        
        if (!companyId || !name) {
          return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
        }

        const room = await secureDataRoomService.createDataRoom(context, {
          companyId,
          name,
          description: description || '',
          type: roomType || 'GENERAL',
          watermarkEnabled: watermarkEnabled !== false,
          downloadEnabled: downloadEnabled !== false,
          expiresAt,
          fundId,
          fundName,
          ndaRequired,
        });

        return NextResponse.json({ success: true, room });
      }

      case 'add-viewer': {
        const { roomId, email, name, company, role, permissions } = body;
        
        if (!roomId || !email) {
          return NextResponse.json({ error: 'roomId and email required' }, { status: 400 });
        }

        const defaultPermissions: ViewerPermissions = {
          canView: true,
          canDownload: permissions?.canDownload ?? true,
          canPrint: permissions?.canPrint ?? true,
          canShare: permissions?.canShare ?? false,
          canUpload: permissions?.canUpload ?? false,
          canDelete: permissions?.canDelete ?? false,
          canManageViewers: permissions?.canManageViewers ?? false,
        };

        const viewer = await secureDataRoomService.addViewer(context, {
          dataRoomId: roomId,
          email,
          name,
          company,
          role: role || 'viewer',
          permissions: defaultPermissions,
        });

        return NextResponse.json({ success: true, viewer });
      }

      case 'revoke-viewer': {
        const { roomId, viewerId } = body;
        
        if (!roomId || !viewerId) {
          return NextResponse.json({ error: 'roomId and viewerId required' }, { status: 400 });
        }

        await secureDataRoomService.revokeViewer(context, roomId, viewerId);
        return NextResponse.json({ success: true });
      }

      case 'get-upload-url': {
        const { roomId, fileName, mimeType } = body;
        
        if (!roomId || !fileName || !mimeType) {
          return NextResponse.json({ error: 'roomId, fileName, and mimeType required' }, { status: 400 });
        }

        const result = await secureDataRoomService.getSignedUploadUrl(context, {
          dataRoomId: roomId,
          fileName,
          mimeType,
        });

        return NextResponse.json(result);
      }

      case 'create-secure-link': {
        const { roomId, documentId, expiresInHours, maxUses, requireEmail, allowedEmails, requirePin, pin, label, permissions } = body;
        
        if (!roomId) {
          return NextResponse.json({ error: 'roomId required' }, { status: 400 });
        }

        const link = await secureDataRoomService.createSecureLink(context, {
          dataRoomId: roomId,
          documentId,
          expiresInHours,
          maxUses,
          requireEmail,
          allowedEmails,
          requirePin,
          pin,
          label,
          permissions,
        });

        return NextResponse.json({ success: true, link });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[SecureDataRoom API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Validate secure link (public endpoint for external access)
// ============================================================================

export async function OPTIONS(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const pin = searchParams.get('pin');
    const email = searchParams.get('email');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const result = await secureDataRoomService.validateSecureLink(
      token,
      pin || undefined,
      email || undefined
    );

    if (!result.valid) {
      return NextResponse.json({ 
        valid: false, 
        error: result.errorReason 
      }, { status: 403 });
    }

    // Don't expose full room details, just what's needed
    return NextResponse.json({
      valid: true,
      roomName: result.room?.name,
      watermarkEnabled: result.room?.watermarkEnabled,
      downloadEnabled: result.link?.permissions.canDownload,
      printEnabled: result.link?.permissions.canPrint,
      expiresAt: result.link?.expiresAt,
    });
  } catch (error) {
    console.error('[SecureDataRoom API] OPTIONS error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


