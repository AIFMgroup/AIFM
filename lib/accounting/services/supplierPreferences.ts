/**
 * Supplier Preferences Service
 * 
 * Sparar och hämtar användares kontoval per leverantör.
 * Lär sig från godkända bokningar för att ge bättre förslag.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export interface SupplierPreference {
  supplierId: string;
  supplierName: string;
  normalizedName: string;
  defaultAccount: string;
  defaultAccountName: string;
  defaultCostCenter: string | null;
  usageCount: number;
  lastUsed: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normaliserar leverantörsnamn för matchning
 */
function normalizeSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-zåäö0-9]/g, '')
    .trim();
}

/**
 * Genererar ett unikt ID för leverantören
 */
function generateSupplierId(normalizedName: string): string {
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    const char = normalizedName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `supplier-${Math.abs(hash).toString(36)}`;
}

/**
 * Hämta leverantörspreferens för ett företag
 */
export async function getSupplierPreference(
  companyId: string,
  supplierName: string
): Promise<SupplierPreference | null> {
  const normalizedName = normalizeSupplierName(supplierName);
  const supplierId = generateSupplierId(normalizedName);

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `SUPPLIER_PREF#${companyId}`,
        sk: supplierId,
      },
    }));

    if (result.Item) {
      return result.Item as SupplierPreference;
    }

    // Försök fuzzy match om exakt match misslyckas
    return await findSimilarSupplierPreference(companyId, normalizedName);
  } catch (error) {
    console.error('[SupplierPreferences] Get error:', error);
    return null;
  }
}

/**
 * Hitta liknande leverantör med fuzzy matching
 */
async function findSimilarSupplierPreference(
  companyId: string,
  normalizedName: string
): Promise<SupplierPreference | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUPPLIER_PREF#${companyId}`,
      },
      Limit: 100,
    }));

    const preferences = (result.Items || []) as SupplierPreference[];
    
    // Hitta bästa fuzzy match
    for (const pref of preferences) {
      const similarity = calculateSimilarity(normalizedName, pref.normalizedName);
      if (similarity > 0.8) {
        return pref;
      }
    }

    return null;
  } catch (error) {
    console.error('[SupplierPreferences] Fuzzy search error:', error);
    return null;
  }
}

/**
 * Spara/uppdatera leverantörspreferens
 */
export async function saveSupplierPreference(
  companyId: string,
  supplierName: string,
  account: string,
  accountName: string,
  costCenter: string | null
): Promise<void> {
  const normalizedName = normalizeSupplierName(supplierName);
  const supplierId = generateSupplierId(normalizedName);
  const now = new Date().toISOString();

  try {
    // Kolla om den redan finns
    const existing = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `SUPPLIER_PREF#${companyId}`,
        sk: supplierId,
      },
    }));

    if (existing.Item) {
      // Uppdatera befintlig
      const pref = existing.Item as SupplierPreference;
      const newCount = pref.usageCount + 1;
      
      // Om samma konto används igen, öka confidence
      const sameAccount = pref.defaultAccount === account;
      const newConfidence = sameAccount 
        ? Math.min(0.99, pref.confidence + 0.05)
        : 0.7; // Reset om nytt konto väljs

      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `SUPPLIER_PREF#${companyId}`,
          sk: supplierId,
          supplierId,
          supplierName: pref.supplierName, // Behåll originalet
          normalizedName,
          defaultAccount: account,
          defaultAccountName: accountName,
          defaultCostCenter: costCenter,
          usageCount: newCount,
          lastUsed: now,
          confidence: newConfidence,
          createdAt: pref.createdAt,
          updatedAt: now,
        },
      }));
    } else {
      // Skapa ny
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `SUPPLIER_PREF#${companyId}`,
          sk: supplierId,
          supplierId,
          supplierName,
          normalizedName,
          defaultAccount: account,
          defaultAccountName: accountName,
          defaultCostCenter: costCenter,
          usageCount: 1,
          lastUsed: now,
          confidence: 0.7, // Startconfidence
          createdAt: now,
          updatedAt: now,
        },
      }));
    }

    console.log(`[SupplierPreferences] Saved: ${supplierName} → ${account}`);
  } catch (error) {
    console.error('[SupplierPreferences] Save error:', error);
  }
}

/**
 * Hämta alla leverantörspreferenser för ett företag
 */
export async function getAllSupplierPreferences(
  companyId: string
): Promise<SupplierPreference[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUPPLIER_PREF#${companyId}`,
      },
    }));

    return (result.Items || []) as SupplierPreference[];
  } catch (error) {
    console.error('[SupplierPreferences] GetAll error:', error);
    return [];
  }
}

/**
 * Beräkna likhet mellan två strängar (Levenshtein-baserad)
 */
function calculateSimilarity(s1: string, s2: string): number {
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















