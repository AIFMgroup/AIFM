import { NextRequest, NextResponse } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

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
      console.warn(`[Scout] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

function extractBraceMatched(text: string): string | null {
  const arrStart = text.indexOf('[');
  const objStart = text.indexOf('{');
  let start: number;
  let open: string;
  let close: string;
  if (arrStart === -1 && objStart === -1) return null;
  if (arrStart === -1) { start = objStart; open = '{'; close = '}'; }
  else if (objStart === -1) { start = arrStart; open = '['; close = ']'; }
  else if (arrStart < objStart) { start = arrStart; open = '['; close = ']'; }
  else { start = objStart; open = '{'; close = '}'; }

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

  const extracted = extractBraceMatched(cleaned);
  if (!extracted) return null;
  try {
    return JSON.parse(extracted);
  } catch {
    try {
      return JSON.parse(extracted.replace(/,\s*([\]}])/g, '$1'));
    } catch {
      return null;
    }
  }
}

interface SelectionInput {
  name: string;
  ticker: string;
  isin: string;
  sector: string;
  country: string;
  rationale: string;
  sfdrAlignment: string;
  estimatedESG: string;
  keyMetrics: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: {
    investmentStrategy: string;
    sfdrArticle: string;
    screening: Record<string, unknown>;
    selections: SelectionInput[];
    fundTerms?: string;
    preferences?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ogiltig förfrågan' }, { status: 400 });
  }

  const { investmentStrategy, sfdrArticle, screening, selections, fundTerms, preferences } = body;
  if (!investmentStrategy || !selections?.length) {
    return NextResponse.json({ error: 'Strategi och bolagsval krävs' }, { status: 400 });
  }

  try {
    console.log('[Scout] Building investment theses for', selections.length, 'companies');
    const selectionsBlock = selections.map((s, i) =>
      `${i + 1}. ${s.name} (${s.ticker}) — ${s.sector}, ${s.country}\n   Motivering: ${s.rationale}\n   ESG: ${s.estimatedESG}, Nyckeltal: ${s.keyMetrics}`
    ).join('\n\n');

    const systemPrompt = `Du är en av världens främsta portföljförvaltare. Du har redan genomfört makroanalys och valt 5 bolag. Nu ska du fördjupa analysen med en komplett investeringstes per bolag.

MAKROKONTEXT:
${JSON.stringify(screening, null, 2)}

SFDR-KRAV (Artikel ${sfdrArticle || '8'}):
${sfdrArticle === '9'
  ? 'STRIKT: Alla innehav MÅSTE ha verifierbart hållbart investeringsmål. Kräv låg koldioxidintensitet (<100 tCO2e/M€), inga kontroversiella verksamheter, hög taxonomianpassning (>20%), ESG-score >70/100.'
  : sfdrArticle === '8'
    ? 'Innehaven ska främja miljömässiga eller sociala egenskaper. Undvik kontroversiella verksamheter. Prioritera ESG-score >50/100. Koldioxidintensitet under branschsnittet.'
    : 'Inga specifika hållbarhetskrav, men ESG-risker ska beaktas och flaggas.'}

${fundTerms ? `FONDVILLKOR:\n${fundTerms}\n` : ''}
${preferences ? `PREFERENSER:\n${preferences}\n` : ''}

Svara ENBART med en JSON-array med exakt 5 objekt. Behåll name, ticker, isin, sector, country från input men fördjupa övriga fält:
[{
  "name": "Fullständigt bolagsnamn",
  "ticker": "Yahoo Finance-ticker",
  "isin": "ISIN-kod",
  "sector": "Sektor",
  "country": "Land",
  "rationale": "3-5 meningar med djupgående motivering kopplad till strategi, makro och fundamenta",
  "sfdrAlignment": "Specifik beskrivning av hur bolaget uppfyller SFDR-kraven",
  "estimatedESG": "Utmärkt/Bra/Godkänd med kort motivering",
  "keyMetrics": "Specifika nyckeltal: P/E, tillväxt, marginal, utdelning etc.",
  "investmentThesis": "2-3 meningar: Kärnargumentet för varför detta är en bra investering just nu",
  "catalysts": ["Katalysator 1", "Katalysator 2", "Katalysator 3"],
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "targetAllocation": "Rekommenderad portföljvikt i % (t.ex. 3-5%)",
  "timeHorizon": "Kort (3-6 mån) / Medel (6-18 mån) / Lång (18+ mån)",
  "convictionLevel": "Hög / Medel / Spekulativ",
  "peerComparison": "Kort jämförelse med 1-2 alternativa bolag i samma sektor",
  "valuationView": "Uppskattning: Undervärderad / Rimligt värderad / Högt värderad, med kort motivering"
}]`;

    const userMessage = `VALDA BOLAG:\n${selectionsBlock}\n\nFördjupa analysen med komplett investeringstes per bolag.`;
    const raw = await callClaude(systemPrompt, userMessage, 8000);

    if (!raw) {
      return NextResponse.json(
        { error: 'AI kunde inte generera investeringsteser. Försök igen.' },
        { status: 500 }
      );
    }

    const parsed = parseJsonFromText(raw);
    if (!parsed || !Array.isArray(parsed)) {
      console.error('[Scout] Failed to parse thesis:', raw.substring(0, 500));
      return NextResponse.json(
        { error: 'Kunde inte tolka AI-svaret. Försök igen.' },
        { status: 500 }
      );
    }

    const recommendations = parsed.slice(0, 5);
    console.log('[Scout] Built theses for', recommendations.length, 'companies');
    return NextResponse.json({
      success: true,
      recommendations,
      strategy: investmentStrategy,
      sfdrArticle,
    });
  } catch (error) {
    console.error('[Scout] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte generera investeringsteser' },
      { status: 500 }
    );
  }
}
