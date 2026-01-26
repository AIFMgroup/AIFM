import { NextRequest, NextResponse } from 'next/server';
import { generateReportHTML, ReportConfig } from '@/lib/reports/pdfGenerator';

export async function POST(request: NextRequest) {
  try {
    const config: ReportConfig = await request.json();
    
    // Generate HTML
    const html = generateReportHTML(config);
    
    // For server-side PDF generation, you would use a library like Puppeteer or wkhtmltopdf
    // For now, we return the HTML which the client can use with print-to-PDF
    
    // Option 1: Return HTML for client-side printing
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${config.title.replace(/\s+/g, '_')}.html"`,
      },
    });
    
    // Option 2: If you have Puppeteer installed, you could generate a real PDF:
    // const browser = await puppeteer.launch({ headless: true });
    // const page = await browser.newPage();
    // await page.setContent(html, { waitUntil: 'networkidle0' });
    // const pdf = await page.pdf({ format: 'A4', printBackground: true });
    // await browser.close();
    // 
    // return new NextResponse(pdf, {
    //   headers: {
    //     'Content-Type': 'application/pdf',
    //     'Content-Disposition': `attachment; filename="${config.title}.pdf"`,
    //   },
    // });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}



