/**
 * Compliance Document Store
 * 
 * Lagrar regelverksdokument och chunks i DynamoDB.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { 
  ComplianceDocument, 
  DocumentChunk, 
  DocumentSource, 
  ComplianceCategory 
} from './types';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const DOCUMENTS_TABLE = 'aifm-compliance-documents';
const CHUNKS_TABLE = 'aifm-compliance-chunks';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Document Operations ============

export const complianceDocStore = {
  /**
   * Spara ett nytt dokument
   */
  async create(doc: ComplianceDocument): Promise<void> {
    await docClient.send(new PutCommand({
      TableName: DOCUMENTS_TABLE,
      Item: {
        pk: `DOC#${doc.source}`,
        sk: doc.id,
        ...doc,
      }
    }));
    console.log(`[ComplianceStore] Created document: ${doc.id}`);
  },

  /**
   * Hämta ett dokument
   */
  async get(source: DocumentSource, id: string): Promise<ComplianceDocument | null> {
    const result = await docClient.send(new GetCommand({
      TableName: DOCUMENTS_TABLE,
      Key: { pk: `DOC#${source}`, sk: id }
    }));
    
    if (!result.Item) return null;
    
    const { pk, sk, ...doc } = result.Item;
    return doc as ComplianceDocument;
  },

  /**
   * Lista dokument per källa
   */
  async listBySource(source: DocumentSource, limit = 100): Promise<ComplianceDocument[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `DOC#${source}` },
      Limit: limit,
    }));
    
    return (result.Items || []).map(item => {
      const { pk, sk, ...doc } = item;
      return doc as ComplianceDocument;
    });
  },

  /**
   * Lista dokument per kategori
   */
  async listByCategory(category: ComplianceCategory, limit = 100): Promise<ComplianceDocument[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      IndexName: 'category-index',
      KeyConditionExpression: 'categoryKey = :cat',
      ExpressionAttributeValues: { ':cat': category },
      Limit: limit,
    }));
    
    return (result.Items || []).map(item => {
      const { pk, sk, ...doc } = item;
      return doc as ComplianceDocument;
    });
  },

  /**
   * Uppdatera dokument-status
   */
  async updateStatus(
    source: DocumentSource, 
    id: string, 
    status: ComplianceDocument['status'],
    extra?: Partial<ComplianceDocument>
  ): Promise<void> {
    const updates: string[] = ['#status = :status', 'updatedAt = :now'];
    const values: Record<string, unknown> = {
      ':status': status,
      ':now': new Date().toISOString(),
    };
    const names: Record<string, string> = { '#status': 'status' };
    
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        updates.push(`${key} = :${key}`);
        values[`:${key}`] = value;
      });
    }
    
    await docClient.send(new UpdateCommand({
      TableName: DOCUMENTS_TABLE,
      Key: { pk: `DOC#${source}`, sk: id },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: names,
    }));
  },

  /**
   * Sök dokument efter titel
   */
  async searchByTitle(query: string, limit = 20): Promise<ComplianceDocument[]> {
    // Simple scan with filter - for production, use OpenSearch or similar
    const result = await docClient.send(new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      IndexName: 'title-index',
      KeyConditionExpression: 'begins_with(titleLower, :q)',
      ExpressionAttributeValues: { ':q': query.toLowerCase() },
      Limit: limit,
    }));
    
    return (result.Items || []).map(item => {
      const { pk, sk, ...doc } = item;
      return doc as ComplianceDocument;
    });
  },
};

// ============ Chunk Operations ============

export const complianceChunkStore = {
  /**
   * Spara chunks för ett dokument
   */
  async saveChunks(chunks: DocumentChunk[]): Promise<void> {
    // Batch write in groups of 25 (DynamoDB limit)
    const batches: DocumentChunk[][] = [];
    for (let i = 0; i < chunks.length; i += 25) {
      batches.push(chunks.slice(i, i + 25));
    }
    
    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [CHUNKS_TABLE]: batch.map(chunk => ({
            PutRequest: {
              Item: {
                pk: `CHUNK#${chunk.documentId}`,
                sk: `${chunk.chunkIndex.toString().padStart(5, '0')}`,
                ...chunk,
              }
            }
          }))
        }
      }));
    }
    
    console.log(`[ComplianceStore] Saved ${chunks.length} chunks`);
  },

  /**
   * Hämta alla chunks för ett dokument
   */
  async getByDocumentId(documentId: string): Promise<DocumentChunk[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: CHUNKS_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': `CHUNK#${documentId}` },
    }));
    
    return (result.Items || []).map(item => {
      const { pk, sk, ...chunk } = item;
      return chunk as DocumentChunk;
    });
  },

  /**
   * Ta bort alla chunks för ett dokument
   */
  async deleteByDocumentId(documentId: string): Promise<void> {
    const chunks = await this.getByDocumentId(documentId);
    
    if (chunks.length === 0) return;
    
    const batches: DocumentChunk[][] = [];
    for (let i = 0; i < chunks.length; i += 25) {
      batches.push(chunks.slice(i, i + 25));
    }
    
    for (const batch of batches) {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [CHUNKS_TABLE]: batch.map(chunk => ({
            DeleteRequest: {
              Key: {
                pk: `CHUNK#${chunk.documentId}`,
                sk: chunk.chunkIndex.toString().padStart(5, '0'),
              }
            }
          }))
        }
      }));
    }
    
    console.log(`[ComplianceStore] Deleted ${chunks.length} chunks for ${documentId}`);
  },

  /**
   * Hämta chunk med embedding
   */
  async getWithEmbedding(documentId: string, chunkIndex: number): Promise<DocumentChunk | null> {
    const result = await docClient.send(new GetCommand({
      TableName: CHUNKS_TABLE,
      Key: { 
        pk: `CHUNK#${documentId}`, 
        sk: chunkIndex.toString().padStart(5, '0') 
      }
    }));
    
    if (!result.Item) return null;
    
    const { pk, sk, ...chunk } = result.Item;
    return chunk as DocumentChunk;
  },
};

// ============ Statistics ============

export async function getComplianceStats(): Promise<{
  totalDocuments: number;
  documentsBySource: Record<DocumentSource, number>;
  documentsByCategory: Record<ComplianceCategory, number>;
  totalChunks: number;
  embeddedChunks: number;
}> {
  // This is a simplified version - for production, maintain counters
  const sources: DocumentSource[] = ['fi', 'esma', 'eur-lex', 'fondbolagen', 'aima', 'custom'];
  const stats: Record<DocumentSource, number> = {} as Record<DocumentSource, number>;
  
  let totalDocs = 0;
  for (const source of sources) {
    const docs = await complianceDocStore.listBySource(source, 1000);
    stats[source] = docs.length;
    totalDocs += docs.length;
  }
  
  return {
    totalDocuments: totalDocs,
    documentsBySource: stats,
    documentsByCategory: {} as Record<ComplianceCategory, number>, // TODO: implement
    totalChunks: 0, // TODO: implement
    embeddedChunks: 0, // TODO: implement
  };
}




