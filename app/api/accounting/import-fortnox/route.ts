import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FortnoxClient } from '@/lib/fortnox/client';
import { jobStore, AccountingJob, Classification, LineItem } from '@/lib/accounting/jobStore';
import { auditLog } from '@/lib/accounting/auditLogger';

interface FortnoxSupplierInvoice {
  GivenNumber: string;
  DocumentNumber: string;
  SupplierNumber: string;
  SupplierName: string;
  InvoiceNumber: string;
  InvoiceDate: string;
  DueDate: string;
  Total: number;
  VAT: number;
  Currency: string;
  Booked: boolean;
  Cancelled: boolean;
  Credit: boolean;
  Balance: number;
}

/**
 * Import supplier invoices from Fortnox
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const includeBooked = searchParams.get('includeBooked') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId parameter' }, { status: 400 });
    }

    // Initialize Fortnox client
    const fortnoxClient = new FortnoxClient(companyId);
    const isConnected = await fortnoxClient.init();

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Fortnox är inte kopplat. Anslut först via Inställningar.' },
        { status: 400 }
      );
    }

    // Build filter
    const filterOptions: { fromDate?: string; toDate?: string; filter?: 'unbooked' } = {};
    if (fromDate) filterOptions.fromDate = fromDate;
    if (toDate) filterOptions.toDate = toDate;
    if (!includeBooked) filterOptions.filter = 'unbooked';

    // Fetch supplier invoices from Fortnox
    const result = await fortnoxClient.getSupplierInvoices(filterOptions);
    
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: 'Kunde inte hämta fakturor från Fortnox', details: result.error },
        { status: 500 }
      );
    }
    
    const invoices = result.data.SupplierInvoices as FortnoxSupplierInvoice[];

    // Get existing job invoice numbers to avoid duplicates
    const existingJobs = await jobStore.getByCompany(companyId);
    const existingInvoiceNumbers = new Set(
      existingJobs
        .map(j => j.classification?.invoiceNumber)
        .filter(Boolean)
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      try {
        // Skip if already imported
        if (existingInvoiceNumbers.has(invoice.InvoiceNumber)) {
          skipped++;
          continue;
        }

        // Skip cancelled invoices
        if (invoice.Cancelled) {
          skipped++;
          continue;
        }

        // Create job with classification from Fortnox data
        const jobId = jobStore.generateId();
        const now = new Date().toISOString();

        const lineItems: LineItem[] = [{
          id: `li-${Date.now()}-0`,
          description: `${invoice.SupplierName} - Faktura ${invoice.InvoiceNumber}`,
          netAmount: invoice.Total - invoice.VAT,
          vatAmount: invoice.VAT,
          suggestedAccount: '4010', // Default purchase account
          suggestedCostCenter: null,
          confidence: 0.95, // High confidence since it's from Fortnox
        }];

        const classification: Classification = {
          docType: invoice.Credit ? 'INVOICE' : 'INVOICE',
          supplier: invoice.SupplierName,
          invoiceNumber: invoice.InvoiceNumber,
          invoiceDate: invoice.InvoiceDate,
          dueDate: invoice.DueDate,
          currency: invoice.Currency || 'SEK',
          totalAmount: invoice.Total,
          vatAmount: invoice.VAT,
          lineItems,
          overallConfidence: 0.95,
        };

        const job: AccountingJob = {
          id: jobId,
          companyId,
          fileName: `Fortnox_${invoice.SupplierName}_${invoice.InvoiceNumber}.pdf`,
          fileType: 'pdf',
          fileSize: 0,
          status: invoice.Booked ? 'sent' : 'ready',
          createdAt: now,
          updatedAt: now,
          classification,
          fortnoxVoucherId: invoice.Booked ? invoice.GivenNumber : undefined,
        };

        await jobStore.set(job);
        imported++;

      } catch (error) {
        console.error(`Failed to import invoice ${invoice.InvoiceNumber}:`, error);
        errors.push(`${invoice.InvoiceNumber}: ${error instanceof Error ? error.message : 'Okänt fel'}`);
      }
    }

    // Log audit event
    await auditLog.documentUploaded(
      companyId,
      'fortnox-import',
      `Fortnox-import: ${imported} fakturor`,
      {
        details: { imported, skipped, errors: errors.length, fromDate, toDate },
      }
    );

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
    });

  } catch (error) {
    console.error('Fortnox import error:', error);
    return NextResponse.json(
      { error: 'Import misslyckades', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

