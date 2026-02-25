/**
 * Premium PDF Generator for Security Approval Documents
 * Uses pdfkit with a strict typographic system for clean, professional output.
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import type { SecurityApprovalRequest } from './types';
import type { PDFESGLiveData } from './pdf-generator';
import { FUND_CONFIGURATIONS } from './fund-restrictions';

let _logoBuffer: Buffer | null = null;
function getLogoBuffer(): Buffer | null {
  if (_logoBuffer) return _logoBuffer;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'AIFM_logo.png');
    _logoBuffer = fs.readFileSync(logoPath);
    return _logoBuffer;
  } catch {
    return null;
  }
}

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

function formatLargeNumber(num?: number): string {
  if (!num) return '–';
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)} mdr SEK`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)} MSEK`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)} KSEK`;
  return `${num.toFixed(0)} SEK`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast', submitted: 'Inskickad', under_review: 'Under granskning',
  approved: 'Godkänd', rejected: 'Avvisad', expired: 'Utgången', needs_info: 'Komplettering begärd',
};

const CATEGORY_LABELS: Record<string, string> = {
  transferable_security: 'Överlåtbart värdepapper', money_market: 'Penningmarknadsinstrument',
  fund_unit: 'Fondandelar', derivative: 'Derivat', other: 'Övrigt',
};

const TYPE_LABELS: Record<string, string> = {
  stock: 'Aktie', bond: 'Obligation', etf: 'ETF', fund: 'Fond',
  certificate: 'Certifikat', warrant: 'Teckningsoption', option: 'Option',
  future: 'Termin', other: 'Övrigt',
};

const LISTING_LABELS: Record<string, string> = {
  regulated_market: 'Reglerad marknad', other_regulated: 'Annan reglerad marknad',
  planned_regulated: 'Planerad notering (reglerad)', planned_other: 'Planerad notering (annan)',
  unlisted: 'Onoterat', mtf: 'MTF', otc: 'OTC',
};

const VALUATION_LABELS: Record<string, string> = {
  market_price: 'Marknadspriser', independent_system: 'Oberoende värderingssystem',
  emitter_info: 'Information från emittent', investment_analysis: 'Kvalificerad investeringsanalys',
};

const INFO_TYPE_LABELS: Record<string, string> = {
  regular_market_info: 'Regelbunden information till marknaden',
  regular_fund_info: 'Regelbunden information till fondbolaget',
};

// Strict typographic scale: only 4 sizes used in body
const F = {
  TITLE: 18,
  SUBTITLE: 11,
  SECTION: 10,
  BODY: 8.5,
  SMALL: 7,
};

const C = {
  DARK: '#1a1a1a',
  HEADER_BG: '#2d2a26',
  GOLD: '#c0a280',
  GOLD_LIGHT: '#d4c5a0',
  MID: '#374151',
  GRAY: '#6b7280',
  LIGHT_GRAY: '#9ca3af',
  BORDER: '#e2e2e2',
  SECTION_BG: '#f5f4f1',
  TABLE_HEADER: '#eceae5',
  TABLE_ALT: '#fafaf8',
  WHITE: '#ffffff',
  GREEN: '#166534',
  GREEN_BG: '#f0fdf4',
  GREEN_BORDER: '#bbf7d0',
  RED: '#991b1b',
  RED_BG: '#fef2f2',
  RED_BORDER: '#fecaca',
  AMBER: '#92400e',
  AMBER_BG: '#fffbeb',
  BLUE: '#1e40af',
  BLUE_BG: '#eff6ff',
};

export async function generateApprovalPDF(
  approval: SecurityApprovalRequest,
  esgLiveData?: PDFESGLiveData,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Godkännande - ${approval.basicInfo?.name ?? ''}`,
          Author: 'AIFM Capital AB',
          Subject: 'Värdepappersgodkännande',
          Creator: 'AIFM Platform',
        },
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const LEFT = 50;
      const RIGHT = PAGE_W - 50;
      const CONTENT_W = RIGHT - LEFT;
      const BOTTOM = 58;

      const pagesWithContent = new Set<number>([0]);
      const markCurrentPage = () => {
        const range = doc.bufferedPageRange();
        pagesWithContent.add(range.start + range.count - 1);
      };
      const ensureSpace = (needed: number) => {
        if (doc.y + needed > PAGE_H - BOTTOM) {
          doc.addPage();
        }
      };

      const drawRect = (x: number, y: number, w: number, h: number, fill: string) => {
        doc.rect(x, y, w, h).fill(fill);
      };

      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
        doc.roundedRect(x, y, w, h, r).fill(fill);
      };

      const drawLine = (x1: number, y1: number, x2: number, y2: number, color: string, w = 0.5) => {
        doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(w).stroke();
      };

      // ─── Section header: clean bar with gold left accent ───
      const drawSection = (title: string) => {
        ensureSpace(44);
        markCurrentPage();
        doc.y += 10;
        const y = doc.y;
        drawRect(LEFT, y, CONTENT_W, 28, C.SECTION_BG);
        drawRect(LEFT, y, 3, 28, C.GOLD);
        doc.fontSize(F.SECTION).fillColor(C.DARK).font('Helvetica-Bold')
          .text(title, LEFT + 14, y + 8, { width: CONTENT_W - 24 });
        doc.y = y + 36;
      };

      // ─── Sub-section: simple bold label ───
      const drawSubLabel = (title: string) => {
        ensureSpace(18);
        markCurrentPage();
        doc.y += 6;
        doc.fontSize(F.BODY).fillColor(C.MID).font('Helvetica-Bold')
          .text(title, LEFT + 4, doc.y);
        doc.y += 14;
      };

      // ─── Key-value row ───
      const drawKV = (label: string, value: string | undefined | null, opts?: { color?: string }) => {
        ensureSpace(16);
        markCurrentPage();
        const y = doc.y;
        doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
          .text(label, LEFT + 4, y, { width: 170 });
        doc.fontSize(F.BODY).fillColor(opts?.color || C.DARK).font('Helvetica')
          .text(value || '–', LEFT + 178, y, { width: CONTENT_W - 188 });
        doc.y = y + 14;
      };

      // ─── Checkbox row ───
      const drawCheck = (label: string, checked: boolean) => {
        ensureSpace(16);
        markCurrentPage();
        const y = doc.y;
        if (checked) {
          drawRoundedRect(LEFT + 4, y, 11, 11, 2, C.GREEN);
          doc.fontSize(7).fillColor(C.WHITE).font('Helvetica-Bold')
            .text('✓', LEFT + 5.5, y + 1, { width: 8, align: 'center' });
        } else {
          doc.roundedRect(LEFT + 4, y, 11, 11, 2).lineWidth(0.75).strokeColor(C.BORDER).stroke();
        }
        doc.fontSize(F.BODY).fillColor(C.DARK).font('Helvetica')
          .text(label, LEFT + 22, y + 1, { width: CONTENT_W - 30 });
        doc.y = y + 16;
      };

      // ─── Table ───
      const drawTable = (
        headers: string[],
        rows: Array<{ cells: string[]; color?: string }>,
        colWidths?: number[]
      ) => {
        markCurrentPage();
        const cols = colWidths || headers.map(() => CONTENT_W / headers.length);
        const pad = 6;
        const headerH = 22;
        const minRowH = 20;

        ensureSpace(headerH + minRowH * Math.min(rows.length, 3) + 8);

        const hy = doc.y;
        drawRoundedRect(LEFT, hy, CONTENT_W, headerH, 3, C.TABLE_HEADER);
        let cx = LEFT;
        for (let i = 0; i < headers.length; i++) {
          doc.fontSize(F.SMALL).fillColor(C.GRAY).font('Helvetica-Bold')
            .text(headers[i].toUpperCase(), cx + pad, hy + 6, { width: cols[i] - pad * 2, lineBreak: false });
          cx += cols[i];
        }
        doc.y = hy + headerH;

        for (let r = 0; r < rows.length; r++) {
          let maxCellH = 0;
          for (let i = 0; i < headers.length; i++) {
            const cellText = rows[r].cells[i] || '–';
            const h = doc.fontSize(F.BODY).font('Helvetica').heightOfString(cellText, { width: cols[i] - pad * 2 });
            if (h > maxCellH) maxCellH = h;
          }
          const rowH = Math.max(minRowH, maxCellH + 10);

          if (doc.y + rowH > PAGE_H - BOTTOM) doc.addPage();
          const ry = doc.y;
          if (r % 2 === 1) drawRect(LEFT, ry, CONTENT_W, rowH, C.TABLE_ALT);

          cx = LEFT;
          for (let i = 0; i < headers.length; i++) {
            doc.fontSize(F.BODY).fillColor(rows[r].color || C.DARK).font('Helvetica')
              .text(rows[r].cells[i] || '–', cx + pad, ry + 5, { width: cols[i] - pad * 2 });
            cx += cols[i];
          }
          drawLine(LEFT, ry + rowH, LEFT + CONTENT_W, ry + rowH, '#eeeeee');
          doc.y = ry + rowH;
        }
        doc.y += 6;
      };

      // ─── Text block with left accent bar ───
      const drawTextBlock = (text: string) => {
        ensureSpace(28);
        markCurrentPage();
        const y = doc.y;
        const textW = CONTENT_W - 24;
        const h = doc.fontSize(F.BODY).font('Helvetica').heightOfString(text, { width: textW });
        const blockH = Math.max(h + 12, 22);

        drawRoundedRect(LEFT + 2, y, CONTENT_W - 4, blockH, 3, '#faf9f7');
        drawRect(LEFT + 2, y + 4, 2.5, blockH - 8, C.GOLD_LIGHT);

        doc.fontSize(F.BODY).fillColor(C.MID).font('Helvetica')
          .text(text, LEFT + 14, y + 6, { width: textW });
        doc.y = y + blockH + 4;
      };

      // ─── Info/status box ───
      const drawInfoBox = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
        ensureSpace(28);
        const y = doc.y;
        const palette = {
          info: { bg: C.BLUE_BG, fg: C.BLUE, icon: 'ℹ' },
          success: { bg: C.GREEN_BG, fg: C.GREEN, icon: '✓' },
          error: { bg: C.RED_BG, fg: C.RED, icon: '✗' },
        };
        const p = palette[type];
        const textW = CONTENT_W - 44;
        const h = doc.fontSize(F.BODY).font('Helvetica-Bold').heightOfString(text, { width: textW });
        const boxH = Math.max(h + 12, 24);

        drawRoundedRect(LEFT + 2, y, CONTENT_W - 4, boxH, 4, p.bg);
        doc.fontSize(10).fillColor(p.fg).font('Helvetica-Bold')
          .text(p.icon, LEFT + 12, y + 5);
        doc.fontSize(F.BODY).fillColor(p.fg).font('Helvetica-Bold')
          .text(text, LEFT + 28, y + 6, { width: textW });
        doc.y = y + boxH + 6;
      };

      // ─── Compliance badge ───
      const drawBadge = (label: string, passed: boolean, count?: string, total?: string) => {
        ensureSpace(24);
        const y = doc.y;
        const bg = passed ? C.GREEN_BG : C.RED_BG;
        const border = passed ? C.GREEN_BORDER : C.RED_BORDER;
        const fg = passed ? C.GREEN : C.RED;

        drawRoundedRect(LEFT + 2, y, CONTENT_W - 4, 22, 4, bg);
        doc.roundedRect(LEFT + 2, y, CONTENT_W - 4, 22, 4).lineWidth(0.5).strokeColor(border).stroke();
        doc.fontSize(F.BODY).fillColor(fg).font('Helvetica-Bold')
          .text(passed ? '✓' : '✗', LEFT + 12, y + 5);
        doc.fontSize(F.BODY).fillColor(fg).font('Helvetica')
          .text(label, LEFT + 26, y + 5, { width: CONTENT_W * 0.55 });
        if (count && total) {
          doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
            .text(`${count} / ${total}`, LEFT + CONTENT_W * 0.65, y + 5, { width: CONTENT_W * 0.3, align: 'right' });
        }
        doc.y = y + 28;
      };

      // ════════════════════════════════════════════════════════════
      // HEADER
      // ════════════════════════════════════════════════════════════

      drawRect(0, 0, PAGE_W, 82, C.HEADER_BG);
      const logo = getLogoBuffer();
      if (logo) {
        try { doc.image(logo, LEFT, 12, { height: 50 }); } catch { /* fallback below */ }
      }
      if (!logo) {
        doc.fontSize(22).fillColor(C.WHITE).font('Helvetica-Bold')
          .text('AIFM', LEFT, 18, { continued: true })
          .fillColor(C.GOLD).text('.', { continued: false });
        doc.fontSize(F.SMALL).fillColor('#64748b').font('Helvetica')
          .text('CAPITAL AB', LEFT, 44);
      }

      const statusText = STATUS_LABELS[approval.status] ?? approval.status;
      const statusColor = approval.status === 'approved' ? '#4ade80'
        : approval.status === 'rejected' ? '#f87171'
        : approval.status === 'submitted' || approval.status === 'under_review' ? C.GOLD
        : '#94a3b8';

      doc.fontSize(F.SMALL).fillColor(C.GOLD).font('Helvetica')
        .text(docId(approval), RIGHT - 180, 20, { width: 180, align: 'right' });
      doc.fontSize(F.SMALL).fillColor('#94a3b8').font('Helvetica')
        .text(fmtDate(approval.createdAt), RIGHT - 180, 32, { width: 180, align: 'right' });

      const sw = doc.widthOfString(statusText.toUpperCase()) + 18;
      drawRoundedRect(RIGHT - sw, 46, sw, 17, 8, statusColor);
      doc.fontSize(F.SMALL).fillColor(C.HEADER_BG).font('Helvetica-Bold')
        .text(statusText.toUpperCase(), RIGHT - sw, 50, { width: sw, align: 'center' });

      drawRect(0, 82, PAGE_W, 2.5, C.GOLD);
      doc.y = 98;

      // ════════════════════════════════════════════════════════════
      // TITLE
      // ════════════════════════════════════════════════════════════

      doc.fontSize(F.TITLE).fillColor(C.DARK).font('Helvetica-Bold')
        .text('Godkännande av nytt värdepapper', LEFT, doc.y);
      doc.y += 4;
      doc.fontSize(F.SUBTITLE).fillColor(C.MID).font('Helvetica')
        .text(approval.basicInfo?.name ?? '', LEFT);
      doc.y += 2;
      doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
        .text(`${approval.fundName}  •  ${approval.basicInfo?.ticker || ''}  •  ${approval.basicInfo?.isin || ''}`, LEFT);

      if (approval.reviewedAt) {
        doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY)
          .text(`Granskad: ${fmtDate(approval.reviewedAt)} av ${approval.reviewedBy ?? '–'}`);
      }
      doc.y += 12;

      // ════════════════════════════════════════════════════════════
      // 1. GRUNDLÄGGANDE INFORMATION
      // ════════════════════════════════════════════════════════════

      drawSection('1. Grundläggande information');

      const bi = approval.basicInfo;
      drawTable(
        ['Egenskap', 'Värde'],
        [
          { cells: ['Namn', bi?.name || '–'] },
          { cells: ['ISIN', bi?.isin || '–'] },
          { cells: ['Ticker', bi?.ticker || '–'] },
          { cells: ['Kategori', CATEGORY_LABELS[bi?.category ?? ''] ?? bi?.category ?? '–'] },
          { cells: ['Typ', TYPE_LABELS[bi?.type ?? ''] ?? bi?.type ?? '–'] },
          { cells: ['Noteringstyp', LISTING_LABELS[bi?.listingType ?? ''] ?? bi?.listingType ?? '–'] },
          { cells: ['Marknadsplats / MIC', `${bi?.marketPlace || '–'} / ${bi?.mic || '–'}`] },
          { cells: ['Valuta', bi?.currency || '–'] },
          { cells: ['Land', bi?.country || '–'] },
          { cells: ['Emittent', bi?.emitter || '–'] },
          ...(bi?.emitterLEI ? [{ cells: ['Emittent LEI', bi.emitterLEI] }] : []),
          ...(bi?.gicsSector ? [{ cells: ['GICS-sektor', bi.gicsSector] }] : []),
        ],
        [CONTENT_W * 0.35, CONTENT_W * 0.65]
      );

      if (bi?.conflictsOfInterest) {
        drawSubLabel('Intressekonflikter');
        drawTextBlock(bi.conflictsOfInterest);
      }

      // ════════════════════════════════════════════════════════════
      // 2. FONDFÖRENLIGHET
      // ════════════════════════════════════════════════════════════

      drawSection('2. Fondförenlighet & benchmark mot fondvillkor');

      const fc = approval.fundCompliance;
      drawKV('Fond', `${fc?.fundName ?? '–'} (${fc?.fundId ?? '–'})`);
      if (approval.plannedAcquisitionShare) {
        drawKV('Planerad positionsstorlek', `${approval.plannedAcquisitionShare}${parseFloat(approval.plannedAcquisitionShare) <= 100 ? '% av NAV' : ' SEK'}`);
      }
      if (approval.plannedPortfolioWeight) {
        drawKV('Planerad andel av fonden', `${approval.plannedPortfolioWeight}%`);
      }

      const fundConfig = FUND_CONFIGURATIONS[approval.fundId] || FUND_CONFIGURATIONS[fc?.fundId ?? ''];
      if (fundConfig) {
        drawSubLabel(`Fondvillkor – ${fundConfig.fundName} (Artikel ${fundConfig.article})`);
        drawTable(
          ['Restriktion', 'Gräns', 'Status'],
          [
            { cells: ['Max sektorexponering', `${(fundConfig.maxSectorWeight! * 100).toFixed(0)}%`, '–'] },
            { cells: ['Max landsexponering', `${(fundConfig.maxCountryWeight! * 100).toFixed(0)}%`, '–'] },
            { cells: ['Max emittentexponering', `${(fundConfig.maxIssuerWeight! * 100).toFixed(0)}%`, '–'] },
            { cells: ['Max illikvida tillgångar', `${(fundConfig.maxIlliquidWeight! * 100).toFixed(0)}%`, '–'] },
            { cells: ['Fondförmögenhet (AUM)', formatLargeNumber(fundConfig.aum), '–'] },
          ],
          [CONTENT_W * 0.45, CONTENT_W * 0.3, CONTENT_W * 0.25]
        );

        if (fundConfig.excludedSectors?.length) {
          drawKV('Exkluderade sektorer', fundConfig.excludedSectors.join(', '), { color: C.RED });
        }
        if (fundConfig.excludedCountries?.length) {
          drawKV('Exkluderade länder', fundConfig.excludedCountries.join(', '), { color: C.RED });
        }
        if (fundConfig.esgExclusions?.length) {
          drawKV('ESG-exkluderingar', fundConfig.esgExclusions.join(', '), { color: C.AMBER });
        }
      }

      if (fc?.complianceMotivation) {
        drawSubLabel('Motivering till fondförenlighet');
        drawTextBlock(fc.complianceMotivation);
      }
      if (fc?.placementRestrictions) {
        drawSubLabel('Hänvisning till placeringsbestämmelser');
        drawTextBlock(fc.placementRestrictions);
      }

      // ════════════════════════════════════════════════════════════
      // 3. FFFS 2013:9
      // ════════════════════════════════════════════════════════════

      drawSection('3. Regulatoriskt – FFFS 2013:9, 24 kap. 1 §');

      const rf = approval.regulatoryFFFS;
      drawCheck('1 pt. Den potentiella förlusten är begränsad till det betalda beloppet', !!rf?.limitedPotentialLoss);
      drawCheck('2 pt. Likviditeten äventyrar inte fondbolagets förmåga att uppfylla kraven i 4 kap. 13 § LVF', !!rf?.liquidityNotEndangered);

      drawSubLabel('3 pt. Tillförlitlig värdering');
      drawKV('Typ', VALUATION_LABELS[rf?.reliableValuation?.type ?? ''] ?? rf?.reliableValuation?.type ?? '–');
      drawCheck('Kravet uppfylls', !!rf?.reliableValuation?.checked);

      drawSubLabel('4 pt. Lämplig information tillgänglig');
      drawKV('Typ', INFO_TYPE_LABELS[rf?.appropriateInformation?.type ?? ''] ?? rf?.appropriateInformation?.type ?? '–');
      drawCheck('Kravet uppfylls', !!rf?.appropriateInformation?.checked);

      drawCheck('5 pt. Värdepappret är försäljningsbart', !!rf?.isMarketable);
      drawCheck('6 pt. Förvärvet är förenligt med fondens placeringsinriktning', !!rf?.compatibleWithFund);
      drawCheck('7 pt. Riskhanteringssystemet fångar upp riskerna', !!rf?.riskManagementCaptures);

      const fffsChecks = [
        rf?.limitedPotentialLoss, rf?.liquidityNotEndangered,
        rf?.reliableValuation?.checked, rf?.appropriateInformation?.checked,
        rf?.isMarketable, rf?.compatibleWithFund, rf?.riskManagementCaptures,
      ];
      const fffsPass = fffsChecks.filter(Boolean).length;
      doc.y += 4;
      drawBadge(
        fffsPass === fffsChecks.length ? 'Alla FFFS 2013:9-krav uppfyllda' : `${fffsPass}/${fffsChecks.length} FFFS-krav uppfyllda`,
        fffsPass === fffsChecks.length, String(fffsPass), String(fffsChecks.length)
      );

      // ════════════════════════════════════════════════════════════
      // 4. LVF
      // ════════════════════════════════════════════════════════════

      const lv = approval.regulatoryLVF;
      if (lv && (lv.stateGuaranteed || lv.nonVotingShares || lv.bondOrMoneyMarket || lv.significantInfluence)) {
        drawSection('4. Regulatoriskt – LVF 2004:46');
        if (lv.stateGuaranteed?.applicable) {
          drawCheck('5 kap. 6 § 1 pt. Garanterad av stat eller kommun', true);
          drawCheck('Max 35% emittentexponering uppfylls', !!lv.stateGuaranteed.maxExposure35Percent);
        }
        if (lv.nonVotingShares?.applicable) {
          drawCheck('5 kap. 19 § 1 pt. Aktier utan rösträtt', true);
          drawCheck('Max 10% av utgivna aktier uppfylls', !!lv.nonVotingShares.maxIssuedShares10Percent);
        }
        if (lv.bondOrMoneyMarket?.applicable) {
          drawCheck('5 kap. 19 § 2-3 pt. Obligation eller penningmarknadsinstrument', true);
          drawCheck('Max 10% av utgivna instrument uppfylls', !!lv.bondOrMoneyMarket.maxIssuedInstruments10Percent);
        }
        if (lv.significantInfluence) {
          drawCheck('5 kap. 20 § Möjlighet att utöva väsentligt inflytande', !!lv.significantInfluence.willHaveInfluence);
        }
      }

      // ════════════════════════════════════════════════════════════
      // 4b. FÖR FONDANDELAR (5 kap. 17-18 § LVF)
      // ════════════════════════════════════════════════════════════

      const fui = approval.fundUnitInfo;
      const isFundSecurity = approval.basicInfo?.category === 'fund_unit' ||
        approval.basicInfo?.type === 'fund' ||
        approval.basicInfo?.type === 'etf';
      if (fui || isFundSecurity) {
        const FUND_TYPE_LABELS: Record<string, string> = {
          ucits: 'UCITS-fond', ucits_like: 'UCITS-liknande fond',
          special_fund: 'Specialfond', aif: 'Alternativ investeringsfond (AIF)',
        };
        drawSection('4b. För fondandelar – 5 kap. 17-18 § LVF');
        drawKV('Fondtyp (målfond)', fui ? (FUND_TYPE_LABELS[fui.fundType] ?? fui.fundType ?? '–') : '–');
        if (fui?.complianceLinks?.length) {
          drawKV('Prospekt / fondbestämmelser', fui.complianceLinks.join(', '));
        }
        drawCheck('5 kap. 17 § Max 10% av fondmedlen i andelar i en och samma fond', !!fui?.maxOwnFundUnits10Percent);
        drawCheck('5 kap. 18 § Max 25% av målfondernas andelar förvärvas', !!fui?.maxTargetFundUnits25Percent);
      }

      // ════════════════════════════════════════════════════════════
      // 5. LIKVIDITETSANALYS
      // ════════════════════════════════════════════════════════════

      drawSection('5. Likviditetsanalys');

      const la = approval.liquidityAnalysis;

      if (la?.averageDailyValueSEK) {
        drawSubLabel('Genomsnittlig daglig omsättning (ADV)');
        drawTable(
          ['Daglig volym', `Pris (${bi?.currency || 'SEK'})`, 'Daglig omsättning (SEK)'],
          [{
            cells: [
              la.averageDailyVolume?.toLocaleString('sv-SE') ?? '–',
              la.averageDailyPrice?.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) ?? '–',
              formatLargeNumber(la.averageDailyValueSEK),
            ],
          }],
          [CONTENT_W * 0.33, CONTENT_W * 0.33, CONTENT_W * 0.34]
        );
      }

      if (la?.stockLiquidity) {
        drawSubLabel('Aktielikviditet');
        drawCheck('Likviditetspresumtion (genomsnittlig daglig volym > 400 MSEK)', !!la.stockLiquidity.presumption400MSEK);
        drawCheck('Kan likvideras inom 1 dag', !!la.stockLiquidity.canLiquidate1Day);
        drawCheck('Kan likvideras inom 2 dagar', !!la.stockLiquidity.canLiquidate2Days);
        drawCheck('Kan likvideras inom 3 dagar', !!la.stockLiquidity.canLiquidate3Days);
        drawCheck('Mer än 3 dagar', !!la.stockLiquidity.moreThan3Days);
      }

      if (la?.noHistoryEstimate) {
        drawSubLabel('IPO/Spin-off – uppskattad likviditet');
        drawTextBlock(la.noHistoryEstimate);
      }

      if (la?.portfolioIlliquidShareBefore != null || la?.portfolioIlliquidShareAfter != null) {
        drawSubLabel('Portföljpåverkan');
        drawTable(
          ['Mått', 'Värde'],
          [
            ...(la.portfolioIlliquidShareBefore != null ? [{ cells: ['Andel illikvida före transaktion', `${la.portfolioIlliquidShareBefore}%`] }] : []),
            ...(la.portfolioIlliquidShareAfter != null ? [{ cells: ['Andel illikvida efter transaktion', `${la.portfolioIlliquidShareAfter}%`] }] : []),
          ],
          [CONTENT_W * 0.6, CONTENT_W * 0.4]
        );
      }

      if (la?.portfolioMotivation) { drawSubLabel('Motivering till positionens storlek'); drawTextBlock(la.portfolioMotivation); }
      if (la?.howLiquidityRequirementMet) { drawSubLabel('Hur uppfylls kravet att likviditeten inte äventyras?'); drawTextBlock(la.howLiquidityRequirementMet); }
      if (la?.howMarketabilityRequirementMet) { drawSubLabel('Hur uppfylls kravet på försäljningsbarhet?'); drawTextBlock(la.howMarketabilityRequirementMet); }

      // ════════════════════════════════════════════════════════════
      // 6. VÄRDERING
      // ════════════════════════════════════════════════════════════

      drawSection('6. Värderingsinformation');

      const vi = approval.valuationInfo;
      drawCheck('Pålitliga priser finns tillgängliga dagligen', !!vi?.reliableDailyPrices);
      if (vi?.priceSourceUrl) drawKV('Priskälla (URL)', vi.priceSourceUrl);
      if (vi?.priceSourceComment) { drawSubLabel('Kommentar om priskälla'); drawTextBlock(vi.priceSourceComment); }
      drawCheck('Investering sker i samband med emission', !!vi?.isEmission);
      if (vi?.emissionValuationMethod) { drawSubLabel('Värderingsmetod för emissionspris'); drawTextBlock(vi.emissionValuationMethod); }
      if (vi?.proposedValuationMethod) { drawSubLabel('Förvaltarens förslag till värderingsmetod'); drawTextBlock(vi.proposedValuationMethod); }

      // ════════════════════════════════════════════════════════════
      // 7. ESG / HÅLLBARHET
      // ════════════════════════════════════════════════════════════

      drawSection('7. ESG / Hållbarhet');

      const esg = approval.esgInfo;

      if (esg?.article8Or9Fund) {
        drawInfoBox(`Fonden är klassificerad som Artikel ${esg.fundArticle || '8/9'} enligt SFDR`, 'info');

        if (esg.environmentalCharacteristics) { drawSubLabel('Miljörelaterade egenskaper som främjas'); drawTextBlock(esg.environmentalCharacteristics); }
        if (esg.socialCharacteristics) { drawSubLabel('Sociala egenskaper som främjas'); drawTextBlock(esg.socialCharacteristics); }

        drawCheck('Uppfyller fondens exkluderingskriterier', !!esg.meetsExclusionCriteria);
        drawCheck('Uppfyller minimum av hållbara investeringar', !!esg.meetsSustainableInvestmentMinimum);
        if (esg.paiConsidered != null) drawCheck('PAI (Principal Adverse Impacts) har beaktats', !!esg.paiConsidered);

        if (esg.article9NoSignificantHarm) { drawSubLabel('Artikel 9 – Ingen betydande skada för andra mål'); drawTextBlock(esg.article9NoSignificantHarm); }

        if (esg.article9GoodGovernance !== undefined || esg.article9OECDCompliant !== undefined || esg.article9UNGPCompliant !== undefined) {
          drawSubLabel('Artikel 9 – Ytterligare krav');
          if (esg.article9GoodGovernance !== undefined) drawCheck('God styrning (Good Governance)', !!esg.article9GoodGovernance);
          if (esg.article9OECDCompliant !== undefined) drawCheck('OECD-riktlinjer', !!esg.article9OECDCompliant);
          if (esg.article9UNGPCompliant !== undefined) drawCheck('FN:s vägledande principer', !!esg.article9UNGPCompliant);
        }

        if (esg.normScreening && Object.keys(esg.normScreening).length > 0) {
          drawSubLabel('Normbaserad screening');
          const rows = Object.entries(esg.normScreening).filter(([, v]) => v).map(([k, v]) => ({ cells: [k, String(v)] }));
          if (rows.length) drawTable(['Kategori', 'Resultat'], rows, [CONTENT_W * 0.5, CONTENT_W * 0.5]);
        }

        if (esg.exclusionResults && typeof esg.exclusionResults === 'object' && Object.keys(esg.exclusionResults).length > 0) {
          drawSubLabel('Exkluderingskontroll');
          const rows = Object.entries(esg.exclusionResults).map(([cat, r]) => {
            const result = r as { approved?: boolean; comment?: string };
            return { cells: [cat, result.approved ? 'Godkänd' : 'Ej godkänd', result.comment || '–'], color: result.approved ? C.GREEN : C.RED };
          });
          drawTable(['Kategori', 'Status', 'Kommentar'], rows, [CONTENT_W * 0.3, CONTENT_W * 0.2, CONTENT_W * 0.5]);
        }

        if (esg.governance && typeof esg.governance === 'object' && Object.keys(esg.governance).length > 0) {
          drawSubLabel('Good Governance');
          const rows = Object.entries(esg.governance).filter(([, v]) => v).map(([k, v]) => ({ cells: [k, String(v)] }));
          if (rows.length) drawTable(['Indikator', 'Värde'], rows, [CONTENT_W * 0.5, CONTENT_W * 0.5]);
        }

        if (esg.envRiskLevel || esg.socialRiskLevel || esg.govRiskLevel) {
          drawSubLabel('Riskbedömning');
          drawTable(['Risktyp', 'Nivå'], [
            ...(esg.envRiskLevel ? [{ cells: ['Miljörisk', esg.envRiskLevel] }] : []),
            ...(esg.socialRiskLevel ? [{ cells: ['Social risk', esg.socialRiskLevel] }] : []),
            ...(esg.govRiskLevel ? [{ cells: ['Styrningsrisk', esg.govRiskLevel] }] : []),
          ], [CONTENT_W * 0.5, CONTENT_W * 0.5]);
        }

        if (esg.ghgData) { drawSubLabel('GHG-data'); drawTextBlock(esg.ghgData); }

        if (esg.pai && Object.keys(esg.pai).length > 0) {
          drawSubLabel('PAI-indikatorer');
          const rows = Object.entries(esg.pai).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ({ cells: [k, String(v)] }));
          if (rows.length) drawTable(['Indikator', 'Värde'], rows, [CONTENT_W * 0.5, CONTENT_W * 0.5]);
        }

        if (esg.taxonomyQualifiedPercent != null || esg.taxonomyAlignedPercent != null) {
          drawSubLabel('EU Taxonomi');
          if (esg.taxonomyQualifiedPercent != null) drawKV('Taxonomi – Kvalificerad', `${esg.taxonomyQualifiedPercent}%`);
          if (esg.taxonomyAlignedPercent != null) drawKV('Taxonomi – Anpassad', `${esg.taxonomyAlignedPercent}%`);
        }

        if (esg.allocationBeforePercent != null || esg.allocationAfterPercent != null) {
          drawSubLabel('Allokering');
          if (esg.allocationBeforePercent != null) drawKV('Allokering före affär', `${esg.allocationBeforePercent}%`);
          if (esg.allocationAfterPercent != null) drawKV('Allokering efter affär', `${esg.allocationAfterPercent}%`);
        }

        if (esg.promotedCharacteristicsResult) { drawSubLabel('Främjade egenskaper – Resultat'); drawTextBlock(esg.promotedCharacteristicsResult); }

        if (esg.esgDecision) {
          const ok = esg.esgDecision === 'approved';
          drawInfoBox(
            `ESG-beslut: ${ok ? 'GODKÄND' : 'EJ GODKÄND'}${esg.esgDecisionMotivation ? ' – ' + esg.esgDecisionMotivation : ''}`,
            ok ? 'success' : 'error'
          );
        }

        if (esg.engagementRequired != null || esg.engagementComment) {
          drawSubLabel('Engagemangsprocess');
          if (esg.engagementRequired != null) drawCheck('Engagemang krävs', !!esg.engagementRequired);
          if (esg.engagementComment) drawTextBlock(esg.engagementComment);
        }
      } else {
        drawInfoBox('Fonden är klassificerad som Artikel 6 – Inga specifika ESG-krav gäller, men hållbarhetsrisker ska beaktas.', 'info');
      }

      // Live ESG data
      if (esgLiveData) {
        drawSubLabel(`ESG-data från ${esgLiveData.provider || 'extern leverantör'} (realtid)`);
        const rows: Array<{ cells: string[] }> = [];
        if (esgLiveData.totalScore != null) rows.push({ cells: ['Total ESG-poäng', `${esgLiveData.totalScore}/100`] });
        if (esgLiveData.environmentScore != null) rows.push({ cells: ['Miljö (E)', `${esgLiveData.environmentScore}/100`] });
        if (esgLiveData.socialScore != null) rows.push({ cells: ['Social (S)', `${esgLiveData.socialScore}/100`] });
        if (esgLiveData.governanceScore != null) rows.push({ cells: ['Styrning (G)', `${esgLiveData.governanceScore}/100`] });
        if (esgLiveData.sfdrAlignment) rows.push({ cells: ['SFDR-klassificering', esgLiveData.sfdrAlignment.replace('article_', 'Artikel ').replace('not_disclosed', 'Ej angiven')] });
        if (esgLiveData.taxonomyAlignmentPercent != null) rows.push({ cells: ['EU Taxonomi-anpassning', `${esgLiveData.taxonomyAlignmentPercent}%`] });
        if (esgLiveData.carbonIntensity != null) rows.push({ cells: ['Koldioxidintensitet', `${esgLiveData.carbonIntensity} ${esgLiveData.carbonIntensityUnit || ''}`] });
        if (rows.length) drawTable(['Indikator', 'Värde'], rows, [CONTENT_W * 0.5, CONTENT_W * 0.5]);

        if (esgLiveData.exclusionFlags?.length) {
          const flagRows = esgLiveData.exclusionFlags.filter(f => f.revenuePercent > 0)
            .map(f => ({ cells: [f.categoryDescription || f.category, `${f.revenuePercent.toFixed(1)}%`], color: C.RED }));
          if (flagRows.length) { drawSubLabel('Exponeringar identifierade'); drawTable(['Kategori', 'Intäktsandel'], flagRows, [CONTENT_W * 0.65, CONTENT_W * 0.35]); }
        }

        if (esgLiveData.fetchedAt) {
          doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica')
            .text(`Data hämtad: ${new Date(esgLiveData.fetchedAt).toLocaleString('sv-SE')}`, LEFT + 4, doc.y);
          doc.y += 10;
        }
      }

      // ════════════════════════════════════════════════════════════
      // 8. BESLUT
      // ════════════════════════════════════════════════════════════

      if (approval.status === 'approved' || approval.status === 'rejected') {
        drawSection('8. Beslut');
        const ok = approval.status === 'approved';
        drawInfoBox(`${ok ? 'GODKÄND' : 'AVVISAD'} – ${approval.basicInfo?.name ?? ''}`, ok ? 'success' : 'error');
        drawTable(['Egenskap', 'Värde'], [
          { cells: ['Status', STATUS_LABELS[approval.status] ?? approval.status], color: ok ? C.GREEN : C.RED },
          { cells: ['Beslutsdatum', approval.reviewedAt ? fmtDate(approval.reviewedAt) : '–'] },
          { cells: ['Granskare', approval.reviewedBy ?? '–'] },
          { cells: ['Granskare e-post', approval.reviewedByEmail ?? '–'] },
          ...(approval.expiresAt ? [{ cells: ['Godkännandet giltigt till', fmtDate(approval.expiresAt)] }] : []),
        ], [CONTENT_W * 0.35, CONTENT_W * 0.65]);
        if (approval.reviewComments) { drawSubLabel('Kommentarer'); drawTextBlock(approval.reviewComments); }
        if (approval.rejectionReason) { drawSubLabel('Avslagsorsak'); drawInfoBox(approval.rejectionReason, 'error'); }
      }

      // ════════════════════════════════════════════════════════════
      // SIGNATURES
      // ════════════════════════════════════════════════════════════

      ensureSpace(70);
      doc.y += 12;
      drawLine(LEFT, doc.y, RIGHT, doc.y, C.BORDER);
      doc.y += 14;

      doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica').text('SKAPAD AV', LEFT, doc.y);
      doc.y += 10;
      doc.fontSize(F.SECTION).fillColor(C.DARK).font('Helvetica-Bold').text(approval.createdBy, LEFT);
      doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
        .text(`${approval.createdByEmail}  •  ${fmtDate(approval.createdAt)}`);

      if (approval.reviewedBy) {
        doc.y += 10;
        doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica').text('GRANSKAD AV', LEFT);
        doc.y += 10;
        doc.fontSize(F.SECTION).fillColor(C.DARK).font('Helvetica-Bold').text(approval.reviewedBy, LEFT);
        doc.fontSize(F.BODY).fillColor(C.GRAY).font('Helvetica')
          .text(`${approval.reviewedByEmail || ''}${approval.reviewedAt ? '  •  ' + fmtDate(approval.reviewedAt) : ''}`);
      }

      // ════════════════════════════════════════════════════════════
      // FOOTER ON EVERY PAGE
      // ════════════════════════════════════════════════════════════

      const pages = doc.bufferedPageRange();
      const lastContentPage = pages.start + pages.count - 1;

      markCurrentPage();
      const lastUsedPage = (() => {
        for (let i = lastContentPage; i >= pages.start; i--) {
          if (pagesWithContent.has(i)) return i;
        }
        return pages.start;
      })();
      const totalPages = lastUsedPage - pages.start + 1;

      for (let i = pages.start; i <= lastUsedPage; i++) {
        doc.switchToPage(i);
        drawLine(LEFT, PAGE_H - 42, RIGHT, PAGE_H - 42, C.GOLD, 0.5);
        doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica')
          .text(`AIFM Capital AB  •  ${docId(approval)}  •  Konfidentiellt`, LEFT, PAGE_H - 34, { width: CONTENT_W * 0.75 });
        doc.fontSize(F.SMALL).fillColor(C.LIGHT_GRAY).font('Helvetica')
          .text(`Sida ${i + 1} av ${totalPages}`, LEFT, PAGE_H - 34, { width: CONTENT_W, align: 'right' });
      }

      // Switch back to the last used page before ending to prevent pdfkit
      // from appending an extra blank page after switchToPage iteration.
      doc.switchToPage(lastUsedPage);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
