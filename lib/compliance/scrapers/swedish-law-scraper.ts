/**
 * Swedish Law Scraper
 * 
 * Scrapes legal documents from riksdagen.se and fi.se
 */

import * as cheerio from 'cheerio';

export interface ScrapedDocument {
  title: string;
  source: string;
  sourceType: 'url';
  content: string;
  metadata: {
    documentNumber?: string;
    effectiveDate?: string;
    lastUpdated?: string;
    authority?: string;
  };
}

// ============================================================================
// Riksdagen.se Scraper
// ============================================================================

/**
 * Scrape a law from riksdagen.se
 */
export async function scrapeRiksdagen(url: string): Promise<ScrapedDocument> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIFM-Bot/1.0; +https://aifm.se)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract title
  let title = $('h1').first().text().trim();
  if (!title) {
    title = $('title').text().split('|')[0].trim();
  }

  // Extract document number (SFS number)
  let documentNumber = '';
  const sfsMatch = url.match(/sfs-(\d{4}-\d+)/i) || title.match(/(\d{4}:\d+)/);
  if (sfsMatch) {
    documentNumber = `SFS ${sfsMatch[1].replace('-', ':')}`;
  }

  // Extract main content
  // Riksdagen stores law text in specific containers
  let content = '';
  
  // Try different selectors for different page layouts
  const contentSelectors = [
    '.LawText',
    '.law-text',
    '.document-text',
    '#LawContent',
    '.content-body',
    'article .body',
    'main .content',
    '.sfs-content',
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text().trim();
      break;
    }
  }

  // If no specific container found, try to extract from main content
  if (!content) {
    // Remove navigation, footer, etc.
    $('nav, header, footer, script, style, .navigation, .sidebar').remove();
    content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
  }

  // Clean up content
  content = cleanContent(content);

  // Extract metadata
  let effectiveDate = '';
  const dateMatch = content.match(/(?:träder i kraft|ikraftträdande)[:\s]*(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) {
    effectiveDate = dateMatch[1];
  }

  return {
    title,
    source: url,
    sourceType: 'url',
    content,
    metadata: {
      documentNumber,
      effectiveDate,
      authority: 'Riksdagen',
    },
  };
}

// ============================================================================
// Finansinspektionen Scraper
// ============================================================================

/**
 * Scrape FFFS from fi.se
 */
export async function scrapeFI(url: string): Promise<ScrapedDocument> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIFM-Bot/1.0; +https://aifm.se)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract title
  let title = $('h1').first().text().trim();
  if (!title) {
    title = $('title').text().split('|')[0].trim();
  }

  // Extract FFFS number
  let documentNumber = '';
  const fffsMatch = url.match(/fffs\/(\d{4}\/\d+)/i) || title.match(/FFFS\s*(\d{4}:\d+)/i);
  if (fffsMatch) {
    documentNumber = `FFFS ${fffsMatch[1].replace('/', ':')}`;
  }

  // Extract main content
  let content = '';
  
  const contentSelectors = [
    '.fffs-content',
    '.regulation-text',
    '.document-body',
    '.article-body',
    'article .content',
    '.main-content',
  ];

  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text().trim();
      break;
    }
  }

  if (!content) {
    $('nav, header, footer, script, style, .navigation, .sidebar').remove();
    content = $('main').text().trim() || $('article').text().trim();
  }

  content = cleanContent(content);

  // Look for PDF link (FI often has the full regulation as PDF)
  const pdfLink = $('a[href$=".pdf"]').attr('href');
  let pdfUrl = '';
  if (pdfLink) {
    pdfUrl = pdfLink.startsWith('http') ? pdfLink : `https://www.fi.se${pdfLink}`;
  }

  return {
    title,
    source: url,
    sourceType: 'url',
    content,
    metadata: {
      documentNumber,
      authority: 'Finansinspektionen',
    },
  };
}

// ============================================================================
// Generic Scraper
// ============================================================================

/**
 * Auto-detect source and scrape accordingly
 */
export async function scrapeUrl(url: string): Promise<ScrapedDocument> {
  if (url.includes('riksdagen.se')) {
    return scrapeRiksdagen(url);
  } else if (url.includes('fi.se')) {
    return scrapeFI(url);
  } else {
    // Generic scraper
    return scrapeGeneric(url);
  }
}

/**
 * Generic web scraper
 */
async function scrapeGeneric(url: string): Promise<ScrapedDocument> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIFM-Bot/1.0; +https://aifm.se)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || $('title').text().trim();

  // Remove non-content elements
  $('nav, header, footer, script, style, aside, .sidebar, .navigation, .menu').remove();

  // Get main content
  let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();
  content = cleanContent(content);

  return {
    title,
    source: url,
    sourceType: 'url',
    content,
    metadata: {},
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Clean up scraped content
 */
function cleanContent(content: string): string {
  return content
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Fix paragraph breaks
    .replace(/\.\s+(?=[A-ZÅÄÖ])/g, '.\n\n')
    // Fix section breaks
    .replace(/(\d+\s*§)/g, '\n\n$1')
    .replace(/(\d+\s*kap\.)/gi, '\n\n$1')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

// ============================================================================
// Batch Scraper
// ============================================================================

/**
 * Scrape multiple URLs
 */
export async function scrapeMultipleUrls(
  urls: string[],
  options: { delayMs?: number } = {}
): Promise<{ success: ScrapedDocument[]; failed: { url: string; error: string }[] }> {
  const { delayMs = 1000 } = options;
  const success: ScrapedDocument[] = [];
  const failed: { url: string; error: string }[] = [];

  for (const url of urls) {
    try {
      console.log(`Scraping: ${url}`);
      const doc = await scrapeUrl(url);
      success.push(doc);
      
      // Polite delay between requests
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
      failed.push({ url, error: (error as Error).message });
    }
  }

  return { success, failed };
}

export const swedishLawScraper = {
  scrapeRiksdagen,
  scrapeFI,
  scrapeUrl,
  scrapeMultipleUrls,
};
