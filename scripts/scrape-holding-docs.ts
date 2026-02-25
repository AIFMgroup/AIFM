#!/usr/bin/env npx tsx
/**
 * Scrape holding (company) IR documents: annual reports, sustainability, etc.
 * Resolves company name -> website/ticker, discovers PDFs, uploads to S3, Textract, DynamoDB.
 *
 * Single company:
 *   npx tsx scripts/scrape-holding-docs.ts --name "RIO TINTO PLC" --fundId arte-collectum-i
 *
 * Batch (all positions for a fund):
 *   npx tsx scripts/scrape-holding-docs.ts --fundId arte-collectum-i --all
 *
 * Dry run (discover only, no download/upload):
 *   npx tsx scripts/scrape-holding-docs.ts --name "RIO TINTO PLC" --fundId x --dry-run
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { randomUUID } from 'crypto';
import {
  resolveCompany,
  discoverIRDocuments,
  getExistingFileNames,
  saveHoldingDocument,
  generateDocumentId,
  type HoldingDocument,
  type HoldingDocumentCategory,
} from '../lib/holding-documents';
import { DynamoDBStorage } from '../lib/fund-registry/dynamo-storage';

const CATEGORY_TO_S3_FOLDER: Record<HoldingDocumentCategory, string> = {
  annual_report: 'annual-report',
  quarterly_report: 'quarterly-report',
  sustainability_report: 'sustainability',
  investor_presentation: 'investor-presentation',
  governance: 'governance',
  other: 'other',
};

function guessCategory(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('sustainability') || lower.includes('esg') || lower.includes('climate')) return 'sustainability';
  if (lower.includes('annual') || lower.includes('arsredovisning') || lower.includes('arsberattelse')) return 'annual-report';
  if (lower.includes('quarterly') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4') || lower.includes('interim') || lower.includes('halvars')) return 'quarterly-report';
  if (lower.includes('investor') || lower.includes('presentation') || lower.includes('factsheet')) return 'investor-presentation';
  if (lower.includes('governance') || lower.includes('code-of-conduct') || lower.includes('policy') || lower.includes('slavery')) return 'governance';
  if (lower.includes('earnings') || lower.includes('financial') || lower.includes('results') || lower.includes('report')) return 'financial-reports';
  return 'other';
}
import { FundRegistry } from '../lib/fund-registry/fund-registry';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.HOLDING_DOCUMENTS_BUCKET || 'aifm-documents';
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const PDF_DOWNLOAD_TIMEOUT_MS = 15000;

const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: 'eu-west-1' });

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

function parseArgs(): {
  name?: string;
  fundId: string;
  all: boolean;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  let name: string | undefined;
  let fundId = '';
  let all = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i];
    } else if (args[i] === '--fundId' && args[i + 1]) {
      fundId = args[++i];
    } else if (args[i] === '--all') {
      all = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }
  return { name, fundId, all, dryRun };
}

function toInstrumentId(name: string, isin?: string): string {
  if (isin && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return isin;
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
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

async function fetchPdfBuffer(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PDF_DOWNLOAD_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000 || buf.length > MAX_PDF_BYTES) return null;
    return buf;
  } catch {
    return null;
  }
}

async function extractTextWithTextract(buffer: Buffer): Promise<string> {
  if (buffer.length > 5 * 1024 * 1024) {
    return '[Document too large for Textract inline]';
  }
  try {
    const res = await textract.send(
      new DetectDocumentTextCommand({ Document: { Bytes: buffer } }),
    );
    return (res.Blocks || [])
      .filter((b) => b.BlockType === 'LINE')
      .map((b) => b.Text)
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    console.warn('  Textract failed:', (err as Error).message);
    return '';
  }
}

async function processOneCompany(
  companyName: string,
  fundId: string,
  instrumentId: string,
  dryRun: boolean,
): Promise<{ ok: number; skip: number; err: number }> {
  let ok = 0,
    skip = 0,
    err = 0;

  console.log('\n--- Resolving:', companyName);
  const resolved = await resolveCompany(companyName);
  console.log(
    '  Resolved:',
    resolved.name,
    '| ticker:',
    resolved.ticker,
    '| website:',
    resolved.website ?? '(none)',
  );

  console.log('  Discovering IR documents...');
  const discovered = await discoverIRDocuments(
    resolved.name,
    resolved.ticker,
    resolved.website,
  );
  console.log('  Found', discovered.length, 'document(s)');

  const pdfDocs = discovered
    .filter((d) => /\.pdf($|\?)/i.test(d.url))
    .slice(0, 12);

  if (dryRun) {
    pdfDocs.forEach((d) =>
      console.log('    [dry-run]', d.category, d.title || d.url),
    );
    return { ok: 0, skip: 0, err: 0 };
  }

  const existingNames = await getExistingFileNames(instrumentId);

  for (const doc of pdfDocs) {
    const fileName = extractFileName(doc.url);
    if (existingNames.has(fileName.toLowerCase())) {
      console.log('  Skip (exists):', fileName);
      skip++;
      continue;
    }

    console.log('  Downloading:', fileName);
    const buf = await fetchPdfBuffer(doc.url);
    if (!buf) {
      console.log('  Failed to download');
      err++;
      continue;
    }
    console.log('  Size:', Math.round(buf.length / 1024), 'KB');

    const documentId = generateDocumentId();
    const safeFileName = fileName.replace(/[^\x20-\x7E]/g, '_');
    const category = guessCategory(fileName);
    const s3Key = `holdings/${instrumentId}/${category}/${safeFileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buf,
        ContentType: 'application/pdf',
        Metadata: {
          instrumentId,
          fundId,
          originalFilename: safeFileName,
          uploadedBy: 'scrape-holding-docs',
        },
      }),
    );
    console.log('  Uploaded S3:', s3Key);

    const textContent = await extractTextWithTextract(buf);
    console.log('  Textract:', textContent.length, 'chars');

    const holdingDoc: HoldingDocument = {
      instrumentId,
      documentId,
      instrumentName: companyName,
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
    console.log('  Saved DynamoDB:', documentId);
    ok++;
  }

  return { ok, skip, err };
}

async function main(): Promise<void> {
  const { name, fundId, all, dryRun } = parseArgs();

  if (!fundId) {
    console.error('Usage:');
    console.error(
      '  npx tsx scripts/scrape-holding-docs.ts --name "RIO TINTO PLC" --fundId <fundId> [--dry-run]',
    );
    console.error(
      '  npx tsx scripts/scrape-holding-docs.ts --fundId <fundId> --all [--dry-run]',
    );
    process.exit(1);
  }

  if (all) {
    const table = process.env.FUND_REGISTRY_TABLE || 'aifm-fund-registry';
    const storage = new DynamoDBStorage(table);
    const registry = new FundRegistry(storage);
    const targetDate = new Date().toISOString().split('T')[0];
    const positions = await registry.getPositions(fundId, targetDate);
    if (positions.length === 0) {
      console.log('No positions found for fund', fundId, 'on', targetDate);
      process.exit(0);
    }
    console.log('Batch: scraping', positions.length, 'holdings for fund', fundId);
    let totalOk = 0,
      totalSkip = 0,
      totalErr = 0;
    for (const pos of positions) {
      const instrumentId =
        pos.instrumentId || toInstrumentId(pos.instrumentName, pos.isin);
      try {
        const { ok, skip, err } = await processOneCompany(
          pos.instrumentName,
          fundId,
          instrumentId,
          dryRun,
        );
        totalOk += ok;
        totalSkip += skip;
        totalErr += err;
      } catch (e) {
        console.error('Error processing', pos.instrumentName, e);
        totalErr++;
      }
    }
    console.log('\nDone. Saved:', totalOk, 'Skip:', totalSkip, 'Errors:', totalErr);
    return;
  }

  if (!name) {
    console.error('Provide --name "Company Name" or --all with --fundId');
    process.exit(1);
  }

  const instrumentId = toInstrumentId(name);
  const { ok, skip, err } = await processOneCompany(
    name,
    fundId,
    instrumentId,
    dryRun,
  );
  console.log('\nDone. Saved:', ok, 'Skip:', skip, 'Errors:', err);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
