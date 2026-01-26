import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { activityLogService, ActivityAction } from '@/lib/dataRooms/activityLogService';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { getSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/activity
 * Get detailed activity log for a data room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json({ error: 'Data room not found' }, { status: 404 });
    }

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action') as ActivityAction | null;
    const userId = searchParams.get('userId') || undefined;
    const documentId = searchParams.get('documentId') || undefined;
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;

    // Get activities
    const activities = activityLogService.getActivitiesByRoom(id, {
      limit,
      offset,
      action: action || undefined,
      userId,
      documentId,
      startDate,
      endDate,
    });

    // Get summary if requested
    const includeSummary = searchParams.get('includeSummary') === 'true';
    let summary = null;
    
    if (includeSummary) {
      const summaryStart = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default 30 days
      const summaryEnd = endDate || new Date();
      summary = activityLogService.getActivitySummary(id, summaryStart, summaryEnd);
    }

    // Get user report if user ID is specified
    let userReport = null;
    if (userId) {
      userReport = activityLogService.getUserActivityReport(id, userId);
    }

    return NextResponse.json({
      activities,
      total: activities.length,
      summary,
      userReport,
    });

  } catch (error) {
    console.error('Get activity log error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms/[id]/activity
 * Log a new activity
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const session = await getSession().catch(() => null);
    const actorId = session?.email || 'unknown';
    const actorName = session?.name || session?.email || 'Unknown';
    
    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json({ error: 'Data room not found' }, { status: 404 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    const activity = activityLogService.logActivity({
      roomId: id,
      documentId: body.documentId,
      documentName: body.documentName,
      userId: actorId,
      userName: actorName,
      userEmail: session?.email || '',
      userCompany: undefined,
      action: body.action,
      actionDetails: body.actionDetails,
      ipAddress,
      userAgent,
      accessMethod: body.accessMethod,
      sharedLinkId: body.sharedLinkId,
      watermarkApplied: body.watermarkApplied,
      watermarkTrackingCode: body.watermarkTrackingCode,
      pagesViewed: body.pagesViewed,
      totalPages: body.totalPages,
      scrollDepth: body.scrollDepth,
      downloadFormat: body.downloadFormat,
    });

    return NextResponse.json({ activity }, { status: 201 });

  } catch (error) {
    console.error('Log activity error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







