import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom } from '@/lib/dataRooms/archiveToDataroom';
import { generatePDFReport, type ReportSection } from '@/lib/pdf/pdfkit-report-generator';

interface AnalysisData {
  companyName?: string;
  ticker?: string;
  sector?: string;
  overallRating?: string;
  riskLevel?: string;
  esgRating?: string;
  executiveSummary?: string;
  companyOverview?: string;
  businessModel?: string;
  marketPosition?: string;
  financialAnalysis?: string;
  valuationMetrics?: string;
  managementGovernance?: string;
  esgAssessment?: string;
  riskAnalysis?: string;
  swotAnalysis?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] };
  investmentThesis?: string;
  prosAndCons?: { pros?: string[]; cons?: string[] };
  conclusion?: string;
}

const RATING_LABELS: Record<string, string> = {
  strong_buy: 'STARK KÖP', buy: 'KÖP', hold: 'AVVAKTA', sell: 'SÄLJ', strong_sell: 'STARK SÄLJ',
};
const RISK_LABELS: Record<string, string> = {
  low: 'Låg', medium: 'Medel', high: 'Hög', very_high: 'Mycket hög',
};
const ESG_LABELS: Record<string, string> = {
  excellent: 'Utmärkt', good: 'Bra', adequate: 'Godkänd', poor: 'Svag', critical: 'Kritisk',
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession().catch(() => null);
    const body = await request.json();
    const analysis: AnalysisData = body.analysis || {};
    const sfdrArticle = body.sfdrArticle || '';
    const analyzedDocuments: string[] = Array.isArray(body.analyzedDocuments) ? body.analyzedDocuments : [];
    const analysisDate = body.analysisDate || new Date().toLocaleDateString('sv-SE');

    const companyTitle = analysis.companyName || 'Bolagsanalys';

    const badges: Array<{ label: string; value: string; color?: 'green' | 'red' | 'gold' | 'gray' }> = [];
    if (analysis.overallRating) badges.push({ label: 'Rekommendation', value: RATING_LABELS[analysis.overallRating] || analysis.overallRating, color: analysis.overallRating.includes('buy') ? 'green' : analysis.overallRating.includes('sell') ? 'red' : 'gray' });
    if (analysis.riskLevel) badges.push({ label: 'Risk', value: RISK_LABELS[analysis.riskLevel] || analysis.riskLevel, color: analysis.riskLevel === 'low' ? 'green' : analysis.riskLevel === 'high' || analysis.riskLevel === 'very_high' ? 'red' : 'gold' });
    if (analysis.esgRating) badges.push({ label: 'ESG', value: ESG_LABELS[analysis.esgRating] || analysis.esgRating, color: analysis.esgRating === 'excellent' || analysis.esgRating === 'good' ? 'green' : analysis.esgRating === 'poor' || analysis.esgRating === 'critical' ? 'red' : 'gold' });
    if (sfdrArticle) badges.push({ label: 'SFDR', value: `Artikel ${sfdrArticle}`, color: 'gold' });

    const sections: ReportSection[] = [];

    // Analyzed documents
    if (analyzedDocuments.length > 0) {
      sections.push({
        title: 'Analyserade dokument',
        content: [{ type: 'table', headers: ['Dokument'], rows: analyzedDocuments.map((d) => ({ cells: [d] })) }],
      });
    }

    // Executive summary
    if (analysis.executiveSummary) {
      sections.push({ title: 'Sammanfattning', content: [{ type: 'summary', text: analysis.executiveSummary }] });
    }

    // Text sections
    const textSections: Array<{ key: keyof AnalysisData; title: string }> = [
      { key: 'companyOverview', title: 'Bolagsbeskrivning' },
      { key: 'businessModel', title: 'Affärsmodell' },
      { key: 'marketPosition', title: 'Marknadsposition' },
      { key: 'financialAnalysis', title: 'Finansiell analys' },
      { key: 'valuationMetrics', title: 'Värdering' },
      { key: 'managementGovernance', title: 'Ledning & styrning' },
      { key: 'esgAssessment', title: 'ESG-bedömning' },
      { key: 'riskAnalysis', title: 'Riskanalys' },
      { key: 'investmentThesis', title: 'Investeringstes' },
      { key: 'conclusion', title: 'Slutsats & rekommendation' },
    ];
    for (const { key, title } of textSections) {
      const val = analysis[key];
      if (typeof val === 'string' && val.trim()) {
        sections.push({ title, content: [{ type: 'text', text: val }] });
      }
    }

    // SWOT
    if (analysis.swotAnalysis) {
      const swot = analysis.swotAnalysis;
      const swotContent: ReportSection['content'] = [];
      if (swot.strengths?.length) swotContent.push({ type: 'bullets', title: 'Styrkor', items: swot.strengths, color: 'green' });
      if (swot.weaknesses?.length) swotContent.push({ type: 'bullets', title: 'Svagheter', items: swot.weaknesses, color: 'red' });
      if (swot.opportunities?.length) swotContent.push({ type: 'bullets', title: 'Möjligheter', items: swot.opportunities, color: 'default' });
      if (swot.threats?.length) swotContent.push({ type: 'bullets', title: 'Hot', items: swot.threats, color: 'red' });
      if (swotContent.length) sections.push({ title: 'SWOT-analys', content: swotContent });
    }

    // Pros & cons
    if (analysis.prosAndCons) {
      const pcContent: ReportSection['content'] = [];
      if (analysis.prosAndCons.pros?.length) pcContent.push({ type: 'bullets', title: 'Fördelar', items: analysis.prosAndCons.pros, color: 'green' });
      if (analysis.prosAndCons.cons?.length) pcContent.push({ type: 'bullets', title: 'Nackdelar', items: analysis.prosAndCons.cons, color: 'red' });
      if (pcContent.length) sections.push({ title: 'Fördelar & nackdelar', content: pcContent });
    }

    const sub = [analysis.ticker, analysis.sector].filter(Boolean).join(' | ');
    const pdfBuffer = await generatePDFReport({
      reportType: 'Investeringsanalys',
      title: companyTitle,
      subtitle: sub || undefined,
      date: analysisDate,
      badges,
      sections,
    });

    const safeName = (companyTitle).replace(/[^a-zA-Z0-9åäöÅÄÖ\s_-]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `Investeringsanalys_${safeName}_${analysisDate}.pdf`;

    if (session?.email) {
      archiveToDataroom({
        userEmail: session.email,
        userName: session.name || session.email || 'Användare',
        analysisType: 'investment-analysis',
        fileName,
        pdfBuffer,
        skipIfExists: false,
      }).catch((e) => console.warn('[Investment PDF] Archive failed:', e));
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('[InvestmentAnalysis PDF] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte generera PDF', details: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}
