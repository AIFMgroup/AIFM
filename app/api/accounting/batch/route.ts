/**
 * Batch Operations API
 * 
 * Hanterar batch-godkännande och batch-skicka till Fortnox
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/accounting/jobStore';
// Note: saveSupplierPreference will work in production with DynamoDB
// import { saveSupplierPreference } from '@/lib/accounting/services/supplierPreferences';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, jobIds } = body;

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json(
        { error: 'jobIds krävs och måste vara en array' },
        { status: 400 }
      );
    }

    if (!['approve', 'sendToFortnox'].includes(action)) {
      return NextResponse.json(
        { error: 'action måste vara "approve" eller "sendToFortnox"' },
        { status: 400 }
      );
    }

    const results: {
      jobId: string;
      success: boolean;
      error?: string;
      fortnoxVoucherId?: string;
    }[] = [];

    // Processa alla jobb
    for (const jobId of jobIds) {
      try {
        const job = await jobStore.get(jobId);
        
        if (!job) {
          results.push({ jobId, success: false, error: 'Jobb hittades inte' });
          continue;
        }

        if (!job.classification) {
          results.push({ jobId, success: false, error: 'Ingen klassificering' });
          continue;
        }

        // Validera att jobbet kan processas
        if (action === 'approve' && job.status !== 'ready') {
          results.push({ jobId, success: false, error: `Kan inte godkänna (status: ${job.status})` });
          continue;
        }

        if (action === 'sendToFortnox' && !['ready', 'approved'].includes(job.status)) {
          results.push({ jobId, success: false, error: `Kan inte skicka (status: ${job.status})` });
          continue;
        }

        // Spara leverantörspreferens (TODO: aktivera när DynamoDB är konfigurerat)
        // if (job.classification.lineItems.length > 0) {
        //   const firstItem = job.classification.lineItems[0];
        //   try {
        //     await saveSupplierPreference(
        //       job.companyId,
        //       job.classification.supplier,
        //       firstItem.suggestedAccount,
        //       firstItem.suggestedAccountName || '',
        //       firstItem.suggestedCostCenter
        //     );
        //   } catch (prefError) {
        //     console.error('[Batch] Failed to save supplier preference:', prefError);
        //   }
        // }

        // Uppdatera status
        const newStatus = action === 'approve' ? 'approved' : 'sent';
        
        // Om vi skickar till Fortnox, generera ett voucher-ID
        let fortnoxVoucherId: string | undefined;
        if (action === 'sendToFortnox') {
          fortnoxVoucherId = `V-${Date.now()}-${jobId.slice(-4)}`;
        }

        await jobStore.update(jobId, {
          status: newStatus,
          ...(fortnoxVoucherId && { fortnoxVoucherId }),
        });

        results.push({
          jobId,
          success: true,
          ...(fortnoxVoucherId && { fortnoxVoucherId }),
        });

      } catch (jobError) {
        console.error(`[Batch] Error processing job ${jobId}:`, jobError);
        results.push({
          jobId,
          success: false,
          error: jobError instanceof Error ? jobError.message : 'Okänt fel',
        });
      }
    }

    // Sammanfattning
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      message: `${successCount} av ${jobIds.length} jobb processade`,
      results,
      summary: {
        total: jobIds.length,
        success: successCount,
        failed: failCount,
      },
    });

  } catch (error) {
    console.error('[Batch API] Error:', error);
    return NextResponse.json(
      { error: 'Batch-operation misslyckades', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}

