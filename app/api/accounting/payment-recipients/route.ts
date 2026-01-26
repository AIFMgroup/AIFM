import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { paymentRecipientStore } from '@/lib/accounting/payments/paymentRecipientStore';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const supplierKey = searchParams.get('supplierKey');
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });

    if (supplierKey) {
      const recipient = await paymentRecipientStore.get(companyId, supplierKey);
      return NextResponse.json({ recipient });
    }

    const recipients = await paymentRecipientStore.list(companyId);
    return NextResponse.json({ recipients });
  } catch (e) {
    console.error('[API] payment-recipients GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { companyId, supplierName, supplierKey, iban, bic, bankgiro, plusgiro, referenceHint } = body || {};
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    if (!supplierName) return NextResponse.json({ error: 'supplierName is required' }, { status: 400 });

    const recipient = await paymentRecipientStore.upsert(companyId, {
      supplierName,
      supplierKey,
      iban,
      bic,
      bankgiro,
      plusgiro,
      referenceHint,
    });

    return NextResponse.json({ success: true, recipient });
  } catch (e) {
    console.error('[API] payment-recipients POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('__Host-aifm_id_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { companyId, supplierKey } = body || {};
    if (!companyId) return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    if (!supplierKey) return NextResponse.json({ error: 'supplierKey is required' }, { status: 400 });

    await paymentRecipientStore.remove(companyId, supplierKey);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[API] payment-recipients DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



