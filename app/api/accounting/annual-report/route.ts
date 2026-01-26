/**
 * API Route: Annual Report
 * GET /api/accounting/annual-report?companyId=xxx&year=2024
 */

import { NextRequest, NextResponse } from 'next/server';
import { annualReportService } from '@/lib/accounting/annualReport/annualReportService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const companyName = searchParams.get('companyName') || 'Bolaget';
    const yearStr = searchParams.get('year');
    const orgNumber = searchParams.get('orgNumber') || undefined;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    const year = yearStr ? parseInt(yearStr) : new Date().getFullYear();

    const reportData = await annualReportService.generateReportData(
      companyId,
      companyName,
      year,
      orgNumber
    );

    const jobsStats = await annualReportService.getJobsStatistics(companyId, year);

    return NextResponse.json({
      success: true,
      report: reportData,
      statistics: jobsStats,
    });

  } catch (error) {
    console.error('[API] Annual Report GET error:', error);
    return NextResponse.json(
      { error: 'Failed to generate annual report data' },
      { status: 500 }
    );
  }
}


