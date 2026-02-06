/**
 * AIFM Compliance Knowledge Base
 * 
 * Handles document ingestion, chunking, embedding, and retrieval for the RAG system.
 * Uses AWS Bedrock for embeddings and DynamoDB for vector storage.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface Document {
  id: string;
  title: string;
  source: string; // URL or file path
  sourceType: 'url' | 'pdf' | 'docx' | 'text';
  content: string;
  metadata: {
    documentNumber?: string; // e.g., "SFS 2013:561"
    chapter?: string;
    section?: string;
    effectiveDate?: string;
    lastUpdated?: string;
    authority?: string; // e.g., "Riksdagen", "Finansinspektionen"
  };
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  metadata: {
    chapter?: string;
    section?: string;
    paragraph?: string;
  };
  embedding?: number[];
  sourceUrl: string;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  document: Document;
}

// ============================================================================
// AWS Clients
// ============================================================================

const region = process.env.AWS_REGION || 'eu-north-1';

const bedrockClient = new BedrockRuntimeClient({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

const dynamoClient = new DynamoDBClient({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

// Table names
const DOCUMENTS_TABLE = process.env.COMPLIANCE_DOCUMENTS_TABLE || 'aifm-compliance-documents';
const CHUNKS_TABLE = process.env.COMPLIANCE_CHUNKS_TABLE || 'aifm-compliance-chunks';
const S3_BUCKET = process.env.COMPLIANCE_S3_BUCKET || 'aifm-compliance-documents';

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embeddings using AWS Bedrock Titan Embeddings
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const modelId = 'amazon.titan-embed-text-v2:0';
  
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: text.slice(0, 8000), // Titan has 8k token limit
    }),
  });

  try {
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

// ============================================================================
// Document Chunking
// ============================================================================

/**
 * Split document into chunks with overlap for better context preservation
 */
export function chunkDocument(
  document: Document,
  chunkSize: number = 1000,
  overlap: number = 200
): DocumentChunk[] {
  const content = document.content;
  const chunks: DocumentChunk[] = [];
  
  // Try to split on natural boundaries (paragraphs, sections)
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        id: `${document.id}-chunk-${chunkIndex}`,
        documentId: document.id,
        documentTitle: document.title,
        content: currentChunk.trim(),
        chunkIndex,
        totalChunks: 0, // Will be updated after
        metadata: extractChunkMetadata(currentChunk, document),
        sourceUrl: document.source,
      });
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5)); // Approximate word count
      currentChunk = overlapWords.join(' ') + '\n\n' + paragraph;
      chunkIndex++;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: `${document.id}-chunk-${chunkIndex}`,
      documentId: document.id,
      documentTitle: document.title,
      content: currentChunk.trim(),
      chunkIndex,
      totalChunks: 0,
      metadata: extractChunkMetadata(currentChunk, document),
      sourceUrl: document.source,
    });
  }
  
  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.totalChunks = chunks.length;
  });
  
  return chunks;
}

/**
 * Extract metadata from chunk content (chapter, section, etc.)
 */
function extractChunkMetadata(content: string, document: Document): DocumentChunk['metadata'] {
  const metadata: DocumentChunk['metadata'] = {};
  
  // Swedish law patterns
  const chapterMatch = content.match(/(\d+)\s*kap\./i);
  if (chapterMatch) {
    metadata.chapter = `${chapterMatch[1]} kap.`;
  }
  
  const sectionMatch = content.match(/(\d+)\s*§/);
  if (sectionMatch) {
    metadata.section = `${sectionMatch[1]} §`;
  }
  
  const paragraphMatch = content.match(/(\d+)\s*mom\./i);
  if (paragraphMatch) {
    metadata.paragraph = `${paragraphMatch[1]} mom.`;
  }
  
  return metadata;
}

// ============================================================================
// Vector Similarity Search
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search for relevant chunks based on query
 */
export async function searchChunks(
  query: string,
  topK: number = 5,
  minScore: number = 0.3
): Promise<SearchResult[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    
    // Get all chunks from DynamoDB (for small datasets)
    // For larger datasets, consider using OpenSearch or Pinecone
    const scanResult = await docClient.send(new ScanCommand({
      TableName: CHUNKS_TABLE,
    }));
    
    const chunks = scanResult.Items as DocumentChunk[] || [];
    
    // Calculate similarity scores
    const scoredChunks = chunks
      .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
      .map(chunk => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding!),
      }))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    
    // Fetch document details for each result
    const results: SearchResult[] = [];
    for (const { chunk, score } of scoredChunks) {
      // Get document details
      const docResult = await docClient.send(new QueryCommand({
        TableName: DOCUMENTS_TABLE,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
          ':id': chunk.documentId,
        },
      }));
      
      const document = docResult.Items?.[0] as Document;
      if (document) {
        results.push({ chunk, score, document });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

// ============================================================================
// Document Management
// ============================================================================

/**
 * Add a new document to the knowledge base
 */
export async function addDocument(document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const fullDocument: Document = {
    ...document,
    id,
    createdAt: now,
    updatedAt: now,
  };
  
  // Save document
  await docClient.send(new PutCommand({
    TableName: DOCUMENTS_TABLE,
    Item: fullDocument,
  }));
  
  // Chunk and embed document
  const chunks = chunkDocument(fullDocument);
  
  for (const chunk of chunks) {
    try {
      // Generate embedding
      chunk.embedding = await generateEmbedding(chunk.content);
      
      // Save chunk
      await docClient.send(new PutCommand({
        TableName: CHUNKS_TABLE,
        Item: chunk,
      }));
    } catch (error) {
      console.error(`Failed to process chunk ${chunk.id}:`, error);
    }
  }
  
  return fullDocument;
}

/**
 * Get all documents
 */
export async function getAllDocuments(): Promise<Document[]> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: DOCUMENTS_TABLE,
    }));
    return (result.Items as Document[]) || [];
  } catch (error) {
    console.error('Failed to get documents:', error);
    return [];
  }
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // Delete chunks
  const chunksResult = await docClient.send(new ScanCommand({
    TableName: CHUNKS_TABLE,
    FilterExpression: 'documentId = :docId',
    ExpressionAttributeValues: {
      ':docId': documentId,
    },
  }));
  
  for (const chunk of chunksResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: CHUNKS_TABLE,
      Key: { id: chunk.id },
    }));
  }
  
  // Delete document
  await docClient.send(new DeleteCommand({
    TableName: DOCUMENTS_TABLE,
    Key: { id: documentId },
  }));
}

// ============================================================================
// RAG Query
// ============================================================================

/**
 * Process a RAG query: search for relevant chunks and generate response
 */
export async function ragQuery(
  question: string,
  options: {
    topK?: number;
    includeContext?: boolean;
  } = {}
): Promise<{
  answer: string;
  citations: Array<{
    documentTitle: string;
    documentNumber?: string;
    section?: string;
    excerpt: string;
    sourceUrl: string;
    relevanceScore: number;
  }>;
  confidence: number;
  hasRelevantSources: boolean;
}> {
  const { topK = 5 } = options;
  
  // Search for relevant chunks
  const searchResults = await searchChunks(question, topK);
  
  if (searchResults.length === 0) {
    return {
      answer: 'Jag kunde inte hitta relevant information i kunskapsbasen för att besvara din fråga. Försök omformulera frågan eller kontakta en compliance-expert.',
      citations: [],
      confidence: 0,
      hasRelevantSources: false,
    };
  }
  
  // Build context from search results
  const context = searchResults
    .map((r, i) => `[Källa ${i + 1}: ${r.document.title}${r.chunk.metadata.section ? `, ${r.chunk.metadata.section}` : ''}]\n${r.chunk.content}`)
    .join('\n\n---\n\n');
  
  // Generate answer using Claude
  const systemPrompt = `Du är en juridisk AI-assistent specialiserad på svensk finansiell reglering.

Din uppgift är att besvara frågor baserat ENDAST på den kontext som ges. Du ska:
1. Ge ett tydligt och strukturerat svar
2. Citera relevanta delar från källorna
3. Ange vilken källa (nummer) informationen kommer från
4. Om informationen inte finns i kontexten, säg det tydligt
5. Svara på svenska

VIKTIGT: Basera ditt svar ENDAST på den givna kontexten. Gissa inte eller lägg till information som inte finns i källorna.`;

  const userPrompt = `Kontext från kunskapsbasen:

${context}

---

Fråga: ${question}

Ge ett detaljerat svar baserat på ovanstående kontext. Referera till källorna med nummer (t.ex. [Källa 1]).`;

  try {
    const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    
    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const answer = responseBody.content?.[0]?.text || 'Kunde inte generera svar.';
    
    // Calculate confidence based on search scores
    const avgScore = searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length;
    
    return {
      answer,
      citations: searchResults.map(r => ({
        documentTitle: r.document.title,
        documentNumber: r.document.metadata.documentNumber,
        section: r.chunk.metadata.section || r.chunk.metadata.chapter,
        excerpt: r.chunk.content.slice(0, 300) + '...',
        sourceUrl: r.document.source,
        relevanceScore: r.score,
      })),
      confidence: avgScore,
      hasRelevantSources: true,
    };
  } catch (error) {
    console.error('RAG query failed:', error);
    throw error;
  }
}

// ============================================================================
// Export
// ============================================================================

export const knowledgeBase = {
  addDocument,
  getAllDocuments,
  deleteDocument,
  searchChunks,
  ragQuery,
  generateEmbedding,
  chunkDocument,
};
