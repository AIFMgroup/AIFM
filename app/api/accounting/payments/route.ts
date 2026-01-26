/**
 * API Route: Payments
 * GET /api/accounting/payments?companyId=xxx
 * POST /api/accounting/payments - Schedule/complete payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { paymentService } from '@/lib/accounting/payments/paymentService';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const filter = searchParams.get('filter'); // 'all', 'pending', 'overdue', 'scheduled', 'due-soon'

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }

    let payments;
    
    switch (filter) {
      case 'overdue':
        payments = await paymentService.getOverduePayments(companyId);
        break;
      case 'due-soon':
        payments = await paymentService.getPaymentsDueSoon(companyId);
        break;
      default:
        payments = await paymentService.getPendingPayments(companyId);
    }

    const summary = await paymentService.getPaymentSummary(companyId);

    return NextResponse.json({
      success: true,
      payments,
      summary,
    });

  } catch (error) {
    console.error('[API] Payments GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentId, action, ...params } = body;

    if (!paymentId || !action) {
      return NextResponse.json(
        { error: 'paymentId and action are required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'schedule':
        if (!params.scheduledDate) {
          return NextResponse.json(
            { error: 'scheduledDate is required for scheduling' },
            { status: 400 }
          );
        }
        result = await paymentService.schedulePayment(
          paymentId,
          params.scheduledDate,
          params.paymentMethod || 'manual'
        );
        break;

      case 'mark-paid':
        result = await paymentService.markAsPaid(paymentId, params.bankReference, params.paymentDate);
        break;

      case 'cancel':
        result = await paymentService.cancelPayment(paymentId);
        break;

      case 'initiate-tink':
        if (!params.bankAccountId) {
          return NextResponse.json(
            { error: 'bankAccountId is required for Tink payment' },
            { status: 400 }
          );
        }
        const tinkResult = await paymentService.initiatePaymentViaTink(
          paymentId,
          params.bankAccountId
        );
        return NextResponse.json(tinkResult);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, payment: result });

  } catch (error) {
    console.error('[API] Payments POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process payment request' },
      { status: 500 }
    );
  }
}


