/**
 * Seed Compliance Database
 * 
 * Fyller databasen med fördefinierade regelverk.
 * Usage: npx tsx scripts/seedComplianceData.ts
 */

import { generateSeedDocuments } from '../lib/compliance/seedData';
import { complianceDocStore } from '../lib/compliance/documentStore';
import { processDocument } from '../lib/compliance/ragPipeline';

async function main() {
  console.log('🌱 Seeding Compliance Database...\n');
  
  const startTime = Date.now();
  const documents = generateSeedDocuments();
  
  console.log(`📚 Found ${documents.length} documents to seed\n`);
  
  let created = 0;
  let processed = 0;
  let errors = 0;
  
  for (const doc of documents) {
    try {
      // 1. Save document to DynamoDB
      console.log(`📄 Creating: ${doc.shortTitle || doc.title.substring(0, 40)}...`);
      await complianceDocStore.create(doc);
      created++;
      
      // 2. Process for RAG (chunking + embeddings)
      if (doc.fullText && doc.fullText.length > 100) {
        console.log(`   🔄 Processing for RAG...`);
        await processDocument(doc);
        processed++;
        console.log(`   ✅ Done`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error:`, error);
      errors++;
    }
    
    // Small delay between documents
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SEED SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Documents created: ${created}`);
  console.log(`Documents processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Duration: ${duration} seconds`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('✅ Database seeded successfully!');
  console.log('   You can now use the Compliance AI chat.');
}

main().catch(console.error);




