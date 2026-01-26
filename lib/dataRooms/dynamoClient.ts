import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

/**
 * Shared DynamoDB client instance
 * Used across data rooms, audit logs, and other services
 */
export const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});







