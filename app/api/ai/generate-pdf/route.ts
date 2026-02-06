import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PDFRequest {
  title: string;
  content: string;
  subtitle?: string;
  sections?: Array<{
    title: string;
    content: string;
  }>;
  footer?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PDFRequest = await request.json();
    const { title, content, subtitle, sections, footer } = body;

    // Title is required, content OR sections must be provided
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    
    // Allow empty content if sections are provided
    const hasContent = content && content.trim().length > 0;
    const hasSections = sections && sections.length > 0;
    
    if (!hasContent && !hasSections) {
      return NextResponse.json(
        { error: 'Content or sections are required' },
        { status: 400 }
      );
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed standard fonts (no external files needed)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Colors
    const primaryColor = rgb(0.176, 0.165, 0.149); // #2d2a26
    const accentColor = rgb(0.753, 0.635, 0.502);  // #c0a280
    const grayColor = rgb(0.4, 0.4, 0.4);          // #666666
    
    // Page settings
    const pageWidth = 595.28;  // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 60;
    const contentWidth = pageWidth - (margin * 2);
    
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;
    
    // Helper function to add new page when needed
    const checkNewPage = (requiredSpace: number) => {
      if (currentY - requiredSpace < margin + 50) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
    };
    
    // Helper function to wrap text
    const wrapText = (text: string, font: typeof helvetica, fontSize: number, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        
        if (width <= maxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      return lines;
    };
    
    // Header
    page.drawText('AIFM GROUP', {
      x: margin,
      y: currentY,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    
    const dateStr = new Date().toLocaleDateString('sv-SE');
    const dateWidth = helvetica.widthOfTextAtSize(dateStr, 10);
    page.drawText(dateStr, {
      x: pageWidth - margin - dateWidth,
      y: currentY,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    
    currentY -= 20;
    
    // Decorative line
    page.drawLine({
      start: { x: margin, y: currentY },
      end: { x: pageWidth - margin, y: currentY },
      thickness: 2,
      color: accentColor,
    });
    
    currentY -= 40;
    
    // Title
    const titleLines = wrapText(title, helveticaBold, 24, contentWidth);
    for (const line of titleLines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, 24);
      page.drawText(line, {
        x: (pageWidth - titleWidth) / 2,
        y: currentY,
        size: 24,
        font: helveticaBold,
        color: primaryColor,
      });
      currentY -= 30;
    }
    
    // Subtitle if provided
    if (subtitle) {
      currentY -= 5;
      const subtitleLines = wrapText(subtitle, helvetica, 14, contentWidth);
      for (const line of subtitleLines) {
        const subtitleWidth = helvetica.widthOfTextAtSize(line, 14);
        page.drawText(line, {
          x: (pageWidth - subtitleWidth) / 2,
          y: currentY,
          size: 14,
          font: helvetica,
          color: grayColor,
        });
        currentY -= 18;
      }
    }
    
    currentY -= 30;
    
    // Main content (only if provided)
    if (hasContent) {
      const contentLines = content.split('\n');
      for (const paragraph of contentLines) {
        if (paragraph.trim() === '') {
          currentY -= 10;
          continue;
        }
        
        const wrappedLines = wrapText(paragraph, helvetica, 11, contentWidth);
        for (const line of wrappedLines) {
          checkNewPage(15);
          page.drawText(line, {
            x: margin,
            y: currentY,
            size: 11,
            font: helvetica,
            color: primaryColor,
          });
          currentY -= 15;
        }
      }
    }
    
    // Sections if provided
    if (sections && sections.length > 0) {
      for (const section of sections) {
        currentY -= 20;
        checkNewPage(40);
        
        // Section title
        const sectionTitleLines = wrapText(section.title, helveticaBold, 14, contentWidth);
        for (const line of sectionTitleLines) {
          page.drawText(line, {
            x: margin,
            y: currentY,
            size: 14,
            font: helveticaBold,
            color: accentColor,
          });
          currentY -= 18;
        }
        
        currentY -= 5;
        
        // Section content
        const sectionLines = section.content.split('\n');
        for (const paragraph of sectionLines) {
          if (paragraph.trim() === '') {
            currentY -= 8;
            continue;
          }
          
          const wrappedLines = wrapText(paragraph, helvetica, 11, contentWidth);
          for (const line of wrappedLines) {
            checkNewPage(15);
            page.drawText(line, {
              x: margin,
              y: currentY,
              size: 11,
              font: helvetica,
              color: primaryColor,
            });
            currentY -= 15;
          }
        }
      }
    }
    
    // Add footer to all pages
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const footerText = footer || 'Genererat av AIFM Agent | Konfidentiellt';
    
    pages.forEach((p, index) => {
      // Footer line
      p.drawLine({
        start: { x: margin, y: 50 },
        end: { x: pageWidth - margin, y: 50 },
        thickness: 1,
        color: accentColor,
      });
      
      // Footer text
      p.drawText(footerText, {
        x: margin,
        y: 35,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
      
      // Page number
      const pageNumText = `Sida ${index + 1} av ${totalPages}`;
      const pageNumWidth = helvetica.widthOfTextAtSize(pageNumText, 9);
      p.drawText(pageNumText, {
        x: pageWidth - margin - pageNumWidth,
        y: 35,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
    });
    
    // Set document metadata
    pdfDoc.setTitle(title);
    pdfDoc.setAuthor('AIFM Group');
    pdfDoc.setCreator('AIFM Agent');
    pdfDoc.setProducer('AIFM Agent');
    pdfDoc.setCreationDate(new Date());
    
    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF as download
    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_')}.pdf"`,
      },
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
