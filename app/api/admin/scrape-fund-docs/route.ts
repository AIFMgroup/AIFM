/**
 * API Route: Scrape fund documents from a URL
 *
 * POST /api/admin/scrape-fund-docs
 *   body: { url: string, fundId: string, dryRun?: boolean }
 *
 *   Step 1 (dryRun=true):  Fetch the page, extract all PDF links, return list.
 *   Step 2 (dryRun=false): Download each PDF, upload to S3, extract text, save to DynamoDB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import {
  saveFundDocument,
  generateDocumentId,
  getFundDocuments,
  type FundDocumentCategory,
} from '@/lib/fund-documents/fund-document-store';

const region = process.env.AWS_REGION || 'eu-north-1';
const S3_BUCKET = process.env.FUND_DOCUMENTS_BUCKET || process.env.COMPLIANCE_S3_BUCKET || 'aifm-documents';

const s3 = new S3Client({ region });
const textract = new TextractClient({ region });

interface PdfLink {
  url: string;
  text: string;
  fileName: string;
  category: FundDocumentCategory;
}

function guessCategory(text: string, fileName: string): FundDocumentCategory {
  const lower = (text + ' ' + fileName).toLowerCase();
  if (lower.includes('delårsrapport') || lower.includes('delarsrapport') || lower.includes('semi-annual') || lower.includes('halvårs') || lower.includes('halvarsredogorelse') || lower.includes('halvårsredogörelse')) return 'arsredovisning';
  if (lower.includes('årsredovisning') || lower.includes('arsredovisning') || lower.includes('annual report') || lower.includes('arsberattelse') || lower.includes('årsberättelse')) return 'arsredovisning';
  if (lower.includes('fondvillkor') || lower.includes('fondbestammelser') || lower.includes('fondbestämmelser') || lower.includes('grundprospekt') || lower.includes('prospekt')) return 'fondvillkor';
  if (lower.includes('hållbarhet') || lower.includes('sustainability') || lower.includes('sfdr') || lower.includes('upplysningar')) return 'hallbarhetsrapport';
  if (lower.includes('informationsbroschyr') || lower.includes('information memorandum') || lower.includes('broschyr')) return 'informationsbroschyr';
  if (lower.includes('faktablad') || lower.includes('priip') || lower.includes('key information')) return 'faktablad';
  if (lower.includes('placering') || lower.includes('policy') || lower.includes('placeringspolicy')) return 'placeringspolicy';
  return 'ovrigt';
}

function extractFileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'document.pdf';
    return decodeURIComponent(last);
  } catch {
    return 'document.pdf';
  }
}

async function extractText(buffer: Buffer): Promise<string> {
  // Textract DetectDocumentText supports images and single-page PDFs.
  // For multi-page, we chunk by 5MB limit.
  if (buffer.length > 5 * 1024 * 1024) {
    return '[Dokumentet är för stort för direkt textextraktion – ladda upp manuellt för OCR]';
  }
  const res = await textract.send(
    new DetectDocumentTextCommand({ Document: { Bytes: buffer } }),
  );
  return (
    res.Blocks?.filter((b) => b.BlockType === 'LINE')
      .map((b) => b.Text)
      .filter(Boolean)
      .join('\n') ?? ''
  );
}

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-aifm-role');
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { url, fundId, dryRun = true, selectedLinks } = body as {
      url: string;
      fundId: string;
      dryRun?: boolean;
      selectedLinks?: PdfLink[];
    };

    if (!url) {
      return NextResponse.json({ error: 'URL krävs' }, { status: 400 });
    }

    // ── Step 1: Scrape the page and find PDF links ──
    if (dryRun) {
      console.log(`[Scrape] Fetching page: ${url}`);
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIFM-Bot/1.0)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (!pageResponse.ok) {
        return NextResponse.json(
          { error: `Kunde inte hämta sidan: ${pageResponse.status} ${pageResponse.statusText}` },
          { status: 400 },
        );
      }

      const html = await pageResponse.text();

      // Extract all links that point to PDFs
      const linkRegex = /<a\s[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      const pdfLinks: PdfLink[] = [];
      const seen = new Set<string>();
      let match;

      while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1];
        const linkText = match[2].replace(/<[^>]+>/g, '').trim();

        // Resolve relative URLs
        if (href.startsWith('/')) {
          const base = new URL(url);
          href = `${base.origin}${href}`;
        } else if (!href.startsWith('http')) {
          const base = new URL(url);
          href = `${base.origin}/${href}`;
        }

        if (seen.has(href)) continue;
        seen.add(href);

        const fileName = extractFileName(href);
        pdfLinks.push({
          url: href,
          text: linkText || fileName,
          fileName,
          category: guessCategory(linkText, fileName),
        });
      }

      // Also check for links using wp-content/uploads or similar patterns
      const hrefRegex = /href=["']([^"']*(?:\.pdf|uploads\/[^"']+))["']/gi;
      while ((match = hrefRegex.exec(html)) !== null) {
        let href = match[1];
        if (!href.toLowerCase().endsWith('.pdf')) continue;

        if (href.startsWith('/')) {
          const base = new URL(url);
          href = `${base.origin}${href}`;
        } else if (!href.startsWith('http')) {
          const base = new URL(url);
          href = `${base.origin}/${href}`;
        }

        if (seen.has(href)) continue;
        seen.add(href);

        const fileName = extractFileName(href);
        pdfLinks.push({
          url: href,
          text: fileName,
          fileName,
          category: guessCategory('', fileName),
        });
      }

      console.log(`[Scrape] Found ${pdfLinks.length} PDF links on ${url}`);

      return NextResponse.json({
        success: true,
        pageTitle: html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || url,
        pdfLinks,
        totalFound: pdfLinks.length,
      });
    }

    // ── Step 2: Download selected PDFs and ingest ──
    if (!fundId) {
      return NextResponse.json({ error: 'fundId krävs för nedladdning' }, { status: 400 });
    }

    const linksToDownload: PdfLink[] = selectedLinks || [];
    if (linksToDownload.length === 0) {
      return NextResponse.json({ error: 'Inga PDF-länkar valda' }, { status: 400 });
    }

    // Check existing documents to avoid duplicates
    const existingDocs = await getFundDocuments(fundId);
    const existingNames = new Set(existingDocs.map((d) => d.fileName.toLowerCase()));

    const results: Array<{
      fileName: string;
      status: 'ok' | 'skipped' | 'error';
      message: string;
      documentId?: string;
      textLength?: number;
    }> = [];

    for (const link of linksToDownload) {
      // Skip duplicates
      if (existingNames.has(link.fileName.toLowerCase())) {
        results.push({
          fileName: link.fileName,
          status: 'skipped',
          message: 'Redan uppladdad',
        });
        continue;
      }

      try {
        console.log(`[Scrape] Downloading: ${link.url}`);
        const pdfResponse = await fetch(link.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIFM-Bot/1.0)' },
        });

        if (!pdfResponse.ok) {
          results.push({
            fileName: link.fileName,
            status: 'error',
            message: `HTTP ${pdfResponse.status}`,
          });
          continue;
        }

        const buffer = Buffer.from(await pdfResponse.arrayBuffer());
        const documentId = generateDocumentId();
        const s3Key = `funds/${fundId}/${link.category}/${link.fileName}`;

        // Upload to S3
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: buffer,
            ContentType: 'application/pdf',
            Metadata: {
              fundId,
              originalFilename: link.fileName,
              sourceUrl: link.url,
              uploadedBy: 'scraper',
            },
          }),
        );

        // Extract text
        let textContent = '';
        try {
          textContent = await extractText(buffer);
        } catch (err) {
          console.warn(`[Scrape] Text extraction failed for ${link.fileName}:`, err);
        }

        // Save to DynamoDB
        await saveFundDocument({
          fundId,
          documentId,
          fileName: link.fileName,
          fileType: 'application/pdf',
          fileSize: buffer.length,
          s3Key,
          category: link.category,
          uploadedBy: 'scraper',
          uploadedAt: new Date().toISOString(),
          textContent: textContent || undefined,
        });

        existingNames.add(link.fileName.toLowerCase());

        results.push({
          fileName: link.fileName,
          status: 'ok',
          message: textContent
            ? `${Math.round(buffer.length / 1024)} KB, ${textContent.length} tecken extraherade`
            : `${Math.round(buffer.length / 1024)} KB (ingen text kunde extraheras)`,
          documentId,
          textLength: textContent.length,
        });

        console.log(`[Scrape] Saved ${link.fileName} → ${documentId} (${textContent.length} chars)`);
      } catch (err) {
        console.error(`[Scrape] Error processing ${link.url}:`, err);
        results.push({
          fileName: link.fileName,
          status: 'error',
          message: err instanceof Error ? err.message : 'Okänt fel',
        });
      }
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    const skipCount = results.filter((r) => r.status === 'skipped').length;
    const errCount = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      results,
      summary: { total: results.length, ok: okCount, skipped: skipCount, errors: errCount },
    });
  } catch (error) {
    console.error('[Scrape] Error:', error);
    return NextResponse.json(
      { error: 'Skrapning misslyckades', details: (error as Error).message },
      { status: 500 },
    );
  }
}
