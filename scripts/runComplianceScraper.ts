/**
 * Compliance Scraper Runner
 * 
 * Körs manuellt för att fylla databasen med regelverk.
 * Usage: npx ts-node scripts/runComplianceScraper.ts
 */

import { runFIScraper } from '../lib/compliance/scrapers/fiScraper';
import { runESMAScraper } from '../lib/compliance/scrapers/esmaScraper';
import { processDocument } from '../lib/compliance/ragPipeline';
import { complianceDocStore } from '../lib/compliance/documentStore';

async function main() {
  console.log('🏛️  Starting Compliance Scraper...\n');
  
  const startTime = Date.now();
  
  try {
    // 1. Scrape FI.se
    console.log('📜 Scraping Finansinspektionen...');
    const fiResult = await runFIScraper();
    console.log(`   ✅ FI: ${fiResult.documentsNew} new, ${fiResult.documentsUpdated} updated\n`);
    
    // 2. Scrape ESMA
    console.log('🇪🇺 Scraping ESMA...');
    const esmaResult = await runESMAScraper();
    console.log(`   ✅ ESMA: ${esmaResult.documentsNew} new, ${esmaResult.documentsUpdated} updated\n`);
    
    // 3. Process documents (chunking + embeddings)
    console.log('🔄 Processing documents for RAG...');
    
    const fiDocs = await complianceDocStore.listBySource('fi', 100);
    const esmaDocs = await complianceDocStore.listBySource('esma', 100);
    const allDocs = [...fiDocs, ...esmaDocs];
    
    let processed = 0;
    for (const doc of allDocs) {
      if (doc.status === 'scraped' && doc.fullText) {
        try {
          await processDocument(doc);
          processed++;
          console.log(`   ✅ Processed: ${doc.shortTitle || doc.title.substring(0, 40)}...`);
        } catch (error) {
          console.error(`   ❌ Error processing ${doc.id}:`, error);
        }
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`FI Documents:    ${fiResult.documentsFound} found, ${fiResult.documentsNew} new`);
    console.log(`ESMA Documents:  ${esmaResult.documentsFound} found, ${esmaResult.documentsNew} new`);
    console.log(`Processed:       ${processed} documents`);
    console.log(`Duration:        ${duration} seconds`);
    console.log(`Errors:          ${fiResult.errors.length + esmaResult.errors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (fiResult.errors.length > 0 || esmaResult.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      [...fiResult.errors, ...esmaResult.errors].forEach(e => console.log(`   - ${e}`));
    }
    
    console.log('✅ Scraping complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();




