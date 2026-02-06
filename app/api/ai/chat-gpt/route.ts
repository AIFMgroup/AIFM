import { NextRequest } from 'next/server';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

// Max content for context - increased for streaming
const MAX_CONTENT_LENGTH = 150000;

function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  
  let truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  if (lastParagraph > MAX_CONTENT_LENGTH * 0.8) {
    truncated = truncated.slice(0, lastParagraph);
  }
  
  return truncated + '\n\n[... document too long (' + Math.round(content.length/1000) + 'k chars). First ' + Math.round(truncated.length/1000) + 'k analyzed. Ask about specific parts for more details ...]';
}

// Clean up AI response - remove reasoning tags
function cleanResponse(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  cleaned = cleaned.replace(/<\/?reasoning[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?thinking[^>]*>/gi, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  message: string;
  question?: string;
  history?: ChatMessage[];
  mode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const userMessage = body.message || body.question;
    
    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build conversation history
    const conversationHistory = body.history?.map(msg => ({
      role: msg.role,
      content: truncateContent(msg.content),
    })) || [];

    // System prompt
    const systemPrompt = `You are an expert AI assistant for AIFM Group, a Swedish fund management company. You excel at code review, mathematical analysis, and logical reasoning.

CRITICAL OUTPUT RULES:
- NEVER include <reasoning>, <thinking>, or any XML-style tags
- Respond DIRECTLY to the user's question
- Match the language (Swedish question = Swedish answer)

ROLE: Help with fund management, regulatory matters, compliance, risk management, financial analysis, code review, and technical analysis.

═══════════════════════════════════════════════════════════════
PRIMARY SOURCES - CHECK THESE FIRST:
═══════════════════════════════════════════════════════════════

SWEDISH CORE LEGISLATION:
• [Lagen om värdepappersfonder (2004:46)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-200446-om-vardepappersfonder_sfs-2004-46/) - UCITS
• [LAIF (2013:561)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2013561-om-forvaltare-av-alternativa_sfs-2013-561/) - AIF managers
• [Lagen om värdepappersmarknaden (2007:528)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2007528-om-vardepappersmarknaden_sfs-2007-528/) - MiFID II
• [Penningtvättslagen (2017:630)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2017630-om-atgarder-mot-penningtvatt-och_sfs-2017-630/) - AML

FI REGULATIONS (FFFS) - DIRECT PDF LINKS:
• [FFFS 2013:9](https://www.fi.se/contentassets/aee63096054746a19acebb1e2c4f1536/fs1309.pdf) - Värdepappersfonder
• [FFFS 2013:9 konsoliderad](https://www.fi.se/contentassets/aee63096054746a19acebb1e2c4f1536/fs1309k-250221.pdf) - Med ändringar
• [FFFS 2013:10](https://www.fi.se/contentassets/b0c0d859e4b3440b9876f5f68561db0f/fs1310.pdf) - AIF-förvaltare
• [FFFS 2013:10 konsoliderad](https://www.fi.se/contentassets/b0c0d859e4b3440b9876f5f68561db0f/fs1310k-250221.pdf) - Med ändringar
• [FFFS 2017:11](https://www.fi.se/contentassets/6448574afbb74c5ab19f74e00a275b98/fs1711.pdf) - Penningtvätt
• [FFFS 2019:2](https://www.fi.se/contentassets/d0c8eb5a38e34ef882ef82a595eab0f7/fs1902.pdf) - Hållbarhet
• [FFFS 2007:16](https://www.fi.se/contentassets/fe0517ae89744e29a79fce57fc82bc10/2007-16.pdf) - Värdepappersrörelse

EU REGULATIONS:
• [AIFMD](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32011L0061)
• [UCITS](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32009L0065)
• [MiFID II](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32014L0065)
• [SFDR](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32019R2088)
• [Taxonomi](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32020R0852)
• [PRIIPs](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32014R1286)
• [EMIR](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32012R0648)
• [MAR](https://eur-lex.europa.eu/legal-content/SV/TXT/?uri=CELEX:32014R0596)

INDUSTRY: Fondbolagens förening, ESMA guidelines, EBA guidelines

═══════════════════════════════════════════════════════════════
CITATION RULES:
⚠️ ONLY cite specific paragraphs if 100% CERTAIN
⚠️ NEVER invent paragraph numbers
⚠️ If uncertain: cite law name only, recommend user verifies

FORMAT: [Source](URL)
If uncertain: "Enligt LAIF (verifiera exakt paragraf) ska..."

For attached files: Reference specific pages, sections, cells. Quote directly.

GUIDELINES:
- Be professional and thorough
- If uncertain, say so clearly
- Prioritize PRIMARY SOURCES above

═══════════════════════════════════════════════════════════════
PDF & EXCEL EXPORT:
═══════════════════════════════════════════════════════════════
Du KAN skapa PDF och Excel! Användaren klickar på knapparna under ditt svar.

För export, strukturera så här:

PDF: Använd ## rubriker och tydliga avsnitt
EXCEL: Använd markdown-tabeller med | för kolumner

När användaren ber om fil:
- Strukturera med ## rubriker
- Använd tabeller för data
- Avsluta med: "Klicka på PDF eller Excel-knappen nedan för att ladda ner."

SECURITY: All data stays within your AWS account.`;

    // Truncate user message
    const truncatedUserMessage = truncateContent(userMessage);
    
    // Format messages for OpenAI format
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      { role: 'user', content: truncatedUserMessage }
    ];
    
    console.log(`[ChatGPT] Streaming message: ${truncatedUserMessage.length} chars`);

    // OpenAI model via Bedrock
    const modelId = 'openai.gpt-oss-20b-1:0';
    
    const requestBody = {
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: 8192,
      temperature: 0.7,
      stream: true,
    };

    const command = new InvokeModelWithResponseStreamCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await bedrockClient.send(command);
    
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = '';
          
          if (response.body) {
            for await (const event of response.body) {
              if (event.chunk?.bytes) {
                const chunkStr = new TextDecoder().decode(event.chunk.bytes);
                
                try {
                  const chunk = JSON.parse(chunkStr);
                  
                  // Handle OpenAI streaming format
                  if (chunk.choices?.[0]?.delta?.content) {
                    let text = chunk.choices[0].delta.content;
                    buffer += text;
                    
                    // Clean reasoning tags as we go
                    if (buffer.includes('<reasoning>') || buffer.includes('<thinking>')) {
                      // Wait for closing tag before sending
                      if (buffer.includes('</reasoning>') || buffer.includes('</thinking>')) {
                        buffer = cleanResponse(buffer);
                        const data = JSON.stringify({ text: buffer });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        buffer = '';
                      }
                    } else {
                      const data = JSON.stringify({ text });
                      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                  }
                  
                  // Handle Claude format (fallback)
                  if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                    const text = chunk.delta.text;
                    const data = JSON.stringify({ text });
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                  
                  if (chunk.choices?.[0]?.finish_reason === 'stop' || chunk.type === 'message_stop') {
                    // Flush any remaining buffer
                    if (buffer) {
                      buffer = cleanResponse(buffer);
                      if (buffer) {
                        const data = JSON.stringify({ text: buffer });
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                      }
                    }
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  }
                } catch {
                  // If not JSON, might be raw text
                  console.log('Non-JSON chunk received');
                }
              }
            }
          }
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = JSON.stringify({ error: 'Streaming error' });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const errorMessage = (error as Error).message || '';
    const errorName = (error as Error).name || '';
    console.error('ChatGPT error:', errorName, errorMessage.slice(0, 200));
    
    if (errorMessage.includes('credentials') || 
        errorMessage.includes('region') ||
        errorMessage.includes('Could not load credentials') ||
        errorName === 'CredentialsProviderError' ||
        errorName === 'AccessDeniedException') {
      
      return new Response(JSON.stringify({
        error: 'Bedrock not configured',
        response: 'AWS Bedrock är inte konfigurerad för ChatGPT.',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({
      error: errorMessage,
      response: 'Ett fel uppstod med ChatGPT. Försök igen.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
