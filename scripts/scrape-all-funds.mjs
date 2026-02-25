#!/usr/bin/env node
/**
 * Batch scrape all fund document pages from aifmgroup.com
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, 'scrape-fund-docs.mjs');

const FUND_URLS = [
  { url: 'https://aifmgroup.com/auag-gold-rush/', fundId: 'auag-gold-rush' },
  { url: 'https://aifmgroup.com/auag-essential-metals/', fundId: 'auag-essential-metals' },
  { url: 'https://aifmgroup.com/auag-precious-core/', fundId: 'auag-precious-green' },
  { url: 'https://aifmgroup.com/auag-silver-bullet/', fundId: 'auag-silver-bullet' },
  { url: 'https://aifmgroup.com/metaspace-fund/', fundId: 'metaspace-fund' },
  { url: 'https://aifmgroup.com/estea-omsorgsfastigheter/', fundId: 'estea-omsorgsfastigheter' },
  { url: 'https://aifmgroup.com/go-blockchain-fund/', fundId: 'go-blockchain-fund' },
  { url: 'https://aifmgroup.com/lucy-global-fund/', fundId: 'lucy-global-fund' },
  { url: 'https://aifmgroup.com/ardenx/', fundId: 'arden-xfund' },
  { url: 'https://aifmgroup.com/bronx/', fundId: 'plain-capital-bronx' },
  { url: 'https://aifmgroup.com/lunatix/', fundId: 'plain-capital-lunatix' },
  { url: 'https://aifmgroup.com/styx/', fundId: 'plain-capital-styx' },
  { url: 'https://aifmgroup.com/proethos/', fundId: 'proethos-fond' },
  { url: 'https://aifmgroup.com/sam-aktiv-ranta/', fundId: 'sam-aktiv-ranta' },
  { url: 'https://aifmgroup.com/sbp-kredit/', fundId: 'sbp-kredit' },
  { url: 'https://aifmgroup.com/sensum-strategy-global/', fundId: 'sensum-strategy-global' },
  { url: 'https://aifmgroup.com/soic-dynamic-china/', fundId: 'soic-dynamic-china' },
  { url: 'https://aifmgroup.se/ssid-co-invest-fund/', fundId: 'ssid-co-invest-fund' },
  { url: 'https://aifmgroup.com/epoque/', fundId: 'epoque' },
  { url: 'https://aifmgroup.com/vinga-corporate-bond/', fundId: 'vinga-corporate-bond' },
];

let totalOk = 0;
let totalSkip = 0;
let totalErr = 0;

for (const { url, fundId } of FUND_URLS) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🚀 ${fundId} → ${url}`);
  console.log(`${'═'.repeat(60)}`);
  
  try {
    const output = execSync(`node "${scriptPath}" "${url}" "${fundId}"`, {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(output);
    
    const match = output.match(/(\d+) nedladdade, (\d+) hoppade över, (\d+) fel/);
    if (match) {
      totalOk += parseInt(match[1]);
      totalSkip += parseInt(match[2]);
      totalErr += parseInt(match[3]);
    }
  } catch (err) {
    console.error(`  ❌ Script failed: ${err.message}`);
    totalErr++;
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`📊 TOTAL RESULTAT:`);
console.log(`   ✅ Nedladdade: ${totalOk}`);
console.log(`   ⏭  Hoppade över: ${totalSkip}`);
console.log(`   ❌ Fel: ${totalErr}`);
console.log(`${'═'.repeat(60)}\n`);
