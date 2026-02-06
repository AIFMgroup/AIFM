import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface ChatRequest {
  question: string;
  // Optional client-side context. Today this is used for auditing/telemetry and forward-compatibility
  // with company-scoped knowledge bases.
  companyId?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  sessionId?: string;
  filters?: {
    category?: string;
    source?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (optional for now during development)
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    // Note: Authentication check disabled during development
    // No logging of sensitive data for security

    const body: ChatRequest = await request.json();

    if (!body.question || typeof body.question !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      );
    }

    // Validate question length
    if (body.question.length > 2000) {
      return NextResponse.json(
        { error: 'Question too long. Maximum 2000 characters.' },
        { status: 400 }
      );
    }

    // Try to use RAG pipeline
    try {
      const { answerComplianceQuestion } = await import('@/lib/compliance/ragPipeline');
      const { answerWithKnowledgeBase, isKnowledgeBaseConfigured } = await import('@/lib/compliance/bedrockKnowledgeBase');
      
      // Use Bedrock Knowledge Base if configured, otherwise fallback to local RAG
      if (isKnowledgeBaseConfigured()) {
        const result = await answerWithKnowledgeBase(
          body.question,
          body.sessionId,
          body.filters
        );

        return NextResponse.json({
          answer: result.answer,
          citations: result.citations,
          confidence: result.confidence,
          hasRelevantSources: result.hasRelevantSources,
          disclaimer: result.disclaimer,
          sessionId: result.sessionId,
        });
      }

      // Fallback to local RAG pipeline
      const result = await answerComplianceQuestion(
        body.question,
        body.history || []
      );

      return NextResponse.json({
        answer: result.answer,
        citations: result.citations,
        confidence: result.confidence,
        hasRelevantSources: result.hasRelevantSources,
        disclaimer: result.disclaimer,
      });
    } catch (ragError) {
      // Only log error type, never log prompts/responses (security)
      console.error('[Compliance Chat] RAG error type:', (ragError as Error).name);
      
      // Fallback: Return a helpful message when RAG is not fully configured
      return NextResponse.json({
        answer: `Jag kan tyvärr inte svara på frågor om regelverk just nu eftersom kunskapsbasen inte är konfigurerad ännu.

För att aktivera Regelverksassistenten behöver du:
1. Gå till Compliance → Regelverksarkiv
2. Lägg till relevanta regelverk och dokument
3. Vänta på att dokumenten indexeras

Under tiden kan du använda "Claude 4.6"-läget för allmänna frågor.`,
        citations: [],
        confidence: 0,
        hasRelevantSources: false,
        disclaimer: 'Kunskapsbasen är inte konfigurerad.',
      });
    }

  } catch (error) {
    // Only log error type, never log prompts/responses (security)
    console.error('Compliance chat error type:', (error as Error).name);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
