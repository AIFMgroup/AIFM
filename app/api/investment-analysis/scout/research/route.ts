import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import * as cheerio from 'cheerio';
import { performEnrichedLookup } from '@/lib/integrations/securities';
import { getESGServiceClient } from '@/lib/integrations/esg/esg-service';
import { getYahooFinanceClient } from '@/lib/integrations/securities/yahoo-finance-client';

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
  'eu.anthropic.claude-opus-4-6-v1',
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 50000,
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
      console.warn(`[Scout Research] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

function parseJsonFromText(text: string): unknown {
  let cleaned = text;
  const fenceStart = cleaned.indexOf('```');
  if (fenceStart !== -1) {
    const afterFence = cleaned.indexOf('\n', fenceStart);
    if (afterFence !== -1) {
      const fenceEnd = cleaned.lastIndexOf('```');
      cleaned = fenceEnd > afterFence ? cleaned.slice(afterFence + 1, fenceEnd) : cleaned.slice(afterFence + 1);
    }
  }
  const objStart = cleaned.indexOf('{');
  const arrStart = cleaned.indexOf('[');
  let start: number;
  let openChar: string;
  let closeChar: string;
  if (objStart === -1 && arrStart === -1) return null;
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart; openChar = '['; closeChar = ']';
  } else {
    start = objStart; openChar = '{'; closeChar = '}';
  }
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
    if (ch === openChar) depth++;
    else if (ch === closeChar) { depth--; if (depth === 0) { end = i; break; } }
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

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

async function fetchPage(url: string, timeoutMs = 10000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchPdfAsBuffer(url: string, timeoutMs = 15000): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000 || buf.length > 30 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

interface DiscoveredDocument {
  url: string;
  title: string;
  category: string;
  size?: number;
}

async function discoverIRDocuments(companyName: string, ticker: string, website?: string): Promise<DiscoveredDocument[]> {
  const docs: DiscoveredDocument[] = [];
  const visited = new Set<string>();

  const irKeywords = [
    'investor', 'investors', 'ir', 'investerare',
    'financial-reports', 'finansiella-rapporter', 'reports',
    'annual-report', 'arsredovisning', 'sustainability',
    'hallbarhet', 'governance', 'bolagsstyrning',
  ];

  const searchName = companyName.replace(/\s+(AB|A\/S|ASA|Oyj|plc|Inc|Corp|Ltd)\.?$/i, '').trim();

  const candidateUrls: string[] = [];

  if (website) {
    candidateUrls.push(website);
    const base = website.replace(/\/$/, '');
    for (const kw of irKeywords.slice(0, 6)) {
      candidateUrls.push(`${base}/${kw}`);
      candidateUrls.push(`${base}/en/${kw}`);
      candidateUrls.push(`${base}/sv/${kw}`);
    }
  }

  const searchQueries = [
    `${searchName} investor relations annual report PDF`,
    `${searchName} årsredovisning PDF`,
    `${searchName} sustainability report PDF`,
  ];

  for (const query of searchQueries) {
    try {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
      const html = await fetchPage(googleUrl, 8000);
      if (html) {
        const $ = cheerio.load(html);
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href') || '';
          const urlMatch = href.match(/\/url\?q=([^&]+)/);
          if (urlMatch) {
            try {
              const decoded = decodeURIComponent(urlMatch[1]);
              if (decoded.includes(searchName.toLowerCase().split(' ')[0].toLowerCase()) ||
                  decoded.includes(ticker.toLowerCase().replace(/[.-]/g, ''))) {
                candidateUrls.push(decoded);
              }
            } catch { /* skip */ }
          }
        });
      }
    } catch {
      console.warn('[Scout Research] Google search failed for:', query);
    }
  }

  const pdfPattern = /\.pdf($|\?)/i;
  const docPatterns = [
    { pattern: /annual.?report|arsredovisning|årsredovisning/i, category: 'annual_report' },
    { pattern: /quarter|kvartals|q[1-4]|interim|halvår/i, category: 'quarterly_report' },
    { pattern: /sustainab|hållbar|esg|gri|csr|hallbarhet/i, category: 'sustainability_report' },
    { pattern: /investor|presentation|cmd|capital.?market/i, category: 'investor_presentation' },
    { pattern: /governance|bolagsstyrning|proxy/i, category: 'other' },
    { pattern: /prospekt|prospectus/i, category: 'other' },
  ];

  for (const url of candidateUrls.slice(0, 15)) {
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      if (pdfPattern.test(url)) {
        const title = decodeURIComponent(url.split('/').pop() || '').replace(/\.pdf.*/i, '');
        const cat = docPatterns.find(p => p.pattern.test(url))?.category || 'other';
        docs.push({ url, title: title || companyName + ' document', category: cat });
        continue;
      }

      const html = await fetchPage(url, 8000);
      if (!html) continue;

      const $ = cheerio.load(html);

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (!pdfPattern.test(href)) return;

        let fullUrl = href;
        try {
          fullUrl = new URL(href, url).toString();
        } catch { return; }

        if (visited.has(fullUrl)) return;
        visited.add(fullUrl);

        const combined = `${text} ${fullUrl}`.toLowerCase();
        const cat = docPatterns.find(p => p.pattern.test(combined))?.category || 'other';

        docs.push({
          url: fullUrl,
          title: text || decodeURIComponent(fullUrl.split('/').pop() || '').replace(/\.pdf.*/i, ''),
          category: cat,
        });
      });
    } catch {
      continue;
    }

    if (docs.length >= 15) break;
  }

  return docs.slice(0, 15);
}

function categorizeDocument(title: string, url: string): string {
  const combined = `${title} ${url}`.toLowerCase();
  if (/annual.?report|arsredovisning|årsredovisning|year.?end/i.test(combined)) return 'annual_report';
  if (/quarter|kvartals|q[1-4]|interim|halvår|half.?year/i.test(combined)) return 'quarterly_report';
  if (/sustainab|hållbar|esg|gri|csr|hallbarhet/i.test(combined)) return 'sustainability_report';
  if (/investor|presentation|cmd|capital.?market|roadshow/i.test(combined)) return 'investor_presentation';
  if (/industry|bransch|market.?overview|sector/i.test(combined)) return 'industry_analysis';
  return 'other';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, ticker, isin, country } = body as {
      name: string;
      ticker: string;
      isin?: string;
      country?: string;
    };

    if (!name && !ticker) {
      return NextResponse.json({ error: 'Bolagsnamn eller ticker krävs' }, { status: 400 });
    }

    console.log('[Scout Research] Starting deep research for:', name, ticker);

    const result: Record<string, unknown> = {
      name,
      ticker,
      isin: isin || '',
      documents: [] as DiscoveredDocument[],
      downloadableDocuments: [] as Array<{ url: string; title: string; category: string; sizeKB: number }>,
    };

    let lookupData: Record<string, unknown> = {};
    let esgData: Record<string, unknown> = {};

    try {
      const lookupResult = await performEnrichedLookup(
        isin || undefined,
        ticker || name || undefined,
        undefined
      );
      if (lookupResult.success && lookupResult.data) {
        const d = lookupResult.data;
        lookupData = {
          name: d.name?.value,
          ticker: d.ticker?.value,
          isin: d.isin?.value,
          mic: d.mic?.value,
          exchange: d.exchangeName?.value,
          sector: d.gicsSector?.value,
          industry: d.industry?.value,
          country: d.countryName?.value || d.country?.value,
          currency: d.currency?.value,
          marketCap: d.marketCap?.value,
          currentPrice: d.currentPrice?.value,
          emitter: d.emitter?.value,
          emitterLEI: d.emitterLEI?.value,
          averageDailyVolume: d.averageDailyVolume?.value,
        };
        result.lookupData = lookupData;
        if (!result.isin && d.isin?.value) result.isin = d.isin.value;
      }
    } catch (e) {
      console.warn('[Scout Research] Lookup failed:', e);
    }

    try {
      const esgClient = getESGServiceClient();
      const esgId = (result.isin as string) || isin || ticker;
      if (esgId && esgClient.getActiveProviderName()) {
        const data = await esgClient.getESGData(esgId);
        if (data) {
          esgData = {
            provider: data.provider,
            totalScore: data.totalScore,
            environmentScore: data.environmentScore,
            socialScore: data.socialScore,
            governanceScore: data.governanceScore,
            controversyLevel: data.controversyLevel,
            sfdrAlignment: data.sfdrAlignment,
            carbonIntensity: data.carbonIntensity,
            carbonIntensityUnit: data.carbonIntensityUnit,
          };
          result.esgData = esgData;
        }

        try {
          const paiData = await esgClient.getPAIIndicators(esgId);
          if (paiData?.length) {
            result.paiIndicators = paiData;
          }
        } catch { /* optional */ }
      }
    } catch (e) {
      console.warn('[Scout Research] ESG failed:', e);
    }

    let yahooData: Record<string, unknown> = {};
    try {
      const yahoo = getYahooFinanceClient();
      const symbol = ticker || (lookupData.ticker as string);
      if (symbol) {
        const quote = await yahoo.getQuote(symbol);
        if (quote.success && quote.data) {
          yahooData = {
            price: quote.data.regularMarketPrice,
            marketCap: quote.data.marketCap,
            volume: quote.data.averageDailyVolume3Month,
            high52w: quote.data.fiftyTwoWeekHigh,
            low52w: quote.data.fiftyTwoWeekLow,
            currency: quote.data.currency,
            sector: quote.data.sector,
            industry: quote.data.industry,
          };
          result.yahooData = yahooData;
        }
      }
    } catch (e) {
      console.warn('[Scout Research] Yahoo failed:', e);
    }

    let companyWebsite: string | undefined;
    try {
      const websitePrompt = `Vad är den officiella hemsidan (investor relations-sidan) för ${name} (ticker: ${ticker}${country ? ', land: ' + country : ''})? Svara BARA med URL:en, inget annat. Om du inte vet, svara med "unknown".`;
      const websiteRaw = await callClaude(
        'Du är en expert på börsnoterade bolag. Svara bara med URL.',
        websitePrompt,
        200
      );
      if (websiteRaw && !websiteRaw.includes('unknown') && websiteRaw.includes('http')) {
        companyWebsite = websiteRaw.trim().replace(/["\s]/g, '');
        result.website = companyWebsite;
      }
    } catch {
      console.warn('[Scout Research] Website lookup failed');
    }

    console.log('[Scout Research] Discovering IR documents for:', name, 'website:', companyWebsite);
    const discoveredDocs = await discoverIRDocuments(name, ticker, companyWebsite);
    result.documents = discoveredDocs;

    const downloadable: Array<{ url: string; title: string; category: string; sizeKB: number }> = [];
    const pdfDocsToCheck = discoveredDocs
      .filter(d => d.url.match(/\.pdf($|\?)/i))
      .slice(0, 8);

    for (const doc of pdfDocsToCheck) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const headRes = await fetch(doc.url, {
          method: 'HEAD',
          headers: FETCH_HEADERS,
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timer);

        if (headRes.ok) {
          const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
          const sizeKB = Math.round(contentLength / 1024);
          if (sizeKB > 0 && sizeKB < 50 * 1024) {
            downloadable.push({
              url: doc.url,
              title: doc.title,
              category: doc.category,
              sizeKB,
            });
          }
        }
      } catch {
        downloadable.push({
          url: doc.url,
          title: doc.title,
          category: doc.category,
          sizeKB: 0,
        });
      }
    }

    result.downloadableDocuments = downloadable;

    const dataSummary: string[] = [];
    if (Object.keys(lookupData).length > 0) dataSummary.push('Securities Lookup');
    if (Object.keys(esgData).length > 0) dataSummary.push('ESG Data');
    if (Object.keys(yahooData).length > 0) dataSummary.push('Yahoo Finance');
    if (discoveredDocs.length > 0) dataSummary.push(`${discoveredDocs.length} IR-dokument`);
    if (downloadable.length > 0) dataSummary.push(`${downloadable.length} nedladdningsbara PDF:er`);

    result.dataSources = dataSummary;

    // ── AI Deep Analysis: synthesize all collected data into investment insight ──
    try {
      const dataForAI: string[] = [`BOLAG: ${name} (Ticker: ${ticker}${isin ? ', ISIN: ' + isin : ''}${country ? ', Land: ' + country : ''})`];

      if (Object.keys(lookupData).length > 0) {
        dataForAI.push('\n=== SECURITIES DATA ===');
        for (const [k, v] of Object.entries(lookupData)) {
          if (v != null && v !== '') dataForAI.push(`${k}: ${v}`);
        }
      }
      if (Object.keys(esgData).length > 0) {
        dataForAI.push('\n=== ESG DATA ===');
        for (const [k, v] of Object.entries(esgData)) {
          if (v != null && v !== '') dataForAI.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        }
      }
      if (result.paiIndicators) {
        dataForAI.push('\n=== PAI INDICATORS ===');
        const pais = result.paiIndicators as Array<Record<string, unknown>>;
        for (const p of pais.slice(0, 15)) {
          dataForAI.push(`${p.name || p.id}: ${p.value ?? 'N/A'} ${p.unit || ''}`);
        }
      }
      if (Object.keys(yahooData).length > 0) {
        dataForAI.push('\n=== YAHOO FINANCE ===');
        for (const [k, v] of Object.entries(yahooData)) {
          if (v != null && v !== '') dataForAI.push(`${k}: ${v}`);
        }
      }
      if (companyWebsite) dataForAI.push(`\nWebbplats: ${companyWebsite}`);
      if (downloadable.length > 0) {
        dataForAI.push(`\n${downloadable.length} tillgängliga IR-dokument: ${downloadable.map(d => d.title).join(', ')}`);
      }

      const analysisSystemPrompt = `Du är en senior investeringsanalytiker. Baserat på ALL tillgänglig data om detta bolag, producera en strukturerad investeringsinsikt. Var specifik med siffror och undvik vaga uttalanden.

Svara med ett JSON-objekt:
{
  "summary": "3-4 meningar: Vad är detta för bolag och varför är det intressant/ointressant som investering?",
  "strengths": ["Styrka 1 med specifik data", "Styrka 2", "Styrka 3"],
  "concerns": ["Oro/risk 1 med specifik data", "Oro 2", "Oro 3"],
  "esgVerdict": "2-3 meningar: ESG-bedömning baserat på faktisk data. Passar det i en Artikel 8/9-fond?",
  "valuationSignal": "Undervärderad / Rimligt värderad / Högt värderad — med motivering baserad på tillgängliga nyckeltal",
  "liquidityAssessment": "Bedömning av likviditet för en institutionell investerare",
  "keyQuestion": "Den viktigaste frågan en förvaltare bör ställa sig innan investering",
  "dataQuality": "Hög / Medel / Låg — hur mycket verifierad data finns tillgänglig?"
}`;

      const aiAnalysisRaw = await callClaude(analysisSystemPrompt, dataForAI.join('\n'), 4000);
      if (aiAnalysisRaw) {
        const aiAnalysis = parseJsonFromText(aiAnalysisRaw);
        if (aiAnalysis) {
          result.aiAnalysis = aiAnalysis;
          dataSummary.push('AI-analys');
        }
      }
    } catch (e) {
      console.warn('[Scout Research] AI analysis failed:', e);
    }

    result.dataSources = dataSummary;

    console.log('[Scout Research] Complete. Sources:', dataSummary.join(', '));

    return NextResponse.json({
      success: true,
      research: result,
    });
  } catch (error) {
    console.error('[Scout Research] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte genomföra research' },
      { status: 500 }
    );
  }
}
