import { describe, expect, test } from 'vitest';
import { detectReverseCharge } from '../lib/accounting/services/vatCalculator';

describe('vatCalculator reverse-charge type detection', () => {
  test('EU goods should be detected as eu_goods when supplierCountry is EU and text is not service-like', () => {
    const res = detectReverseCharge('Purchase of goods', 'EU Vendor', 'Germany');
    expect(res.isReverseCharge).toBe(true);
    expect(res.type).toBe('eu_goods');
  });

  test('EU services should be detected as eu_service when supplierCountry is EU and text is service-like', () => {
    const res = detectReverseCharge('Software subscription', 'EU Vendor', 'Germany');
    expect(res.isReverseCharge).toBe(true);
    expect(res.type).toBe('eu_service');
  });
});


