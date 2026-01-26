import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { answerComplianceQuestion } from '@/lib/compliance/ragPipeline';
import { 
  answerWithKnowledgeBase, 
  isKnowledgeBaseConfigured 
} from '@/lib/compliance/bedrockKnowledgeBase';

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
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Use Bedrock Knowledge Base if configured, otherwise fallback to local RAG
    if (isKnowledgeBaseConfigured()) {
      console.log('[Compliance Chat] Using Bedrock Knowledge Base');
      
      const result = await answerWithKnowledgeBase(
        body.question,
        body.sessionId,
        body.filters
      );

      // Log for audit trail
      console.log('[Compliance Chat] Query:', {
        companyId: body.companyId,
        questionLength: body.question.length,
        citationsCount: result.citations.length,
        confidence: result.confidence,
        hasRelevantSources: result.hasRelevantSources,
        retrievedChunks: result.retrievedChunks,
        usingKnowledgeBase: true,
        timestamp: new Date().toISOString(),
      });

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
    console.log('[Compliance Chat] Using local RAG pipeline (Knowledge Base not configured)');
    
    const result = await answerComplianceQuestion(
      body.question,
      body.history || []
    );

    // Log for audit trail
    console.log('[Compliance Chat] Query:', {
      companyId: body.companyId,
      questionLength: body.question.length,
      citationsCount: result.citations.length,
      confidence: result.confidence,
      hasRelevantSources: result.hasRelevantSources,
      usingKnowledgeBase: false,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      answer: result.answer,
      citations: result.citations,
      confidence: result.confidence,
      hasRelevantSources: result.hasRelevantSources,
      disclaimer: result.disclaimer,
    });

  } catch (error) {
    console.error('Compliance chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
