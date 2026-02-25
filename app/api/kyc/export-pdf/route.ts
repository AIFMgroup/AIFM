import { NextRequest, NextResponse } from 'next/server';
import { generateReport } from '@/lib/pdf/report-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      checklist,
      riskLevel,
      startedAt,
      completedAt,
      approvedAt,
      expiresAt,
      notes,
    } = body as {
      companyName: string;
      checklist: Array<{ id: string; name: string; completed: boolean; notes?: string }>;
      riskLevel?: string;
      startedAt?: string;
      completedAt?: string;
      approvedAt?: string;
      expiresAt?: string;
      notes?: string;
    };

    if (!companyName || !checklist?.length) {
      return NextResponse.json(
        { error: 'Saknar företagsnamn eller checklista.' },
        { status: 400 }
      );
    }

    const today = new Date().toLocaleDateString('sv-SE');

    const sections = [
      {
        title: 'Kontrollpunkter',
        questions: checklist.map((item, i) => ({
          number: String(i + 1),
          text: item.name,
          answer: item.completed ? 'Ja' : 'Nej',
          detail: item.notes || '',
        })),
      },
    ];

    if (riskLevel || startedAt || completedAt || approvedAt || expiresAt) {
      sections.push({
        title: 'Övrig information',
        questions: [
          { number: '1', text: 'Risknivå', answer: riskLevel || '-', detail: '' },
          { number: '2', text: 'Påbörjad', answer: startedAt || '-', detail: '' },
          { number: '3', text: 'Slutförd', answer: completedAt || '-', detail: '' },
          { number: '4', text: 'Godkänd', answer: approvedAt || '-', detail: '' },
          { number: '5', text: 'Utgår', answer: expiresAt || '-', detail: '' },
        ],
      });
    }

    const answeredCount = checklist.filter((c) => c.completed).length;
    const totalCount = checklist.length;

    const pdfBytes = await generateReport({
      title: `KYC-granskning – ${companyName}`,
      subtitle: 'AIFM Capital AB – Kundkännedom',
      date: today,
      sections,
      answeredCount,
      totalCount,
    });

    const safeName = companyName.replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '').replace(/\s+/g, '_').slice(0, 40);

    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="KYC_${safeName}_${today}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[KYC Export PDF] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte generera PDF.' },
      { status: 500 }
    );
  }
}
