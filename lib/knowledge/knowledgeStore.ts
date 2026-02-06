/**
 * Knowledge Store
 * DynamoDB CRUD operations for the shared knowledge base
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'eu-north-1' 
});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = 'aifm-knowledge-base';

/**
 * Knowledge item structure
 */
export interface KnowledgeItem {
  knowledgeId: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  sharedByUserId: string;
  sharedByEmail?: string;
  sharedByName?: string;
  sourceSessionId?: string;
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating knowledge
 */
export interface CreateKnowledgeInput {
  category: string;
  title: string;
  content: string;
  tags?: string[];
  sharedByUserId: string;
  sharedByEmail?: string;
  sharedByName?: string;
  sourceSessionId?: string;
  sourceMessageId?: string;
}

/**
 * Input for updating knowledge
 */
export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  tags?: string[];
}

/**
 * Create a new knowledge item
 */
export async function createKnowledge(input: CreateKnowledgeInput): Promise<KnowledgeItem> {
  const now = new Date().toISOString();
  const knowledgeId = uuidv4();
  
  const item: KnowledgeItem = {
    knowledgeId,
    category: input.category,
    title: input.title,
    content: input.content,
    tags: input.tags || [],
    sharedByUserId: input.sharedByUserId,
    sharedByEmail: input.sharedByEmail,
    sharedByName: input.sharedByName,
    sourceSessionId: input.sourceSessionId,
    sourceMessageId: input.sourceMessageId,
    createdAt: now,
    updatedAt: now,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
  
  return item;
}

/**
 * Get a knowledge item by category and id
 */
export async function getKnowledge(category: string, knowledgeId: string): Promise<KnowledgeItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { category, knowledgeId },
  }));
  
  return result.Item as KnowledgeItem | null;
}

/**
 * Update a knowledge item
 */
export async function updateKnowledge(
  category: string, 
  knowledgeId: string, 
  updates: UpdateKnowledgeInput
): Promise<KnowledgeItem | null> {
  const existing = await getKnowledge(category, knowledgeId);
  if (!existing) return null;
  
  const updatedItem: KnowledgeItem = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: updatedItem,
  }));
  
  return updatedItem;
}

/**
 * Delete a knowledge item
 */
export async function deleteKnowledge(category: string, knowledgeId: string): Promise<boolean> {
  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { category, knowledgeId },
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all knowledge items in a category
 */
export async function getKnowledgeByCategory(
  category: string, 
  limit?: number
): Promise<KnowledgeItem[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'category = :category',
    ExpressionAttributeValues: { ':category': category },
    Limit: limit,
    ScanIndexForward: false, // Most recent first
  }));
  
  return (result.Items || []) as KnowledgeItem[];
}

/**
 * Get all knowledge shared by a specific user
 */
export async function getKnowledgeByUser(
  userId: string, 
  limit?: number
): Promise<KnowledgeItem[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'sharedByUserId-index',
    KeyConditionExpression: 'sharedByUserId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
    Limit: limit,
    ScanIndexForward: false,
  }));
  
  return (result.Items || []) as KnowledgeItem[];
}

/**
 * Get all knowledge items (across all categories)
 */
export async function getAllKnowledge(limit?: number): Promise<KnowledgeItem[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    Limit: limit,
  }));
  
  // Sort by createdAt descending
  const items = (result.Items || []) as KnowledgeItem[];
  return items.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Count knowledge items by category
 */
export async function countKnowledgeByCategory(): Promise<Record<string, number>> {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    ProjectionExpression: 'category',
  }));
  
  const counts: Record<string, number> = {};
  for (const item of result.Items || []) {
    const category = item.category as string;
    counts[category] = (counts[category] || 0) + 1;
  }
  
  return counts;
}
