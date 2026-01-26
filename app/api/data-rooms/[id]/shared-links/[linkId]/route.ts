import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sharedLinkServiceV2 } from '@/lib/dataRooms/sharedLinkServiceV2';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string; linkId: string }>;
}

/**
 * GET /api/data-rooms/[id]/shared-links/[linkId]
 * Get a specific shared link
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, linkId } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const link = await sharedLinkServiceV2.getLinkById(linkId);
    if (!link || link.roomId !== id) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const stats = await sharedLinkServiceV2.getLinkStats(linkId);

    return NextResponse.json({ link, stats });

  } catch (error) {
    console.error('Get shared link error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/data-rooms/[id]/shared-links/[linkId]
 * Update a shared link
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, linkId } = await params;
    
    // Require SHARE permission (managing links is part of sharing)
    await requireRoomPermission(request, id, 'manageSettings');

    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'User';
    
    let link = await sharedLinkServiceV2.getLinkById(linkId);
    if (!link || link.roomId !== id) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Handle different update types
    if (body.action === 'revoke') {
      const success = await sharedLinkServiceV2.revokeLink(linkId, actorName);
      if (success) {
        link = await sharedLinkServiceV2.getLinkById(linkId);
        return NextResponse.json({ link, message: 'Link revoked' });
      }
      return NextResponse.json({ error: 'Failed to revoke link' }, { status: 500 });
    }

    if (body.action === 'extend' && body.expiresAt) {
      link = await sharedLinkServiceV2.extendLink(linkId, new Date(body.expiresAt));
      if (link) {
        return NextResponse.json({ link, message: 'Link extended' });
      }
      return NextResponse.json({ error: 'Failed to extend link' }, { status: 500 });
    }

    if (body.permissions) {
      link = await sharedLinkServiceV2.updateLinkPermissions(linkId, body.permissions);
      if (link) {
        return NextResponse.json({ link, message: 'Permissions updated' });
      }
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }

    if (body.password !== undefined) {
      link = await sharedLinkServiceV2.updateLinkPassword(linkId, body.password || null);
      if (link) {
        return NextResponse.json({ link, message: 'Password updated' });
      }
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ error: 'No valid update action provided' }, { status: 400 });

  } catch (error) {
    console.error('Update shared link error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-rooms/[id]/shared-links/[linkId]
 * Revoke a shared link
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, linkId } = await params;
    const { searchParams } = new URL(request.url);
    const revokedBy = searchParams.get('revokedBy') || 'User';
    
    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json({ error: 'Data room not found' }, { status: 404 });
    }

    const link = await sharedLinkServiceV2.getLinkById(linkId);
    if (!link || link.roomId !== id) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const success = await sharedLinkServiceV2.revokeLink(linkId, revokedBy);
    if (success) {
      return NextResponse.json({ success: true, message: 'Link revoked' });
    }

    return NextResponse.json({ error: 'Failed to revoke link' }, { status: 500 });

  } catch (error) {
    console.error('Revoke shared link error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







