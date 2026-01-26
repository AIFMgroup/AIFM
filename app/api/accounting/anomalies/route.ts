/**
 * Anomaly Detection API
 * 
 * Hämtar och hanterar anomalier för dokument
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectAnomalies, getRecentAnomalies } from '@/lib/accounting/services/anomalyDetector';
import { jobStore } from '@/lib/accounting/jobStore';

// GET - Hämta anomalier
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const jobId = searchParams.get('jobId');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  try {
    if (jobId) {
      // Hämta anomalier för ett specifikt jobb
      const job = await jobStore.get(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Jobb hittades inte' }, { status: 404 });
      }

      if (!job.classification) {
        return NextResponse.json(
          { error: 'Jobbet har ingen klassificering' },
          { status: 400 }
        );
      }

      const report = await detectAnomalies(companyId, {
        id: job.id,
        classification: {
          docType: job.classification.docType,
          supplier: job.classification.supplier,
          totalAmount: job.classification.totalAmount,
          vatAmount: job.classification.vatAmount,
          invoiceDate: job.classification.invoiceDate,
          dueDate: job.classification.dueDate,
          invoiceNumber: job.classification.invoiceNumber,
          overallConfidence: job.classification.overallConfidence,
          lineItems: job.classification.lineItems,
        },
        createdAt: job.createdAt,
      });

      return NextResponse.json({ report });
    }

    // Hämta senaste anomalierna
    const reports = await getRecentAnomalies(companyId, limit);
    
    // Beräkna sammanfattning
    const summary = {
      totalReports: reports.length,
      withAnomalies: reports.filter(r => r.hasAnomalies).length,
      bySeverity: {
        critical: reports.filter(r => r.highestSeverity === 'CRITICAL').length,
        high: reports.filter(r => r.highestSeverity === 'HIGH').length,
        medium: reports.filter(r => r.highestSeverity === 'MEDIUM').length,
        low: reports.filter(r => r.highestSeverity === 'LOW').length,
      },
      byRecommendation: {
        autoApprove: reports.filter(r => r.recommendation === 'AUTO_APPROVE').length,
        manualReview: reports.filter(r => r.recommendation === 'MANUAL_REVIEW').length,
        escalate: reports.filter(r => r.recommendation === 'ESCALATE').length,
        reject: reports.filter(r => r.recommendation === 'REJECT').length,
      },
      averageRiskScore: reports.length > 0 
        ? reports.reduce((sum, r) => sum + r.riskScore, 0) / reports.length 
        : 0,
    };

    return NextResponse.json({ reports, summary });

  } catch (error) {
    console.error('[Anomaly API] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta anomalier' },
      { status: 500 }
    );
  }
}















