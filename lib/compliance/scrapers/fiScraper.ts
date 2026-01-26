/**
 * Finansinspektionen Scraper
 * 
 * Skrapar regelverk, föreskrifter och vägledning från FI.se
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

const FI_BASE_URL = 'https://www.fi.se';
const USER_AGENT = 'AIFM-Compliance-Bot/1.0 (compliance research)';

// Rate limiting
const RATE_LIMIT_MS = 2000; // 2 seconds between requests
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
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'sv,en;q=0.9',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  
  return response;
}

// ============ FFFS Scraper ============

interface FFSEntry {
  number: string;      // e.g., "FFFS 2013:10"
  title: string;
  url: string;
  publishDate?: string;
  categories: ComplianceCategory[];
}

/**
 * Scrapa FFFS (Finansinspektionens författningssamling)
 */
export async function scrapeFFFSList(): Promise<FFSEntry[]> {
  console.log('[FI Scraper] Scraping FFFS list...');
  
  const entries: FFSEntry[] = [];
  
  // Main FFFS page - using correct FI.se URL structure
  const listUrl = `${FI_BASE_URL}/sv/vara-register/fffs/sok-fffs/`;
  
  try {
    const response = await rateLimitedFetch(listUrl);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find FFFS entries
    $('table tbody tr, .regulation-list li, .fffs-item').each((_, el) => {
      const $el = $(el);
      const linkEl = $el.find('a').first();
      const link = linkEl.attr('href');
      const text = linkEl.text().trim() || $el.text().trim();
      
      // Extract FFFS number
      const fffsMatch = text.match(/FFFS\s*(\d{4}:\d+)/i);
      if (fffsMatch && link) {
        const number = `FFFS ${fffsMatch[1]}`;
        const title = text.replace(/FFFS\s*\d{4}:\d+/i, '').trim();
        
        entries.push({
          number,
          title: title || number,
          url: link.startsWith('http') ? link : `${FI_BASE_URL}${link}`,
          categories: categorizeFFFS(number, title),
        });
      }
    });
    
    console.log(`[FI Scraper] Found ${entries.length} FFFS entries`);
    
  } catch (error) {
    console.error('[FI Scraper] Error scraping FFFS list:', error);
  }
  
  // Add known important FFFS for AIF managers
  const knownFFFS: FFSEntry[] = [
    {
      number: 'FFFS 2013:10',
      title: 'Finansinspektionens föreskrifter om förvaltare av alternativa investeringsfonder',
      url: `${FI_BASE_URL}/sv/vara-register/fffs/sok-fffs/2013/201310/`,
      categories: ['aifmd', 'general'],
    },
    {
      number: 'FFFS 2017:11',
      title: 'Föreskrifter om åtgärder mot penningtvätt och finansiering av terrorism',
      url: `${FI_BASE_URL}/sv/vara-register/fffs/sok-fffs/2017/201711/`,
      categories: ['aml'],
    },
    {
      number: 'FFFS 2019:2',
      title: 'Föreskrifter om hållbarhetsrelaterade upplysningar',
      url: `${FI_BASE_URL}/sv/vara-register/fffs/sok-fffs/2019/20192/`,
      categories: ['sfdr'],
    },
    {
      number: 'FFFS 2014:12',
      title: 'Finansinspektionens föreskrifter om tillsynskrav och kapitalbuffertar',
      url: `${FI_BASE_URL}/sv/vara-register/fffs/sok-fffs/2014/201412/`,
      categories: ['risk', 'general'],
    },
  ];
  
  // Merge, avoiding duplicates
  for (const known of knownFFFS) {
    if (!entries.find(e => e.number === known.number)) {
      entries.push(known);
    }
  }
  
  return entries;
}

/**
 * Kategorisera FFFS baserat på nummer och titel
 */
function categorizeFFFS(number: string, title: string): ComplianceCategory[] {
  const categories: ComplianceCategory[] = [];
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('alternativa investeringsfonder') || lowerTitle.includes('aif')) {
    categories.push('aifmd');
  }
  if (lowerTitle.includes('penningtvätt') || lowerTitle.includes('aml')) {
    categories.push('aml');
  }
  if (lowerTitle.includes('hållbarhet') || lowerTitle.includes('sfdr')) {
    categories.push('sfdr');
  }
  if (lowerTitle.includes('värdepappersmarknaden') || lowerTitle.includes('mifid')) {
    categories.push('mifid');
  }
  if (lowerTitle.includes('rapportering')) {
    categories.push('reporting');
  }
  if (lowerTitle.includes('risk')) {
    categories.push('risk');
  }
  if (lowerTitle.includes('värdering')) {
    categories.push('valuation');
  }
  
  if (categories.length === 0) {
    categories.push('general');
  }
  
  return categories;
}

/**
 * Scrapa en specifik FFFS-sida
 */
export async function scrapeFFSDocument(entry: FFSEntry): Promise<ComplianceDocument | null> {
  console.log(`[FI Scraper] Scraping ${entry.number}...`);
  
  try {
    const response = await rateLimitedFetch(entry.url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract content
    const content = $('.article-content, .main-content, .regulation-text').text().trim();
    const publishDate = $('time, .publish-date, .date').first().attr('datetime') || 
                        $('time, .publish-date, .date').first().text().trim();
    
    // Find PDF link
    const pdfLink = $('a[href*=".pdf"]').first().attr('href');
    const pdfUrl = pdfLink ? (pdfLink.startsWith('http') ? pdfLink : `${FI_BASE_URL}${pdfLink}`) : undefined;
    
    // Extract summary
    const summary = $('.ingress, .lead, .summary').first().text().trim() ||
                    content.substring(0, 500) + '...';
    
    const doc: ComplianceDocument = {
      id: uuidv4(),
      source: 'fi',
      type: 'fffs',
      categories: entry.categories,
      title: entry.title,
      shortTitle: entry.number,
      documentNumber: entry.number,
      publishDate: parseSwedishDate(publishDate) || new Date().toISOString().split('T')[0],
      language: 'sv',
      sourceUrl: entry.url,
      pdfUrl,
      summary,
      fullText: content || undefined,
      status: 'scraped',
      lastScraped: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return doc;
    
  } catch (error) {
    console.error(`[FI Scraper] Error scraping ${entry.number}:`, error);
    return null;
  }
}

// ============ FI Guidance Scraper ============

/**
 * Scrapa FI:s vägledningsdokument
 */
export async function scrapeFIGuidance(): Promise<ComplianceDocument[]> {
  console.log('[FI Scraper] Scraping guidance documents...');
  
  const docs: ComplianceDocument[] = [];
  
  // Key guidance pages for AIF managers - using correct FI.se URL structure
  const guidanceUrls = [
    {
      url: `${FI_BASE_URL}/sv/marknad/fonder-och-fondbolag/`,
      category: 'aifmd' as ComplianceCategory,
      title: 'Fonder och fondbolag',
    },
    {
      url: `${FI_BASE_URL}/sv/hallbarhet/`,
      category: 'sfdr' as ComplianceCategory,
      title: 'Hållbarhet',
    },
    {
      url: `${FI_BASE_URL}/sv/publicerat/rapporter/`,
      category: 'reporting' as ComplianceCategory,
      title: 'FI Rapporter',
    },
  ];
  
  for (const page of guidanceUrls) {
    try {
      const response = await rateLimitedFetch(page.url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const content = $('.article-content, .main-content').text().trim();
      
      if (content.length > 100) {
        docs.push({
          id: uuidv4(),
          source: 'fi',
          type: 'guideline',
          categories: [page.category],
          title: page.title,
          language: 'sv',
          sourceUrl: page.url,
          summary: content.substring(0, 500) + '...',
          fullText: content,
          publishDate: new Date().toISOString().split('T')[0],
          status: 'scraped',
          lastScraped: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      
    } catch (error) {
      console.error(`[FI Scraper] Error scraping ${page.url}:`, error);
    }
  }
  
  return docs;
}

// ============ Main Scraper Function ============

/**
 * Kör full FI-scraping
 */
export async function runFIScraper(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let documentsFound = 0;
  let documentsNew = 0;
  let documentsUpdated = 0;
  
  console.log('[FI Scraper] Starting full scrape...');
  
  try {
    // 1. Scrape FFFS list
    const fffsEntries = await scrapeFFFSList();
    documentsFound += fffsEntries.length;
    
    // 2. Scrape each FFFS document
    for (const entry of fffsEntries.slice(0, 10)) { // Limit for testing
      const doc = await scrapeFFSDocument(entry);
      if (doc) {
        // Check if exists
        const existing = await complianceDocStore.get('fi', doc.id);
        if (existing) {
          documentsUpdated++;
        } else {
          documentsNew++;
        }
        await complianceDocStore.create(doc);
      }
    }
    
    // 3. Scrape guidance
    const guidanceDocs = await scrapeFIGuidance();
    documentsFound += guidanceDocs.length;
    
    for (const doc of guidanceDocs) {
      await complianceDocStore.create(doc);
      documentsNew++;
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    console.error('[FI Scraper] Fatal error:', error);
  }
  
  const result: ScraperResult = {
    source: 'fi',
    documentsFound,
    documentsNew,
    documentsUpdated,
    errors,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
  
  console.log('[FI Scraper] Completed:', result);
  
  return result;
}

// ============ Helpers ============

function parseSwedishDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }
  
  // Swedish format: "1 januari 2024"
  const months: Record<string, string> = {
    'januari': '01', 'februari': '02', 'mars': '03', 'april': '04',
    'maj': '05', 'juni': '06', 'juli': '07', 'augusti': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'december': '12',
  };
  
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    const monthNum = months[month.toLowerCase()];
    if (monthNum) {
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    }
  }
  
  return null;
}

