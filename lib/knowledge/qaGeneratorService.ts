/**
 * Q&A generator: create question-answer pairs from document text and save to knowledge base.
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { createKnowledge } from '@/lib/knowledge/knowledgeStore';

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

const QA_SYSTEM = `Du är en assistent som skapar frågor och svar från dokumenttext.
Din uppgift är att generera 5–15 korta frågor som någon kan ställa om dokumentet, med svar som direkt följer av texten.

Returnera ENDAST en JSON-array med objekt: { "q": "frågan", "a": "svaret" }.
Exempel: [{"q": "Vilken ton använder vi i kundkommunikation?", "a": "Formell men varm."}, ...]

Regler:
- Frågor på svenska om dokumentet är på svenska.
- Svar ska vara baserade enbart på dokumentet, inga gissningar.
- Korta, tydliga svar (1–3 meningar).
- Svara endast med JSON-array, inget annat text.`;

export interface QAPair {
  q: string;
  a: string;
}

/**
 * Generate Q&A pairs from document text using Claude Sonnet.
 */
export async function generateQAPairsFromText(
  documentText: string,
  options?: { maxPairs?: number }
): Promise<QAPair[]> {
  const maxPairs = options?.maxPairs ?? 15;
  const chunk = documentText.slice(0, 25000);

  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: SONNET_MODEL,
        inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `Dokument:\n\n${chunk}\n\nGenerera upp till ${maxPairs} frågor och svar som JSON-array.`,
              },
            ],
          },
        ],
        system: [{ text: QA_SYSTEM }],
      })
    );

    const text = response.output?.message?.content?.[0]?.text?.trim() || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((x): x is QAPair => typeof x === 'object' && x !== null && typeof (x as QAPair).q === 'string' && typeof (x as QAPair).a === 'string')
      .map((x) => ({ q: String(x.q).trim(), a: String(x.a).trim() }))
      .filter((x) => x.q.length > 5 && x.a.length > 5)
      .slice(0, maxPairs);
  } catch (e) {
    console.warn('[qaGenerator] Generate failed:', e);
    return [];
  }
}

/**
 * Save Q&A pairs to knowledge base with category qa-generated.
 */
export async function saveQAPairsToKnowledge(params: {
  pairs: QAPair[];
  userId: string;
  userEmail?: string;
  userName?: string;
  sourceLabel?: string;
}): Promise<{ saved: number }> {
  const { pairs, userId, userEmail, userName, sourceLabel } = params;
  let saved = 0;
  for (const { q, a } of pairs) {
    try {
      await createKnowledge({
        category: 'qa-generated',
        title: q.slice(0, 100) + (q.length > 100 ? '...' : ''),
        content: `Fråga: ${q}\n\nSvar: ${a}`,
        tags: ['qa-generated', sourceLabel || 'document'].filter(Boolean),
        sharedByUserId: userId,
        sharedByEmail: userEmail,
        sharedByName: userName,
      });
      saved++;
    } catch (e) {
      console.warn('[qaGenerator] Save failed for pair:', e);
    }
  }
  return { saved };
}
