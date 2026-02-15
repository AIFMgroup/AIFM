/**
 * Bloomberg Screenshot Analyzer
 *
 * Uses AWS Bedrock (Claude Vision) to extract structured position/price data
 * from Bloomberg terminal screenshots. Output can be imported into Fund Registry.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const BEDROCK_REGION = process.env.BEDROCK_REGION ?? 'eu-west-1';
const MODEL_ID = process.env.BLOOMBERG_ANALYZER_MODEL ?? 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

/** One position extracted from a Bloomberg screenshot */
export interface BloombergExtractedPosition {
  instrumentName: string;
  isin?: string;
  ticker?: string;
  quantity: number;
  price: number;
  marketValue: number;
  currency: string;
  weightPercent?: number;
}

/** Result of analyzing a Bloomberg screenshot */
export interface BloombergScreenshotResult {
  success: boolean;
  currency?: string;
  reportDate?: string;
  positions: BloombergExtractedPosition[];
  rawSummary?: string;
  error?: string;
}

const EXTRACTION_PROMPT = `You are analyzing a screenshot from a Bloomberg terminal or similar market data / portfolio view.

Extract ALL visible positions (holdings) from the image. For each position extract:
- instrumentName: full name of the security
- isin: ISIN if visible, otherwise omit
- ticker: ticker/symbol if visible, otherwise omit
- quantity: number of shares/units
- price: price per unit
- marketValue: total market value (quantity * price if not shown)
- currency: currency code (e.g. SEK, USD, EUR)
- weightPercent: portfolio weight in % if visible

Also extract if visible:
- currency: base currency of the portfolio
- reportDate: date of the report (YYYY-MM-DD) if visible

Respond ONLY with valid JSON in this exact shape (no markdown, no code block):
{
  "currency": "SEK",
  "reportDate": "YYYY-MM-DD",
  "positions": [
    {
      "instrumentName": "string",
      "isin": "optional",
      "ticker": "optional",
      "quantity": number,
      "price": number,
      "marketValue": number,
      "currency": "string",
      "weightPercent": number
    }
  ]
}

If you cannot read any positions, return: { "positions": [], "currency": null, "reportDate": null }`;

/**
 * Analyze a Bloomberg (or similar) screenshot and return structured position data.
 */
export async function analyzeBloombergScreenshot(
  imageBuffer: Buffer,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png'
): Promise<BloombergScreenshotResult> {
  const base64Image = imageBuffer.toString('base64');

  try {
    const response = await bedrockClient.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image' as const,
                  source: {
                    type: 'base64' as const,
                    media_type: mimeType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text' as const,
                  text: EXTRACTION_PROMPT,
                },
              ],
            },
          ],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text ?? '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        positions: [],
        error: 'No JSON found in model response',
        rawSummary: content.slice(0, 500),
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      currency?: string;
      reportDate?: string;
      positions?: BloombergExtractedPosition[];
    };

    const positions = Array.isArray(parsed.positions)
      ? parsed.positions.filter(
          (p) =>
            p &&
            typeof p.instrumentName === 'string' &&
            typeof p.quantity === 'number' &&
            (typeof p.price === 'number' || typeof p.marketValue === 'number')
        )
      : [];

    return {
      success: true,
      currency: parsed.currency ?? undefined,
      reportDate: parsed.reportDate ?? undefined,
      positions,
      rawSummary: content.slice(0, 300),
    };
  } catch (err) {
    return {
      success: false,
      positions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
