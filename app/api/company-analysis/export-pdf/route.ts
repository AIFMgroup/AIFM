import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { archiveToDataroom } from '@/lib/dataRooms/archiveToDataroom';
import type { CompleteCompanyAnalysis } from '@/lib/company-analysis/types';
import { generatePDFReport, type ReportSection } from '@/lib/pdf/pdfkit-report-generator';

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
    const analysis = body.analysis as CompleteCompanyAnalysis | undefined;
    if (!analysis || !analysis.identification) {
      return NextResponse.json({ error: 'analysis (CompleteCompanyAnalysis) krävs.' }, { status: 400 });
    }

    const id = analysis.identification;
    const companyTitle = id.companyName || id.ticker || 'Bolagsanalys';
    const analysisDate = new Date(analysis.analyzedAt).toLocaleDateString('sv-SE');
    const sum = analysis.summary;

    const badges: Array<{ label: string; value: string; color?: 'green' | 'red' | 'gold' | 'gray' }> = [];
    if (sum?.overallRating) badges.push({ label: 'Rekommendation', value: RATING_LABELS[sum.overallRating] || sum.overallRating, color: sum.overallRating.includes('buy') ? 'green' : sum.overallRating.includes('sell') ? 'red' : 'gray' });
    if (sum?.riskLevel) badges.push({ label: 'Risk', value: RISK_LABELS[sum.riskLevel] || sum.riskLevel, color: sum.riskLevel === 'low' ? 'green' : sum.riskLevel === 'high' || sum.riskLevel === 'very_high' ? 'red' : 'gold' });
    if (sum?.esgRating) badges.push({ label: 'ESG', value: ESG_LABELS[sum.esgRating] || sum.esgRating, color: sum.esgRating === 'excellent' || sum.esgRating === 'good' ? 'green' : sum.esgRating === 'poor' || sum.esgRating === 'critical' ? 'red' : 'gold' });

    const sections: ReportSection[] = [];

    // Executive summary
    if (analysis.financialAnalysis?.executiveSummary) {
      sections.push({ title: 'Sammanfattning', content: [{ type: 'summary', text: analysis.financialAnalysis.executiveSummary }] });
    }

    // Identification
    const idKV = [
      id.companyName && { label: 'Bolag', value: id.companyName },
      id.ticker && { label: 'Ticker', value: id.ticker },
      id.isin && { label: 'ISIN', value: id.isin },
      id.sector && { label: 'Sektor', value: id.sector },
      id.industry && { label: 'Bransch', value: id.industry },
      id.country && { label: 'Land', value: id.country },
      id.exchange && { label: 'Börs', value: id.exchange },
      id.currency && { label: 'Valuta', value: id.currency },
      id.emitter && { label: 'Emittent', value: id.emitter },
    ].filter(Boolean) as Array<{ label: string; value: string }>;
    if (idKV.length) sections.push({ title: 'Identifiering & Lookup', content: [{ type: 'kv', items: idKV }] });

    // Market data
    const md = analysis.marketData;
    const mdKV: Array<{ label: string; value: string }> = [];
    if (md.currentPrice != null) mdKV.push({ label: 'Kurs', value: `${md.currentPrice} ${md.currency || ''}` });
    if (md.marketCap != null) mdKV.push({ label: 'Börsvärde', value: `${md.marketCap} ${md.currency || ''}` });
    if (md.averageDailyVolume != null) mdKV.push({ label: 'Snittvolym/dag', value: String(md.averageDailyVolume) });
    if (md.fiftyTwoWeekHigh != null) mdKV.push({ label: '52v hög', value: String(md.fiftyTwoWeekHigh) });
    if (md.fiftyTwoWeekLow != null) mdKV.push({ label: '52v låg', value: String(md.fiftyTwoWeekLow) });
    if (md.liquidityCategory) mdKV.push({ label: 'Likviditet', value: md.liquidityCategory });
    if (md.meetsLiquidityPresumption != null) mdKV.push({ label: 'Likviditetspresumtion', value: md.meetsLiquidityPresumption ? 'Uppfylld' : 'Ej uppfylld' });
    if (mdKV.length) sections.push({ title: 'Marknadsdata', content: [{ type: 'kv', items: mdKV }] });

    // Key metrics
    const metrics: Array<{ label: string; value: string }> = [];
    if (md.peRatio != null) metrics.push({ label: 'P/E', value: md.peRatio.toFixed(1) });
    if (md.forwardPE != null) metrics.push({ label: 'Forward P/E', value: md.forwardPE.toFixed(1) });
    if (md.pbRatio != null) metrics.push({ label: 'P/B', value: md.pbRatio.toFixed(1) });
    if (md.evToEbitda != null) metrics.push({ label: 'EV/EBITDA', value: md.evToEbitda.toFixed(1) });
    if (md.dividendYield != null) metrics.push({ label: 'Utdelningsavkastning', value: `${md.dividendYield.toFixed(1)}%` });
    if (md.returnOnEquity != null) metrics.push({ label: 'ROE', value: `${md.returnOnEquity.toFixed(1)}%` });
    if (md.profitMargin != null) metrics.push({ label: 'Vinstmarginal', value: `${md.profitMargin.toFixed(1)}%` });
    if (md.operatingMargin != null) metrics.push({ label: 'Rörelsemarginal', value: `${md.operatingMargin.toFixed(1)}%` });
    if (md.debtToEquity != null) metrics.push({ label: 'Skuld/EK', value: md.debtToEquity.toFixed(1) });
    if (md.revenueGrowth != null) metrics.push({ label: 'Intäktstillväxt', value: `${md.revenueGrowth.toFixed(1)}%` });
    if (md.beta != null) metrics.push({ label: 'Beta', value: md.beta.toFixed(2) });
    if (metrics.length) sections.push({ title: 'Nyckeltal', content: [{ type: 'kv', items: metrics }] });

    // ESG
    const esg = analysis.esg?.esg;
    const esgSection = analysis.esg;
    if (esg) {
      const esgKV: Array<{ label: string; value: string }> = [];
      if (esg.totalScore != null) esgKV.push({ label: 'ESG-poäng', value: String(esg.totalScore) });
      if (esg.environmentScore != null) esgKV.push({ label: 'Miljö (E)', value: String(esg.environmentScore) });
      if (esg.socialScore != null) esgKV.push({ label: 'Socialt (S)', value: String(esg.socialScore) });
      if (esg.governanceScore != null) esgKV.push({ label: 'Styrning (G)', value: String(esg.governanceScore) });
      if (esg.controversyLevel != null) esgKV.push({ label: 'Kontroversnivå', value: String(esg.controversyLevel) });
      if (esg.sfdrAlignment) esgKV.push({ label: 'SFDR', value: esg.sfdrAlignment });
      if (esg.carbonIntensity != null) esgKV.push({ label: 'Koldioxidintensitet', value: `${esg.carbonIntensity} ${esg.carbonIntensityUnit || ''}` });
      if (esgSection?.taxonomyAlignment != null) esgKV.push({ label: 'EU Taxonomi', value: `${esgSection.taxonomyAlignment}%` });
      if (esg.provider) esgKV.push({ label: 'Datakälla', value: esg.provider });

      const esgContent: ReportSection['content'] = [{ type: 'kv', items: esgKV }];
      if (esgSection?.esgDecision) {
        esgContent.push({
          type: 'decision',
          decision: esgSection.esgDecision as 'approved' | 'rejected',
          text: esgSection.esgDecisionMotivation || '',
        });
      }
      sections.push({ title: 'ESG & Hållbarhet', content: esgContent });
    }

    // Fund terms exclusion evaluation
    const ftc = analysis.fundTermsContext;
    if (ftc && ftc.exclusions.length > 0) {
      const rows = ftc.exclusions.map((ex) => {
        const status = ex.actualPercent === null ? 'Ingen data' : ex.approved ? `OK (${ex.actualPercent.toFixed(1)}%)` : `EJ OK (${ex.actualPercent.toFixed(1)}%)`;
        return { cells: [ex.label, `${ex.threshold}%`, status], color: ex.approved === false ? '#991b1b' : undefined };
      });
      sections.push({
        title: `Exkluderingskontroll – ${ftc.fundName} (Art. ${ftc.article})`,
        content: [{ type: 'table', headers: ['Kategori', 'Gränsvärde', 'Status'], rows }],
      });
    }

    // Compliance FFFS
    const fffs = analysis.compliance?.fffsCompliance ?? (analysis.compliance as any)?.fffs;
    if (fffs) {
      sections.push({
        title: 'Compliance (FFFS 2013:9)',
        content: [{
          type: 'checklist',
          items: [
            { label: 'Begränsad förlustpotential', checked: !!fffs.limitedPotentialLoss },
            { label: 'Likviditet inte äventyrad', checked: !!fffs.liquidityNotEndangered },
            { label: 'Pålitlig värdering', checked: !!fffs.reliableValuation?.checked },
            { label: 'Lämplig information', checked: !!fffs.appropriateInformation?.checked },
            { label: 'Marknadsbar', checked: !!fffs.isMarketable },
            { label: 'Förenlig med fond', checked: !!fffs.compatibleWithFund },
            { label: 'Riskhantering täcker', checked: !!fffs.riskManagementCaptures },
          ],
        }],
      });
    }

    // Financial analysis sections
    const fin = analysis.financialAnalysis;
    if (fin?.placementStrategyFit) {
      sections.push({ title: 'Passform med fondens placeringsstrategi', content: [{ type: 'text', text: fin.placementStrategyFit }] });
    }
    const aiSections: Array<{ key: string; title: string }> = [
      { key: 'companyOverview', title: 'Bolagsbeskrivning' },
      { key: 'businessModel', title: 'Affärsmodell' },
      { key: 'marketPosition', title: 'Marknadsposition' },
      { key: 'financialAnalysis', title: 'Finansiell analys' },
      { key: 'valuationMetrics', title: 'Värdering' },
      { key: 'managementGovernance', title: 'Ledning & styrning' },
    ];
    for (const { key, title } of aiSections) {
      const val = (fin as any)?.[key];
      if (typeof val === 'string' && val.trim()) {
        sections.push({ title, content: [{ type: 'text', text: val }] });
      }
    }

    // Risk & SWOT
    if (analysis.riskSwot?.riskAnalysis) {
      sections.push({ title: 'Riskanalys', content: [{ type: 'text', text: analysis.riskSwot.riskAnalysis }] });
    }
    if (analysis.riskSwot?.swotAnalysis) {
      const swot = analysis.riskSwot.swotAnalysis;
      const swotContent: ReportSection['content'] = [];
      if (swot.strengths?.length) swotContent.push({ type: 'bullets', title: 'Styrkor', items: swot.strengths, color: 'green' });
      if (swot.weaknesses?.length) swotContent.push({ type: 'bullets', title: 'Svagheter', items: swot.weaknesses, color: 'red' });
      if (swot.opportunities?.length) swotContent.push({ type: 'bullets', title: 'Möjligheter', items: swot.opportunities, color: 'default' });
      if (swot.threats?.length) swotContent.push({ type: 'bullets', title: 'Hot', items: swot.threats, color: 'red' });
      if (swotContent.length) sections.push({ title: 'SWOT-analys', content: swotContent });
    }

    // Investment thesis
    if (sum?.investmentThesis) sections.push({ title: 'Investeringstes', content: [{ type: 'text', text: sum.investmentThesis }] });

    // Pros & cons
    if (sum?.prosAndCons) {
      const pcContent: ReportSection['content'] = [];
      if (sum.prosAndCons.pros?.length) pcContent.push({ type: 'bullets', title: 'Fördelar', items: sum.prosAndCons.pros, color: 'green' });
      if (sum.prosAndCons.cons?.length) pcContent.push({ type: 'bullets', title: 'Nackdelar', items: sum.prosAndCons.cons, color: 'red' });
      if (pcContent.length) sections.push({ title: 'Fördelar & nackdelar', content: pcContent });
    }

    // Conclusion
    if (sum?.conclusion) sections.push({ title: 'Slutsats & rekommendation', content: [{ type: 'text', text: sum.conclusion }] });

    // News
    if (analysis.news.articles.length > 0) {
      const rows = analysis.news.articles.slice(0, 8).map((a) => ({
        cells: [a.title, a.source, a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('sv-SE') : ''],
      }));
      sections.push({ title: 'Senaste nyheter', content: [{ type: 'table', headers: ['Rubrik', 'Källa', 'Datum'], rows }] });
    }

    // Documents
    if (analysis.documents.irDocuments.length > 0) {
      const rows = analysis.documents.irDocuments.slice(0, 15).map((d) => ({ cells: [d.fileName, d.category || ''] }));
      sections.push({ title: 'Tillgängliga IR-dokument', content: [{ type: 'table', headers: ['Dokument', 'Kategori'], rows }] });
    }

    const sub = [id.ticker, id.isin, id.sector].filter(Boolean).join(' | ');
    const pdfBuffer = await generatePDFReport({
      reportType: 'Helhetsanalys',
      title: companyTitle,
      subtitle: sub || undefined,
      date: analysisDate,
      badges,
      sections,
    });

    const safeName = (companyTitle).replace(/[^a-zA-Z0-9åäöÅÄÖ\s_-]/g, '').trim().replace(/\s+/g, '_');
    const fileName = `Helhetsanalys_${safeName}_${analysisDate}.pdf`;

    if (session?.email) {
      archiveToDataroom({
        userEmail: session.email,
        userName: session.name || session.email || 'Användare',
        analysisType: 'helhetsanalys',
        fileName,
        pdfBuffer,
        skipIfExists: false,
      }).catch((e) => console.warn('[Helhetsanalys PDF] Archive failed:', e));
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error('[company-analysis/export-pdf]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PDF-generering misslyckades' },
      { status: 500 }
    );
  }
}
