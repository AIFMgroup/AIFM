/**
 * Seed Fund Registry (DynamoDB) with AuAg fund data
 *
 * Run with: npm run seed:fund-registry
 * Or: npx tsx scripts/seed-fund-registry.ts
 *
 * Requires: FUND_REGISTRY_TABLE=aifm-fund-registry (and AWS credentials)
 */

import { DynamoDBStorage } from '../lib/fund-registry/dynamo-storage';
import { FundRegistry } from '../lib/fund-registry/fund-registry';
import type { Currency } from '../lib/fund-registry/types';

const TABLE = process.env.FUND_REGISTRY_TABLE || 'aifm-fund-registry';
const REGION = process.env.AWS_REGION || 'eu-north-1';

async function main() {
  process.env.FUND_REGISTRY_TABLE = TABLE;
  process.env.AWS_REGION = REGION;

  console.log(`Seeding Fund Registry table: ${TABLE} in ${REGION}`);

  const storage = new DynamoDBStorage(TABLE);
  const registry = new FundRegistry(storage);

  const existing = await registry.listFunds();
  const existingClasses = await registry.listShareClasses();
  if (existing.length > 0 && existingClasses.length > 0) {
    console.log(`Found ${existing.length} funds and ${existingClasses.length} share classes. Skipping seed.`);
    return;
  }
  const fundMap = new Map<string, { id: string }>();
  if (existing.length > 0) {
    console.log(`Found ${existing.length} funds but no share classes. Creating share classes and NAV only.`);
    existing.forEach((f) => fundMap.set(f.isin, { id: f.id }));
  }

  const demoFunds = [
    { name: 'AuAg Essential Metals', shortName: 'Essential Metals', legalName: 'AuAg Essential Metals Fund', isin: 'SE0019175563', currency: 'SEK' as Currency, status: 'active' as const, type: 'commodity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2022-06-01', fiscalYearEnd: '12-31' },
    { name: 'AuAg Gold Rush', shortName: 'Gold Rush', legalName: 'AuAg Gold Rush Fund', isin: 'SE0020677946', currency: 'SEK' as Currency, status: 'active' as const, type: 'commodity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2021-09-01', fiscalYearEnd: '12-31' },
    { name: 'AuAg Precious Green', shortName: 'Precious Green', legalName: 'AuAg Precious Green Fund', isin: 'SE0014808440', currency: 'SEK' as Currency, status: 'active' as const, type: 'commodity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2020-11-01', fiscalYearEnd: '12-31' },
    { name: 'AuAg Silver Bullet', shortName: 'Silver Bullet', legalName: 'AuAg Silver Bullet Fund', isin: 'SE0013358181', currency: 'SEK' as Currency, status: 'active' as const, type: 'commodity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2020-03-15', fiscalYearEnd: '12-31' },
    { name: 'EPOQUE', shortName: 'EPOQUE', legalName: 'EPOQUE Fund', isin: 'EPOQUE-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2023-01-15', fiscalYearEnd: '12-31' },
    { name: 'Go Blockchain Fund', shortName: 'Go Blockchain', legalName: 'Go Blockchain Fund', isin: 'GOBLOCK-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2022-04-01', fiscalYearEnd: '12-31' },
    { name: 'MetaSpace Fund', shortName: 'MetaSpace', legalName: 'MetaSpace Fund', isin: 'METASPACE-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2023-06-01', fiscalYearEnd: '12-31' },
    { name: 'Plain Capital BronX', shortName: 'BronX', legalName: 'Plain Capital BronX Fund', isin: 'BRONX-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2018-01-15', fiscalYearEnd: '12-31' },
    { name: 'Plain Capital LunatiX', shortName: 'LunatiX', legalName: 'Plain Capital LunatiX Fund', isin: 'LUNATIX-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2019-03-01', fiscalYearEnd: '12-31' },
    { name: 'Plain Capital StyX', shortName: 'StyX', legalName: 'Plain Capital StyX Fund', isin: 'STYX-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2017-06-01', fiscalYearEnd: '12-31' },
    { name: 'Proethos Fond', shortName: 'Proethos', legalName: 'Proethos Fond', isin: 'PROETHOS-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2016-09-01', fiscalYearEnd: '12-31' },
    { name: 'SAM Aktiv Ränta', shortName: 'SAM Ränta', legalName: 'SAM Aktiv Ränta Fund', isin: 'SAMRANTA-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'fixed_income' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2021-01-10', fiscalYearEnd: '12-31' },
    { name: 'Sensum Strategy Global', shortName: 'Sensum Global', legalName: 'Sensum Strategy Global Fund', isin: 'SENSUM-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2020-05-01', fiscalYearEnd: '12-31' },
    { name: 'SOIC Dynamic China', shortName: 'SOIC China', legalName: 'SOIC Dynamic China Fund', isin: 'SOIC-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'equity' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2022-03-01', fiscalYearEnd: '12-31' },
    { name: 'Vinga Corporate Bond', shortName: 'Vinga Bond', legalName: 'Vinga Corporate Bond Fund', isin: 'VINGA-ISIN', currency: 'SEK' as Currency, status: 'active' as const, type: 'fixed_income' as const, ucits: true, aifmd: false, countryOfDomicile: 'SE', inceptionDate: '2021-06-01', fiscalYearEnd: '12-31' },
  ];

  const demoShareClasses = [
    { fundIsin: 'SE0013358181', name: 'A', isin: 'SE0013358181', currency: 'SEK' as Currency, fee: 1.5, nav: 378.33, aum: 3400248947.80, shares: 8987586.35 },
    { fundIsin: 'SE0013358181', name: 'B', isin: 'SE0013358199', currency: 'EUR' as Currency, fee: 1.5, nav: 37.23, aum: 921562837.38, shares: 2265711.61 },
    { fundIsin: 'SE0020677946', name: 'A', isin: 'SE0020677946', currency: 'SEK' as Currency, fee: 1.5, nav: 208.71, aum: 505494096.59, shares: 2422025.74 },
    { fundIsin: 'SE0020677946', name: 'B', isin: 'SE0020677953', currency: 'EUR' as Currency, fee: 1.5, nav: 22.63, aum: 98912.81, shares: 400.00 },
    { fundIsin: 'SE0020677946', name: 'C', isin: 'SE0020677961', currency: 'SEK' as Currency, fee: 1.0, nav: 170.52, aum: 12710988.85, shares: 74543.90 },
    { fundIsin: 'SE0020677946', name: 'H', isin: 'SE0020678001', currency: 'NOK' as Currency, fee: 1.5, nav: 197.23, aum: 87854781.97, shares: 488103.97 },
    { fundIsin: 'SE0014808440', name: 'A', isin: 'SE0014808440', currency: 'SEK' as Currency, fee: 1.5, nav: 198.87, aum: 328924859.33, shares: 1653996.37 },
    { fundIsin: 'SE0014808440', name: 'B', isin: 'SE0014808457', currency: 'EUR' as Currency, fee: 1.5, nav: 18.88, aum: 12524335.34, shares: 60729.92 },
    { fundIsin: 'SE0014808440', name: 'C', isin: 'SE0015948641', currency: 'SEK' as Currency, fee: 1.0, nav: 140.36, aum: 5845893.25, shares: 41648.44 },
    { fundIsin: 'SE0019175563', name: 'A', isin: 'SE0019175563', currency: 'SEK' as Currency, fee: 1.5, nav: 142.42, aum: 349892028.52, shares: 2456766.31 },
    { fundIsin: 'SE0019175563', name: 'B', isin: 'SE0019175571', currency: 'EUR' as Currency, fee: 1.5, nav: 14.65, aum: 43120778.87, shares: 269451.12 },
    { fundIsin: 'SE0019175563', name: 'C', isin: 'SE0019175589', currency: 'SEK' as Currency, fee: 1.0, nav: 128.56, aum: 2571291.72, shares: 20000.00 },
  ];

  if (fundMap.size === 0) {
    for (const fundData of demoFunds) {
      const fund = await registry.createFund(fundData);
      fundMap.set(fund.isin, { id: fund.id });
      console.log(`Created fund: ${fund.name} (${fund.id})`);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  for (const scData of demoShareClasses) {
    const fund = fundMap.get(scData.fundIsin);
    if (!fund) continue;
    const shareClass = await registry.createShareClass({
      fundId: fund.id,
      name: scData.name,
      isin: scData.isin,
      currency: scData.currency,
      status: 'active',
      managementFee: scData.fee,
      distributionPolicy: 'accumulating',
    });
    await registry.setNAV({
      fundId: fund.id,
      shareClassId: shareClass.id,
      date: today,
      navPerShare: scData.nav,
      totalNetAssets: scData.aum * 1.1,
      shareClassNetAssets: scData.aum,
      outstandingShares: scData.shares,
      source: 'manual',
      status: 'approved',
    });
    console.log(`  Share class: ${scData.name} (${shareClass.isin}) NAV ${scData.nav}`);
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
