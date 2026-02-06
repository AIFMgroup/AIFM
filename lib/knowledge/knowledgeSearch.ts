/**
 * Knowledge Search
 * Search and retrieve relevant knowledge for AI context injection
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { KnowledgeItem } from './knowledgeStore';

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'eu-north-1' 
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'aifm-knowledge-base';

/**
 * Search result with relevance score
 */
export interface KnowledgeSearchResult {
  item: KnowledgeItem;
  score: number;
  matchedTerms: string[];
}

/**
 * Tokenize a string into searchable terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\såäöÅÄÖ]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Calculate simple TF-IDF-like relevance score
 */
function calculateRelevance(
  item: KnowledgeItem, 
  queryTerms: string[]
): { score: number; matchedTerms: string[] } {
  const titleTerms = tokenize(item.title);
  const contentTerms = tokenize(item.content);
  const tagTerms = item.tags.map(t => t.toLowerCase());
  
  let score = 0;
  const matchedTerms: string[] = [];
  
  for (const queryTerm of queryTerms) {
    // Title matches (highest weight)
    const titleMatches = titleTerms.filter(t => t.includes(queryTerm) || queryTerm.includes(t));
    if (titleMatches.length > 0) {
      score += 3 * titleMatches.length;
      matchedTerms.push(...titleMatches);
    }
    
    // Tag matches (high weight)
    const tagMatches = tagTerms.filter(t => t.includes(queryTerm) || queryTerm.includes(t));
    if (tagMatches.length > 0) {
      score += 2 * tagMatches.length;
      matchedTerms.push(...tagMatches);
    }
    
    // Content matches (normal weight)
    const contentMatches = contentTerms.filter(t => t.includes(queryTerm) || queryTerm.includes(t));
    if (contentMatches.length > 0) {
      score += Math.min(contentMatches.length, 5); // Cap content matches
      matchedTerms.push(queryTerm);
    }
  }
  
  // Boost recent items slightly
  const ageInDays = (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recencyBoost = Math.max(0, 1 - ageInDays / 365); // Decay over a year
  score *= (1 + recencyBoost * 0.1);
  
  return { score, matchedTerms: [...new Set(matchedTerms)] };
}

/**
 * Search the knowledge base with a text query
 */
export async function searchKnowledge(
  query: string,
  options?: {
    category?: string;
    limit?: number;
    minScore?: number;
  }
): Promise<KnowledgeSearchResult[]> {
  const { category, limit = 10, minScore = 0.5 } = options || {};
  
  // Get all items (or filtered by category)
  let scanParams: any = {
    TableName: TABLE_NAME,
  };
  
  if (category) {
    scanParams = {
      ...scanParams,
      FilterExpression: 'category = :category',
      ExpressionAttributeValues: { ':category': category },
    };
  }
  
  const result = await docClient.send(new ScanCommand(scanParams));
  const items = (result.Items || []) as KnowledgeItem[];
  
  if (items.length === 0) {
    return [];
  }
  
  // Tokenize query
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return [];
  }
  
  // Score all items
  const scoredItems: KnowledgeSearchResult[] = items
    .map(item => {
      const { score, matchedTerms } = calculateRelevance(item, queryTerms);
      return { item, score, matchedTerms };
    })
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  return scoredItems;
}

/**
 * Search for knowledge relevant to a chat message
 * Used for AI context injection
 */
export async function findRelevantKnowledge(
  message: string,
  limit: number = 5
): Promise<KnowledgeItem[]> {
  const results = await searchKnowledge(message, { limit, minScore: 1 });
  return results.map(r => r.item);
}

/**
 * Format knowledge items for AI context injection
 */
export function formatKnowledgeForContext(items: KnowledgeItem[]): string {
  if (items.length === 0) {
    return '';
  }
  
  const formatted = items.map((item, index) => {
    const category = item.category.charAt(0).toUpperCase() + item.category.slice(1);
    const sharedBy = item.sharedByName || item.sharedByEmail || 'Anonym';
    const date = new Date(item.createdAt).toLocaleDateString('sv-SE');
    
    return `
═══════════════════════════════════════════════════════════════
📚 INTERN KUNSKAP ${index + 1}: "${item.title}"
   Kategori: ${category} | Delad av: ${sharedBy} | Datum: ${date}
   ${item.tags.length > 0 ? `Tags: ${item.tags.join(', ')}` : ''}
═══════════════════════════════════════════════════════════════

${item.content}
`;
  }).join('\n');
  
  return `
╔═══════════════════════════════════════════════════════════════╗
║         INTERN KUNSKAPSBAS (FÖRETAGETS DELADE KUNSKAP)        ║
╚═══════════════════════════════════════════════════════════════╝

Följande ${items.length} kunskapsobjekt hittades som kan vara relevanta:

${formatted}

VIKTIGT: Referera till intern kunskap med dess titel, t.ex. 
"Enligt intern kunskap om [Titel]..."
═══════════════════════════════════════════════════════════════
`;
}
