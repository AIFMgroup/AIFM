import { describe, expect, test } from 'vitest';
import { validateClassification } from '../lib/accounting/services/validationService';
import creditNote from './fixtures/classification_credit_note_sek.json';

describe('validationService - credit note', () => {
  test('credit note fixture is valid when docType is CREDIT_NOTE (negative totals allowed)', () => {
    const res = validateClassification(creditNote as any);
    expect(res.isValid).toBe(true);
    expect(res.errors.some(e => e.code === 'INVALID_AMOUNT')).toBe(false);
  });
});


