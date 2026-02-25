/**
 * AuAg Fund Configuration
 *
 * All AuAg funds and share classes with ISIN, currency, and metadata.
 * Sourced from the daily NAV XLS files provided by AuAg fund admin.
 */

import type { FundConfig } from './types';

export const AUAG_FUNDS: FundConfig[] = [
  {
    fundId: 'auag-silver-bullet',
    fundCode: 'SB',
    name: 'AUAG Silver Bullet',
    currency: 'SEK',
    fundType: 'AIF',
    managementFeeRate: 0.015,
    performanceFeeRate: 0,
    depositaryFeeRate: 0.0005,
    adminFeeRate: 0.001,
    pricingPolicy: {
      equityPriceType: 'CLOSE',
      bondPriceType: 'CLOSE',
      derivativePriceType: 'MARK_TO_MARKET',
      fxRateTime: 'CLOSE',
      fxRateSource: 'ECB',
    },
    accrualRules: {
      feeAccrualBasis: 'DAILY',
      dividendAccrualPolicy: 'EX_DATE',
      interestAccrualMethod: 'ACT_365',
    },
    shareClasses: [
      { shareClassId: 'sb-a', shareClassCode: 'A', name: 'AUAG SILVER BULLET A', isin: 'SE0013358181', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'sb-b', shareClassCode: 'B', name: 'AUAG SILVER BULLET B', isin: 'SE0013358199', currency: 'EUR', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'sb-c', shareClassCode: 'C', name: 'AUAG SILVER BULLET C', isin: 'SE0015948666', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'sb-d', shareClassCode: 'D', name: 'AUAG SILVER BULLET D', isin: 'SE0015948674', currency: 'EUR', hedged: false, distributionPolicy: 'ACC' },
    ],
  },
  {
    fundId: 'auag-precious-green',
    fundCode: 'PG',
    name: 'AUAG Precious Green',
    currency: 'SEK',
    fundType: 'AIF',
    managementFeeRate: 0.015,
    performanceFeeRate: 0,
    depositaryFeeRate: 0.0005,
    adminFeeRate: 0.001,
    pricingPolicy: {
      equityPriceType: 'CLOSE',
      bondPriceType: 'CLOSE',
      derivativePriceType: 'MARK_TO_MARKET',
      fxRateTime: 'CLOSE',
      fxRateSource: 'ECB',
    },
    accrualRules: {
      feeAccrualBasis: 'DAILY',
      dividendAccrualPolicy: 'EX_DATE',
      interestAccrualMethod: 'ACT_365',
    },
    shareClasses: [
      { shareClassId: 'pg-a', shareClassCode: 'A', name: 'AUAG PRECIOUS GREEN A', isin: 'SE0014808440', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'pg-b', shareClassCode: 'B', name: 'AUAG PRECIOUS GREEN B', isin: 'SE0014808457', currency: 'EUR', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'pg-c', shareClassCode: 'C', name: 'AUAG PRECIOUS GREEN C', isin: 'SE0015948641', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
    ],
  },
  {
    fundId: 'auag-essential-metals',
    fundCode: 'EM',
    name: 'AUAG Essential Metals',
    currency: 'SEK',
    fundType: 'AIF',
    managementFeeRate: 0.015,
    performanceFeeRate: 0,
    depositaryFeeRate: 0.0005,
    adminFeeRate: 0.001,
    pricingPolicy: {
      equityPriceType: 'CLOSE',
      bondPriceType: 'CLOSE',
      derivativePriceType: 'MARK_TO_MARKET',
      fxRateTime: 'CLOSE',
      fxRateSource: 'ECB',
    },
    accrualRules: {
      feeAccrualBasis: 'DAILY',
      dividendAccrualPolicy: 'EX_DATE',
      interestAccrualMethod: 'ACT_365',
    },
    shareClasses: [
      { shareClassId: 'em-a', shareClassCode: 'A', name: 'AUAG ESSENTIAL METALS A', isin: 'SE0019175563', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'em-b', shareClassCode: 'B', name: 'AUAG ESSENTIAL METALS B', isin: 'SE0019175571', currency: 'EUR', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'em-c', shareClassCode: 'C', name: 'AUAG ESSENTIAL METALS C', isin: 'SE0019175589', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
    ],
  },
  {
    fundId: 'auag-gold-rush',
    fundCode: 'GR',
    name: 'AuAg Gold Rush',
    currency: 'SEK',
    fundType: 'AIF',
    managementFeeRate: 0.015,
    performanceFeeRate: 0,
    depositaryFeeRate: 0.0005,
    adminFeeRate: 0.001,
    pricingPolicy: {
      equityPriceType: 'CLOSE',
      bondPriceType: 'CLOSE',
      derivativePriceType: 'MARK_TO_MARKET',
      fxRateTime: 'CLOSE',
      fxRateSource: 'ECB',
    },
    accrualRules: {
      feeAccrualBasis: 'DAILY',
      dividendAccrualPolicy: 'EX_DATE',
      interestAccrualMethod: 'ACT_365',
    },
    shareClasses: [
      { shareClassId: 'gr-a', shareClassCode: 'A', name: 'AuAg Gold Rush A', isin: 'SE0020677946', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'gr-b', shareClassCode: 'B', name: 'AuAg Gold Rush B', isin: 'SE0020677953', currency: 'EUR', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'gr-c', shareClassCode: 'C', name: 'AuAg Gold Rush C', isin: 'SE0020677961', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'gr-d', shareClassCode: 'D', name: 'AuAg Gold Rush D', isin: 'SE0020677979', currency: 'EUR', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'gr-h', shareClassCode: 'H', name: 'AuAg Gold Rush H', isin: 'SE0020678001', currency: 'NOK', hedged: true, hedgingRatio: 1.0, distributionPolicy: 'ACC' },
      { shareClassId: 'gr-l', shareClassCode: 'L', name: 'AuAg Gold Rush L', isin: 'SE0020678050', currency: 'USD', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'gr-n', shareClassCode: 'N', name: 'AuAg Gold Rush N', isin: 'SE0020678076', currency: 'CHF', hedged: false, distributionPolicy: 'ACC' },
    ],
  },
  {
    fundId: 'metaspace-fund',
    fundCode: 'MS',
    name: 'MetaSpace Fund',
    currency: 'SEK',
    fundType: 'AIF',
    managementFeeRate: 0.015,
    performanceFeeRate: 0,
    depositaryFeeRate: 0.0005,
    adminFeeRate: 0.001,
    pricingPolicy: {
      equityPriceType: 'CLOSE',
      bondPriceType: 'CLOSE',
      derivativePriceType: 'MARK_TO_MARKET',
      fxRateTime: 'CLOSE',
      fxRateSource: 'ECB',
    },
    accrualRules: {
      feeAccrualBasis: 'DAILY',
      dividendAccrualPolicy: 'EX_DATE',
      interestAccrualMethod: 'ACT_365',
    },
    shareClasses: [
      { shareClassId: 'ms-a', shareClassCode: 'A', name: 'MetaSpace Fund A', isin: 'SE0011527829', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
      { shareClassId: 'ms-b', shareClassCode: 'B', name: 'MetaSpace Fund B', isin: 'SE0011527837', currency: 'SEK', hedged: false, distributionPolicy: 'ACC' },
    ],
  },
];

/** Lookup helpers */

const _isinMap = new Map<string, { fundId: string; shareClassId: string; fundCode: string }>();
const _nameMap = new Map<string, { fundId: string; shareClassId: string }>();

for (const fund of AUAG_FUNDS) {
  for (const sc of fund.shareClasses) {
    _isinMap.set(sc.isin, { fundId: fund.fundId, shareClassId: sc.shareClassId, fundCode: fund.fundCode });
    _nameMap.set(sc.name.toUpperCase(), { fundId: fund.fundId, shareClassId: sc.shareClassId });
  }
}

/** Find fund + share class by ISIN */
export function lookupByISIN(isin: string) {
  return _isinMap.get(isin) ?? null;
}

/** Find fund + share class by name (case-insensitive) */
export function lookupByName(name: string) {
  return _nameMap.get(name.trim().toUpperCase()) ?? null;
}

/** Get all share classes as flat list */
export function getAllShareClasses() {
  return AUAG_FUNDS.flatMap((f) =>
    f.shareClasses.map((sc) => ({
      ...sc,
      fundId: f.fundId,
      fundCode: f.fundCode,
      fundName: f.name,
      fundCurrency: f.currency,
    }))
  );
}
