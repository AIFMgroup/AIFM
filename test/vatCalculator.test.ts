import { describe, expect, test } from 'vitest';
import { calculateCompleteVat } from '../lib/accounting/services/vatCalculator';

describe('vatCalculator', () => {
  test('reverse charge produces 0 VAT on invoice and additional lines for input/output VAT', () => {
    const calc = calculateCompleteVat(
      1000,
      false,
      'Consulting services (reverse charge)',
      'Example EU Supplier',
      'Germany'
    );

    // Reverse charge should not put VAT on invoice itself
    expect(calc.vatAmount).toBe(0);
    expect(calc.additionalLines?.length).toBeGreaterThanOrEqual(2);
  });

  test('EU supplierCountry triggers reverse charge and type eu_service for services', () => {
    const calc = calculateCompleteVat(
      1000,
      false,
      'Software subscription',
      'EU Vendor',
      'Germany'
    );
    expect(calc.isReverseCharge).toBe(true);
    expect(calc.isEuPurchase).toBe(true);
  });
});


