import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';
import { sendToFortnox, isFortnoxConnected } from '@/lib/fortnox/voucherService';
import { auditLog, createAuditContext } from '@/lib/accounting/auditLogger';
import { evaluateAccountingPolicyForCompany } from '@/lib/accounting/services/accountingPolicyEngine';
import { assertCan, getRoleFromRequest } from '@/lib/accounting/authz';
import { assertPeriodWritable } from '@/lib/accounting/services/periodClosingService';

interface ApproveRequest {
  jobId: string;
  action: 'approve' | 'sendToFortnox';
  adjustments?: {
    lineItems?: {
      id: string;
      suggestedAccount?: string;
      suggestedCostCenter?: string | null;
    }[];
  };
}

interface ApproveResponse {
  success: boolean;
  jobId: string;
  status: string;
  fortnoxVoucherId?: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ApproveRequest = await request.json();
    const role = getRoleFromRequest(request);

    // Validate request
    if (!body.jobId || !body.action) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, action' },
        { status: 400 }
      );
    }

    const job = await jobStore.get(body.jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check job is in a state that can be approved
    if (!['ready', 'approved'].includes(job.status)) {
      return NextResponse.json(
        { error: `Cannot ${body.action} job in status: ${job.status}` },
        { status: 400 }
      );
    }

    // Period guardrail: block approvals/posting in CLOSED/LOCKED periods
    const docDate = job.classification?.invoiceDate || job.createdAt.split('T')[0];
    try {
      await assertPeriodWritable(job.companyId, docDate);
    } catch (e) {
      return NextResponse.json(
        { error: 'Perioden är stängd/låst', details: String(e) },
        { status: 400 }
      );
    }

    // Apply adjustments if provided
    if (job.classification) {
      // Defensive normalization: older jobs / edge cases may have malformed classification payloads
      if (!Array.isArray((job.classification as any).lineItems)) {
        (job.classification as any).lineItems = [];
      }
    }

    if (body.adjustments?.lineItems && job.classification) {
      const before = JSON.parse(JSON.stringify(job.classification));
      for (const update of body.adjustments.lineItems) {
        const lineItem = job.classification.lineItems.find(li => li.id === update.id);
        if (lineItem) {
          if (update.suggestedAccount) lineItem.suggestedAccount = update.suggestedAccount;
          if (update.suggestedCostCenter !== undefined) lineItem.suggestedCostCenter = update.suggestedCostCenter;
          lineItem.suggestionSource = 'manual';
          lineItem.suggestionReasoning = 'Manuell justering i UI';
        }
      }
      // Save updated classification
      await jobStore.update(body.jobId, { classification: job.classification });

      // Audit correction diff (compact)
      try {
        await auditLog.classificationCorrected(job.companyId, job.id, {
          changes: body.adjustments.lineItems,
          beforeTop: before?.lineItems?.[0]?.suggestedAccount,
          afterTop: job.classification?.lineItems?.[0]?.suggestedAccount,
        }, createAuditContext(request));
      } catch (e) {
        console.warn('[Approve] Audit classificationCorrected failed:', e);
      }
    }

    const now = new Date().toISOString();
    let response: ApproveResponse;

    // Always enforce per-company policy before approve/send
    if (job.classification) {
      let evaluationResult: Awaited<ReturnType<typeof evaluateAccountingPolicyForCompany>> | null = null;
      try {
        evaluationResult = await evaluateAccountingPolicyForCompany(job.companyId, job.classification);
      } catch (e) {
        console.error('[Approve] Policy evaluation failed:', e);
        return NextResponse.json(
          { error: 'Kunde inte utvärdera bokföringspolicy', details: e instanceof Error ? e.message : String(e) },
          { status: 500 }
        );
      }
      const { evaluation } = evaluationResult;
      const blocked = evaluation.reject || evaluation.violations.some(v => v.severity === 'error');
      if (blocked) {
        try {
          await auditLog.jobPolicyBlocked(job.companyId, job.id, evaluation.summary, createAuditContext(request));
        } catch {}
        return NextResponse.json(
          {
            error: 'Utanför bokföringspolicy',
            details: evaluation.summary,
            violations: evaluation.violations,
          },
          { status: 400 }
        );
      }
      // Persist policy-applied classification (includes policy metadata)
      job.classification = evaluation.classification;
      await jobStore.update(body.jobId, { classification: job.classification });
    }

    if (body.action === 'approve') {
      assertCan(role, 'APPROVE_JOB');
      // Just approve, don't send to Fortnox yet
      await jobStore.update(body.jobId, {
        status: 'approved',
        approvedAt: now,
        updatedAt: now,
      });

      response = {
        success: true,
        jobId: body.jobId,
        status: 'approved',
        message: 'Document approved successfully',
      };

    } else if (body.action === 'sendToFortnox') {
      assertCan(role, 'SEND_TO_FORTNOX');
      // Send to Fortnox
      try {
        const updatedJob = await jobStore.get(body.jobId);
        if (!updatedJob) throw new Error('Job not found');
        
        // Check if Fortnox is connected
        const connected = await isFortnoxConnected(updatedJob.companyId);
        if (!connected) {
          return NextResponse.json(
            { 
              error: 'Fortnox ej kopplat', 
              details: 'Gå till Bokföring → Fortnox-koppling för att ansluta till Fortnox' 
            },
            { status: 400 }
          );
        }
        
        const result = await sendToFortnox(updatedJob.companyId, updatedJob);
        
        if (!result.success) {
          return NextResponse.json(
            { error: 'Fortnox-fel', details: result.error },
            { status: 502 }
          );
        }
        
        const voucherId = result.voucherId || result.invoiceId || 'UNKNOWN';
        
        await jobStore.update(body.jobId, {
          status: 'sent',
          fortnoxVoucherId: voucherId,
          sentAt: now,
          approvedAt: job.approvedAt || now,
          updatedAt: now,
        });

        response = {
          success: true,
          jobId: body.jobId,
          status: 'sent',
          fortnoxVoucherId: voucherId,
          message: `Skickat till Fortnox! ${result.invoiceId ? 'Faktura' : 'Verifikation'}: ${voucherId}`,
        };

      } catch (fortnoxError) {
        console.error('Fortnox error:', fortnoxError);
        return NextResponse.json(
          { error: 'Kunde inte skicka till Fortnox', details: String(fortnoxError) },
          { status: 502 }
        );
      }

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "sendToFortnox"' },
        { status: 400 }
      );
    }

    // Log audit event
    const auditContext = createAuditContext(request);
    if (body.action === 'approve') {
      await auditLog.jobApproved(job.companyId, body.jobId, {
        ...auditContext,
        details: { fileName: job.fileName },
      });
    } else if (body.action === 'sendToFortnox' && response.fortnoxVoucherId) {
      await auditLog.jobSentToFortnox(job.companyId, body.jobId, response.fortnoxVoucherId, {
        ...auditContext,
        details: { fileName: job.fileName },
      });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Approve error:', error);
    
    // Log error to audit
    const body = await request.clone().json().catch(() => ({}));
    if (body.jobId) {
      const job = await jobStore.get(body.jobId).catch(() => null);
      if (job) {
        await auditLog.error(
          job.companyId, 
          body.action === 'sendToFortnox' ? 'JOB_SENT_TO_FORTNOX' : 'JOB_APPROVED',
          'job',
          error instanceof Error ? error.message : 'Unknown error',
          { resourceId: body.jobId }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        // Helpful in production debugging without exposing sensitive payloads
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
