/**
 * Brandbook parser: extract tone, fonts, colors, letter/report template structure from brandbook text.
 * Output can be used to update CompanyProfile.
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const SONNET_MODEL = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

export interface BrandbookParseResult {
  brandVoice: string;
  brandColors: string;
  documentStyle: string;
  letterTemplate: string;
  reportTemplate: string;
}

const SYSTEM_PROMPT = `Du är en expert som analyserar varumärkes- och grafiska handböcker (brandbooks).
Din uppgift är att extrahera strukturerad information från den givna texten.

Returnera ENDAST ett enda JSON-objekt med exakt dessa nycklar (alla strängar):
- brandVoice: Kort beskrivning av ton och röst (t.ex. "Formell men varm, professionell").
- brandColors: Färger som nämns, gärna med hex-koder om de finns (t.ex. "#1a1a1a, #c9a227").
- documentStyle: Rubrikstilar, typsnitt, sidhuvud/sidfot, marginaler – allt som styr hur dokument ska se ut.
- letterTemplate: Hur brev ska struktureras: hälsningsfras, avslutning, signaturrader, ev. malltext.
- reportTemplate: Hur rapporter ska struktureras: rubrikformat, sidhuvud/sidfot, sektioner.

Om något inte finns i texten, använd tom sträng "" eller en kort beskrivning baserat på kontext.
Svara endast med JSON, inget annat.`;

/**
 * Parse brandbook document text and return structured fields for CompanyProfile.
 */
export async function parseBrandbookText(documentText: string): Promise<BrandbookParseResult> {
  const chunk = documentText.slice(0, 30000);

  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: SONNET_MODEL,
        inferenceConfig: { maxTokens: 2048, temperature: 0.2 },
        messages: [
          {
            role: 'user',
            content: [{ text: `Brandbook / grafisk handbok:\n\n${chunk}\n\nExtrahera strukturerad information som JSON.` }],
          },
        ],
        system: [{ text: SYSTEM_PROMPT }],
      })
    );

    const text = response.output?.message?.content?.[0]?.text?.trim() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        brandVoice: '',
        brandColors: '',
        documentStyle: '',
        letterTemplate: '',
        reportTemplate: '',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      brandVoice: typeof parsed.brandVoice === 'string' ? parsed.brandVoice : '',
      brandColors: typeof parsed.brandColors === 'string' ? parsed.brandColors : '',
      documentStyle: typeof parsed.documentStyle === 'string' ? parsed.documentStyle : '',
      letterTemplate: typeof parsed.letterTemplate === 'string' ? parsed.letterTemplate : '',
      reportTemplate: typeof parsed.reportTemplate === 'string' ? parsed.reportTemplate : '',
    };
  } catch (e) {
    console.warn('[brandbookParser] Parse failed:', e);
    return {
      brandVoice: '',
      brandColors: '',
      documentStyle: '',
      letterTemplate: '',
      reportTemplate: '',
    };
  }
}
