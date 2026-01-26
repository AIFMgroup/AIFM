import { NextRequest, NextResponse } from 'next/server';
import { sharedLinkServiceV2 } from '@/lib/dataRooms/sharedLinkServiceV2';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /s/[code]
 * Short link resolver: resolves shortCode via sharedLinkServiceV2 (stored in AIFM_DATAROOMS_TABLE)
 * and redirects to /shared/<token>
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;

    const link = await sharedLinkServiceV2.getLinkByShortCode(code);
    if (!link?.token) {
      return NextResponse.json({ error: 'Short link not found or expired' }, { status: 404 });
    }

    const fullUrl = `/shared/${link.token}`;

    // Redirect to the full shared link page
    return NextResponse.redirect(new URL(fullUrl, request.url));
  } catch (error) {
    console.error('[ShortLink] Resolver error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

