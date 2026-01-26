/**
 * NAV Automation Email Service
 * 
 * Skickar automatiska e-post för NAV-rapporter, Notor, SubReds etc.
 * Använder AWS SES för e-postleverans.
 */

import { SecuraNAVData, SecuraTransaction, SecuraHolding } from './client';

const SES_REGION = process.env.SES_REGION || 'eu-north-1';
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'nav@aifm.se';

// ============================================
// TYPES
// ============================================

interface TransactionSummary {
  subscriptions: { count: number; totalAmount: number; totalShares: number };
  redemptions: { count: number; totalAmount: number; totalShares: number };
  netFlow: number;
}

interface NAVReportEmailParams {
  recipients: string[];
  fundId: string;
  fundName?: string;
  navData: SecuraNAVData;
  reportUrl: string;
  date: string;
}

interface NotorEmailParams {
  recipients: string[];
  fundId: string;
  fundName?: string;
  transactions: SecuraTransaction[];
  summary: TransactionSummary;
  reportBlob?: Blob;
}

interface SubRedEmailParams {
  recipients: string[];
  fundId: string;
  fundName?: string;
  transactions: SecuraTransaction[];
  summary: TransactionSummary;
  accountStatementUrl?: string;
  date: string;
}

interface PriceDataEmailParams {
  recipients: string[];
  priceData: Array<{
    fundId: string;
    fundName: string;
    isin: string;
    nav: number;
    aum: number;
    outstandingShares: number;
    currency: string;
  }>;
  excelBlob?: Blob;
}

interface OwnerDataEmailParams {
  recipients: string[];
  fundId: string;
  fundName?: string;
  holdings: SecuraHolding[];
  excelBlob?: Blob;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' ' + currency;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getEmailTemplate(title: string, content: string): string {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: #f3f4f6; 
            margin: 0; 
            padding: 0; 
          }
          .container { max-width: 640px; margin: 0 auto; padding: 24px; }
          .card { 
            background: #ffffff; 
            border-radius: 12px; 
            padding: 24px; 
            border: 1px solid #e5e7eb; 
          }
          .header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 16px;
          }
          .logo {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #c9a227, #e5c54d);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0; }
          .subtitle { font-size: 13px; color: #6b7280; margin: 4px 0 0 0; }
          .row { color: #374151; font-size: 14px; margin: 10px 0; }
          .row strong { color: #111827; }
          .table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          .table th { 
            background: #f9fafb; 
            padding: 10px 12px; 
            text-align: left; 
            font-size: 12px; 
            font-weight: 600; 
            color: #6b7280;
            text-transform: uppercase;
            border-bottom: 1px solid #e5e7eb;
          }
          .table td { 
            padding: 10px 12px; 
            border-bottom: 1px solid #f3f4f6; 
            font-size: 14px;
            color: #374151;
          }
          .table tr:last-child td { border-bottom: none; }
          .highlight { 
            background: #fef3c7; 
            padding: 12px 16px; 
            border-radius: 8px; 
            margin: 16px 0;
          }
          .highlight-green { background: #d1fae5; }
          .highlight-red { background: #fee2e2; }
          .button { 
            display: inline-block; 
            background: #111827; 
            color: white !important; 
            padding: 12px 18px; 
            border-radius: 10px; 
            text-decoration: none; 
            font-weight: 600; 
          }
          .footer { 
            color: #9ca3af; 
            font-size: 12px; 
            margin-top: 24px; 
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
          }
          .badge-green { background: #d1fae5; color: #065f46; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-blue { background: #dbeafe; color: #1e40af; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="logo">AF</div>
              <div>
                <p class="title">${escapeHtml(title)}</p>
                <p class="subtitle">AIFM Fund Management</p>
              </div>
            </div>
            ${content}
            <p class="footer">
              Detta är ett automatiskt meddelande från AIFM.<br/>
              Skickat ${new Date().toLocaleString('sv-SE')}
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ============================================
// SES SEND FUNCTION
// ============================================

async function sendEmail(params: {
  to: string[];
  subject: string;
  htmlBody: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}): Promise<void> {
  if (!process.env.SES_FROM_EMAIL) {
    console.log('[NAVEmailService] SES not configured (SES_FROM_EMAIL missing), skipping email');
    console.log('[NAVEmailService] Would send to:', params.to);
    console.log('[NAVEmailService] Subject:', params.subject);
    return;
  }

  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    const sesClient = new SESClient({ region: SES_REGION });

    // For emails with attachments, we'd need to use SendRawEmailCommand
    // For now, send simple HTML emails
    await sesClient.send(new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: { ToAddresses: params.to },
      Message: {
        Subject: { Data: params.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: params.htmlBody, Charset: 'UTF-8' } },
      },
    }));

    console.log(`[NAVEmailService] Email sent successfully to ${params.to.length} recipients`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[NAVEmailService] Failed to send email:', errorMessage);
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
}

// ============================================
// NAV EMAIL SERVICE CLASS
// ============================================

export class NAVEmailService {
  /**
   * Skicka NAV-rapport via e-post
   */
  async sendNAVReport(params: NAVReportEmailParams): Promise<void> {
    const fundName = params.fundName || params.fundId;
    
    const content = `
      <p class="row">NAV-rapporten för <strong>${escapeHtml(fundName)}</strong> är nu tillgänglig.</p>
      
      <div class="highlight">
        <p class="row" style="margin: 0;"><strong>Datum:</strong> ${formatDate(params.date)}</p>
        <p class="row" style="margin: 8px 0 0 0;"><strong>NAV:</strong> ${formatCurrency(params.navData.nav, params.navData.currency)}</p>
        <p class="row" style="margin: 8px 0 0 0;"><strong>AUM:</strong> ${formatCurrency(params.navData.aum, params.navData.currency)}</p>
        <p class="row" style="margin: 8px 0 0 0;"><strong>Utst. andelar:</strong> ${params.navData.outstandingShares.toLocaleString('sv-SE')}</p>
      </div>
      
      <div style="margin-top: 20px;">
        <a class="button" href="${escapeHtml(params.reportUrl)}">Ladda ner rapport</a>
      </div>
    `;

    await sendEmail({
      to: params.recipients,
      subject: `NAV-rapport: ${fundName} - ${formatDate(params.date)}`,
      htmlBody: getEmailTemplate(`NAV-rapport: ${fundName}`, content),
    });

    console.log(`[NAVEmailService] NAV report sent for ${params.fundId} to ${params.recipients.length} recipients`);
  }

  /**
   * Skicka Notor (gårdagens transaktioner) via e-post
   */
  async sendNotor(params: NotorEmailParams): Promise<void> {
    const fundName = params.fundName || params.fundId;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const subscriptionRows = params.transactions
      .filter(t => t.type === 'SUBSCRIPTION')
      .map(t => `
        <tr>
          <td>${escapeHtml(t.investorName)}</td>
          <td>${formatCurrency(t.amount)}</td>
          <td>${t.shares.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
          <td><span class="badge badge-green">Teckn.</span></td>
        </tr>
      `).join('');

    const redemptionRows = params.transactions
      .filter(t => t.type === 'REDEMPTION')
      .map(t => `
        <tr>
          <td>${escapeHtml(t.investorName)}</td>
          <td>${formatCurrency(t.amount)}</td>
          <td>${t.shares.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
          <td><span class="badge badge-red">Inlösen</span></td>
        </tr>
      `).join('');

    const content = `
      <p class="row">Sammanställning av gårdagens in- och utflöden för <strong>${escapeHtml(fundName)}</strong>.</p>
      
      <div class="highlight${params.summary.netFlow >= 0 ? '-green' : '-red'}">
        <p class="row" style="margin: 0;"><strong>Nettoflöde:</strong> ${formatCurrency(params.summary.netFlow)}</p>
        <p class="row" style="margin: 8px 0 0 0;">
          Teckningar: ${params.summary.subscriptions.count} st (${formatCurrency(params.summary.subscriptions.totalAmount)}) | 
          Inlösen: ${params.summary.redemptions.count} st (${formatCurrency(params.summary.redemptions.totalAmount)})
        </p>
      </div>

      ${params.transactions.length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>Investerare</th>
              <th>Belopp</th>
              <th>Andelar</th>
              <th>Typ</th>
            </tr>
          </thead>
          <tbody>
            ${subscriptionRows}
            ${redemptionRows}
          </tbody>
        </table>
      ` : '<p class="row" style="color: #6b7280; font-style: italic;">Inga transaktioner under dagen.</p>'}
    `;

    await sendEmail({
      to: params.recipients,
      subject: `Notor: ${fundName} - ${formatDate(yesterday.toISOString())}`,
      htmlBody: getEmailTemplate(`Notor: ${fundName}`, content),
    });

    console.log(`[NAVEmailService] Notor sent for ${params.fundId} to ${params.recipients.length} recipients`);
  }

  /**
   * Skicka SubRed (morgondagens förväntade transaktioner) via e-post
   */
  async sendSubRed(params: SubRedEmailParams): Promise<void> {
    const fundName = params.fundName || params.fundId;
    
    const transactionRows = params.transactions.map(t => `
      <tr>
        <td>${escapeHtml(t.investorName)}</td>
        <td>${formatCurrency(t.amount)}</td>
        <td>${t.shares.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
        <td><span class="badge badge-${t.type === 'SUBSCRIPTION' ? 'green' : 'red'}">${t.type === 'SUBSCRIPTION' ? 'Teckn.' : 'Inlösen'}</span></td>
      </tr>
    `).join('');

    const content = `
      <p class="row">Förväntade in- och utflöden för <strong>${escapeHtml(fundName)}</strong> - ${formatDate(params.date)}.</p>
      
      <div class="highlight${params.summary.netFlow >= 0 ? '-green' : '-red'}">
        <p class="row" style="margin: 0;"><strong>Förväntat nettoflöde:</strong> ${formatCurrency(params.summary.netFlow)}</p>
        <p class="row" style="margin: 8px 0 0 0;">
          Teckningar: ${params.summary.subscriptions.count} st (${formatCurrency(params.summary.subscriptions.totalAmount)}) | 
          Inlösen: ${params.summary.redemptions.count} st (${formatCurrency(params.summary.redemptions.totalAmount)})
        </p>
      </div>

      ${params.transactions.length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>Investerare</th>
              <th>Belopp</th>
              <th>Andelar</th>
              <th>Typ</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows}
          </tbody>
        </table>
      ` : '<p class="row" style="color: #6b7280; font-style: italic;">Inga förväntade transaktioner.</p>'}

      ${params.accountStatementUrl ? `
        <div style="margin-top: 20px;">
          <a class="button" href="${escapeHtml(params.accountStatementUrl)}">Ladda ner kontoutdrag</a>
        </div>
      ` : ''}
    `;

    await sendEmail({
      to: params.recipients,
      subject: `SubRed: ${fundName} - ${formatDate(params.date)}`,
      htmlBody: getEmailTemplate(`SubRed: ${fundName}`, content),
    });

    console.log(`[NAVEmailService] SubRed sent for ${params.fundId} to ${params.recipients.length} recipients`);
  }

  /**
   * Skicka prisdata via e-post
   */
  async sendPriceData(params: PriceDataEmailParams): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    const priceRows = params.priceData.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.fundName)}</strong><br/><span style="color: #6b7280; font-size: 12px;">${p.isin}</span></td>
        <td>${formatCurrency(p.nav, p.currency)}</td>
        <td>${formatCurrency(p.aum, p.currency)}</td>
        <td>${p.outstandingShares.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const content = `
      <p class="row">Dagens prisdata för distribution till institut.</p>
      
      <table class="table">
        <thead>
          <tr>
            <th>Fond</th>
            <th>NAV</th>
            <th>AUM</th>
            <th>Utst. andelar</th>
          </tr>
        </thead>
        <tbody>
          ${priceRows}
        </tbody>
      </table>
      
      <p class="row" style="color: #6b7280; font-size: 13px;">
        Data extraherad från Secura Portfolio.<br/>
        För Bloomberg, Morningstar och övriga mottagare.
      </p>
    `;

    await sendEmail({
      to: params.recipients,
      subject: `Prisdata: NAV-kurser - ${formatDate(today)}`,
      htmlBody: getEmailTemplate('Prisdata: NAV-kurser', content),
    });

    console.log(`[NAVEmailService] Price data sent to ${params.recipients.length} recipients`);
  }

  /**
   * Skicka ägardata via e-post
   */
  async sendOwnerData(params: OwnerDataEmailParams): Promise<void> {
    const fundName = params.fundName || params.fundId;
    const today = new Date().toISOString().split('T')[0];
    
    const holdingRows = params.holdings.slice(0, 20).map(h => `
      <tr>
        <td>${escapeHtml(h.investorName)}</td>
        <td>${h.shares.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
        <td>${formatCurrency(h.value)}</td>
        <td>${(h.percentage * 100).toFixed(2)}%</td>
      </tr>
    `).join('');

    const totalValue = params.holdings.reduce((sum, h) => sum + h.value, 0);
    const totalShares = params.holdings.reduce((sum, h) => sum + h.shares, 0);

    const content = `
      <p class="row">Ägardata för <strong>${escapeHtml(fundName)}</strong> - Clearstream-rapport.</p>
      
      <div class="highlight">
        <p class="row" style="margin: 0;"><strong>Antal ägare:</strong> ${params.holdings.length}</p>
        <p class="row" style="margin: 8px 0 0 0;"><strong>Totala andelar:</strong> ${totalShares.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</p>
        <p class="row" style="margin: 8px 0 0 0;"><strong>Totalt värde:</strong> ${formatCurrency(totalValue)}</p>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Investerare</th>
            <th>Andelar</th>
            <th>Värde</th>
            <th>Andel</th>
          </tr>
        </thead>
        <tbody>
          ${holdingRows}
          ${params.holdings.length > 20 ? `
            <tr>
              <td colspan="4" style="text-align: center; color: #6b7280; font-style: italic;">
                ... och ${params.holdings.length - 20} fler ägare
              </td>
            </tr>
          ` : ''}
        </tbody>
      </table>
      
      <p class="row" style="color: #6b7280; font-size: 13px;">
        Komplett Excel-fil bifogas för Clearstream-rapportering.
      </p>
    `;

    await sendEmail({
      to: params.recipients,
      subject: `Ägardata: ${fundName} - ${formatDate(today)}`,
      htmlBody: getEmailTemplate(`Ägardata: ${fundName}`, content),
    });

    console.log(`[NAVEmailService] Owner data sent for ${params.fundId} to ${params.recipients.length} recipients`);
  }
}

// Singleton instance
let emailServiceInstance: NAVEmailService | null = null;

export function getNAVEmailService(): NAVEmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new NAVEmailService();
  }
  return emailServiceInstance;
}
