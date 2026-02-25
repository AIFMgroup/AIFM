import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { collectCompanyData } from '@/lib/company-analysis/orchestrator';
import { extractDocumentExcerpts } from '@/lib/company-analysis/extract-document-excerpts';
import type { CompleteCompanyAnalysis, SummarySection, FundTermsContext } from '@/lib/company-analysis/types';
import { getOpenFIGIClient } from '@/lib/integrations/securities/openfigi-client';
import { retrieveFromKnowledgeBase } from '@/lib/compliance/bedrockKnowledgeBase';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const MODEL_SONNET = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
const MODEL_OPUS = 'eu.anthropic.claude-opus-4-6-v1';
const MODEL_IDS_FALLBACK = [
  'eu.anthropic.claude-opus-4-6-v1',
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { isin, ticker, mic, fundId, useLSEG, query, companyName } = body as {
      isin?: string;
      ticker?: string;
      mic?: string;
      fundId?: string;
      useLSEG?: boolean;
      query?: string;
      companyName?: string;
    };

    if (query && typeof query === 'string') {
      query = query.trim();
    }
    if (!isin && !ticker && query) {
      const figiClient = getOpenFIGIClient();
      const searchResults = await figiClient.search(query);
      if (searchResults.length > 0 && searchResults[0].data?.ticker) {
        ticker = searchResults[0].data.ticker;
        if (searchResults[0].data?.exchangeCode) {
          mic = mic || searchResults[0].data.exchangeCode;
        }
      }
    }

    if (!isin && !ticker) {
      return NextResponse.json(
        { error: 'Ange isin, ticker eller query (bolagsnamn).' },
        { status: 400 }
      );
    }

    const analysis = await collectCompanyData({
      isin: isin || undefined,
      ticker: ticker || undefined,
      mic: mic || undefined,
      fundId: fundId || undefined,
      useLSEG: Boolean(useLSEG),
    });

    if (analysis.errors.length > 0 && !analysis.identification.lookup) {
      return NextResponse.json(
        { error: analysis.errors[0], warnings: analysis.warnings },
        { status: 404 }
      );
    }

    if (companyName && !analysis.identification.companyName) {
      analysis.identification.companyName = companyName;
    }

    if (analysis.documents.irDocuments.length > 0) {
      try {
        analysis.documents.documentExcerpts = await extractDocumentExcerpts(
          analysis.documents.irDocuments,
          { maxDocs: 5, excerptLength: 5000 }
        );
      } catch (e) {
        console.warn('[company-analysis] Document excerpt extraction failed:', e);
      }
    }

    try {
      const sector = analysis.identification.sector || analysis.identification.industry || '';
      const regQuery = sector
        ? `FFFS 2013:9 LVF 2004:46 krav likviditet värdering reglerad marknad ${sector}`
        : 'FFFS 2013:9 24 kap LVF 2004:46 krav likviditet värdering information';
      const kbResults = await retrieveFromKnowledgeBase(regQuery, 5);
      if (kbResults.length > 0) {
        analysis.compliance.regulatoryContext = kbResults
          .filter((r) => r.score >= 0.3)
          .slice(0, 5)
          .map((r) => `${r.metadata?.title ?? 'Källa'}: ${r.content}`);
      }
    } catch (e) {
      console.warn('[company-analysis] Bedrock KB retrieval failed:', e);
    }

    if (analysis.identification.lookup) {
      const aiSections = await runAIDeepAnalysis(analysis);
      if (aiSections) {
        analysis.financialAnalysis = aiSections.financialAnalysis ?? analysis.financialAnalysis;
        analysis.riskSwot = aiSections.riskSwot ?? analysis.riskSwot;
        analysis.summary = aiSections.summary ?? analysis.summary;
        if (aiSections.summary?.esgDecision) {
          analysis.esg.esgDecision = aiSections.summary.esgDecision;
          analysis.esg.esgDecisionMotivation = aiSections.summary.esgDecisionMotivation;
        }
      }
    }

    return NextResponse.json(analysis);
  } catch (err) {
    console.error('[company-analysis]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

function serializeForPrompt(analysis: CompleteCompanyAnalysis): string {
  const parts: string[] = [];
  const id = analysis.identification;
  if (id.companyName) parts.push(`Bolag: ${id.companyName}`);
  if (id.ticker) parts.push(`Ticker: ${id.ticker}`);
  if (id.isin) parts.push(`ISIN: ${id.isin}`);
  if (id.sector) parts.push(`Sektor: ${id.sector}`);
  if (id.industry) parts.push(`Bransch: ${id.industry}`);
  if (id.country) parts.push(`Land: ${id.country}`);

  const md = analysis.marketData;
  if (md.currentPrice != null) parts.push(`Kurs: ${md.currentPrice} ${md.currency || ''}`);
  if (md.marketCap != null) parts.push(`Börsvärde: ${md.marketCap}`);
  if (md.averageDailyVolume != null) parts.push(`Snitt volym/dag: ${md.averageDailyVolume}`);
  if (md.meetsLiquidityPresumption != null) parts.push(`Likviditetspresumtion: ${md.meetsLiquidityPresumption}`);
  if (md.peRatio != null) parts.push(`P/E: ${md.peRatio}`);
  if (md.forwardPE != null) parts.push(`Forward P/E: ${md.forwardPE}`);
  if (md.pbRatio != null) parts.push(`P/B: ${md.pbRatio}`);
  if (md.evToEbitda != null) parts.push(`EV/EBITDA: ${md.evToEbitda}`);
  if (md.dividendYield != null) parts.push(`Utdelningsavkastning: ${md.dividendYield}%`);
  if (md.returnOnEquity != null) parts.push(`ROE: ${md.returnOnEquity}%`);
  if (md.profitMargin != null) parts.push(`Vinstmarginal: ${md.profitMargin}%`);
  if (md.operatingMargin != null) parts.push(`Rörelsemarginal: ${md.operatingMargin}%`);
  if (md.debtToEquity != null) parts.push(`Skuld/Eget kapital: ${md.debtToEquity}`);
  if (md.revenueGrowth != null) parts.push(`Intäktstillväxt: ${md.revenueGrowth}%`);
  if (md.beta != null) parts.push(`Beta: ${md.beta}`);
  if (md.fiftyDayMA != null) parts.push(`50-dagars MA: ${md.fiftyDayMA}`);
  if (md.twoHundredDayMA != null) parts.push(`200-dagars MA: ${md.twoHundredDayMA}`);
  if (analysis.fundContext?.positionWeight != null) parts.push(`Position vikt i fond: ${(analysis.fundContext.positionWeight * 100).toFixed(2)}%`);
  if (analysis.fundContext?.sectorPeers && analysis.fundContext.sectorPeers.length > 0) {
    parts.push('Fondens övriga innehav (topp): ' + analysis.fundContext.sectorPeers.slice(0, 5).map((p) => p.name).join(', '));
  }
  const fffs = analysis.compliance.fffsCompliance ?? analysis.compliance.fffs;
  if (fffs) {
    parts.push('\n=== FFFS-compliance ===');
    parts.push(`Begränsad förlustpotential: ${fffs.limitedPotentialLoss}`);
    parts.push(`Likviditet inte äventurad: ${fffs.liquidityNotEndangered}`);
    parts.push(`Pålitlig värdering: ${fffs.reliableValuation?.checked}`);
    parts.push(`Lämplig information: ${fffs.appropriateInformation?.checked}`);
    parts.push(`Marknadsbar: ${fffs.isMarketable}`);
  }

  const esg = analysis.esg.esg;
  if (esg) {
    parts.push('\n=== ESG ===');
    if (esg.totalScore != null) parts.push(`ESG-poäng: ${esg.totalScore}`);
    if (esg.environmentScore != null) parts.push(`E: ${esg.environmentScore}`);
    if (esg.socialScore != null) parts.push(`S: ${esg.socialScore}`);
    if (esg.governanceScore != null) parts.push(`G: ${esg.governanceScore}`);
    if (esg.controversyLevel != null) parts.push(`Kontroversnivå: ${esg.controversyLevel}`);
    if (esg.sfdrAlignment) parts.push(`SFDR: ${esg.sfdrAlignment}`);
    if (esg.carbonIntensity != null) parts.push(`Koldioxidintensitet: ${esg.carbonIntensity} ${esg.carbonIntensityUnit || ''}`);
  }

  if (analysis.documents.irDocuments.length > 0) {
    parts.push('\n=== Tillgängliga IR-dokument ===');
    for (const d of analysis.documents.irDocuments.slice(0, 15)) {
      parts.push(`- ${d.category}: ${d.fileName}`);
    }
  }
  if (analysis.documents.documentExcerpts && analysis.documents.documentExcerpts.length > 0) {
    parts.push('\n=== Utdrag från IR-dokument (använd för djupare analys) ===');
    for (const ex of analysis.documents.documentExcerpts) {
      parts.push(`\n--- ${ex.fileName} (${ex.category || 'okänd'}) ---\n${ex.excerpt}`);
    }
  }

  if (analysis.compliance.regulatoryContext && analysis.compliance.regulatoryContext.length > 0) {
    parts.push('\n=== Regelverkskontext (FFFS/LVF) ===');
    for (const reg of analysis.compliance.regulatoryContext) {
      parts.push(reg);
    }
  }

  if (analysis.fundTermsContext) {
    parts.push(serializeFundTermsContext(analysis.fundTermsContext));
  }

  if (analysis.news.articles.length > 0) {
    parts.push('\n=== Senaste nyheter ===');
    for (const a of analysis.news.articles.slice(0, 5)) {
      parts.push(`- ${a.title} (${a.source})`);
    }
  }

  return parts.join('\n');
}

function serializeFundTermsContext(ctx: FundTermsContext): string {
  const parts: string[] = [];
  parts.push('\n=== FONDVILLKOR & EXKLUDERINGSPOLICY (KRITISKT – MÅSTE FÖLJAS) ===');
  parts.push(`Fond: ${ctx.fundName} (${ctx.fundId})`);
  parts.push(`SFDR-artikel: ${ctx.article}`);

  if (ctx.promotedCharacteristics?.length) {
    parts.push(`Främjade egenskaper: ${ctx.promotedCharacteristics.join('; ')}`);
  }

  if (ctx.exclusions.length > 0) {
    parts.push('\n--- EXKLUDERINGSKRITERIER (utvärdera varje rad) ---');
    parts.push('VIKTIGT: Max tillåten omsättningsandel (%) anges per kategori. Exponering UNDER gränsvärdet = GODKÄND. Exponering ÖVER gränsvärdet = UNDERKÄND.');
    parts.push('Om ingen exponeringsdata finns (null) = INGEN DATA (ej automatiskt underkänd).');
    parts.push('');
    for (const ex of ctx.exclusions) {
      const status = ex.actualPercent === null
        ? '⚪ INGEN DATA'
        : ex.approved
          ? `✅ GODKÄND (${ex.actualPercent.toFixed(1)}% ≤ ${ex.threshold}%)`
          : `❌ UNDERKÄND (${ex.actualPercent.toFixed(1)}% > ${ex.threshold}%)`;
      parts.push(`  ${ex.label}: Gränsvärde ${ex.threshold}% | Faktisk: ${ex.actualPercent !== null ? ex.actualPercent.toFixed(1) + '%' : 'okänt'} | ${status}${ex.source ? ` | Källa: ${ex.source}` : ''}`);
    }
  }

  if (ctx.normScreening) {
    parts.push('\n--- NORMBASERAD SCREENING ---');
    parts.push(`UNGC: ${ctx.normScreening.ungc ? 'Ja' : 'Nej'}, OECD: ${ctx.normScreening.oecd ? 'Ja' : 'Nej'}`);
    parts.push(`Mänskliga rättigheter: ${ctx.normScreening.humanRights ? 'Ja' : 'Nej'}, Anti-korruption: ${ctx.normScreening.antiCorruption ? 'Ja' : 'Nej'}`);
    parts.push(`Kontroversnivå auto-underkänd vid: ≥${ctx.normScreening.controversyAutoReject}`);
  }

  if (ctx.fondvillkorExcerpt) {
    parts.push('\n--- FONDVILLKOR (utdrag ur dokument) ---');
    parts.push(ctx.fondvillkorExcerpt.slice(0, 8000));
  }

  return parts.join('\n');
}

interface AISections {
  financialAnalysis?: CompleteCompanyAnalysis['financialAnalysis'];
  riskSwot?: CompleteCompanyAnalysis['riskSwot'];
  summary?: SummarySection;
}

function parseJsonFromText(text: string): AISections | null {
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
    return JSON.parse(jsonStr) as AISections;
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,\s*([\]}])/g, '$1')) as AISections;
    } catch {
      return null;
    }
  }
}

function extractTextFromModelResponse(response: { output?: { message?: { content?: unknown[] } } }): string | null {
  const output = response.output?.message?.content;
  const first = output?.[0];
  return first && typeof first === 'object' && 'text' in first ? (first as { text: string }).text : null;
}

async function runAIDeepAnalysis(analysis: CompleteCompanyAnalysis): Promise<AISections | null> {
  const dataBlock = serializeForPrompt(analysis);
  const companyName = analysis.identification.companyName || analysis.identification.ticker || 'Bolaget';

  const hasFundTerms = !!analysis.fundTermsContext;

  // Pass 1 (Sonnet): Fact-based analysis – nyckeltal, dokumentutdrag, regelkontext
  let pass1Financial: CompleteCompanyAnalysis['financialAnalysis'] = {};
  try {
    const fundTermsInstruction = hasFundTerms
      ? `\n\nKRITISKT – FONDVILLKOR:
Du MÅSTE först läsa igenom fondvillkoren noggrant. Alla bedömningar ska göras mot den specifika fondens regler:
1. EXKLUDERINGSKRITERIER: Varje kategori har ett gränsvärde (threshold). Exponering UNDER gränsvärdet = GODKÄND för fonden. Exponering ÖVER = UNDERKÄND. 0% threshold = nolltolerans.
2. PLACERINGSSTRATEGIN: Beskriv hur bolaget passar (eller inte passar) fondens placeringsstrategi och syfte.
3. NORMBASERAD SCREENING: Kontrollera UNGC/OECD-överträdelser mot fondens krav.
4. Om en sektor (t.ex. vapen) har gränsvärde 5%: ett bolag med <5% exponering är GODKÄNT – flagga det INTE som risk.
5. VIKTIGT OM 'Defense': Datia:s kategori 'Defense' är en BRED sektorklassificering (t.ex. lastbilar/motorer som säljs till försvaret). Det är INTE samma sak som 'weapons' (vapenproduktion). Volvo kan klassificeras som Defense: 100% utan att vara vapenproducent. Skilj ALLTID på 'Defense' (bred) och 'weapons'/'controversialWeapons' (direkt vapenproduktion).`
      : '';

    const systemPass1 = `Du är en investeringsanalytiker på AIFM Capital AB. Du får strukturerad data (nyckeltal, ESG, compliance, dokumentutdrag, regelverk). Uppgift: producera en fakta- och datagrundad analys, ingen spekulativ bedömning.${fundTermsInstruction}

Svara med endast ett JSON-objekt med nyckeln "financialAnalysis" och fälten (korta stycken på svenska):
executiveSummary, companyOverview, businessModel, marketPosition, financialAnalysis, valuationMetrics, managementGovernance.
Om data finns: peerComparison (jämförelse med bransch/fond), sectorOutlook, dividendAnalysis, debtAnalysis, growthAssessment.
${hasFundTerms ? 'Om fondvillkor finns: placementStrategyFit (hur bolaget passar fondens placeringsstrategi).' : ''}
Använd bara information från användarmeddelandet.`;

    const res1 = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_SONNET,
        system: [{ text: systemPass1 }],
        messages: [{ role: 'user', content: [{ text: `Data för ${companyName}:\n\n${dataBlock}\n\nReturnera JSON med endast nyckeln "financialAnalysis".` }] }],
        inferenceConfig: { maxTokens: 6000 },
      })
    );
    const text1 = extractTextFromModelResponse(res1);
    if (text1) {
      const parsed1 = parseJsonFromText(text1);
      if (parsed1?.financialAnalysis) pass1Financial = parsed1.financialAnalysis;
    }
  } catch (e) {
    console.warn('[company-analysis] Pass 1 (Sonnet) failed:', e);
  }

  // Pass 2 (Opus): Strategic synthesis – SWOT, risk, betyg, investeringstes, compliance-utlåtande
  const fundTermsPass2 = hasFundTerms
    ? `\n\nKRITISKT – FONDVILLKOR OCH EXKLUDERINGSPOLICY:
1. Du MÅSTE basera din ESG-bedömning och esgRating på den specifika fondens fondvillkor.
2. EXKLUDERINGSKRITERIER: Varje rad har ett gränsvärde (t.ex. 5%). Om bolagets exponering i en kategori är UNDER gränsvärdet = GODKÄND. Flagga INTE kategorier som godkända som risk.
3. PLACERINGSSTRATEGIN: Bedöm om bolaget passar fondens syfte och strategi. Inkludera detta i investmentThesis.
4. esgDecision: Sätt till "approved" om ALLA exkluderingskriterier klaras OCH normbaserad screening godkänns. Annars "rejected".
5. esgDecisionMotivation: Motivera beslutet med specifika siffror och gränsvärden, t.ex. "Vapenexponering 2.1% under fondens gränsvärde 5% – GODKÄND."
6. I conclusion, sammanfatta compliance-status inklusive exkluderingskontroll, normscreening och FFFS/LVF.
7. VIKTIGT OM 'Defense': Datia:s kategori 'Defense' är en BRED sektorklassificering (t.ex. lastbilar/motorer/IT-tjänster till försvaret). Det är INTE samma sak som 'weapons' (vapenproduktion) eller 'controversialWeapons' (klusterbomber, kemiska vapen). Bedöm 'Defense' separat — det ska INTE leda till automatisk avvisning.`
    : '';

  const systemPass2 = `Du är en erfaren investeringsanalytiker på AIFM Capital AB. Du får (1) en faktagrundad analys och (2) all rådata. Uppgift: syntetisera till strategisk bedömning och rekommendation.${fundTermsPass2}

Svara med ett JSON-objekt med:
- "riskSwot": { "riskAnalysis" (text), "swotAnalysis": { "strengths", "weaknesses", "opportunities", "threats" (array av strängar) }, "controversySummary" (text) }
- "summary": { "overallRating" ("strong_buy"|"buy"|"hold"|"sell"|"strong_sell"), "riskLevel" ("low"|"medium"|"high"|"very_high"), "esgRating" ("excellent"|"good"|"adequate"|"poor"|"critical"), "investmentThesis" (text), "prosAndCons": { "pros" (array), "cons" (array) }, "conclusion" (text)${hasFundTerms ? ', "esgDecision" ("approved"|"rejected"), "esgDecisionMotivation" (text)' : ''} }

Koppla ESG till SFDR/Artikel 8/9 där det är relevant. Ge en kort compliance-bedömning i conclusion om FFFS/LVF-krav. Var koncis.`;

  const pass2Input = pass1Financial.executiveSummary
    ? `Faktagrundad analys (Pass 1):\n${JSON.stringify(pass1Financial, null, 0)}\n\nRådata:\n${dataBlock}\n\nBolag: ${companyName}\n\nReturnera JSON enligt instruktionerna.`
    : `Rådata (ingen tidigare analys):\n\n${dataBlock}\n\nBolag: ${companyName}\n\nReturnera JSON med riskSwot och summary enligt instruktionerna.`;

  try {
    const res2 = await bedrockClient.send(
      new ConverseCommand({
        modelId: MODEL_OPUS,
        system: [{ text: systemPass2 }],
        messages: [{ role: 'user', content: [{ text: pass2Input }] }],
        inferenceConfig: { maxTokens: 6000 },
      })
    );
    const text2 = extractTextFromModelResponse(res2);
    if (text2) {
      const parsed2 = parseJsonFromText(text2);
      if (parsed2) {
        return {
          financialAnalysis: { ...pass1Financial, ...parsed2.financialAnalysis },
          riskSwot: parsed2.riskSwot,
          summary: parsed2.summary,
        };
      }
    }
  } catch (e) {
    console.warn('[company-analysis] Pass 2 (Opus) failed:', e);
  }

  // Fallback: single-call with any available model
  const systemFallback = `Du är en erfaren investeringsanalytiker på AIFM Capital AB. Producera en kort analys.

Svara med ett JSON-objekt med nycklarna (svenska texter):
- "financialAnalysis": { "executiveSummary", "companyOverview", "businessModel", "marketPosition", "financialAnalysis", "valuationMetrics", "managementGovernance" }
- "riskSwot": { "riskAnalysis", "swotAnalysis": { "strengths", "weaknesses", "opportunities", "threats" (array) }, "controversySummary" }
- "summary": { "overallRating" ("strong_buy"|"buy"|"hold"|"sell"|"strong_sell"), "riskLevel", "esgRating", "investmentThesis", "prosAndCons": { "pros", "cons" }, "conclusion" }
Använd bara data från användarmeddelandet.`;

  for (const modelId of MODEL_IDS_FALLBACK) {
    try {
      const response = await bedrockClient.send(
        new ConverseCommand({
          modelId,
          system: [{ text: systemFallback }],
          messages: [{ role: 'user', content: [{ text: `Analysera:\n\n${dataBlock}\n\nBolag: ${companyName}\n\nReturnera JSON.` }] }],
          inferenceConfig: { maxTokens: 8000 },
        })
      );
      const text = extractTextFromModelResponse(response);
      if (text) {
        const parsed = parseJsonFromText(text);
        if (parsed) {
          return {
            financialAnalysis: { ...pass1Financial, ...parsed.financialAnalysis },
            riskSwot: parsed.riskSwot,
            summary: parsed.summary,
          };
        }
      }
    } catch (e) {
      console.warn(`[company-analysis] Fallback model ${modelId} failed:`, e);
    }
  }
  return Object.keys(pass1Financial).length > 0 ? { financialAnalysis: pass1Financial } : null;
}
