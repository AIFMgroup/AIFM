/**
 * Auto-archive: generates PDF from analysis results and archives to the user's personal data room.
 * Called fire-and-forget from frontend when an analysis completes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom, type AnalysisType } from '@/lib/dataRooms/archiveToDataroom';
import { generateReport } from '@/lib/pdf/report-generator';
import { ESG_SECTIONS, flattenQuestions } from '@/lib/esg/questions';
import { DELEGATION_SECTIONS, UNDERLAG_ITEMS, type DelegationQuestion } from '@/lib/delegation/questions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type PaiTableRow = Record<string, string | boolean | undefined> & {
  indicator: string;
  unit?: string;
  source?: string;
};

function flattenDelegationQuestions(section: (typeof DELEGATION_SECTIONS)[number]): DelegationQuestion[] {
  const out: DelegationQuestion[] = [];
  function collect(q: DelegationQuestion) {
    out.push(q);
    q.subQuestions?.forEach(collect);
  }
  section.questions.forEach(collect);
  return out;
}

// ---------------------------------------------------------------------------
// ESG PDF generation (mirrors export-pdf route logic)
// ---------------------------------------------------------------------------
async function generateEsgPdf(body: Record<string, any>): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  const {
    answers = {},
    details = {},
    sfdrArticle,
    executiveSummary,
    methodology,
    dnshAnalysis,
    paiTable,
    goodGovernanceAssessment,
  } = body;

  const sections = ESG_SECTIONS.map((section) => {
    const questions = flattenQuestions(section).map((q) => ({
      number: q.number,
      text: q.text,
      answer: answers[q.id] || '',
      detail: details?.[q.id + '_detail'] || details?.[q.id] || '',
      type: q.type,
    }));
    return { title: section.title, questions };
  });

  let answeredCount = 0;
  let totalCount = 0;
  for (const s of sections) {
    for (const q of s.questions) {
      totalCount++;
      if (q.answer && q.answer !== 'null' && q.answer.trim() !== '') answeredCount++;
    }
  }

  const today = new Date().toLocaleDateString('sv-SE');
  const sfdrLabel =
    sfdrArticle === '9'
      ? 'Artikel 9 – Hållbart investeringsmal'
      : sfdrArticle === '8'
        ? 'Artikel 8 – Framjar miljo-/sociala egenskaper'
        : sfdrArticle === '6'
          ? 'Artikel 6 – Grundlaggande krav'
          : undefined;

  const pdfBytes = await generateReport({
    title: 'ESG-analys',
    subtitle: sfdrLabel
      ? `SFDR ${sfdrLabel} – AIFM Capital AB`
      : 'Analys av ESG-rapporter – AIFM Capital AB',
    date: today,
    sections,
    sfdrArticle: sfdrArticle || undefined,
    executiveSummary: executiveSummary || undefined,
    methodology: methodology || undefined,
    dnshAnalysis: dnshAnalysis || undefined,
    paiTable: (paiTable as PaiTableRow[]) || undefined,
    goodGovernanceAssessment: goodGovernanceAssessment || undefined,
    answeredCount,
    totalCount,
  });

  return { pdfBytes, fileName: `ESG-analys_SFDR-Art${sfdrArticle || '8'}_${today}.pdf` };
}

// ---------------------------------------------------------------------------
// Delegation PDF generation (mirrors export-pdf route logic)
// ---------------------------------------------------------------------------
async function generateDelegationPdf(body: Record<string, any>): Promise<{ pdfBytes: Uint8Array; fileName: string }> {
  const { answers = {}, details = {}, sfdrArticle, underlag } = body;

  const sections = DELEGATION_SECTIONS.map((section) => {
    const questions = flattenDelegationQuestions(section).map((q) => ({
      number: q.number,
      text: q.text,
      answer: answers[q.id] || '',
      detail: details?.[q.id + '_detail'] || details?.[q.id] || '',
      type: q.type,
    }));
    return { title: section.title, questions };
  });

  let answeredCount = 0;
  let totalCount = 0;
  for (const s of sections) {
    for (const q of s.questions) {
      totalCount++;
      if (q.answer && q.answer !== 'null' && q.answer.trim() !== '') answeredCount++;
    }
  }

  const today = new Date().toLocaleDateString('sv-SE');

  const underlagSection =
    underlag && typeof underlag === 'object'
      ? {
          title: 'Underlag',
          items: UNDERLAG_ITEMS.map((item) => ({
            label: item.label,
            checked: Boolean(underlag[item.id]),
          })),
        }
      : undefined;

  const pdfBytes = await generateReport({
    title: 'Delegationsövervakning',
    subtitle: 'Portföljförvaltning – AIFM Capital AB',
    date: today,
    sections,
    sfdrArticle: sfdrArticle || undefined,
    underlagSection,
    answeredCount,
    totalCount,
  });

  return { pdfBytes, fileName: `Delegationsovervakning_${today}.pdf` };
}

// ---------------------------------------------------------------------------
// Investment analysis: we call the existing generate-pdf route internally
// to avoid duplicating 300+ lines of pdf-lib code. Instead, generate via fetch.
// ---------------------------------------------------------------------------
async function generateInvestmentPdf(
  body: Record<string, any>,
  origin: string,
  cookieHeader: string
): Promise<{ pdfBuffer: Buffer; fileName: string }> {
  const today = new Date().toLocaleDateString('sv-SE');
  const res = await fetch(`${origin}/api/investment-analysis/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({
      analysis: body.analysis || body,
      sfdrArticle: body.sfdrArticle || '',
      analyzedDocuments: body.analyzedDocuments || [],
      analysisDate: body.analysisDate || today,
    }),
  });

  if (!res.ok) throw new Error(`Investment PDF generation failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const safeName = ((body.analysis?.companyName || body.companyName || 'Investeringsanalys') as string)
    .replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '_');
  return { pdfBuffer: buf, fileName: `${safeName}_${today}.pdf` };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    if (!session?.email) {
      return NextResponse.json({ ok: false, reason: 'no-session' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisType, data } = body as { analysisType?: string; data?: Record<string, any> };

    if (!analysisType || !data) {
      return NextResponse.json({ ok: false, reason: 'missing-fields' }, { status: 400 });
    }

    const validTypes: AnalysisType[] = ['esg', 'investment-analysis', 'securities', 'delegation'];
    if (!validTypes.includes(analysisType as AnalysisType)) {
      return NextResponse.json({ ok: false, reason: 'invalid-type' }, { status: 400 });
    }

    const userEmail = session.email;
    const userName = session.name || session.email || 'Användare';

    let pdfBuffer: Buffer;
    let fileName: string;

    if (analysisType === 'esg') {
      const result = await generateEsgPdf(data);
      pdfBuffer = Buffer.from(result.pdfBytes);
      fileName = result.fileName;
    } else if (analysisType === 'delegation') {
      const result = await generateDelegationPdf(data);
      pdfBuffer = Buffer.from(result.pdfBytes);
      fileName = result.fileName;
    } else if (analysisType === 'investment-analysis') {
      const origin = request.nextUrl.origin;
      const cookieHeader = request.headers.get('cookie') || '';
      const result = await generateInvestmentPdf(data, origin, cookieHeader);
      pdfBuffer = result.pdfBuffer;
      fileName = result.fileName;
    } else {
      return NextResponse.json({ ok: false, reason: 'securities-uses-own-flow' });
    }

    console.log(`[auto-archive] Generating + archiving ${analysisType} PDF for ${userEmail}`);

    const archiveResult = await archiveToDataroom({
      userEmail,
      userName,
      analysisType: analysisType as AnalysisType,
      fileName,
      pdfBuffer,
      skipIfExists: false,
    });

    console.log(`[auto-archive] Archived: docId=${archiveResult.documentId}`);

    return NextResponse.json({
      ok: true,
      documentId: archiveResult.documentId,
      roomId: archiveResult.roomId,
      fileName,
    });
  } catch (err) {
    console.error('[auto-archive] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Arkiveringsfel' },
      { status: 500 }
    );
  }
}
