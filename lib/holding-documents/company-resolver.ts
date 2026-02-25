/**
 * Company Resolver
 * Resolves a company name (e.g. "RIO TINTO PLC") to ticker, ISIN, website, and metadata
 * using enriched security lookup and optional Claude/Bedrock for IR website.
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { performEnrichedLookup } from '@/lib/integrations/securities';

export interface ResolvedCompany {
  name: string;
  ticker: string;
  isin: string;
  website?: string;
  country?: string;
  sector?: string;
}

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const MODEL_CANDIDATES = [
  'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'eu.anthropic.claude-sonnet-4-20250514-v1:0',
  'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
];

async function callClaudeForWebsite(
  companyName: string,
  ticker: string,
  country?: string,
): Promise<string | null> {
  const location = country ? `, land: ${country}` : '';
  const prompt = `Vad är den officiella hemsidan (investor relations-sidan) för ${companyName} (ticker: ${ticker || 'okänt'}${location})? Svara BARA med URL:en, inget annat. Om du inte vet, svara med "unknown".`;

  for (const modelId of MODEL_CANDIDATES) {
    try {
      const command = new ConverseCommand({
        modelId,
        system: [{ text: 'Du är en expert på börsnoterade bolag. Svara bara med URL.' }],
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 200 },
      });
      const response = await bedrockClient.send(command);
      const outputContent = response.output?.message?.content;
      const text =
        outputContent?.[0] && 'text' in outputContent[0]
          ? outputContent[0].text ?? null
          : null;
      if (text && !text.includes('unknown') && text.includes('http')) {
        return text.trim().replace(/["\s]/g, '');
      }
      return null;
    } catch (err) {
      console.warn(`[Company Resolver] Model ${modelId} failed:`, err);
    }
  }
  return null;
}

/**
 * Resolve a company by name (and optional ticker/isin/country).
 * Uses enriched security lookup first, then Claude to find IR website if needed.
 */
export async function resolveCompany(
  companyName: string,
  options?: { ticker?: string; isin?: string; country?: string },
): Promise<ResolvedCompany> {
  const ticker = options?.ticker ?? '';
  const isin = options?.isin ?? '';
  const country = options?.country;

  const result: ResolvedCompany = {
    name: companyName,
    ticker,
    isin,
    country,
  };

  try {
    const lookupResult = await performEnrichedLookup(
      isin || undefined,
      ticker || companyName || undefined,
      undefined,
    );

    if (lookupResult.success && lookupResult.data) {
      const d = lookupResult.data;
      result.name = d.name?.value ?? companyName;
      result.ticker = d.ticker?.value ?? ticker;
      result.isin = d.isin?.value ?? isin;
      result.country = d.countryName?.value ?? d.country?.value ?? country;
      result.sector = d.gicsSector?.value ?? d.industry?.value;
    }
  } catch (e) {
    console.warn('[Company Resolver] Enriched lookup failed:', e);
  }

  try {
    const website = await callClaudeForWebsite(
      result.name,
      result.ticker,
      result.country,
    );
    if (website) result.website = website;
  } catch (e) {
    console.warn('[Company Resolver] Website lookup failed:', e);
  }

  return result;
}
