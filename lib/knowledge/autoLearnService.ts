/**
 * Auto-learn from chat: extract company facts from conversations and save to knowledge base.
 */

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { createKnowledge } from '@/lib/knowledge/knowledgeStore';
import { getKnowledgeByCategory } from '@/lib/knowledge/knowledgeStore';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    : undefined,
});

const HAIKU_MODEL = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';

const EXTRACT_SYSTEM = `Du är en assistent som analyserar chattkonversationer från ett företag.
Din uppgift är att extrahera KUNSKAPSPUNKTER som är specifika för företaget eller som användaren uttryckt som preferenser/beslut.

Returnera ENDAST en JSON-array med strängar. Varje sträng ska vara en kort, tydlig fakta eller preferens.
Exempel: ["Företaget har tre fonder.", "Vi exkluderar fossila bränslen i alla fonder.", "Formell ton i kundrapporter."]

Regler:
- Max 10 punkter.
- Endast fakta/preferenser som är användbara för framtida svar (ton, policy, beslut, företagsspecifika uppgifter).
- Inga generella sanningar eller saker som inte är specifika för företaget.
- Svara endast med JSON-array, inget annat text.`;

function buildTranscript(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'Användare' : 'Assistent'}: ${(m.content || '').slice(0, 2000)}`)
    .join('\n\n');
}

/**
 * Call Claude Haiku to extract company facts from a conversation transcript.
 */
export async function extractFactsFromConversation(
  messages: Array<{ role: string; content: string }>,
  _sessionId: string
): Promise<string[]> {
  if (messages.length < 4) return [];

  const transcript = buildTranscript(messages);
  if (transcript.length < 200) return [];

  try {
    const response = await bedrockClient.send(
      new ConverseCommand({
        modelId: HAIKU_MODEL,
        inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
        messages: [
          {
            role: 'user',
            content: [{ text: `Konversation:\n\n${transcript.slice(0, 12000)}\n\nExtrahera kunskapspunkter som JSON-array.` }],
          },
        ],
        system: [{ text: EXTRACT_SYSTEM }],
      })
    );

    const text = response.output?.message?.content?.[0]?.text?.trim() || '';
    if (!text) return [];

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 10 && s.length < 500);
  } catch (e) {
    console.warn('[autoLearn] Extract failed:', e);
    return [];
  }
}

/**
 * Deduplicate against existing auto-learned items (simple substring/similarity).
 */
function isDuplicate(fact: string, existing: { content: string }[]): boolean {
  const norm = fact.toLowerCase().trim();
  for (const item of existing) {
    const existingNorm = item.content.toLowerCase().trim();
    if (existingNorm.includes(norm) || norm.includes(existingNorm)) return true;
  }
  return false;
}

/**
 * Run auto-learn: extract facts from conversation and save new ones to knowledge base.
 * Call this after saving a chat session (e.g. fire-and-forget).
 */
export async function runAutoLearn(params: {
  messages: Array<{ role: string; content: string }>;
  sessionId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ saved: number }> {
  const { messages, sessionId, userId, userEmail, userName } = params;
  if (messages.length < 4) return { saved: 0 };

  const facts = await extractFactsFromConversation(messages, sessionId);
  if (facts.length === 0) return { saved: 0 };

  const existing = await getKnowledgeByCategory('auto-learned', 500);
  let saved = 0;
  for (const fact of facts) {
    if (isDuplicate(fact, existing)) continue;
    try {
      await createKnowledge({
        category: 'auto-learned',
        title: fact.slice(0, 100) + (fact.length > 100 ? '...' : ''),
        content: fact,
        tags: ['auto-learned', `chat:${sessionId}`],
        sharedByUserId: userId,
        sharedByEmail: userEmail,
        sharedByName: userName,
        sourceSessionId: sessionId,
      });
      saved++;
      existing.push({ content: fact });
    } catch (e) {
      console.warn('[autoLearn] Save failed for fact:', e);
    }
  }
  return { saved };
}
