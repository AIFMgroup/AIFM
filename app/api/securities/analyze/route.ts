import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import type { NormalizedESGData } from '@/lib/integrations/esg/types';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

interface SecurityDataInput {
  name: string;
  nameSource?: any;
  ticker: string;
  isin: string;
  mic: string;
  exchangeName?: string;
  securityType: string;
  category: string;
  categorySource?: any;
  type: string;
  typeSource?: any;
  country?: string;
  countryName?: string;
  currency?: string;
  currencySource?: any;
  isRegulatedMarket?: boolean;
  isRegulatedMarketSource?: any;
  gicsSector?: string;
  gicsSectorSource?: any;
  industry?: string;
  industrySource?: any;
  marketCap?: number;
  marketCapSource?: any;
  averageDailyValueSEK?: number;
  averageDailyValueSEKSource?: any;
  meetsLiquidityPresumption?: boolean;
  meetsLiquidityPresumptionSource?: any;
  isUCITS_ETF?: boolean;
  listingType?: string;
}

interface FundInfo {
  fundId: string;
  fundName: string;
  article: '6' | '8' | '9';
  investmentFocus?: string;
  restrictions?: string[];
}

interface FormContext {
  // Liquidity data already known
  stockLiquidityPresumption?: boolean;
  averageDailyVolume?: number | null;
  averageDailyPrice?: number | null;
  averageDailyValueSEK?: number | null;
  reliableDailyPrices?: boolean;
  isEmission?: boolean;
  // Regulatory data already set
  limitedPotentialLoss?: boolean;
  liquidityNotEndangered?: boolean;
  isMarketable?: boolean;
  compatibleWithFund?: boolean;
  riskManagementCaptures?: boolean;
  significantInfluence?: boolean;
  // ESG summary data already set
  esgSummaryNormScreening?: string;
  esgSummaryExclusion?: string;
  esgSummaryGovernance?: string;
  esgSummaryRisk?: string;
  esgSummaryPAI?: string;
  esgSummaryPromoted?: string;
  envRiskLevel?: string;
  socialRiskLevel?: string;
  govRiskLevel?: string;
  // Allocation data (Art 9)
  allocationBeforePercent?: number | '';
  allocationAfterPercent?: number | '';
}

/**
 * AI-generated field with citation
 */
interface AIGeneratedField {
  value: string;
  confidence: 'high' | 'medium' | 'low' | 'not_found';
  source: {
    type: 'ai_analysis';
    basedOn: string[];
    reasoning: string;
    generatedAt: string;
  };
  notFound?: boolean;
  error?: string;
}

function createNotFound(reason: string): AIGeneratedField {
  return {
    value: '',
    confidence: 'not_found',
    notFound: true,
    error: reason,
    source: {
      type: 'ai_analysis',
      basedOn: [],
      reasoning: reason,
      generatedAt: new Date().toISOString(),
    },
  };
}

export const maxDuration = 180; // Allow up to 180 seconds for AI analysis

/**
 * Attempt to extract top-level fields from broken JSON.
 * Looks for patterns like "fieldName": { ... } and tries to parse each block individually.
 */
function extractFieldsFromBrokenJSON(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Match top-level keys with their object values: "key": { ... }
  // This regex finds "key": { and then counts braces to find the matching }
  const keyPattern = /"(\w+)"\s*:\s*\{/g;
  let match;
  
  while ((match = keyPattern.exec(raw)) !== null) {
    const key = match[1];
    const startIdx = match.index + match[0].length - 1; // position of opening {
    
    // Count braces to find matching closing brace
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    
    if (endIdx > startIdx) {
      const block = raw.substring(startIdx, endIdx + 1);
      try {
        // Try to parse this individual block
        let cleaned = block
          .replace(/,\s*([\]}])/g, '$1')  // remove trailing commas
          .replace(/[\x00-\x1f]/g, (c) => {  // escape control characters
            if (c === '\n') return '\\n';
            if (c === '\r') return '\\r';
            if (c === '\t') return '\\t';
            return '';
          });
        result[key] = JSON.parse(cleaned);
      } catch {
        // Try to at least extract the text/value field
        const textMatch = block.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const valueMatch = block.match(/"value"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const confMatch = block.match(/"confidence"\s*:\s*"(high|medium|low)"/);
        
        if (textMatch) {
          result[key] = {
            text: textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
            confidence: confMatch?.[1] || 'medium',
            basedOn: [],
          };
        } else if (valueMatch) {
          result[key] = {
            value: valueMatch[1],
            confidence: confMatch?.[1] || 'medium',
            basedOn: [],
          };
        }
      }
    }
  }
  
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { security, fund, formContext }: { security: SecurityDataInput; fund: FundInfo; formContext?: FormContext } = await request.json();

    if (!security || !fund) {
      return NextResponse.json(
        { error: 'Security and fund data are required' },
        { status: 400 }
      );
    }

    // Build verified facts ONLY from data with sources
    const verifiedFacts: string[] = [];
    
    if (security.name) {
      verifiedFacts.push(`Värdepapper: ${security.name} (källa: ${security.nameSource?.source || 'input'})`);
    }
    if (security.isin) {
      verifiedFacts.push(`ISIN: ${security.isin}`);
    }
    if (security.type) {
      verifiedFacts.push(`Typ: ${security.type} (källa: ${security.typeSource?.source || 'härledd'})`);
    }
    if (security.category) {
      verifiedFacts.push(`Kategori: ${security.category}`);
    }
    if (security.countryName || security.country) {
      verifiedFacts.push(`Land: ${security.countryName || security.country}`);
    }
    if (security.currency) {
      verifiedFacts.push(`Valuta: ${security.currency}`);
    }
    if (security.isRegulatedMarket !== undefined) {
      verifiedFacts.push(`Reglerad marknad: ${security.isRegulatedMarket ? 'Ja' : 'Nej'}`);
    }
    if (security.exchangeName) {
      verifiedFacts.push(`Börs: ${security.exchangeName}`);
    }
    if (security.gicsSector) {
      verifiedFacts.push(`Sektor: ${security.gicsSector} (källa: ${security.gicsSectorSource?.source || 'härledd'})`);
    }
    if (security.industry) {
      verifiedFacts.push(`Bransch: ${security.industry} (källa: ${security.industrySource?.source || 'härledd'})`);
    }
    if (security.marketCap) {
      verifiedFacts.push(`Börsvärde: ${formatMarketCap(security.marketCap)}`);
    }
    if (security.averageDailyValueSEK) {
      verifiedFacts.push(`Genomsnittlig daglig omsättning: ${formatMarketCap(security.averageDailyValueSEK)} SEK`);
    }
    if (security.meetsLiquidityPresumption !== undefined) {
      verifiedFacts.push(`Uppfyller likviditetspresumtion (>400 MSEK): ${security.meetsLiquidityPresumption ? 'Ja' : 'Nej'}`);
    }
    if (security.isUCITS_ETF !== undefined) {
      verifiedFacts.push(`UCITS ETF: ${security.isUCITS_ETF ? 'Ja' : 'Nej'}`);
    }
    if (security.listingType) {
      verifiedFacts.push(`Noteringstyp: ${security.listingType}`);
    }

    // Add form context data as verified facts
    if (formContext) {
      if (formContext.averageDailyVolume != null) {
        verifiedFacts.push(`Genomsnittlig daglig volym (antal): ${formContext.averageDailyVolume.toLocaleString('sv-SE')}`);
      }
      if (formContext.averageDailyPrice != null) {
        verifiedFacts.push(`Genomsnittligt dagligt pris: ${formContext.averageDailyPrice.toFixed(2)}`);
      }
      if (formContext.stockLiquidityPresumption !== undefined) {
        verifiedFacts.push(`Likviditetspresumtion uppfylld: ${formContext.stockLiquidityPresumption ? 'Ja' : 'Nej'}`);
      }
      if (formContext.reliableDailyPrices !== undefined) {
        verifiedFacts.push(`Tillförlitliga dagliga priser: ${formContext.reliableDailyPrices ? 'Ja' : 'Nej'}`);
      }
      if (formContext.isEmission !== undefined) {
        verifiedFacts.push(`Emission/nyemission: ${formContext.isEmission ? 'Ja' : 'Nej'}`);
      }
      if (formContext.significantInfluence !== undefined) {
        verifiedFacts.push(`Väsentligt inflytande: ${formContext.significantInfluence ? 'Ja' : 'Nej'}`);
      }
      // ESG summary results if already set
      if (formContext.esgSummaryNormScreening) verifiedFacts.push(`ESG-sammanfattning normscreening: ${formContext.esgSummaryNormScreening}`);
      if (formContext.esgSummaryExclusion) verifiedFacts.push(`ESG-sammanfattning exkludering: ${formContext.esgSummaryExclusion}`);
      if (formContext.esgSummaryGovernance) verifiedFacts.push(`ESG-sammanfattning governance: ${formContext.esgSummaryGovernance}`);
      if (formContext.esgSummaryRisk) verifiedFacts.push(`ESG-sammanfattning risk: ${formContext.esgSummaryRisk}`);
      if (formContext.esgSummaryPAI) verifiedFacts.push(`ESG-sammanfattning PAI: ${formContext.esgSummaryPAI}`);
      if (formContext.esgSummaryPromoted) verifiedFacts.push(`ESG-sammanfattning främjade egenskaper: ${formContext.esgSummaryPromoted}`);
      if (formContext.envRiskLevel) verifiedFacts.push(`Miljörisknivå: ${formContext.envRiskLevel}`);
      if (formContext.socialRiskLevel) verifiedFacts.push(`Social risknivå: ${formContext.socialRiskLevel}`);
      if (formContext.govRiskLevel) verifiedFacts.push(`Styrningsrisknivå: ${formContext.govRiskLevel}`);
      if (formContext.allocationBeforePercent !== undefined && formContext.allocationBeforePercent !== '') {
        verifiedFacts.push(`Allokering före investering: ${formContext.allocationBeforePercent}%`);
      }
      if (formContext.allocationAfterPercent !== undefined && formContext.allocationAfterPercent !== '') {
        verifiedFacts.push(`Allokering efter investering: ${formContext.allocationAfterPercent}%`);
      }
    }

    // Check minimum data requirement
    if (verifiedFacts.length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Otillräcklig verifierad data för AI-analys (minst 3 datapunkter krävs)',
        suggestions: null,
      });
    }

    // ---- Fetch ESG data from service (provider-agnostic) ----
    let esgProviderData: NormalizedESGData | null = null;
    let esgDataSource = 'ai_analysis';

    try {
      const esgClient = getESGServiceClient();
      const identifier = security.isin || security.ticker;
      if (identifier && esgClient.getActiveProviderName()) {
        esgProviderData = await esgClient.getESGData(identifier);
        if (esgProviderData) {
          esgDataSource = esgProviderData.provider;
          // Add ESG facts from provider to the verified data set
          if (esgProviderData.totalScore !== null)
            verifiedFacts.push(`ESG Total Score: ${esgProviderData.totalScore.toFixed(1)}/100 (källa: ${esgProviderData.provider})`);
          if (esgProviderData.environmentScore !== null)
            verifiedFacts.push(`ESG Miljö-score: ${esgProviderData.environmentScore.toFixed(1)}/100 (källa: ${esgProviderData.provider})`);
          if (esgProviderData.socialScore !== null)
            verifiedFacts.push(`ESG Social-score: ${esgProviderData.socialScore.toFixed(1)}/100 (källa: ${esgProviderData.provider})`);
          if (esgProviderData.governanceScore !== null)
            verifiedFacts.push(`ESG Styrnings-score: ${esgProviderData.governanceScore.toFixed(1)}/100 (källa: ${esgProviderData.provider})`);
          if (esgProviderData.controversyLevel !== null)
            verifiedFacts.push(`Kontroversialitetsnivå: ${esgProviderData.controversyLevel}/5 (källa: ${esgProviderData.provider})`);
          if (esgProviderData.sfdrAlignment)
            verifiedFacts.push(`SFDR-klassificering: ${esgProviderData.sfdrAlignment} (källa: ${esgProviderData.provider})`);
          if (esgProviderData.carbonIntensity !== null && esgProviderData.carbonIntensity !== undefined)
            verifiedFacts.push(`Koldioxidintensitet: ${esgProviderData.carbonIntensity} ${esgProviderData.carbonIntensityUnit || 'tonnes/M€'} (källa: ${esgProviderData.provider})`);
          if (esgProviderData.taxonomyAlignmentPercent !== null && esgProviderData.taxonomyAlignmentPercent !== undefined)
            verifiedFacts.push(`EU-taxonomianpassning: ${esgProviderData.taxonomyAlignmentPercent}% (källa: ${esgProviderData.provider})`);
          if (esgProviderData.exclusionFlags && esgProviderData.exclusionFlags.length > 0) {
            const detailedExclusions = esgProviderData.exclusionFlags.map(f => 
              `${f.categoryDescription}: involvering=${f.involvementLevel}, omsättning=${f.revenuePercent != null ? f.revenuePercent + '%' : 'okänd'}`
            ).join('; ');
            verifiedFacts.push(`Exkluderingsflaggor: ${detailedExclusions} (källa: ${esgProviderData.provider})`);
          }
          // Fetch and add PAI indicators
          try {
            const paiData = await esgClient.getPAIIndicators(identifier);
            if (paiData && paiData.length > 0) {
              const paiSummary = paiData.map(p => 
                `${p.name}: ${p.value}${p.unit ? ' ' + p.unit : ''}`
              ).join('; ');
              verifiedFacts.push(`PAI-indikatorer: ${paiSummary} (källa: ${esgProviderData.provider})`);
            }
          } catch (paiErr) {
            console.warn('[Security Analyze] PAI data fetch failed:', paiErr);
          }
          console.log(`[Security Analyze] ESG data from ${esgProviderData.provider} for ${identifier}`);
        }
      }
    } catch (esgErr) {
      console.warn('[Security Analyze] ESG service fetch failed:', esgErr);
    }

    // Build system prompt with strict instructions
    const systemPrompt = `Du är en compliance-analytiker för fondbolag i Sverige. Du hjälper till att fylla i formulär för godkännande av nya värdepapper.

KRITISKA REGLER:
1. Du får ENDAST basera dina svar på den VERIFIERADE informationen som ges nedan.
2. Du får ALDRIG hitta på, gissa eller anta information som inte explicit finns i den verifierade datan.
3. Om du inte har tillräcklig information för att ge ett svar, MÅSTE du svara med exakt: null
4. Varje påstående du gör MÅSTE kunna kopplas tillbaka till ett specifikt faktum i den verifierade datan.
5. Du ska INTE söka efter eller använda extern kunskap om specifika företag.
6. Alla motiveringar ska vara sakliga och baserade på verifierad data, INTE generiska fraser.
7. KRITISKT FÖR JSON: Alla textvärden MÅSTE vara korrekt JSON-escapade. Använd ALDRIG raka citattecken (") inuti strängar - använd enkla citattecken (') istället. Undvik radbrytningar i textvärden. Håll varje text under 500 tecken.

VERIFIERAD DATA OM VÄRDEPAPPRET:
${verifiedFacts.map(f => `- ${f}`).join('\n')}

FONDINFORMATION:
- Fondnamn: ${fund.fundName}
- SFDR-artikel: ${fund.article}
${fund.investmentFocus ? `- Placeringsinriktning: ${fund.investmentFocus}` : ''}
${fund.restrictions?.length ? `- Restriktioner: ${fund.restrictions.join(', ')}` : ''}

Svara ENDAST i JSON-format. Om du inte kan ge ett svar baserat på verifierad data, använd null för det fältet.

VIKTIGT om fältformat:
- Textfält ("text"): Skriv en saklig motivering/kommentar baserat på verifierad data.
- Valfält ("value"): Välj ett av de angivna alternativen baserat på verifierad data.
- Booleska fält ("value"): Svara true eller false baserat på verifierad data.

Fält att fylla i:

{
  "complianceMotivation": {
    "text": "motiveringstext om varför värdepappret är förenligt med fondens placeringsbestämmelser, baserat på VERIFIERAD data, eller null om data saknas",
    "basedOn": ["lista med EXAKTA fakta från verifierad data som stödjer detta"],
    "confidence": "high|medium|low"
  },
  "placementRestrictions": {
    "text": "hänvisning till relevanta paragrafer i FFFS/LVF som gäller för detta värdepapper, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },

  "reliableValuationType": {
    "value": "Välj ETT av: 'regulated_market' (börsnoterat på reglerad marknad), 'mtf' (handlas på MTF), 'otc_with_counterparty' (OTC med motpart), 'independent_valuation' (oberoende värdering), 'other' (annat). Basera på noteringstyp och marknadsplats, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "appropriateInfoType": {
    "value": "Välj ETT av: 'regulated_market_info' (reglerad marknadsinformation), 'issuer_reports' (emittentens rapporter), 'independent_analysis' (oberoende analys), 'other' (annat). Basera på noteringstyp, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },

  "stateGuaranteed": {
    "value": "true om värdepappret är statsgaranterat (statsobligationer, statsskuldväxlar), annars false. Basera på typ och kategori, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "nonVotingShares": {
    "value": "true om innehavet kan medföra röstandel >10% (osannolikt för börsnoterade aktier med stort börsvärde), annars false. Basera på typ och börsvärde, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "bondOrMoneyMarket": {
    "value": "true om värdepappret är en obligation eller penningmarknadsinstrument, annars false. Basera på typ och kategori, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },

  "liquidityInstrumentType": {
    "value": "Välj ETT av: 'stock' (aktie), 'bond' (obligation), 'etf' (ETF), 'fund' (fond), 'derivative' (derivat), 'money_market' (penningmarknad), 'other' (annat). Basera på värdepapperstyp och kategori, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "canLiquidate1Day": {
    "value": "true om värdepappret kan likvideras inom 1 dag (position/daglig volym < 85%), annars false. Basera på daglig omsättning och likviditetspresumtion, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "noHistoryEstimate": {
    "text": "Om det saknas historisk handelsdata, skriv en uppskattning av likviditeten baserat på tillgänglig data (börs, typ, marknad). Annars null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "liquidityMotivation": {
    "text": "likviditetsmotivering baserat på VERIFIERAD volymdata, daglig omsättning och likviditetspresumtion, eller null om data saknas",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "marketabilityMotivation": {
    "text": "försäljningsbarhetsmotivering - bedöm om värdepappret kan säljas inom rimlig tid baserat på marknadsdata, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },

  "priceSourceComment": {
    "text": "kommentar om priskälla, t.ex. 'Stängningskurs från [börsnamn]' baserat på börs och noteringstyp, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "valuationMethod": {
    "text": "föreslagen värderingsmetod baserat på noteringstyp och värdepapperstyp (t.ex. 'Daglig stängningskurs från reglerad marknad' för börsnoterade), eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "emissionValuationMethod": {
    "text": "om värdepappret är en emission: beskriv värderingsmetod för emissionen. Annars null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },

  "environmentalCharacteristics": {
    "text": "miljöegenskaper baserat på VERIFIERAD sektor/bransch och ESG-data (miljöpoäng, koldioxidintensitet), eller null om data saknas",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "socialCharacteristics": {
    "text": "sociala egenskaper baserat på VERIFIERAD data (socialpoäng, kontroversnivå), eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "normScreeningComment": {
    "text": "sammanfattning av normbaserad screening (UNGC, OECD, mänskliga rättigheter) baserat på kontroversnivå och ESG-data, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "exclusionSummaryComment": {
    "text": "sammanfattning av exkluderingskontroll baserat på affärsinvolvering och exponeringar, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "governanceComment": {
    "text": "bedömning av bolagsstyrning baserat på styrningspoäng, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "envRiskMotivation": {
    "text": "motivering för miljörisk baserat på miljöpoäng och koldioxidintensitet, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "socialRiskMotivation": {
    "text": "motivering för social risk baserat på socialpoäng, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "govRiskMotivation": {
    "text": "motivering för styrningsrisk baserat på styrningspoäng, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "paiSummaryComment": {
    "text": "sammanfattning av PAI-indikatorer (GHG, koldioxid, fossilt, biodiversitet etc) baserat på ESG-data, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "promotedCharacteristicsComment": {
    "text": "bedömning av hur värdepappret bidrar till fondens främjade egenskaper (Art 8), eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "contributesToClimateGoalComment": {
    "text": "bedömning av om verksamheten bidrar till klimatmålet baserat på taxonomi och ESG-data (Art 9), eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "strengthensPortfolioGoalComment": {
    "text": "bedömning av om investeringen stärker portföljens måluppfyllelse baserat på ESG-data (Art 9), eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "taxonomyComment": {
    "text": "kommentar om EU-taxonomianpassning baserat på taxonomidata, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "sustainableGoalCategory": {
    "value": "Välj ETT av: 'climate_mitigation' (klimatbegränsning), 'climate_adaptation' (klimatanpassning), 'water' (vatten), 'circular_economy' (cirkulär ekonomi), 'pollution' (föroreningar), 'biodiversity' (biodiversitet). Basera på sektor, bransch och ESG-data, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "allocationComment": {
    "text": "kommentar om allokeringsförändring baserat på före/efter-procent om tillgängligt, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "dataQualityComment": {
    "text": "bedömning av datakvalitet och eventuella begränsningar i den tillgängliga ESG-datan, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "engagementComment": {
    "text": "bedömning av om engagemang krävs baserat på ESG-risknivå, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "esgDecisionMotivation": {
    "text": "sammanfattande motivering för ESG-beslut baserat på ALLA ESG-bedömningar (normscreening, exkludering, governance, risk, PAI, främjade egenskaper). Sammanfatta helhetsbilden, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "esgDecision": {
    "value": "Baserat på helhetsbilden av alla ESG-bedömningar, föreslå 'approved' eller 'rejected'. Om det finns allvarliga problem (exkluderingsflaggor, hög risk, kontroverser) föreslå 'rejected', annars 'approved'. Eller null om data saknas",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "conflictsOfInterest": {
    "text": "bedömning av eventuella intressekonflikter baserat på emittent, fondbolag och värdepapperstyp, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  }
}`;

    try {
      // Try models in order of preference:
      // 1. Claude Sonnet 4.5 via cross-region inference (eu prefix)
      // 2. Claude Sonnet 4 via cross-region inference
      // 3. Claude Haiku 4.5 via cross-region inference
      const modelCandidates = [
        'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
        'eu.anthropic.claude-sonnet-4-20250514-v1:0',
        'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      ];

      let responseBody: any = null;
      let usedModel = '';

      for (const modelId of modelCandidates) {
        try {
          console.log(`[Security Analyze] Trying model: ${modelId}`);
          const command = new InvokeModelCommand({
            modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
              anthropic_version: 'bedrock-2023-05-31',
              max_tokens: 6000,
              system: systemPrompt,
              messages: [
                {
                  role: 'user',
                  content: `Analysera värdepappret baserat på den verifierade datan och ge förslag till formulärfälten. Kom ihåg: svara ENDAST baserat på den verifierade informationen, och använd null om data saknas. SVARA ENDAST MED GILTIG JSON - inga kommentarer, inga radbrytningar i strängar, inga oescapade citattecken. Använd enkla citattecken (') istället för dubbla inuti textvärden.`,
                },
              ],
            }),
          });

          const response = await bedrockClient.send(command);
          responseBody = JSON.parse(new TextDecoder().decode(response.body));
          usedModel = modelId;
          console.log(`[Security Analyze] Successfully used model: ${modelId}`);
          break;
        } catch (modelError) {
          console.warn(`[Security Analyze] Model ${modelId} failed:`, modelError instanceof Error ? modelError.message : modelError);
          // Continue to next model
        }
      }

      if (!responseBody) {
        throw new Error('Alla AI-modeller misslyckades. Kontrollera att Bedrock-åtkomst är konfigurerad i AWS-kontot och att minst en Claude-modell är aktiverad i eu-north-1 regionen.');
      }

      // Parse response
      const textContent = responseBody.content?.[0]?.text || '';
      if (!textContent) {
        throw new Error('No text response from AI');
      }

      // Extract JSON from response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse AI response as JSON');
      }

      let aiResponse: any;
      try {
        aiResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        // AI sometimes produces invalid JSON (unescaped quotes, trailing commas, etc.)
        // Try to repair common issues
        console.warn('[Security Analyze] Initial JSON parse failed, attempting repair...');
        let repaired = jsonMatch[0];

        // 1. Remove trailing commas before } or ]
        repaired = repaired.replace(/,\s*([\]}])/g, '$1');

        // 2. Fix unescaped newlines inside string values
        repaired = repaired.replace(/(?<=:\s*")((?:[^"\\]|\\.)*)(?=")/gs, (match) => {
          return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        });

        try {
          aiResponse = JSON.parse(repaired);
          console.log('[Security Analyze] JSON repair succeeded (trailing commas / newlines)');
        } catch {
          // 3. More aggressive: try to extract field-by-field using regex
          console.warn('[Security Analyze] Repair failed, trying field-by-field extraction...');
          aiResponse = extractFieldsFromBrokenJSON(repaired);
          if (!aiResponse || Object.keys(aiResponse).length === 0) {
            throw new Error(`Kunde inte tolka AI-svaret som JSON: ${(parseError as Error).message}`);
          }
          console.log(`[Security Analyze] Field extraction recovered ${Object.keys(aiResponse).length} fields`);
        }
      }
      
      // Build response with proper field structure
      const result: Record<string, AIGeneratedField | null> = {};
      const timestamp = new Date().toISOString();

      // Process each field
      const processField = (field: any, fieldName: string): AIGeneratedField | null => {
        if (!field || field.text === null || field.text === 'null' || !field.text) {
          return createNotFound(`Otillräcklig data för att generera ${fieldName}`);
        }
        
        return {
          value: field.text,
          confidence: field.confidence || 'medium',
          source: {
            type: 'ai_analysis',
            basedOn: field.basedOn || [],
            reasoning: `Genererat baserat på: ${(field.basedOn || []).join(', ')}`,
            generatedAt: timestamp,
          },
        };
      };

      // --- Process text fields (returns string values) ---
      result.complianceMotivation = processField(aiResponse.complianceMotivation, 'compliance-motivering');
      result.placementRestrictions = processField(aiResponse.placementRestrictions, 'placeringsrestriktioner');
      result.valuationMethod = processField(aiResponse.valuationMethod, 'värderingsmetod');
      result.liquidityMotivation = processField(aiResponse.liquidityMotivation, 'likviditetsmotivering');
      result.marketabilityMotivation = processField(aiResponse.marketabilityMotivation, 'försäljningsbarhetsmotivering');
      result.priceSourceComment = processField(aiResponse.priceSourceComment, 'priskällekommentar');
      result.emissionValuationMethod = processField(aiResponse.emissionValuationMethod, 'emissionsvärdering');
      result.noHistoryEstimate = processField(aiResponse.noHistoryEstimate, 'likviditetsuppskattning');
      result.conflictsOfInterest = processField(aiResponse.conflictsOfInterest, 'intressekonflikter');

      // ESG text fields
      result.environmentalCharacteristics = processField(aiResponse.environmentalCharacteristics, 'miljöegenskaper');
      result.socialCharacteristics = processField(aiResponse.socialCharacteristics, 'sociala egenskaper');
      result.normScreeningComment = processField(aiResponse.normScreeningComment, 'normbaserad screening');
      result.exclusionSummaryComment = processField(aiResponse.exclusionSummaryComment, 'exkluderingssammanfattning');
      result.governanceComment = processField(aiResponse.governanceComment, 'bolagsstyrning');
      result.envRiskMotivation = processField(aiResponse.envRiskMotivation, 'miljöriskmotivering');
      result.socialRiskMotivation = processField(aiResponse.socialRiskMotivation, 'social riskmotivering');
      result.govRiskMotivation = processField(aiResponse.govRiskMotivation, 'styrningsriskmotivering');
      result.paiSummaryComment = processField(aiResponse.paiSummaryComment, 'PAI-sammanfattning');
      result.taxonomyComment = processField(aiResponse.taxonomyComment, 'taxonomikommentar');
      result.dataQualityComment = processField(aiResponse.dataQualityComment, 'datakvalitet');
      result.engagementComment = processField(aiResponse.engagementComment, 'engagemang');
      result.esgDecisionMotivation = processField(aiResponse.esgDecisionMotivation, 'ESG-beslutsmotivering');
      result.allocationComment = processField(aiResponse.allocationComment, 'allokeringskommentar');
      result.promotedCharacteristicsComment = processField(aiResponse.promotedCharacteristicsComment, 'främjade egenskaper');
      result.contributesToClimateGoalComment = processField(aiResponse.contributesToClimateGoalComment, 'klimatmålsbidrag');
      result.strengthensPortfolioGoalComment = processField(aiResponse.strengthensPortfolioGoalComment, 'portföljmåluppfyllelse');

      // --- Process value/select fields (returns specific option values) ---
      const processValueField = (field: any, fieldName: string): AIGeneratedField | null => {
        if (!field || field.value === null || field.value === 'null' || field.value === undefined) {
          return createNotFound(`Otillräcklig data för att generera ${fieldName}`);
        }
        return {
          value: String(field.value),
          confidence: field.confidence || 'medium',
          source: {
            type: 'ai_analysis',
            basedOn: field.basedOn || [],
            reasoning: `Genererat baserat på: ${(field.basedOn || []).join(', ')}`,
            generatedAt: timestamp,
          },
        };
      };

      result.reliableValuationType = processValueField(aiResponse.reliableValuationType, 'tillförlitlig värderingstyp');
      result.appropriateInfoType = processValueField(aiResponse.appropriateInfoType, 'informationstyp');
      result.liquidityInstrumentType = processValueField(aiResponse.liquidityInstrumentType, 'likviditetsinstrumenttyp');
      result.stateGuaranteed = processValueField(aiResponse.stateGuaranteed, 'statsgaranterat');
      result.nonVotingShares = processValueField(aiResponse.nonVotingShares, 'röstandel');
      result.bondOrMoneyMarket = processValueField(aiResponse.bondOrMoneyMarket, 'obligation/penningmarknad');
      result.canLiquidate1Day = processValueField(aiResponse.canLiquidate1Day, 'likvidation 1 dag');
      result.sustainableGoalCategory = processValueField(aiResponse.sustainableGoalCategory, 'hållbarhetsmålkategori');
      result.esgDecision = processValueField(aiResponse.esgDecision, 'ESG-beslut');

      // Convert to suggestions format for backward compatibility
      const suggestions: Record<string, any> = {};
      
      for (const [key, field] of Object.entries(result)) {
        if (field && !field.notFound) {
          suggestions[key] = field.value;
          suggestions[`${key}Source`] = field.source;
          suggestions[`${key}Confidence`] = field.confidence;
        } else if (field) {
          suggestions[key] = null;
          suggestions[`${key}NotFound`] = true;
          suggestions[`${key}Error`] = field.error;
        }
      }

      // Auto-populate ESG fields from provider data (higher confidence than AI)
      if (esgProviderData && (fund.article === '8' || fund.article === '9')) {
        const providerTimestamp = new Date().toISOString();
        const providerSource = {
          type: 'esg_provider' as const,
          basedOn: [`ESG-data från ${esgProviderData.provider}`],
          reasoning: `Automatiskt ifyllt baserat på ESG-data från ${esgProviderData.provider}`,
          generatedAt: providerTimestamp,
        };

        // meetsExclusionCriteria
        if (esgProviderData.meetsExclusionCriteria !== undefined) {
          suggestions.meetsExclusionCriteria = esgProviderData.meetsExclusionCriteria;
          suggestions.meetsExclusionCriteriaSource = providerSource;
          suggestions.meetsExclusionCriteriaConfidence = 'high';
        }

        // Scores for ESGInfo auto-fill
        if (esgProviderData.totalScore !== null) {
          suggestions.esgTotalScore = esgProviderData.totalScore;
          suggestions.esgTotalScoreSource = providerSource;
        }
        if (esgProviderData.environmentScore !== null) {
          suggestions.esgEnvironmentScore = esgProviderData.environmentScore;
          suggestions.esgEnvironmentScoreSource = providerSource;
        }
        if (esgProviderData.socialScore !== null) {
          suggestions.esgSocialScore = esgProviderData.socialScore;
          suggestions.esgSocialScoreSource = providerSource;
        }
        if (esgProviderData.governanceScore !== null) {
          suggestions.esgGovernanceScore = esgProviderData.governanceScore;
          suggestions.esgGovernanceScoreSource = providerSource;
        }
        if (esgProviderData.controversyLevel !== null) {
          suggestions.controversyLevel = esgProviderData.controversyLevel;
          suggestions.controversyLevelSource = providerSource;
        }
      }

      return NextResponse.json({
        success: true,
        suggestions,
        aiFields: result,
        verifiedDataUsed: verifiedFacts,
        esgDataSource,
        esgProviderData: esgProviderData ? {
          provider: esgProviderData.provider,
          totalScore: esgProviderData.totalScore,
          environmentScore: esgProviderData.environmentScore,
          socialScore: esgProviderData.socialScore,
          governanceScore: esgProviderData.governanceScore,
          controversyLevel: esgProviderData.controversyLevel,
          sfdrAlignment: esgProviderData.sfdrAlignment,
          exclusionFlags: esgProviderData.exclusionFlags,
        } : null,
      });

    } catch (aiError) {
      console.error('[Security Analyze] AI analysis error:', aiError);
      
      // Return structured not-found responses
      return NextResponse.json({
        success: false,
        error: `AI-analys misslyckades: ${aiError instanceof Error ? aiError.message : 'Okänt fel'}`,
        suggestions: null,
      });
    }

  } catch (error) {
    console.error('[Security Analyze] Top-level error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    return NextResponse.json(
      { success: false, error: `Analysfel: ${errorMessage}`, suggestions: null },
      { status: 500 }
    );
  }
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)} biljoner`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} miljarder`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} miljoner`;
  }
  return value.toLocaleString('sv-SE');
}
