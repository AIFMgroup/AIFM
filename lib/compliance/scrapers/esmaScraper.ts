/**
 * ESMA Scraper
 * 
 * Skrapar guidelines, Q&As och opinions från ESMA.
 */

import { 
  ComplianceDocument, 
  DocumentType, 
  ComplianceCategory,
  ScraperResult 
} from '../types';
import { complianceDocStore } from '../documentStore';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

const ESMA_BASE_URL = 'https://www.esma.europa.eu';
const USER_AGENT = 'AIFM-Compliance-Bot/1.0 (compliance research)';

// Rate limiting
const RATE_LIMIT_MS = 3000; // 3 seconds between requests
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/json',
      'Accept-Language': 'en,sv;q=0.9',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  
  return response;
}

// ============ AIFMD Documents ============

interface ESMADocument {
  reference: string;      // e.g., "ESMA34-45-1415"
  title: string;
  type: DocumentType;
  url: string;
  pdfUrl?: string;
  publishDate: string;
  categories: ComplianceCategory[];
}

/**
 * Scrapa ESMA AIFMD-relaterade dokument
 */
export async function scrapeAIFMDDocuments(): Promise<ESMADocument[]> {
  console.log('[ESMA Scraper] Scraping AIFMD documents...');
  
  const documents: ESMADocument[] = [];
  
  // ESMA AIFMD page
  const aifmdUrl = `${ESMA_BASE_URL}/policy-activities/investment-management/alternative-investment-fund-managers`;
  
  try {
    const response = await rateLimitedFetch(aifmdUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find document links
    $('a[href*="document"], .publication-item, .document-link').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href && text && text.length > 10) {
        const refMatch = text.match(/ESMA[\d\-]+/);
        
        documents.push({
          reference: refMatch ? refMatch[0] : `ESMA-${Date.now()}`,
          title: text,
          type: determineDocType(text),
          url: href.startsWith('http') ? href : `${ESMA_BASE_URL}${href}`,
          publishDate: new Date().toISOString().split('T')[0],
          categories: ['aifmd'],
        });
      }
    });
    
  } catch (error) {
    console.error('[ESMA Scraper] Error scraping AIFMD page:', error);
  }
  
  // Add known important ESMA documents
  const knownDocuments: ESMADocument[] = [
    {
      reference: 'ESMA34-32-352',
      title: 'Guidelines on performance fees in UCITS and certain types of AIFs',
      type: 'guideline',
      url: `${ESMA_BASE_URL}/sites/default/files/library/esma34-32-352_guidelines_on_performance_fees.pdf`,
      pdfUrl: `${ESMA_BASE_URL}/sites/default/files/library/esma34-32-352_guidelines_on_performance_fees.pdf`,
      publishDate: '2020-11-03',
      categories: ['aifmd', 'valuation'],
    },
    {
      reference: 'ESMA34-45-1415',
      title: 'Questions and Answers on the application of the AIFMD',
      type: 'qa',
      url: `${ESMA_BASE_URL}/policy-activities/investment-management/alternative-investment-fund-managers/aifmd-qa`,
      publishDate: '2023-07-21',
      categories: ['aifmd', 'general'],
    },
    {
      reference: 'ESMA34-43-1203',
      title: 'Guidelines on Article 25 AIFMD - Leverage',
      type: 'guideline',
      url: `${ESMA_BASE_URL}/document/guidelines-article-25-aifmd`,
      publishDate: '2020-12-17',
      categories: ['aifmd', 'risk'],
    },
    {
      reference: 'ESMA34-45-1648',
      title: 'Guidelines on marketing communications under the Regulation on cross-border distribution of funds',
      type: 'guideline',
      url: `${ESMA_BASE_URL}/document/guidelines-marketing-communications`,
      publishDate: '2021-08-02',
      categories: ['aifmd', 'marketing'],
    },
  ];
  
  // Merge with scraped documents
  for (const known of knownDocuments) {
    if (!documents.find(d => d.reference === known.reference)) {
      documents.push(known);
    }
  }
  
  console.log(`[ESMA Scraper] Found ${documents.length} AIFMD documents`);
  
  return documents;
}

/**
 * Scrapa SFDR-relaterade dokument
 */
export async function scrapeSFDRDocuments(): Promise<ESMADocument[]> {
  console.log('[ESMA Scraper] Scraping SFDR documents...');
  
  const documents: ESMADocument[] = [];
  
  // Known important SFDR documents
  const knownDocuments: ESMADocument[] = [
    {
      reference: 'JC-2022-62',
      title: 'Questions and Answers on SFDR',
      type: 'qa',
      url: `${ESMA_BASE_URL}/document/jc-2022-62-qa-sfdr`,
      publishDate: '2022-11-17',
      categories: ['sfdr'],
    },
    {
      reference: 'JC-2021-50',
      title: 'Final Report on draft RTS for SFDR',
      type: 'standard',
      url: `${ESMA_BASE_URL}/document/final-report-draft-rts-sfdr`,
      publishDate: '2021-02-04',
      categories: ['sfdr'],
    },
  ];
  
  documents.push(...knownDocuments);
  
  return documents;
}

/**
 * Avgör dokumenttyp baserat på titel
 */
function determineDocType(title: string): DocumentType {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('q&a') || lowerTitle.includes('questions and answers')) {
    return 'qa';
  }
  if (lowerTitle.includes('guideline') || lowerTitle.includes('riktlinje')) {
    return 'guideline';
  }
  if (lowerTitle.includes('opinion') || lowerTitle.includes('yttrande')) {
    return 'opinion';
  }
  if (lowerTitle.includes('rts') || lowerTitle.includes('its') || lowerTitle.includes('technical standard')) {
    return 'standard';
  }
  if (lowerTitle.includes('report') || lowerTitle.includes('rapport')) {
    return 'report';
  }
  if (lowerTitle.includes('regulation') || lowerTitle.includes('förordning')) {
    return 'regulation';
  }
  if (lowerTitle.includes('directive') || lowerTitle.includes('direktiv')) {
    return 'directive';
  }
  
  return 'other';
}

/**
 * Scrapa innehållet i ett specifikt ESMA-dokument
 */
export async function scrapeESMADocument(entry: ESMADocument): Promise<ComplianceDocument | null> {
  console.log(`[ESMA Scraper] Scraping ${entry.reference}...`);
  
  try {
    // If it's a PDF, we'll just store the metadata (PDF parsing can be added later)
    if (entry.url.endsWith('.pdf') || entry.pdfUrl) {
      return {
        id: uuidv4(),
        source: 'esma',
        type: entry.type,
        categories: entry.categories,
        title: entry.title,
        shortTitle: entry.reference,
        documentNumber: entry.reference,
        publishDate: entry.publishDate,
        language: 'en',
        sourceUrl: entry.url,
        pdfUrl: entry.pdfUrl || entry.url,
        summary: `${entry.type.toUpperCase()}: ${entry.title}`,
        status: 'scraped',
        lastScraped: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    
    // Otherwise, try to scrape HTML content
    const response = await rateLimitedFetch(entry.url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract content
    const content = $('.node-content, .article-content, .main-content, .document-body').text().trim();
    
    // Find PDF link
    const pdfLink = $('a[href*=".pdf"]').first().attr('href');
    const pdfUrl = pdfLink ? (pdfLink.startsWith('http') ? pdfLink : `${ESMA_BASE_URL}${pdfLink}`) : undefined;
    
    // Extract summary
    const summary = $('.lead, .summary, .abstract').first().text().trim() ||
                    content.substring(0, 500) + '...';
    
    return {
      id: uuidv4(),
      source: 'esma',
      type: entry.type,
      categories: entry.categories,
      title: entry.title,
      shortTitle: entry.reference,
      documentNumber: entry.reference,
      publishDate: entry.publishDate,
      language: 'en',
      sourceUrl: entry.url,
      pdfUrl,
      summary,
      fullText: content || undefined,
      status: 'scraped',
      lastScraped: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error(`[ESMA Scraper] Error scraping ${entry.reference}:`, error);
    return null;
  }
}

// ============ Main Scraper Function ============

/**
 * Kör full ESMA-scraping
 */
export async function runESMAScraper(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let documentsFound = 0;
  let documentsNew = 0;
  const documentsUpdated = 0;
  
  console.log('[ESMA Scraper] Starting full scrape...');
  
  try {
    // 1. AIFMD documents
    const aifmdDocs = await scrapeAIFMDDocuments();
    documentsFound += aifmdDocs.length;
    
    for (const entry of aifmdDocs) {
      const doc = await scrapeESMADocument(entry);
      if (doc) {
        await complianceDocStore.create(doc);
        documentsNew++;
      }
    }
    
    // 2. SFDR documents
    const sfdrDocs = await scrapeSFDRDocuments();
    documentsFound += sfdrDocs.length;
    
    for (const entry of sfdrDocs) {
      const doc = await scrapeESMADocument(entry);
      if (doc) {
        await complianceDocStore.create(doc);
        documentsNew++;
      }
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    console.error('[ESMA Scraper] Fatal error:', error);
  }
  
  const result: ScraperResult = {
    source: 'esma',
    documentsFound,
    documentsNew,
    documentsUpdated,
    errors,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
  
  console.log('[ESMA Scraper] Completed:', result);
  
  return result;
}




