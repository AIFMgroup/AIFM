/**
 * Compliance Module Types
 * 
 * Typer för regelverksdokument, embeddings och chat.
 */

export type DocumentSource = 
  | 'fi'           // Finansinspektionen
  | 'esma'         // European Securities and Markets Authority
  | 'eur-lex'      // EU Law (AIFMD, SFDR, etc.)
  | 'fondbolagen'  // Fondbolagens Förening
  | 'aima'         // Alternative Investment Management Association
  | 'custom';      // Manuellt uppladdade dokument

export type DocumentType =
  | 'regulation'      // Förordning/Regulation
  | 'directive'       // Direktiv
  | 'guideline'       // Riktlinje/Guideline
  | 'qa'              // Q&A
  | 'opinion'         // Opinion/Yttrande
  | 'fffs'            // FI:s författningssamling
  | 'circular'        // Cirkulär
  | 'report'          // Rapport
  | 'standard'        // Teknisk standard (RTS/ITS)
  | 'other';

export type ComplianceCategory =
  | 'aifmd'           // Alternative Investment Fund Managers Directive
  | 'sfdr'            // Sustainable Finance Disclosure Regulation
  | 'mifid'           // MiFID II
  | 'aml'             // Anti-Money Laundering
  | 'mar'             // Market Abuse Regulation
  | 'priips'          // PRIIPs Regulation
  | 'emir'            // EMIR
  | 'taxonomy'        // EU Taxonomy
  | 'reporting'       // AIFMD Annex IV, etc.
  | 'marketing'       // Marketing & Pre-marketing
  | 'valuation'       // Valuation rules
  | 'risk'            // Risk management
  | 'depositary'      // Depositary rules
  | 'general';        // General compliance

export interface ComplianceDocument {
  id: string;
  source: DocumentSource;
  type: DocumentType;
  categories: ComplianceCategory[];
  
  // Metadata
  title: string;
  shortTitle?: string;
  documentNumber?: string;    // e.g., "FFFS 2013:10", "ESMA34-45-1415"
  publishDate: string;
  effectiveDate?: string;
  expiryDate?: string;
  language: 'sv' | 'en' | 'other';
  
  // Source info
  sourceUrl: string;
  pdfUrl?: string;
  
  // Content
  summary?: string;
  fullText?: string;
  
  // Processing status
  status: 'pending' | 'scraped' | 'chunked' | 'embedded' | 'error';
  lastScraped?: string;
  lastEmbedded?: string;
  chunkCount?: number;
  error?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  
  // Content
  content: string;
  contentLength: number;
  
  // Location in document
  section?: string;
  article?: string;
  paragraph?: string;
  pageNumber?: number;
  
  // Embedding
  embedding?: number[];      // Vector embedding
  embeddingModel?: string;   // e.g., "amazon.titan-embed-text-v1"
  
  // Metadata for search
  metadata: {
    source: DocumentSource;
    type: DocumentType;
    categories: ComplianceCategory[];
    documentTitle: string;
    documentNumber?: string;
    language: string;
  };
  
  createdAt: string;
}

export interface ComplianceChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  
  // For assistant messages
  citations?: Citation[];
  confidence?: number;
  
  // Metadata
  userId?: string;
  companyId?: string;
  timestamp: string;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  documentTitle: string;
  documentNumber?: string;
  section?: string;
  article?: string;
  relevanceScore: number;
  excerpt: string;
  sourceUrl: string;
}

export interface ComplianceSearchResult {
  chunk: DocumentChunk;
  document: ComplianceDocument;
  score: number;
  highlights?: string[];
}

export interface ScraperConfig {
  source: DocumentSource;
  baseUrl: string;
  enabled: boolean;
  rateLimit: number;         // requests per minute
  lastRun?: string;
  nextScheduledRun?: string;
}

export interface ScraperResult {
  source: DocumentSource;
  documentsFound: number;
  documentsNew: number;
  documentsUpdated: number;
  errors: string[];
  duration: number;          // milliseconds
  timestamp: string;
}




