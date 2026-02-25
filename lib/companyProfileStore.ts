/**
 * Company Profile Store
 * DynamoDB CRUD for per-company AI context (brand voice, document style, templates)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.COMPANY_PROFILES_TABLE || 'aifm-company-profiles';

export interface CompanyProfile {
  companyId: string;
  companyName: string;
  legalName: string;
  orgNumber: string;
  brandVoice: string;
  brandColors: string;
  documentStyle: string;
  letterTemplate: string;
  reportTemplate: string;
  exclusionPolicy: string;
  investmentPhilosophy: string;
  regulatoryContext: string;
  keyClients: string;
  customInstructions: string;
  autoLearnedFacts: string[];
  updatedAt: string;
}

export interface UpdateCompanyProfileInput {
  companyName?: string;
  legalName?: string;
  orgNumber?: string;
  brandVoice?: string;
  brandColors?: string;
  documentStyle?: string;
  letterTemplate?: string;
  reportTemplate?: string;
  exclusionPolicy?: string;
  investmentPhilosophy?: string;
  regulatoryContext?: string;
  keyClients?: string;
  customInstructions?: string;
  autoLearnedFacts?: string[];
}

function defaultProfile(companyId: string): CompanyProfile {
  const now = new Date().toISOString();
  return {
    companyId,
    companyName: '',
    legalName: '',
    orgNumber: '',
    brandVoice: '',
    brandColors: '',
    documentStyle: '',
    letterTemplate: '',
    reportTemplate: '',
    exclusionPolicy: '',
    investmentPhilosophy: '',
    regulatoryContext: '',
    keyClients: '',
    customInstructions: '',
    autoLearnedFacts: [],
    updatedAt: now,
  };
}

/**
 * Get company profile by companyId. Returns null if not found.
 */
export async function getCompanyProfile(companyId: string): Promise<CompanyProfile | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { companyId },
    })
  );
  return (result.Item as CompanyProfile) ?? null;
}

/**
 * Create or replace a full company profile.
 */
export async function putCompanyProfile(profile: CompanyProfile): Promise<CompanyProfile> {
  const now = new Date().toISOString();
  const item: CompanyProfile = {
    ...profile,
    updatedAt: now,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return item;
}

/**
 * Update selected fields of a company profile. Creates profile with defaults if missing.
 */
export async function updateCompanyProfile(
  companyId: string,
  updates: UpdateCompanyProfileInput
): Promise<CompanyProfile> {
  const existing = await getCompanyProfile(companyId);
  const now = new Date().toISOString();
  const base = existing ?? defaultProfile(companyId);
  const updated: CompanyProfile = {
    ...base,
    ...updates,
    companyId,
    updatedAt: now,
  };
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: updated,
    })
  );
  return updated;
}

/**
 * Append one or more auto-learned facts and deduplicate by normalized text.
 */
export async function appendAutoLearnedFacts(
  companyId: string,
  newFacts: string[]
): Promise<CompanyProfile | null> {
  const profile = await getCompanyProfile(companyId);
  if (!profile) return null;
  const normalized = (s: string) => s.trim().toLowerCase();
  const existingSet = new Set(profile.autoLearnedFacts.map(normalized));
  const added = newFacts.filter((f) => f.trim() && !existingSet.has(normalized(f)));
  if (added.length === 0) return profile;
  const autoLearnedFacts = [...profile.autoLearnedFacts, ...added];
  return updateCompanyProfile(companyId, { autoLearnedFacts });
}

/**
 * Remove a single auto-learned fact by index.
 */
export async function removeAutoLearnedFact(
  companyId: string,
  index: number
): Promise<CompanyProfile | null> {
  const profile = await getCompanyProfile(companyId);
  if (!profile || index < 0 || index >= profile.autoLearnedFacts.length) return null;
  const autoLearnedFacts = profile.autoLearnedFacts.filter((_, i) => i !== index);
  return updateCompanyProfile(companyId, { autoLearnedFacts });
}
