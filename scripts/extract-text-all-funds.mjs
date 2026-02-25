#!/usr/bin/env node
/**
 * Extract text from all fund documents across all funds using pdf-parse.
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const REGION = 'eu-north-1';
const S3_BUCKET = 'aifm-documents';
const TABLE = 'aifm-fund-documents';

const s3 = new S3Client({ region: REGION });
const ddb = new DynamoDBClient({ region: REGION });

console.log(`\n📄 Scanning all fund documents for text extraction...\n`);

let lastKey = undefined;
let totalDocs = 0;
let extracted = 0;
let skipped = 0;
let errors = 0;

do {
  const params = { TableName: TABLE, ExclusiveStartKey: lastKey };
  const res = await ddb.send(new ScanCommand(params));
  const items = res.Items || [];
  lastKey = res.LastEvaluatedKey;

  for (const item of items) {
    totalDocs++;
    const fundId = item.fundId?.S || '?';
    const docId = item.documentId?.S;
    const fileName = item.fileName?.S || 'unknown';
    const s3Key = item.s3Key?.S;
    const existingText = item.textContent?.S;

    if (existingText && existingText.length > 50) {
      skipped++;
      continue;
    }

    if (!s3Key) {
      errors++;
      continue;
    }

    try {
      const s3Res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      const chunks = [];
      for await (const chunk of s3Res.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const parsed = await pdfParse(buffer);
      const textContent = (parsed.text || '').trim();

      if (textContent.length > 0) {
        const truncated = textContent.length > 400000 ? textContent.slice(0, 400000) : textContent;
        await ddb.send(new UpdateItemCommand({
          TableName: TABLE,
          Key: { fundId: { S: fundId }, documentId: { S: docId } },
          UpdateExpression: 'SET textContent = :tc',
          ExpressionAttributeValues: { ':tc': { S: truncated } },
        }));
        extracted++;
        if (extracted % 25 === 0) {
          console.log(`  📊 Progress: ${extracted} extracted, ${skipped} skipped, ${errors} errors (${totalDocs} total scanned)`);
        }
      }
    } catch (err) {
      errors++;
    }
  }
} while (lastKey);

console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 TOTAL: ${totalDocs} dokument`);
console.log(`   ✅ Text extraherad: ${extracted}`);
console.log(`   ⏭  Redan klara: ${skipped}`);
console.log(`   ❌ Fel: ${errors}`);
console.log(`${'═'.repeat(50)}\n`);
