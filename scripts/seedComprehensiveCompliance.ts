/**
 * Comprehensive Compliance Database Seeder
 * 
 * Fyller databasen med alla viktiga regelverk för AIF-förvaltare.
 * Usage: npx tsx scripts/seedComprehensiveCompliance.ts
 */

import { generateAllSeedDocuments, getSeedDocumentStats } from '../lib/compliance/comprehensiveSeedData';
import { complianceDocStore } from '../lib/compliance/documentStore';
import { processDocument } from '../lib/compliance/ragPipeline';

async function main() {
  console.log('🏛️  Comprehensive Compliance Database Seeder');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Show statistics
  const stats = getSeedDocumentStats();
  console.log('📊 Document Statistics:');
  console.log(`   Total documents: ${stats.total}`);
  console.log('\n   By Source:');
  Object.entries(stats.bySource).forEach(([k, v]) => console.log(`      ${k}: ${v}`));
  console.log('\n   By Category:');
  Object.entries(stats.byCategory).forEach(([k, v]) => console.log(`      ${k}: ${v}`));
  console.log('\n   By Type:');
  Object.entries(stats.byType).forEach(([k, v]) => console.log(`      ${k}: ${v}`));
  console.log('\n');
  
  const startTime = Date.now();
  const documents = generateAllSeedDocuments();
  
  let created = 0;
  let processed = 0;
  let chunks = 0;
  let errors = 0;
  
  console.log('🌱 Starting seed process...\n');
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const progress = `[${i + 1}/${documents.length}]`;
    
    try {
      // 1. Save document to DynamoDB
      process.stdout.write(`${progress} 📄 ${doc.shortTitle || doc.title.substring(0, 35)}... `);
      await complianceDocStore.create(doc);
      created++;
      
      // 2. Process for RAG (chunking + embeddings)
      if (doc.fullText && doc.fullText.length > 100) {
        process.stdout.write('→ chunking → embeddings... ');
        
        // Count chunks from processing
        const chunkCount = Math.ceil(doc.fullText.length / 1500);
        chunks += chunkCount;
        
        await processDocument(doc);
        processed++;
        console.log('✅');
      } else {
        console.log('✅ (no fullText)');
      }
      
    } catch (error) {
      console.log(`❌ Error: ${(error as Error).message?.substring(0, 50)}`);
      errors++;
    }
    
    // Rate limiting for Bedrock
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 FINAL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Documents created:    ${created}`);
  console.log(`Documents processed:  ${processed}`);
  console.log(`Estimated chunks:     ~${chunks}`);
  console.log(`Errors:               ${errors}`);
  console.log(`Duration:             ${duration} seconds`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (errors === 0) {
    console.log('✅ Database seeded successfully!');
    console.log('   Compliance AI is now ready with comprehensive regulations.');
  } else {
    console.log(`⚠️  Completed with ${errors} errors. Check logs above.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});




