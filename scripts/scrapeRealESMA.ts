/**
 * Real ESMA Document Scraper Script
 * 
 * Hämtar faktiska PDF:er från ESMA och extraherar text.
 * Usage: npx tsx scripts/scrapeRealESMA.ts
 */

import { runRealESMAScraper, listESMADocumentRegistry } from '../lib/compliance/scrapers/realEsmaScraper';
import { complianceDocStore } from '../lib/compliance/documentStore';
import { processDocument } from '../lib/compliance/ragPipeline';

async function main() {
  console.log('🇪🇺 Real ESMA Document Scraper');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Show registry
  const registry = listESMADocumentRegistry();
  console.log(`📋 Document Registry: ${registry.length} documents\n`);
  
  console.log('Categories:');
  const cats: Record<string, number> = {};
  registry.forEach(r => r.categories.forEach(c => cats[c] = (cats[c] || 0) + 1));
  Object.entries(cats).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  
  console.log('\nTypes:');
  const types: Record<string, number> = {};
  registry.forEach(r => types[r.type] = (types[r.type] || 0) + 1);
  Object.entries(types).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Starting scrape...\n');
  
  // Run scraper
  const result = await runRealESMAScraper();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SCRAPE RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Documents found:    ${result.documentsFound}`);
  console.log(`Documents new:      ${result.documentsNew}`);
  console.log(`Errors:             ${result.errors.length}`);
  console.log(`Duration:           ${Math.round(result.duration / 1000)}s`);
  
  if (result.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    result.errors.forEach(e => console.log(`   - ${e}`));
  }
  
  // Now process documents for RAG
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Processing for RAG (chunking + embeddings)...\n');
  
  const docs = await complianceDocStore.listBySource('esma', 100);
  let processed = 0;
  const chunksTotal = 0;
  
  for (const doc of docs) {
    if (doc.fullText && doc.fullText.length > 200) {
      try {
        process.stdout.write(`   ${doc.shortTitle || doc.documentNumber}... `);
        await processDocument(doc);
        processed++;
        console.log('✅');
      } catch (error) {
        console.log(`❌ ${(error as Error).message?.substring(0, 30)}`);
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ COMPLETED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Documents scraped:  ${result.documentsNew}`);
  console.log(`Documents processed: ${processed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});




