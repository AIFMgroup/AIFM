import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

interface FeedbackRequest {
  messageId: string;
  sessionId?: string;
  feedback: 'positive' | 'negative';
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();
    const { messageId, sessionId, feedback, timestamp } = body;

    if (!messageId || !feedback) {
      return NextResponse.json(
        { error: 'messageId and feedback are required' },
        { status: 400 }
      );
    }

    // Save feedback to DynamoDB
    const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: process.env.DYNAMODB_FEEDBACK_TABLE || 'aifm-chat-feedback',
        Item: {
          feedbackId: { S: feedbackId },
          messageId: { S: messageId },
          sessionId: { S: sessionId || 'unknown' },
          feedback: { S: feedback },
          timestamp: { S: timestamp || new Date().toISOString() },
          createdAt: { S: new Date().toISOString() },
        },
      }));
    } catch (dbError) {
      // If DynamoDB fails, just log it - feedback is not critical
      console.error('Failed to save feedback to DynamoDB:', dbError);
    }

    return NextResponse.json({ 
      success: true,
      feedbackId,
    });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}
