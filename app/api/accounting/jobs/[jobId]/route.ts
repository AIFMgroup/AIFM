import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jobStore } from '@/lib/accounting/jobStore';
import { deleteJobAndDocument } from '@/lib/accounting/processingPipeline';
import { auditLog, createAuditContext } from '@/lib/accounting/auditLogger';
import { assertCan, getRoleFromRequest } from '@/lib/accounting/authz';
import { assertPeriodWritable } from '@/lib/accounting/services/periodClosingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params;
    const job = await jobStore.get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(job);

  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update job (e.g., update line item account)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params;
    const job = await jobStore.get(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const updates = await request.json();
    const role = getRoleFromRequest(request);
    assertCan(role, 'EDIT_CLASSIFICATION');

    // Period guardrail: block edits in CLOSED/LOCKED periods
    const docDate = job.classification?.invoiceDate || job.createdAt.split('T')[0];
    try {
      await assertPeriodWritable(job.companyId, docDate);
    } catch (e) {
      return NextResponse.json(
        { error: 'Perioden är stängd/låst', details: String(e) },
        { status: 400 }
      );
    }

    // Update line items if provided
    if (updates.lineItems && job.classification) {
      const before = JSON.parse(JSON.stringify(job.classification));
      for (const update of updates.lineItems) {
        const lineItem = job.classification.lineItems.find(li => li.id === update.id);
        if (lineItem) {
          if (update.suggestedAccount) {
            lineItem.suggestedAccount = update.suggestedAccount;
            lineItem.suggestionSource = 'manual';
            lineItem.suggestionReasoning = 'Manuell justering';
          }
          if (update.suggestedCostCenter !== undefined) {
            lineItem.suggestedCostCenter = update.suggestedCostCenter;
          }
          if (update.vatAmount !== undefined) {
            lineItem.vatAmount = Number(update.vatAmount) || 0;
          }
          if (update.netAmount !== undefined) {
            lineItem.netAmount = Number(update.netAmount) || 0;
          }
        }
      }
      
      // Classification-level updates (supplier, dates, invoice number, VAT total)
      if (updates.classification) {
        const c = updates.classification;
        if (typeof c.supplier === 'string') job.classification.supplier = c.supplier;
        if (typeof c.invoiceNumber === 'string') job.classification.invoiceNumber = c.invoiceNumber;
        if (typeof c.invoiceDate === 'string') job.classification.invoiceDate = c.invoiceDate;
        if (typeof c.dueDate === 'string') job.classification.dueDate = c.dueDate;
        if (typeof c.vatAmount === 'number') job.classification.vatAmount = c.vatAmount;
      }

      // Recompute totals deterministically from line items
      job.classification.vatAmount = job.classification.lineItems.reduce((sum, li) => sum + (li.vatAmount || 0), 0);
      job.classification.totalAmount = job.classification.lineItems.reduce((sum, li) => sum + (li.netAmount || 0) + (li.vatAmount || 0), 0);

      const now = new Date().toISOString();

      await jobStore.update(jobId, {
        classification: job.classification,
        updatedAt: now,
      });

      // Audit correction
      try {
        await auditLog.classificationCorrected(job.companyId, jobId, {
          changes: updates,
          beforeTop: before?.lineItems?.[0]?.suggestedAccount,
          afterTop: job.classification?.lineItems?.[0]?.suggestedAccount,
        }, createAuditContext(request));
      } catch (e) {
        console.warn('[Job PATCH] audit failed:', e);
      }
    }

    const updatedJob = await jobStore.get(jobId);
    return NextResponse.json({ success: true, job: updatedJob });

  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
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

    const { jobId } = await params;
    const role = getRoleFromRequest(request);
    assertCan(role, 'EDIT_CLASSIFICATION');

    const job = await jobStore.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    const docDate = job.classification?.invoiceDate || job.createdAt.split('T')[0];
    try {
      await assertPeriodWritable(job.companyId, docDate);
    } catch (e) {
      return NextResponse.json(
        { error: 'Perioden är stängd/låst', details: String(e) },
        { status: 400 }
      );
    }

    const deleted = await deleteJobAndDocument(jobId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
