/**
 * Accounting Policy Store (per company)
 *
 * Stores "bokföringspolicy per kund" in DynamoDB.
 * We keep it in the existing `aifm-accounting-jobs` table to avoid extra infra.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-accounting-jobs';

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type PolicyListMode = 'allow_all' | 'allow_list' | 'deny_list';

export interface AccountingPolicyApprovalRule {
  id: string;
  enabled: boolean;
  priority: number; // lower = higher priority
  when: {
    supplierPattern?: string; // regex (case-insensitive)
    minAmount?: number;
    maxAmount?: number;
    docTypes?: Array<'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'BANK' | 'OTHER'>;
    descriptionPattern?: string; // regex against line item descriptions
  };
  then: {
    action: 'AUTO_APPROVE' | 'REQUIRE_APPROVAL' | 'REJECT';
    reason: string;
  };
}

export interface AccountingPolicySupplierOverride {
  id: string;
  enabled: boolean;
  supplierPattern: string; // regex (case-insensitive)
  action: {
    forceAccount?: string; // 4-digit BAS account
    forceCostCenter?: string | null;
    note?: string;
  };
  approval?: {
    requireApproval?: boolean;
    autoApproveMaxAmount?: number;
  };
}

export interface AccountingPolicy {
  version: 1;
  companyId: string;

  /**
   * If true: out-of-policy suggestions are BLOCKED (never auto-approved, never sent to Fortnox).
   * If false: out-of-policy suggestions can be auto-corrected to the fallback (but still flagged).
   */
  strict: boolean;

  accounts: {
    mode: PolicyListMode;
    list?: string[]; // allow_list or deny_list
    fallbackAccount?: string; // used when strict=false and account is not allowed
  };

  costCenters: {
    mode: PolicyListMode;
    list?: string[]; // allow_list or deny_list
  };

  // Future: projects, VAT codes, attachments rules
  projects?: {
    mode: PolicyListMode;
    list?: string[];
  };

  supplierOverrides: AccountingPolicySupplierOverride[];
  approvalRules: AccountingPolicyApprovalRule[];

  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_ACCOUNTING_POLICY: Omit<AccountingPolicy, 'companyId'> = {
  version: 1,
  strict: true,
  accounts: {
    mode: 'allow_all',
  },
  costCenters: {
    mode: 'allow_all',
  },
  supplierOverrides: [],
  approvalRules: [],
};

function pk(companyId: string) {
  return `POLICY#${companyId}`;
}

export async function getAccountingPolicy(companyId: string): Promise<AccountingPolicy> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: pk(companyId), sk: 'ACCOUNTING_POLICY' },
      })
    );
    if (result.Item) return result.Item as AccountingPolicy;
  } catch (error) {
    console.error('[AccountingPolicyStore] get error:', error);
  }
  return { companyId, ...DEFAULT_ACCOUNTING_POLICY };
}

export async function saveAccountingPolicy(policy: AccountingPolicy): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: pk(policy.companyId),
        sk: 'ACCOUNTING_POLICY',
        ...policy,
        updatedAt: now,
      },
    })
  );
}


