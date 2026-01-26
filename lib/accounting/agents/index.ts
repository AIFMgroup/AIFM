/**
 * Multi-Agent Document Processing Pipeline
 * 
 * Tre AI-agenter som samarbetar:
 * 1. Klassificerare - Identifierar dokumenttyp
 * 2. Extraherare - Läser av all data
 * 3. Fortnox-mapper - Mappar till rätt konton
 */

export * from './documentClassifier';
export * from './dataExtractor';
export * from './fortnoxMapper';

import { 
  classifyDocumentWithVision, 
  classifyDocumentWithText,
  ClassificationResult,
  DocumentType 
} from './documentClassifier';

import { 
  extractDataWithVision, 
  extractDataWithText,
  ExtractedData 
} from './dataExtractor';

import { 
  mapToFortnox,
  FortnoxMapping 
} from './fortnoxMapper';

export interface MultiAgentResult {
  // Agent 1: Klassificering
  classification: ClassificationResult;
  
  // Agent 2: Extraktion
  extractedData: ExtractedData;
  
  // Agent 3: Fortnox-mappning
  fortnoxMapping: FortnoxMapping;
  
  // Sammanfattning
  processingTime: number;
  agentSteps: {
    agent: string;
    status: 'success' | 'partial' | 'failed';
    duration: number;
    message: string;
  }[];
}

/**
 * Kör hela multi-agent pipelinen
 */
export async function runMultiAgentPipeline(
  s3Key: string,
  ocrText: string,
  fileType: string
): Promise<MultiAgentResult> {
  const startTime = Date.now();
  const agentSteps: MultiAgentResult['agentSteps'] = [];
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase());

  // ========== AGENT 1: Klassificering ==========
  let classification: ClassificationResult;
  const classifyStart = Date.now();
  
  try {
    if (isImage) {
      console.log('[MultiAgent] Agent 1: Klassificerar bild...');
      classification = await classifyDocumentWithVision(s3Key, ocrText);
    } else {
      console.log('[MultiAgent] Agent 1: Klassificerar text...');
      classification = await classifyDocumentWithText(ocrText);
    }
    
    agentSteps.push({
      agent: 'Klassificerare',
      status: classification.confidence > 0.7 ? 'success' : 'partial',
      duration: Date.now() - classifyStart,
      message: `${classification.documentType} (${Math.round(classification.confidence * 100)}% säkerhet)`,
    });
    
    console.log(`[MultiAgent] Agent 1 klar: ${classification.documentType} (${classification.confidence})`);
  } catch (error) {
    console.error('[MultiAgent] Agent 1 fel:', error);
    classification = {
      documentType: 'OTHER',
      confidence: 0.3,
      reasoning: 'Klassificering misslyckades',
      language: 'sv',
      hasHandwriting: false,
      imageQuality: 'medium',
      multipleDocuments: false,
      documentCount: 1,
    };
    agentSteps.push({
      agent: 'Klassificerare',
      status: 'failed',
      duration: Date.now() - classifyStart,
      message: 'Kunde inte klassificera dokumentet',
    });
  }

  // ========== AGENT 2: Extraktion ==========
  let extractedData: ExtractedData;
  const extractStart = Date.now();
  
  try {
    if (isImage) {
      console.log('[MultiAgent] Agent 2: Extraherar data från bild...');
      extractedData = await extractDataWithVision(s3Key, classification.documentType, ocrText);
    } else {
      console.log('[MultiAgent] Agent 2: Extraherar data från text...');
      extractedData = await extractDataWithText(ocrText, classification.documentType);
    }
    
    agentSteps.push({
      agent: 'Extraherare',
      status: extractedData.extractionConfidence > 0.7 ? 'success' : 'partial',
      duration: Date.now() - extractStart,
      message: `${extractedData.supplier}: ${extractedData.totalAmount} ${extractedData.currency}`,
    });
    
    console.log(`[MultiAgent] Agent 2 klar: ${extractedData.supplier} - ${extractedData.totalAmount} SEK`);
  } catch (error) {
    console.error('[MultiAgent] Agent 2 fel:', error);
    extractedData = {
      supplier: 'Okänd',
      documentNumber: `AUTO-${Date.now()}`,
      documentDate: new Date().toISOString().split('T')[0],
      currency: 'SEK',
      totalAmount: 0,
      lineItems: [],
      rawTextSummary: 'Kunde inte extrahera data',
      extractionConfidence: 0.3,
    };
    agentSteps.push({
      agent: 'Extraherare',
      status: 'failed',
      duration: Date.now() - extractStart,
      message: 'Kunde inte extrahera data',
    });
  }

  // ========== AGENT 3: Fortnox-mappning ==========
  let fortnoxMapping: FortnoxMapping;
  const mapStart = Date.now();
  
  try {
    console.log('[MultiAgent] Agent 3: Mappar till Fortnox-konton...');
    fortnoxMapping = await mapToFortnox(classification.documentType, extractedData);
    
    agentSteps.push({
      agent: 'Fortnox-mapper',
      status: fortnoxMapping.overallConfidence > 0.7 ? 'success' : 'partial',
      duration: Date.now() - mapStart,
      message: `${fortnoxMapping.voucherLines.length} konteringsrader`,
    });
    
    console.log(`[MultiAgent] Agent 3 klar: ${fortnoxMapping.voucherLines.length} rader, ${fortnoxMapping.warnings.length} varningar`);
  } catch (error) {
    console.error('[MultiAgent] Agent 3 fel:', error);
    fortnoxMapping = {
      documentType: classification.documentType,
      voucherType: 'JOURNAL',
      voucherDate: extractedData.documentDate,
      voucherText: 'Manuell granskning krävs',
      voucherLines: [],
      lineItemMappings: [],
      suggestedCostCenter: null,
      overallConfidence: 0.3,
      warnings: ['Automatisk kontomappning misslyckades'],
      requiresReview: true,
    };
    agentSteps.push({
      agent: 'Fortnox-mapper',
      status: 'failed',
      duration: Date.now() - mapStart,
      message: 'Kunde inte mappa till konton',
    });
  }

  return {
    classification,
    extractedData,
    fortnoxMapping,
    processingTime: Date.now() - startTime,
    agentSteps,
  };
}

