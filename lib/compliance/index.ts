/**
 * Compliance Module
 * 
 * AI-powered compliance assistant for AIF managers.
 * 
 * Features:
 * - Document scraping from FI.se, ESMA, EUR-Lex
 * - RAG-powered Q&A with citations
 * - Vector search for relevant regulations
 * - Chat interface with history
 */

// Types
export * from './types';

// Document storage
export { complianceDocStore, complianceChunkStore, getComplianceStats } from './documentStore';

// RAG Pipeline
export { 
  chunkDocument, 
  generateEmbedding, 
  processDocument,
  searchChunks,
  answerComplianceQuestion 
} from './ragPipeline';

// Scrapers
export { runFIScraper } from './scrapers/fiScraper';
export { runESMAScraper } from './scrapers/esmaScraper';




