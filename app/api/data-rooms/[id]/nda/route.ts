import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ndaServiceV2 } from '@/lib/dataRooms/ndaServiceV2';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { activityLogService } from '@/lib/dataRooms/activityLogService';
import { getSession } from '@/lib/auth/session';
import { checkRateLimit, getClientIdentifier, getRateLimitHeaders, RateLimitPresets } from '@/lib/rateLimit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/data-rooms/[id]/nda
 * Get NDA template and status for a room
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');
    
    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json({ error: 'Data room not found' }, { status: 404 });
    }

    const template = await ndaServiceV2.getActiveTemplateForRoom(id);
    const stats = await ndaServiceV2.getRoomNdaStats(id);
    
    let userStatus = null;
    if (userEmail) {
      userStatus = await ndaServiceV2.verifyNdaAccess(id, userEmail);
    }

    return NextResponse.json({
      template,
      stats,
      userStatus,
    });

  } catch (error) {
    console.error('Get NDA info error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rooms/[id]/nda
 * Sign NDA or create new template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const room = await dataRoomStore.getRoomById(id);
    if (!room) {
      return NextResponse.json({ error: 'Data room not found' }, { status: 404 });
    }

    // Handle different actions
    if (body.action === 'sign') {
      // Rate limit NDA signing: 5 attempts per hour per email
      const rateLimitResult = checkRateLimit(body.signerEmail || 'anonymous', RateLimitPresets.NDA_SIGN);
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'Too many signature attempts. Please try again later.' },
          { 
            status: 429,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }

      // Sign NDA
      const template = await ndaServiceV2.getActiveTemplateForRoom(id);
      if (!template) {
        return NextResponse.json({ error: 'No NDA template found' }, { status: 404 });
      }

      const ipAddress = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      const result = await ndaServiceV2.signNda({
        templateId: template.id,
        roomId: id,
        signerName: body.signerName,
        signerEmail: body.signerEmail,
        signerCompany: body.signerCompany,
        signerTitle: body.signerTitle,
        signatureImage: body.signatureImage,
        initials: body.initials,
        ipAddress,
        userAgent,
        customFieldValues: body.customFieldValues,
        accessScope: body.accessScope,
        accessExpiresIn: body.accessExpiresIn,
      });

      // Log activity
      activityLogService.logActivity({
        roomId: id,
        userId: 'external',
        userName: body.signerName,
        userEmail: body.signerEmail,
        userCompany: body.signerCompany,
        action: 'NDA_SIGNED',
        actionDetails: `NDA signerat av ${body.signerName} (${body.signerEmail})`,
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        signature: result.signature,
        accessGrant: result.accessGrant,
      }, { status: 201 });
    }

    if (body.action === 'create_template') {
      // Create new template (requires authentication)
      const cookieStore = await cookies();
      const token = cookieStore.get('__Host-aifm_id_token')?.value;
      
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const session = await getSession().catch(() => null);
      const actorName = session?.name || session?.email || 'User';

      const template = await ndaServiceV2.createTemplate({
        roomId: id,
        name: body.name,
        content: body.content,
        createdBy: actorName,
        requireSignature: body.requireSignature,
        requireInitials: body.requireInitials,
        requireFullName: body.requireFullName,
        requireEmail: body.requireEmail,
        requireCompany: body.requireCompany,
        requireTitle: body.requireTitle,
        customFields: body.customFields,
      });

      return NextResponse.json({ template }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('NDA action error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







