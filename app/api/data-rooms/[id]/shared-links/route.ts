import { NextRequest, NextResponse } from 'next/server';
import { sharedLinkServiceV2, CreateSharedLinkParams } from '@/lib/dataRooms/sharedLinkServiceV2';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { activityLogService } from '@/lib/dataRooms/activityLogService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/shared-links
 * Get all shared links for a data room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const links = await sharedLinkServiceV2.getLinksByRoom(id);
    
    // Add stats to each link
    const linksWithStats = await Promise.all(links.map(async link => ({
      ...link,
      stats: await sharedLinkServiceV2.getLinkStats(link.id),
    })));

    return NextResponse.json({ links: linksWithStats });

  } catch (error) {
    console.error('Get shared links error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms/[id]/shared-links
 * Create a new shared link
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require SHARE permission
    await requireRoomPermission(request, id, 'manageSettings');

    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'User';
    const actorEmail = session?.email || 'user@aifm.se';
    const actorId = actorEmail || 'system';
    
    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json({ error: 'Data room not found' }, { status: 404 });
    }

    const linkParams: CreateSharedLinkParams = {
      roomId: id,
      documentId: body.documentId,
      folderId: body.folderId,
      createdBy: actorName,
      createdByEmail: actorEmail,
      expiresIn: body.expiresIn || 'days',
      expiresInValue: body.expiresInValue || 7,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      maxUses: body.maxUses,
      recipientEmail: body.recipientEmail,
      recipientName: body.recipientName,
      recipientCompany: body.recipientCompany,
      permissions: body.permissions,
      password: body.password,
      requireNda: body.requireNda,
      ndaTemplateId: body.ndaTemplateId,
    };

    const link = await sharedLinkServiceV2.createLink(linkParams);
    
    // Log activity
    activityLogService.logActivity({
      roomId: id,
      documentId: body.documentId,
      userId: actorId,
      userName: actorName,
      userEmail: actorEmail,
      action: 'SHARE_LINK_CREATED',
      actionDetails: `Link skapad för ${body.recipientEmail || 'vem som helst'}`,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Generate URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.aifm.se';
    const urls = {
      full: sharedLinkServiceV2.getLinkUrl(link, baseUrl),
      short: sharedLinkServiceV2.getShortLinkUrl(link, baseUrl),
    };

    return NextResponse.json({ link, urls }, { status: 201 });

  } catch (error) {
    console.error('Create shared link error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







