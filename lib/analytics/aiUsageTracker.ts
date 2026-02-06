/**
 * AI Usage Tracker
 * Tracks AI requests for analytics and monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'eu-north-1' 
});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = 'aifm-ai-usage';

export interface AIUsageRecord {
  userId: string;
  timestamp: string;
  requestType: 'chat' | 'categorize' | 'search' | 'other';
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Track an AI request
 */
export async function trackAIUsage(record: AIUsageRecord): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...record,
        // Add TTL for 90 days (for cost management)
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
      },
    }));
  } catch (error) {
    // Don't fail the main request if tracking fails
    console.error('Failed to track AI usage:', error);
  }
}

/**
 * Get usage stats for a user
 */
export async function getUserUsageStats(
  userId: string, 
  startDate: Date
): Promise<{ totalRequests: number; totalResponseTime: number }> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'userId = :userId AND #ts >= :startDate',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':startDate': startDate.toISOString(),
      },
    }));
    
    const items = result.Items || [];
    const totalResponseTime = items.reduce(
      (sum, item) => sum + (item.responseTimeMs || 0), 0
    );
    
    return {
      totalRequests: items.length,
      totalResponseTime,
    };
  } catch (error) {
    console.error('Failed to get user usage stats:', error);
    return { totalRequests: 0, totalResponseTime: 0 };
  }
}

/**
 * Helper to create a timer for tracking response time
 */
export function createUsageTimer() {
  const startTime = Date.now();
  return {
    getElapsedMs: () => Date.now() - startTime,
  };
}
