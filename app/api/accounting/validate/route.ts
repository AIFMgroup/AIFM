/**
 * Validation API
 * 
 * Validerar bokföringsdata innan det skickas till Fortnox.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateVoucher, isValidAccount, suggestAccountsForDescription } from '@/lib/accounting/validation/accountValidator';
import { validateVAT, suggestVATRate, detectVATRate } from '@/lib/accounting/validation/vatValidator';
import { 
  getNextVoucherNumber, 
  getVoucherNumberForDocument,
  getLastVoucherNumber,
  validateVoucherSequence,
  parseVoucherNumber,
  type VoucherSeries,
} from '@/lib/accounting/services/voucherNumberService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, companyId, ...data } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
    }

    switch (action) {
      // ============ Account Validation ============
      case 'validateVoucher': {
        const { rows, transactionType, strictMode } = data;
        
        if (!rows || !Array.isArray(rows)) {
          return NextResponse.json({ error: 'rows krävs' }, { status: 400 });
        }
        
        const result = validateVoucher(rows, transactionType || 'JOURNAL', { strictMode });
        return NextResponse.json({ validation: result });
      }

      case 'validateAccount': {
        const { accountNumber } = data;
        
        if (!accountNumber) {
          return NextResponse.json({ error: 'accountNumber krävs' }, { status: 400 });
        }
        
        const isValid = isValidAccount(accountNumber);
        return NextResponse.json({ isValid, accountNumber });
      }

      case 'suggestAccounts': {
        const { description, transactionType } = data;
        
        if (!description) {
          return NextResponse.json({ error: 'description krävs' }, { status: 400 });
        }
        
        const suggestions = suggestAccountsForDescription(description, transactionType || 'PURCHASE_INVOICE');
        return NextResponse.json({ suggestions });
      }

      // ============ VAT Validation ============
      case 'validateVAT': {
        const { netAmount, vatAmount, grossAmount, vatRate, supplierVatNumber, isEU, isReverseCharge } = data;
        
        if (netAmount === undefined || vatAmount === undefined) {
          return NextResponse.json({ error: 'netAmount och vatAmount krävs' }, { status: 400 });
        }
        
        const result = validateVAT({
          netAmount,
          vatAmount,
          grossAmount: grossAmount ?? (netAmount + vatAmount),
          vatRate,
          supplierVatNumber,
          isEU,
          isReverseCharge,
        });
        
        return NextResponse.json({ validation: result });
      }

      case 'detectVATRate': {
        const { netAmount, vatAmount, grossAmount } = data;
        
        if (netAmount === undefined || vatAmount === undefined) {
          return NextResponse.json({ error: 'netAmount och vatAmount krävs' }, { status: 400 });
        }
        
        const detectedRate = detectVATRate(netAmount, vatAmount, grossAmount);
        return NextResponse.json({ vatRate: detectedRate });
      }

      case 'suggestVATRate': {
        const { description, supplier } = data;
        
        if (!description) {
          return NextResponse.json({ error: 'description krävs' }, { status: 400 });
        }
        
        const suggestion = suggestVATRate(description, supplier);
        return NextResponse.json({ suggestion });
      }

      // ============ Voucher Numbers ============
      case 'getNextVoucherNumber': {
        const { series, documentType, year, jobId, description } = data;
        
        if (!series && !documentType) {
          return NextResponse.json({ error: 'series eller documentType krävs' }, { status: 400 });
        }
        
        let voucherNumber;
        if (documentType) {
          voucherNumber = await getVoucherNumberForDocument(companyId, documentType, { year, jobId, description });
        } else {
          voucherNumber = await getNextVoucherNumber(companyId, series, { year, jobId, description });
        }
        
        return NextResponse.json({ voucherNumber });
      }

      case 'getLastVoucherNumber': {
        const { series, year } = data;
        
        if (!series) {
          return NextResponse.json({ error: 'series krävs' }, { status: 400 });
        }
        
        const lastNumber = await getLastVoucherNumber(companyId, series, year);
        return NextResponse.json({ lastNumber });
      }

      case 'validateVoucherSequence': {
        const { series, year } = data;
        
        if (!series || !year) {
          return NextResponse.json({ error: 'series och year krävs' }, { status: 400 });
        }
        
        const sequenceValidation = await validateVoucherSequence(companyId, series, year);
        return NextResponse.json({ validation: sequenceValidation });
      }

      case 'parseVoucherNumber': {
        const { voucherNumber } = data;
        
        if (!voucherNumber) {
          return NextResponse.json({ error: 'voucherNumber krävs' }, { status: 400 });
        }
        
        const parsed = parseVoucherNumber(voucherNumber);
        return NextResponse.json({ parsed });
      }

      // ============ Combined Validation ============
      case 'validateDocument': {
        const { 
          rows, 
          transactionType,
          netAmount, 
          vatAmount, 
          grossAmount, 
          vatRate,
          documentType,
          generateVoucherNumber,
        } = data;
        
        const results: Record<string, unknown> = {};
        
        // Validate voucher if rows provided
        if (rows && Array.isArray(rows)) {
          results.voucherValidation = validateVoucher(rows, transactionType || 'JOURNAL');
        }
        
        // Validate VAT if amounts provided
        if (netAmount !== undefined && vatAmount !== undefined) {
          results.vatValidation = validateVAT({
            netAmount,
            vatAmount,
            grossAmount: grossAmount ?? (netAmount + vatAmount),
            vatRate,
          });
        }
        
        // Generate voucher number if requested
        if (generateVoucherNumber && documentType) {
          results.voucherNumber = await getVoucherNumberForDocument(companyId, documentType);
        }
        
        // Determine overall validity
        const voucherIsValid =
          !results.voucherValidation ||
          (results.voucherValidation as { isValid?: unknown }).isValid === true;
        const vatIsValid =
          !results.vatValidation ||
          (results.vatValidation as { isValid?: unknown }).isValid === true;
        const isValid = voucherIsValid && vatIsValid;
        
        return NextResponse.json({ 
          isValid,
          ...results,
        });
      }

      default:
        return NextResponse.json({ error: `Okänd action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Validation API] Error:', error);
    return NextResponse.json(
      { error: 'Valideringsfel', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}

// GET for simple queries
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  switch (action) {
    case 'lastVoucherNumber': {
      const seriesRaw = searchParams.get('series');
      const year = searchParams.get('year');
      
      const allowedSeries: VoucherSeries[] = ['A', 'B', 'K', 'L', 'M', 'S'];
      const series = allowedSeries.includes(seriesRaw as VoucherSeries)
        ? (seriesRaw as VoucherSeries)
        : null;

      if (!series) {
        return NextResponse.json({ error: 'series krävs' }, { status: 400 });
      }
      
      const lastNumber = await getLastVoucherNumber(
        companyId, 
        series, 
        year ? parseInt(year) : undefined
      );
      
      return NextResponse.json({ lastNumber });
    }

    case 'validateSequence': {
      const seriesRaw = searchParams.get('series');
      const year = searchParams.get('year');
      
      const allowedSeries: VoucherSeries[] = ['A', 'B', 'K', 'L', 'M', 'S'];
      const series = allowedSeries.includes(seriesRaw as VoucherSeries)
        ? (seriesRaw as VoucherSeries)
        : null;

      if (!series || !year) {
        return NextResponse.json({ error: 'series och year krävs' }, { status: 400 });
      }
      
      const validation = await validateVoucherSequence(companyId, series, parseInt(year));
      return NextResponse.json({ validation });
    }

    default:
      return NextResponse.json({ error: 'action krävs' }, { status: 400 });
  }
}









