import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBase } from '@/lib/compliance/knowledge-base';
import { swedishLawScraper } from '@/lib/compliance/scrapers/swedish-law-scraper';

/**
 * GET /api/compliance/documents
 * Get all documents in the knowledge base
 */
export async function GET() {
  try {
    const documents = await knowledgeBase.getAllDocuments();
    
    return NextResponse.json({
      documents,
      count: documents.length,
    });
  } catch (error) {
    console.error('Failed to get documents:', error);
    return NextResponse.json(
      { error: 'Failed to get documents', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/compliance/documents
 * Add a new document to the knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, urls, title, content, sourceType, metadata } = body;

    // Handle URL scraping (single or multiple)
    if (url || urls) {
      const urlsToScrape = urls || [url];
      const results = await swedishLawScraper.scrapeMultipleUrls(urlsToScrape);
      
      const addedDocuments = [];
      
      for (const scrapedDoc of results.success) {
        const document = await knowledgeBase.addDocument({
          title: scrapedDoc.title,
          source: scrapedDoc.source,
          sourceType: 'url',
          content: scrapedDoc.content,
          metadata: scrapedDoc.metadata,
        });
        addedDocuments.push(document);
      }
      
      return NextResponse.json({
        success: true,
        added: addedDocuments.length,
        failed: results.failed.length,
        documents: addedDocuments,
        errors: results.failed,
      });
    }

    // Handle direct content upload
    if (content) {
      const document = await knowledgeBase.addDocument({
        title: title || 'Unnamed Document',
        source: 'manual-upload',
        sourceType: sourceType || 'text',
        content,
        metadata: metadata || {},
      });

      return NextResponse.json({
        success: true,
        document,
      });
    }

    return NextResponse.json(
      { error: 'Either url, urls, or content is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to add document:', error);
    return NextResponse.json(
      { error: 'Failed to add document', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compliance/documents
 * Delete a document from the knowledge base
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    await knowledgeBase.deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      deletedId: documentId,
    });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document', details: (error as Error).message },
      { status: 500 }
    );
  }
}
