import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { performEnrichedLookup } from '@/lib/integrations/securities';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import { getYahooFinanceClient } from '@/lib/integrations/securities/yahoo-finance-client';
import { getESGFundConfig } from '@/lib/integrations/securities/esg-fund-configs';
import { getFundDocumentText } from '@/lib/fund-documents/fund-document-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const HAIKU_MODELS = ['eu.anthropic.claude-haiku-4-5-20251001-v1:0'];
const SONNET_MODELS = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function callClaudeHaiku(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string | null> {
  for (const modelId of HAIKU_MODELS) {
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
      console.warn(`[Scout-analyze] Haiku ${modelId} failed:`, err);
    }
  }
  return null;
}

async function callClaudeSonnet(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number
): Promise<string | null> {
  for (const modelId of SONNET_MODELS) {
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
      console.warn(`[Scout-analyze] Sonnet ${modelId} failed:`, err);
    }
  }
  return null;
}

function stripCodeFences(text: string): string {
  const fenceStart = text.indexOf('```');
  if (fenceStart === -1) return text;
  const afterFence = text.indexOf('\n', fenceStart);
  if (afterFence === -1) return text;
  const fenceEnd = text.lastIndexOf('```');
  if (fenceEnd > afterFence) return text.slice(afterFence + 1, fenceEnd);
  return text.slice(afterFence + 1);
}

function extractBraceMatched(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = stripCodeFences(text);
  const jsonStr = extractBraceMatched(cleaned, '{', '}');
  if (!jsonStr) return null;
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

function parseJsonArray(text: string): unknown[] | null {
  const cleaned = stripCodeFences(text);
  const jsonStr = extractBraceMatched(cleaned, '[', ']');
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr) as unknown[];
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,\s*([\]}])/g, '$1')) as unknown[];
    } catch {
      return null;
    }
  }
}

interface ScoutRec {
  name: string;
  ticker: string;
  isin: string;
  sector: string;
  country: string;
  [key: string]: unknown;
}

async function enrichWithAPIs(rec: ScoutRec): Promise<Record<string, unknown>> {
  const enriched: Record<string, unknown> = { ...rec };

  try {
    if (rec.isin || rec.ticker) {
      const lookupResult = await performEnrichedLookup(
        rec.isin || undefined,
        rec.ticker || undefined,
        undefined
      );
      if (lookupResult.success && lookupResult.data) {
        const d = lookupResult.data;
        enriched.marketCap = d.marketCap?.value;
        enriched.currentPrice = d.currentPrice?.value;
        enriched.currency = d.currency?.value;
        enriched.exchange = d.exchangeName?.value;
        enriched.industry = d.industry?.value;
        enriched.gicsSector = d.gicsSector?.value;
        enriched.isin = d.isin?.value || rec.isin;
        enriched.ticker = d.ticker?.value || rec.ticker;
        enriched.name = d.name?.value || rec.name;
        enriched.country = d.countryName?.value || d.country?.value || rec.country;
        enriched.lei = d.emitterLEI?.value;
        enriched.emitter = d.emitter?.value;
        enriched.avgDailyVolume = d.averageDailyVolume?.value;
        enriched.isRegulatedMarket = d.isRegulatedMarket?.value;
        enriched.lookupSuccess = true;
      }
    }
  } catch (e) {
    console.warn('[Scout-analyze] Lookup failed for', rec.name, e);
  }

  try {
    const esgClient = getESGServiceClient();
    const esgId = (enriched.isin as string) || rec.ticker;
    if (esgId && esgClient.getActiveProviderName()) {
      const esgData = await esgClient.getESGData(esgId);
      if (esgData) {
        enriched.esgScore = esgData.totalScore;
        enriched.esgEnvironment = esgData.environmentScore;
        enriched.esgSocial = esgData.socialScore;
        enriched.esgGovernance = esgData.governanceScore;
        enriched.esgProvider = esgData.provider;
        enriched.carbonIntensity = esgData.carbonIntensity;
        enriched.carbonIntensityUnit = esgData.carbonIntensityUnit;
        enriched.sfdrAlignmentAPI = esgData.sfdrAlignment;
        enriched.taxonomyAlignment = esgData.taxonomyAlignmentPercent;
        enriched.controversyLevel = esgData.controversyLevel;
        enriched.esgSuccess = true;
      }
      try {
        const paiData = await esgClient.getPAIIndicators(esgId);
        if (paiData?.length) enriched.paiIndicators = paiData.slice(0, 10);
      } catch { /* optional */ }
      try {
        const exclusionData = await esgClient.getExclusionScreening(esgId);
        if (exclusionData) enriched.exclusionFlags = exclusionData;
      } catch { /* optional */ }
    }
  } catch (e) {
    console.warn('[Scout-analyze] ESG failed for', rec.name, e);
  }

  try {
    const yahoo = getYahooFinanceClient();
    const symbol = rec.ticker || (enriched.ticker as string);
    if (symbol) {
      const quote = await yahoo.getQuote(symbol);
      if (quote.success && quote.data) {
        enriched.yahooPrice = quote.data.regularMarketPrice;
        enriched.yahooMarketCap = quote.data.marketCap;
        enriched.yahooVolume = quote.data.averageDailyVolume3Month;
        enriched.yahoo52wHigh = quote.data.fiftyTwoWeekHigh;
        enriched.yahoo52wLow = quote.data.fiftyTwoWeekLow;
        enriched.yahooCurrency = quote.data.currency;
        enriched.yahooSector = quote.data.sector;
        enriched.yahooIndustry = quote.data.industry;
        if (
          quote.data.regularMarketPrice &&
          quote.data.fiftyTwoWeekHigh &&
          quote.data.fiftyTwoWeekLow
        ) {
          const price = quote.data.regularMarketPrice;
          const high = quote.data.fiftyTwoWeekHigh;
          const low = quote.data.fiftyTwoWeekLow;
          enriched.priceVs52wHigh = `${(((price - high) / high) * 100).toFixed(1)}%`;
          enriched.priceVs52wLow = `${(((price - low) / low) * 100).toFixed(1)}%`;
          enriched.rangePosition52w = `${(((price - low) / (high - low)) * 100).toFixed(0)}%`;
        }
      }
    }
  } catch (e) {
    console.warn('[Scout-analyze] Yahoo failed for', rec.name, e);
  }

  return enriched;
}

function formatNum(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  return String(v);
}

function formatEnrichedDataForAI(enrichedRecs: Array<Record<string, unknown>>): string {
  const lines: string[] = ['=== VERIFIERAD MARKNADSDATA ===\n'];
  for (const rec of enrichedRecs) {
    lines.push(`--- ${rec.name} (${rec.ticker}) ---`);
    if (rec.lookupSuccess) {
      lines.push(`  ISIN: ${rec.isin || 'N/A'}, Bors: ${rec.exchange || 'N/A'}`);
      lines.push(`  Sektor: ${rec.gicsSector || rec.sector || 'N/A'}, Bransch: ${rec.industry || 'N/A'}`);
    }
    if (rec.yahooPrice || rec.currentPrice) {
      const price = rec.yahooPrice || rec.currentPrice;
      const mcap = rec.yahooMarketCap || rec.marketCap;
      lines.push(`  Kurs: ${price} ${rec.currency || rec.yahooCurrency || ''}, Borsvarde: ${mcap ? formatNum(mcap as number) : 'N/A'}`);
      lines.push(`  52v: ${rec.yahoo52wHigh || 'N/A'} / ${rec.yahoo52wLow || 'N/A'}, Range: ${rec.rangePosition52w || 'N/A'}`);
    }
    if (rec.esgSuccess) {
      lines.push(`  ESG: ${rec.esgScore ?? 'N/A'}/100 (E:${rec.esgEnvironment ?? '?'} S:${rec.esgSocial ?? '?'} G:${rec.esgGovernance ?? '?'})`);
      lines.push(`  SFDR API: ${rec.sfdrAlignmentAPI || 'N/A'}, Kontroverser: ${rec.controversyLevel ?? 'N/A'}`);
    }
    if (!rec.lookupSuccess && !rec.esgSuccess) {
      lines.push('  [Ingen API-data]');
    }
    lines.push('');
  }
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  let body: {
    investmentStrategy: string;
    sfdrArticle: string;
    fundId?: string;
    fundTerms?: string;
    preferences?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ogiltig förfrågan' }, { status: 400 });
  }

  let { investmentStrategy, sfdrArticle, fundId, fundTerms, preferences } = body;
  if (!investmentStrategy) {
    return NextResponse.json({ error: 'Investeringsstrategi krävs' }, { status: 400 });
  }

  // Build structured fund exclusion context when a fund is selected
  let fundExclusionContext = '';
  if (fundId) {
    try {
      const storedText = await getFundDocumentText(fundId);
      if (storedText?.trim()) {
        fundTerms = `FONDVILLKOR FRÅN SYSTEMET (sparade dokument för den valda fonden):\n\n${storedText.trim()}\n\n${fundTerms ? `ÖVRIGA ANVISNINGAR:\n${fundTerms}` : ''}`;
      }
    } catch (e) {
      console.warn('[Scout-analyze] Could not load fund document text for', fundId, e);
    }

    const fundConfig = getESGFundConfig(fundId, fundId);
    if (fundConfig) {
      const lines: string[] = [
        `\n--- EXKLUDERINGSPOLICY (${fundConfig.fundName}, Artikel ${fundConfig.article}) ---`,
        'VIKTIGT: Max tillåten omsättningsandel per sektor. Bolag med exponering UNDER gränsvärdet = tillåtet.',
      ];
      for (const ex of fundConfig.exclusions) {
        lines.push(`  ${ex.label}: Max ${ex.threshold}% (${ex.severity})`);
      }
      if (fundConfig.promotedCharacteristics?.length) {
        lines.push(`Främjade egenskaper: ${fundConfig.promotedCharacteristics.join('; ')}`);
      }
      fundExclusionContext = lines.join('\n');
    }
  }

  const encoder = new TextEncoder();
  const KEEPALIVE_INTERVAL_MS = 15_000;

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

      function startKeepalive() {
        stopKeepalive();
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            stopKeepalive();
          }
        }, KEEPALIVE_INTERVAL_MS);
      }

      function stopKeepalive() {
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
          keepaliveTimer = null;
        }
      }

      function push(event: string, data: unknown) {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      }

      try {
        startKeepalive();

        // --- Step 1: Framework (Haiku) ---
        push('progress', { step: 'framework', message: 'Bygger analysramverk...' });

        const sfdrText =
          sfdrArticle === '9'
            ? 'STRIKT: Hållbart investeringsmål. Låg koldioxidintensitet, inga kontroversiella verksamheter, hög taxonomi, ESG >70.'
            : sfdrArticle === '8'
              ? 'Främja miljö/sociala egenskaper. Undvik kontroversiella verksamheter. ESG >50/100.'
              : 'Inga specifika hållbarhetskrav, ESG-risker beaktas.';

        const frameworkPrompt = `Du är senior portföljförvaltare. Skapa ett kort analysramverk som JSON.

SFDR (Artikel ${sfdrArticle || '8'}): ${sfdrText}
${fundExclusionContext ? `${fundExclusionContext}\n` : ''}
${fundTerms ? `FONDVILLKOR:\n${fundTerms}\n` : ''}
${preferences ? `PREFERENSER:\n${preferences}\n` : ''}

Svara ENBART med ett JSON-objekt:
{"macroAnalysis":"2-4 meningar makroläge","themes":["Tema1","Tema2","Tema3"],"targetSectors":["Sektor1","Sektor2","Sektor3"],"targetRegions":["Region1","Region2"],"screeningCriteria":{"minMarketCap":"","liquidityRequirement":"","growthProfile":"","valuationRange":"","esgMinimum":""},"avoidSectors":[],"riskBudget":""}`;

        const frameworkRaw = await callClaudeHaiku(
          frameworkPrompt,
          `Strategi: ${investmentStrategy}\nSFDR: Artikel ${sfdrArticle || '8'}`,
          1000
        );

        if (!frameworkRaw) {
          stopKeepalive();
          push('error', { error: 'Kunde inte bygga analysramverk. Försök igen.' });
          controller.close();
          return;
        }

        const framework = parseJsonObject(frameworkRaw);
        if (!framework) {
          stopKeepalive();
          push('error', { error: 'Kunde inte tolka analysramverk.' });
          controller.close();
          return;
        }

        push('step', { step: 'framework', data: framework });

        // --- Step 2: Screening - 5 companies (Sonnet) ---
        push('progress', { step: 'screening', message: 'Väljer 5 bolag...' });

        const screeningPrompt = `Du är senior portföljförvaltare. Välj exakt 5 börsnoterade bolag baserat på ramverket.

KRAV: Diversifiering, blandning defensiv/offensiv, minst 1 contrarian-val, SFDR Art ${sfdrArticle || '8'}.
${fundExclusionContext ? `EXKLUDERINGSPOLICY FÖR FONDEN:\n${fundExclusionContext}\nVälj INTE bolag som bryter mot fondens exkluderingspolicy.\n` : ''}
${preferences ? `PREFERENSER: ${preferences}` : ''}

Svara ENBART med JSON-array med 5 objekt:
[{"name":"Bolagsnamn","ticker":"Yahoo-ticker (t.ex. VOLV-B.ST)","isin":"","sector":"Sektor","country":"Land","rationale":"Kort motivering","sfdrAlignment":"Kort SFDR","estimatedESG":"Utmärkt/Bra/Godkänd","keyMetrics":"P/E, tillväxt etc."}]`;

        const screeningRaw = await callClaudeSonnet(
          screeningPrompt,
          `Strategi: ${investmentStrategy}\n\nRAMVERK:\n${JSON.stringify(framework, null, 2)}`,
          3000
        );

        if (!screeningRaw) {
          stopKeepalive();
          push('error', { error: 'Kunde inte välja bolag. Försök igen.' });
          controller.close();
          return;
        }

        const selectionsArr = parseJsonArray(screeningRaw);
        const selections = Array.isArray(selectionsArr) ? (selectionsArr as ScoutRec[]).slice(0, 5) : null;
        if (!selections?.length) {
          stopKeepalive();
          push('error', { error: 'Kunde inte tolka bolagsval.' });
          controller.close();
          return;
        }

        push('step', { step: 'screening', data: { selections } });

        // --- Step 3: Enrichment (no LLM) ---
        push('progress', { step: 'enrichment', message: 'Hämtar marknadsdata och ESG...' });

        const enrichedResults = await Promise.allSettled(
          selections.map((rec) => enrichWithAPIs(rec))
        );
        const enrichedRecs = enrichedResults.map((r, i) =>
          r.status === 'fulfilled' ? r.value : { ...selections[i], enrichmentFailed: true }
        );

        push('step', { step: 'enrichment', data: { enrichedRecommendations: enrichedRecs } });

        // --- Step 4: Investment theses (Sonnet) ---
        push('progress', { step: 'thesis', message: 'Bygger investeringsteser...' });

        const selectionsBlock = selections
          .map(
            (s, i) =>
              `${i + 1}. ${s.name} (${s.ticker}) — ${s.sector}, ${s.country}\n   ${s.rationale}`
          )
          .join('\n\n');

        const thesisPrompt = `Du är toppförvaltare. Fördjupa analysen med investeringstes per bolag. SFDR Art ${sfdrArticle || '8'}.

Svara ENBART med JSON-array med 5 objekt (samma ordning som input). Behåll name, ticker, isin, sector, country. Fyll i:
rationale, sfdrAlignment, estimatedESG, keyMetrics, investmentThesis (2-3 meningar), catalysts (array), risks (array), targetAllocation, timeHorizon, convictionLevel, peerComparison, valuationView.`;

        const thesisRaw = await callClaudeSonnet(
          thesisPrompt,
          `VALDA BOLAG:\n${selectionsBlock}\n\nRAMVERK:\n${JSON.stringify(framework)}\n\nFördjupa med komplett investeringstes per bolag.`,
          4000
        );

        const recommendations: Array<Record<string, unknown>> = !thesisRaw
          ? enrichedRecs
          : (() => {
              const thesisArr = parseJsonArray(thesisRaw);
              return Array.isArray(thesisArr)
                ? (thesisArr as Record<string, unknown>[]).slice(0, 5).map((t, i) => ({ ...enrichedRecs[i], ...t }))
                : enrichedRecs;
            })();
        push('step', { step: 'thesis', data: { recommendations } });

        // --- Step 5: Comparison (Sonnet) ---
        push('progress', { step: 'comparison', message: 'Komparativ portföljanalys...' });

        const dataBlock = formatEnrichedDataForAI(recommendations);
        const comparisonPrompt = `Du är senior portföljförvaltare. Analysera datan och producera JSON:

{"ranking":[{"name":"Bolag","rank":1,"score":"8.5/10","reasoning":"Motivering"}],"portfolioSynthesis":"2-4 meningar","warnings":[],"overallRecommendation":"3-5 meningar","macroContext":"2-3 meningar","diversificationScore":"Hög/Medel/Låg med motivering"}

SFDR: Art ${sfdrArticle || '8'}. Strategi: ${investmentStrategy}`;

        const compRaw = await callClaudeSonnet(comparisonPrompt, dataBlock, 2000);
        const comparativeAnalysis = compRaw ? parseJsonObject(compRaw) : null;

        push('step', { step: 'comparison', data: { comparativeAnalysis } });
        stopKeepalive();
        push('step', { step: 'done' });
        controller.close();
      } catch (err) {
        stopKeepalive();
        console.error('[Scout-analyze] Error:', err);
        push('error', {
          error: err instanceof Error ? err.message : 'Analysen misslyckades',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
