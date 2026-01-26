import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { vatReporting, ReportingPeriod } from '@/lib/accounting/services/vatReporting';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodType = (searchParams.get('periodType') || 'monthly') as ReportingPeriod;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId parameter' }, { status: 400 });
    }

    // If no dates, default to current month
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const report = await vatReporting.generateReport(
      companyId,
      startDate || defaultStart,
      endDate || defaultEnd,
      periodType
    );

    return NextResponse.json(report);

  } catch (error) {
    console.error('VAT report error:', error);
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
    const { companyId, startDate, endDate, organisationNumber, format } = body;

    if (!companyId || !startDate || !endDate || !organisationNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, startDate, endDate, organisationNumber' },
        { status: 400 }
      );
    }

    const skvData = await vatReporting.generateSKVExport(
      companyId,
      startDate,
      endDate,
      organisationNumber
    );

    if (format === 'xml') {
      const xml = vatReporting.generateXML(skvData);
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="momsdeklaration_${skvData.period}.xml"`,
        },
      });
    }

    return NextResponse.json(skvData);

  } catch (error) {
    console.error('VAT export error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}





