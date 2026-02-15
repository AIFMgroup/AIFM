import { NextRequest, NextResponse } from 'next/server';
import { runReviewDocx } from '@/lib/docx/review-docx';

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBufferBase64, fileName, instructions, documentText, paragraphs } = body;

    if (!fileBufferBase64 || !documentText) {
      return NextResponse.json(
        { error: 'fileBufferBase64 och documentText krävs' },
        { status: 400 }
      );
    }

    const result = await runReviewDocx({
      fileBufferBase64,
      fileName,
      instructions: instructions || 'Granska dokumentet och föreslå ändringar.',
      documentText,
      paragraphs,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ReviewDocx] Error:', error);
    return NextResponse.json(
      {
        error: 'Kunde inte granska dokumentet',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
