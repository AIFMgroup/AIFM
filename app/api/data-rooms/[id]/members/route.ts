import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, getRolePermissions } from '@/lib/dataRooms/dataRoomService';
import { sendDataRoomInviteEmail } from '@/lib/dataRooms/emailService';
import { getSession } from '@/lib/auth/session';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/members
 * List all members in a data room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const members = await dataRoomStore.getMembersByRoom(id);

    return NextResponse.json({ members });

  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms/[id]/members
 * Invite a new member to a data room
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Require INVITE permission
    await requireRoomPermission(request, id, 'invite');

    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorName = session?.name || session?.email || 'System';
    const actorId = session?.email || 'system';

    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json(
        { error: 'Data room not found' },
        { status: 404 }
      );
    }

    const { email, name, role, company, expiresAt } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, role' },
        { status: 400 }
      );
    }

    // Check if member already exists
    const existingMember = await dataRoomStore.getMemberByEmail(id, email);
    if (existingMember) {
      return NextResponse.json(
        { error: 'Member with this email already exists in this data room' },
        { status: 409 }
      );
    }

    // Get permissions based on role
    const permissions = getRolePermissions(role);

    const newMember = await dataRoomStore.createMember({
      roomId: id,
      userId: `user-${email.split('@')[0]}`,
      name: name || email.split('@')[0],
      email,
      company,
      role,
      permissions,
      invitedBy: actorName,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Best-effort email invite (no hard failure)
    await sendDataRoomInviteEmail({
      toEmail: email,
      toName: newMember.name,
      roomId: id,
      roomName: room.name,
      invitedBy: actorName,
      role,
      expiresAt,
    });

    // Log activity
    await dataRoomStore.logActivity({
      roomId: id,
      userId: actorId,
      userName: actorName,
      action: 'INVITE',
      targetType: 'MEMBER',
      targetId: newMember.id,
      targetName: newMember.name,
    });

    return NextResponse.json({ member: newMember }, { status: 201 });

  } catch (error) {
    console.error('Invite member error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}


