import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge/categories';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

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
 * POST /api/knowledge/auto-categorize
 * Use AI to suggest category, title, and tags for knowledge content
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { content } = body;
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    
    // Truncate content for categorization (first 2000 chars is enough)
    const truncatedContent = content.slice(0, 2000);
    
    const categoryList = KNOWLEDGE_CATEGORIES.map(c => 
      `- ${c.id}: ${c.name} - ${c.description}`
    ).join('\n');
    
    const prompt = `Du är en AI som kategoriserar företagsinformation. Analysera följande text och ge:
1. Den mest passande kategorin (välj EN från listan)
2. En kort, beskrivande titel (max 60 tecken)
3. 2-4 relevanta sökord/taggar (på svenska)

KATEGORIER:
${categoryList}

TEXT ATT KATEGORISERA:
${truncatedContent}

Svara ENDAST med JSON i detta format:
{
  "category": "kategori-id",
  "suggestedTitle": "Kort beskrivande titel",
  "suggestedTags": ["tagg1", "tagg2", "tagg3"]
}`;

    const modelId = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';
    
    const response = await bedrockClient.send(new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    }));
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const aiResponse = responseBody.content?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ 
        category: null, 
        suggestedTitle: null, 
        suggestedTags: [] 
      });
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    // Validate category
    const validCategory = KNOWLEDGE_CATEGORIES.find(c => c.id === result.category);
    
    return NextResponse.json({
      category: validCategory ? result.category : null,
      suggestedTitle: result.suggestedTitle?.slice(0, 80) || null,
      suggestedTags: Array.isArray(result.suggestedTags) 
        ? result.suggestedTags.slice(0, 5).map((t: string) => t.toLowerCase())
        : [],
    });
    
  } catch (error) {
    console.error('Auto-categorize error:', error);
    // Return empty suggestions on error - user can still manually select
    return NextResponse.json({ 
      category: null, 
      suggestedTitle: null, 
      suggestedTags: [] 
    });
  }
}
