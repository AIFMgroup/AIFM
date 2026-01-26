/**
 * VAT Declaration API
 * 
 * Hanterar momsdeklarationer för Skatteverket.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { vatDeclarationService } from '@/lib/accounting/services/vatDeclarationService';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const action = searchParams.get('action') || 'list';

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    switch (action) {
      case 'list': {
        const declarations = await vatDeclarationService.getDeclarations(companyId);
        return NextResponse.json({ declarations });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[VAT Declaration API] Error:', error);
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
    const { action, companyId, year, month, quarter, format } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    switch (action) {
      case 'generate': {
        if (!year) {
          return NextResponse.json({ error: 'Missing year' }, { status: 400 });
        }

        const declaration = await vatDeclarationService.generateDeclaration(
          companyId,
          year,
          month,
          quarter
        );

        return NextResponse.json({ 
          success: true,
          declaration,
        });
      }

      case 'export-xml': {
        if (!year) {
          return NextResponse.json({ error: 'Missing year' }, { status: 400 });
        }

        const declaration = await vatDeclarationService.generateDeclaration(
          companyId,
          year,
          month,
          quarter
        );

        const xml = vatDeclarationService.generateSKVXML(declaration);
        
        const periodLabel = declaration.period.label.replace(/\s/g, '_');
        
        return new NextResponse(xml, {
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Disposition': `attachment; filename="momsdeklaration_${periodLabel}.xml"`,
          },
        });
      }

      case 'export-pdf-data': {
        if (!year) {
          return NextResponse.json({ error: 'Missing year' }, { status: 400 });
        }

        const declaration = await vatDeclarationService.generateDeclaration(
          companyId,
          year,
          month,
          quarter
        );

        const pdfData = vatDeclarationService.generatePDFData(declaration);
        
        return NextResponse.json({ 
          success: true,
          pdfData,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('[VAT Declaration API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}







