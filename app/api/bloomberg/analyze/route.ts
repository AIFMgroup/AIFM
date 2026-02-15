/**
 * API: Analyze Bloomberg (or similar) screenshot
 *
 * POST multipart/form-data with "file" (image: PNG, JPEG, WebP).
 * Returns structured positions/prices extracted via Claude Vision.
 * Optional: fundId, date for later import into Fund Registry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeBloombergScreenshot } from '@/lib/integrations/bloomberg';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data with a file field' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided. Use field name "file".' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_SIZE_BYTES / 1024 / 1024} MB` },
        { status: 400 }
      );
    }

    const mimeType = file.type as 'image/png' | 'image/jpeg' | 'image/webp';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use PNG, JPEG, or WebP.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await analyzeBloombergScreenshot(buffer, mimeType);

    return NextResponse.json({
      success: result.success,
      currency: result.currency,
      reportDate: result.reportDate,
      positions: result.positions,
      positionCount: result.positions.length,
      error: result.error,
      rawSummary: result.rawSummary,
    });
  } catch (err) {
    console.error('[bloomberg/analyze]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
