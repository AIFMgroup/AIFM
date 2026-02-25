import { NextRequest, NextResponse } from 'next/server';
import { DELEGATION_SECTIONS, UNDERLAG_ITEMS, type DelegationQuestion } from '@/lib/delegation/questions';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom } from '@/lib/dataRooms/archiveToDataroom';
import { generatePDFReport, type ReportSection, type SectionContent } from '@/lib/pdf/pdfkit-report-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function flattenDelegationQuestions(section: typeof DELEGATION_SECTIONS[number]): DelegationQuestion[] {
  const out: DelegationQuestion[] = [];
  function collect(q: DelegationQuestion) {
    out.push(q);
    q.subQuestions?.forEach(collect);
  }
  section.questions.forEach(collect);
  return out;
}

function formatAnswer(answer: string): string {
  if (!answer || answer === 'null' || answer === 'undefined') return '—';
  const lower = answer.toLowerCase().trim();
  if (lower === 'yes') return 'Ja';
  if (lower === 'no') return 'Nej';
  if (lower === 'approved') return 'Godkänd';
  if (lower === 'rejected') return 'Ej godkänd';
  if (lower === 'meets') return 'Uppfyller';
  if (lower === 'does_not_meet') return 'Uppfyller inte';
  if (lower === 'low') return 'Låg';
  if (lower === 'medium') return 'Medel';
  if (lower === 'high') return 'Hög';
  if (lower === 'not_available') return 'Data saknas';
  return answer;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const body = await request.json();
    const { answers, answerDetails, signatureDate, signatureName, signatureCompany, sfdrArticle, underlag } = body as {
      answers: Record<string, string>;
      answerDetails: Record<string, string>;
      signatureDate?: string;
      signatureName?: string;
      signatureCompany?: string;
      sfdrArticle?: string;
      underlag?: Record<string, boolean>;
    };

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Inga svar att exportera.' }, { status: 400 });
    }

    const today = new Date().toLocaleDateString('sv-SE');

    let answeredCount = 0;
    let totalCount = 0;
    for (const section of DELEGATION_SECTIONS) {
      for (const q of flattenDelegationQuestions(section)) {
        totalCount++;
        const a = answers[q.id];
        if (a && a !== 'null' && a.trim() !== '') answeredCount++;
      }
    }

    const sections: ReportSection[] = [];

    // Meta info
    const metaKV: Array<{ label: string; value: string }> = [{ label: 'Datum', value: today }];
    if (sfdrArticle) metaKV.push({ label: 'SFDR', value: `Artikel ${sfdrArticle}` });
    metaKV.push({ label: 'Besvarade frågor', value: `${answeredCount} av ${totalCount} (${Math.round((answeredCount / Math.max(totalCount, 1)) * 100)}%)` });
    sections.push({ title: 'Översikt', content: [{ type: 'kv', items: metaKV }] });

    // Question sections
    for (const section of DELEGATION_SECTIONS) {
      const questions = flattenDelegationQuestions(section);
      const qaContent: SectionContent[] = [];
      for (const q of questions) {
        const answer = formatAnswer(answers[q.id] || '');
        const detail = answerDetails?.[q.id + '_detail'] || answerDetails?.[q.id] || '';
        qaContent.push({ type: 'qa', number: q.number, question: q.text, answer, detail });
      }
      sections.push({ title: section.title, content: qaContent });
    }

    // Underlag checklist
    if (underlag && typeof underlag === 'object') {
      sections.push({
        title: 'Underlag',
        content: [{
          type: 'checklist',
          items: UNDERLAG_ITEMS.map((item) => ({
            label: item.label,
            checked: Boolean(underlag[item.id]),
          })),
        }],
      });
    }

    const signature = [];
    if (signatureDate) signature.push({ label: 'Datum', name: signatureDate });
    if (signatureName) signature.push({ label: 'Namn', name: signatureName, detail: signatureCompany || undefined });

    const pdfBuffer = await generatePDFReport({
      reportType: 'Delegationsövervakning',
      title: 'Delegationsövervakning',
      subtitle: 'Portföljförvaltning – AIFM Capital AB',
      date: today,
      badges: sfdrArticle ? [{ label: 'SFDR', value: `Artikel ${sfdrArticle}`, color: 'gold' }] : [],
      sections,
      signature: signature.length > 0 ? signature : undefined,
    });

    const fileName = `Delegationsovervakning_${today}.pdf`;
    if (session?.email) {
      archiveToDataroom({
        userEmail: session.email,
        userName: session.name || session.email || 'Användare',
        analysisType: 'delegation',
        fileName,
        pdfBuffer,
        skipIfExists: false,
      }).catch((e) => console.warn('[Delegation PDF] Archive failed:', e));
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('[Delegation Export PDF] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte generera PDF.' },
      { status: 500 }
    );
  }
}
