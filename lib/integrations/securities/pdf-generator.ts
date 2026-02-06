/**
 * PDF Generator for Security Approval Documents
 * Generates professional PDF documents with all form data and sources
 */

import type { SecurityApprovalRequest } from './types';

// Helper to format dates
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Generate a unique document ID
function generateDocumentId(approval: SecurityApprovalRequest): string {
  const date = new Date(approval.createdAt);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `AIFM-SEC-${dateStr}-${approval.id.slice(-6).toUpperCase()}`;
}

// Generate QR code URL for the document
function generateQRCodeUrl(approvalId: string, baseUrl: string): string {
  const documentUrl = `${baseUrl}/securities/${approvalId}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(documentUrl)}`;
}

/**
 * Generate PDF content as HTML (will be converted to PDF)
 */
export function generateApprovalPDFContent(
  approval: SecurityApprovalRequest,
  sources?: Record<string, { source: string; url?: string; confidence?: string }>,
  baseUrl: string = 'https://app.aifm.se'
): string {
  const documentId = generateDocumentId(approval);
  const qrCodeUrl = generateQRCodeUrl(approval.id, baseUrl);

  const html = `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Godkännande av nytt värdepapper - ${approval.basicInfo.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #333;
      padding: 20mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #1a1a2e;
    }
    .logo {
      font-size: 24pt;
      font-weight: bold;
      color: #1a1a2e;
    }
    .logo span {
      color: #c9a227;
    }
    .document-info {
      text-align: right;
      font-size: 9pt;
      color: #666;
    }
    .document-id {
      font-family: monospace;
      font-weight: bold;
      color: #1a1a2e;
    }
    .qr-code {
      margin-top: 10px;
    }
    .qr-code img {
      width: 80px;
      height: 80px;
    }
    h1 {
      font-size: 16pt;
      color: #1a1a2e;
      margin: 20px 0 10px;
    }
    h2 {
      font-size: 12pt;
      color: #1a1a2e;
      margin: 15px 0 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #ddd;
    }
    h3 {
      font-size: 10pt;
      color: #444;
      margin: 10px 0 5px;
    }
    .section {
      margin-bottom: 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }
    .field {
      margin-bottom: 8px;
    }
    .field-label {
      font-size: 8pt;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .field-value {
      font-weight: 500;
    }
    .field-value.empty {
      color: #999;
      font-style: italic;
    }
    .checkbox-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 5px 0;
    }
    .checkbox {
      width: 14px;
      height: 14px;
      border: 1px solid #333;
      border-radius: 2px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .checkbox.checked {
      background: #1a1a2e;
      color: white;
    }
    .checkbox.checked::after {
      content: '✓';
      font-size: 10px;
    }
    .text-block {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      margin: 5px 0;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .status-approved { background: #d4edda; color: #155724; }
    .status-submitted { background: #cce5ff; color: #004085; }
    .status-draft { background: #e2e3e5; color: #383d41; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 40px;
    }
    .signature-box {
      border-top: 1px solid #333;
      padding-top: 10px;
    }
    .signature-label {
      font-size: 8pt;
      color: #666;
    }
    .source-info {
      font-size: 7pt;
      color: #888;
      margin-left: 5px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
    .page-break {
      page-break-before: always;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
    }
    th, td {
      padding: 6px 8px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-size: 8pt;
      text-transform: uppercase;
      color: #666;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
    .info {
      background: #d1ecf1;
      border: 1px solid #17a2b8;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
    }
    @media print {
      body {
        padding: 15mm;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">AIFM<span>.</span></div>
      <div style="font-size: 9pt; color: #666; margin-top: 5px;">
        Godkännande av nytt värdepapper
      </div>
    </div>
    <div class="document-info">
      <div class="document-id">${documentId}</div>
      <div>Skapad: ${formatDate(approval.createdAt)}</div>
      <div>Uppdaterad: ${formatDate(approval.updatedAt)}</div>
      <div class="qr-code">
        <img src="${qrCodeUrl}" alt="QR Code" />
      </div>
    </div>
  </div>

  <h1>${approval.basicInfo.name}</h1>
  <div style="margin-bottom: 20px;">
    <span class="status-badge status-${approval.status}">
      ${getStatusLabel(approval.status)}
    </span>
    <span style="margin-left: 15px; color: #666;">
      ${approval.fundName} | ${approval.basicInfo.ticker} | ${approval.basicInfo.isin}
    </span>
  </div>

  <!-- Section 1: Basic Information -->
  <div class="section">
    <h2>1. Grundläggande information</h2>
    <div class="grid grid-3">
      ${renderField('Namn', approval.basicInfo.name)}
      ${renderField('ISIN', approval.basicInfo.isin)}
      ${renderField('Ticker', approval.basicInfo.ticker)}
      ${renderField('MIC/Börs', approval.basicInfo.mic || approval.basicInfo.marketPlace)}
      ${renderField('Valuta', approval.basicInfo.currency)}
      ${renderField('Land', approval.basicInfo.country)}
      ${renderField('Kategori', getCategoryLabel(approval.basicInfo.category))}
      ${renderField('Typ', getTypeLabel(approval.basicInfo.type))}
      ${renderField('Noteringstyp', getListingTypeLabel(approval.basicInfo.listingType))}
      ${renderField('Emittent', approval.basicInfo.emitter)}
      ${renderField('Emittent LEI', approval.basicInfo.emitterLEI)}
      ${renderField('GICS-sektor', approval.basicInfo.gicsSector)}
    </div>
    ${approval.basicInfo.conflictsOfInterest ? `
      <div class="field" style="margin-top: 10px;">
        <div class="field-label">Eventuella intressekonflikter</div>
        <div class="text-block">${approval.basicInfo.conflictsOfInterest}</div>
      </div>
    ` : ''}
  </div>

  <!-- Section 2: Fund Compliance -->
  <div class="section">
    <h2>2. Fondöverensstämmelse</h2>
    <div class="grid">
      ${renderField('Fond', approval.fundCompliance.fundName)}
      ${renderField('Fond-ID', approval.fundCompliance.fundId)}
    </div>
    <div class="field" style="margin-top: 10px;">
      <div class="field-label">Förenlighet med fondens placeringsbestämmelser</div>
      <div class="text-block">${approval.fundCompliance.complianceMotivation || 'Ej angiven'}</div>
    </div>
    ${approval.fundCompliance.placementRestrictions ? `
      <div class="field">
        <div class="field-label">Hänvisning till placeringsbestämmelser</div>
        <div class="text-block">${approval.fundCompliance.placementRestrictions}</div>
      </div>
    ` : ''}
    ${approval.plannedAcquisitionShare ? `
      <div class="field">
        <div class="field-label">Planerad andel av bolaget/emissionen</div>
        <div class="field-value">${approval.plannedAcquisitionShare}</div>
      </div>
    ` : ''}
  </div>

  <!-- Section 3: FFFS 2013:9 -->
  <div class="section">
    <h2>3. Regulatoriska krav - FFFS 2013:9, 24 kap. 1 §</h2>
    <div class="info">
      <strong>Krav på överlåtbara värdepapper</strong> enligt Finansinspektionens föreskrifter
    </div>
    ${renderCheckbox('1 pt. Den potentiella förlusten är begränsad till det betalda beloppet', approval.regulatoryFFFS.limitedPotentialLoss)}
    ${renderCheckbox('2 pt. Likviditeten äventyrar inte fondbolagets förmåga att uppfylla kraven i 4 kap. 13 § LVF', approval.regulatoryFFFS.liquidityNotEndangered)}
    
    <div class="field" style="margin-top: 10px;">
      <div class="field-label">3 pt. Tillförlitlig värdering</div>
      <div class="field-value">${getValuationTypeLabel(approval.regulatoryFFFS.reliableValuation.type)}</div>
      ${renderCheckbox('Kravet uppfylls', approval.regulatoryFFFS.reliableValuation.checked)}
    </div>
    
    <div class="field" style="margin-top: 10px;">
      <div class="field-label">4 pt. Lämplig information tillgänglig</div>
      <div class="field-value">${getInfoTypeLabel(approval.regulatoryFFFS.appropriateInformation.type)}</div>
      ${renderCheckbox('Kravet uppfylls', approval.regulatoryFFFS.appropriateInformation.checked)}
    </div>
    
    ${renderCheckbox('5 pt. Värdepappret är försäljningsbart', approval.regulatoryFFFS.isMarketable)}
    ${renderCheckbox('6 pt. Förvärvet är förenligt med fondens placeringsinriktning', approval.regulatoryFFFS.compatibleWithFund)}
    ${renderCheckbox('7 pt. Riskhanteringssystemet fångar upp riskerna', approval.regulatoryFFFS.riskManagementCaptures)}
  </div>

  <div class="page-break"></div>

  <!-- Section 4: LVF -->
  ${approval.regulatoryLVF && Object.keys(approval.regulatoryLVF).length > 0 ? `
  <div class="section">
    <h2>4. Regulatoriska krav - LVF 2004:46</h2>
    ${approval.regulatoryLVF.stateGuaranteed?.applicable ? `
      ${renderCheckbox('5 kap. 6 § 1 pt. Garanterad av stat eller kommun', true)}
      ${renderCheckbox('Max 35% emittentexponering uppfylls', approval.regulatoryLVF.stateGuaranteed.maxExposure35Percent)}
    ` : ''}
    ${approval.regulatoryLVF.nonVotingShares?.applicable ? `
      ${renderCheckbox('5 kap. 19 § 1 pt. Aktier utan rösträtt', true)}
      ${renderCheckbox('Max 10% av utgivna aktier uppfylls', approval.regulatoryLVF.nonVotingShares.maxIssuedShares10Percent)}
    ` : ''}
    ${approval.regulatoryLVF.bondOrMoneyMarket?.applicable ? `
      ${renderCheckbox('5 kap. 19 § 2-3 pt. Obligation eller penningmarknadsinstrument', true)}
      ${renderCheckbox('Max 10% av utgivna instrument uppfylls', approval.regulatoryLVF.bondOrMoneyMarket.maxIssuedInstruments10Percent)}
    ` : ''}
    ${approval.regulatoryLVF.significantInfluence ? `
      ${renderCheckbox('5 kap. 20 § Möjlighet att utöva väsentligt inflytande', approval.regulatoryLVF.significantInfluence.willHaveInfluence)}
    ` : ''}
  </div>
  ` : ''}

  <!-- Section 5: Liquidity Analysis -->
  <div class="section">
    <h2>5. Likviditetsanalys</h2>
    
    <!-- Instrument Type -->
    ${renderField('Typ av instrument', getInstrumentTypeLabel(approval.liquidityAnalysis.instrumentType))}
    
    <!-- ADV (Average Daily Volume) -->
    ${approval.liquidityAnalysis.averageDailyValueSEK ? `
      <div class="info" style="margin: 15px 0;">
        <strong>Genomsnittlig daglig omsättning (ADV)</strong>
        <table style="margin-top: 10px;">
          <tr>
            <th>Genomsnittlig daglig volym</th>
            <th>Pris (${approval.basicInfo.currency || 'SEK'})</th>
            <th>Daglig omsättning (SEK)</th>
          </tr>
          <tr>
            <td>${approval.liquidityAnalysis.averageDailyVolume?.toLocaleString('sv-SE') || '-'} st</td>
            <td>${approval.liquidityAnalysis.averageDailyPrice?.toLocaleString('sv-SE', { minimumFractionDigits: 2 }) || '-'}</td>
            <td><strong>${formatLargeNumber(approval.liquidityAnalysis.averageDailyValueSEK)}</strong></td>
          </tr>
        </table>
        <p style="font-size: 8pt; margin-top: 5px; color: #666;">
          Beräkning: ADV × Pris × Valutakurs = Daglig omsättning
        </p>
      </div>
    ` : ''}
    
    ${approval.liquidityAnalysis.stockLiquidity ? `
      <h3>Aktielikviditet</h3>
      ${renderCheckbox('Likviditetspresumtion (genomsnittlig daglig volym > 400 MSEK)', approval.liquidityAnalysis.stockLiquidity.presumption400MSEK)}
      <div class="grid">
        ${renderCheckbox('Kan likvideras inom 1 dag (Position/Daglig volym <85%)', approval.liquidityAnalysis.stockLiquidity.canLiquidate1Day)}
        ${renderCheckbox('Kan likvideras inom 2 dagar (Position/Daglig volym <170%)', approval.liquidityAnalysis.stockLiquidity.canLiquidate2Days)}
        ${renderCheckbox('Kan likvideras inom 3 dagar (Position/Daglig volym <250%)', approval.liquidityAnalysis.stockLiquidity.canLiquidate3Days)}
        ${renderCheckbox('Mer än 3 dagar (Position/Daglig volym >250%)', approval.liquidityAnalysis.stockLiquidity.moreThan3Days)}
      </div>
    ` : ''}
    
    ${approval.liquidityAnalysis.noHistoryEstimate ? `
      <div class="field">
        <div class="field-label">IPO/Spin-off - uppskattad likviditet</div>
        <div class="text-block">${approval.liquidityAnalysis.noHistoryEstimate}</div>
      </div>
    ` : ''}
    
    <div class="grid" style="margin-top: 10px;">
      ${renderField('Andel illikvida före transaktion', approval.liquidityAnalysis.portfolioIlliquidShareBefore ? `${approval.liquidityAnalysis.portfolioIlliquidShareBefore}%` : undefined)}
      ${renderField('Andel illikvida efter transaktion', approval.liquidityAnalysis.portfolioIlliquidShareAfter ? `${approval.liquidityAnalysis.portfolioIlliquidShareAfter}%` : undefined)}
    </div>
    
    ${approval.liquidityAnalysis.portfolioMotivation ? `
      <div class="field">
        <div class="field-label">Motivering till positionens storlek</div>
        <div class="text-block">${approval.liquidityAnalysis.portfolioMotivation}</div>
      </div>
    ` : ''}
    
    ${approval.liquidityAnalysis.howLiquidityRequirementMet ? `
      <div class="field">
        <div class="field-label">Hur uppfylls kravet att likviditeten inte äventyras?</div>
        <div class="text-block">${approval.liquidityAnalysis.howLiquidityRequirementMet}</div>
      </div>
    ` : ''}
    
    ${approval.liquidityAnalysis.howMarketabilityRequirementMet ? `
      <div class="field">
        <div class="field-label">Hur uppfylls kravet på försäljningsbarhet?</div>
        <div class="text-block">${approval.liquidityAnalysis.howMarketabilityRequirementMet}</div>
      </div>
    ` : ''}
  </div>

  <!-- Section 6: Valuation -->
  <div class="section">
    <h2>6. Värderingsinformation</h2>
    ${renderCheckbox('Pålitliga priser finns tillgängliga dagligen', approval.valuationInfo.reliableDailyPrices)}
    ${approval.valuationInfo.priceSourceUrl ? `
      <div class="field">
        <div class="field-label">Priskälla</div>
        <div class="field-value">${approval.valuationInfo.priceSourceUrl}</div>
      </div>
    ` : ''}
    ${approval.valuationInfo.priceSourceComment ? `
      <div class="field">
        <div class="field-label">Kommentar om priskälla</div>
        <div class="text-block">${approval.valuationInfo.priceSourceComment}</div>
      </div>
    ` : ''}
    ${renderCheckbox('Investering sker i samband med emission', approval.valuationInfo.isEmission)}
    ${approval.valuationInfo.emissionValuationMethod ? `
      <div class="field">
        <div class="field-label">Värderingsmetod för emissionspris</div>
        <div class="text-block">${approval.valuationInfo.emissionValuationMethod}</div>
      </div>
    ` : ''}
    ${approval.valuationInfo.proposedValuationMethod ? `
      <div class="field">
        <div class="field-label">Förvaltarens förslag till värderingsmetod</div>
        <div class="text-block">${approval.valuationInfo.proposedValuationMethod}</div>
      </div>
    ` : ''}
  </div>

  <!-- Section 7: ESG -->
  <div class="section">
    <h2>7. ESG-relaterad information</h2>
    ${approval.esgInfo.article8Or9Fund ? `
      <div class="info" style="margin-bottom: 15px;">
        Fonden är klassificerad som <strong>Artikel 8/9</strong> enligt SFDR
      </div>
      
      ${approval.esgInfo.environmentalCharacteristics ? `
        <div class="field">
          <div class="field-label">Miljörelaterade egenskaper som främjas</div>
          <div class="text-block">${approval.esgInfo.environmentalCharacteristics}</div>
        </div>
      ` : ''}
      
      ${approval.esgInfo.socialCharacteristics ? `
        <div class="field">
          <div class="field-label">Sociala egenskaper som främjas</div>
          <div class="text-block">${approval.esgInfo.socialCharacteristics}</div>
        </div>
      ` : ''}
      
      ${renderCheckbox('Uppfyller fondens exkluderingskriterier', approval.esgInfo.meetsExclusionCriteria)}
      ${renderCheckbox('Uppfyller minimum av hållbara investeringar', approval.esgInfo.meetsSustainableInvestmentMinimum)}
      ${renderCheckbox('PAI (Principal Adverse Impacts) har beaktats', approval.esgInfo.paiConsidered)}
      
      ${approval.esgInfo.article9NoSignificantHarm ? `
        <div class="field">
          <div class="field-label">Artikel 9 - Ingen betydande skada för andra mål</div>
          <div class="text-block">${approval.esgInfo.article9NoSignificantHarm}</div>
        </div>
      ` : ''}
      
      ${renderCheckbox('Artikel 9 - God styrning', approval.esgInfo.article9GoodGovernance)}
      ${renderCheckbox('Artikel 9 - OECD-riktlinjer', approval.esgInfo.article9OECDCompliant)}
      ${renderCheckbox('Artikel 9 - FN:s vägledande principer', approval.esgInfo.article9UNGPCompliant)}
    ` : `
      <div class="info">
        Fonden är klassificerad som <strong>Artikel 6</strong> - Inga specifika ESG-krav gäller, 
        men hållbarhetsrisker ska beaktas i investeringsbeslutet.
      </div>
    `}
  </div>

  <!-- Signatures -->
  ${approval.status === 'approved' || approval.status === 'rejected' ? `
    <div class="section">
      <h2>8. Beslut</h2>
      <div class="grid">
        ${renderField('Status', getStatusLabel(approval.status))}
        ${renderField('Beslutsdatum', approval.reviewedAt ? formatDate(approval.reviewedAt) : undefined)}
        ${renderField('Granskare', approval.reviewedBy)}
        ${renderField('Granskare e-post', approval.reviewedByEmail)}
      </div>
      ${approval.reviewComments ? `
        <div class="field">
          <div class="field-label">Kommentarer</div>
          <div class="text-block">${approval.reviewComments}</div>
        </div>
      ` : ''}
      ${approval.rejectionReason ? `
        <div class="warning">
          <strong>Avslagsorsak:</strong> ${approval.rejectionReason}
        </div>
      ` : ''}
      ${approval.expiresAt ? `
        <div class="field">
          <div class="field-label">Godkännandet giltigt till</div>
          <div class="field-value">${formatDate(approval.expiresAt)}</div>
        </div>
      ` : ''}
    </div>
  ` : ''}

  <div class="signatures">
    <div class="signature-box">
      <div class="signature-label">Skapad av</div>
      <div class="field-value">${approval.createdBy}</div>
      <div style="font-size: 8pt; color: #666;">${approval.createdByEmail}</div>
      <div style="font-size: 8pt; color: #666;">${formatDate(approval.createdAt)}</div>
    </div>
    ${approval.reviewedBy ? `
      <div class="signature-box">
        <div class="signature-label">Granskad av</div>
        <div class="field-value">${approval.reviewedBy}</div>
        <div style="font-size: 8pt; color: #666;">${approval.reviewedByEmail}</div>
        <div style="font-size: 8pt; color: #666;">${approval.reviewedAt ? formatDate(approval.reviewedAt) : ''}</div>
      </div>
    ` : ''}
  </div>

  <div class="footer">
    <div>
      <strong>AIFM</strong> | Rutinbeskrivning: Godkännande av nytt värdepapper
    </div>
    <div>
      ${documentId} | Genererad ${new Date().toLocaleString('sv-SE')}
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

// Helper functions for labels
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Utkast',
    submitted: 'Inskickad',
    under_review: 'Granskas',
    approved: 'Godkänd',
    rejected: 'Avvisad',
    expired: 'Utgången',
  };
  return labels[status] || status;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    transferable_security: 'Överlåtbart värdepapper',
    money_market: 'Penningmarknadsinstrument',
    fund_unit: 'Fondandel',
    derivative: 'Derivat',
    other: 'Annat',
  };
  return labels[category] || category;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    stock: 'Aktie',
    bond: 'Obligation',
    etf: 'ETF',
    fund: 'Fond',
    certificate: 'Certifikat',
    warrant: 'Teckningsoption',
    option: 'Option',
    future: 'Termin',
    other: 'Annat',
  };
  return labels[type] || type;
}

function getListingTypeLabel(listingType: string): string {
  const labels: Record<string, string> = {
    regulated_market: 'Reglerad marknad',
    other_regulated: 'Annan reglerad marknad',
    planned_regulated: 'Planerad notering (reglerad)',
    planned_other: 'Planerad notering (annan)',
    unlisted: 'Onoterat',
  };
  return labels[listingType] || listingType;
}

function getValuationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    market_price: 'Marknadspriser',
    independent_system: 'Oberoende värderingssystem',
    emitter_info: 'Information från emittent',
    investment_analysis: 'Kvalificerad investeringsanalys',
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
    stock: 'Aktie',
    bond: 'Ränteinstrument / Obligation',
    etf: 'ETF',
    fund: 'Fondandel',
    derivative: 'Derivat',
    money_market: 'Penningmarknadsinstrument',
    other: 'Annat',
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

function renderField(label: string, value?: string): string {
  return `
    <div class="field">
      <div class="field-label">${label}</div>
      <div class="field-value ${!value ? 'empty' : ''}">${value || 'Ej angiven'}</div>
    </div>
  `;
}

function renderCheckbox(label: string, checked?: boolean): string {
  return `
    <div class="checkbox-item">
      <div class="checkbox ${checked ? 'checked' : ''}"></div>
      <span>${label}</span>
    </div>
  `;
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
