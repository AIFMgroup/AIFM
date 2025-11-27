/**
 * RAG (Retrieval Augmented Generation) Service - DEMO MODE
 * Returns mock responses without AI
 * Replace with OpenAI integration when going to production
 */

import { searchDocuments, VectorSearchResult } from './vector-search';

export interface RAGResponse {
  answer: string;
  sources: Array<{
    documentId: string;
    fileName: string;
    excerpt: string;
    score: number;
  }>;
  citations: string[];
}

/**
 * Generate RAG response - DEMO MODE
 * Returns document search results with a mock answer
 */
export async function generateRAGResponse(
  question: string,
  filters?: {
    clientId?: string;
    category?: string;
    documentType?: string;
    documentIds?: string[];
  },
  maxSources: number = 5
): Promise<RAGResponse> {
  try {
    // Step 1: Retrieve relevant documents using vector search
    let searchResults: VectorSearchResult[];
    
    if (filters?.documentIds && filters.documentIds.length > 0) {
      const allDocs = await searchDocuments(question, 100, filters);
      searchResults = allDocs.filter(doc => filters.documentIds!.includes(doc.documentId)).slice(0, maxSources);
    } else {
      searchResults = await searchDocuments(question, maxSources, filters);
    }

    if (searchResults.length === 0) {
      return {
        answer: 'Inga relevanta dokument hittades för din fråga. Prova att omformulera eller ladda upp fler dokument.',
        sources: [],
        citations: [],
      };
    }

    // Step 2: Format sources
    const sources = searchResults.map(result => ({
      documentId: result.documentId,
      fileName: result.fileName,
      excerpt: result.text.substring(0, 300) + (result.text.length > 300 ? '...' : ''),
      score: result.score,
    }));

    // Step 3: Generate mock answer (DEMO MODE)
    const documentList = sources.map((s, i) => `${i + 1}. ${s.fileName}`).join('\n');
    
    const answer = `📚 **Demo-läge - Dokumentsökning**

Jag hittade ${sources.length} relevanta dokument för din fråga: "${question}"

**Relevanta dokument:**
${documentList}

---

*I produktionsläge skulle AI analysera dessa dokument och generera ett detaljerat svar baserat på innehållet.*

**För att aktivera full AI-funktionalitet:**
1. Lägg till OPENAI_API_KEY i miljövariabler
2. Återaktivera OpenAI-integration i koden

*Demo-svar genererat ${new Date().toLocaleString('sv-SE')}*`;

    return {
      answer,
      sources,
      citations: sources.map(s => s.fileName),
    };
  } catch (error: any) {
    console.error('RAG generation error:', error);
    return {
      answer: `Ett fel uppstod vid dokumentsökning: ${error.message}`,
      sources: [],
      citations: [],
    };
  }
}

/**
 * Ask a question about documents (convenience function)
 */
export async function askDocumentQuestion(
  question: string,
  documentId?: string,
  filters?: {
    clientId?: string;
    category?: string;
    documentType?: string;
  }
): Promise<RAGResponse> {
  const searchFilters = documentId
    ? { ...filters, documentIds: [documentId] }
    : filters;

  return generateRAGResponse(question, searchFilters);
}
