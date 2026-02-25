/**
 * Generate a structured summary of a compliance/regulation document using Claude.
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

const MODEL_ID = 'eu.anthropic.claude-sonnet-4-20250514-v1:0';

const SYSTEM_PROMPT = `Du är en expert på svensk finansiell reglering och compliance. Din uppgift är att sammanfatta regelverk och policyer på ett strukturerat sätt.

Skriv sammanfattningen på svenska. Använd exakt följande rubriker (med kolon) och fyll i under varje:

**Syfte:** Vad reglerar dokumentet? En till tre meningar.

**Nyckelkrav:** De viktigaste kraven som regelverket ställer. Ange som punktlistor (streck eller numrerat).

**Berörda parter:** Vilka aktörer berörs? (t.ex. förvaltare, depåbanker, investerare)

**Viktiga datum/deadlines:** Om dokumentet nämner datum, förfallodatum eller övergångsregler.

**Sanktioner/konsekvenser:** Vad kan hända vid bristande efterlevnad?

**AIFM-relevans:** Hur påverkar detta en förvaltare som AIFM Capital AB specifikt? Kort stycke.

Var koncis men fullständig. Om något avsnitt inte kan fyllas utifrån texten, skriv "Ej angivet i dokumentet." under den rubriken.`;

/**
 * Returns a structured summary string (markdown-style with the sections above).
 */
export async function generateDocumentSummary(content: string, title: string): Promise<string> {
  const truncated = content.length > 80_000 ? content.slice(0, 80_000) + '\n\n[... dokumentet trunkerat ...]' : content;

  const response = await bedrockClient.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: 'user',
          content: [
            {
              text: `Dokumenttitel: ${title}\n\nAnalysera följande text och skriv en strukturerad sammanfattning enligt instruktionerna.\n\n---\n\n${truncated}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 4096 },
    })
  );

  const output = response.output?.message?.content;
  if (!output?.length || !('text' in output[0])) return 'Kunde inte generera sammanfattning.';
  return (output[0] as { text: string }).text;
}
