/**
 * Compliance Policy Engine - DEMO MODE
 * Uses rule-based checks only (no AI)
 * Replace with OpenAI integration when going to production
 */

import { prisma } from '@/lib/prisma';

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  requirement: string;
  checkType: 'text_match' | 'date' | 'presence' | 'ai_analysis';
  pattern?: string;
  validator?: (document: any) => boolean;
}

export interface ComplianceCheckResult {
  policyId: string;
  policyName: string;
  requirement: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | 'PENDING';
  score: number;
  evidence?: string[];
  gaps?: string[];
  notes?: string;
}

/**
 * Check document compliance against a policy (wrapper for checkCompliance)
 */
export async function checkDocumentCompliance(
  documentId: string,
  policyId?: string
): Promise<void> {
  if (policyId) {
    await checkCompliance(documentId, policyId);
  } else {
    await checkAllPolicies(documentId);
  }
}

/**
 * Check document compliance against a policy
 */
export async function checkCompliance(
  documentId: string,
  policyId: string
): Promise<ComplianceCheckResult> {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        complianceChecks: {
          where: { policyId },
        },
      },
    });

    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const rules = policy.rules as any as PolicyRule[];

    if (!Array.isArray(rules) || rules.length === 0) {
      return {
        policyId,
        policyName: policy.name,
        requirement: 'No rules defined',
        status: 'PENDING',
        score: 0,
      };
    }

    const checkResults: ComplianceCheckResult[] = [];

    for (const rule of rules) {
      const result = await checkRule(document, rule);
      checkResults.push({
        policyId,
        policyName: policy.name,
        requirement: rule.name,
        ...result,
      });
    }

    const overallScore =
      checkResults.reduce((sum, r) => sum + r.score, 0) / checkResults.length;
    const allCompliant = checkResults.every(r => r.status === 'COMPLIANT');
    const anyNonCompliant = checkResults.some(r => r.status === 'NON_COMPLIANT');

    let overallStatus: ComplianceCheckResult['status'];
    if (allCompliant) {
      overallStatus = 'COMPLIANT';
    } else if (anyNonCompliant) {
      overallStatus = 'NON_COMPLIANT';
    } else {
      overallStatus = 'NEEDS_REVIEW';
    }

    const gaps = checkResults
      .filter(r => r.gaps && r.gaps.length > 0)
      .flatMap(r => r.gaps || []);

    const evidence = checkResults
      .filter(r => r.evidence && r.evidence.length > 0)
      .flatMap(r => r.evidence || []);

    return {
      policyId,
      policyName: policy.name,
      requirement: policy.description || 'Policy compliance check',
      status: overallStatus,
      score: overallScore,
      evidence,
      gaps,
      notes: `Checked ${checkResults.length} rules. ${allCompliant ? 'All compliant' : `${gaps.length} gaps found`}.`,
    };
  } catch (error: any) {
    console.error('Compliance check error:', error);
    return {
      policyId,
      policyName: 'Unknown',
      requirement: 'Error checking compliance',
      status: 'PENDING',
      score: 0,
      notes: error.message,
    };
  }
}

/**
 * Check a single rule against document
 */
async function checkRule(
  document: any,
  rule: PolicyRule
): Promise<Omit<ComplianceCheckResult, 'policyId' | 'policyName' | 'requirement'>> {
  const text = document.extractedText || '';

  switch (rule.checkType) {
    case 'text_match':
      return checkTextMatch(text, rule);

    case 'presence':
      return checkPresence(document, rule);

    case 'date':
      return checkDate(document, rule);

    case 'ai_analysis':
      // In demo mode, return needs_review for AI checks
      return {
        status: 'NEEDS_REVIEW',
        score: 0.5,
        notes: 'Demo-läge: AI-analys är inaktiverad. Aktivera OpenAI för full funktionalitet.',
      };

    default:
      return {
        status: 'NEEDS_REVIEW',
        score: 0.5,
        notes: `Unknown check type: ${rule.checkType}`,
      };
  }
}

/**
 * Check text match rule
 */
function checkTextMatch(text: string, rule: PolicyRule): Omit<ComplianceCheckResult, 'policyId' | 'policyName' | 'requirement'> {
  if (!rule.pattern) {
    return {
      status: 'NEEDS_REVIEW',
      score: 0.5,
      notes: 'No pattern defined for text match',
    };
  }

  const regex = new RegExp(rule.pattern, 'i');
  const matches = text.match(regex);

  if (matches) {
    return {
      status: 'COMPLIANT',
      score: 1.0,
      evidence: matches.slice(0, 3),
    };
  }

  return {
    status: 'NON_COMPLIANT',
    score: 0,
    gaps: [`Pattern "${rule.pattern}" not found in document`],
  };
}

/**
 * Check presence rule (check if certain fields exist)
 */
function checkPresence(document: any, rule: PolicyRule): Omit<ComplianceCheckResult, 'policyId' | 'policyName' | 'requirement'> {
  const requiredFields = rule.pattern ? rule.pattern.split(',') : [];

  const missingFields: string[] = [];
  const foundFields: string[] = [];

  for (const field of requiredFields) {
    const fieldPath = field.trim();
    const value = getNestedValue(document, fieldPath);

    if (value === null || value === undefined || value === '') {
      missingFields.push(fieldPath);
    } else {
      foundFields.push(fieldPath);
    }
  }

  if (missingFields.length === 0) {
    return {
      status: 'COMPLIANT',
      score: 1.0,
      evidence: foundFields,
    };
  }

  return {
    status: 'NON_COMPLIANT',
    score: foundFields.length / requiredFields.length,
    gaps: [`Missing fields: ${missingFields.join(', ')}`],
    evidence: foundFields,
  };
}

/**
 * Check date rule
 */
function checkDate(document: any, _rule: PolicyRule): Omit<ComplianceCheckResult, 'policyId' | 'policyName' | 'requirement'> {
  const hasPublishDate = !!document.publishDate;
  const hasEffectiveDate = !!document.effectiveDate;

  const now = new Date();
  const isExpired = document.expiryDate && new Date(document.expiryDate) < now;
  const isNotYetEffective = document.effectiveDate && new Date(document.effectiveDate) > now;

  if (isExpired) {
    return {
      status: 'NON_COMPLIANT',
      score: 0,
      gaps: ['Document has expired'],
    };
  }

  if (isNotYetEffective) {
    return {
      status: 'NEEDS_REVIEW',
      score: 0.5,
      notes: 'Document is not yet effective',
    };
  }

  if (hasPublishDate && hasEffectiveDate) {
    return {
      status: 'COMPLIANT',
      score: 1.0,
      evidence: ['Document has publish and effective dates'],
    };
  }

  return {
    status: 'NEEDS_REVIEW',
    score: 0.5,
    gaps: ['Missing required dates'],
  };
}

/**
 * Helper: Get nested value from object
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Check all policies for a document
 */
export async function checkAllPolicies(documentId: string): Promise<ComplianceCheckResult[]> {
  const policies = await prisma.policy.findMany({
    where: { isActive: true },
  });

  const results: ComplianceCheckResult[] = [];

  for (const policy of policies) {
    const result = await checkCompliance(documentId, policy.id);
    results.push(result);

    await prisma.complianceCheck.create({
      data: {
        documentId,
        policyId: policy.id,
        policyName: policy.name,
        requirement: result.requirement,
        status: result.status,
        result: result as any,
        notes: result.notes,
      },
    });
  }

  return results;
}

/**
 * Get compliance status for a document
 */
export async function getDocumentComplianceStatus(documentId: string): Promise<{
  overall: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | 'PENDING';
  score: number;
  checks: ComplianceCheckResult[];
  gaps: string[];
}> {
  const checks = await prisma.complianceCheck.findMany({
    where: { documentId },
    orderBy: { checkedAt: 'desc' },
  });

  if (checks.length === 0) {
    return {
      overall: 'PENDING',
      score: 0,
      checks: [],
      gaps: [],
    };
  }

  const checkResults = checks.map(c => c.result as any as ComplianceCheckResult);
  const overallScore = checkResults.reduce((sum, r) => sum + r.score, 0) / checkResults.length;
  const allCompliant = checkResults.every(r => r.status === 'COMPLIANT');
  const anyNonCompliant = checkResults.some(r => r.status === 'NON_COMPLIANT');

  let overall: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | 'PENDING';
  if (allCompliant) {
    overall = 'COMPLIANT';
  } else if (anyNonCompliant) {
    overall = 'NON_COMPLIANT';
  } else {
    overall = 'NEEDS_REVIEW';
  }

  const gaps = checkResults
    .filter(r => r.gaps && r.gaps.length > 0)
    .flatMap(r => r.gaps || []);

  return {
    overall,
    score: overallScore,
    checks: checkResults,
    gaps,
  };
}
