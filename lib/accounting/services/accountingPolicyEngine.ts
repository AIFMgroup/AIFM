/**
 * Accounting Policy Engine
 *
 * Enforces "bokföringspolicy per kund" (guardrails):
 * - Allowed accounts / cost centers
 * - Supplier overrides (force account/cost center, require approval)
 * - Attestation rules (auto-approve / require approval / reject)
 *
 * Important: This layer is about *constraints*, not guessing.
 */

import type { Classification, LineItem } from '../jobStore';
import type { AccountingPolicy } from './accountingPolicyStore';
import { getAccountingPolicy } from './accountingPolicyStore';

export interface PolicyViolation {
  code: string;
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface PolicyEvaluation {
  classification: Classification;
  violations: PolicyViolation[];
  requiresApproval: boolean;
  reject: boolean;
  summary: string;
}

function normalizeSupplierName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function regexMatch(pattern: string, value: string): boolean {
  try {
    const re = new RegExp(pattern, 'i');
    return re.test(value);
  } catch {
    // Treat invalid regex as non-match (safer than throwing)
    return false;
  }
}

function isAllowed(mode: AccountingPolicy['accounts']['mode'], list: string[] | undefined, value: string): boolean {
  const arr = list || [];
  if (mode === 'allow_all') return true;
  if (mode === 'allow_list') return arr.includes(value);
  // deny_list
  return !arr.includes(value);
}

function pickFallbackAccount(policy: AccountingPolicy): string | undefined {
  if (policy.accounts.fallbackAccount) return policy.accounts.fallbackAccount;
  if (policy.accounts.mode === 'allow_list' && policy.accounts.list?.length) return policy.accounts.list[0];
  return undefined;
}

function applySupplierOverrides(
  policy: AccountingPolicy,
  classification: Classification,
  violations: PolicyViolation[]
): { forced: boolean; requiresApproval: boolean; summaryParts: string[] } {
  const supplier = normalizeSupplierName(classification.supplier);
  let forced = false;
  let requiresApproval = false;
  const summaryParts: string[] = [];

  for (const o of policy.supplierOverrides || []) {
    if (!o.enabled) continue;
    if (!regexMatch(o.supplierPattern, supplier)) continue;

    if (o.action.forceAccount) {
      for (const li of classification.lineItems) {
        li.suggestedAccount = o.action.forceAccount;
      }
      forced = true;
      summaryParts.push(`tvingade konto ${o.action.forceAccount}`);
    }

    if (o.action.forceCostCenter !== undefined) {
      for (const li of classification.lineItems) {
        li.suggestedCostCenter = o.action.forceCostCenter;
      }
      forced = true;
      summaryParts.push(`tvingade kostnadsställe ${o.action.forceCostCenter ?? '(tomt)'}`);
    }

    if (o.approval?.requireApproval) {
      requiresApproval = true;
      summaryParts.push('krävde attest');
    }

    if (o.action.note) {
      summaryParts.push(o.action.note);
    }
  }

  if (forced) {
    violations.push({
      code: 'POLICY_OVERRIDE_APPLIED',
      field: 'supplier',
      message: `Policy-override applicerad för leverantör "${classification.supplier}".`,
      severity: 'warning',
    });
  }

  return { forced, requiresApproval, summaryParts };
}

function applyApprovalRules(
  policy: AccountingPolicy,
  classification: Classification
): { requiresApproval: boolean; reject: boolean; summary?: string } {
  const rules = [...(policy.approvalRules || [])]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    const supplierOk = rule.when.supplierPattern
      ? regexMatch(rule.when.supplierPattern, normalizeSupplierName(classification.supplier))
      : true;

    const amountOk = (() => {
      const a = classification.totalAmount;
      if (rule.when.minAmount !== undefined && a < rule.when.minAmount) return false;
      if (rule.when.maxAmount !== undefined && a > rule.when.maxAmount) return false;
      return true;
    })();

    const docTypeOk = rule.when.docTypes?.length ? rule.when.docTypes.includes(classification.docType) : true;

    const descOk = rule.when.descriptionPattern
      ? classification.lineItems.some(li => regexMatch(rule.when.descriptionPattern!, li.description))
      : true;

    if (!(supplierOk && amountOk && docTypeOk && descOk)) continue;

    if (rule.then.action === 'REJECT') return { requiresApproval: false, reject: true, summary: rule.then.reason };
    if (rule.then.action === 'REQUIRE_APPROVAL') return { requiresApproval: true, reject: false, summary: rule.then.reason };
    if (rule.then.action === 'AUTO_APPROVE') return { requiresApproval: false, reject: false, summary: rule.then.reason };
  }

  return { requiresApproval: false, reject: false };
}

function enforceLineItems(
  policy: AccountingPolicy,
  lineItems: LineItem[],
  violations: PolicyViolation[]
): { blocked: boolean; summaryParts: string[] } {
  let blocked = false;
  const summaryParts: string[] = [];
  const fallbackAccount = pickFallbackAccount(policy);

  for (const li of lineItems) {
    // Accounts
    if (!isAllowed(policy.accounts.mode, policy.accounts.list, li.suggestedAccount)) {
      const msg = `Konto ${li.suggestedAccount} är inte tillåtet av bolagets policy.`;
      if (policy.strict) {
        blocked = true;
        violations.push({ code: 'ACCOUNT_NOT_ALLOWED', field: 'lineItems.suggestedAccount', message: msg, severity: 'error' });
      } else {
        if (fallbackAccount) {
          violations.push({ code: 'ACCOUNT_AUTO_CORRECTED', field: 'lineItems.suggestedAccount', message: `${msg} Bytte till ${fallbackAccount}.`, severity: 'warning' });
          li.suggestedAccount = fallbackAccount;
          summaryParts.push(`konto→${fallbackAccount}`);
        } else {
          blocked = true;
          violations.push({ code: 'ACCOUNT_NOT_ALLOWED', field: 'lineItems.suggestedAccount', message: msg, severity: 'error' });
        }
      }
    }

    // Cost centers (optional)
    if (li.suggestedCostCenter) {
      if (!isAllowed(policy.costCenters.mode, policy.costCenters.list, li.suggestedCostCenter)) {
        const msg = `Kostnadsställe ${li.suggestedCostCenter} är inte tillåtet av bolagets policy.`;
        blocked = blocked || policy.strict;
        violations.push({
          code: 'COSTCENTER_NOT_ALLOWED',
          field: 'lineItems.suggestedCostCenter',
          message: msg,
          severity: policy.strict ? 'error' : 'warning',
        });
        if (!policy.strict) {
          li.suggestedCostCenter = null;
          summaryParts.push('kostnadsställe→(tomt)');
        }
      }
    }
  }

  return { blocked, summaryParts };
}

/**
 * Evaluate and enforce policy on a classification (pure in/out).
 */
export function evaluateAccountingPolicy(
  policy: AccountingPolicy,
  classification: Classification
): PolicyEvaluation {
  const cloned: Classification = JSON.parse(JSON.stringify(classification));
  const violations: PolicyViolation[] = [];

  const overrideResult = applySupplierOverrides(policy, cloned, violations);
  const enforcement = enforceLineItems(policy, cloned.lineItems, violations);
  const approvalRuleResult = applyApprovalRules(policy, cloned);

  const requiresApproval = overrideResult.requiresApproval || approvalRuleResult.requiresApproval;
  const reject = approvalRuleResult.reject;

  const summaryParts = [
    ...overrideResult.summaryParts,
    ...enforcement.summaryParts,
    approvalRuleResult.summary ? `regel: ${approvalRuleResult.summary}` : null,
  ].filter(Boolean) as string[];

  const summary =
    reject ? 'Policy: avvisad' :
    enforcement.blocked ? 'Policy: blockerad (utanför policy)' :
    requiresApproval ? 'Policy: kräver attest' :
    summaryParts.length ? `Policy: ${summaryParts.join(', ')}` :
    'Policy: ok';

  const appliedAt = new Date().toISOString();
  cloned.policy = {
    appliedAt,
    requiresApproval,
    summary,
    violations: violations.map(v => ({ ...v })),
  };

  return {
    classification: cloned,
    violations,
    requiresApproval,
    reject,
    summary,
  };
}

/**
 * Convenience helper used by pipeline/API: loads policy and evaluates.
 */
export async function evaluateAccountingPolicyForCompany(
  companyId: string,
  classification: Classification
): Promise<{ policy: AccountingPolicy; evaluation: PolicyEvaluation }> {
  const policy = await getAccountingPolicy(companyId);
  const evaluation = evaluateAccountingPolicy(policy, classification);
  return { policy, evaluation };
}


