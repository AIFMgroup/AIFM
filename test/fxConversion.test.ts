import { describe, expect, test } from 'vitest';
import type { Classification } from '../lib/accounting/jobStore';
import type { CurrencyConversion } from '../lib/accounting/services/currencyService';
import { applyFxConversionToClassification } from '../lib/accounting/services/fxConversion';

import usdInvoice from './fixtures/classification_usd_invoice.json';

describe('fxConversion', () => {
  test('converts foreign currency classification to SEK deterministically and stores FX metadata', () => {
    const classification = usdInvoice as unknown as Classification;

    const conversion: CurrencyConversion = {
      originalAmount: 100,
      originalCurrency: 'USD' as any,
      convertedAmount: 1000,
      targetCurrency: 'SEK' as any,
      exchangeRate: 10,
      rateDate: '2025-11-18',
      rateSource: 'test',
    };

    const converted = applyFxConversionToClassification(classification, conversion);
    expect(converted.currency).toBe('SEK');
    expect(converted.totalAmount).toBe(1000);
    expect(converted.vatAmount).toBe(0);
    expect(converted.lineItems[0].netAmount).toBe(1000);
    expect(converted.originalCurrency).toBe('USD');
    expect(converted.exchangeRate).toBe(10);
  });
});


