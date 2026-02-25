import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const MODEL_CANDIDATES = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
): Promise<string | null> {
  for (const modelId of MODEL_CANDIDATES) {
    try {
      const command = new ConverseCommand({
        modelId,
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        inferenceConfig: { maxTokens },
      });
      const response = await bedrockClient.send(command);
      const outputContent = response.output?.message?.content;
      if (outputContent?.[0] && 'text' in outputContent[0]) {
        return outputContent[0].text ?? null;
      }
      return null;
    } catch (err) {
      console.warn(`[Scout-compare] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

function parseJsonFromText(text: string): Record<string, unknown> | null {
  let cleaned = text;
  const fenceStart = cleaned.indexOf('```');
  if (fenceStart !== -1) {
    const afterFence = cleaned.indexOf('\n', fenceStart);
    if (afterFence !== -1) {
      const fenceEnd = cleaned.lastIndexOf('```');
      cleaned = fenceEnd > afterFence ? cleaned.slice(afterFence + 1, fenceEnd) : cleaned.slice(afterFence + 1);
    }
  }
  const start = cleaned.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,\s*([\]}])/g, '$1'));
    } catch {
      return null;
    }
  }
}

function formatNum(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return String(v);
}

function formatEnrichedDataForAI(enrichedRecs: Array<Record<string, unknown>>): string {
  const lines: string[] = ['=== VERIFIERAD MARKNADSDATA FOR REKOMMENDERADE BOLAG ===\n'];

  for (const rec of enrichedRecs) {
    lines.push(`--- ${rec.name} (${rec.ticker}) ---`);
    if (rec.lookupSuccess) {
      lines.push(`  ISIN: ${rec.isin || 'N/A'}, Bors: ${rec.exchange || 'N/A'}, Reglerad: ${rec.isRegulatedMarket ?? 'N/A'}`);
      lines.push(`  Sektor: ${rec.gicsSector || rec.sector || 'N/A'}, Bransch: ${rec.industry || 'N/A'}`);
      lines.push(`  LEI: ${rec.lei || 'N/A'}, Emittent: ${rec.emitter || 'N/A'}`);
    }
    if (rec.yahooPrice || rec.currentPrice) {
      const price = rec.yahooPrice || rec.currentPrice;
      const mcap = rec.yahooMarketCap || rec.marketCap;
      lines.push(`  Kurs: ${price} ${rec.currency || rec.yahooCurrency || ''}, Borsvarde: ${mcap ? formatNum(mcap as number) : 'N/A'}`);
      lines.push(`  52v Hog: ${rec.yahoo52wHigh || 'N/A'}, 52v Lag: ${rec.yahoo52wLow || 'N/A'}, Position i range: ${rec.rangePosition52w || 'N/A'}`);
      lines.push(`  Snittvolym/dag: ${rec.avgDailyVolume || rec.yahooVolume || 'N/A'}`);
    }
    if (rec.esgSuccess) {
      lines.push(`  ESG Total: ${rec.esgScore ?? 'N/A'}/100 (E:${rec.esgEnvironment ?? '?'} S:${rec.esgSocial ?? '?'} G:${rec.esgGovernance ?? '?'}) [${rec.esgProvider}]`);
      lines.push(`  Koldioxidintensitet: ${rec.carbonIntensity ?? 'N/A'} ${rec.carbonIntensityUnit || ''}`);
      lines.push(`  SFDR API: ${rec.sfdrAlignmentAPI || 'N/A'}, Taxonomi: ${rec.taxonomyAlignment ?? 'N/A'}%, Kontroverser: ${rec.controversyLevel ?? 'N/A'}`);
      if (rec.paiIndicators && Array.isArray(rec.paiIndicators)) {
        const pais = rec.paiIndicators as Array<Record<string, unknown>>;
        for (const p of pais.slice(0, 5)) {
          lines.push(`  PAI: ${p.name || p.id}: ${p.value ?? 'N/A'} ${p.unit || ''}`);
        }
      }
      if (rec.exclusionFlags && typeof rec.exclusionFlags === 'object') {
        const flags = rec.exclusionFlags as Record<string, unknown>;
        const flagged = Object.entries(flags).filter(([, v]) => v === true).map(([k]) => k);
        if (flagged.length > 0) lines.push(`  EXKLUDERINGSFLAGGOR: ${flagged.join(', ')}`);
      }
    }
    if (!rec.lookupSuccess && !rec.esgSuccess) {
      lines.push('  [Ingen API-data tillganglig - baserat pa AI:s kunskap]');
    }
    lines.push('');
  }
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  let body: { enrichedRecommendations: Array<Record<string, unknown>>; sfdrArticle: string; investmentStrategy: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ogiltig förfrågan' }, { status: 400 });
  }

  const { enrichedRecommendations, sfdrArticle, investmentStrategy } = body;
  if (!enrichedRecommendations?.length) {
    return NextResponse.json({ error: 'Inga rekommendationer att analysera' }, { status: 400 });
  }

  try {
    console.log('[Scout-compare] Running comparative analysis...');
    const dataBlock = formatEnrichedDataForAI(enrichedRecommendations);

    const comparisonPrompt = `Du ar en av varldens framsta portfoljforvaltare med 30 ars erfarenhet. Du har precis fatt tillbaka verifierad marknadsdata for 5 rekommenderade bolag. Analysera datan grundligt och producera:

1. En JAMFORELSEANALYS som rankar bolagen 1-5 baserat pa risk/reward, med detaljerad motivering for varje
2. En PORTFOLJSYNTES som beskriver hur de 5 bolagen kompletterar varandra (sektor, geografi, riskprofil, tillvaxt vs varde)
3. Eventuella VARNINGSFLAGGOR baserat pa den faktiska datan (t.ex. hoga ESG-kontroverser, dalig likviditet, exkluderingsflaggor, hog vardering)
4. En SAMMANFATTANDE REKOMMENDATION till forvaltaren med konkreta nasta steg

Fondens SFDR-klassificering: Artikel ${sfdrArticle || '8'}
Investeringsstrategi: ${investmentStrategy}

Svara med ett JSON-objekt:
{
  "ranking": [{"name": "Bolag", "rank": 1, "score": "8.5/10", "reasoning": "Detaljerad motivering med hanvisning till specifik data"}],
  "portfolioSynthesis": "3-5 meningar om hur bolagen kompletterar varandra, diversifiering, och portfoljkonstruktion",
  "warnings": ["Specifik varning med data som stod"],
  "overallRecommendation": "5-8 meningar med sammanfattande bedomning, risker, mojligheter och konkreta nasta steg for forvaltaren",
  "macroContext": "3-4 meningar om relevant makrokontext och hur den paverkar rekommendationerna",
  "diversificationScore": "Hog/Medel/Lag med detaljerad motivering"
}`;

    const compRaw = await callClaude(comparisonPrompt, dataBlock, 4000);
    const compParsed = compRaw ? parseJsonFromText(compRaw) : null;
    console.log('[Scout-compare] Complete');
    return NextResponse.json({ success: true, comparativeAnalysis: compParsed || null });
  } catch (error) {
    console.error('[Scout-compare] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte genomföra jämförelseanalys' },
      { status: 500 }
    );
  }
}
