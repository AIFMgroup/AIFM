import { NextRequest, NextResponse } from 'next/server';
import { 
  fortnoxClient, 
  bookingEntryToFortnoxVoucher,
  BAS_ACCOUNT_MAPPING,
  suggestAccount,
  calculateVAT
} from '@/lib/fortnox';

/**
 * Fortnox Integration API
 * 
 * Handles all Fortnox-related operations including:
 * - Creating vouchers (verifikationer)
 * - Syncing transactions
 * - Managing suppliers and customers
 * 
 * All endpoints are currently in DEMO mode and return mock data.
 */

// GET /api/fortnox - Get Fortnox status and account information
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            connected: true,
            companyName: 'AIFM Demo AB',
            lastSync: new Date().toISOString(),
            accountsCount: Object.keys(BAS_ACCOUNT_MAPPING).length,
            mode: 'DEMO',
          },
        });

      case 'accounts':
        return NextResponse.json({
          success: true,
          data: {
            accounts: Object.entries(BAS_ACCOUNT_MAPPING).map(([, value]) => ({
              number: value.number,
              name: value.name,
              type: value.type,
            })),
          },
        });

      case 'suggest-account':
        const description = searchParams.get('description') || '';
        const type = (searchParams.get('type') || 'EXPENSE') as 'INCOME' | 'EXPENSE';
        const suggestedAccount = suggestAccount(description, type);
        const accountInfo = BAS_ACCOUNT_MAPPING[suggestedAccount.toString() as keyof typeof BAS_ACCOUNT_MAPPING];
        
        return NextResponse.json({
          success: true,
          data: {
            account: suggestedAccount,
            name: accountInfo?.name || 'Unknown account',
            confidence: 0.85, // Mock confidence score
          },
        });

      default:
        return NextResponse.json({
          success: true,
          data: {
            message: 'Fortnox API ready',
            mode: 'DEMO',
            endpoints: [
              'GET ?action=status',
              'GET ?action=accounts',
              'GET ?action=suggest-account&description=...&type=EXPENSE',
              'POST (create voucher, invoice, or sync transactions)',
            ],
          },
        });
    }
  } catch (error) {
    console.error('[Fortnox API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/fortnox - Create vouchers, invoices, or sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'create-voucher': {
        // Create a voucher (verifikation) in Fortnox
        const { date, description, entries, voucherSeries = 'A' } = data;
        
        const voucher = bookingEntryToFortnoxVoucher(
          {
            date: new Date(date),
            description,
            entries,
          },
          voucherSeries
        );

        const result = await fortnoxClient.createVoucher(voucher);
        
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            voucherNumber: result.data?.VoucherNumber,
            message: 'Voucher created successfully',
            mode: 'DEMO',
          },
        });
      }

      case 'create-supplier-invoice': {
        // Register a supplier invoice
        const { supplierName, invoiceNumber, invoiceDate, dueDate, total, vat, rows } = data;

        // Get or create supplier
        const supplierResult = await fortnoxClient.getOrCreateSupplier({
          Name: supplierName,
        });

        if (!supplierResult.success) {
          return NextResponse.json(
            { success: false, error: 'Failed to get/create supplier' },
            { status: 400 }
          );
        }

        // Create supplier invoice
        const invoiceResult = await fortnoxClient.createSupplierInvoice({
          SupplierNumber: supplierResult.data!.SupplierNumber,
          InvoiceNumber: invoiceNumber,
          InvoiceDate: invoiceDate,
          DueDate: dueDate,
          Total: total,
          VAT: vat,
          Currency: 'SEK',
          SupplierInvoiceRows: rows.map((row: { account: number; amount: number }) => ({
            Account: row.account,
            Debit: row.amount,
          })),
        });

        return NextResponse.json({
          success: true,
          data: {
            givenNumber: invoiceResult.data?.GivenNumber,
            supplierNumber: supplierResult.data?.SupplierNumber,
            message: 'Supplier invoice registered',
            mode: 'DEMO',
          },
        });
      }

      case 'calculate-vat': {
        // Calculate VAT from gross amount
        const { grossAmount, vatRate } = data;
        const vatResult = calculateVAT(grossAmount, vatRate);

        return NextResponse.json({
          success: true,
          data: {
            grossAmount,
            netAmount: vatResult.net,
            vatAmount: vatResult.vat,
            vatRate,
          },
        });
      }

      case 'sync-bank': {
        // Sync bank transactions
        const { accountNumber, fromDate, toDate } = data;
        
        const result = await fortnoxClient.syncBankTransactions(
          accountNumber,
          fromDate,
          toDate
        );

        return NextResponse.json({
          success: true,
          data: {
            transactionCount: result.data?.transactionCount,
            message: 'Bank transactions synced',
            mode: 'DEMO',
          },
        });
      }

      case 'create-customer-invoice': {
        // Create a customer invoice
        const { customerName, invoiceDate, dueDate, rows, reference } = data;

        // Get or create customer
        const customerResult = await fortnoxClient.getOrCreateCustomer({
          Name: customerName,
        });

        if (!customerResult.success) {
          return NextResponse.json(
            { success: false, error: 'Failed to get/create customer' },
            { status: 400 }
          );
        }

        // Create invoice
        const invoiceResult = await fortnoxClient.createInvoice({
          CustomerNumber: customerResult.data!.CustomerNumber,
          InvoiceDate: invoiceDate,
          DueDate: dueDate,
          YourReference: reference,
          InvoiceRows: rows.map((row: { description: string; account: number; quantity: number; price: number }) => ({
            Description: row.description,
            AccountNumber: row.account,
            DeliveredQuantity: row.quantity,
            Price: row.price,
          })),
        });

        return NextResponse.json({
          success: true,
          data: {
            invoiceNumber: invoiceResult.data?.InvoiceNumber,
            customerNumber: customerResult.data?.CustomerNumber,
            message: 'Customer invoice created',
            mode: 'DEMO',
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Fortnox API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

