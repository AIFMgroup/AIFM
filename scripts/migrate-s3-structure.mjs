#!/usr/bin/env node
/**
 * S3 & DynamoDB Structure Migration
 *
 * Reorganizes the aifm-documents bucket from flat structure to category-based:
 *
 * OLD:  fund-documents/{fundId}/{uuid}-{filename}.pdf
 * NEW:  funds/{fundId}/{category}/{filename}.pdf
 *
 * OLD:  holding-documents/{company}/{uuid}-{filename}.pdf
 * NEW:  holdings/{instrumentId}/{category}/{filename}.pdf
 *
 * OLD:  esg/{file}
 * NEW:  templates/esg/{file}
 *
 * Also:
 * - Updates s3Key in aifm-fund-documents DynamoDB
 * - Creates entries in aifm-holding-documents DynamoDB for each holding doc
 */

import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import crypto from 'crypto';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const BUCKET = process.env.AWS_S3_BUCKET || 'aifm-documents';
const DRY_RUN = process.argv.includes('--dry-run');

const s3 = new S3Client({ region: REGION });
const ddb = new DynamoDBClient({ region: REGION });

const stats = { copied: 0, skipped: 0, errors: 0, ddbUpdated: 0, ddbCreated: 0 };

// ─────────────────────────────────────────────────────────────
// Category mapping for fund documents
// ─────────────────────────────────────────────────────────────
const FUND_CATEGORIES = {
  fondvillkor: 'fondvillkor',
  arsredovisning: 'arsredovisning',
  delarsrapport: 'arsredovisning',
  faktablad: 'faktablad',
  informationsbroschyr: 'informationsbroschyr',
  hallbarhetsrapport: 'hallbarhet',
  placeringspolicy: 'fondvillkor',
  ovrigt: 'ovrigt',
};

// Category mapping for holding documents (guessed from filename)
function guessHoldingCategory(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('sustainability') || lower.includes('esg') || lower.includes('hallbarhet') || lower.includes('climate') || lower.includes('ghg') || lower.includes('biodiver')) return 'sustainability';
  if (lower.includes('annual-report') || lower.includes('annual report') || lower.includes('arsredovisning') || lower.includes('arsberattelse') || lower.includes('annual_report') || lower.includes('-ar-') || lower.includes('-ar2')) return 'annual-report';
  if (lower.includes('quarterly') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3') || lower.includes('q4') || lower.includes('interim') || lower.includes('halvars') || lower.includes('delars')) return 'quarterly-report';
  if (lower.includes('investor') || lower.includes('presentation') || lower.includes('factsheet') || lower.includes('fact-sheet') || lower.includes('corporate-presentation')) return 'investor-presentation';
  if (lower.includes('governance') || lower.includes('code-of-conduct') || lower.includes('code_of_conduct') || lower.includes('policy') || lower.includes('slavery') || lower.includes('proxy') || lower.includes('charter') || lower.includes('whistleblow')) return 'governance';
  if (lower.includes('earnings') || lower.includes('financial') || lower.includes('results') || lower.includes('revenue') || lower.includes('mda') || lower.includes('press-release') || lower.includes('report')) return 'financial-reports';
  return 'other';
}

// Strip UUID prefix from filename: "7405c9c7-2c76-4f54-8bf0-1c128bb79ba3-Filename.pdf" -> "Filename.pdf"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;
function cleanFileName(key) {
  const parts = key.split('/');
  const file = parts[parts.length - 1];
  return file.replace(UUID_RE, '');
}

async function copyObject(oldKey, newKey) {
  if (DRY_RUN) {
    console.log(`  [DRY] ${oldKey} → ${newKey}`);
    stats.copied++;
    return true;
  }
  try {
    // Check if destination already exists
    try {
      await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: newKey }));
      stats.skipped++;
      return true;
    } catch {}

    await s3.send(new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${encodeURIComponent(oldKey)}`,
      Key: newKey,
    }));
    stats.copied++;
    return true;
  } catch (err) {
    console.error(`  ERROR copying ${oldKey}: ${err.message}`);
    stats.errors++;
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 1. MIGRATE FUND DOCUMENTS
// ─────────────────────────────────────────────────────────────
async function migrateFundDocuments() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 1: Migrating fund-documents → funds/');
  console.log('═══════════════════════════════════════════════\n');

  // Get all items from DynamoDB (they have category info)
  let items = [];
  let lastKey = undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: 'aifm-fund-documents',
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${items.length} fund document records\n`);

  for (const item of items) {
    const fundId = item.fundId?.S;
    const docId = item.documentId?.S;
    const oldS3Key = item.s3Key?.S;
    const category = item.category?.S || 'ovrigt';
    const fileName = item.fileName?.S || cleanFileName(oldS3Key || '');

    if (!fundId || !docId || !oldS3Key) continue;

    const mappedCategory = FUND_CATEGORIES[category] || 'ovrigt';
    const cleanName = cleanFileName(oldS3Key);
    const newS3Key = `funds/${fundId}/${mappedCategory}/${cleanName}`;

    if (oldS3Key === newS3Key) {
      stats.skipped++;
      continue;
    }

    const ok = await copyObject(oldS3Key, newS3Key);
    if (ok) {
      // Update DynamoDB with new s3Key
      if (!DRY_RUN) {
        try {
          await ddb.send(new UpdateItemCommand({
            TableName: 'aifm-fund-documents',
            Key: { fundId: { S: fundId }, documentId: { S: docId } },
            UpdateExpression: 'SET s3Key = :sk',
            ExpressionAttributeValues: { ':sk': { S: newS3Key } },
          }));
          stats.ddbUpdated++;
        } catch (err) {
          console.error(`  DDB update error for ${fundId}/${docId}: ${err.message}`);
        }
      } else {
        console.log(`  [DRY] DDB update: s3Key → ${newS3Key}`);
        stats.ddbUpdated++;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. MIGRATE HOLDING DOCUMENTS + CREATE DDB ENTRIES
// ─────────────────────────────────────────────────────────────
async function migrateHoldingDocuments() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 2: Migrating holding-documents → holdings/');
  console.log('          + Creating DynamoDB entries');
  console.log('═══════════════════════════════════════════════\n');

  let continuationToken = undefined;
  let totalObjects = 0;

  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'holding-documents/',
      ContinuationToken: continuationToken,
    }));

    for (const obj of (res.Contents || [])) {
      const oldKey = obj.Key;
      const size = obj.Size || 0;
      totalObjects++;

      // Parse: holding-documents/{company}/{uuid}-{filename}
      const parts = oldKey.split('/');
      if (parts.length < 3) continue;

      const instrumentId = parts[1];
      const rawFile = parts.slice(2).join('/');
      const cleanName = cleanFileName(rawFile);
      const category = guessHoldingCategory(cleanName);
      const newKey = `holdings/${instrumentId}/${category}/${cleanName}`;

      const ok = await copyObject(oldKey, newKey);
      if (ok) {
        // Create DynamoDB entry
        const documentId = crypto.randomUUID();
        const extension = cleanName.split('.').pop()?.toLowerCase() || '';
        const contentType = extension === 'pdf' ? 'application/pdf'
          : extension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/octet-stream';

        if (!DRY_RUN) {
          try {
            await ddb.send(new PutItemCommand({
              TableName: 'aifm-holding-documents',
              Item: {
                instrumentId: { S: instrumentId },
                documentId: { S: documentId },
                instrumentName: { S: instrumentId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) },
                fundId: { S: 'unassigned' },
                fileName: { S: cleanName },
                fileType: { S: contentType },
                fileSize: { N: String(size) },
                s3Key: { S: newKey },
                s3Bucket: { S: BUCKET },
                category: { S: category },
                sourceUrl: { S: '' },
                scrapedAt: { S: obj.LastModified?.toISOString() || new Date().toISOString() },
              },
              ConditionExpression: 'attribute_not_exists(instrumentId)',
            }));
            stats.ddbCreated++;
          } catch (err) {
            if (err.name !== 'ConditionalCheckFailedException') {
              console.error(`  DDB create error for ${instrumentId}: ${err.message}`);
            }
          }
        } else {
          console.log(`  [DRY] DDB create: ${instrumentId}/${category}/${cleanName}`);
          stats.ddbCreated++;
        }
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  console.log(`Processed ${totalObjects} holding objects`);
}

// ─────────────────────────────────────────────────────────────
// 3. MIGRATE ESG TEMPLATES
// ─────────────────────────────────────────────────────────────
async function migrateEsgTemplates() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  STEP 3: Migrating esg/ → templates/esg/');
  console.log('═══════════════════════════════════════════════\n');

  const res = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'esg/',
  }));

  for (const obj of (res.Contents || [])) {
    const oldKey = obj.Key;
    const fileName = oldKey.split('/').pop();
    const newKey = `templates/esg/${fileName}`;
    await copyObject(oldKey, newKey);
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  S3 & DynamoDB Structure Migration`);
  console.log(`  Bucket: ${BUCKET}`);
  console.log(`  Region: ${REGION}`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`${'═'.repeat(60)}`);

  await migrateFundDocuments();
  await migrateHoldingDocuments();
  await migrateEsgTemplates();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  MIGRATION COMPLETE`);
  console.log(`  S3 copied:      ${stats.copied}`);
  console.log(`  S3 skipped:     ${stats.skipped}`);
  console.log(`  S3 errors:      ${stats.errors}`);
  console.log(`  DDB updated:    ${stats.ddbUpdated}`);
  console.log(`  DDB created:    ${stats.ddbCreated}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (DRY_RUN) {
    console.log('This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to execute.\n');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
