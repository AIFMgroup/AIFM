/**
 * PDF Generator for Security Approval Documents
 * Uses the shared AIFM HTML PDF template for consistent, professional design.
 */

import type { SecurityApprovalRequest } from './types';
import {
  generateHTMLPDF,
  htmlSection,
  htmlKVGrid,
  htmlTextBlock,
  htmlCheckList,
  htmlTable,
  htmlSignature,
  htmlDecisionBox,
  htmlSummaryBox,
} from '@/lib/pdf/html-pdf-template';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function generateDocumentId(approval: SecurityApprovalRequest): string {
  const date = new Date(approval.createdAt);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `AIFM-SEC-${dateStr}-${approval.id.slice(-6).toUpperCase()}`;
}

export interface PDFESGLiveData {
  totalScore?: number | null;
  environmentScore?: number | null;
  socialScore?: number | null;
  governanceScore?: number | null;
  sfdrAlignment?: string;
  taxonomyAlignmentPercent?: number | null;
  carbonIntensity?: number | null;
  carbonIntensityUnit?: string;
  meetsExclusionCriteria?: boolean;
  exclusionFlags?: Array<{ category: string; categoryDescription: string; revenuePercent: number }>;
  provider?: string;
  fetchedAt?: string;
}

export function generateApprovalPDFContent(
  approval: SecurityApprovalRequest,
  sources?: Record<string, { source: string; url?: string; confidence?: string }>,
  baseUrl: string = 'https://app.aifm.se',
  esgLiveData?: PDFESGLiveData
): string {
  const documentId = generateDocumentId(approval);
  const v = (val?: string | null) => val || 'Ej angiven';

  const statusBadge = (): { label: string; value: string; color: 'green' | 'red' | 'gold' | 'gray' } => {
    const labels: Record<string, { value: string; color: 'green' | 'red' | 'gold' | 'gray' }> = {
      approved: { value: 'Godkänd', color: 'green' },
      rejected: { value: 'Avvisad', color: 'red' },
      submitted: { value: 'Inskickad', color: 'gold' },
      under_review: { value: 'Granskas', color: 'gold' },
      draft: { value: 'Utkast', color: 'gray' },
      expired: { value: 'Utgången', color: 'gray' },
    };
    const s = labels[approval.status] || { value: approval.status, color: 'gray' as const };
    return { label: 'Status', ...s };
  };

  // --- Section 1: Basic Information ---
  const sec1 = htmlSection('1. Grundläggande information',
    htmlKVGrid([
      { label: 'Namn', value: v(approval.basicInfo.name) },
      { label: 'ISIN', value: v(approval.basicInfo.isin) },
      { label: 'Ticker', value: v(approval.basicInfo.ticker) },
      { label: 'MIC/Börs', value: v(approval.basicInfo.mic || approval.basicInfo.marketPlace) },
      { label: 'Valuta', value: v(approval.basicInfo.currency) },
      { label: 'Land', value: v(approval.basicInfo.country) },
      { label: 'Kategori', value: getCategoryLabel(approval.basicInfo.category) },
      { label: 'Typ', value: getTypeLabel(approval.basicInfo.type) },
      { label: 'Noteringstyp', value: getListingTypeLabel(approval.basicInfo.listingType) },
      { label: 'Emittent', value: v(approval.basicInfo.emitter) },
      { label: 'Emittent LEI', value: v(approval.basicInfo.emitterLEI) },
      { label: 'GICS-sektor', value: v(approval.basicInfo.gicsSector) },
    ])
    + (approval.basicInfo.conflictsOfInterest
      ? `<h3>Eventuella intressekonflikter</h3>${htmlTextBlock(approval.basicInfo.conflictsOfInterest)}`
      : '')
  );

  // --- Section 2: Fund Compliance ---
  const sec2 = htmlSection('2. Fondöverensstämmelse',
    htmlKVGrid([
      { label: 'Fond', value: v(approval.fundCompliance.fundName) },
      { label: 'Fond-ID', value: v(approval.fundCompliance.fundId) },
      ...(approval.plannedAcquisitionShare
        ? [{ label: 'Planerad positionsstorlek', value: `${approval.plannedAcquisitionShare}${parseFloat(approval.plannedAcquisitionShare) <= 100 ? '% av NAV' : ' SEK'}` }]
        : []),
      ...(approval.plannedPortfolioWeight
        ? [{ label: 'Planerad andel av fonden', value: `${approval.plannedPortfolioWeight}%` }]
        : []),
    ])
    + `<h3>Förenlighet med fondens placeringsbestämmelser</h3>`
    + htmlTextBlock(approval.fundCompliance.complianceMotivation || 'Ej angiven')
    + (approval.fundCompliance.placementRestrictions
      ? `<h3>Hänvisning till placeringsbestämmelser</h3>${htmlTextBlock(approval.fundCompliance.placementRestrictions)}`
      : '')
  );

  // --- Section 3: FFFS 2013:9 ---
  const sec3 = htmlSection('3. Regulatoriska krav – FFFS 2013:9, 24 kap. 1 §',
    htmlSummaryBox('Krav på överlåtbara värdepapper enligt Finansinspektionens föreskrifter')
    + htmlCheckList([
      { label: '1 pt. Den potentiella förlusten är begränsad till det betalda beloppet', checked: !!approval.regulatoryFFFS.limitedPotentialLoss },
      { label: '2 pt. Likviditeten äventyrar inte fondbolagets förmåga att uppfylla kraven i 4 kap. 13 § LVF', checked: !!approval.regulatoryFFFS.liquidityNotEndangered },
    ])
    + `<h3>3 pt. Tillförlitlig värdering</h3>`
    + htmlKVGrid([{ label: 'Typ', value: getValuationTypeLabel(approval.regulatoryFFFS.reliableValuation.type) }])
    + htmlCheckList([{ label: 'Kravet uppfylls', checked: !!approval.regulatoryFFFS.reliableValuation.checked }])
    + `<h3>4 pt. Lämplig information tillgänglig</h3>`
    + htmlKVGrid([{ label: 'Typ', value: getInfoTypeLabel(approval.regulatoryFFFS.appropriateInformation.type) }])
    + htmlCheckList([{ label: 'Kravet uppfylls', checked: !!approval.regulatoryFFFS.appropriateInformation.checked }])
    + htmlCheckList([
      { label: '5 pt. Värdepappret är försäljningsbart', checked: !!approval.regulatoryFFFS.isMarketable },
      { label: '6 pt. Förvärvet är förenligt med fondens placeringsinriktning', checked: !!approval.regulatoryFFFS.compatibleWithFund },
      { label: '7 pt. Riskhanteringssystemet fångar upp riskerna', checked: !!approval.regulatoryFFFS.riskManagementCaptures },
    ])
  );

  // --- Section 4: LVF ---
  let sec4 = '';
  if (approval.regulatoryLVF && Object.keys(approval.regulatoryLVF).length > 0) {
    const lvfChecks: Array<{ label: string; checked: boolean }> = [];
    if (approval.regulatoryLVF.stateGuaranteed?.applicable) {
      lvfChecks.push({ label: '5 kap. 6 § 1 pt. Garanterad av stat eller kommun', checked: true });
      lvfChecks.push({ label: 'Max 35% emittentexponering uppfylls', checked: !!approval.regulatoryLVF.stateGuaranteed.maxExposure35Percent });
    }
    if (approval.regulatoryLVF.nonVotingShares?.applicable) {
      lvfChecks.push({ label: '5 kap. 19 § 1 pt. Aktier utan rösträtt', checked: true });
      lvfChecks.push({ label: 'Max 10% av utgivna aktier uppfylls', checked: !!approval.regulatoryLVF.nonVotingShares.maxIssuedShares10Percent });
    }
    if (approval.regulatoryLVF.bondOrMoneyMarket?.applicable) {
      lvfChecks.push({ label: '5 kap. 19 § 2-3 pt. Obligation eller penningmarknadsinstrument', checked: true });
      lvfChecks.push({ label: 'Max 10% av utgivna instrument uppfylls', checked: !!approval.regulatoryLVF.bondOrMoneyMarket.maxIssuedInstruments10Percent });
    }
    if (approval.regulatoryLVF.significantInfluence) {
      lvfChecks.push({ label: '5 kap. 20 § Möjlighet att utöva väsentligt inflytande', checked: !!approval.regulatoryLVF.significantInfluence.willHaveInfluence });
    }
    if (lvfChecks.length > 0) {
      sec4 = htmlSection('4. Regulatoriska krav – LVF 2004:46', htmlCheckList(lvfChecks));
    }
  }

  // --- Section 4b: Fund Unit Specifics ---
  let sec4b = '';
  if (approval.fundUnitInfo) {
    const fui = approval.fundUnitInfo;
    const fundTypeLabels: Record<string, string> = {
      ucits: 'UCITS-fond', ucits_like: 'UCITS-liknande fond',
      special_fund: 'Specialfond', aif: 'Alternativ investeringsfond (AIF)',
    };
    sec4b = htmlSection('4b. För fondandelar – 5 kap. 17-18 § LVF',
      htmlKVGrid([
        { label: 'Fondtyp (målfond)', value: fundTypeLabels[fui.fundType] ?? fui.fundType ?? 'Ej angiven' },
        ...(fui.complianceLinks?.length
          ? [{ label: 'Prospekt / fondbestämmelser', value: fui.complianceLinks.join(', ') }]
          : []),
      ])
      + htmlCheckList([
        { label: '5 kap. 17 § Max 10% av fondmedlen i andelar i en och samma fond', checked: !!fui.maxOwnFundUnits10Percent },
        { label: '5 kap. 18 § Max 25% av målfondernas andelar förvärvas', checked: !!fui.maxTargetFundUnits25Percent },
      ])
    );
  }

  // --- Section 5: Liquidity Analysis ---
  let liquidityContent = '';
  liquidityContent += htmlKVGrid([{ label: 'Typ av instrument', value: getInstrumentTypeLabel(approval.liquidityAnalysis.instrumentType) }]);

  if (approval.liquidityAnalysis.averageDailyValueSEK) {
    liquidityContent += `<h3>Genomsnittlig daglig omsättning (ADV)</h3>`;
    liquidityContent += htmlTable(
      ['Genomsnittlig daglig volym', `Pris (${approval.basicInfo.currency || 'SEK'})`, 'Daglig omsättning (SEK)'],
      [[
        `${approval.liquidityAnalysis.averageDailyVolume?.toLocaleString('sv-SE') || '-'} st`,
        `${approval.liquidityAnalysis.averageDailyPrice?.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) || '-'}`,
        formatLargeNumber(approval.liquidityAnalysis.averageDailyValueSEK),
      ]]
    );
  }

  if (approval.liquidityAnalysis.stockLiquidity) {
    liquidityContent += `<h3>Aktielikviditet</h3>`;
    liquidityContent += htmlCheckList([
      { label: 'Likviditetspresumtion (genomsnittlig daglig volym > 400 MSEK)', checked: !!approval.liquidityAnalysis.stockLiquidity.presumption400MSEK },
      { label: 'Kan likvideras inom 1 dag (Position/Daglig volym <85%)', checked: !!approval.liquidityAnalysis.stockLiquidity.canLiquidate1Day },
      { label: 'Kan likvideras inom 2 dagar (Position/Daglig volym <170%)', checked: !!approval.liquidityAnalysis.stockLiquidity.canLiquidate2Days },
      { label: 'Kan likvideras inom 3 dagar (Position/Daglig volym <250%)', checked: !!approval.liquidityAnalysis.stockLiquidity.canLiquidate3Days },
      { label: 'Mer än 3 dagar (Position/Daglig volym >250%)', checked: !!approval.liquidityAnalysis.stockLiquidity.moreThan3Days },
    ]);
  }

  if (approval.liquidityAnalysis.noHistoryEstimate) {
    liquidityContent += `<h3>IPO/Spin-off – uppskattad likviditet</h3>`;
    liquidityContent += htmlTextBlock(approval.liquidityAnalysis.noHistoryEstimate);
  }

  const illiquidKV: Array<{ label: string; value: string }> = [];
  if (approval.liquidityAnalysis.portfolioIlliquidShareBefore != null) {
    illiquidKV.push({ label: 'Andel illikvida före transaktion', value: `${approval.liquidityAnalysis.portfolioIlliquidShareBefore}%` });
  }
  if (approval.liquidityAnalysis.portfolioIlliquidShareAfter != null) {
    illiquidKV.push({ label: 'Andel illikvida efter transaktion', value: `${approval.liquidityAnalysis.portfolioIlliquidShareAfter}%` });
  }
  if (illiquidKV.length > 0) liquidityContent += htmlKVGrid(illiquidKV);

  if (approval.liquidityAnalysis.portfolioMotivation) {
    liquidityContent += `<h3>Motivering till positionens storlek</h3>`;
    liquidityContent += htmlTextBlock(approval.liquidityAnalysis.portfolioMotivation);
  }
  if (approval.liquidityAnalysis.howLiquidityRequirementMet) {
    liquidityContent += `<h3>Hur uppfylls kravet att likviditeten inte äventyras?</h3>`;
    liquidityContent += htmlTextBlock(approval.liquidityAnalysis.howLiquidityRequirementMet);
  }
  if (approval.liquidityAnalysis.howMarketabilityRequirementMet) {
    liquidityContent += `<h3>Hur uppfylls kravet på försäljningsbarhet?</h3>`;
    liquidityContent += htmlTextBlock(approval.liquidityAnalysis.howMarketabilityRequirementMet);
  }

  const sec5 = htmlSection('5. Likviditetsanalys', liquidityContent);

  // --- Section 6: Valuation ---
  let valuationContent = '';
  valuationContent += htmlCheckList([
    { label: 'Pålitliga priser finns tillgängliga dagligen', checked: !!approval.valuationInfo.reliableDailyPrices },
  ]);
  if (approval.valuationInfo.priceSourceUrl) {
    valuationContent += htmlKVGrid([{ label: 'Priskälla', value: approval.valuationInfo.priceSourceUrl }]);
  }
  if (approval.valuationInfo.priceSourceComment) {
    valuationContent += `<h3>Kommentar om priskälla</h3>`;
    valuationContent += htmlTextBlock(approval.valuationInfo.priceSourceComment);
  }
  valuationContent += htmlCheckList([
    { label: 'Investering sker i samband med emission', checked: !!approval.valuationInfo.isEmission },
  ]);
  if (approval.valuationInfo.emissionValuationMethod) {
    valuationContent += `<h3>Värderingsmetod för emissionspris</h3>`;
    valuationContent += htmlTextBlock(approval.valuationInfo.emissionValuationMethod);
  }
  if (approval.valuationInfo.proposedValuationMethod) {
    valuationContent += `<h3>Förvaltarens förslag till värderingsmetod</h3>`;
    valuationContent += htmlTextBlock(approval.valuationInfo.proposedValuationMethod);
  }
  const sec6 = htmlSection('6. Värderingsinformation', valuationContent);

  // --- Section 7: ESG ---
  let esgContent = '';
  if (approval.esgInfo.article8Or9Fund) {
    esgContent += htmlSummaryBox(
      `Fonden är klassificerad som Artikel ${approval.esgInfo.fundArticle || '8/9'} enligt SFDR`
    );

    if (approval.esgInfo.environmentalCharacteristics) {
      esgContent += `<h3>Miljörelaterade egenskaper som främjas</h3>`;
      esgContent += htmlTextBlock(approval.esgInfo.environmentalCharacteristics);
    }
    if (approval.esgInfo.socialCharacteristics) {
      esgContent += `<h3>Sociala egenskaper som främjas</h3>`;
      esgContent += htmlTextBlock(approval.esgInfo.socialCharacteristics);
    }

    esgContent += htmlCheckList([
      { label: 'Uppfyller fondens exkluderingskriterier', checked: !!approval.esgInfo.meetsExclusionCriteria },
      { label: 'Uppfyller minimum av hållbara investeringar', checked: !!approval.esgInfo.meetsSustainableInvestmentMinimum },
      { label: 'PAI (Principal Adverse Impacts) har beaktats', checked: !!approval.esgInfo.paiConsidered },
    ]);

    if (approval.esgInfo.article9NoSignificantHarm) {
      esgContent += `<h3>Artikel 9 – Ingen betydande skada för andra mål</h3>`;
      esgContent += htmlTextBlock(approval.esgInfo.article9NoSignificantHarm);
    }

    const art9Checks: Array<{ label: string; checked: boolean }> = [];
    if (approval.esgInfo.article9GoodGovernance !== undefined) {
      art9Checks.push({ label: 'Artikel 9 – God styrning', checked: !!approval.esgInfo.article9GoodGovernance });
    }
    if (approval.esgInfo.article9OECDCompliant !== undefined) {
      art9Checks.push({ label: 'Artikel 9 – OECD-riktlinjer', checked: !!approval.esgInfo.article9OECDCompliant });
    }
    if (approval.esgInfo.article9UNGPCompliant !== undefined) {
      art9Checks.push({ label: 'Artikel 9 – FN:s vägledande principer', checked: !!approval.esgInfo.article9UNGPCompliant });
    }
    if (art9Checks.length > 0) esgContent += htmlCheckList(art9Checks);

    if (approval.esgInfo.normScreening && Object.keys(approval.esgInfo.normScreening).length > 0) {
      esgContent += `<h3>Normbaserad screening</h3>`;
      const screeningRows = Object.entries(approval.esgInfo.normScreening)
        .filter(([, val]) => val)
        .map(([key, val]) => [key, String(val)]);
      if (screeningRows.length > 0) {
        esgContent += htmlTable(['Kategori', 'Resultat'], screeningRows);
      }
    }

    if (approval.esgInfo.exclusionResults && Object.keys(approval.esgInfo.exclusionResults).length > 0) {
      esgContent += `<h3>Exkluderingskontroll</h3>`;
      const exclRows = Object.entries(approval.esgInfo.exclusionResults).map(([cat, r]) => [
        cat,
        r.approved ? 'Godkänd' : 'Ej godkänd',
        r.comment || '–',
      ]);
      esgContent += htmlTable(['Kategori', 'Status', 'Kommentar'], exclRows);
    }

    if (approval.esgInfo.governance && Object.keys(approval.esgInfo.governance).length > 0) {
      esgContent += `<h3>Good Governance</h3>`;
      const govRows = Object.entries(approval.esgInfo.governance)
        .filter(([, val]) => val)
        .map(([key, val]) => [key, String(val)]);
      if (govRows.length > 0) esgContent += htmlTable(['Indikator', 'Värde'], govRows);
    }

    if (approval.esgInfo.envRiskLevel || approval.esgInfo.socialRiskLevel || approval.esgInfo.govRiskLevel) {
      esgContent += htmlKVGrid([
        { label: 'Miljörisk', value: v(approval.esgInfo.envRiskLevel) },
        { label: 'Social risk', value: v(approval.esgInfo.socialRiskLevel) },
        { label: 'Styrningsrisk', value: v(approval.esgInfo.govRiskLevel) },
      ]);
    }

    if (approval.esgInfo.ghgData) {
      esgContent += `<h3>GHG-data</h3>`;
      esgContent += htmlTextBlock(approval.esgInfo.ghgData);
    }

    if (approval.esgInfo.pai && Object.keys(approval.esgInfo.pai).length > 0) {
      esgContent += `<h3>PAI-indikatorer</h3>`;
      const paiRows = Object.entries(approval.esgInfo.pai)
        .filter(([, val]) => val !== undefined && val !== null && val !== '')
        .map(([key, val]) => [key, String(val)]);
      if (paiRows.length > 0) esgContent += htmlTable(['Indikator', 'Värde'], paiRows);
    }

    if (approval.esgInfo.sustainableGoalCategory) {
      esgContent += htmlKVGrid([
        { label: 'Hållbarhetsmålskategori', value: approval.esgInfo.sustainableGoalCategory },
        ...(approval.esgInfo.revenueCapExFromSustainable
          ? [{ label: 'Omsättning/CAPEX', value: approval.esgInfo.revenueCapExFromSustainable }]
          : []),
      ]);
    }

    const taxKV: Array<{ label: string; value: string }> = [];
    if (approval.esgInfo.taxonomyQualifiedPercent != null && approval.esgInfo.taxonomyQualifiedPercent !== '') {
      taxKV.push({ label: 'Taxonomi – Kvalificerad', value: `${approval.esgInfo.taxonomyQualifiedPercent}%` });
    }
    if (approval.esgInfo.taxonomyAlignedPercent != null && approval.esgInfo.taxonomyAlignedPercent !== '') {
      taxKV.push({ label: 'Taxonomi – Anpassad', value: `${approval.esgInfo.taxonomyAlignedPercent}%` });
    }
    if (taxKV.length > 0) esgContent += htmlKVGrid(taxKV);

    const allocKV: Array<{ label: string; value: string }> = [];
    if (approval.esgInfo.allocationBeforePercent != null && approval.esgInfo.allocationBeforePercent !== '') {
      allocKV.push({ label: 'Allokering före affär', value: `${approval.esgInfo.allocationBeforePercent}%` });
    }
    if (approval.esgInfo.allocationAfterPercent != null && approval.esgInfo.allocationAfterPercent !== '') {
      allocKV.push({ label: 'Allokering efter affär', value: `${approval.esgInfo.allocationAfterPercent}%` });
    }
    if (allocKV.length > 0) esgContent += htmlKVGrid(allocKV);

    if (approval.esgInfo.promotedCharacteristicsResult) {
      esgContent += `<h3>Främjade egenskaper</h3>`;
      esgContent += htmlTextBlock(approval.esgInfo.promotedCharacteristicsResult);
    }

    if (approval.esgInfo.esgDecision) {
      esgContent += htmlDecisionBox(
        approval.esgInfo.esgDecision === 'approved' ? 'approved' : 'rejected',
        `Slutgiltigt ESG-beslut${approval.esgInfo.esgDecisionMotivation ? ': ' + approval.esgInfo.esgDecisionMotivation : ''}`
      );
    }

    if (approval.esgInfo.engagementRequired != null || approval.esgInfo.engagementComment) {
      esgContent += `<h3>Engagemangsprocess</h3>`;
      const engText = (approval.esgInfo.engagementRequired === true ? 'Engagemang krävs' : approval.esgInfo.engagementRequired === false ? 'Engagemang krävs inte' : '')
        + (approval.esgInfo.engagementComment ? ' – ' + approval.esgInfo.engagementComment : '');
      esgContent += htmlTextBlock(engText);
    }
  } else {
    esgContent += htmlSummaryBox(
      'Fonden är klassificerad som Artikel 6 – Inga specifika ESG-krav gäller, men hållbarhetsrisker ska beaktas i investeringsbeslutet.'
    );
  }

  // Live ESG data
  if (esgLiveData) {
    esgContent += `<h3>ESG-data från ${esgLiveData.provider || 'extern leverantör'} (realtid)</h3>`;
    const liveKV: Array<{ label: string; value: string; status?: 'ok' | 'warn' | 'fail' | 'neutral' }> = [];
    if (esgLiveData.totalScore != null) liveKV.push({ label: 'Total ESG-poäng', value: `${esgLiveData.totalScore}/100` });
    if (esgLiveData.environmentScore != null) liveKV.push({ label: 'Miljö (E)', value: `${esgLiveData.environmentScore}/100` });
    if (esgLiveData.socialScore != null) liveKV.push({ label: 'Social (S)', value: `${esgLiveData.socialScore}/100` });
    if (esgLiveData.governanceScore != null) liveKV.push({ label: 'Styrning (G)', value: `${esgLiveData.governanceScore}/100` });
    if (esgLiveData.sfdrAlignment) liveKV.push({ label: 'SFDR-klassificering', value: esgLiveData.sfdrAlignment.replace('article_', 'Artikel ').replace('not_disclosed', 'Ej angiven') });
    if (esgLiveData.taxonomyAlignmentPercent != null) liveKV.push({ label: 'EU Taxonomi-anpassning', value: `${esgLiveData.taxonomyAlignmentPercent}%` });
    if (esgLiveData.carbonIntensity != null) liveKV.push({ label: 'Koldioxidintensitet', value: `${esgLiveData.carbonIntensity} ${esgLiveData.carbonIntensityUnit || ''}` });
    if (liveKV.length > 0) esgContent += htmlKVGrid(liveKV);

    if (esgLiveData.exclusionFlags && esgLiveData.exclusionFlags.length > 0) {
      const flagRows = esgLiveData.exclusionFlags
        .filter(f => f.revenuePercent > 0)
        .map(f => [f.categoryDescription || f.category, `${f.revenuePercent.toFixed(1)}%`]);
      if (flagRows.length > 0) {
        esgContent += htmlTable(['Kategori', 'Intäktsandel'], flagRows);
      }
    }

    if (esgLiveData.fetchedAt) {
      esgContent += `<p style="font-size:8pt;color:#9ca3af;margin-top:6px">Data hämtad: ${new Date(esgLiveData.fetchedAt).toLocaleString('sv-SE')}</p>`;
    }
  }

  const sec7 = htmlSection('7. ESG-relaterad information', esgContent);

  // --- Section 8: Decision ---
  let sec8 = '';
  if (approval.status === 'approved' || approval.status === 'rejected') {
    let decisionContent = '';
    decisionContent += htmlKVGrid([
      { label: 'Status', value: getStatusLabel(approval.status), status: approval.status === 'approved' ? 'ok' : 'fail' },
      { label: 'Beslutsdatum', value: approval.reviewedAt ? formatDate(approval.reviewedAt) : 'Ej angiven' },
      { label: 'Granskare', value: v(approval.reviewedBy) },
      { label: 'Granskare e-post', value: v(approval.reviewedByEmail) },
    ]);
    if (approval.reviewComments) {
      decisionContent += `<h3>Kommentarer</h3>`;
      decisionContent += htmlTextBlock(approval.reviewComments);
    }
    if (approval.rejectionReason) {
      decisionContent += htmlDecisionBox('rejected', `Avslagsorsak: ${approval.rejectionReason}`);
    }
    if (approval.expiresAt) {
      decisionContent += htmlKVGrid([{ label: 'Godkännandet giltigt till', value: formatDate(approval.expiresAt) }]);
    }
    sec8 = htmlSection('8. Beslut', decisionContent);
  }

  // --- Signatures ---
  const sigSections: Array<{ label: string; name: string; detail?: string }> = [
    { label: 'Skapad av', name: approval.createdBy, detail: `${approval.createdByEmail} | ${formatDate(approval.createdAt)}` },
  ];
  if (approval.reviewedBy) {
    sigSections.push({
      label: 'Granskad av',
      name: approval.reviewedBy,
      detail: `${approval.reviewedByEmail || ''}${approval.reviewedAt ? ' | ' + formatDate(approval.reviewedAt) : ''}`,
    });
  }

  // --- Assemble ---
  const bodyHtml = [
    sec1,
    sec2,
    sec3,
    sec4,
    sec4b,
    sec5,
    sec6,
    sec7,
    sec8,
    htmlSignature(sigSections),
  ].filter(Boolean).join('\n');

  return generateHTMLPDF({
    reportType: 'Godkännande av nytt värdepapper',
    title: approval.basicInfo.name,
    subtitle: `${approval.fundName} | ${approval.basicInfo.ticker} | ${approval.basicInfo.isin}`,
    date: formatDate(approval.createdAt),
    badges: [
      statusBadge(),
      { label: 'Dokument-ID', value: documentId, color: 'gray' },
    ],
    bodyHtml,
    disclaimerText: `Dokument-ID: ${documentId}. Detta dokument utgör en del av AIFM Capital AB:s rutinbeskrivning för godkännande av nytt värdepapper. Dokumentet har genererats automatiskt baserat på inmatade uppgifter.`,
    footerText: `AIFM Capital AB | Konfidentiellt | ${documentId}`,
  });
}

// --- Label helpers ---

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Utkast', submitted: 'Inskickad', under_review: 'Granskas',
    approved: 'Godkänd', rejected: 'Avvisad', expired: 'Utgången',
  };
  return labels[status] || status;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    transferable_security: 'Överlåtbart värdepapper', money_market: 'Penningmarknadsinstrument',
    fund_unit: 'Fondandel', derivative: 'Derivat', other: 'Annat',
  };
  return labels[category] || category;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stock: 'Aktie', bond: 'Obligation', etf: 'ETF', fund: 'Fond',
    certificate: 'Certifikat', warrant: 'Teckningsoption', option: 'Option', future: 'Termin', other: 'Annat',
  };
  return labels[type] || type;
}

function getListingTypeLabel(listingType: string): string {
  const labels: Record<string, string> = {
    regulated_market: 'Reglerad marknad', other_regulated: 'Annan reglerad marknad',
    planned_regulated: 'Planerad notering (reglerad)', planned_other: 'Planerad notering (annan)', unlisted: 'Onoterat',
  };
  return labels[listingType] || listingType;
}

function getValuationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    market_price: 'Marknadspriser', independent_system: 'Oberoende värderingssystem',
    emitter_info: 'Information från emittent', investment_analysis: 'Kvalificerad investeringsanalys',
  };
  return labels[type] || type;
}

function getInfoTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    regular_market_info: 'Regelbunden information till marknaden',
    regular_fund_info: 'Regelbunden information till fondbolaget',
  };
  return labels[type] || type;
}

function getInstrumentTypeLabel(type?: string): string {
  if (!type) return 'Ej angiven';
  const labels: Record<string, string> = {
    stock: 'Aktie', bond: 'Ränteinstrument / Obligation', etf: 'ETF',
    fund: 'Fondandel', derivative: 'Derivat', money_market: 'Penningmarknadsinstrument', other: 'Annat',
  };
  return labels[type] || type;
}

function formatLargeNumber(num?: number): string {
  if (!num) return '-';
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)} mdr SEK`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)} MSEK`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)} KSEK`;
  return `${num.toFixed(0)} SEK`;
}

/**
 * Export approval data as JSON for digital archiving
 */
export function exportApprovalJSON(approval: SecurityApprovalRequest): string {
  return JSON.stringify({
    documentId: generateDocumentId(approval),
    exportedAt: new Date().toISOString(),
    approval,
  }, null, 2);
}
