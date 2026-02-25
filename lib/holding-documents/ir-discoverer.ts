/**
 * IR Document Discoverer
 * Discovers annual reports, sustainability reports, investor presentations, etc.
 * from company websites and search results. Rate-limited and supports listed + non-listed.
 */

import * as cheerio from 'cheerio';
import type { HoldingDocumentCategory } from './holding-document-store';

const RATE_LIMIT_MS = 2000;
let lastRequestTime = 0;

function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    return new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_MS - elapsed),
    );
  }
  lastRequestTime = Date.now();
  return Promise.resolve();
}

export interface DiscoveredDocument {
  url: string;
  title: string;
  category: HoldingDocumentCategory;
}

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

async function fetchPage(
  url: string,
  timeoutMs = 10000,
): Promise<string | null> {
  await rateLimit();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const PDF_PATTERN = /\.pdf($|\?)/i;

const DOC_PATTERNS: { pattern: RegExp; category: HoldingDocumentCategory }[] = [
  {
    pattern: /annual.?report|arsredovisning|årsredovisning|year.?end/i,
    category: 'annual_report',
  },
  {
    pattern: /quarter|kvartals|q[1-4]|interim|halvår|half.?year/i,
    category: 'quarterly_report',
  },
  {
    pattern: /sustainab|hållbar|esg|gri|csr|hallbarhet|responsible/i,
    category: 'sustainability_report',
  },
  {
    pattern:
      /investor|presentation|cmd|capital.?market|roadshow|analyst/i,
    category: 'investor_presentation',
  },
  {
    pattern:
      /governance|bolagsstyrning|proxy|remuneration|tax.?strategy|compliance|code.?conduct/i,
    category: 'governance',
  },
  { pattern: /prospekt|prospectus|industry|bransch|sector/i, category: 'other' },
];

function categorizeFromTextAndUrl(
  title: string,
  url: string,
): HoldingDocumentCategory {
  const combined = `${title} ${url}`.toLowerCase();
  const match = DOC_PATTERNS.find((p) => p.pattern.test(combined));
  return match?.category ?? 'other';
}

/**
 * Normalize company name for URL/search matching (e.g. "RIO TINTO PLC" -> "rio tinto").
 */
function searchSlug(name: string): string {
  const trimmed = name
    .replace(/\s+(AB|A\/S|ASA|Oyj|PLC|Plc|Inc|Corp|Ltd|Limited)\.?$/i, '')
    .trim();
  const first = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
  const slug = trimmed.toLowerCase().replace(/\s+/g, ' ');
  return slug || first;
}

/** Domain from website URL for site: search operator (e.g. riotinto.com). */
function domainFromWebsite(website: string): string | null {
  try {
    const u = new URL(website);
    const host = u.hostname.replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

/** Domains to exclude from search results (spam/irrelevant). */
const EXCLUDED_DOMAINS = new Set([
  'google.com', 'bing.com', 'youtube.com', 'facebook.com', 'twitter.com', 'linkedin.com',
  'wikipedia.org', 'wikimedia.org', 'scribd.com', 'slideshare.net', 'issuu.com',
]);

function isAllowedPdfUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (EXCLUDED_DOMAINS.has(host)) return false;
    if (host.endsWith('.google.') || host.endsWith('.bing.')) return false;
    return true;
  } catch {
    return false;
  }
}

/** Extract PDF and page URLs from Google search result HTML. */
function extractUrlsFromGoogleHtml(
  html: string,
  firstWord: string,
  tickerNorm: string,
): { pdfUrls: string[]; pageUrls: string[] } {
  const pdfUrls: string[] = [];
  const pageUrls: string[] = [];
  const $ = cheerio.load(html);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const urlMatch = href.match(/\/url\?q=([^&]+)/);
    if (!urlMatch) return;
    try {
      const decoded = decodeURIComponent(urlMatch[1]);
      if (!decoded.startsWith('http')) return;
      const lower = decoded.toLowerCase();
      const isPdf = PDF_PATTERN.test(decoded);
      if (isPdf && isAllowedPdfUrl(decoded)) pdfUrls.push(decoded);
      else if (
        !isPdf &&
        (firstWord === '' || lower.includes(firstWord)) &&
        (tickerNorm === '' || lower.includes(tickerNorm))
      )
        pageUrls.push(decoded);
    } catch {
      /* skip */
    }
  });
  return { pdfUrls, pageUrls };
}

/** Extract PDF and page URLs from Bing search result HTML. */
function extractUrlsFromBingHtml(html: string): string[] {
  const urls: string[] = [];
  const $ = cheerio.load(html);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.startsWith('http') || href.includes('bing.com')) return;
    if (PDF_PATTERN.test(href) && isAllowedPdfUrl(href)) urls.push(href);
  });
  return urls;
}

/**
 * Discover IR documents for a company: annual reports, sustainability, presentations, governance.
 * Uses company website paths and optional Google search. Rate-limited (2s between requests).
 */
export async function discoverIRDocuments(
  companyName: string,
  ticker: string,
  website?: string,
): Promise<DiscoveredDocument[]> {
  const docs: DiscoveredDocument[] = [];
  const visited = new Set<string>();
  const slug = searchSlug(companyName);
  const firstWord = slug.split(' ')[0] ?? '';
  const tickerNorm = ticker.toLowerCase().replace(/[.-]/g, '');

  const irKeywords = [
    'investor',
    'investors',
    'ir',
    'investerare',
    'financial-reports',
    'reports',
    'annual-report',
    'sustainability',
    'sustainable',
    'esg',
    'hallbarhet',
    'governance',
    'corporate',
    'csr',
    'responsible',
    'media',
    'news',
  ];

  const candidateUrls: string[] = [];

  if (website) {
    candidateUrls.push(website);
    const base = website.replace(/\/$/, '');
    let siteRoot = base;
    try {
      const u = new URL(base);
      siteRoot = u.origin;
    } catch {
      /* keep base */
    }
    for (const kw of irKeywords.slice(0, 10)) {
      candidateUrls.push(`${base}/${kw}`);
      candidateUrls.push(`${base}/en/${kw}`);
      candidateUrls.push(`${base}/sv/${kw}`);
    }
    // Sustainability/ESG paths on both page base and site root (e.g. riotinto.com/invest -> also riotinto.com/sustainability)
    const sustainPaths = ['/sustainability', '/sustainable-development', '/esg', '/about/sustainability', '/en/sustainability'];
    for (const path of sustainPaths) {
      candidateUrls.push(`${base}${path}`);
      if (siteRoot !== base) candidateUrls.push(`${siteRoot}${path}`);
    }
  }

  const shortName = companyName
    .replace(/\s+(AB|A\/S|ASA|Oyj|PLC|Plc|Inc|Corp|Ltd|Limited)\.?$/i, '')
    .trim();
  const domain = website ? domainFromWebsite(website) : null;

  const searchQueries: string[] = [
    `${shortName} annual report filetype:pdf`,
    `${shortName} sustainability report filetype:pdf`,
    `${shortName} ESG report filetype:pdf`,
    `${shortName} investor relations annual report PDF`,
    `${shortName} årsredovisning PDF`,
    `${shortName} sustainable development report filetype:pdf`,
  ];
  if (domain) {
    searchQueries.push(
      `site:${domain} filetype:pdf annual report`,
      `site:${domain} filetype:pdf sustainability`,
      `site:${domain} filetype:pdf quarterly`,
    );
  }

  for (const query of searchQueries) {
    try {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=8`;
      const html = await fetchPage(googleUrl, 8000);
      if (html) {
        const { pdfUrls, pageUrls } = extractUrlsFromGoogleHtml(html, firstWord, tickerNorm);
        pdfUrls.forEach((u) => candidateUrls.push(u));
        pageUrls.forEach((u) => candidateUrls.push(u));
      }
    } catch {
      console.warn('[IR Discoverer] Google search failed for:', query);
    }
  }

  // Bing fallback (2–3 queries)
  const bingQueries = [
    `${shortName} annual report filetype:pdf`,
    `${shortName} sustainability report filetype:pdf`,
  ];
  if (domain) bingQueries.push(`site:${domain} filetype:pdf`);
  for (const query of bingQueries) {
    try {
      const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=8`;
      const html = await fetchPage(bingUrl, 8000);
      if (html) {
        const pdfs = extractUrlsFromBingHtml(html);
        pdfs.forEach((u) => candidateUrls.push(u));
      }
    } catch {
      console.warn('[IR Discoverer] Bing search failed for:', query);
    }
  }

  // Prioritise URLs that look like sustainability/ESG pages so we find those reports
  const sustainRegex = /sustainab|esg|sustainable|hallbarhet|csr|responsible|gri/i;
  const sortedCandidates = [...candidateUrls].sort((a, b) => {
    const aSustain = sustainRegex.test(a) ? 1 : 0;
    const bSustain = sustainRegex.test(b) ? 1 : 0;
    return bSustain - aSustain;
  });

  const DOWNLOAD_PATTERN = /\.pdf($|\?)|download|document|report|file=.*\.pdf/i;

  for (const url of sortedCandidates.slice(0, 30)) {
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      if (PDF_PATTERN.test(url)) {
        const title = decodeURIComponent(url.split('/').pop() || '').replace(
          /\.pdf.*/i,
          '',
        );
        const cat = categorizeFromTextAndUrl(title, url);
        docs.push({
          url,
          title: title || `${companyName} document`,
          category: cat,
        });
        continue;
      }

      const html = await fetchPage(url, 8000);
      if (!html) continue;

      const $ = cheerio.load(html);

      function addPdfLink(href: string, text: string, baseUrl: string) {
        if (!href || !href.trim()) return;
        let fullUrl: string;
        try {
          fullUrl = new URL(href.trim(), baseUrl).toString();
        } catch {
          return;
        }
        if (!PDF_PATTERN.test(fullUrl) && !DOWNLOAD_PATTERN.test(fullUrl)) return;
        if (!PDF_PATTERN.test(fullUrl)) return;
        if (visited.has(fullUrl)) return;
        visited.add(fullUrl);
        const combined = `${text} ${fullUrl}`.toLowerCase();
        const cat = categorizeFromTextAndUrl(text, fullUrl);
        docs.push({
          url: fullUrl,
          title:
            text ||
            decodeURIComponent(fullUrl.split('/').pop() || '').replace(
              /\.pdf.*/i,
              '',
            ),
          category: cat,
        });
      }

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        addPdfLink(href, text, url);
      });
      $('a[data-href]').each((_, el) => {
        const href = $(el).attr('data-href') || '';
        const text = $(el).text().trim();
        addPdfLink(href, text, url);
      });
      $('a[data-url]').each((_, el) => {
        const href = $(el).attr('data-url') || '';
        const text = $(el).text().trim();
        addPdfLink(href, text, url);
      });
      $('iframe[src]').each((_, el) => {
        const src = $(el).attr('src') || '';
        if (PDF_PATTERN.test(src)) addPdfLink(src, '', url);
      });
    } catch {
      continue;
    }

    if (docs.length >= 20) break;
  }

  return docs.slice(0, 20);
}
