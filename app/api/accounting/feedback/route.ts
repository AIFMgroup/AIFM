import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { processFeedback, getFeedbackStats } from '@/lib/accounting/services/feedbackLearning';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message, companyId, context, conversationHistory } = body;

    if (!message || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields: message, companyId' },
        { status: 400 }
      );
    }

    // Process feedback and generate response
    const response = await processFeedback(
      companyId,
      message,
      context || {},
      conversationHistory || []
    );

    return NextResponse.json(response);

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing companyId parameter' },
        { status: 400 }
      );
    }

    // Get feedback statistics
    const stats = await getFeedbackStats(companyId);

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Feedback stats API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}





