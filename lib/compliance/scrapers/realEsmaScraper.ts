/**
 * Real ESMA Document Scraper
 * 
 * Skrapar faktiska dokument från ESMAs webbplats och API.
 */

import { 
  ComplianceDocument, 
  DocumentType, 
  ComplianceCategory,
  ScraperResult 
} from '../types';
import { complianceDocStore } from '../documentStore';
import { v4 as uuidv4 } from 'uuid';

const ESMA_BASE_URL = 'https://www.esma.europa.eu';
const USER_AGENT = 'AIFM-Compliance-Bot/1.0 (compliance research; contact@aifm.se)';

// Rate limiting
const RATE_LIMIT_MS = 2000;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/json,application/pdf',
      'Accept-Language': 'en,sv;q=0.9',
      ...options?.headers,
    }
  });
  
  return response;
}

// ============ ESMA Document Registry ============

interface ESMARegistryItem {
  title: string;
  reference: string;
  date: string;
  type: string;
  url: string;
  pdfUrl?: string;
  categories: ComplianceCategory[];
}

/**
 * Känd lista över ESMA-dokument för AIF-förvaltare
 * Dessa är de faktiska dokumenten som vi behöver hämta
 */
const ESMA_DOCUMENT_REGISTRY: ESMARegistryItem[] = [
  // ============ AIFMD Q&As ============
  {
    title: 'Questions and Answers on the application of the AIFMD',
    reference: 'ESMA34-32-352',
    date: '2024-07-05',
    type: 'qa',
    url: 'https://www.esma.europa.eu/sites/default/files/2024-07/ESMA34-32-352_QA_on_the_application_of_the_AIFMD.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/2024-07/ESMA34-32-352_QA_on_the_application_of_the_AIFMD.pdf',
    categories: ['aifmd', 'general'],
  },
  
  // ============ AIFMD Guidelines ============
  {
    title: 'Guidelines on sound remuneration policies under the AIFMD',
    reference: 'ESMA/2013/232',
    date: '2013-02-11',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2013-232_aifmd_guidelines_on_remuneration_-_en.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2013-232_aifmd_guidelines_on_remuneration_-_en.pdf',
    categories: ['aifmd', 'general'],
  },
  {
    title: 'Guidelines on key concepts of the AIFMD',
    reference: 'ESMA/2013/611',
    date: '2013-08-13',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2013-611_guidelines_on_key_concepts_of_the_aifmd_-_en.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2013-611_guidelines_on_key_concepts_of_the_aifmd_-_en.pdf',
    categories: ['aifmd', 'general'],
  },
  {
    title: 'Guidelines on reporting obligations under Articles 3(3)(d) and 24(1), (2) and (4) of the AIFMD',
    reference: 'ESMA/2014/869',
    date: '2014-08-08',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2014-869.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/2015/11/2014-869.pdf',
    categories: ['aifmd', 'reporting'],
  },
  {
    title: 'Guidelines on Article 25 of Directive 2011/61/EU',
    reference: 'ESMA34-32-701',
    date: '2020-12-17',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/esma34-32-701_guidelines_on_article_25_aifmd.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-32-701_guidelines_on_article_25_aifmd.pdf',
    categories: ['aifmd', 'risk'],
  },
  {
    title: 'Guidelines on performance fees in UCITS and certain types of AIFs',
    reference: 'ESMA34-39-992',
    date: '2020-11-05',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/esma34-39-992_guidelines_on_performance_fees.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-39-992_guidelines_on_performance_fees.pdf',
    categories: ['aifmd', 'valuation'],
  },
  {
    title: 'Guidelines on marketing communications under the Regulation on cross-border distribution of funds',
    reference: 'ESMA34-45-1272',
    date: '2021-08-02',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/esma34-45-1272_guidelines_on_marketing_communications.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-45-1272_guidelines_on_marketing_communications.pdf',
    categories: ['aifmd', 'marketing'],
  },
  {
    title: 'Guidelines on liquidity stress testing in UCITS and AIFs',
    reference: 'ESMA34-39-897',
    date: '2020-07-16',
    type: 'guideline',
    url: 'https://www.esma.europa.eu/sites/default/files/library/esma34-39-897_guidelines_on_liquidity_stress_testing_in_ucits_and_aifs_en.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-39-897_guidelines_on_liquidity_stress_testing_in_ucits_and_aifs_en.pdf',
    categories: ['aifmd', 'risk'],
  },
  
  // ============ SFDR Documents ============
  {
    title: 'Questions and Answers on SFDR',
    reference: 'JC 2023 18',
    date: '2024-06-14',
    type: 'qa',
    url: 'https://www.esma.europa.eu/sites/default/files/2024-06/JC_2024_22_-_Consolidated_JC_SFDR_QAs.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/2024-06/JC_2024_22_-_Consolidated_JC_SFDR_QAs.pdf',
    categories: ['sfdr'],
  },
  {
    title: 'Final Report on draft RTS with regard to the content and presentation of sustainability disclosures',
    reference: 'JC 2021 03',
    date: '2021-02-04',
    type: 'standard',
    url: 'https://www.esma.europa.eu/sites/default/files/library/jc_2021_03_joint_esas_final_report_on_rts_under_sfdr.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/jc_2021_03_joint_esas_final_report_on_rts_under_sfdr.pdf',
    categories: ['sfdr'],
  },
  {
    title: 'Clarifications on the ESAs draft RTS under SFDR',
    reference: 'JC 2021 06',
    date: '2021-02-25',
    type: 'qa',
    url: 'https://www.esma.europa.eu/sites/default/files/library/jc_2021_06_joint_esas_clarifications_on_the_esas_draft_rts_under_sfdr.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/jc_2021_06_joint_esas_clarifications_on_the_esas_draft_rts_under_sfdr.pdf',
    categories: ['sfdr'],
  },
  
  // ============ AIFMD II Related ============
  {
    title: 'Opinion on the review of the AIFMD',
    reference: 'ESMA34-32-551',
    date: '2020-08-18',
    type: 'opinion',
    url: 'https://www.esma.europa.eu/sites/default/files/library/esma34-32-551_letter_on_aifmd_review.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/esma34-32-551_letter_on_aifmd_review.pdf',
    categories: ['aifmd'],
  },
  
  // ============ Delegated Regulations ============
  {
    title: 'Commission Delegated Regulation (EU) No 231/2013 - AIFMD Level 2',
    reference: 'EU 231/2013',
    date: '2012-12-19',
    type: 'regulation',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32013R0231',
    pdfUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32013R0231',
    categories: ['aifmd', 'general'],
  },
  {
    title: 'Commission Delegated Regulation (EU) 2022/1288 - SFDR RTS',
    reference: 'EU 2022/1288',
    date: '2022-04-06',
    type: 'standard',
    url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022R1288',
    pdfUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022R1288',
    categories: ['sfdr'],
  },
  
  // ============ Technical Standards ============
  {
    title: 'Draft RTS on the use of derivatives by retail AIFs',
    reference: 'ESMA/2016/585',
    date: '2016-04-07',
    type: 'standard',
    url: 'https://www.esma.europa.eu/sites/default/files/library/2016-585_cp_on_the_use_of_derivatives_by_ucits.pdf',
    pdfUrl: 'https://www.esma.europa.eu/sites/default/files/library/2016-585_cp_on_the_use_of_derivatives_by_ucits.pdf',
    categories: ['aifmd', 'risk'],
  },
];

/**
 * Extrahera text från PDF med pdf-parse
 */
async function extractPdfText(pdfUrl: string): Promise<string | null> {
  try {
    console.log(`[ESMA Scraper] Fetching PDF: ${pdfUrl}`);
    
    const response = await rateLimitedFetch(pdfUrl);
    
    if (!response.ok) {
      console.error(`[ESMA Scraper] Failed to fetch PDF: ${response.status}`);
      return null;
    }
    
    // Get content type
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/pdf')) {
      // Parse PDF
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = await import('pdf-parse') as any;
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      try {
        const data = await pdfParse(buffer);
        const text = data.text
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log(`[ESMA Scraper] Extracted ${text.length} characters from PDF`);
        return text.length > 100 ? text : null;
        
      } catch (pdfError) {
        console.error(`[ESMA Scraper] PDF parse error:`, pdfError);
        return null;
      }
    }
    
    // If it's HTML, extract text
    if (contentType?.includes('text/html')) {
      const html = await response.text();
      // Simple HTML text extraction
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.length > 100 ? text : null;
    }
    
    return null;
    
  } catch (error) {
    console.error(`[ESMA Scraper] Error extracting PDF:`, error);
    return null;
  }
}

/**
 * Mappa dokumenttyp
 */
function mapDocType(type: string): DocumentType {
  switch (type.toLowerCase()) {
    case 'qa': return 'qa';
    case 'guideline': return 'guideline';
    case 'opinion': return 'opinion';
    case 'standard': return 'standard';
    case 'regulation': return 'regulation';
    default: return 'other';
  }
}

/**
 * Scrapa ett enskilt ESMA-dokument
 */
async function scrapeESMADocument(item: ESMARegistryItem): Promise<ComplianceDocument | null> {
  console.log(`[ESMA Scraper] Processing: ${item.reference} - ${item.title.substring(0, 40)}...`);
  
  try {
    // Try to extract text from PDF
    let fullText: string | undefined;
    if (item.pdfUrl) {
      const extracted = await extractPdfText(item.pdfUrl);
      if (extracted) {
        fullText = extracted;
      }
    }
    
    // Create document
    const doc: ComplianceDocument = {
      id: uuidv4(),
      source: 'esma',
      type: mapDocType(item.type),
      categories: item.categories,
      title: item.title,
      shortTitle: item.reference,
      documentNumber: item.reference,
      publishDate: item.date,
      language: 'en',
      sourceUrl: item.url,
      pdfUrl: item.pdfUrl,
      summary: `${item.type.toUpperCase()}: ${item.title}. Reference: ${item.reference}. Published: ${item.date}.`,
      fullText,
      status: fullText ? 'scraped' : 'pending',
      lastScraped: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    return doc;
    
  } catch (error) {
    console.error(`[ESMA Scraper] Error processing ${item.reference}:`, error);
    return null;
  }
}

/**
 * Kör komplett ESMA-skrapning
 */
export async function runRealESMAScraper(): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let documentsFound = 0;
  let documentsNew = 0;
  const documentsUpdated = 0;
  
  console.log('[ESMA Scraper] Starting real document scrape...');
  console.log(`[ESMA Scraper] ${ESMA_DOCUMENT_REGISTRY.length} documents in registry`);
  
  for (const item of ESMA_DOCUMENT_REGISTRY) {
    documentsFound++;
    
    try {
      const doc = await scrapeESMADocument(item);
      
      if (doc) {
        await complianceDocStore.create(doc);
        documentsNew++;
        console.log(`[ESMA Scraper] ✅ Saved: ${item.reference}`);
      }
      
    } catch (error) {
      const msg = `Error processing ${item.reference}: ${(error as Error).message}`;
      errors.push(msg);
      console.error(`[ESMA Scraper] ❌ ${msg}`);
    }
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

/**
 * Lista alla tillgängliga ESMA-dokument
 */
export function listESMADocumentRegistry(): ESMARegistryItem[] {
  return ESMA_DOCUMENT_REGISTRY;
}

