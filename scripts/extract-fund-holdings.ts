#!/usr/bin/env npx tsx
/**
 * Extracts per-fund company lists from EOM-approved.xlsx (Databas sheet).
 * Produces one .txt file per fund in scripts/ with unique company names.
 * Bonds / ETFs / funds (non-equity) are filtered out heuristically.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const XLSX_PATH = '/Users/christophergenberg/Desktop/EOM-approved.xlsx';
const OUTPUT_DIR = path.join(__dirname);

const SKIP_FUNDS = new Set(['AuAg Essential Metals']);

const NON_EQUITY_PATTERNS = [
  /\bFLOAT\b/i,
  /\bFLT\b/i,
  /\bPERP\b/i,
  /\bCORP$/i,
  /\d+\s*\/\s*\d+\s*\/\s*\d+/,  // dates like 07/03/25
  /\d{6,8}$/,                     // trailing date digits
  /\b(SGB|FLOAT|FRN|MTN)\b/i,
  /^\d+[\.,]\d+\s/,               // starts with coupon rate
  /\bRANTEFOND\b/i,
  /\bLIKVIDITET/i,
  /\bHEDGEFOND\b/i,
  /\bBOND\b/i,
  /\bCORP BOND/i,
  /\bREPO\b/i,
  /\bETF\b/i,
  /\bRÄNTE/i,
  /\bxFund\b/i,
  /\bINDEX\b/i,
  /\bFOND\b/i,
  /\bXACT\b/i,
  /\bISHS\b/i,
  /\bISHARES\b/i,
  /\bSPDR\b/i,
  /\bVANGUARD\b/i,
  /\bPOWER\s?SHARES\b/i,
  /\bPROSHARES\b/i,
  /\bWISDOM\s?TREE\b.*\bETC\b/i,
  /\bINVESCO.*ETC\b/i,
  /\bMARKET VECTOR\b/i,
  /\bPRICE SHARES\b/i,
  /\bDIREXION\b/i,
  /\bPIMCO\b/i,
  /\bATLANT\b.*\b(SHARP|STAB)/i,
  /\bCICERO\b/i,
  /\bSPILTAN\b.*\bFOND\b/i,
  /\bLANNEBO\b/i,
  /\bSKAGEN\b/i,
  /\bSTOREBRAND\b/i,
  /\bDANSKE\b.*\bLIKVID/i,
  /\bAMF RÄNTE/i,
  /\bSEBGREEN\b/i,
  /\bSEB CORP/i,
  /\bSPP\b/i,
  /\bÖHMAN\b/i,
  /\bCLIENS\b/i,
  /\bCARNEGIE INV/i,
  /\bCATELLA\b/i,
  /\bSIMPLICITY\b/i,
  /\bLÄNSF/i,
  /\bAuAg GOLD MINING DE/i,  // ETF wrapper
  /\bReconstruction\b/i,
  /\bMerger\b/i,
  /\bBTA\b$/i,  // subscription rights
  /\bTR\b$/i,   // subscription rights
  /\bUR\b$/i,   // subscription rights
  /\bTO\d?\b$/i, // subscription warrants
  /\bRIGHTS?\b$/i,
  /\bRED\.\s*SHARE/i,
  /\bGUGGENHEIM\b/i,
  /\bTEUCRIUM\b/i,
  /\bBCLY\b/i,
  /\bBNP\b.*\bETC\b/i,
  /\bICE BRENT/i,
  /\bXTRACK/i,
  /\bETFS\b/i,
  /\bPHY\s*(GLD|GOLD|SILVER|PLTNM|PALLDM|COPPER)/i,
  /\bGOLD BULL/i,
  /\bSILVER\s*1X/i,
  /\bAMUNDI PHYS/i,
  /\bROYAL MINT GOLD/i,
  /\bXETRA-GOLD/i,
  /\bSWISS GOLD/i,
  /\bGOLD ETC\b/i,
  /\bSILVER ETC\b/i,
  /\bSUGAR ETC\b/i,
  /\bCOFFEE\b/i,
  /\bSOYBEAN\b/i,
  /\bCOCOA\b/i,
  /\bBRENT\b/i,
  /\bCRUDE\b/i,
  /\bNAT GAS\b/i,
  /\bCOMMODI/i,
  /\bAGRI\b/i,
  /FLOAT\b/i,
  /\d{2}\/\d{2}\/\d{2,4}/,
  /\d{4,6}\s*CORP$/i,
];

function isEquity(name: string): boolean {
  if (!name || name.length < 3) return false;
  for (const pat of NON_EQUITY_PATTERNS) {
    if (pat.test(name)) return false;
  }
  return true;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-åäöü]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets['Databas'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  // Row index 1 has fund names at columns 6, 11, 16, 21, 26, ... (every 5 cols starting at 6)
  const headerRow = rows[1];
  const columnRow = rows[3]; // "Värdepapper", "ISIN", etc.

  // Detect fund columns: they appear every 5 cols starting at index 6
  const funds: { name: string; nameCol: number; isinCol: number }[] = [];
  
  for (let c = 6; c < (headerRow?.length || 0); c += 5) {
    const fundName = headerRow[c];
    if (fundName && typeof fundName === 'string' && fundName.trim()) {
      funds.push({
        name: fundName.trim(),
        nameCol: c,      // "Värdepapper" column
        isinCol: c + 1,  // "ISIN" column
      });
    }
  }

  console.log(`Found ${funds.length} funds:`);
  funds.forEach(f => console.log(`  - ${f.name} (col ${f.nameCol})`));

  const results: { fund: string; file: string; count: number }[] = [];

  for (const fund of funds) {
    if (SKIP_FUNDS.has(fund.name)) {
      console.log(`\nSkipping ${fund.name} (already processed)`);
      continue;
    }

    const companies = new Map<string, string>(); // normalized -> original name

    for (let r = 4; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = row[fund.nameCol];
      const isin = row[fund.isinCol];
      if (!name || typeof name !== 'string') continue;
      const trimmed = name.trim();
      if (!trimmed) continue;
      if (!isEquity(trimmed)) continue;

      const key = trimmed.toUpperCase();
      if (!companies.has(key)) {
        companies.set(key, trimmed);
      }
    }

    if (companies.size === 0) {
      console.log(`\n${fund.name}: 0 equity holdings (skipping)`);
      continue;
    }

    const slug = slugify(fund.name);
    const filename = `${slug}-holdings.txt`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const names = Array.from(companies.values());
    fs.writeFileSync(filepath, names.join('\n') + '\n');

    console.log(`\n${fund.name}: ${names.length} equity holdings -> ${filename}`);
    results.push({ fund: fund.name, file: filename, count: names.length });
  }

  // Write a summary / manifest
  const manifest = results
    .map(r => `${r.fund}\t${r.file}\t${r.count}`)
    .join('\n');
  const manifestPath = path.join(OUTPUT_DIR, 'fund-manifest.txt');
  fs.writeFileSync(manifestPath, manifest + '\n');
  console.log(`\nManifest written to ${manifestPath}`);
  console.log(`Total funds: ${results.length}, Total companies: ${results.reduce((s, r) => s + r.count, 0)}`);
}

main();
