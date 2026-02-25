import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientId } from '@/lib/security/rateLimiter';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom } from '@/lib/dataRooms/archiveToDataroom';
import { generatePDFReport, type ReportSection } from '@/lib/pdf/pdfkit-report-generator';

interface PDFRequest {
  title: string;
  content: string;
  subtitle?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  footer?: string;
}

export async function POST(request: NextRequest) {
  try {
    const clientId = await getClientId();
    const rateLimitResult = await checkRateLimit(clientId, 'ai-generate');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Du har gjort för många förfrågningar. Vänta innan du försöker igen.', retryAfter: rateLimitResult.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter || 60) } }
      );
    }

    const body: PDFRequest = await request.json();
    const { title, content, subtitle, sections, footer } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const hasContent = content && content.trim().length > 0;
    const hasSections = sections && sections.length > 0;

    if (!hasContent && !hasSections) {
      return NextResponse.json({ error: 'Content or sections are required' }, { status: 400 });
    }

    const reportSections: ReportSection[] = [];

    if (hasContent) {
      reportSections.push({ title: 'Innehåll', content: [{ type: 'text', text: content }] });
    }

    if (hasSections) {
      for (const section of sections!) {
        reportSections.push({ title: section.title, content: [{ type: 'text', text: section.content }] });
      }
    }

    const pdfBuffer = await generatePDFReport({
      reportType: 'Rapport',
      title,
      subtitle: subtitle || undefined,
      date: new Date().toLocaleDateString('sv-SE'),
      sections: reportSections,
      footerText: footer || 'AIFM Capital AB | Konfidentiellt | Genererat av AIFM Agent',
    });

    const safeTitle = title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_');
    const fileName = `${safeTitle}.pdf`;

    const session = await getSession().catch(() => null);
    if (session?.email) {
      archiveToDataroom({
        userEmail: session.email,
        userName: session.name || session.email,
        analysisType: 'investment-analysis',
        fileName,
        pdfBuffer,
      })
        .then((res) => console.log(`[AI PDF] Archived to dataroom: ${res.documentId}`))
        .catch((e) => console.warn('[AI PDF] Archive failed:', e));
    }

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeTitle}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
