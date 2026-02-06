import { NextRequest, NextResponse } from 'next/server';
import { getDocumentGenerator } from '@/lib/integrations/document-generator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'templates';

    const generator = getDocumentGenerator();

    if (action === 'templates') {
      const category = searchParams.get('category') || undefined;
      const templates = generator.getTemplates(category);
      
      return NextResponse.json({ 
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          fields: t.fields,
        }))
      });
    }

    if (action === 'template') {
      const templateId = searchParams.get('templateId');
      if (!templateId) {
        return NextResponse.json({ error: 'templateId required' }, { status: 400 });
      }

      const template = generator.getTemplate(templateId);
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      return NextResponse.json({ template });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Documents API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, templateId, data, prompt, context } = body;

    const generator = getDocumentGenerator();

    if (action === 'generate') {
      if (!templateId || !data) {
        return NextResponse.json({ error: 'templateId and data required' }, { status: 400 });
      }

      const document = generator.generateDocument(
        templateId,
        data,
        'user' // In production, get from session
      );

      return NextResponse.json({ document });
    }

    if (action === 'generate-custom') {
      if (!prompt) {
        return NextResponse.json({ error: 'prompt required' }, { status: 400 });
      }

      const content = await generator.generateCustomDocument(prompt, context);

      return NextResponse.json({ 
        document: {
          id: `custom-${Date.now()}`,
          title: 'Anpassat dokument',
          content,
          format: 'markdown',
          createdAt: new Date().toISOString(),
        }
      });
    }

    if (action === 'to-html') {
      if (!body.markdown) {
        return NextResponse.json({ error: 'markdown required' }, { status: 400 });
      }

      const html = generator.markdownToHtml(body.markdown);

      return NextResponse.json({ html });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[Documents API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
