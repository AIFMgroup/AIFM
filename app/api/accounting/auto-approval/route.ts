/**
 * Auto-Approval API
 * 
 * Hanterar automatiskt godkännande och reglerutvärdering
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  evaluateAutoApproval, 
  recordApproval, 
  getAutoApprovalRules,
  getAutoApprovalStats 
} from '@/lib/accounting/services/autoApprovalEngine';
import { detectAnomalies } from '@/lib/accounting/services/anomalyDetector';
import { 
  createApprovalRequest, 
  determineApprovalLevel,
  getApprovalConfig 
} from '@/lib/accounting/services/approvalWorkflow';
import { jobStore } from '@/lib/accounting/jobStore';

// GET - Hämta regler och statistik
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const action = searchParams.get('action');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  try {
    if (action === 'rules') {
      const rules = getAutoApprovalRules();
      return NextResponse.json({ rules });
    }

    if (action === 'stats') {
      const stats = await getAutoApprovalStats(companyId);
      return NextResponse.json({ stats });
    }

    if (action === 'config') {
      const config = await getApprovalConfig(companyId);
      return NextResponse.json({ config });
    }

    // Default: returnera allt
    const [rules, stats, config] = await Promise.all([
      getAutoApprovalRules(),
      getAutoApprovalStats(companyId),
      getApprovalConfig(companyId),
    ]);

    return NextResponse.json({ rules, stats, config });

  } catch (error) {
    console.error('[AutoApproval API] Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta data' },
      { status: 500 }
    );
  }
}

// POST - Utvärdera och processas automatiskt godkännande
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, companyId, action } = body;

    if (!jobId || !companyId) {
      return NextResponse.json(
        { error: 'jobId och companyId krävs' },
        { status: 400 }
      );
    }

    // Hämta jobbet
    const job = await jobStore.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Jobb hittades inte' }, { status: 404 });
    }

    if (!job.classification) {
      return NextResponse.json(
        { error: 'Jobbet har ingen klassificering ännu' },
        { status: 400 }
      );
    }

    // Steg 1: Utvärdera auto-godkännande
    const autoApprovalResult = await evaluateAutoApproval(companyId, {
      id: job.id,
      classification: {
        docType: job.classification.docType,
        supplier: job.classification.supplier,
        totalAmount: job.classification.totalAmount,
        overallConfidence: job.classification.overallConfidence,
        lineItems: job.classification.lineItems,
      },
      hasDuplicateWarning: false, // TODO: Hämta från duplicate detector
    });

    // Steg 2: Detektera anomalier
    const anomalyReport = await detectAnomalies(companyId, {
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

    // Steg 3: Bestäm godkännandenivå
    const config = await getApprovalConfig(companyId);
    const workflowDecision = determineApprovalLevel(job.classification.totalAmount, config);

    // Kombinera resultat för beslut
    const canAutoApprove = 
      autoApprovalResult.shouldAutoApprove && 
      anomalyReport.recommendation === 'AUTO_APPROVE' &&
      workflowDecision.canAutoApprove;

    // Steg 4: Om action = 'process', genomför godkännandet
    if (action === 'process') {
      if (canAutoApprove) {
        // Auto-godkänn
        await jobStore.update(jobId, {
          status: autoApprovalResult.action === 'AUTO_APPROVE_AND_SEND' ? 'sent' : 'approved',
          approvedBy: 'auto-approval-engine',
          approvedAt: new Date().toISOString(),
        });

        // Registrera för lärande
        await recordApproval(companyId, {
          id: job.id,
          classification: job.classification,
        }, true);

        return NextResponse.json({
          success: true,
          action: autoApprovalResult.action,
          message: 'Dokumentet auto-godkändes',
          autoApprovalResult,
          anomalyReport,
          workflowDecision,
        });
      } else {
        // Skapa godkännandebegäran
        const approvalRequest = await createApprovalRequest(
          companyId,
          {
            id: job.id,
            classification: {
              supplier: job.classification.supplier,
              totalAmount: job.classification.totalAmount,
              invoiceNumber: job.classification.invoiceNumber,
            },
          },
          'system'
        );

        return NextResponse.json({
          success: true,
          action: 'NEEDS_APPROVAL',
          message: `Manuell granskning krävs (${workflowDecision.requiredLevel})`,
          approvalRequest,
          autoApprovalResult,
          anomalyReport,
          workflowDecision,
        });
      }
    }

    // Bara utvärdering, ingen action
    return NextResponse.json({
      success: true,
      canAutoApprove,
      autoApprovalResult,
      anomalyReport,
      workflowDecision,
      summary: {
        aiConfidence: job.classification.overallConfidence,
        riskScore: anomalyReport.riskScore,
        anomalyCount: anomalyReport.anomalyCount,
        requiredApprovalLevel: workflowDecision.requiredLevel,
        recommendation: canAutoApprove ? 'AUTO_APPROVE' : anomalyReport.recommendation,
      },
    });

  } catch (error) {
    console.error('[AutoApproval API] Error:', error);
    return NextResponse.json(
      { error: 'Utvärdering misslyckades', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}















