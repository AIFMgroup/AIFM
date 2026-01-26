/**
 * API Route: List Accounting Jobs
 * GET /api/accounting/jobs?companyId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobStore, AccountingJob } from '@/lib/accounting/jobStore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }
    
    const jobs = await jobStore.getByCompany(companyId);
    
    // Transform jobs to transaction format for the UI
    const transactions = jobs
      .filter(job => job.classification) // Only return classified jobs
      .map(job => mapJobToTransaction(job));
    
    return NextResponse.json({
      success: true,
      jobs,
      transactions,
      summary: {
        total: jobs.length,
        queued: jobs.filter(j => j.status === 'queued').length,
        processing: jobs.filter(j => ['uploading', 'scanning', 'ocr', 'analyzing'].includes(j.status)).length,
        ready: jobs.filter(j => j.status === 'ready').length,
        approved: jobs.filter(j => j.status === 'approved').length,
        sent: jobs.filter(j => j.status === 'sent').length,
        error: jobs.filter(j => j.status === 'error').length,
      }
    });
  } catch (error) {
    console.error('[API] Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

function mapJobToTransaction(job: AccountingJob) {
  const classification = job.classification;
  if (!classification) return null;
  
  // Determine status for UI
  let uiStatus: 'approved' | 'pending' | 'needs_review' = 'pending';
  if (job.status === 'approved' || job.status === 'sent') {
    uiStatus = 'approved';
  } else if (job.status === 'ready') {
    uiStatus = classification.overallConfidence >= 0.7 ? 'pending' : 'needs_review';
  } else if (job.status === 'error') {
    uiStatus = 'needs_review';
  }
  
  // Get primary account from line items
  const primaryLineItem = classification.lineItems[0];
  const account = primaryLineItem?.suggestedAccount || '6990';
  
  // Determine category from account
  const category = getCategoryFromAccount(account);
  
  return {
    id: job.id,
    date: classification.invoiceDate,
    description: `${classification.supplier} - ${classification.invoiceNumber || 'Dokument'}`,
    amount: classification.totalAmount,
    type: classification.docType === 'INVOICE' || classification.docType === 'RECEIPT' ? 'expense' : 'income',
    account: `${account} - ${getAccountName(account)}`,
    category,
    status: uiStatus,
    source: classification.docType,
    aiConfidence: Math.round(classification.overallConfidence * 100),
    document: job.fileName,
    s3Key: job.s3Key,
    vatAmount: classification.vatAmount,
    lineItems: classification.lineItems,
  };
}

function getAccountName(account: string): string {
  const accountNames: Record<string, string> = {
    '4010': 'Inköp varor',
    '5010': 'Lokalhyra',
    '5410': 'Förbrukningsinventarier',
    '5810': 'Biljetter',
    '6110': 'Kontorsmaterial',
    '6212': 'Telefon och internet',
    '6540': 'IT-tjänster',
    '6550': 'Konsultarvoden',
    '6990': 'Övriga kostnader',
    '7412': 'Pensionsförsäkring',
    '3010': 'Försäljning tjänster',
  };
  return accountNames[account] || 'Övrigt';
}

function getCategoryFromAccount(account: string): string {
  const firstTwo = account.substring(0, 2);
  const categories: Record<string, string> = {
    '30': 'Försäljning',
    '40': 'Inköp varor',
    '50': 'Lokalkostnad',
    '54': 'Förbrukning',
    '58': 'Resekostnad',
    '61': 'Kontorskostnad',
    '62': 'Telefonkostnad',
    '65': 'Konsulttjänster',
    '69': 'Övrigt',
    '74': 'Lönekostnad',
  };
  return categories[firstTwo] || 'Övrigt';
}


