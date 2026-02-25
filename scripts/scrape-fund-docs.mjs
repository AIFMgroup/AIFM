#!/usr/bin/env node
/**
 * Scrape fund documents from a URL, download PDFs, upload to S3,
 * extract text with Textract, and save to DynamoDB.
 *
 * Usage:
 *   node scripts/scrape-fund-docs.mjs <url> <fundId>
 *
 * Example:
 *   node scripts/scrape-fund-docs.mjs https://aifmgroup.com/arte-collectum-i-ab/ arte-collectum-i
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';
import https from 'https';
import http from 'http';

const REGION = 'eu-north-1';
const S3_BUCKET = 'aifm-documents';
const TABLE = 'aifm-fund-documents';

const s3 = new S3Client({ region: REGION });
const textract = new TextractClient({ region: 'eu-west-1' });
const ddb = new DynamoDBClient({ region: REGION });

// ── Helpers ──

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIFM-Bot/1.0)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), statusCode: res.statusCode }));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

function guessCategory(text, fileName) {
  const lower = (text + ' ' + fileName).toLowerCase();
  if (lower.includes('delårsrapport') || lower.includes('delarsrapport') || lower.includes('semi-annual') || lower.includes('halvårs') || lower.includes('halvarsredogorelse') || lower.includes('halvårsredogörelse')) return 'arsredovisning';
  if (lower.includes('årsredovisning') || lower.includes('arsredovisning') || lower.includes('annual report') || lower.includes('arsberattelse') || lower.includes('årsberättelse')) return 'arsredovisning';
  if (lower.includes('fondvillkor') || lower.includes('fondbestammelser') || lower.includes('fondbestämmelser') || lower.includes('grundprospekt') || lower.includes('prospekt')) return 'fondvillkor';
  if (lower.includes('hållbarhet') || lower.includes('sustainability') || lower.includes('sfdr') || lower.includes('upplysningar')) return 'hallbarhetsrapport';
  if (lower.includes('informationsbroschyr') || lower.includes('information memorandum') || lower.includes('broschyr')) return 'informationsbroschyr';
  if (lower.includes('faktablad') || lower.includes('priip') || lower.includes('key information')) return 'faktablad';
  if (lower.includes('placering') || lower.includes('policy')) return 'placeringspolicy';
  return 'ovrigt';
}

function extractFileName(url) {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || 'document.pdf');
  } catch {
    return 'document.pdf';
  }
}

async function extractText(buffer) {
  if (buffer.length > 5 * 1024 * 1024) {
    return '[Dokumentet är för stort för Textract inline – behöver async job]';
  }
  try {
    const res = await textract.send(new DetectDocumentTextCommand({ Document: { Bytes: buffer } }));
    return (res.Blocks || []).filter(b => b.BlockType === 'LINE').map(b => b.Text).filter(Boolean).join('\n');
  } catch (err) {
    console.warn(`  ⚠ Textract failed: ${err.message}`);
    return '';
  }
}

async function getExistingDocNames(fundId) {
  const res = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'fundId = :fid',
    ExpressionAttributeValues: { ':fid': { S: fundId } },
    ProjectionExpression: 'fileName',
  }));
  return new Set((res.Items || []).map(i => (i.fileName?.S || '').toLowerCase()));
}

// ── Main ──

const [,, pageUrl, fundId] = process.argv;

if (!pageUrl || !fundId) {
  console.error('Usage: node scripts/scrape-fund-docs.mjs <url> <fundId>');
  process.exit(1);
}

console.log(`\n🔍 Scraping: ${pageUrl}`);
console.log(`📁 Fund ID:  ${fundId}\n`);

// Step 1: Fetch page and find PDF links
const { buffer: htmlBuf } = await fetchUrl(pageUrl);
const html = htmlBuf.toString('utf-8');

const linkRegex = /<a\s[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
const pdfLinks = [];
const seen = new Set();
let match;

while ((match = linkRegex.exec(html)) !== null) {
  let href = match[1];
  const linkText = match[2].replace(/<[^>]+>/g, '').trim();

  if (href.startsWith('/')) {
    const base = new URL(pageUrl);
    href = `${base.origin}${href}`;
  } else if (!href.startsWith('http')) {
    const base = new URL(pageUrl);
    href = `${base.origin}/${href}`;
  }

  if (seen.has(href)) continue;
  seen.add(href);

  const fileName = extractFileName(href);
  pdfLinks.push({ url: href, text: linkText || fileName, fileName, category: guessCategory(linkText, fileName) });
}

console.log(`📄 Found ${pdfLinks.length} PDF links:\n`);
for (const link of pdfLinks) {
  console.log(`  • ${link.text}`);
  console.log(`    ${link.fileName} [${link.category}]`);
}

// Step 2: Check existing
const existingNames = await getExistingDocNames(fundId);
console.log(`\n📦 Existing documents for ${fundId}: ${existingNames.size}`);

// Step 3: Download and ingest each PDF
let okCount = 0, skipCount = 0, errCount = 0;

for (const link of pdfLinks) {
  if (existingNames.has(link.fileName.toLowerCase())) {
    console.log(`\n⏭  SKIP (already exists): ${link.fileName}`);
    skipCount++;
    continue;
  }

  console.log(`\n⬇️  Downloading: ${link.fileName}`);
  try {
    const { buffer: pdfBuf, statusCode } = await fetchUrl(link.url);
    if (statusCode !== 200) {
      console.log(`  ❌ HTTP ${statusCode}`);
      errCount++;
      continue;
    }

    console.log(`  📏 Size: ${Math.round(pdfBuf.length / 1024)} KB`);

    // Upload to S3
    const documentId = randomUUID();
    const safeFileName = link.fileName.replace(/[^\x20-\x7E]/g, '_');
    const s3Key = `funds/${fundId}/${link.category}/${safeFileName}`;
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: pdfBuf,
      ContentType: 'application/pdf',
      Metadata: { fundId, originalFilename: safeFileName, uploadedBy: 'scraper' },
    }));
    console.log(`  ☁️  Uploaded to S3: ${s3Key}`);

    // Extract text
    console.log(`  🔤 Extracting text...`);
    const textContent = await extractText(pdfBuf);
    console.log(`  📝 Extracted ${textContent.length} characters`);

    // Save to DynamoDB
    const item = {
      fundId: { S: fundId },
      documentId: { S: documentId },
      fileName: { S: link.fileName },
      fileType: { S: 'application/pdf' },
      fileSize: { N: String(pdfBuf.length) },
      s3Key: { S: s3Key },
      category: { S: link.category },
      uploadedBy: { S: 'scraper' },
      uploadedAt: { S: new Date().toISOString() },
    };
    if (textContent) item.textContent = { S: textContent };

    await ddb.send(new PutItemCommand({ TableName: TABLE, Item: item }));
    console.log(`  ✅ Saved: ${documentId}`);
    okCount++;
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    errCount++;
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`✅ Klart! ${okCount} nedladdade, ${skipCount} hoppade över, ${errCount} fel`);
console.log(`${'═'.repeat(50)}\n`);
