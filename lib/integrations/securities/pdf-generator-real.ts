/**
 * Real PDF Generator for Security Approval Documents
 * Uses pdfkit to produce actual PDF files (not HTML).
 */

import PDFDocument from 'pdfkit';
import type { SecurityApprovalRequest } from './types';
import type { PDFESGLiveData } from './pdf-generator';

// ============================================================================
// Helpers
// ============================================================================

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function docId(a: SecurityApprovalRequest): string {
  const ds = new Date(a.createdAt).toISOString().slice(0, 10).replace(/-/g, '');
  return `AIFM-SEC-${ds}-${a.id.slice(-6).toUpperCase()}`;
}

function yesNo(v: boolean | undefined | null): string {
  return v ? 'Ja' : 'Nej';
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  submitted: 'Inskickad',
  under_review: 'Under granskning',
  approved: 'Godkänd',
  rejected: 'Avvisad',
  expired: 'Utgången',
};

const CATEGORY_LABELS: Record<string, string> = {
  transferable_security: 'Överlåtbart värdepapper',
  money_market: 'Penningmarknadsinstrument',
  fund_unit: 'Fondandelar',
  derivative: 'Derivat',
  other: 'Övrigt',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Aktie',
  bond: 'Obligation',
  etf: 'ETF',
  fund: 'Fond',
  certificate: 'Certifikat',
  warrant: 'Teckningsoption',
  option: 'Option',
  future: 'Termin',
  other: 'Övrigt',
};

// ============================================================================
// PDF Generator
// ============================================================================

export async function generateApprovalPDF(
  approval: SecurityApprovalRequest,
  esgLiveData?: PDFESGLiveData,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
        Title: `Godkännande - ${approval.basicInfo?.name ?? ''}`,
        Author: 'AIFM Platform',
        Subject: 'Värdepappersgodkännande',
      }});

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const GOLD = '#8b7355';
      const DARK = '#2d2a26';
      const GRAY = '#6b7280';
      const LIGHT_BG = '#f9fafb';

      // ── Header ──
      doc.fontSize(18).fillColor(DARK).text('Godkännande av nytt värdepapper', { align: 'left' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor(GOLD).text(docId(approval));
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor(GRAY).text(`Skapad: ${fmtDate(approval.createdAt)}  |  Status: ${STATUS_LABELS[approval.status] ?? approval.status}  |  Fond: ${approval.fundName}`);
      if (approval.reviewedAt) {
        doc.text(`Granskad: ${fmtDate(approval.reviewedAt)} av ${approval.reviewedBy ?? '-'}`);
      }
      doc.moveDown(0.6);

      // Draw a thin gold line
      const drawLine = () => {
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(GOLD).lineWidth(0.5).stroke();
        doc.moveDown(0.4);
      };

      // ── Section helper ──
      const section = (title: string) => {
        drawLine();
        doc.fontSize(12).fillColor(DARK).text(title, { underline: false });
        doc.moveDown(0.3);
      };

      // ── Key-value row ──
      const kv = (label: string, value: string | undefined | null) => {
        const y = doc.y;
        doc.fontSize(9).fillColor(GRAY).text(label, 50, y, { width: 180, continued: false });
        doc.fontSize(9).fillColor(DARK).text(value || '-', 235, y, { width: 310 });
        doc.moveDown(0.15);
      };

      // Check page space
      const ensureSpace = (needed: number = 60) => {
        if (doc.y + needed > doc.page.height - 60) doc.addPage();
      };

      // ══════════════════════════════════════════════════════════════
      // 1. Grundläggande information
      // ══════════════════════════════════════════════════════════════
      section('1. Grundläggande information');
      const bi = approval.basicInfo;
      kv('Namn', bi?.name);
      kv('ISIN', bi?.isin);
      kv('Ticker', bi?.ticker);
      kv('Kategori', CATEGORY_LABELS[bi?.category ?? ''] ?? bi?.category);
      kv('Typ', TYPE_LABELS[bi?.type ?? ''] ?? bi?.type);
      kv('Marknadsplats', bi?.marketPlace);
      kv('MIC', bi?.mic);
      kv('Valuta', bi?.currency);
      kv('Land', bi?.country);
      kv('Emittent', bi?.emitter);
      if (bi?.emitterLEI) kv('LEI', bi.emitterLEI);
      if (bi?.gicsSector) kv('GICS-sektor', bi.gicsSector);
      doc.moveDown(0.3);

      // ══════════════════════════════════════════════════════════════
      // 2. Fondförenlighet
      // ══════════════════════════════════════════════════════════════
      ensureSpace(100);
      section('2. Fondförenlighet');
      const fc = approval.fundCompliance;
      kv('Fond', `${fc?.fundName ?? '-'} (${fc?.fundId ?? '-'})`);
      kv('Motivering', fc?.complianceMotivation);
      if (fc?.placementRestrictions) kv('Placeringsregler', fc.placementRestrictions);
      doc.moveDown(0.3);

      // ══════════════════════════════════════════════════════════════
      // 3. FFFS 2013:9 24 kap. 1 §
      // ══════════════════════════════════════════════════════════════
      ensureSpace(120);
      section('3. Regulatoriskt – FFFS 2013:9');
      const rf = approval.regulatoryFFFS;
      kv('Begränsad förlust', yesNo(rf?.limitedPotentialLoss));
      kv('Likviditet ej äventyras', yesNo(rf?.liquidityNotEndangered));
      kv('Tillförlitlig värdering', yesNo(rf?.reliableValuation?.checked));
      kv('Adekvat information', yesNo(rf?.appropriateInformation?.checked));
      kv('Omsättbar', yesNo(rf?.isMarketable));
      kv('Förenlig med fond', yesNo(rf?.compatibleWithFund));
      kv('Riskhantering fångar', yesNo(rf?.riskManagementCaptures));
      doc.moveDown(0.3);

      // ══════════════════════════════════════════════════════════════
      // 4. LVF
      // ══════════════════════════════════════════════════════════════
      const lv = approval.regulatoryLVF;
      if (lv && (lv.stateGuaranteed || lv.nonVotingShares || lv.bondOrMoneyMarket || lv.significantInfluence)) {
        ensureSpace(80);
        section('4. Regulatoriskt – LVF 2004:46');
        if (lv.stateGuaranteed?.applicable) kv('Statsgaranti – max 35%', yesNo(lv.stateGuaranteed.maxExposure35Percent));
        if (lv.nonVotingShares?.applicable) kv('Rösträttslösa – max 10%', yesNo(lv.nonVotingShares.maxIssuedShares10Percent));
        if (lv.bondOrMoneyMarket?.applicable) kv('Obligationer – max 10%', yesNo(lv.bondOrMoneyMarket.maxIssuedInstruments10Percent));
        if (lv.significantInfluence) kv('Väsentligt inflytande', yesNo(lv.significantInfluence.willHaveInfluence));
        doc.moveDown(0.3);
      }

      // ══════════════════════════════════════════════════════════════
      // 5. Likviditetsanalys
      // ══════════════════════════════════════════════════════════════
      ensureSpace(100);
      section('5. Likviditetsanalys');
      const la = approval.liquidityAnalysis;
      if (la?.stockLiquidity) {
        kv('Presumtion ≥400 MSEK', yesNo(la.stockLiquidity.presumption400MSEK));
        kv('Likviderbar 1 dag', yesNo(la.stockLiquidity.canLiquidate1Day));
        kv('Likviderbar 2 dagar', yesNo(la.stockLiquidity.canLiquidate2Days));
        kv('Likviderbar 3 dagar', yesNo(la.stockLiquidity.canLiquidate3Days));
        kv('> 3 dagar', yesNo(la.stockLiquidity.moreThan3Days));
      }
      if (la?.portfolioIlliquidShareBefore != null) kv('Illikvid andel före', `${la.portfolioIlliquidShareBefore}%`);
      if (la?.portfolioIlliquidShareAfter != null) kv('Illikvid andel efter', `${la.portfolioIlliquidShareAfter}%`);
      if (la?.portfolioMotivation) kv('Portföljmotivering', la.portfolioMotivation);
      kv('FFFS likviditet ej äventyras', yesNo(la?.fffsLiquidityNotEndangered));
      kv('FFFS omsättbar', yesNo(la?.fffsIsMarketable));
      doc.moveDown(0.3);

      // ══════════════════════════════════════════════════════════════
      // 6. Värdering
      // ══════════════════════════════════════════════════════════════
      ensureSpace(80);
      section('6. Värdering');
      const vi = approval.valuationInfo;
      kv('Tillförlitliga dagspriser', yesNo(vi?.reliableDailyPrices));
      if (vi?.priceSourceUrl) kv('Priskälla (URL)', vi.priceSourceUrl);
      if (vi?.priceSourceComment) kv('Priskälla kommentar', vi.priceSourceComment);
      kv('Emission', yesNo(vi?.isEmission));
      if (vi?.emissionValuationMethod) kv('Värderingsmetod (emission)', vi.emissionValuationMethod);
      doc.moveDown(0.3);

      // ══════════════════════════════════════════════════════════════
      // 7. ESG
      // ══════════════════════════════════════════════════════════════
      ensureSpace(120);
      section('7. ESG / Hållbarhet');
      const esg = approval.esgInfo;
      kv('Artikel 8/9-fond', yesNo(esg?.article8Or9Fund));
      kv('Uppfyller exkluderingskriterier', yesNo(esg?.meetsExclusionCriteria));
      kv('Uppfyller hållbarhetsminimum', yesNo(esg?.meetsSustainableInvestmentMinimum));
      if (esg?.paiConsidered != null) kv('PAI beaktas', yesNo(esg.paiConsidered));
      if (esg?.environmentalCharacteristics) kv('Miljöegenskaper', esg.environmentalCharacteristics);
      if (esg?.socialCharacteristics) kv('Sociala egenskaper', esg.socialCharacteristics);

      // Live ESG data from provider
      if (esgLiveData) {
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor(GOLD).text('ESG-data (live)', { underline: false });
        doc.moveDown(0.2);
        if (esgLiveData.totalScore != null) kv('Total ESG-score', String(esgLiveData.totalScore));
        if (esgLiveData.environmentScore != null) kv('Miljö', String(esgLiveData.environmentScore));
        if (esgLiveData.socialScore != null) kv('Social', String(esgLiveData.socialScore));
        if (esgLiveData.governanceScore != null) kv('Styrning', String(esgLiveData.governanceScore));
        if (esgLiveData.sfdrAlignment) kv('SFDR', esgLiveData.sfdrAlignment);
        if (esgLiveData.carbonIntensity != null) kv('Koldioxidintensitet', `${esgLiveData.carbonIntensity} ${esgLiveData.carbonIntensityUnit ?? ''}`);
        if (esgLiveData.taxonomyAlignmentPercent != null) kv('Taxonomi-anpassning', `${esgLiveData.taxonomyAlignmentPercent}%`);
        if (esgLiveData.provider) kv('Datakälla', esgLiveData.provider);
      }
      doc.moveDown(0.3);

      // ══════════════════════════════════════════════════════════════
      // 8. Granskning
      // ══════════════════════════════════════════════════════════════
      if (approval.reviewComments || approval.rejectionReason) {
        ensureSpace(60);
        section('8. Granskning');
        if (approval.reviewComments) kv('Kommentarer', approval.reviewComments);
        if (approval.rejectionReason) kv('Avvisningsorsak', approval.rejectionReason);
        doc.moveDown(0.3);
      }

      // ── Footer ──
      ensureSpace(40);
      drawLine();
      doc.fontSize(8).fillColor(GRAY).text(
        `Genererad ${new Date().toLocaleDateString('sv-SE')} kl ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}  |  AIFM Platform  |  ${docId(approval)}`,
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
