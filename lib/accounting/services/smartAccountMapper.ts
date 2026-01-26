/**
 * Smart Account Mapper Service
 * 
 * Avancerad kontomappning med maskininlärning från tidigare transaktioner.
 * Lär sig från godkända bokningar och korrigeringar.
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getSupplierProfile, findSimilarSupplier, suggestAccountFromHistory } from './supplierMemory';
import { allaKonton, hittaBastaKonto, vanligaKostnadskonton } from '../basKontoplan';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const BEDROCK_REGION = 'eu-west-1';
const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });

export interface AccountPrediction {
  account: string;
  accountName: string;
  confidence: number;
  source: 'ml_model' | 'supplier_history' | 'category_rules' | 'amount_pattern' | 'ai_inference';
  reasoning: string;
  alternatives: {
    account: string;
    accountName: string;
    confidence: number;
    source: string;
  }[];
}

export interface TransactionPattern {
  patternId: string;
  companyId: string;
  patternType: 'supplier' | 'description' | 'amount' | 'date' | 'combined';
  pattern: string;
  account: string;
  accountName: string;
  usageCount: number;
  successRate: number;
  lastUsed: string;
  createdAt: string;
}

// Beloppsbaserade regler
const AMOUNT_PATTERNS: { min: number; max: number; account: string; description: string }[] = [
  { min: 0, max: 500, account: '6991', description: 'Småinköp' },
  { min: 50000, max: Infinity, account: '1220', description: 'Inventarier (över 50 000)' },
];

// Datum-/säsongsbaserade regler
const SEASONAL_PATTERNS: { 
  months: number[]; 
  keywords: string[]; 
  account: string; 
  description: string 
}[] = [
  { months: [11, 12], keywords: ['julbord', 'julfest', 'julklapp'], account: '6072', description: 'Representation (jul)' },
  { months: [4, 5], keywords: ['konferens', 'kickoff'], account: '6071', description: 'Representation (vår)' },
  { months: [8, 9], keywords: ['kickoff', 'teambuilding'], account: '6071', description: 'Representation (höst)' },
];

/**
 * Intelligent kontomappning med flera källor
 */
export async function predictAccount(
  companyId: string,
  transaction: {
    supplier: string;
    description: string;
    amount: number;
    date: string;
    lineItems?: { description: string; amount: number }[];
  }
): Promise<AccountPrediction> {
  const sources: AccountPrediction['alternatives'] = [];

  // 1. Leverantörshistorik (högsta prioritet)
  const supplierSuggestion = await suggestAccountFromHistory(companyId, transaction.supplier);
  if (supplierSuggestion) {
    sources.push({
      account: supplierSuggestion.account,
      accountName: supplierSuggestion.accountName,
      confidence: supplierSuggestion.confidence,
      source: 'supplier_history',
    });
  }

  // 2. Liknande leverantörer (fuzzy match)
  const similarSupplier = await findSimilarSupplier(companyId, transaction.supplier);
  if (similarSupplier && similarSupplier.supplierName !== transaction.supplier) {
    sources.push({
      account: similarSupplier.defaultAccount,
      accountName: similarSupplier.defaultAccountName,
      confidence: 0.75,
      source: 'supplier_history',
    });
  }

  // 3. Mönstermatchning från transaktionshistorik
  const patternMatch = await matchTransactionPattern(companyId, transaction);
  if (patternMatch) {
    sources.push({
      account: patternMatch.account,
      accountName: patternMatch.accountName,
      confidence: patternMatch.successRate * 0.9,
      source: 'ml_model',
    });
  }

  // 4. Beloppsbaserad mappning
  const amountMatch = matchAmountPattern(transaction.amount);
  if (amountMatch) {
    sources.push({
      account: amountMatch.account,
      accountName: amountMatch.description,
      confidence: 0.6,
      source: 'amount_pattern',
    });
  }

  // 5. Säsongsbaserad mappning
  const seasonMatch = matchSeasonalPattern(transaction.date, transaction.description);
  if (seasonMatch) {
    sources.push({
      account: seasonMatch.account,
      accountName: seasonMatch.description,
      confidence: 0.7,
      source: 'category_rules',
    });
  }

  // 6. Kategoribaserade regler (BAS-kontoplan)
  const categoryMatch = hittaBastaKonto(transaction.description);
  if (categoryMatch) {
    sources.push({
      account: categoryMatch.konto,
      accountName: categoryMatch.namn,
      confidence: 0.65,
      source: 'category_rules',
    });
  }

  // 7. AI-inferens som fallback
  if (sources.length === 0 || sources[0].confidence < 0.7) {
    const aiSuggestion = await getAISuggestion(companyId, transaction);
    if (aiSuggestion) {
      sources.push(aiSuggestion);
    }
  }

  // Sortera efter confidence
  sources.sort((a, b) => b.confidence - a.confidence);

  // Returnera bästa förslag
  if (sources.length === 0) {
    // Fallback till standard inköpskonto
    return {
      account: '4010',
      accountName: 'Inköp material och varor',
      confidence: 0.3,
      source: 'category_rules',
      reasoning: 'Ingen matchning hittades, använder standard inköpskonto',
      alternatives: [],
    };
  }

  const best = sources[0];
  return {
    account: best.account,
    accountName: best.accountName,
    confidence: best.confidence,
    source: best.source as AccountPrediction['source'],
    reasoning: generateReasoning(best, transaction),
    alternatives: sources.slice(1, 4), // Top 3 alternativ
  };
}

/**
 * Lär från godkänd bokning
 */
export async function learnFromApproval(
  companyId: string,
  transaction: {
    supplier: string;
    description: string;
    amount: number;
    date: string;
  },
  approvedAccount: string,
  approvedAccountName: string,
  wasCorrection: boolean
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Skapa/uppdatera mönster
  const patternId = generatePatternId(transaction);
  
  try {
    // Hämta befintligt mönster
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `PATTERN#${companyId}`,
        sk: patternId,
      },
    }));

    if (existing.Item) {
      // Uppdatera befintligt mönster
      const pattern = existing.Item as TransactionPattern;
      const newCount = pattern.usageCount + 1;
      const successBoost = wasCorrection ? 0 : 1;
      const newSuccessRate = (pattern.successRate * pattern.usageCount + successBoost) / newCount;

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `PATTERN#${companyId}`,
          sk: patternId,
          ...pattern,
          account: approvedAccount,
          accountName: approvedAccountName,
          usageCount: newCount,
          successRate: newSuccessRate,
          lastUsed: now,
        },
      }));
    } else {
      // Skapa nytt mönster
      const newPattern: TransactionPattern = {
        patternId,
        companyId,
        patternType: 'combined',
        pattern: normalizeDescription(transaction.description),
        account: approvedAccount,
        accountName: approvedAccountName,
        usageCount: 1,
        successRate: wasCorrection ? 0.5 : 1.0,
        lastUsed: now,
        createdAt: now,
      };

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `PATTERN#${companyId}`,
          sk: patternId,
          ...newPattern,
        },
      }));
    }

    console.log(`[SmartAccountMapper] Learned pattern: ${patternId} → ${approvedAccount}`);

  } catch (error) {
    console.error('[SmartAccountMapper] Learn error:', error);
  }
}

/**
 * Hämta statistik över träffsäkerhet
 */
export async function getAccuracyStats(companyId: string): Promise<{
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  topPatterns: TransactionPattern[];
}> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PATTERN#${companyId}`,
      },
      Limit: 100,
    }));

    const patterns = (result.Items || []) as TransactionPattern[];
    
    const totalPredictions = patterns.reduce((sum, p) => sum + p.usageCount, 0);
    const weightedSuccess = patterns.reduce((sum, p) => sum + p.successRate * p.usageCount, 0);
    const accuracy = totalPredictions > 0 ? weightedSuccess / totalPredictions : 0;

    // Sortera efter användning
    const topPatterns = [...patterns]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return {
      totalPredictions,
      correctPredictions: Math.round(weightedSuccess),
      accuracy: Math.round(accuracy * 100) / 100,
      topPatterns,
    };

  } catch (error) {
    console.error('[SmartAccountMapper] Stats error:', error);
    return {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      topPatterns: [],
    };
  }
}

// ============ Interna hjälpfunktioner ============

async function matchTransactionPattern(
  companyId: string,
  transaction: { description: string; amount: number }
): Promise<TransactionPattern | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: 'successRate >= :minRate',
      ExpressionAttributeValues: {
        ':pk': `PATTERN#${companyId}`,
        ':minRate': 0.6,
      },
      Limit: 50,
    }));

    const patterns = (result.Items || []) as TransactionPattern[];
    const normalizedDesc = normalizeDescription(transaction.description);

    // Hitta bästa matchande mönster
    for (const pattern of patterns) {
      if (normalizedDesc.includes(pattern.pattern) || pattern.pattern.includes(normalizedDesc)) {
        return pattern;
      }
      
      // Fuzzy match
      if (similarity(normalizedDesc, pattern.pattern) > 0.7) {
        return pattern;
      }
    }

    return null;

  } catch (error) {
    console.error('[SmartAccountMapper] Pattern match error:', error);
    return null;
  }
}

function matchAmountPattern(amount: number): { account: string; description: string } | null {
  for (const pattern of AMOUNT_PATTERNS) {
    if (amount >= pattern.min && amount < pattern.max) {
      return pattern;
    }
  }
  return null;
}

function matchSeasonalPattern(
  dateStr: string, 
  description: string
): { account: string; description: string } | null {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const normalizedDesc = description.toLowerCase();

  for (const pattern of SEASONAL_PATTERNS) {
    if (pattern.months.includes(month)) {
      for (const keyword of pattern.keywords) {
        if (normalizedDesc.includes(keyword)) {
          return pattern;
        }
      }
    }
  }

  return null;
}

async function getAISuggestion(
  companyId: string,
  transaction: { supplier: string; description: string; amount: number }
): Promise<AccountPrediction['alternatives'][0] | null> {
  try {
    const prompt = `Du är en svensk bokföringsexpert. Analysera följande transaktion och föreslå det mest lämpliga BAS-kontot.

Transaktion:
- Leverantör: ${transaction.supplier}
- Beskrivning: ${transaction.description}
- Belopp: ${transaction.amount} SEK

Vanliga kostnadskonton:
${vanligaKostnadskonton.map(k => `${k.konto} - ${k.namn}`).join('\n')}

Svara ENDAST med JSON:
{
  "account": "XXXX",
  "accountName": "Kontonamn",
  "confidence": 0.X,
  "reasoning": "Kort förklaring"
}`;

    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = responseBody.content?.[0]?.text || '';
    
    // Extrahera JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        account: parsed.account,
        accountName: parsed.accountName,
        confidence: Math.min(parsed.confidence, 0.85), // Cap AI confidence
        source: 'ai_inference',
      };
    }

    return null;

  } catch (error) {
    console.error('[SmartAccountMapper] AI suggestion error:', error);
    return null;
  }
}

function generatePatternId(transaction: { supplier: string; description: string }): string {
  const normalized = normalizeDescription(`${transaction.supplier} ${transaction.description}`);
  // Skapa enkel hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `pattern-${Math.abs(hash).toString(36)}`;
}

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100); // Begränsa längd
}

function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function generateReasoning(
  suggestion: AccountPrediction['alternatives'][0],
  transaction: { supplier: string; description: string }
): string {
  switch (suggestion.source) {
    case 'supplier_history':
      return `Baserat på tidigare bokningar för ${transaction.supplier}`;
    case 'ml_model':
      return `Mönstermatchning från liknande transaktioner`;
    case 'amount_pattern':
      return `Beloppsbaserad regel`;
    case 'category_rules':
      return `Kategorimatchning baserat på beskrivning`;
    case 'ai_inference':
      return `AI-analys av transaktionsdata`;
    default:
      return `Automatisk klassificering`;
  }
}


