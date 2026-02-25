import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom, type AnalysisType } from '@/lib/dataRooms/archiveToDataroom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ANALYSIS_TYPES: AnalysisType[] = ['esg', 'investment-analysis', 'securities', 'delegation'];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const userEmail = session?.email ?? null;
    const userName = session?.name || session?.email || 'Användare';

    if (!userEmail) {
      return NextResponse.json({ error: 'Du måste vara inloggad för att arkivera.' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisType, fileName, pdfBase64, metadata } = body as {
      analysisType?: string;
      fileName?: string;
      pdfBase64?: string;
      metadata?: { submissionId?: string; companyName?: string; sfdrArticle?: string };
    };

    if (!analysisType || !fileName || !pdfBase64) {
      return NextResponse.json(
        { error: 'Saknar analysisType, fileName eller pdfBase64.' },
        { status: 400 }
      );
    }

    if (!VALID_ANALYSIS_TYPES.includes(analysisType as AnalysisType)) {
      return NextResponse.json(
        { error: `Ogiltig analysisType. Tillåtna: ${VALID_ANALYSIS_TYPES.join(', ')}.` },
        { status: 400 }
      );
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(pdfBase64, 'base64');
    } catch {
      return NextResponse.json({ error: 'Ogiltig base64 för PDF.' }, { status: 400 });
    }

    if (pdfBuffer.length === 0) {
      return NextResponse.json({ error: 'PDF-datan är tom.' }, { status: 400 });
    }

    const result = await archiveToDataroom({
      userEmail,
      userName,
      analysisType: analysisType as AnalysisType,
      fileName,
      pdfBuffer,
      skipIfExists: true,
    });

    return NextResponse.json({
      documentId: result.documentId,
      roomId: result.roomId,
      folderId: result.folderId,
    });
  } catch (err) {
    console.error('[dataroom-archive] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte arkivera till datarum.' },
      { status: 500 }
    );
  }
}
