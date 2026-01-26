import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { activityLogService } from '@/lib/dataRooms/activityLogService';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/activity/export
 * Export activity log as CSV
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

    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;

    const csv = activityLogService.exportActivitiesAsCsv(id, startDate, endDate);
    
    const filename = `activity_log_${room.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export activity log error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







