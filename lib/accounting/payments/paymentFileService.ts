import type { PendingPayment } from './paymentService';
import type { PaymentRecipient } from './paymentRecipientStore';

export type Pain001Debtor = {
  name: string;
  iban: string;
  bic: string;
};

function escapeXml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isIsoDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function toCtrlSum(amounts: number[]): string {
  const sum = amounts.reduce((a, b) => a + b, 0);
  // pain.001 expects decimal with dot
  return (Math.round(sum * 100) / 100).toFixed(2);
}

function amountToString(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export function generatePain001SE(
  params: {
    messageId: string;
    companyId: string;
    createdAtIso: string; // ISO timestamp
    executionDate: string; // YYYY-MM-DD
    debtor: Pain001Debtor;
    payments: PendingPayment[];
    recipientsBySupplierKey: Record<string, PaymentRecipient>;
    supplierKeyForPayment: (p: PendingPayment) => string;
  }
): { fileName: string; xml: string; missingRecipients: Array<{ supplier: string; supplierKey: string }> } {
  const { messageId, createdAtIso, executionDate, debtor, payments, recipientsBySupplierKey, supplierKeyForPayment } = params;

  if (!isIsoDate(executionDate)) {
    throw new Error('executionDate must be YYYY-MM-DD');
  }

  const selected = payments.filter(p => (p.status === 'pending' || p.status === 'scheduled') && (p.amount ?? 0) > 0);

  const missing: Array<{ supplier: string; supplierKey: string }> = [];
  const txs: Array<{ p: PendingPayment; r: PaymentRecipient }> = [];

  for (const p of selected) {
    const supplierKey = supplierKeyForPayment(p);
    const r = recipientsBySupplierKey[supplierKey];
    if (!r) {
      missing.push({ supplier: p.supplier, supplierKey });
      continue;
    }
    txs.push({ p, r });
  }

  const fileName = `pain.001_${params.companyId}_${executionDate.replaceAll('-', '')}.xml`;

  if (missing.length > 0) {
    return { fileName, xml: '', missingRecipients: missing };
  }

  // Hard guard: SEK only for now (we can extend once FX posting is unlocked end-to-end).
  for (const { p } of txs) {
    if ((p.currency || 'SEK') !== 'SEK') {
      throw new Error(`Only SEK payments supported for pain.001 export (got ${p.currency} for ${p.supplier})`);
    }
  }

  // Hard guard: require IBAN+BIC (BG/PG can be added later)
  for (const { r } of txs) {
    if (!r.iban || !r.bic) {
      throw new Error(`Missing IBAN/BIC for recipient ${r.supplierName}`);
    }
  }

  const ctrlSum = toCtrlSum(txs.map(({ p }) => p.amount));
  const nbOfTxs = txs.length.toString();

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '  <CstmrCdtTrfInitn>',
    '    <GrpHdr>',
    `      <MsgId>${escapeXml(messageId)}</MsgId>`,
    `      <CreDtTm>${escapeXml(createdAtIso)}</CreDtTm>`,
    `      <NbOfTxs>${escapeXml(nbOfTxs)}</NbOfTxs>`,
    `      <CtrlSum>${escapeXml(ctrlSum)}</CtrlSum>`,
    '      <InitgPty>',
    `        <Nm>${escapeXml(debtor.name)}</Nm>`,
    '      </InitgPty>',
    '    </GrpHdr>',
    '    <PmtInf>',
    `      <PmtInfId>${escapeXml(messageId)}-P1</PmtInfId>`,
    '      <PmtMtd>TRF</PmtMtd>',
    `      <NbOfTxs>${escapeXml(nbOfTxs)}</NbOfTxs>`,
    `      <CtrlSum>${escapeXml(ctrlSum)}</CtrlSum>`,
    '      <PmtTpInf>',
    '        <SvcLvl>',
    '          <Cd>SEPA</Cd>',
    '        </SvcLvl>',
    '      </PmtTpInf>',
    `      <ReqdExctnDt>${escapeXml(executionDate)}</ReqdExctnDt>`,
    '      <Dbtr>',
    `        <Nm>${escapeXml(debtor.name)}</Nm>`,
    '      </Dbtr>',
    '      <DbtrAcct>',
    '        <Id>',
    `          <IBAN>${escapeXml(debtor.iban)}</IBAN>`,
    '        </Id>',
    '      </DbtrAcct>',
    '      <DbtrAgt>',
    '        <FinInstnId>',
    `          <BIC>${escapeXml(debtor.bic)}</BIC>`,
    '        </FinInstnId>',
    '      </DbtrAgt>',
    '      <ChrgBr>SLEV</ChrgBr>',
    ...txs.flatMap(({ p, r }, idx) => {
      const endToEndId = `E2E-${idx + 1}-${(p.invoiceNumber || p.jobId || 'payment').slice(0, 20)}`;
      const ustrd = [p.supplier, p.invoiceNumber].filter(Boolean).join(' / ').slice(0, 140);
      return [
        '      <CdtTrfTxInf>',
        '        <PmtId>',
        `          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>`,
        '        </PmtId>',
        '        <Amt>',
        `          <InstdAmt Ccy="SEK">${escapeXml(amountToString(p.amount))}</InstdAmt>`,
        '        </Amt>',
        '        <CdtrAgt>',
        '          <FinInstnId>',
        `            <BIC>${escapeXml(r.bic || '')}</BIC>`,
        '          </FinInstnId>',
        '        </CdtrAgt>',
        '        <Cdtr>',
        `          <Nm>${escapeXml(r.supplierName)}</Nm>`,
        '        </Cdtr>',
        '        <CdtrAcct>',
        '          <Id>',
        `            <IBAN>${escapeXml(r.iban || '')}</IBAN>`,
        '          </Id>',
        '        </CdtrAcct>',
        '        <RmtInf>',
        `          <Ustrd>${escapeXml(ustrd)}</Ustrd>`,
        '        </RmtInf>',
        '      </CdtTrfTxInf>',
      ];
    }),
    '    </PmtInf>',
    '  </CstmrCdtTrfInitn>',
    '</Document>',
    '',
  ].join('\n');

  return { fileName, xml, missingRecipients: [] };
}


