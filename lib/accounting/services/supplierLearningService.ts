/**
 * Supplier Learning Service
 * 
 * Intelligent leverantörsinlärning som:
 * - Kommer ihåg konteringsval per leverantör
 * - Lär sig från korrigeringar
 * - Föreslår konto baserat på historik
 * - Hanterar leverantörsaliaser och variationer
 * - Kategoriserar leverantörer automatiskt
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  QueryCommand,
  UpdateCommand,
  GetCommand 
} from '@aws-sdk/lib-dynamodb';
import { allaKonton, findKontoByNummer } from '../basKontoplan';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = process.env.AIFM_SUPPLIER_LEARNING_TABLE || 'aifm-supplier-learning';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============ Types ============

export interface SupplierLearningProfile {
  id: string;
  companyId: string;
  
  // Leverantörsidentifiering
  supplierName: string;
  normalizedName: string;
  aliases: string[]; // Alternativa namn/stavningar
  orgNumber?: string;
  
  // Kategori
  category: SupplierCategory;
  subcategory?: string;
  
  // Standardkontering
  defaultAccount: string;
  defaultAccountName: string;
  defaultVatCode: '25' | '12' | '6' | '0' | 'none';
  defaultCostCenter?: string;
  defaultProject?: string;
  
  // Konteringshistorik
  accountHistory: AccountHistoryEntry[];
  
  // Mönster
  patterns: {
    typicalAmount: {
      min: number;
      max: number;
      average: number;
    };
    typicalPaymentTerms: number; // days
    invoiceFrequency: 'monthly' | 'quarterly' | 'annual' | 'irregular';
    seasonalPattern?: number[]; // Which months
  };
  
  // Inlärningsdata
  learningStats: {
    totalTransactions: number;
    correctPredictions: number;
    corrections: number;
    lastCorrectionAt?: string;
    confidenceScore: number; // 0-1
  };
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastTransactionAt: string;
}

export interface AccountHistoryEntry {
  account: string;
  accountName: string;
  count: number;
  totalAmount: number;
  lastUsed: string;
  vatCode?: string;
  costCenter?: string;
  wasCorrection: boolean;
}

export type SupplierCategory = 
  | 'OFFICE_SUPPLIES'      // Kontorsmaterial
  | 'IT_SERVICES'          // IT & Programvara
  | 'PROFESSIONAL_SERVICES'// Konsulter, juridik
  | 'RENT_FACILITIES'      // Lokaler, hyra
  | 'UTILITIES'            // El, vatten, värme
  | 'TELECOM'              // Telefoni, internet
  | 'TRAVEL'               // Resor, hotell
  | 'MARKETING'            // Marknadsföring
  | 'INSURANCE'            // Försäkringar
  | 'BANK_FINANCE'         // Bank, finans
  | 'PERSONNEL'            // Personal, utbildning
  | 'EQUIPMENT'            // Inventarier, maskiner
  | 'RAW_MATERIALS'        // Råvaror, material
  | 'SUBSCRIPTIONS'        // Prenumerationer
  | 'OTHER';

export interface AccountSuggestion {
  account: string;
  accountName: string;
  confidence: number;
  source: 'supplier_history' | 'category_default' | 'ai_prediction' | 'similar_supplier';
  vatCode?: string;
  costCenter?: string;
  reasoning: string;
  alternativeAccounts?: {
    account: string;
    accountName: string;
    probability: number;
  }[];
}

export interface LearningFeedback {
  type: 'approve' | 'correct';
  originalAccount?: string;
  correctedAccount: string;
  correctedAccountName: string;
  correctedVatCode?: string;
  correctedCostCenter?: string;
  reason?: string;
}

// ============ Category Mappings ============

const CATEGORY_DEFAULT_ACCOUNTS: Record<SupplierCategory, { account: string; vatCode: string }> = {
  OFFICE_SUPPLIES: { account: '6110', vatCode: '25' },
  IT_SERVICES: { account: '6540', vatCode: '25' },
  PROFESSIONAL_SERVICES: { account: '6550', vatCode: '25' },
  RENT_FACILITIES: { account: '5010', vatCode: '0' },
  UTILITIES: { account: '5020', vatCode: '25' },
  TELECOM: { account: '6211', vatCode: '25' },
  TRAVEL: { account: '5800', vatCode: '25' },
  MARKETING: { account: '5910', vatCode: '25' },
  INSURANCE: { account: '6310', vatCode: '0' },
  BANK_FINANCE: { account: '6570', vatCode: '0' },
  PERSONNEL: { account: '7690', vatCode: '25' },
  EQUIPMENT: { account: '5410', vatCode: '25' },
  RAW_MATERIALS: { account: '4010', vatCode: '25' },
  SUBSCRIPTIONS: { account: '6993', vatCode: '25' },
  OTHER: { account: '6993', vatCode: '25' },
};

const SUPPLIER_CATEGORY_KEYWORDS: Record<string, SupplierCategory> = {
  // IT & Software
  'microsoft': 'IT_SERVICES',
  'google': 'IT_SERVICES',
  'amazon web': 'IT_SERVICES',
  'aws': 'IT_SERVICES',
  'adobe': 'IT_SERVICES',
  'github': 'IT_SERVICES',
  'slack': 'IT_SERVICES',
  'zoom': 'IT_SERVICES',
  'dropbox': 'IT_SERVICES',
  'apple': 'IT_SERVICES',
  'software': 'IT_SERVICES',
  'it-': 'IT_SERVICES',
  'data': 'IT_SERVICES',
  
  // Office
  'office depot': 'OFFICE_SUPPLIES',
  'staples': 'OFFICE_SUPPLIES',
  'lyreco': 'OFFICE_SUPPLIES',
  'kontorsmaterial': 'OFFICE_SUPPLIES',
  
  // Telecom
  'telia': 'TELECOM',
  'tele2': 'TELECOM',
  'tre': 'TELECOM',
  'telenor': 'TELECOM',
  'comviq': 'TELECOM',
  
  // Utilities
  'vattenfall': 'UTILITIES',
  'ellevio': 'UTILITIES',
  'fortum': 'UTILITIES',
  'eon': 'UTILITIES',
  'stockholm exergi': 'UTILITIES',
  
  // Travel
  'sas': 'TRAVEL',
  'norwegian': 'TRAVEL',
  'sj': 'TRAVEL',
  'taxi': 'TRAVEL',
  'uber': 'TRAVEL',
  'bolt': 'TRAVEL',
  'hotel': 'TRAVEL',
  'scandic': 'TRAVEL',
  'nordic choice': 'TRAVEL',
  
  // Insurance
  'if försäkring': 'INSURANCE',
  'trygg-hansa': 'INSURANCE',
  'länsförsäkring': 'INSURANCE',
  'folksam': 'INSURANCE',
  
  // Bank
  'nordea': 'BANK_FINANCE',
  'handelsbanken': 'BANK_FINANCE',
  'seb': 'BANK_FINANCE',
  'swedbank': 'BANK_FINANCE',
  'danske bank': 'BANK_FINANCE',
  
  // Marketing
  'facebook': 'MARKETING',
  'instagram': 'MARKETING',
  'linkedin': 'MARKETING',
  'reklam': 'MARKETING',
  'media': 'MARKETING',
  'annons': 'MARKETING',
  
  // Professional Services
  'advokatbyrå': 'PROFESSIONAL_SERVICES',
  'revision': 'PROFESSIONAL_SERVICES',
  'konsult': 'PROFESSIONAL_SERVICES',
  'deloitte': 'PROFESSIONAL_SERVICES',
  'pwc': 'PROFESSIONAL_SERVICES',
  'kpmg': 'PROFESSIONAL_SERVICES',
  'ey': 'PROFESSIONAL_SERVICES',
  'grant thornton': 'PROFESSIONAL_SERVICES',
};

// ============ Main Functions ============

/**
 * Hämta kontoförslag för en leverantör
 */
export async function getAccountSuggestion(
  companyId: string,
  supplierName: string,
  amount?: number,
  description?: string
): Promise<AccountSuggestion> {
  const normalizedName = normalizeSupplierName(supplierName);
  
  // 1. Försök hitta exakt leverantörsprofil
  const profile = await getSupplierProfile(companyId, normalizedName);
  
  if (profile && profile.learningStats.confidenceScore >= 0.7) {
    const alternatives = profile.accountHistory
      .filter(h => h.account !== profile.defaultAccount)
      .slice(0, 3)
      .map(h => ({
        account: h.account,
        accountName: h.accountName,
        probability: h.count / profile.learningStats.totalTransactions,
      }));
    
    return {
      account: profile.defaultAccount,
      accountName: profile.defaultAccountName,
      confidence: profile.learningStats.confidenceScore,
      source: 'supplier_history',
      vatCode: profile.defaultVatCode,
      costCenter: profile.defaultCostCenter,
      reasoning: `Baserat på ${profile.learningStats.totalTransactions} tidigare transaktioner med denna leverantör`,
      alternativeAccounts: alternatives,
    };
  }
  
  // 2. Försök hitta liknande leverantör
  const similarProfile = await findSimilarSupplier(companyId, normalizedName);
  if (similarProfile && similarProfile.learningStats.confidenceScore >= 0.6) {
    return {
      account: similarProfile.defaultAccount,
      accountName: similarProfile.defaultAccountName,
      confidence: similarProfile.learningStats.confidenceScore * 0.8,
      source: 'similar_supplier',
      vatCode: similarProfile.defaultVatCode,
      costCenter: similarProfile.defaultCostCenter,
      reasoning: `Baserat på liknande leverantör: ${similarProfile.supplierName}`,
    };
  }
  
  // 3. Använd kategoribaserat default
  const category = detectSupplierCategory(supplierName, description);
  const categoryDefault = CATEGORY_DEFAULT_ACCOUNTS[category];
  const kontoInfo = findKontoByNummer(categoryDefault.account);
  
  return {
    account: categoryDefault.account,
    accountName: kontoInfo?.namn || `Konto ${categoryDefault.account}`,
    confidence: 0.5,
    source: 'category_default',
    vatCode: categoryDefault.vatCode as AccountSuggestion['vatCode'],
    reasoning: `Standardkonto för kategori: ${getCategoryDisplayName(category)}`,
  };
}

/**
 * Registrera en transaktion och uppdatera leverantörsprofilen
 */
export async function recordTransaction(
  companyId: string,
  supplierName: string,
  account: string,
  accountName: string,
  amount: number,
  options?: {
    vatCode?: string;
    costCenter?: string;
    orgNumber?: string;
    wasCorrection?: boolean;
    originalAccount?: string;
  }
): Promise<void> {
  const normalizedName = normalizeSupplierName(supplierName);
  const now = new Date().toISOString();
  
  // Hämta eller skapa profil
  const profile = await getSupplierProfile(companyId, normalizedName);
  
  if (profile) {
    // Uppdatera befintlig profil
    await updateSupplierProfile(companyId, profile, {
      account,
      accountName,
      amount,
      vatCode: options?.vatCode,
      costCenter: options?.costCenter,
      wasCorrection: options?.wasCorrection || false,
    });
    
    // Om det var en korrigering, minska confidence
    if (options?.wasCorrection) {
      await recordCorrection(companyId, normalizedName, options.originalAccount || '', account, accountName);
    }
  } else {
    // Skapa ny profil
    const category = detectSupplierCategory(supplierName);
    
    const newProfile: SupplierLearningProfile = {
      id: `supplier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      companyId,
      supplierName,
      normalizedName,
      aliases: [],
      orgNumber: options?.orgNumber,
      category,
      defaultAccount: account,
      defaultAccountName: accountName,
      defaultVatCode: (options?.vatCode as SupplierLearningProfile['defaultVatCode']) || '25',
      defaultCostCenter: options?.costCenter,
      accountHistory: [{
        account,
        accountName,
        count: 1,
        totalAmount: amount,
        lastUsed: now,
        vatCode: options?.vatCode,
        costCenter: options?.costCenter,
        wasCorrection: options?.wasCorrection || false,
      }],
      patterns: {
        typicalAmount: { min: amount, max: amount, average: amount },
        typicalPaymentTerms: 30,
        invoiceFrequency: 'irregular',
      },
      learningStats: {
        totalTransactions: 1,
        correctPredictions: options?.wasCorrection ? 0 : 1,
        corrections: options?.wasCorrection ? 1 : 0,
        confidenceScore: options?.wasCorrection ? 0.3 : 0.5,
        lastCorrectionAt: options?.wasCorrection ? now : undefined,
      },
      createdAt: now,
      updatedAt: now,
      lastTransactionAt: now,
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `COMPANY#${companyId}`,
        sk: `SUPPLIER#${normalizedName}`,
        ...newProfile,
      },
    }));
    
    console.log(`[SupplierLearning] Created profile for: ${supplierName}`);
  }
}

/**
 * Registrera en korrigering
 */
export async function recordCorrection(
  companyId: string,
  normalizedName: string,
  originalAccount: string,
  correctedAccount: string,
  correctedAccountName: string
): Promise<void> {
  const now = new Date().toISOString();
  
  // Uppdatera profilstatistik
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `SUPPLIER#${normalizedName}` },
    UpdateExpression: `
      SET learningStats.corrections = learningStats.corrections + :inc,
          learningStats.lastCorrectionAt = :now,
          learningStats.confidenceScore = learningStats.confidenceScore * :decay,
          updatedAt = :now
    `,
    ExpressionAttributeValues: {
      ':inc': 1,
      ':now': now,
      ':decay': 0.9, // Minska confidence med 10% vid korrigering
    },
  }));
  
  // Logga korrigeringen för framtida analys
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `CORRECTION#${companyId}`,
      sk: `${now}#${normalizedName}`,
      normalizedName,
      originalAccount,
      correctedAccount,
      correctedAccountName,
      timestamp: now,
    },
  }));
  
  console.log(`[SupplierLearning] Recorded correction for ${normalizedName}: ${originalAccount} -> ${correctedAccount}`);
}

/**
 * Lägg till ett alias för en leverantör
 */
export async function addSupplierAlias(
  companyId: string,
  primaryName: string,
  aliasName: string
): Promise<void> {
  const normalizedPrimary = normalizeSupplierName(primaryName);
  const normalizedAlias = normalizeSupplierName(aliasName);
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `COMPANY#${companyId}`, sk: `SUPPLIER#${normalizedPrimary}` },
    UpdateExpression: 'SET aliases = list_append(if_not_exists(aliases, :empty), :alias), updatedAt = :now',
    ExpressionAttributeValues: {
      ':alias': [normalizedAlias],
      ':empty': [],
      ':now': new Date().toISOString(),
    },
  }));
  
  // Skapa alias-lookup
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `ALIAS#${normalizedAlias}`,
      targetSupplier: normalizedPrimary,
    },
  }));
}

/**
 * Hämta alla leverantörsprofiler för ett företag
 */
export async function getAllSupplierProfiles(
  companyId: string,
  options?: {
    category?: SupplierCategory;
    minTransactions?: number;
    sortBy?: 'transactions' | 'lastUsed' | 'name';
  }
): Promise<SupplierLearningProfile[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `COMPANY#${companyId}`,
        ':prefix': 'SUPPLIER#',
      },
    }));
    
    let profiles = (result.Items || []) as SupplierLearningProfile[];
    
    // Filtrera
    if (options?.category) {
      profiles = profiles.filter(p => p.category === options.category);
    }
    if (options?.minTransactions) {
      const minTx = options.minTransactions;
      profiles = profiles.filter(p => p.learningStats.totalTransactions >= minTx);
    }
    
    // Sortera
    switch (options?.sortBy) {
      case 'transactions':
        profiles.sort((a, b) => b.learningStats.totalTransactions - a.learningStats.totalTransactions);
        break;
      case 'lastUsed':
        profiles.sort((a, b) => b.lastTransactionAt.localeCompare(a.lastTransactionAt));
        break;
      case 'name':
        profiles.sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'sv'));
        break;
      default:
        profiles.sort((a, b) => b.learningStats.totalTransactions - a.learningStats.totalTransactions);
    }
    
    return profiles;
  } catch (error) {
    console.error('[SupplierLearning] Get all profiles error:', error);
    return [];
  }
}

/**
 * Hämta leverantörsstatistik
 */
export async function getSupplierStats(companyId: string): Promise<{
  totalSuppliers: number;
  topSuppliersByVolume: { name: string; transactions: number; totalAmount: number }[];
  categoryBreakdown: { category: SupplierCategory; count: number; totalAmount: number }[];
  learningAccuracy: number;
}> {
  const profiles = await getAllSupplierProfiles(companyId);
  
  const topSuppliers = profiles
    .sort((a, b) => b.learningStats.totalTransactions - a.learningStats.totalTransactions)
    .slice(0, 10)
    .map(p => ({
      name: p.supplierName,
      transactions: p.learningStats.totalTransactions,
      totalAmount: p.accountHistory.reduce((sum, h) => sum + h.totalAmount, 0),
    }));
  
  const categoryMap = new Map<SupplierCategory, { count: number; totalAmount: number }>();
  for (const profile of profiles) {
    const existing = categoryMap.get(profile.category) || { count: 0, totalAmount: 0 };
    existing.count++;
    existing.totalAmount += profile.accountHistory.reduce((sum, h) => sum + h.totalAmount, 0);
    categoryMap.set(profile.category, existing);
  }
  
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
  
  const totalTransactions = profiles.reduce((sum, p) => sum + p.learningStats.totalTransactions, 0);
  const correctPredictions = profiles.reduce((sum, p) => sum + p.learningStats.correctPredictions, 0);
  const learningAccuracy = totalTransactions > 0 ? correctPredictions / totalTransactions : 0;
  
  return {
    totalSuppliers: profiles.length,
    topSuppliersByVolume: topSuppliers,
    categoryBreakdown,
    learningAccuracy,
  };
}

// ============ Internal Functions ============

async function getSupplierProfile(
  companyId: string,
  normalizedName: string
): Promise<SupplierLearningProfile | null> {
  try {
    // Försök hitta direkt
    let result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `COMPANY#${companyId}`, sk: `SUPPLIER#${normalizedName}` },
    }));
    
    if (result.Item) {
      return result.Item as SupplierLearningProfile;
    }
    
    // Kolla om det är ett alias
    const aliasResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `COMPANY#${companyId}`, sk: `ALIAS#${normalizedName}` },
    }));
    
    if (aliasResult.Item?.targetSupplier) {
      result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `COMPANY#${companyId}`, sk: `SUPPLIER#${aliasResult.Item.targetSupplier}` },
      }));
      return result.Item as SupplierLearningProfile || null;
    }
    
    return null;
  } catch (error) {
    console.error('[SupplierLearning] Get profile error:', error);
    return null;
  }
}

async function findSimilarSupplier(
  companyId: string,
  normalizedName: string
): Promise<SupplierLearningProfile | null> {
  try {
    const profiles = await getAllSupplierProfiles(companyId);
    
    // Hitta leverantör med liknande namn
    const nameParts = normalizedName.split(/\s+/).filter(p => p.length > 2);
    
    for (const profile of profiles) {
      const profileParts = profile.normalizedName.split(/\s+/);
      const matchingParts = nameParts.filter(p => profileParts.some(pp => pp.includes(p) || p.includes(pp)));
      
      if (matchingParts.length >= 2 || (matchingParts.length === 1 && matchingParts[0].length > 5)) {
        return profile;
      }
      
      // Kolla aliases också
      for (const alias of profile.aliases) {
        if (alias.includes(normalizedName) || normalizedName.includes(alias)) {
          return profile;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[SupplierLearning] Find similar error:', error);
    return null;
  }
}

async function updateSupplierProfile(
  companyId: string,
  profile: SupplierLearningProfile,
  transaction: {
    account: string;
    accountName: string;
    amount: number;
    vatCode?: string;
    costCenter?: string;
    wasCorrection: boolean;
  }
): Promise<void> {
  const now = new Date().toISOString();
  
  // Uppdatera kontohistorik
  const existingIndex = profile.accountHistory.findIndex(h => h.account === transaction.account);
  
  if (existingIndex >= 0) {
    profile.accountHistory[existingIndex].count++;
    profile.accountHistory[existingIndex].totalAmount += transaction.amount;
    profile.accountHistory[existingIndex].lastUsed = now;
  } else {
    profile.accountHistory.push({
      account: transaction.account,
      accountName: transaction.accountName,
      count: 1,
      totalAmount: transaction.amount,
      lastUsed: now,
      vatCode: transaction.vatCode,
      costCenter: transaction.costCenter,
      wasCorrection: transaction.wasCorrection,
    });
  }
  
  // Sortera efter count och uppdatera default
  profile.accountHistory.sort((a, b) => b.count - a.count);
  profile.defaultAccount = profile.accountHistory[0].account;
  profile.defaultAccountName = profile.accountHistory[0].accountName;
  
  // Uppdatera statistik
  profile.learningStats.totalTransactions++;
  if (!transaction.wasCorrection) {
    profile.learningStats.correctPredictions++;
    // Öka confidence vid korrekt prediktion (max 0.95)
    profile.learningStats.confidenceScore = Math.min(0.95, profile.learningStats.confidenceScore + 0.02);
  }
  
  // Uppdatera beloppsmönster
  const amounts = profile.accountHistory.map(h => h.totalAmount / h.count);
  profile.patterns.typicalAmount = {
    min: Math.min(...amounts),
    max: Math.max(...amounts),
    average: amounts.reduce((a, b) => a + b, 0) / amounts.length,
  };
  
  profile.updatedAt = now;
  profile.lastTransactionAt = now;
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      pk: `COMPANY#${companyId}`,
      sk: `SUPPLIER#${profile.normalizedName}`,
      ...profile,
    },
  }));
}

function normalizeSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bab\b|\baktiebolag\b|\bhandelsbolag\b|\bhb\b|\bkb\b|\binc\b|\bltd\b|\bgmbh\b/gi, '')
    .replace(/[^a-zåäö0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSupplierCategory(supplierName: string, description?: string): SupplierCategory {
  const searchText = `${supplierName} ${description || ''}`.toLowerCase();
  
  for (const [keyword, category] of Object.entries(SUPPLIER_CATEGORY_KEYWORDS)) {
    if (searchText.includes(keyword)) {
      return category;
    }
  }
  
  return 'OTHER';
}

function getCategoryDisplayName(category: SupplierCategory): string {
  const names: Record<SupplierCategory, string> = {
    OFFICE_SUPPLIES: 'Kontorsmaterial',
    IT_SERVICES: 'IT & Programvara',
    PROFESSIONAL_SERVICES: 'Konsulter & Tjänster',
    RENT_FACILITIES: 'Lokaler & Hyra',
    UTILITIES: 'El, Vatten & Värme',
    TELECOM: 'Telefoni & Internet',
    TRAVEL: 'Resor & Transport',
    MARKETING: 'Marknadsföring',
    INSURANCE: 'Försäkringar',
    BANK_FINANCE: 'Bank & Finans',
    PERSONNEL: 'Personal',
    EQUIPMENT: 'Inventarier',
    RAW_MATERIALS: 'Råvaror & Material',
    SUBSCRIPTIONS: 'Prenumerationer',
    OTHER: 'Övrigt',
  };
  return names[category];
}

export { getCategoryDisplayName };

