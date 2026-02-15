/**
 * API: Bank Documents
 * 
 * Listar och hämtar sparade bankdokument:
 * - Swedbank PDF:er och processad data
 * - SEB API-snapshots
 * - Avstämningsrapporter
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getBankStorageService, 
  DataCategory,
  StoredDocument 
} from '@/lib/integrations/bank/storage-service';

export const dynamic = 'force-dynamic';

interface DocumentsResponse {
  success: boolean;
  documents: StoredDocument[];
  stats?: {
    totalDocuments: number;
    byCategory: Record<string, number>;
  };
  error?: string;
}

/**
 * GET /api/bank/documents
 * 
 * Query params:
 * - category: swedbank | seb | reconciliation (optional)
 * - subCategory: positions | balances | pdfs | processed | reports etc. (optional)
 * - fundId: Filter by fund (optional)
 * - accountId: Filter by account (optional)
 * - fromDate: YYYY-MM-DD (optional)
 * - toDate: YYYY-MM-DD (optional)
 * - limit: Max results (default 50)
 * - includeStats: Include storage statistics (optional)
 */
export async function GET(request: NextRequest): Promise<NextResponse<DocumentsResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category') as DataCategory | null;
    const subCategory = searchParams.get('subCategory');
    const fundId = searchParams.get('fundId');
    const accountId = searchParams.get('accountId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStats = searchParams.get('includeStats') === 'true';
    
    const storage = getBankStorageService();
    
    let documents: StoredDocument[] = [];
    
    if (category) {
      // List specific category
      documents = await storage.list({
        category,
        subCategory: subCategory || undefined,
        fundId: fundId || undefined,
        accountId: accountId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        limit,
      });
    } else {
      // List all categories
      const categories: DataCategory[] = ['swedbank', 'seb', 'reconciliation'];
      
      for (const cat of categories) {
        const catDocs = await storage.list({
          category: cat,
          limit: Math.floor(limit / categories.length),
        });
        documents.push(...catDocs);
      }
      
      // Sort combined results
      documents.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.lastModified.getTime() - a.lastModified.getTime();
      });
      
      documents = documents.slice(0, limit);
    }
    
    // Get stats if requested
    let stats;
    if (includeStats) {
      const storageStats = await storage.getStats();
      stats = {
        totalDocuments: storageStats.totalDocuments,
        byCategory: storageStats.byCategory,
      };
    }
    
    return NextResponse.json({
      success: true,
      documents,
      stats,
    });
    
  } catch (error) {
    console.error('[Documents API] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        documents: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
