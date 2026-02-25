#!/usr/bin/env node
/**
 * Extract text from existing fund documents that don't have textContent.
 * Downloads PDF from S3, extracts text with pdf-parse, updates DynamoDB.
 *
 * Usage:
 *   node scripts/extract-text-fund-docs.mjs <fundId>
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const REGION = 'eu-north-1';
const S3_BUCKET = 'aifm-documents';
const TABLE = 'aifm-fund-documents';

const s3 = new S3Client({ region: REGION });
const ddb = new DynamoDBClient({ region: REGION });

const [,, fundId] = process.argv;
if (!fundId) {
  console.error('Usage: node scripts/extract-text-fund-docs.mjs <fundId>');
  process.exit(1);
}

console.log(`\n📄 Extracting text for fund: ${fundId}\n`);

const res = await ddb.send(new QueryCommand({
  TableName: TABLE,
  KeyConditionExpression: 'fundId = :fid',
  ExpressionAttributeValues: { ':fid': { S: fundId } },
}));

const docs = res.Items || [];
console.log(`Found ${docs.length} documents\n`);

let extracted = 0;
let skipped = 0;
let errors = 0;

for (const item of docs) {
  const docId = item.documentId?.S;
  const fileName = item.fileName?.S || 'unknown';
  const s3Key = item.s3Key?.S;
  const existingText = item.textContent?.S;

  if (existingText && existingText.length > 50) {
    console.log(`⏭  SKIP (already has text): ${fileName} (${existingText.length} chars)`);
    skipped++;
    continue;
  }

  if (!s3Key) {
    console.log(`❌ No S3 key for ${fileName}`);
    errors++;
    continue;
  }

  console.log(`🔤 Processing: ${fileName}`);

  try {
    const s3Res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
    const chunks = [];
    for await (const chunk of s3Res.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    console.log(`  📏 Size: ${Math.round(buffer.length / 1024)} KB`);

    const parsed = await pdfParse(buffer);
    const textContent = (parsed.text || '').trim();
    console.log(`  📝 Extracted ${textContent.length} characters, ${parsed.numpages} pages`);

    if (textContent.length > 0) {
      const truncated = textContent.length > 400000 ? textContent.slice(0, 400000) : textContent;
      await ddb.send(new UpdateItemCommand({
        TableName: TABLE,
        Key: { fundId: { S: fundId }, documentId: { S: docId } },
        UpdateExpression: 'SET textContent = :tc',
        ExpressionAttributeValues: { ':tc': { S: truncated } },
      }));
      console.log(`  ✅ Updated in DynamoDB (${truncated.length} chars stored)`);
      extracted++;
    } else {
      console.log(`  ⚠ No text found in PDF`);
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    errors++;
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`✅ Klart! ${extracted} extraherade, ${skipped} redan klara, ${errors} fel`);
console.log(`${'═'.repeat(50)}\n`);
