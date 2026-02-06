import { NextRequest, NextResponse } from 'next/server';
import { retrieveFromKnowledgeBase, isKnowledgeBaseConfigured } from '@/lib/compliance/bedrockKnowledgeBase';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================================================
// Types
// ============================================================================

interface DocumentSearchResult {
  id: string;
  title: string;
  path: string;
  excerpt: string;
  relevanceScore: number;
  type: string;
  source: 'knowledge_base' | 'dropbox' | 's3';
  metadata: Record<string, string | number | undefined>;
  downloadUrl?: string;
}

// ============================================================================
// S3 Client
// ============================================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

const KNOWLEDGE_BASE_BUCKET = process.env.KNOWLEDGE_BASE_S3_BUCKET || 'aifm-knowledge-base';

// ============================================================================
// Helper Functions
// ============================================================================

function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  const typeMap: Record<string, string> = {
    pdf: 'PDF',
    doc: 'Word',
    docx: 'Word',
    xls: 'Excel',
    xlsx: 'Excel',
    txt: 'Text',
    md: 'Markdown',
    csv: 'CSV',
    json: 'JSON',
    xml: 'XML',
  };
  return typeMap[ext] || 'Dokument';
}

async function generateDownloadUrl(s3Key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: KNOWLEDGE_BASE_BUCKET,
      Key: s3Key,
    });
    
    // Generate URL valid for 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error('Failed to generate download URL:', error);
    return null;
  }
}

// ============================================================================
// GET - Search documents
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');
    const type = searchParams.get('type'); // 'semantic' | 'filename' | 'all'
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeDownloadUrl = searchParams.get('includeUrl') === 'true';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    const results: DocumentSearchResult[] = [];

    // Semantic search via Knowledge Base
    if (type !== 'filename' && isKnowledgeBaseConfigured()) {
      try {
        const kbResults = await retrieveFromKnowledgeBase(query, Math.min(limit, 15));
        
        for (const result of kbResults) {
          const doc: DocumentSearchResult = {
            id: result.metadata.doc_id || `kb-${results.length}`,
            title: result.metadata.title || result.metadata.source || 'Okänt dokument',
            path: result.metadata.source || '',
            excerpt: result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''),
            relevanceScore: result.score,
            type: getFileType(result.metadata.source || ''),
            source: 'knowledge_base',
            metadata: result.metadata,
          };

          // Extract S3 key from source if it looks like an S3 path
          const s3Key = result.metadata.source?.includes('s3://') 
            ? result.metadata.source.replace(/^s3:\/\/[^\/]+\//, '')
            : result.metadata.source;
          
          if (includeDownloadUrl && s3Key) {
            doc.downloadUrl = await generateDownloadUrl(s3Key) || undefined;
          }

          results.push(doc);
        }
      } catch (error) {
        console.error('Knowledge base search failed:', error);
      }
    }

    // Filename search in S3
    if (type === 'filename' || type === 'all') {
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: KNOWLEDGE_BASE_BUCKET,
          MaxKeys: 100,
        });

        const s3Response = await s3Client.send(listCommand);
        const queryLower = query.toLowerCase();

        for (const obj of s3Response.Contents || []) {
          if (!obj.Key) continue;
          
          const filename = obj.Key.split('/').pop() || '';
          const filenameLower = filename.toLowerCase();

          // Check if filename contains query
          if (filenameLower.includes(queryLower)) {
            const existing = results.find(r => r.path === obj.Key);
            if (!existing) {
              const doc: DocumentSearchResult = {
                id: `s3-${obj.Key}`,
                title: filename,
                path: obj.Key,
                excerpt: `Fil hittad i ${obj.Key.split('/').slice(0, -1).join('/')}`,
                relevanceScore: filenameLower === queryLower ? 1.0 : 0.7,
                type: getFileType(filename),
                source: obj.Key.startsWith('dropbox-documents') ? 'dropbox' : 's3',
                metadata: {
                  size: obj.Size?.toString() || '0',
                  lastModified: obj.LastModified?.toISOString() || '',
                },
              };

              if (includeDownloadUrl) {
                doc.downloadUrl = await generateDownloadUrl(obj.Key) || undefined;
              }

              results.push(doc);
            }
          }
        }
      } catch (error) {
        console.error('S3 filename search failed:', error);
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      query,
      count: results.length,
      results: results.slice(0, limit),
    });

  } catch (error) {
    console.error('[Document Search] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

// ============================================================================
// POST - Get document content or download URL
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, documentId, s3Key, path } = body;

    if (action === 'get-content') {
      // Retrieve document content from S3
      const key = s3Key || path || documentId;
      if (!key) {
        return NextResponse.json({ error: 'Document key required' }, { status: 400 });
      }

      const command = new GetObjectCommand({
        Bucket: KNOWLEDGE_BASE_BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);
      const content = await response.Body?.transformToString();

      return NextResponse.json({
        documentId: key,
        content: content?.substring(0, 50000) || '', // Limit content size
        contentType: response.ContentType,
        metadata: response.Metadata,
      });
    }

    if (action === 'get-download-url') {
      const key = s3Key || path || documentId;
      if (!key) {
        return NextResponse.json({ error: 'Document key required' }, { status: 400 });
      }

      const downloadUrl = await generateDownloadUrl(key);
      if (!downloadUrl) {
        return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 });
      }

      return NextResponse.json({ downloadUrl });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Document Search] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
