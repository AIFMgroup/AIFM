/**
 * NAV Data Ingest
 *
 * Parsers for AuAg daily files:
 * - CSV: NAV prices (semicolon-separated, from nav@auagfunds.com)
 * - XLS: SubRed (subscriptions/redemptions)
 * - XLS: NAV detail (per fund with ISIN, currency, shares outstanding)
 *
 * These are the files AuAg sends daily to AIFM.
 */

import { lookupByName, lookupByISIN, getAllShareClasses } from './auag-funds';

// ============================================================================
// Types
// ============================================================================

/** Parsed NAV price from the daily CSV */
export interface ParsedNAVPrice {
  shareClassName: string;
  date: string;
  changePercent: number;
  navPerShare: number;
  fundId: string;
  shareClassId: string;
  isin: string;
  currency: string;
}

/** Parsed row from SubRed XLS */
export interface ParsedSubRedEntry {
  customer: string;
  type: 'subscription' | 'redemption';
  amount: number;
  currency: string;
  shares: number;
  fundName: string;
  isin: string;
  fundId: string;
  shareClassId: string;
  date: string;
}

/** Parsed row from NAV detail XLS */
export interface ParsedNAVDetail {
  fundName: string;
  isin: string;
  currency: string;
  navPerShare: number;
  sharesOutstanding: number;
  totalNetAssets: number;
  navChange: number;
  date: string;
  fundId: string;
  shareClassId: string;
}

/** Result of an ingest operation */
export interface IngestResult {
  success: boolean;
  date: string;
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  data: ParsedNAVPrice[] | ParsedSubRedEntry[] | ParsedNAVDetail[];
}

// ============================================================================
// CSV Parser — AuAg Daily NAV Prices
// ============================================================================

/**
 * Parse the AuAg daily NAV price CSV.
 *
 * Format (semicolon-separated):
 *   name;date;percentage;price
 *   AUAG PRECIOUS GREEN A;2026-02-13;+1.09807;213.6
 */
export function parseAuAgNAVCSV(csvContent: string): IngestResult {
  const lines = csvContent.trim().split('\n');
  const errors: string[] = [];
  const data: ParsedNAVPrice[] = [];

  // Skip header
  const startIdx = lines[0]?.toLowerCase().includes('name') ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    if (parts.length < 4) {
      errors.push(`Line ${i + 1}: expected 4 fields, got ${parts.length}`);
      continue;
    }

    const [name, date, percentageStr, priceStr] = parts;
    const navPerShare = parseFloat(priceStr);
    const changePercent = parseFloat(percentageStr.replace('+', ''));

    if (isNaN(navPerShare) || isNaN(changePercent)) {
      errors.push(`Line ${i + 1}: invalid number (price=${priceStr}, pct=${percentageStr})`);
      continue;
    }

    const lookup = lookupByName(name);
    if (!lookup) {
      errors.push(`Line ${i + 1}: unknown share class "${name}"`);
      continue;
    }

    const allSC = getAllShareClasses();
    const sc = allSC.find((s) => s.shareClassId === lookup.shareClassId);

    data.push({
      shareClassName: name.trim(),
      date: date.trim(),
      changePercent,
      navPerShare,
      fundId: lookup.fundId,
      shareClassId: lookup.shareClassId,
      isin: sc?.isin ?? '',
      currency: sc?.currency ?? 'SEK',
    });
  }

  return {
    success: errors.length === 0,
    date: data[0]?.date ?? new Date().toISOString().split('T')[0],
    recordsProcessed: data.length,
    recordsFailed: errors.length,
    errors,
    data,
  };
}

// ============================================================================
// XLS Parser — SubRed (Subscriptions / Redemptions)
// ============================================================================

/**
 * Parse the AuAg SubRed XLS file.
 *
 * The XLS has columns like:
 *   Kund | Typ | Belopp | Valuta | Andelar | Fond | ISIN
 *
 * We accept a 2D array of rows (first row = headers).
 */
export function parseSubRedRows(
  rows: (string | number | null)[][],
  date: string
): IngestResult {
  const errors: string[] = [];
  const data: ParsedSubRedEntry[] = [];

  if (rows.length < 2) {
    return { success: false, date, recordsProcessed: 0, recordsFailed: 0, errors: ['No data rows'], data: [] };
  }

  // Detect header row
  const headers = rows[0].map((h) => String(h ?? '').toLowerCase().trim());

  // Map column indices flexibly
  const colMap = {
    customer: findCol(headers, ['kund', 'customer', 'namn', 'name', 'client']),
    type: findCol(headers, ['typ', 'type', 'trans', 'transaction']),
    amount: findCol(headers, ['belopp', 'amount', 'summa', 'value']),
    currency: findCol(headers, ['valuta', 'currency', 'ccy']),
    shares: findCol(headers, ['andelar', 'shares', 'units', 'antal']),
    fundName: findCol(headers, ['fond', 'fund', 'fondnamn']),
    isin: findCol(headers, ['isin']),
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === '' || c === undefined)) continue;

    try {
      const customer = String(row[colMap.customer] ?? '').trim();
      const typeRaw = String(row[colMap.type] ?? '').toLowerCase().trim();
      const amount = toNumber(row[colMap.amount]);
      const currency = String(row[colMap.currency] ?? 'SEK').trim();
      const shares = toNumber(row[colMap.shares]);
      const fundName = String(row[colMap.fundName] ?? '').trim();
      const isin = String(row[colMap.isin] ?? '').trim();

      if (!customer && !fundName) continue;

      const type: 'subscription' | 'redemption' =
        typeRaw.startsWith('sub') || typeRaw.startsWith('teckn') || typeRaw === 'köp' || typeRaw === 'buy'
          ? 'subscription'
          : 'redemption';

      const lookup = isin ? lookupByISIN(isin) : lookupByName(fundName);

      data.push({
        customer,
        type,
        amount: Math.abs(amount),
        currency,
        shares: Math.abs(shares),
        fundName,
        isin,
        fundId: lookup?.fundId ?? '',
        shareClassId: lookup?.shareClassId ?? '',
        date,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    date,
    recordsProcessed: data.length,
    recordsFailed: errors.length,
    errors,
    data,
  };
}

// ============================================================================
// XLS Parser — NAV Detail
// ============================================================================

/**
 * Parse the AuAg NAV detail XLS file.
 *
 * Columns: Fond | ISIN | Valuta | NAV | Utestående andelar | Förändring
 */
export function parseNAVDetailRows(
  rows: (string | number | null)[][],
  date: string
): IngestResult {
  const errors: string[] = [];
  const data: ParsedNAVDetail[] = [];

  if (rows.length < 2) {
    return { success: false, date, recordsProcessed: 0, recordsFailed: 0, errors: ['No data rows'], data: [] };
  }

  const headers = rows[0].map((h) => String(h ?? '').toLowerCase().trim());

  const colMap = {
    fundName: findCol(headers, ['fond', 'fund', 'name', 'namn']),
    isin: findCol(headers, ['isin']),
    currency: findCol(headers, ['valuta', 'currency', 'ccy']),
    nav: findCol(headers, ['nav', 'kurs', 'price', 'nav/andel']),
    shares: findCol(headers, ['andelar', 'shares', 'units', 'utestående', 'outstanding']),
    change: findCol(headers, ['förändring', 'change', '%', 'diff']),
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null || c === '' || c === undefined)) continue;

    try {
      const fundName = String(row[colMap.fundName] ?? '').trim();
      const isin = String(row[colMap.isin] ?? '').trim();
      const currency = String(row[colMap.currency] ?? 'SEK').trim();
      const navPerShare = toNumber(row[colMap.nav]);
      const sharesOutstanding = toNumber(row[colMap.shares]);
      const navChange = toNumber(row[colMap.change]);

      if (!isin || navPerShare === 0) continue;

      const lookup = lookupByISIN(isin);
      const totalNetAssets = navPerShare * sharesOutstanding;

      data.push({
        fundName,
        isin,
        currency,
        navPerShare,
        sharesOutstanding,
        totalNetAssets,
        navChange,
        date,
        fundId: lookup?.fundId ?? '',
        shareClassId: lookup?.shareClassId ?? '',
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    date,
    recordsProcessed: data.length,
    recordsFailed: errors.length,
    errors,
    data,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function findCol(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return 0;
}

function toNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
