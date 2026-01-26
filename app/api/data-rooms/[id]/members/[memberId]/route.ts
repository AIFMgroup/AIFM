import { NextRequest, NextResponse } from 'next/server';
import { dataRoomStore, getRolePermissions } from '@/lib/dataRooms/dataRoomService';
import { requireRoomPermission } from '@/lib/dataRooms/roomAuth';

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

/**
 * GET /api/data-rooms/[id]/members/[memberId]
 * Get a specific member
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params;
    
    // Require VIEW permission
    await requireRoomPermission(request, id, 'view');

    const member = await dataRoomStore.getMemberById(memberId, id);
    if (!member || member.roomId !== id) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ member });

  } catch (error) {
    console.error('Get member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/data-rooms/[id]/members/[memberId]
 * Update a member's role or permissions
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params;
    
    // Require MANAGE_SETTINGS permission (managing members is an admin action)
    await requireRoomPermission(request, id, 'manageSettings');

    const body = await request.json();

    const member = await dataRoomStore.getMemberById(memberId, id);
    if (!member || member.roomId !== id) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Can't change owner role
    if (member.role === 'OWNER' && body.role && body.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot change owner role' },
        { status: 403 }
      );
    }

    // Update permissions based on new role if provided
    const permissions = body.role ? getRolePermissions(body.role) : member.permissions;

    const updatedMember = await dataRoomStore.updateMember(memberId, id, {
      role: body.role || member.role,
      permissions: body.permissions || permissions,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : member.expiresAt,
    });

    return NextResponse.json({ member: updatedMember });

  } catch (error) {
    console.error('Update member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-rooms/[id]/members/[memberId]
 * Remove a member from a data room
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, memberId } = await params;
    
    // Require MANAGE_SETTINGS permission
    await requireRoomPermission(request, id, 'manageSettings');

    const member = await dataRoomStore.getMemberById(memberId, id);
    if (!member || member.roomId !== id) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Can't remove owner
    if (member.role === 'OWNER') {
      return NextResponse.json(
        { error: 'Cannot remove owner from data room' },
        { status: 403 }
      );
    }

    await dataRoomStore.deleteMember(memberId, id);

    return NextResponse.json({ success: true, message: 'Member removed' });

  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


