import { NextRequest, NextResponse } from 'next/server';
import { ESG_SECTIONS, flattenQuestions } from '@/lib/esg/questions';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom } from '@/lib/dataRooms/archiveToDataroom';
import { generatePDFReport, type ReportSection, type SectionContent } from '@/lib/pdf/pdfkit-report-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PaiTableRow = Record<string, string | boolean | undefined> & {
  indicator: string;
  value?: string;
  unit?: string;
  coverage?: string;
  source?: string;
  isHeader?: boolean;
  isBold?: boolean;
};

interface DnshAnalysis {
  climateMitigation?: string;
  climateAdaptation?: string;
  waterResources?: string;
  circularEconomy?: string;
  pollution?: string;
  biodiversity?: string;
  overallDnsh?: string;
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
  if (lower === 'decreasing') return 'Minskande';
  if (lower === 'stable') return 'Stabil';
  if (lower === 'increasing') return 'Ökande';
  if (lower === 'not_available') return 'Data saknas';
  return answer;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const body = await request.json();
    const {
      answers,
      answerDetails,
      signatureDate,
      signatureName,
      signatureCompany,
      sfdrArticle,
      executiveSummary,
      methodology,
      dnshAnalysis,
      paiTable,
      goodGovernanceAssessment,
    } = body as {
      answers: Record<string, string>;
      answerDetails: Record<string, string>;
      signatureDate?: string;
      signatureName?: string;
      signatureCompany?: string;
      sfdrArticle?: string;
      executiveSummary?: string;
      methodology?: string;
      dnshAnalysis?: DnshAnalysis;
      paiTable?: PaiTableRow[];
      goodGovernanceAssessment?: string;
    };

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Inga svar att exportera.' }, { status: 400 });
    }

    const today = new Date().toLocaleDateString('sv-SE');
    const sfdrLabel =
      sfdrArticle === '9' ? 'Artikel 9 – Hållbart investeringsmål'
        : sfdrArticle === '8' ? 'Artikel 8 – Främjar miljö-/sociala egenskaper'
          : sfdrArticle === '6' ? 'Artikel 6 – Grundläggande krav'
            : undefined;

    let answeredCount = 0;
    let totalCount = 0;
    for (const section of ESG_SECTIONS) {
      for (const q of flattenQuestions(section)) {
        totalCount++;
        const a = answers[q.id];
        if (a && a !== 'null' && a.trim() !== '') answeredCount++;
      }
    }

    const sections: ReportSection[] = [];

    // Meta
    const metaKV: Array<{ label: string; value: string }> = [{ label: 'Datum', value: today }];
    if (sfdrArticle) metaKV.push({ label: 'SFDR', value: sfdrLabel || `Artikel ${sfdrArticle}` });
    metaKV.push({ label: 'Besvarade frågor', value: `${answeredCount} av ${totalCount} (${Math.round((answeredCount / Math.max(totalCount, 1)) * 100)}%)` });

    const introContent: SectionContent[] = [{ type: 'kv', items: metaKV }];
    if (executiveSummary) introContent.push({ type: 'summary', text: executiveSummary });
    sections.push({ title: 'Översikt', content: introContent });

    // Methodology
    if (methodology) {
      sections.push({ title: 'Metodik', content: [{ type: 'text', text: methodology }] });
    }

    // Good Governance
    if (goodGovernanceAssessment) {
      sections.push({ title: 'God styrning (SFDR Art. 2(17))', content: [{ type: 'text', text: goodGovernanceAssessment }] });
    }

    // PAI / GHG table
    if (paiTable && paiTable.length > 0) {
      const POSSIBLE_YEARS = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
      const yearCols = POSSIBLE_YEARS.filter((yr) => paiTable.some((r) => r[yr] != null && String(r[yr]).trim() !== '' && String(r[yr]).trim() !== 'null'));

      if (yearCols.length > 0) {
        const headers = ['Indikator', ...yearCols, 'Förändring', 'Enhet'];
        const rows: Array<{ cells: string[] }> = [];
        for (const row of paiTable) {
          if (row.isHeader === true || String(row.isHeader) === 'true') continue;
          const yearVals = yearCols.map((yr) => String(row[yr] ?? '—'));
          const nums = yearCols.map((yr) => parseFloat(String(row[yr] ?? '').replace(/[,\s]/g, ''))).filter((n) => !isNaN(n));
          let change = '—';
          if (nums.length >= 2) {
            const prev = nums[nums.length - 2];
            const curr = nums[nums.length - 1];
            if (prev !== 0) {
              const pct = ((curr - prev) / Math.abs(prev)) * 100;
              change = (pct >= 0 ? '+' : '') + pct.toFixed(0) + '%';
            }
          }
          rows.push({ cells: [String(row.indicator || ''), ...yearVals, change, String(row.unit || '')] });
        }
        sections.push({ title: 'GHG-utsläpp & PAI-indikatorer', content: [{ type: 'table', headers, rows }] });
      } else {
        const headers = ['Indikator', 'Värde', 'Enhet', 'Täckning', 'Källa'];
        const rows = paiTable.map((r) => ({ cells: [String(r.indicator || ''), String(r.value || ''), String(r.unit || ''), String(r.coverage || ''), String(r.source || '')] }));
        sections.push({ title: 'PAI-indikatorer', content: [{ type: 'table', headers, rows }] });
      }
    }

    // DNSH
    if (dnshAnalysis) {
      const dnshContent: SectionContent[] = [];
      if (dnshAnalysis.overallDnsh) dnshContent.push({ type: 'summary', text: dnshAnalysis.overallDnsh });
      const entries = [
        { label: 'Begränsning av klimatförändringar', text: dnshAnalysis.climateMitigation },
        { label: 'Klimatanpassning', text: dnshAnalysis.climateAdaptation },
        { label: 'Vatten och marina resurser', text: dnshAnalysis.waterResources },
        { label: 'Cirkulär ekonomi', text: dnshAnalysis.circularEconomy },
        { label: 'Förebyggande av föroreningar', text: dnshAnalysis.pollution },
        { label: 'Biologisk mångfald och ekosystem', text: dnshAnalysis.biodiversity },
      ].filter((e) => e.text);
      for (const e of entries) {
        dnshContent.push({ type: 'subsection', title: e.label });
        dnshContent.push({ type: 'text', text: e.text! });
      }
      if (dnshContent.length) sections.push({ title: 'DNSH-analys (Do No Significant Harm)', content: dnshContent });
    }

    // Regulatory reference
    if (sfdrArticle) {
      const regText =
        sfdrArticle === '9'
          ? 'Denna analys är upprättad i enlighet med förordning (EU) 2019/2088 (SFDR) Artikel 9 och delegerade förordningar (RTS). Produkten har hållbart investeringsmål.'
          : sfdrArticle === '8'
            ? 'Denna analys är upprättad i enlighet med förordning (EU) 2019/2088 (SFDR) Artikel 8 och delegerade förordningar (RTS). Produkten främjar miljö- och/eller sociala egenskaper.'
            : 'Denna analys är upprättad i enlighet med förordning (EU) 2019/2088 (SFDR) Artikel 6. Hållbarhetsrisker integreras i investeringsprocessen.';
      sections.push({ title: 'Regulatorisk referens', content: [{ type: 'info', text: regText, variant: 'info' }] });
    }

    // Question sections
    for (const section of ESG_SECTIONS) {
      const questions = flattenQuestions(section);
      const qaContent: SectionContent[] = [];
      for (const q of questions) {
        const answer = formatAnswer(answers[q.id] || '');
        const detail = answerDetails?.[q.id + '_detail'] || answerDetails?.[q.id] || '';
        qaContent.push({ type: 'qa', number: q.number, question: q.text, answer, detail });
      }
      sections.push({ title: section.title, content: qaContent });
    }

    const signature = [];
    if (signatureDate) signature.push({ label: 'Datum', name: signatureDate });
    if (signatureName) signature.push({ label: 'Namn', name: signatureName, detail: signatureCompany || undefined });

    const pdfBuffer = await generatePDFReport({
      reportType: 'ESG-analys',
      title: 'ESG-analys',
      subtitle: sfdrLabel ? `SFDR ${sfdrLabel} – AIFM Capital AB` : 'Analys av ESG-rapporter – AIFM Capital AB',
      date: today,
      badges: sfdrArticle ? [{ label: 'SFDR', value: `Artikel ${sfdrArticle}`, color: 'gold' }] : [],
      sections,
      signature: signature.length > 0 ? signature : undefined,
    });

    const fileName = `ESG-analys_SFDR-Art${sfdrArticle || '8'}_${today}.pdf`;
    if (session?.email) {
      archiveToDataroom({
        userEmail: session.email,
        userName: session.name || session.email || 'Användare',
        analysisType: 'esg',
        fileName,
        pdfBuffer,
        skipIfExists: false,
      }).catch((e) => console.warn('[ESG PDF] Archive failed:', e));
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('[ESG Export PDF] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Kunde inte generera PDF.' },
      { status: 500 }
    );
  }
}
