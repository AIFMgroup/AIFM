import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import {
  createKnowledge,
  getKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getKnowledgeByCategory,
  getKnowledgeByUser,
  getAllKnowledge,
  countKnowledgeByCategory,
} from '@/lib/knowledge';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge/categories';

/**
 * Get user info from token
 */
async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;
  
  try {
    const payload = await verifyIdToken(token);
    return {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      name: (payload.name as string | undefined) || (payload.email as string | undefined),
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/knowledge
 * List knowledge items with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const userId = searchParams.get('userId');
    const knowledgeId = searchParams.get('knowledgeId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeStats = searchParams.get('stats') === 'true';
    
    // Get specific item
    if (category && knowledgeId) {
      const item = await getKnowledge(category, knowledgeId);
      if (!item) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(item);
    }
    
    // Get by category
    if (category) {
      const items = await getKnowledgeByCategory(category, limit);
      return NextResponse.json({ 
        items, 
        count: items.length,
        category,
      });
    }
    
    // Get by user (own items)
    if (userId === 'me' || userId === user.sub) {
      const items = await getKnowledgeByUser(user.sub, limit);
      return NextResponse.json({ 
        items, 
        count: items.length,
        userId: user.sub,
      });
    }
    
    // Get all with optional stats
    const items = await getAllKnowledge(limit);
    
    if (includeStats) {
      const counts = await countKnowledgeByCategory();
      return NextResponse.json({ 
        items, 
        count: items.length,
        stats: {
          totalItems: Object.values(counts).reduce((a, b) => a + b, 0),
          byCategory: counts,
        },
        categories: KNOWLEDGE_CATEGORIES,
      });
    }
    
    return NextResponse.json({ 
      items, 
      count: items.length,
    });
    
  } catch (error) {
    console.error('Knowledge GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
  }
}

/**
 * POST /api/knowledge
 * Create a new knowledge item
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { category, title, content, tags, sourceSessionId, sourceMessageId } = body;
    
    // Validate required fields
    if (!category || !title || !content) {
      return NextResponse.json(
        { error: 'category, title, and content are required' }, 
        { status: 400 }
      );
    }
    
    // Validate category exists
    const validCategory = KNOWLEDGE_CATEGORIES.find(c => c.id === category);
    if (!validCategory) {
      return NextResponse.json(
        { error: 'Invalid category', validCategories: KNOWLEDGE_CATEGORIES.map(c => c.id) }, 
        { status: 400 }
      );
    }
    
    const item = await createKnowledge({
      category,
      title,
      content,
      tags: tags || [],
      sharedByUserId: user.sub,
      sharedByEmail: user.email,
      sharedByName: user.name,
      sourceSessionId,
      sourceMessageId,
    });
    
    return NextResponse.json(item, { status: 201 });
    
  } catch (error) {
    console.error('Knowledge POST error:', error);
    return NextResponse.json({ error: 'Failed to create knowledge' }, { status: 500 });
  }
}

/**
 * PUT /api/knowledge
 * Update a knowledge item (only owner can update)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { category, knowledgeId, title, content, tags } = body;
    
    if (!category || !knowledgeId) {
      return NextResponse.json(
        { error: 'category and knowledgeId are required' }, 
        { status: 400 }
      );
    }
    
    // Check ownership
    const existing = await getKnowledge(category, knowledgeId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    if (existing.sharedByUserId !== user.sub) {
      return NextResponse.json(
        { error: 'You can only update your own knowledge items' }, 
        { status: 403 }
      );
    }
    
    const updated = await updateKnowledge(category, knowledgeId, {
      title,
      content,
      tags,
    });
    
    return NextResponse.json(updated);
    
  } catch (error) {
    console.error('Knowledge PUT error:', error);
    return NextResponse.json({ error: 'Failed to update knowledge' }, { status: 500 });
  }
}

/**
 * DELETE /api/knowledge
 * Delete a knowledge item (only owner can delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const knowledgeId = searchParams.get('knowledgeId');
    
    if (!category || !knowledgeId) {
      return NextResponse.json(
        { error: 'category and knowledgeId are required' }, 
        { status: 400 }
      );
    }
    
    // Check ownership
    const existing = await getKnowledge(category, knowledgeId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    if (existing.sharedByUserId !== user.sub) {
      return NextResponse.json(
        { error: 'You can only delete your own knowledge items' }, 
        { status: 403 }
      );
    }
    
    await deleteKnowledge(category, knowledgeId);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Knowledge DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete knowledge' }, { status: 500 });
  }
}
