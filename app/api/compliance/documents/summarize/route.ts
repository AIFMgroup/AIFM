import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBase } from '@/lib/compliance/knowledge-base';
import { generateDocumentSummary } from '@/lib/compliance/summarize';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/**
 * POST /api/compliance/documents/summarize
 * Body: { documentId: string }
 * Generates an AI summary for the document and saves it to metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId } = body as { documentId?: string };

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId krävs.' },
        { status: 400 }
      );
    }

    const document = await knowledgeBase.getDocument(documentId);
    if (!document) {
      return NextResponse.json(
        { error: 'Dokumentet hittades inte.' },
        { status: 404 }
      );
    }

    await knowledgeBase.setDocumentSummaryStatus(documentId, 'summarizing');

    const summary = await generateDocumentSummary(document.content, document.title);
    await knowledgeBase.updateDocumentSummary(documentId, summary);

    return NextResponse.json({
      success: true,
      documentId,
      summaryLength: summary.length,
    });
  } catch (err) {
    console.error('[Compliance Summarize] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte generera sammanfattning.' },
      { status: 500 }
    );
  }
}
