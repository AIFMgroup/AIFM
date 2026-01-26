/**
 * Feedback & Learning Service
 * 
 * Hanterar feedback från användare och lär AI:n över tid.
 * Bygger upp en kunskapsbas som förbättrar framtida klassificeringar.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand,
  GetCommand 
} from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { recordCorrection as recordSupplierCorrection } from './supplierMemory';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';
const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

// ============ Types ============

export interface FeedbackEntry {
  feedbackId: string;
  companyId: string;
  userId?: string;
  timestamp: string;
  
  // Kontext
  jobId?: string;
  documentName?: string;
  
  // Feedback
  feedbackType: 'correction' | 'question' | 'suggestion' | 'praise' | 'general';
  userMessage: string;
  aiResponse: string;
  
  // Korrigeringar
  correction?: {
    field: 'account' | 'supplier' | 'amount' | 'date' | 'docType' | 'other';
    originalValue: string;
    correctedValue: string;
  };
  
  // Lärande
  wasHelpful?: boolean;
  appliedToModel: boolean;
}

export interface LearningRule {
  ruleId: string;
  companyId: string;
  source: 'feedback' | 'correction' | 'manual';
  
  // Regel
  condition: {
    type: 'supplier' | 'keyword' | 'amount_range' | 'pattern';
    value: string;
  };
  action: {
    field: 'account' | 'costCenter' | 'docType' | 'supplier';
    value: string;
  };
  
  // Metadata
  confidence: number;
  usageCount: number;
  createdAt: string;
  lastUsedAt: string;
}

export interface ChatContext {
  jobId?: string;
  documentName?: string;
  currentClassification?: {
    supplier: string;
    account: string;
    amount: number;
  };
  feedbackType?: FeedbackEntry['feedbackType'];
}

export interface ChatResponse {
  message: string;
  suggestedAccount?: string;
  suggestedAction?: 'update_account' | 'update_supplier' | 'none';
  context?: Record<string, unknown>;
  learnedRule?: string;
}

// ============ Main Functions ============

/**
 * Processa ett feedback-meddelande och generera svar
 */
export async function processFeedback(
  companyId: string,
  userMessage: string,
  context: ChatContext,
  conversationHistory: { role: string; content: string }[]
): Promise<ChatResponse> {
  
  // 1. Analysera feedback för att extrahera eventuella korrigeringar
  const correction = extractCorrection(userMessage, context);
  
  // 2. Om det är en korrigering, spara den
  if (correction) {
    await saveCorrection(companyId, context, correction);
    
    // Uppdatera leverantörsminnet
    if (correction.field === 'account' && context.currentClassification?.supplier) {
      await recordSupplierCorrection(
        companyId,
        context.currentClassification.supplier,
        context.currentClassification.account,
        correction.correctedValue,
        getAccountName(correction.correctedValue)
      );
    }
  }
  
  // 3. Generera AI-svar
  const aiResponse = await generateResponse(companyId, userMessage, context, conversationHistory, correction);
  
  // 4. Spara feedbacken för framtida lärande
  await saveFeedback(companyId, userMessage, aiResponse, context, correction);
  
  return aiResponse;
}

/**
 * Hämta lärdomar för ett bolag
 */
export async function getLearningRules(companyId: string): Promise<LearningRule[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `LEARNING#${companyId}`,
      },
    }));
    
    return (result.Items || []) as LearningRule[];
  } catch (error) {
    console.error('[FeedbackLearning] Get rules error:', error);
    return [];
  }
}

/**
 * Hämta feedback-statistik
 */
export async function getFeedbackStats(companyId: string): Promise<{
  totalFeedback: number;
  corrections: number;
  positiveRate: number;
  topCorrections: { field: string; count: number }[];
}> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `FEEDBACK#${companyId}`,
      },
    }));
    
    const items = (result.Items || []) as FeedbackEntry[];
    const corrections = items.filter(i => i.feedbackType === 'correction');
    const positive = items.filter(i => i.feedbackType === 'praise' || i.wasHelpful);
    
    // Räkna korrigeringar per fält
    const correctionCounts: Record<string, number> = {};
    corrections.forEach(c => {
      if (c.correction?.field) {
        correctionCounts[c.correction.field] = (correctionCounts[c.correction.field] || 0) + 1;
      }
    });
    
    const topCorrections = Object.entries(correctionCounts)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalFeedback: items.length,
      corrections: corrections.length,
      positiveRate: items.length > 0 ? (positive.length / items.length) * 100 : 0,
      topCorrections,
    };
  } catch (error) {
    console.error('[FeedbackLearning] Get stats error:', error);
    return { totalFeedback: 0, corrections: 0, positiveRate: 0, topCorrections: [] };
  }
}

// ============ Internal Functions ============

function extractCorrection(
  message: string,
  context: ChatContext
): FeedbackEntry['correction'] | null {
  const lower = message.toLowerCase();
  
  // Konto-korrigering
  const accountMatch = message.match(/(?:konto|rätt konto|borde vara|ska vara)[:\s]*(\d{4})/i);
  if (accountMatch && context.currentClassification?.account) {
    return {
      field: 'account',
      originalValue: context.currentClassification.account,
      correctedValue: accountMatch[1],
    };
  }
  
  // Leverantör-korrigering
  const supplierMatch = message.match(/(?:leverantör|företag|ska heta)[:\s]*["']?([^"'\n,]+)["']?/i);
  if (supplierMatch && context.currentClassification?.supplier) {
    return {
      field: 'supplier',
      originalValue: context.currentClassification.supplier,
      correctedValue: supplierMatch[1].trim(),
    };
  }
  
  // Belopp-korrigering
  const amountMatch = message.match(/(?:belopp|summa|rätt belopp)[:\s]*([\d\s]+(?:[,.][\d]+)?)/i);
  if (amountMatch && context.currentClassification?.amount) {
    return {
      field: 'amount',
      originalValue: context.currentClassification.amount.toString(),
      correctedValue: amountMatch[1].replace(/\s/g, '').replace(',', '.'),
    };
  }
  
  return null;
}

async function generateResponse(
  companyId: string,
  userMessage: string,
  context: ChatContext,
  conversationHistory: { role: string; content: string }[],
  correction: FeedbackEntry['correction'] | null
): Promise<ChatResponse> {
  
  // Hämta lärdomar för kontextuellt svar
  const learningRules = await getLearningRules(companyId);
  
  const systemPrompt = `Du är en hjälpsam svensk bokföringsassistent. Du hjälper användare med bokföringsfrågor och lär dig av deras feedback.

DITT SYFTE:
1. Svara på bokföringsfrågor
2. Bekräfta korrigeringar och förklara varför de är rätt
3. Ge tips på hur man bokför olika typer av kostnader
4. Vara vänlig och pedagogisk

KONTEXT:
${context.documentName ? `Aktuellt dokument: ${context.documentName}` : 'Inget dokument öppet'}
${context.currentClassification ? `Nuvarande klassificering: ${context.currentClassification.supplier}, konto ${context.currentClassification.account}, ${context.currentClassification.amount} SEK` : ''}

${correction ? `KORRIGERING MOTTAGEN:
Fält: ${correction.field}
Ursprungligt: ${correction.originalValue}
Korrigerat: ${correction.correctedValue}

Bekräfta korrigeringen och förklara kort varför det nya värdet är korrekt.` : ''}

INLÄRDA REGLER FÖR DETTA BOLAG:
${learningRules.slice(0, 5).map(r => `- ${r.condition.value} → ${r.action.field}: ${r.action.value}`).join('\n') || 'Inga regler ännu'}

Svara kort och hjälpsamt (max 2-3 meningar). Om användaren korrigerar något, bekräfta och tacka.`;

  const messages = [
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  try {
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 300,
        system: systemPrompt,
        messages,
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiMessage = responseBody.content?.[0]?.text || 'Tack för din feedback! Jag har noterat det.';
    
    return {
      message: aiMessage,
      suggestedAccount: correction?.field === 'account' ? correction.correctedValue : undefined,
      suggestedAction: correction ? 'update_account' : 'none',
      learnedRule: correction ? `${correction.field}: ${correction.originalValue} → ${correction.correctedValue}` : undefined,
    };
    
  } catch (error) {
    console.error('[FeedbackLearning] Bedrock error:', error);
    
    // Fallback-svar
    if (correction) {
      return {
        message: `Tack! Jag har noterat att ${correction.field === 'account' ? 'rätt konto är' : 'det ska vara'} ${correction.correctedValue}. Jag kommer att komma ihåg det för framtida ${context.currentClassification?.supplier || 'liknande'}-fakturor.`,
        suggestedAccount: correction.field === 'account' ? correction.correctedValue : undefined,
        suggestedAction: 'update_account',
      };
    }
    
    return {
      message: 'Tack för din feedback! Jag har sparat den för att förbättra mina framtida klassificeringar.',
    };
  }
}

async function saveCorrection(
  companyId: string,
  context: ChatContext,
  correction: FeedbackEntry['correction']
): Promise<void> {
  if (!correction) return;
  
  const ruleId = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  // Skapa en lärdomsregel
  const rule: LearningRule = {
    ruleId,
    companyId,
    source: 'correction',
    condition: {
      type: correction.field === 'account' ? 'supplier' : 'keyword',
      value: context.currentClassification?.supplier || 'unknown',
    },
    action: {
      field: correction.field === 'account' ? 'account' : 'supplier',
      value: correction.correctedValue,
    },
    confidence: 0.9, // Hög confidence för manuella korrigeringar
    usageCount: 0,
    createdAt: now,
    lastUsedAt: now,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `LEARNING#${companyId}`,
      sk: ruleId,
      ...rule,
    },
  }));
  
  console.log(`[FeedbackLearning] Saved learning rule: ${context.currentClassification?.supplier} → ${correction.correctedValue}`);
}

async function saveFeedback(
  companyId: string,
  userMessage: string,
  aiResponse: ChatResponse,
  context: ChatContext,
  correction: FeedbackEntry['correction'] | null
): Promise<void> {
  const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const feedback: FeedbackEntry = {
    feedbackId,
    companyId,
    timestamp: now,
    jobId: context.jobId,
    documentName: context.documentName,
    feedbackType: context.feedbackType || (correction ? 'correction' : 'general'),
    userMessage,
    aiResponse: aiResponse.message,
    correction: correction || undefined,
    appliedToModel: !!correction,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `FEEDBACK#${companyId}`,
      sk: `${now}#${feedbackId}`,
      ...feedback,
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60), // 7 år (Bokföringslagen)
    },
  }));
}

function getAccountName(account: string): string {
  // Simplified - i produktion, hämta från basKontoplan
  const names: Record<string, string> = {
    '5010': 'Lokalkostnader',
    '5800': 'Resekostnader',
    '5831': 'Kost och logi',
    '5832': 'Representation',
    '6100': 'Kontorsmaterial',
    '6200': 'Telefon och internet',
    '6250': 'IT-tjänster',
    '6550': 'Konsultarvoden',
    '6570': 'Bankkostnader',
  };
  return names[account] || 'Okänt konto';
}

