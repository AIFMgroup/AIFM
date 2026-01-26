/**
 * RAG Pipeline for Compliance Documents
 * 
 * Chunkar dokument och genererar embeddings för semantisk sökning.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  ComplianceDocument, 
  DocumentChunk, 
  ComplianceSearchResult,
  ComplianceCategory 
} from './types';
import { complianceDocStore, complianceChunkStore } from './documentStore';
import { v4 as uuidv4 } from 'uuid';

const BEDROCK_REGION = 'eu-west-1';
const EMBEDDING_MODEL = 'amazon.titan-embed-text-v2:0';
const CHAT_MODEL = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

// ============ Chunking ============

interface ChunkOptions {
  maxChunkSize: number;      // characters
  chunkOverlap: number;      // characters
  preserveSections: boolean; // try to keep sections together
}

const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxChunkSize: 1500,
  chunkOverlap: 200,
  preserveSections: true,
};

/**
 * Chunka ett dokument i mindre delar
 */
export function chunkDocument(
  doc: ComplianceDocument, 
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS
): DocumentChunk[] {
  const text = doc.fullText || doc.summary || '';
  
  if (!text || text.length === 0) {
    console.log(`[RAG] No text content for document ${doc.id}`);
    return [];
  }
  
  const chunks: DocumentChunk[] = [];
  
  // Split by sections first if preserveSections is true
  let sections: { title?: string; content: string }[] = [];
  
  if (options.preserveSections) {
    // Try to find section headers (numbered sections, article headers, etc.)
    const sectionRegex = /(?:^|\n)(?:(?:§\s*\d+|Artikel\s+\d+|Article\s+\d+|Kapitel\s+\d+|Chapter\s+\d+|\d+\.\s+)[^\n]*)/gi;
    
    const matches = [...text.matchAll(sectionRegex)];
    
    if (matches.length > 0) {
      let lastIndex = 0;
      
      for (const match of matches) {
        if (match.index !== undefined && match.index > lastIndex) {
          const content = text.substring(lastIndex, match.index).trim();
          if (content.length > 50) {
            sections.push({ content });
          }
        }
        
        sections.push({
          title: match[0].trim(),
          content: '',
        });
        
        lastIndex = match.index! + match[0].length;
      }
      
      // Add remaining text
      const remaining = text.substring(lastIndex).trim();
      if (remaining.length > 50) {
        sections.push({ content: remaining });
      }
    }
  }
  
  // If no sections found, treat entire document as one section
  if (sections.length === 0) {
    sections = [{ content: text }];
  }
  
  // Now chunk each section
  let chunkIndex = 0;
  
  for (const section of sections) {
    const sectionText = section.title ? `${section.title}\n\n${section.content}` : section.content;
    
    if (sectionText.length <= options.maxChunkSize) {
      // Section fits in one chunk
      if (sectionText.length > 50) {
        chunks.push(createChunk(doc, sectionText, chunkIndex++, section.title));
      }
    } else {
      // Need to split section into multiple chunks
      const sectionChunks = splitTextIntoChunks(sectionText, options);
      
      for (const chunkText of sectionChunks) {
        chunks.push(createChunk(doc, chunkText, chunkIndex++, section.title));
      }
    }
  }
  
  console.log(`[RAG] Created ${chunks.length} chunks for document ${doc.id}`);
  
  return chunks;
}

function splitTextIntoChunks(text: string, options: ChunkOptions): string[] {
  const chunks: string[] = [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= options.maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      // Save current chunk and start new one
      if (currentChunk.length > 50) {
        chunks.push(currentChunk);
      }
      
      // If paragraph itself is too long, split by sentences
      if (para.length > options.maxChunkSize) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= options.maxChunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk.length > 50) {
              chunks.push(currentChunk);
            }
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = para;
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length > 50) {
    chunks.push(currentChunk);
  }
  
  // Add overlap between chunks
  if (options.chunkOverlap > 0 && chunks.length > 1) {
    const overlappedChunks: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      
      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const overlap = prevChunk.slice(-options.chunkOverlap);
        chunk = `...${overlap}\n\n${chunk}`;
      }
      
      overlappedChunks.push(chunk);
    }
    
    return overlappedChunks;
  }
  
  return chunks;
}

function createChunk(
  doc: ComplianceDocument, 
  content: string, 
  index: number,
  section?: string
): DocumentChunk {
  return {
    id: uuidv4(),
    documentId: doc.id,
    chunkIndex: index,
    content,
    contentLength: content.length,
    section,
    metadata: {
      source: doc.source,
      type: doc.type,
      categories: doc.categories,
      documentTitle: doc.title,
      documentNumber: doc.documentNumber,
      language: doc.language,
    },
    createdAt: new Date().toISOString(),
  };
}

// ============ Embeddings ============

/**
 * Generera embedding för en text med Amazon Titan
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: EMBEDDING_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text.substring(0, 8000), // Titan limit
      })
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding;
    
  } catch (error) {
    console.error('[RAG] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Processa ett dokument: chunka och generera embeddings
 */
export async function processDocument(doc: ComplianceDocument): Promise<void> {
  console.log(`[RAG] Processing document: ${doc.id}`);
  
  try {
    // 1. Chunk the document
    const chunks = chunkDocument(doc);
    
    if (chunks.length === 0) {
      await complianceDocStore.updateStatus(doc.source, doc.id, 'error', {
        error: 'No chunks created - document may be empty',
      });
      return;
    }
    
    // 2. Generate embeddings for each chunk
    console.log(`[RAG] Generating embeddings for ${chunks.length} chunks...`);
    
    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content);
        chunk.embedding = embedding;
        chunk.embeddingModel = EMBEDDING_MODEL;
      } catch (error) {
        console.error(`[RAG] Error embedding chunk ${chunk.id}:`, error);
        // Continue with other chunks
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 3. Save chunks
    await complianceChunkStore.saveChunks(chunks);
    
    // 4. Update document status
    await complianceDocStore.updateStatus(doc.source, doc.id, 'embedded', {
      lastEmbedded: new Date().toISOString(),
      chunkCount: chunks.length,
    });
    
    console.log(`[RAG] Successfully processed document ${doc.id} with ${chunks.length} chunks`);
    
  } catch (error) {
    console.error(`[RAG] Error processing document ${doc.id}:`, error);
    await complianceDocStore.updateStatus(doc.source, doc.id, 'error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============ Search ============

/**
 * Sök efter relevanta chunks med semantisk sökning
 */
export async function searchChunks(
  query: string,
  limit = 5,
  filters?: {
    sources?: string[];
    categories?: string[];
  }
): Promise<ComplianceSearchResult[]> {
  console.log(`[RAG] Searching for: "${query.substring(0, 50)}..."`);
  
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);
  
  // Get all documents and their chunks
  // Note: For production, use a proper vector database (pgvector, Pinecone, etc.)
  const allDocs = await getAllDocuments();
  const results: ComplianceSearchResult[] = [];
  
  for (const doc of allDocs) {
    // Apply filters
    if (filters?.sources && !filters.sources.includes(doc.source)) continue;
    if (filters?.categories && !filters.categories.some(c => doc.categories.includes(c as ComplianceCategory))) continue;
    
    // Get chunks for this document
    const chunks = await complianceChunkStore.getByDocumentId(doc.id);
    
    for (const chunk of chunks) {
      if (chunk.embedding) {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        
        if (score > 0.3) { // Minimum relevance threshold
          results.push({
            chunk,
            document: doc,
            score,
          });
        }
      }
    }
  }
  
  // Sort by score and return top results
  results.sort((a, b) => b.score - a.score);
  const topResults = results.slice(0, limit);
  
  console.log(`[RAG] Found ${results.length} matches, returning top ${topResults.length}`);
  
  return topResults;
}

/**
 * Hämta alla dokument (helper)
 */
async function getAllDocuments(): Promise<ComplianceDocument[]> {
  const sources: ('fi' | 'esma' | 'eur-lex' | 'fondbolagen' | 'aima' | 'custom')[] = 
    ['fi', 'esma', 'eur-lex', 'fondbolagen', 'aima', 'custom'];
  const allDocs: ComplianceDocument[] = [];
  
  for (const source of sources) {
    const docs = await complianceDocStore.listBySource(source, 100);
    allDocs.push(...docs);
  }
  
  return allDocs;
}

/**
 * Hämta dokument för ett specifikt företag
 */
export async function getDocumentsByCompany(companyId: string): Promise<ComplianceDocument[]> {
  // Get all documents (company-specific filtering can be added later)
  const sources: ('fi' | 'esma' | 'eur-lex' | 'fondbolagen' | 'aima' | 'custom')[] = 
    ['fi', 'esma', 'eur-lex', 'fondbolagen', 'aima', 'custom'];
  const allDocs: ComplianceDocument[] = [];
  
  for (const source of sources) {
    const docs = await complianceDocStore.listBySource(source, 100);
    allDocs.push(...docs);
  }
  
  // For custom documents, filter by company (via fullText metadata embedding)
  return allDocs.filter(doc => 
    doc.source !== 'custom' || 
    (doc.fullText && doc.fullText.includes(`companyId:${companyId}`))
  );
}

/**
 * Beräkna cosine similarity mellan två vektorer
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============ Chat with RAG ============

/**
 * Svara på en compliance-fråga med RAG
 * 
 * KRITISKT: Systemet får ALDRIG hallucianera. Om information saknas
 * ska det tydligt framgå att svaret inte kan ges.
 */
export async function answerComplianceQuestion(
  question: string,
  chatHistory: { role: 'user' | 'assistant'; content: string }[] = []
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
  disclaimer?: string;
}> {
  console.log(`[RAG] Answering question: "${question.substring(0, 50)}..."`);
  
  // 1. Search for relevant chunks - get more to ensure coverage
  const relevantChunks = await searchChunks(question, 8);
  
  // 2. Filter by relevance threshold
  const RELEVANCE_THRESHOLD = 0.35; // Minimum relevance score
  const highRelevanceChunks = relevantChunks.filter(r => r.score >= RELEVANCE_THRESHOLD);
  const hasRelevantSources = highRelevanceChunks.length >= 1;
  
  console.log(`[RAG] Found ${relevantChunks.length} chunks, ${highRelevanceChunks.length} above threshold`);
  
  // 3. Build context from chunks
  let context = '';
  const citations: Array<{
    documentTitle: string;
    documentNumber?: string;
    section?: string;
    excerpt: string;
    sourceUrl: string;
    relevanceScore: number;
  }> = [];
  
  // Use high relevance chunks for context, sorted by score
  const chunksForContext = highRelevanceChunks.slice(0, 5);
  
  for (const result of chunksForContext) {
    const sourceLabel = result.document.documentNumber || result.document.shortTitle || result.document.title;
    context += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    context += `\n📄 KÄLLA: ${sourceLabel}`;
    context += `\n📊 Relevans: ${Math.round(result.score * 100)}%`;
    if (result.chunk.section) {
      context += `\n📍 Avsnitt: ${result.chunk.section}`;
    }
    context += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    context += `\n${result.chunk.content}`;
    
    citations.push({
      documentTitle: result.document.title,
      documentNumber: result.document.documentNumber,
      section: result.chunk.section,
      excerpt: result.chunk.content.substring(0, 300) + (result.chunk.content.length > 300 ? '...' : ''),
      sourceUrl: result.document.sourceUrl,
      relevanceScore: result.score,
    });
  }
  
  // 4. Calculate confidence based on relevance scores
  const avgRelevance = chunksForContext.length > 0
    ? chunksForContext.reduce((sum, c) => sum + c.score, 0) / chunksForContext.length
    : 0;
  const maxRelevance = chunksForContext.length > 0
    ? Math.max(...chunksForContext.map(c => c.score))
    : 0;
  
  // Confidence formula: weighted average of best match and average
  const confidence = hasRelevantSources 
    ? Math.min(0.95, (maxRelevance * 0.6 + avgRelevance * 0.4))
    : 0.1;
  
  // 5. Build strict RAG prompt
  const systemPrompt = `Du är en professionell compliance-rådgivare för svenska AIF-förvaltare.

═══════════════════════════════════════════════════════════════════════
⚠️  KRITISKA REGLER - FÖLJ DESSA EXAKT
═══════════════════════════════════════════════════════════════════════

1. DU FÅR ENDAST svara baserat på informationen i KONTEXTEN nedan.
2. Om kontexten INTE innehåller relevant information för att besvara frågan:
   - Säg TYDLIGT: "Jag hittar inte tillräcklig information i mina källor för att besvara denna fråga."
   - Föreslå VAR användaren kan hitta svaret (t.ex. "Kontakta FI direkt" eller "Se FFFS 2013:10")
   
3. HALLUCIANERA ALDRIG. Hitta aldrig på information, artikelnummer eller paragrafer.

4. När du svarar:
   - Citera EXAKT vilken källa informationen kommer från
   - Ange artikelnummer, paragraf eller kapitel om det finns
   - Använd format: "Enligt [KÄLLA], artikel/paragraf X..."
   
5. Om du är OSÄKER på tolkningen:
   - Säg det tydligt: "Observera att detta är min tolkning..."
   - Rekommendera att dubbelkolla med originalkällan

6. Svara ALLTID på svenska.

7. Strukturera svaret tydligt med:
   - Kort sammanfattning först
   - Detaljerad förklaring med källhänvisningar
   - Eventuella reservationer eller förtydliganden

═══════════════════════════════════════════════════════════════════════
KONTEXT FRÅN REGELVERK (${chunksForContext.length} relevanta källor)
═══════════════════════════════════════════════════════════════════════
${context || '⚠️ INGEN RELEVANT KONTEXT HITTADES för denna fråga.'}

═══════════════════════════════════════════════════════════════════════
`;

  // If no relevant sources, add explicit instruction
  const noSourcesWarning = !hasRelevantSources 
    ? '\n\n⚠️ VIKTIGT: Inga relevanta källor hittades. Du MÅSTE informera användaren om detta och INTE försöka svara baserat på annan kunskap.'
    : '';

  const messages = [
    ...chatHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: question + noSourcesWarning }
  ];

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: CHAT_MODEL,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2500,
        temperature: 0.1, // Low temperature for more factual responses
        system: systemPrompt,
        messages,
      })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const answer = responseBody.content?.[0]?.text || 'Kunde inte generera svar.';

    // Add disclaimer for low confidence
    let disclaimer: string | undefined;
    if (confidence < 0.4) {
      disclaimer = '⚠️ Observera: Svaret baseras på begränsat källmaterial. Verifiera alltid mot originalkällorna.';
    } else if (confidence < 0.6) {
      disclaimer = '💡 Tips: Dubbelkolla gärna mot originalkällorna för fullständig information.';
    }

    return {
      answer,
      citations: citations.sort((a, b) => b.relevanceScore - a.relevanceScore),
      confidence,
      hasRelevantSources,
      disclaimer,
    };

  } catch (error) {
    console.error('[RAG] Error generating answer:', error);
    throw error;
  }
}

