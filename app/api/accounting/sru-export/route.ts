/**
 * SRU Export API
 * 
 * Hanterar generering och export av SRU-filer för inkomstdeklaration.
 * Stödjer INK2 (aktiebolag) och INK4 (enskild firma).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sruExportService } from '@/lib/accounting/services/sruExportService';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const documentId = searchParams.get('documentId');
    const action = searchParams.get('action') || 'list';

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    switch (action) {
      case 'list': {
        const documents = await sruExportService.listDocuments(companyId);
        return NextResponse.json({ documents });
      }

      case 'get': {
        if (!documentId) {
          return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
        }
        const document = await sruExportService.getDocument(documentId);
        if (!document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }
        return NextResponse.json({ document: sruExportService.exportToJSON(document) });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[SRU Export API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      action, 
      companyId, 
      fiscalYear, 
      type, 
      organisationNumber, 
      companyName,
      format,
      documentId,
    } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    switch (action) {
      case 'generate': {
        if (!fiscalYear || !type || !organisationNumber || !companyName) {
          return NextResponse.json({ 
            error: 'Missing required fields: fiscalYear, type, organisationNumber, companyName' 
          }, { status: 400 });
        }

        let document;
        if (type === 'INK2') {
          document = await sruExportService.generateINK2(
            companyId,
            fiscalYear,
            organisationNumber,
            companyName
          );
        } else if (type === 'INK4') {
          document = await sruExportService.generateINK4(
            companyId,
            fiscalYear,
            organisationNumber,
            companyName
          );
        } else {
          return NextResponse.json({ error: 'Invalid type. Use INK2 or INK4' }, { status: 400 });
        }

        return NextResponse.json({ 
          success: true,
          document: sruExportService.exportToJSON(document),
        });
      }

      case 'export-sru': {
        if (!documentId) {
          return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
        }

        const document = await sruExportService.getDocument(documentId);
        if (!document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const sruContent = sruExportService.exportToSRU(document);
        
        return new NextResponse(sruContent, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${document.type}_${document.fiscalYear.year}.sru"`,
          },
        });
      }

      case 'export-xml': {
        if (!documentId) {
          return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
        }

        const document = await sruExportService.getDocument(documentId);
        if (!document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const xml = sruExportService.exportToSKVXML(document);
        
        return new NextResponse(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="${document.type}_${document.fiscalYear.year}.xml"`,
          },
        });
      }

      case 'export-json': {
        if (!documentId) {
          return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });
        }

        const document = await sruExportService.getDocument(documentId);
        if (!document) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        const jsonData = sruExportService.exportToJSON(document);
        
        return new NextResponse(JSON.stringify(jsonData, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${document.type}_${document.fiscalYear.year}.json"`,
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[SRU Export API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







