import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { searchKnowledge, formatKnowledgeForContext } from '@/lib/knowledge';

/**
 * Get user info from token
 */
async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  
  try {
    const payload = await verifyIdToken(token);
    return { sub: payload.sub as string };
  } catch {
    return null;
  }
}

/**
 * POST /api/knowledge/search
 * Search the knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { query, category, limit = 10, minScore = 0.5, forContext = false } = body;
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required and must be a string' }, 
        { status: 400 }
      );
    }
    
    const results = await searchKnowledge(query, {
      category,
      limit,
      minScore,
    });
    
    // If requested for AI context, return formatted string
    if (forContext) {
      const items = results.map(r => r.item);
      const formatted = formatKnowledgeForContext(items);
      return NextResponse.json({
        count: results.length,
        context: formatted,
        items: results,
      });
    }
    
    return NextResponse.json({
      count: results.length,
      results,
    });
    
  } catch (error) {
    console.error('Knowledge search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

/**
 * GET /api/knowledge/search
 * Search via query params (simpler interface)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!query) {
      return NextResponse.json(
        { error: 'q (query) parameter is required' }, 
        { status: 400 }
      );
    }
    
    const results = await searchKnowledge(query, {
      category,
      limit,
      minScore: 0.5,
    });
    
    return NextResponse.json({
      query,
      count: results.length,
      results,
    });
    
  } catch (error) {
    console.error('Knowledge search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
