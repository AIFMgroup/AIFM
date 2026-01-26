/**
 * Pure FX conversion helper used by the processing pipeline.
 * Converts a Classification to SEK using a provided deterministic rate.
 *
 * This is intentionally pure (no AWS calls) so it can be unit-tested with fixtures.
 */

import type { Classification } from '../jobStore';
import type { CurrencyConversion } from './currencyService';
import { roundToOre } from './currencyService';

export function applyFxConversionToClassification(
  classification: Classification,
  conversion: CurrencyConversion
): Classification {
  // Only convert if original is not SEK and target is SEK
  if (conversion.targetCurrency !== 'SEK' || conversion.originalCurrency === 'SEK') {
    return classification;
  }

  const rate = conversion.exchangeRate;
  const cloned: Classification = JSON.parse(JSON.stringify(classification));

  // Convert line items using the same rate
  for (const li of cloned.lineItems) {
    li.netAmount = roundToOre(li.netAmount * rate);
    li.vatAmount = roundToOre((li.vatAmount || 0) * rate);
  }

  // Recompute totals from lines
  const sumLines = roundToOre(
    cloned.lineItems.reduce((sum, li) => sum + (li.netAmount || 0) + (li.vatAmount || 0), 0)
  );

  const convertedTotal = conversion.convertedAmount;
  const diff = roundToOre(convertedTotal - sumLines);
  if (Math.abs(diff) <= 1 && cloned.lineItems[0]) {
    // Apply rounding diff to first line's net amount to keep totals stable
    cloned.lineItems[0].netAmount = roundToOre(cloned.lineItems[0].netAmount + diff);
  }

  cloned.vatAmount = roundToOre(cloned.lineItems.reduce((sum, li) => sum + (li.vatAmount || 0), 0));
  cloned.totalAmount = roundToOre(cloned.lineItems.reduce((sum, li) => sum + (li.netAmount || 0) + (li.vatAmount || 0), 0));

  // Store FX metadata and switch bookkeeping currency to SEK
  cloned.originalAmount = conversion.originalAmount;
  cloned.originalCurrency = conversion.originalCurrency;
  cloned.exchangeRate = conversion.exchangeRate;
  cloned.exchangeRateDate = conversion.rateDate;
  cloned.exchangeRateSource = conversion.rateSource;
  cloned.currency = 'SEK';

  return cloned;
}


