import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { paymentService } from '@/lib/accounting/payments/paymentService';
import { paymentRecipientStore } from '@/lib/accounting/payments/paymentRecipientStore';
import type { PaymentRecipient } from '@/lib/accounting/payments/paymentRecipientStore';
import type { PendingPayment } from '@/lib/accounting/payments/paymentService';
import { generatePain001SE } from '@/lib/accounting/payments/paymentFileService';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { companyId, paymentIds, executionDate, debtor } = body || {};

    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json({ error: 'paymentIds must be a non-empty array' }, { status: 400 });
    }
    if (!executionDate) return NextResponse.json({ error: 'executionDate is required (YYYY-MM-DD)' }, { status: 400 });
    if (!debtor?.name || !debtor?.iban || !debtor?.bic) {
      return NextResponse.json({ error: 'debtor {name, iban, bic} is required' }, { status: 400 });
    }

    const all = await paymentService.getPendingPayments(companyId);
    const selected = all.filter(p => paymentIds.includes(p.id));

    const recipients = await paymentRecipientStore.list(companyId);
    const recipientsByKey: Record<string, PaymentRecipient> = {};
    for (const r of recipients) recipientsByKey[r.supplierKey] = r;

    const supplierKeyForPayment = (p: PendingPayment) => paymentRecipientStore.normalizeSupplierKey(p.supplier);

    const createdAtIso = new Date().toISOString();
    const messageId = `AIFM-${companyId}-${createdAtIso.replace(/[:.]/g, '')}`;

    const { fileName, xml, missingRecipients } = generatePain001SE({
      messageId,
      companyId,
      createdAtIso,
      executionDate,
      debtor,
      payments: selected,
      recipientsBySupplierKey: recipientsByKey,
      supplierKeyForPayment,
    });

    if (missingRecipients.length > 0) {
      return NextResponse.json(
        { error: 'Missing recipient bank details', missingRecipients },
        { status: 400 }
      );
    }

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error('[API] payments/export error:', e);
    return NextResponse.json(
      { error: 'Internal server error', details: e instanceof Error ? e.message : 'Unknown' },
      { status: 500 }
    );
  }
}



