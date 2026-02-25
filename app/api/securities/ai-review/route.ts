import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getApproval } from '@/lib/integrations/securities';
import {
  getESGFundConfig,
  type ESGFundConfig,
} from '@/lib/integrations/securities/esg-fund-configs';
import { getFundDocumentText } from '@/lib/fund-documents/fund-document-store';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const MODEL_ID = 'eu.anthropic.claude-opus-4-6-v1';

function buildFundRulesSection(config: ESGFundConfig): string {
  const lines: string[] = [];
  lines.push(`## Fondvillkor: ${config.fundName}`);
  lines.push(`SFDR-artikel: ${config.article}`);

  if (config.exclusions.length > 0) {
    lines.push('\n### Uteslutningskriterier (exkluderingspolicy)');
    lines.push('VIKTIGT: Exponering som är UNDER gränsvärdet = GODKÄND. Exponering ÖVER gränsvärdet = UNDERKÄND. Gränsvärdet 0% = nolltolerans.');
    for (const ex of config.exclusions) {
      lines.push(
        `- ${ex.label}: max ${ex.threshold}% omsättning (allvarlighetsgrad: ${ex.severity})`
      );
    }
  }

  if (config.normScreening) {
    lines.push('\n### Normbaserad screening');
    if (config.normScreening.ungc) lines.push('- UN Global Compact');
    if (config.normScreening.oecd) lines.push('- OECD:s riktlinjer');
    if (config.normScreening.humanRights) lines.push('- Mänskliga rättigheter');
    if (config.normScreening.antiCorruption) lines.push('- Anti-korruption');
    lines.push(
      `- Kontroversnivå som automatiskt avvisas: ≥ ${config.normScreening.controversyAutoReject}`
    );
  }

  if (config.paiIndicators) {
    lines.push('\n### PAI-indikatorer (Principal Adverse Impacts)');
    if (config.paiIndicators.environmental.length > 0) {
      lines.push('Miljö: ' + config.paiIndicators.environmental.join(', '));
    }
    if (config.paiIndicators.social.length > 0) {
      lines.push('Sociala: ' + config.paiIndicators.social.join(', '));
    }
  }

  if (config.promotedCharacteristics && config.promotedCharacteristics.length > 0) {
    lines.push('\n### Främjade egenskaper');
    for (const pc of config.promotedCharacteristics) {
      lines.push(`- ${pc}`);
    }
  }

  if (config.article === '9') {
    if (config.sustainableGoalCategories && config.sustainableGoalCategories.length > 0) {
      lines.push('\n### Hållbarhetsmål (Artikel 9)');
      for (const sg of config.sustainableGoalCategories) {
        lines.push(`- ${sg}`);
      }
    }
    if (config.taxonomyRequired) {
      lines.push('- EU-taxonomianpassning krävs');
    }
    if (config.allocationControlRequired) {
      lines.push('- Allokeringskontroll krävs');
    }
  }

  if (config.engagementProcess) {
    lines.push('\n### Engagemangsprocess');
    lines.push(
      `- Risktröskel: ESG-score < ${config.engagementProcess.riskThreshold} → engagemang`
    );
    lines.push(`- Tidslinje: ${config.engagementProcess.timelineMonths} månader`);
    if (config.engagementProcess.divestmentDays) {
      lines.push(
        `- Avveckling vid misslyckande: inom ${config.engagementProcess.divestmentDays} dagar`
      );
    }
  }

  return lines.join('\n');
}

function buildApprovalDataSection(approval: Record<string, unknown>): string {
  const lines: string[] = [];
  const basic = approval.basicInfo as Record<string, unknown> | undefined;
  const compliance = approval.fundCompliance as Record<string, unknown> | undefined;
  const fffs = approval.regulatoryFFFS as Record<string, unknown> | undefined;
  const lvf = approval.regulatoryLVF as Record<string, unknown> | undefined;
  const liquidity = approval.liquidityAnalysis as Record<string, unknown> | undefined;
  const valuation = approval.valuationInfo as Record<string, unknown> | undefined;
  const esg = approval.esgInfo as Record<string, unknown> | undefined;
  const unlisted = approval.unlistedInfo as Record<string, unknown> | undefined;
  const fundUnit = approval.fundUnitInfo as Record<string, unknown> | undefined;

  lines.push('## Ansökan om godkännande');
  lines.push(`Fond: ${approval.fundName || 'Okänd'}`);
  lines.push(`Ansökande: ${approval.createdByEmail || 'Okänd'}`);
  lines.push(`Status: ${approval.status || 'Okänd'}`);

  if (basic) {
    lines.push('\n### Grundläggande information');
    lines.push(`Namn: ${basic.name || 'Ej angivet'}`);
    lines.push(`Kategori: ${basic.category || 'Ej angivet'}`);
    lines.push(`Typ: ${basic.type || 'Ej angivet'}`);
    lines.push(`ISIN: ${basic.isin || 'Ej angivet'}`);
    lines.push(`Ticker: ${basic.ticker || 'Ej angivet'}`);
    lines.push(`Marknadsplats: ${basic.marketPlace || 'Ej angivet'}`);
    lines.push(`Noteringstyp: ${basic.listingType || 'Ej angivet'}`);
    lines.push(`Valuta: ${basic.currency || 'Ej angivet'}`);
    lines.push(`Land: ${basic.country || 'Ej angivet'}`);
    lines.push(`Emittent: ${basic.emitter || 'Ej angivet'}`);
    if (basic.gicsSector) lines.push(`GICS-sektor: ${basic.gicsSector}`);
    if (basic.conflictsOfInterest) lines.push(`Intressekonflikter: ${basic.conflictsOfInterest}`);
  }

  if (compliance) {
    lines.push('\n### Fondregelefterlevnad');
    lines.push(`Motivering: ${compliance.complianceMotivation || 'Ej angivet'}`);
    lines.push(`Placeringsrestriktioner: ${compliance.placementRestrictions || 'Ej angivet'}`);
  }

  if (fffs) {
    lines.push('\n### FFFS 2013:9 (24 kap. 1 §)');
    lines.push(`1. Begränsad potentiell förlust: ${fffs.limitedPotentialLoss ? 'Ja' : 'Nej'}`);
    lines.push(`2. Likviditet ej äventyrad: ${fffs.liquidityNotEndangered ? 'Ja' : 'Nej'}`);
    const valObj = fffs.reliableValuation as Record<string, unknown> | undefined;
    lines.push(`3. Tillförlitlig värdering: ${valObj?.checked ? 'Ja' : 'Nej'} (${valObj?.type || 'Ej angivet'})`);
    const infoObj = fffs.appropriateInformation as Record<string, unknown> | undefined;
    lines.push(`4. Tillräcklig information: ${infoObj?.checked ? 'Ja' : 'Nej'} (${infoObj?.type || 'Ej angivet'})`);
    lines.push(`5. Omsättningsbar: ${fffs.isMarketable ? 'Ja' : 'Nej'}`);
    lines.push(`6. Förenlig med fonden: ${fffs.compatibleWithFund ? 'Ja' : 'Nej'}`);
    lines.push(`7. Fångas av riskhantering: ${fffs.riskManagementCaptures ? 'Ja' : 'Nej'}`);
  }

  if (lvf) {
    lines.push('\n### LVF (2004:46)');
    const sg = lvf.stateGuaranteed as Record<string, unknown> | undefined;
    if (sg?.applicable) {
      lines.push(`Statsgaranti: max 35%: ${sg.maxExposure35Percent ? 'Ja' : 'Nej'}`);
    }
    const nv = lvf.nonVotingShares as Record<string, unknown> | undefined;
    if (nv?.applicable) {
      lines.push(`Icke-röstberättigade: max 10%: ${nv.maxIssuedShares10Percent ? 'Ja' : 'Nej'}`);
    }
    const bm = lvf.bondOrMoneyMarket as Record<string, unknown> | undefined;
    if (bm?.applicable) {
      lines.push(`Obligation/penningmarknad: max 10%: ${bm.maxIssuedInstruments10Percent ? 'Ja' : 'Nej'}`);
    }
    const si = lvf.significantInfluence as Record<string, unknown> | undefined;
    if (si) {
      lines.push(`Väsentligt inflytande: ${si.willHaveInfluence ? 'Ja' : 'Nej'}`);
    }
  }

  if (liquidity) {
    lines.push('\n### Likviditetsanalys');
    if (liquidity.averageDailyVolume) lines.push(`ADV (volym): ${liquidity.averageDailyVolume}`);
    if (liquidity.averageDailyPrice) lines.push(`ADV (pris): ${liquidity.averageDailyPrice}`);
    if (liquidity.averageDailyValueSEK) lines.push(`ADV (SEK): ${liquidity.averageDailyValueSEK}`);
    if (liquidity.portfolioIlliquidShareBefore != null) lines.push(`Illikvid andel (före): ${liquidity.portfolioIlliquidShareBefore}%`);
    if (liquidity.portfolioIlliquidShareAfter != null) lines.push(`Illikvid andel (efter): ${liquidity.portfolioIlliquidShareAfter}%`);
    lines.push(`FFFS likviditet ej äventyrad: ${liquidity.fffsLiquidityNotEndangered ? 'Ja' : 'Nej'}`);
    lines.push(`FFFS omsättningsbar: ${liquidity.fffsIsMarketable ? 'Ja' : 'Nej'}`);
  }

  if (valuation) {
    lines.push('\n### Värderingsinformation');
    lines.push(`Tillförlitliga dagspriser: ${valuation.reliableDailyPrices ? 'Ja' : 'Nej'}`);
    if (valuation.priceSourceUrl) lines.push(`Priskälla: ${valuation.priceSourceUrl}`);
    lines.push(`Emission: ${valuation.isEmission ? 'Ja' : 'Nej'}`);
  }

  if (esg) {
    lines.push('\n### ESG-information');
    lines.push(`Artikel 8/9-fond: ${esg.article8Or9Fund ? 'Ja' : 'Nej'}`);
    if (esg.fundArticle) lines.push(`Fondens SFDR-artikel: ${esg.fundArticle}`);
    if (esg.environmentalCharacteristics) lines.push(`Miljöegenskaper: ${esg.environmentalCharacteristics}`);
    if (esg.socialCharacteristics) lines.push(`Sociala egenskaper: ${esg.socialCharacteristics}`);
    lines.push(`Uppfyller uteslutningskriterier: ${esg.meetsExclusionCriteria ? 'Ja' : 'Nej'}`);
    lines.push(`Uppfyller minimum hållbar investering: ${esg.meetsSustainableInvestmentMinimum ? 'Ja' : 'Nej'}`);
    if (esg.paiConsidered != null) lines.push(`PAI beaktad: ${esg.paiConsidered ? 'Ja' : 'Nej'}`);

    if (esg.esgDecision) lines.push(`ESG-beslut: ${esg.esgDecision}`);
    if (esg.esgDecisionMotivation) lines.push(`ESG-motivering: ${esg.esgDecisionMotivation}`);
    if (esg.engagementRequired != null) lines.push(`Engagemang krävs: ${esg.engagementRequired ? 'Ja' : 'Nej'}`);
    if (esg.engagementComment) lines.push(`Engagemangskommentar: ${esg.engagementComment}`);

    if (esg.envRiskLevel) lines.push(`Miljörisknivå: ${esg.envRiskLevel}`);
    if (esg.socialRiskLevel) lines.push(`Social risknivå: ${esg.socialRiskLevel}`);
    if (esg.govRiskLevel) lines.push(`Bolagsstyrningsrisk: ${esg.govRiskLevel}`);
    if (esg.ghgData) lines.push(`GHG-data: ${esg.ghgData}`);
    if (esg.fossilExposurePercent != null) lines.push(`Fossilexponering: ${esg.fossilExposurePercent}%`);

    const exclusionResults = esg.exclusionResults as Record<string, Record<string, unknown>> | undefined;
    if (exclusionResults && Object.keys(exclusionResults).length > 0) {
      lines.push('\nUteslutningsresultat per kategori:');
      for (const [cat, result] of Object.entries(exclusionResults)) {
        lines.push(`  ${cat}: exponering=${result.hasExposure ? 'Ja' : 'Nej'}, över tröskel=${result.aboveThreshold ? 'Ja' : 'Nej'}, godkänd=${result.approved ? 'Ja' : 'Nej'}${result.comment ? `, kommentar: ${result.comment}` : ''}`);
      }
    }
  }

  if (unlisted) {
    lines.push('\n### Onoterad information');
    lines.push(`Hembudsklausul: ${unlisted.transferRestrictionsByArticles ? 'Ja' : 'Nej'}`);
    lines.push(`Aktieägaravtal: ${unlisted.transferRestrictionsByAgreement ? 'Ja' : 'Nej'}`);
    lines.push(`Publikt bolag: ${unlisted.isPublicCompany ? 'Ja' : 'Nej'}`);
    lines.push(`Motivering: ${unlisted.allowedAssetMotivation || 'Ej angivet'}`);
  }

  if (fundUnit) {
    lines.push('\n### Fondandelsinfo');
    lines.push(`Fondtyp: ${fundUnit.fundType}`);
    lines.push(`Max egna fondandelar 10%: ${fundUnit.maxOwnFundUnits10Percent ? 'Ja' : 'Nej'}`);
    lines.push(`Max målfondandelar 25%: ${fundUnit.maxTargetFundUnits25Percent ? 'Ja' : 'Nej'}`);
  }

  if (approval.plannedAcquisitionShare) {
    lines.push(`\nPlanerad förvärvsandel: ${approval.plannedAcquisitionShare}`);
  }

  return lines.join('\n');
}

function buildSystemPrompt(): string {
  return `Du är en senior riskanalytiker och compliancerådgivare på ett svenskt AIF-förvaltarbolag (AIFM). Din uppgift är att granska ansökningar om godkännande av nya värdepapper och ge en professionell bedömning till Operations-teamet.

Du ska analysera ansökan mot fondens villkor, regulatoriska krav (FFFS 2013:9, LVF 2004:46) och ESG-policyn.

Svara ALLTID på svenska. Var koncis men grundlig.

Strukturera ditt svar i följande sektioner:

### 🔍 Sammanfattning
En kort bedömning (2-3 meningar) om huruvida värdepappret bör godkännas eller inte.

### ✅ Styrkor
Positiva aspekter som talar för godkännande.

### ⚠️ Risker & flaggor
Potentiella problem, regelöverträdelser eller områden som kräver extra uppmärksamhet.

### 📋 Regelefterlevnad
Bedömning av hur ansökan uppfyller FFFS 2013:9 och LVF 2004:46.

### 🌱 ESG-bedömning
Hur väl värdepappret uppfyller fondens ESG-krav, uteslutningskriterier och hållbarhetsmål.
VIKTIGT: Utvärdera varje exkluderingskategori individuellt mot fondens gränsvärden. Exponering UNDER gränsvärdet = GODKÄND (flagga INTE som risk). Exponering ÖVER gränsvärdet = UNDERKÄND. Ange specifika siffror.
VIKTIGT OM FÖRSVARSEXPONERING: Datia:s kategori 'Defense' är en BRED sektorklassificering (t.ex. lastbilar/motorer som används av försvaret). Det är INTE samma sak som 'weapons' (vapenproduktion) eller 'controversialWeapons' (klusterbomber, kemiska vapen). Volvo kan t.ex. klassificeras som Defense: 100% utan att vara vapenproducent. 'Defense'-exponering ska bedömas separat och med ett mycket högre gränsvärde än rena vapenexponeringar.

### 💧 Likviditet & värdering
Bedömning av likviditetsrisker och värderingsmetoder.

### 🎯 Rekommendation
Ge en tydlig rekommendation: GODKÄNN, GODKÄNN MED VILLKOR, eller AVVISA — med motivering.

Var ärlig, kritisk och objektiv. Flagga alla potentiella problem, även om ansökan generellt ser bra ut. Operations-teamet behöver en grundlig analys för att fatta ett informerat beslut.`;
}

export async function POST(request: NextRequest) {
  const role = (request.headers.get('x-aifm-role') || '').toLowerCase();
  if (role !== 'admin' && role !== 'operation' && role !== 'executive') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { approvalId } = await request.json();
    if (!approvalId) {
      return NextResponse.json(
        { error: 'approvalId is required' },
        { status: 400 }
      );
    }

    const approval = await getApproval(approvalId);
    if (!approval) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    const fundConfig = getESGFundConfig(
      approval.fundId,
      approval.fundName
    );

    let userPrompt = buildApprovalDataSection(approval as unknown as Record<string, unknown>);
    if (fundConfig) {
      userPrompt = buildFundRulesSection(fundConfig) + '\n\n' + userPrompt;
    } else {
      userPrompt =
        '## Fondvillkor\nIngen specifik fondkonfiguration hittades. Bedöm enligt generella AIFM-regler och SFDR Artikel 6.\n\n' +
        userPrompt;
    }

    let uploadedConditions = '';
    try {
      uploadedConditions = await getFundDocumentText(approval.fundId);
    } catch {
      /* non-fatal */
    }
    if (uploadedConditions) {
      userPrompt +=
        '\n\n## Uppladdade fondvillkor och dokument\nNedan följer text extraherad från fondens officiella dokument (fondvillkor, hållbarhetsrapporter, placeringspolicyer). Använd dessa som primär källa vid bedömningen.\n\n' +
        uploadedConditions;
    }

    userPrompt +=
      '\n\nAnalysera denna ansökan noggrant mot fondvillkoren och ge din professionella bedömning. Identifiera alla risker och ge en tydlig rekommendation.';

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: buildSystemPrompt() }],
      messages: [
        {
          role: 'user',
          content: [{ text: userPrompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
      },
    });

    const response = await bedrockClient.send(command);

    const outputContent = response.output?.message?.content;
    let analysis = '';
    if (outputContent) {
      for (const block of outputContent) {
        if ('text' in block && block.text) {
          analysis += block.text;
        }
      }
    }

    return NextResponse.json({
      analysis,
      model: MODEL_ID,
      approvalId,
      fundName: approval.fundName,
      securityName: approval.basicInfo?.name || approvalId,
    });
  } catch (error) {
    console.error('AI review error:', error);
    const errMsg =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'AI analysis failed', details: errMsg },
      { status: 500 }
    );
  }
}
