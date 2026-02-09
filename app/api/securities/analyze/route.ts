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
}

interface FundInfo {
  fundId: string;
  fundName: string;
  article: '6' | '8' | '9';
  investmentFocus?: string;
  restrictions?: string[];
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

export async function POST(request: NextRequest) {
  try {
    const { security, fund }: { security: SecurityDataInput; fund: FundInfo } = await request.json();

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

    if (fund.article === '8' || fund.article === '9') {
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
            if (esgProviderData.exclusionFlags && esgProviderData.exclusionFlags.length > 0) {
              verifiedFacts.push(`Exkluderingsflaggor: ${esgProviderData.exclusionFlags.map(f => f.categoryDescription).join(', ')} (källa: ${esgProviderData.provider})`);
            }
            console.log(`[Security Analyze] ESG data from ${esgProviderData.provider} for ${identifier}`);
          }
        }
      } catch (esgErr) {
        console.warn('[Security Analyze] ESG service fetch failed:', esgErr);
      }
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

VERIFIERAD DATA OM VÄRDEPAPPRET:
${verifiedFacts.map(f => `- ${f}`).join('\n')}

FONDINFORMATION:
- Fondnamn: ${fund.fundName}
- SFDR-artikel: ${fund.article}
${fund.investmentFocus ? `- Placeringsinriktning: ${fund.investmentFocus}` : ''}
${fund.restrictions?.length ? `- Restriktioner: ${fund.restrictions.join(', ')}` : ''}

Svara ENDAST i JSON-format. Om du inte kan ge ett svar baserat på verifierad data, använd null för det fältet:

{
  "complianceMotivation": {
    "text": "motiveringstext baserat på VERIFIERAD data, eller null om data saknas",
    "basedOn": ["lista med EXAKTA fakta från verifierad data som stödjer detta"],
    "confidence": "high|medium|low"
  },
  "placementRestrictions": {
    "text": "hänvisning till relevanta paragrafer, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "environmentalCharacteristics": {
    "text": "miljöegenskaper baserat på VERIFIERAD sektor/bransch, eller null om data saknas",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "socialCharacteristics": {
    "text": "sociala egenskaper baserat på VERIFIERAD data, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "valuationMethod": {
    "text": "värderingsmetod baserat på noteringstyp, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "liquidityMotivation": {
    "text": "likviditetsmotivering baserat på VERIFIERAD volymdata, eller null om data saknas",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  },
  "marketabilityMotivation": {
    "text": "försäljningsbarhetsmotivering baserat på marknadsdata, eller null",
    "basedOn": ["lista med fakta"],
    "confidence": "high|medium|low"
  }
}`;

    try {
      const modelId = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
      
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Analysera värdepappret baserat på den verifierade datan och ge förslag till formulärfälten. Kom ihåg: svara ENDAST baserat på den verifierade informationen, och använd null om data saknas. SVARA ENDAST MED JSON.`,
            },
          ],
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

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

      const aiResponse = JSON.parse(jsonMatch[0]);
      
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

      result.complianceMotivation = processField(aiResponse.complianceMotivation, 'compliance-motivering');
      result.placementRestrictions = processField(aiResponse.placementRestrictions, 'placeringsrestriktioner');
      result.valuationMethod = processField(aiResponse.valuationMethod, 'värderingsmetod');
      result.liquidityMotivation = processField(aiResponse.liquidityMotivation, 'likviditetsmotivering');
      result.marketabilityMotivation = processField(aiResponse.marketabilityMotivation, 'försäljningsbarhetsmotivering');

      // ESG fields only for Article 8/9 funds
      if (fund.article === '8' || fund.article === '9') {
        result.environmentalCharacteristics = processField(aiResponse.environmentalCharacteristics, 'miljöegenskaper');
        result.socialCharacteristics = processField(aiResponse.socialCharacteristics, 'sociala egenskaper');
      }

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
      console.error('AI analysis error:', aiError);
      
      // Return structured not-found responses
      return NextResponse.json({
        success: false,
        error: `AI-analys misslyckades: ${aiError instanceof Error ? aiError.message : 'Okänt fel'}`,
        suggestions: null,
      });
    }

  } catch (error) {
    console.error('Security analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze security' },
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
