/**
 * PDF Export Service
 * Generates PDF reports from HTML content using Puppeteer
 */

import { logInfo, logError } from './logger';

interface PDFOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

// Lazy load Puppeteer
async function getPuppeteer() {
  try {
    return require('puppeteer');
  } catch (error) {
    logError('Puppeteer not installed', error as Error);
    throw new Error('PDF export service not configured');
  }
}

/**
 * Generate PDF from HTML content
 */
export async function generatePDF(
  htmlContent: string,
  options: PDFOptions = {}
): Promise<Buffer> {
  const puppeteer = await getPuppeteer();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set content
    await page.setContent(htmlContent, { waitUntil: 'networkidle2' });

    // Generate PDF
    const pdf = await page.pdf({
      format: options.format || 'A4',
      margin: options.margin || {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      printBackground: true,
    });

    logInfo('PDF generated successfully', { size: pdf.length });
    return pdf;
  } catch (error) {
    logError('Failed to generate PDF', error as Error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate report PDF from structured data
 */
export async function generateReportPDF(report: {
  title: string;
  client: string;
  period: string;
  date: string;
  sections: Array<{ title: string; content: string }>;
  metadata?: { author?: string; creator?: string };
}): Promise<Buffer> {
  const currentDate = new Date().toLocaleDateString('sv-SE');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
        }
        
        .header {
          border-bottom: 3px solid #1e40af;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
        }
        
        .header h1 {
          color: #1e40af;
          font-size: 28px;
          margin-bottom: 0.5rem;
        }
        
        .header-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          font-size: 14px;
          color: #666;
        }
        
        .section {
          margin-bottom: 2rem;
          page-break-inside: avoid;
        }
        
        .section h2 {
          color: #1e40af;
          font-size: 18px;
          border-left: 4px solid #1e40af;
          padding-left: 1rem;
          margin-bottom: 1rem;
        }
        
        .section-content {
          margin-left: 1rem;
          font-size: 14px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 13px;
        }
        
        table th {
          background-color: #f0f4f8;
          color: #1e40af;
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #1e40af;
        }
        
        table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e0e0e0;
        }
        
        table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
          text-align: right;
        }
        
        .success {
          color: #059669;
          font-weight: 600;
        }
        
        .warning {
          color: #d97706;
          font-weight: 600;
        }
        
        .error {
          color: #dc2626;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(report.title)}</h1>
        <div class="header-info">
          <div>
            <strong>Client:</strong> ${escapeHtml(report.client)}<br>
            <strong>Period:</strong> ${escapeHtml(report.period)}
          </div>
          <div>
            <strong>Generated:</strong> ${currentDate}<br>
            ${report.metadata?.author ? `<strong>Author:</strong> ${escapeHtml(report.metadata.author)}<br>` : ''}
          </div>
        </div>
      </div>
      
      ${report.sections
        .map(
          (section) => `
        <div class="section">
          <h2>${escapeHtml(section.title)}</h2>
          <div class="section-content">
            ${section.content}
          </div>
        </div>
      `
        )
        .join('')}
      
      <div class="footer">
        <p>This report was generated by FINANS Agent Portal</p>
      </div>
    </body>
    </html>
  `;

  return generatePDF(htmlContent, {
    format: 'A4',
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '25mm',
      left: '20mm',
    },
  });
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Alternative: Server-side HTML escape (Node.js doesn't have document)
 */
function escapeHtmlNode(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Export the Node-compatible version
export async function generateReportPDFNode(report: {
  title: string;
  client: string;
  period: string;
  date: string;
  sections: Array<{ title: string; content: string }>;
  metadata?: { author?: string; creator?: string };
}): Promise<Buffer> {
  const currentDate = new Date().toLocaleDateString('sv-SE');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          line-height: 1.6;
        }
        
        .header {
          border-bottom: 3px solid #1e40af;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
        }
        
        .header h1 {
          color: #1e40af;
          font-size: 28px;
          margin-bottom: 0.5rem;
        }
        
        .header-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          font-size: 14px;
          color: #666;
        }
        
        .section {
          margin-bottom: 2rem;
          page-break-inside: avoid;
        }
        
        .section h2 {
          color: #1e40af;
          font-size: 18px;
          border-left: 4px solid #1e40af;
          padding-left: 1rem;
          margin-bottom: 1rem;
        }
        
        .section-content {
          margin-left: 1rem;
          font-size: 14px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 13px;
        }
        
        table th {
          background-color: #f0f4f8;
          color: #1e40af;
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #1e40af;
        }
        
        table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e0e0e0;
        }
        
        table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
          text-align: right;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtmlNode(report.title)}</h1>
        <div class="header-info">
          <div>
            <strong>Client:</strong> ${escapeHtmlNode(report.client)}<br>
            <strong>Period:</strong> ${escapeHtmlNode(report.period)}
          </div>
          <div>
            <strong>Generated:</strong> ${currentDate}<br>
            ${report.metadata?.author ? `<strong>Author:</strong> ${escapeHtmlNode(report.metadata.author)}<br>` : ''}
          </div>
        </div>
      </div>
      
      ${report.sections
        .map(
          (section) => `
        <div class="section">
          <h2>${escapeHtmlNode(section.title)}</h2>
          <div class="section-content">
            ${section.content}
          </div>
        </div>
      `
        )
        .join('')}
      
      <div class="footer">
        <p>This report was generated by FINANS Agent Portal</p>
      </div>
    </body>
    </html>
  `;

  return generatePDF(htmlContent, {
    format: 'A4',
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '25mm',
      left: '20mm',
    },
  });
}

export type { PDFOptions };
