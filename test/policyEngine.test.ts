import { describe, expect, test } from 'vitest';
import { evaluateAccountingPolicy } from '../lib/accounting/services/accountingPolicyEngine';
import type { AccountingPolicy } from '../lib/accounting/services/accountingPolicyStore';
import type { Classification } from '../lib/accounting/jobStore';

import policyAllowlist from './fixtures/policy_allowlist_it.json';
import invoiceSek from './fixtures/classification_sek_invoice.json';

describe('accountingPolicyEngine', () => {
  test('allows in-policy classification', () => {
    const policy = policyAllowlist as AccountingPolicy;
    const classification = invoiceSek as unknown as Classification;

    const result = evaluateAccountingPolicy(policy, classification);
    expect(result.reject).toBe(false);
    expect(result.violations.some(v => v.severity === 'error')).toBe(false);
    expect(result.summary).toContain('Policy:');
    expect(result.classification.policy?.summary).toBeDefined();
  });

  test('blocks out-of-policy account in strict mode', () => {
    const policy = policyAllowlist as AccountingPolicy;
    const classification = structuredClone(invoiceSek) as unknown as Classification;
    classification.lineItems[0].suggestedAccount = '6991'; // not allowed

    const result = evaluateAccountingPolicy(policy, classification);
    expect(result.reject).toBe(false);
    expect(result.violations.some(v => v.code === 'ACCOUNT_NOT_ALLOWED')).toBe(true);
    expect(result.violations.some(v => v.severity === 'error')).toBe(true);
    expect(result.summary).toContain('blockerad');
  });
});


