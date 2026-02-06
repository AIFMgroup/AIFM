/**
 * API: Get Single Bank Document
 * 
 * Hämtar eller genererar nedladdningslänk för ett specifikt dokument
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBankStorageService } from '@/lib/integrations/bank/storage-service';

export const dynamic = 'force-dynamic';

interface DocumentResponse {
  success: boolean;
  data?: unknown;
  downloadUrl?: string;
  contentType?: string;
  error?: string;
}

/**
 * GET /api/bank/documents/[key]
 * 
 * Query params:
 * - download: If 'true', returns a presigned download URL instead of data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse<DocumentResponse>> {
  try {
    const { key } = await params;
    const { searchParams } = new URL(request.url);
    const downloadMode = searchParams.get('download') === 'true';
    
    // Decode the key (it's URL-encoded with / replaced)
    const decodedKey = decodeURIComponent(key).replace(/\|/g, '/');
    
    console.log('[Documents API] Fetching:', decodedKey);
    
    const storage = getBankStorageService();
    
    if (downloadMode) {
      // Return presigned URL for download
      const downloadUrl = await storage.getDownloadUrl(decodedKey, 3600);
      
      return NextResponse.json({
        success: true,
        downloadUrl,
      });
    }
    
    // Return actual data for JSON files
    const { data, contentType } = await storage.get(decodedKey);
    
    if (contentType === 'application/json') {
      const jsonData = JSON.parse(data.toString('utf-8'));
      
      return NextResponse.json({
        success: true,
        data: jsonData,
        contentType,
      });
    }
    
    // For non-JSON files, return download URL
    const downloadUrl = await storage.getDownloadUrl(decodedKey, 3600);
    
    return NextResponse.json({
      success: true,
      downloadUrl,
      contentType,
    });
    
  } catch (error) {
    console.error('[Documents API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bank/documents/[key]
 * 
 * Tar bort ett dokument
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
): Promise<NextResponse<{ success: boolean; error?: string }>> {
  try {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key).replace(/\|/g, '/');
    
    console.log('[Documents API] Deleting:', decodedKey);
    
    const storage = getBankStorageService();
    await storage.delete(decodedKey);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[Documents API] Delete error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
