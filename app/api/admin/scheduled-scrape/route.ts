/**
 * Scheduled Weekly Scraper
 *
 * POST /api/admin/scheduled-scrape
 *
 * Triggered weekly (EventBridge / cron / manual curl) to re-scrape all fund
 * pages and holding IR pages. Only downloads documents that are NEW (not yet
 * in DynamoDB by filename) or UPDATED (same filename but different file size).
 *
 * Auth: x-aifm-cron-secret header (matches CRON_SECRET env var) or x-aifm-role: admin.
 *
 * Query params:
 *   ?type=funds      – only scrape fund documents
 *   ?type=holdings   – only scrape holding documents
 *   ?fundId=X        – only scrape one specific fund
 *   ?dryRun=true     – discover only, no download/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { createHash } from 'crypto';
import {
  saveFundDocument,
  getFundDocuments,
  generateDocumentId as genFundDocId,
  type FundDocumentCategory,
} from '@/lib/fund-documents/fund-document-store';
import {
  saveHoldingDocument,
  getExistingFileNames as getExistingHoldingFileNames,
  generateDocumentId as genHoldingDocId,
  type HoldingDocument,
  type HoldingDocumentCategory,
} from '@/lib/holding-documents/holding-document-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const REGION = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.FUND_DOCUMENTS_BUCKET || 'aifm-documents';

const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: 'eu-west-1' });

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ═══════════════════════════════════════════════
// Fund page URL registry
// ═══════════════════════════════════════════════

const FUND_SCRAPE_URLS: { url: string; fundId: string }[] = [
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
  { url: 'https://aifmgroup.com/arte-collectum-i-ab/', fundId: 'arte-collectum-i' },
  { url: 'https://aifmgroup.com/arte-collectum-ii-ab/', fundId: 'arte-collectum-ii' },
];

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

interface PdfLink {
  url: string;
  text: string;
  fileName: string;
  category: FundDocumentCategory;
}

function guessCategory(text: string, fileName: string): FundDocumentCategory {
  const lower = (text + ' ' + fileName).toLowerCase();
  if (lower.includes('delårsrapport') || lower.includes('delarsrapport') || lower.includes('semi-annual') || lower.includes('halvårs') || lower.includes('halvarsredogorelse') || lower.includes('halvårsredogörelse')) return 'arsredovisning';
  if (lower.includes('årsredovisning') || lower.includes('arsredovisning') || lower.includes('annual report') || lower.includes('arsberattelse') || lower.includes('årsberättelse')) return 'arsredovisning';
  if (lower.includes('fondvillkor') || lower.includes('fondbestammelser') || lower.includes('fondbestämmelser') || lower.includes('grundprospekt') || lower.includes('prospekt')) return 'fondvillkor';
  if (lower.includes('hållbarhet') || lower.includes('sustainability') || lower.includes('sfdr') || lower.includes('upplysningar')) return 'hallbarhetsrapport';
  if (lower.includes('informationsbroschyr') || lower.includes('information memorandum') || lower.includes('broschyr')) return 'informationsbroschyr';
  if (lower.includes('faktablad') || lower.includes('priip') || lower.includes('key information')) return 'faktablad';
  if (lower.includes('placering') || lower.includes('policy') || lower.includes('placeringspolicy')) return 'placeringspolicy';
  return 'ovrigt';
}

function extractFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || 'document.pdf');
  } catch {
    return 'document.pdf';
  }
}

async function fetchPage(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchPdfBuffer(url: string, timeoutMs = 20000): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000 || buf.length > 30 * 1024 * 1024) return null;
    return buf;
  } catch {
    return null;
  }
}

async function extractTextWithTextract(buffer: Buffer): Promise<string> {
  if (buffer.length > 5 * 1024 * 1024) return '';
  try {
    const res = await textract.send(
      new DetectDocumentTextCommand({ Document: { Bytes: buffer } }),
    );
    return (res.Blocks || [])
      .filter((b) => b.BlockType === 'LINE')
      .map((b) => b.Text)
      .filter(Boolean)
      .join('\n');
  } catch {
    return '';
  }
}

function contentHash(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

function discoverPdfLinks(html: string, baseUrl: string): PdfLink[] {
  const links: PdfLink[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a\s[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();
    href = resolveUrl(href, baseUrl);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const fileName = extractFileName(href);
    links.push({ url: href, text: linkText || fileName, fileName, category: guessCategory(linkText, fileName) });
  }

  const hrefRegex = /href=["']([^"']*\.pdf[^"']*)["']/gi;
  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];
    href = resolveUrl(href, baseUrl);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    const fileName = extractFileName(href);
    links.push({ url: href, text: fileName, fileName, category: guessCategory('', fileName) });
  }

  return links;
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    if (href.startsWith('//')) return 'https:' + href;
    if (href.startsWith('/')) return new URL(baseUrl).origin + href;
    if (href.startsWith('http')) return href;
    return new URL(baseUrl).origin + '/' + href;
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════
// Fund document scraping (from aifmgroup.com pages)
// ═══════════════════════════════════════════════

interface ScrapeResult {
  fundId: string;
  discovered: number;
  newDocs: number;
  updatedDocs: number;
  skipped: number;
  errors: number;
  details: string[];
}

async function scrapeFundDocuments(
  fundId: string,
  pageUrl: string,
  dryRun: boolean,
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    fundId,
    discovered: 0,
    newDocs: 0,
    updatedDocs: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const html = await fetchPage(pageUrl);
  if (!html) {
    result.errors = 1;
    result.details.push(`Could not fetch page: ${pageUrl}`);
    return result;
  }

  const pdfLinks = discoverPdfLinks(html, pageUrl);
  result.discovered = pdfLinks.length;

  if (pdfLinks.length === 0) {
    result.details.push('No PDF links found on page');
    return result;
  }

  const existingDocs = await getFundDocuments(fundId);
  const existingByName = new Map<string, { fileSize: number; documentId: string; s3Key: string }>();
  for (const doc of existingDocs) {
    existingByName.set(doc.fileName.toLowerCase(), {
      fileSize: doc.fileSize,
      documentId: doc.documentId,
      s3Key: doc.s3Key,
    });
  }

  for (const link of pdfLinks) {
    const existing = existingByName.get(link.fileName.toLowerCase());

    if (dryRun) {
      if (existing) {
        result.skipped++;
        result.details.push(`[exists] ${link.fileName}`);
      } else {
        result.newDocs++;
        result.details.push(`[new] ${link.fileName} (${link.category})`);
      }
      continue;
    }

    const buf = await fetchPdfBuffer(link.url);
    if (!buf) {
      result.errors++;
      continue;
    }

    if (existing && existing.fileSize === buf.length) {
      result.skipped++;
      continue;
    }

    if (existing && existing.fileSize !== buf.length) {
      result.updatedDocs++;
      result.details.push(`[updated] ${link.fileName}: ${existing.fileSize} -> ${buf.length} bytes`);
    } else {
      result.newDocs++;
      result.details.push(`[new] ${link.fileName}`);
    }

    const documentId = existing?.documentId || genFundDocId();
    const safeFileName = link.fileName.replace(/[^\x20-\x7E]/g, '_');
    const s3Key = existing?.s3Key || `funds/${fundId}/${link.category}/${safeFileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buf,
        ContentType: 'application/pdf',
        Metadata: {
          fundId,
          originalFilename: safeFileName,
          uploadedBy: 'scheduled-scraper',
          contentHash: contentHash(buf),
        },
      }),
    );

    const textContent = await extractTextWithTextract(buf);

    await saveFundDocument({
      fundId,
      documentId,
      fileName: link.fileName,
      fileType: 'application/pdf',
      fileSize: buf.length,
      s3Key,
      category: link.category,
      uploadedBy: 'scheduled-scraper',
      uploadedAt: new Date().toISOString(),
      textContent: textContent || undefined,
    });
  }

  return result;
}

// ═══════════════════════════════════════════════
// Holding document scraping (company IR pages)
// ═══════════════════════════════════════════════

async function scrapeHoldingDocumentsForFund(
  fundId: string,
  dryRun: boolean,
): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    fundId: `holdings:${fundId}`,
    discovered: 0,
    newDocs: 0,
    updatedDocs: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  let positions: Array<{
    instrumentId: string;
    instrumentName: string;
    isin?: string;
  }> = [];

  try {
    const { DynamoDBStorage } = await import('@/lib/fund-registry/dynamo-storage');
    const { FundRegistry } = await import('@/lib/fund-registry/fund-registry');
    const table = process.env.FUND_REGISTRY_TABLE || 'aifm-fund-registry';
    const storage = new DynamoDBStorage(table);
    const registry = new FundRegistry(storage);
    const today = new Date().toISOString().split('T')[0];
    const rawPositions = await registry.getPositions(fundId, today);
    positions = rawPositions.map((p) => ({
      instrumentId: p.instrumentId || p.instrumentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      instrumentName: p.instrumentName,
      isin: p.isin,
    }));
  } catch (e) {
    result.details.push(`Could not fetch positions for ${fundId}: ${(e as Error).message}`);
    return result;
  }

  if (positions.length === 0) {
    result.details.push(`No positions found for ${fundId}`);
    return result;
  }

  result.details.push(`Processing ${positions.length} holdings for ${fundId}`);

  for (const pos of positions) {
    try {
      const existingNames = await getExistingHoldingFileNames(pos.instrumentId);

      const { discoverIRDocuments } = await import('@/lib/holding-documents/ir-discoverer');
      const { resolveCompany } = await import('@/lib/holding-documents/company-resolver');

      const resolved = await resolveCompany(pos.instrumentName, {
        isin: pos.isin,
      });

      const discovered = await discoverIRDocuments(
        resolved.name,
        resolved.ticker,
        resolved.website,
      );

      const pdfDocs = discovered
        .filter((d) => /\.pdf($|\?)/i.test(d.url))
        .slice(0, 8);

      result.discovered += pdfDocs.length;

      for (const doc of pdfDocs) {
        const fileName = extractFileName(doc.url);
        if (existingNames.has(fileName.toLowerCase())) {
          result.skipped++;
          continue;
        }

        if (dryRun) {
          result.newDocs++;
          result.details.push(`[new] ${pos.instrumentName}: ${fileName}`);
          continue;
        }

        const buf = await fetchPdfBuffer(doc.url);
        if (!buf) {
          result.errors++;
          continue;
        }

        result.newDocs++;
        result.details.push(`[new] ${pos.instrumentName}: ${fileName}`);

        const documentId = genHoldingDocId();
        const category = doc.category.replace(/_/g, '-');
        const safeFileName = fileName.replace(/[^\x20-\x7E]/g, '_');
        const s3Key = `holdings/${pos.instrumentId}/${category}/${safeFileName}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: buf,
            ContentType: 'application/pdf',
            Metadata: {
              instrumentId: pos.instrumentId,
              fundId,
              uploadedBy: 'scheduled-scraper',
              contentHash: contentHash(buf),
            },
          }),
        );

        const textContent = await extractTextWithTextract(buf);

        const holdingDoc: HoldingDocument = {
          instrumentId: pos.instrumentId,
          documentId,
          instrumentName: pos.instrumentName,
          fundId,
          fileName,
          fileType: 'application/pdf',
          fileSize: buf.length,
          s3Key,
          category: doc.category as HoldingDocumentCategory,
          sourceUrl: doc.url,
          scrapedAt: new Date().toISOString(),
        };
        if (textContent) holdingDoc.textContent = textContent;

        await saveHoldingDocument(holdingDoc);
      }
    } catch (e) {
      result.errors++;
      result.details.push(`Error: ${pos.instrumentName}: ${(e as Error).message}`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════
// API Handler
// ═══════════════════════════════════════════════

function isAuthorized(req: NextRequest): boolean {
  const role = req.headers.get('x-aifm-role');
  if (role === 'admin') return true;

  const cronSecret = process.env.AIFM_CRON_SECRET || process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret = req.headers.get('x-aifm-cron-secret');
    if (headerSecret === cronSecret) return true;
    const authHeader = req.headers.get('authorization');
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'all';
  const specificFundId = url.searchParams.get('fundId') || undefined;
  const dryRun = url.searchParams.get('dryRun') === 'true';

  const startTime = Date.now();
  const results: ScrapeResult[] = [];

  console.log(`[Scheduled Scraper] Starting. type=${type}, fundId=${specificFundId || 'all'}, dryRun=${dryRun}`);

  // Scrape fund document pages (fondvillkor, faktablad, etc.)
  if (type === 'all' || type === 'funds') {
    const targets = specificFundId
      ? FUND_SCRAPE_URLS.filter((f) => f.fundId === specificFundId)
      : FUND_SCRAPE_URLS;

    for (const target of targets) {
      try {
        console.log(`[Scheduled Scraper] Fund docs: ${target.fundId}`);
        const r = await scrapeFundDocuments(target.fundId, target.url, dryRun);
        results.push(r);
      } catch (e) {
        console.error(`[Scheduled Scraper] Error scraping fund ${target.fundId}:`, e);
        results.push({
          fundId: target.fundId,
          discovered: 0,
          newDocs: 0,
          updatedDocs: 0,
          skipped: 0,
          errors: 1,
          details: [(e as Error).message],
        });
      }
    }
  }

  // Scrape holding IR documents
  if (type === 'all' || type === 'holdings') {
    const fundIds = specificFundId
      ? [specificFundId]
      : FUND_SCRAPE_URLS.map((f) => f.fundId);

    for (const fid of fundIds) {
      try {
        console.log(`[Scheduled Scraper] Holding docs: ${fid}`);
        const r = await scrapeHoldingDocumentsForFund(fid, dryRun);
        results.push(r);
      } catch (e) {
        console.error(`[Scheduled Scraper] Error scraping holdings for ${fid}:`, e);
        results.push({
          fundId: `holdings:${fid}`,
          discovered: 0,
          newDocs: 0,
          updatedDocs: 0,
          skipped: 0,
          errors: 1,
          details: [(e as Error).message],
        });
      }
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);

  const summary = {
    totalFunds: results.length,
    totalDiscovered: results.reduce((s, r) => s + r.discovered, 0),
    totalNew: results.reduce((s, r) => s + r.newDocs, 0),
    totalUpdated: results.reduce((s, r) => s + r.updatedDocs, 0),
    totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
    totalErrors: results.reduce((s, r) => s + r.errors, 0),
    elapsedSeconds: elapsed,
    dryRun,
    timestamp: new Date().toISOString(),
  };

  console.log(`[Scheduled Scraper] Done.`, JSON.stringify(summary));

  return NextResponse.json({
    success: true,
    summary,
    results: results.map((r) => ({
      ...r,
      details: r.details.slice(0, 50),
    })),
  });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'scheduled-scraper',
    description: 'Weekly document scraper for fund and holding documents',
    usage: {
      method: 'POST',
      auth: 'x-aifm-role: admin OR x-aifm-cron-secret: <secret>',
      queryParams: {
        type: 'funds | holdings | all (default: all)',
        fundId: 'specific fund ID (optional)',
        dryRun: 'true to discover only (default: false)',
      },
    },
    registeredFunds: FUND_SCRAPE_URLS.map((f) => f.fundId),
    totalFunds: FUND_SCRAPE_URLS.length,
  });
}
