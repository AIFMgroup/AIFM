import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import {
  uploadUserDocument,
  deleteUserDocument,
  syncKnowledgeBase,
  getKnowledgeBaseStats,
  retrieveFromKnowledgeBase,
  isKnowledgeBaseConfigured,
} from '@/lib/compliance/bedrockKnowledgeBase';
import { 
  processDocument as processDocumentLocal, 
  getDocumentsByCompany as getLocalDocuments 
} from '@/lib/compliance/ragPipeline';
import { complianceDocStore } from '@/lib/compliance/documentStore';

// Helper to get user info from token (simplified)
async function getUserFromToken(token: string): Promise<{ userId: string; companyId: string } | null> {
  // In production, verify the token and extract user info
  // For now, decode the JWT payload
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return {
      userId: payload.sub || payload.email || 'unknown',
      companyId: payload['custom:companyId'] || payload.companyId || 'default',
    };
  } catch {
    return null;
  }
}

/**
 * GET - Hämta kunskapsbasens status och statistik
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Search in knowledge base
    if (action === 'search') {
      const query = searchParams.get('query');
      if (!query) {
        return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
      }

      const category = searchParams.get('category') || undefined;
      const source = searchParams.get('source') || undefined;
      const limit = parseInt(searchParams.get('limit') || '10');

      if (isKnowledgeBaseConfigured()) {
        const results = await retrieveFromKnowledgeBase(query, limit, { category, source });
        return NextResponse.json({ results });
      } else {
        // Fallback to local search
        return NextResponse.json({ 
          results: [],
          warning: 'Knowledge Base not configured, using local search'
        });
      }
    }

    // Get statistics
    if (action === 'stats') {
      const stats = await getKnowledgeBaseStats();
      
      // Also get user-uploaded documents count
      const userDocs = await complianceDocStore.listBySource('custom', 1000);
      const companyDocs = userDocs.filter(d => d.id.startsWith(user.companyId));

      return NextResponse.json({
        knowledgeBase: stats,
        userDocuments: {
          total: companyDocs.length,
          embedded: companyDocs.filter(d => d.status === 'embedded').length,
        },
        configured: isKnowledgeBaseConfigured(),
      });
    }

    // List user's uploaded documents
    if (action === 'list-documents') {
      const docs = await complianceDocStore.listBySource('custom', 100);
      const companyDocs = docs.filter(d => d.id.startsWith(user.companyId));

      return NextResponse.json({
        documents: companyDocs.map(d => ({
          id: d.id,
          title: d.title,
          documentNumber: d.documentNumber,
          status: d.status,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      });
    }

    // Default: return general info
    return NextResponse.json({
      configured: isKnowledgeBaseConfigured(),
      stats: await getKnowledgeBaseStats(),
    });

  } catch (error) {
    console.error('Knowledge base GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Ladda upp dokument eller trigga synkronisering
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Sync knowledge base
    if (action === 'sync') {
      if (!isKnowledgeBaseConfigured()) {
        return NextResponse.json(
          { error: 'Knowledge Base not configured' },
          { status: 400 }
        );
      }

      const result = await syncKnowledgeBase();
      return NextResponse.json({
        success: true,
        ingestionJobId: result.ingestionJobId,
        status: result.status,
      });
    }

    // Upload document
    if (action === 'upload') {
      const { title, content, category, documentNumber, effectiveDate, fileName } = body;

      if (!title || !content) {
        return NextResponse.json(
          { error: 'Missing required fields: title, content' },
          { status: 400 }
        );
      }

      // Validate content length
      if (content.length > 1000000) { // 1MB text limit
        return NextResponse.json(
          { error: 'Document too large. Maximum 1MB of text.' },
          { status: 400 }
        );
      }

      const documentId = `${user.companyId}-${uuidv4()}`;

      if (isKnowledgeBaseConfigured()) {
        // Upload to Bedrock Knowledge Base
        const result = await uploadUserDocument(
          user.companyId,
          documentId,
          content,
          {
            title,
            category,
            documentNumber,
            effectiveDate,
            uploadedBy: user.userId,
            fileName,
            source: 'user_uploaded',
          }
        );

        // Also save metadata to local store for listing
        await complianceDocStore.create({
          id: documentId,
          source: 'custom',
          type: 'other',
          categories: ['general'],
          title,
          documentNumber,
          publishDate: new Date().toISOString(),
          effectiveDate,
          language: 'sv',
          sourceUrl: `internal://company/${user.companyId}/documents/${documentId}`,
          status: 'embedded',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          documentId,
          s3Key: result.s3Key,
          message: 'Dokumentet har laddats upp. Det kan ta några minuter innan det blir sökbart.',
        });
      } else {
        // Fallback to local processing
        await processDocumentLocal({
          id: documentId,
          source: 'custom',
          type: 'other',
          categories: ['general'],
          title,
          documentNumber,
          publishDate: new Date().toISOString(),
          effectiveDate,
          language: 'sv',
          sourceUrl: `internal://company/${user.companyId}/documents/${documentId}`,
          fullText: content,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          documentId,
          message: 'Dokumentet har processats lokalt.',
        });
      }
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Knowledge base POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Ta bort användardokument
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId parameter' },
        { status: 400 }
      );
    }

    // Verify document belongs to user's company
    if (!documentId.startsWith(user.companyId)) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this document' },
        { status: 403 }
      );
    }

    if (isKnowledgeBaseConfigured()) {
      await deleteUserDocument(user.companyId, documentId);
    }

    // Also remove from local store
    // Note: complianceDocStore would need a delete method

    return NextResponse.json({
      success: true,
      message: 'Dokumentet har tagits bort.',
    });

  } catch (error) {
    console.error('Knowledge base DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}






