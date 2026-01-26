/**
 * Bedrock Knowledge Base Integration for Compliance
 * 
 * Använder AWS Bedrock Knowledge Bases för att:
 * 1. Söka i regelverk med semantisk sökning
 * 2. Generera svar med källhänvisningar
 * 3. Hantera användaruppladdade dokument
 * 
 * KRITISKT: Agenten får ALDRIG hallucianera eller gissa.
 * Om information saknas ska det tydligt framgå.
 */

import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  RetrieveAndGenerateCommand,
  RetrieveAndGenerateType,
} from '@aws-sdk/client-bedrock-agent-runtime';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  BedrockAgentClient,
  StartIngestionJobCommand,
} from '@aws-sdk/client-bedrock-agent';

// Configuration - Knowledge Base runs in eu-west-1 (Bedrock KB supported region)
const BEDROCK_REGION = process.env.BEDROCK_REGION || 'eu-west-1';
const KNOWLEDGE_BASE_ID = process.env.COMPLIANCE_KB_ID || 'XIDTFN0WSY';
const DATA_SOURCE_ID = process.env.COMPLIANCE_DS_ID || 'DXYKG2BYJE';
const S3_BUCKET = process.env.COMPLIANCE_KB_BUCKET || 'aifm-compliance-kb-eu-west-1';
// Claude model for RAG responses
const MODEL_ARN = 'arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0';

// Initialize clients
const agentRuntimeClient = new BedrockAgentRuntimeClient({ region: BEDROCK_REGION });
const agentClient = new BedrockAgentClient({ region: BEDROCK_REGION });
const s3Client = new S3Client({ region: BEDROCK_REGION });

// ============ Types ============

export interface ComplianceCitation {
  documentTitle: string;
  documentNumber?: string;
  source: string;
  sourceLabel: string;
  category: string;
  categoryLabel: string;
  url: string;
  excerpt: string;
  relevanceScore: number;
  effectiveDate?: string;
}

export interface ComplianceAnswer {
  answer: string;
  citations: ComplianceCitation[];
  confidence: number;
  hasRelevantSources: boolean;
  disclaimer?: string;
  retrievedChunks: number;
  sessionId?: string;
}

export interface RetrievalResult {
  content: string;
  score: number;
  metadata: {
    doc_id: string;
    title: string;
    source: string;
    source_label?: string;
    category: string;
    category_label?: string;
    document_number?: string;
    effective_date?: string;
    url: string;
    chunk_index?: number;
  };
}

// ============ System Prompt ============

const COMPLIANCE_SYSTEM_PROMPT = `Du är en expert compliance-assistent för svenska AIF-förvaltare och finansiella institut.

KRITISKA REGLER SOM DU ALLTID MÅSTE FÖLJA:

1. **ENDAST KÄLL-BASERADE SVAR**: Du får ENDAST svara baserat på de dokument som tillhandahålls i kontexten. 
   Du får ALDRIG gissa, spekulera eller använda kunskap som inte finns i dokumenten.

2. **TYDLIG OSÄKERHET**: Om informationen inte finns i dokumenten, säg tydligt:
   "Jag kan inte hitta information om detta i de tillgängliga regelverken. 
   Frågan kan behöva utredas närmare med tillsynsmyndigheten eller juridisk rådgivare."

3. **KÄLLHÄNVISNINGAR**: Varje påstående MÅSTE ha en källhänvisning. Använd formatet:
   [Källa: FFFS 2013:10, Artikel 5] eller [Källa: AIFMD, Artikel 19(1)]

4. **KOMBINERA KÄLLOR**: Du får kombinera information från flera dokument för att ge ett fullständigt svar,
   men var tydlig med vilken information som kommer från vilken källa.

5. **JURIDISK DISCLAIMER**: Avsluta alltid med att rekommendera verifiering mot originalkällorna
   för juridiskt bindande tolkningar.

6. **SVENSKT FOKUS**: Prioritera svenska regelverk (FFFS) och svensk implementering av EU-regler.
   Nämn om det finns skillnader mellan svensk och EU-nivå.

7. **PRAKTISK TILLÄMPNING**: Ge konkreta, praktiska svar som hjälper förvaltare att förstå
   sina skyldigheter och hur de ska implementeras.

8. **AKTUELL INFORMATION**: Nämn om ett regelverk är gammalt eller om det har tillkommit ändringar.
   Om ett dokument har ett "gäller från"-datum, nämn det.

SVARSFORMAT:
- Strukturera svaret tydligt med rubriker vid behov
- Använd punktlistor för att lista krav eller skyldigheter
- Inkludera alltid relevanta artikelnummer och paragrafer
- Avsluta med en sammanfattning och eventuella praktiska rekommendationer`;

// ============ Retrieval Functions ============

/**
 * Sök i Knowledge Base efter relevanta dokument
 */
export async function retrieveFromKnowledgeBase(
  query: string,
  numberOfResults: number = 10,
  filters?: {
    category?: string;
    source?: string;
  }
): Promise<RetrievalResult[]> {
  console.log('[BedrockKB] Retrieving for query:', query.substring(0, 100));

  // Build filter if provided
  let retrievalFilter: Record<string, unknown> | undefined;
  if (filters?.category || filters?.source) {
    const conditions: Record<string, unknown>[] = [];
    if (filters.category) {
      conditions.push({
        equals: { key: 'category', value: filters.category }
      });
    }
    if (filters.source) {
      conditions.push({
        equals: { key: 'source', value: filters.source }
      });
    }
    retrievalFilter = conditions.length === 1 
      ? conditions[0] 
      : { andAll: conditions };
  }

  const command = new RetrieveCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_ID,
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(retrievalFilter && { filter: retrievalFilter as any }),
      },
    },
  });

  const response = await agentRuntimeClient.send(command);

  const results: RetrievalResult[] = (response.retrievalResults || []).map((result: { content?: { text?: string }; score?: number; metadata?: Record<string, unknown> }) => {
    const metadata = result.metadata || {};
    
    return {
      content: result.content?.text || '',
      score: result.score || 0,
      metadata: {
        doc_id: String(metadata['doc_id'] || ''),
        title: String(metadata['title'] || 'Okänt dokument'),
        source: String(metadata['source'] || ''),
        source_label: String(metadata['source_label'] || metadata['source'] || ''),
        category: String(metadata['category'] || ''),
        category_label: String(metadata['category_label'] || metadata['category'] || ''),
        document_number: metadata['document_number'] ? String(metadata['document_number']) : undefined,
        effective_date: metadata['effective_date'] ? String(metadata['effective_date']) : undefined,
        url: String(metadata['url'] || ''),
        chunk_index: metadata['chunk_index'] ? Number(metadata['chunk_index']) : undefined,
      },
    };
  });

  console.log(`[BedrockKB] Retrieved ${results.length} results`);
  return results;
}

/**
 * Generera svar med RAG (Retrieve and Generate)
 */
export async function answerWithKnowledgeBase(
  question: string,
  sessionId?: string,
  filters?: {
    category?: string;
    source?: string;
  }
): Promise<ComplianceAnswer> {
  console.log('[BedrockKB] Answering question:', question.substring(0, 100));

  // First, retrieve relevant documents
  const retrievedDocs = await retrieveFromKnowledgeBase(question, 10, filters);

  // Check if we have relevant sources
  const RELEVANCE_THRESHOLD = 0.3;
  const relevantDocs = retrievedDocs.filter(d => d.score >= RELEVANCE_THRESHOLD);
  const hasRelevantSources = relevantDocs.length >= 1;

  console.log(`[BedrockKB] Found ${relevantDocs.length} relevant docs above threshold`);

  // Build citations from retrieval results
  const citations: ComplianceCitation[] = relevantDocs.slice(0, 5).map(doc => ({
    documentTitle: doc.metadata.title,
    documentNumber: doc.metadata.document_number,
    source: doc.metadata.source,
    sourceLabel: doc.metadata.source_label || doc.metadata.source,
    category: doc.metadata.category,
    categoryLabel: doc.metadata.category_label || doc.metadata.category,
    url: doc.metadata.url,
    excerpt: doc.content.substring(0, 300) + (doc.content.length > 300 ? '...' : ''),
    relevanceScore: doc.score,
    effectiveDate: doc.metadata.effective_date,
  }));

  // Use RetrieveAndGenerate for answer generation
  const command = new RetrieveAndGenerateCommand({
    input: { text: question },
    retrieveAndGenerateConfiguration: {
      type: RetrieveAndGenerateType.KNOWLEDGE_BASE,
      knowledgeBaseConfiguration: {
        knowledgeBaseId: KNOWLEDGE_BASE_ID,
        modelArn: MODEL_ARN,
        generationConfiguration: {
          promptTemplate: {
            textPromptTemplate: `${COMPLIANCE_SYSTEM_PROMPT}

DOKUMENT ATT BASERA SVARET PÅ:
$search_results$

ANVÄNDARENS FRÅGA:
$query$

DITT SVAR (kom ihåg källhänvisningar och följ reglerna ovan):`,
          },
          inferenceConfig: {
            textInferenceConfig: {
              maxTokens: 2500,
              temperature: 0.1,
              topP: 0.9,
            },
          },
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 8,
          },
        },
      },
    },
    sessionId,
  });

  const response = await agentRuntimeClient.send(command);

  // Extract answer
  const answer = response.output?.text || 'Kunde inte generera svar.';
  const newSessionId = response.sessionId;

  // Calculate confidence based on retrieval scores
  const avgScore = relevantDocs.length > 0 
    ? relevantDocs.reduce((sum, d) => sum + d.score, 0) / relevantDocs.length 
    : 0;
  const confidence = Math.min(avgScore * 1.5, 1); // Scale up slightly but cap at 1

  // Add disclaimer based on confidence
  let disclaimer: string | undefined;
  if (!hasRelevantSources) {
    disclaimer = 'Observera: Inget tydligt stöd hittades i kunskapsbasen. Svaret kan vara ofullständigt.';
  } else if (confidence < 0.4) {
    disclaimer = 'Observera: Begränsat källmaterial hittades. Verifiera mot originalkällorna.';
  } else if (confidence < 0.6) {
    disclaimer = 'Tips: Dubbelkolla gärna mot originalkällorna för fullständig information.';
  }

  return {
    answer,
    citations: citations.sort((a, b) => b.relevanceScore - a.relevanceScore),
    confidence,
    hasRelevantSources,
    disclaimer,
    retrievedChunks: retrievedDocs.length,
    sessionId: newSessionId,
  };
}

// ============ User Document Management ============

/**
 * Ladda upp ett dokument till kunskapsbasen
 */
export async function uploadUserDocument(
  companyId: string,
  documentId: string,
  content: string,
  metadata: {
    title: string;
    category?: string;
    source?: string;
    documentNumber?: string;
    effectiveDate?: string;
    uploadedBy: string;
    fileName?: string;
  }
): Promise<{ success: boolean; s3Key: string }> {
  console.log(`[BedrockKB] Uploading user document: ${documentId}`);

  // Format document for Knowledge Base
  const formattedDoc = {
    AMAZON_BEDROCK_TEXT: `
DOKUMENT: ${metadata.title}
KÄLLA: ${metadata.source || 'Användaruppladdad'}
KATEGORI: ${metadata.category || 'custom'}
${metadata.documentNumber ? `DOKUMENTNUMMER: ${metadata.documentNumber}` : ''}
${metadata.effectiveDate ? `GÄLLER FRÅN: ${metadata.effectiveDate}` : ''}
UPPLADDAD AV: ${metadata.uploadedBy}
FÖRETAGS-ID: ${companyId}

---

${content}
`.trim(),
    AMAZON_BEDROCK_METADATA: {
      doc_id: documentId,
      title: metadata.title,
      source: metadata.source || 'user_uploaded',
      source_label: metadata.source || 'Användaruppladdad',
      category: metadata.category || 'custom',
      category_label: metadata.category || 'Anpassat dokument',
      document_number: metadata.documentNumber,
      effective_date: metadata.effectiveDate,
      company_id: companyId,
      uploaded_by: metadata.uploadedBy,
      uploaded_at: new Date().toISOString(),
      url: `internal://company/${companyId}/documents/${documentId}`,
    },
  };

  // Upload to S3
  const s3Key = `user-docs/${companyId}/${documentId}.json`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: JSON.stringify(formattedDoc),
    ContentType: 'application/json',
    Metadata: {
      'company-id': companyId,
      'document-id': documentId,
      'uploaded-by': metadata.uploadedBy,
    },
  }));

  console.log(`[BedrockKB] Uploaded to s3://${S3_BUCKET}/${s3Key}`);

  return { success: true, s3Key };
}

/**
 * Ta bort ett användardokument från kunskapsbasen
 */
export async function deleteUserDocument(
  companyId: string,
  documentId: string
): Promise<{ success: boolean }> {
  console.log(`[BedrockKB] Deleting user document: ${documentId}`);

  const s3Key = `user-docs/${companyId}/${documentId}.json`;

  await s3Client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
  }));

  console.log(`[BedrockKB] Deleted s3://${S3_BUCKET}/${s3Key}`);

  return { success: true };
}

/**
 * Starta synkronisering av kunskapsbasen
 * 
 * Anropas efter att nya dokument laddats upp eller tagits bort.
 */
export async function syncKnowledgeBase(): Promise<{ 
  ingestionJobId: string;
  status: string;
}> {
  console.log('[BedrockKB] Starting knowledge base sync...');

  const command = new StartIngestionJobCommand({
    knowledgeBaseId: KNOWLEDGE_BASE_ID,
    dataSourceId: DATA_SOURCE_ID,
    description: `Sync triggered at ${new Date().toISOString()}`,
  });

  const response = await agentClient.send(command);

  const ingestionJobId = response.ingestionJob?.ingestionJobId || '';
  const status = response.ingestionJob?.status || 'UNKNOWN';

  console.log(`[BedrockKB] Ingestion job started: ${ingestionJobId}, status: ${status}`);

  return { ingestionJobId, status };
}

// ============ Statistics ============

/**
 * Hämta statistik om kunskapsbasen
 */
export async function getKnowledgeBaseStats(): Promise<{
  totalDocuments: number;
  lastSync: string | null;
  status: string;
}> {
  // This would typically come from a metadata table or the Bedrock API
  // For now, return placeholder data
  return {
    totalDocuments: 461, // From the INDEX.txt
    lastSync: new Date().toISOString(),
    status: 'ACTIVE',
  };
}

// ============ Fallback to local search ============

/**
 * Om Knowledge Base inte är konfigurerad, använd lokal sökning
 */
export function isKnowledgeBaseConfigured(): boolean {
  return Boolean(KNOWLEDGE_BASE_ID && KNOWLEDGE_BASE_ID.length > 0);
}



