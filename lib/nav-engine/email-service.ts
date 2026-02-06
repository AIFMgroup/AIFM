/**
 * NAV Email Service
 * 
 * Skicka NAV-rapporter via AWS SES
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { NAVCalculationResult } from './types';
import { NAVApproval } from './nav-store';

// ============================================================================
// SES Client
// ============================================================================

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

// Verified sender email
const SENDER_EMAIL = process.env.NAV_SENDER_EMAIL || 'nav@aifm.se';
const SENDER_NAME = process.env.NAV_SENDER_NAME || 'AIFM NAV System';

// ============================================================================
// Types
// ============================================================================

export interface EmailRecipient {
  email: string;
  name: string;
  type: 'TO' | 'CC' | 'BCC';
}

export interface NAVEmailOptions {
  recipients: EmailRecipient[];
  navDate: string;
  navResults: NAVCalculationResult[];
  includeDetails?: boolean;
  attachPDF?: boolean;
  attachExcel?: boolean;
  customMessage?: string;
}

export interface ApprovalNotificationOptions {
  approval: NAVApproval;
  action: 'CREATED' | 'FIRST_APPROVED' | 'APPROVED' | 'REJECTED';
  approverName?: string;
  recipients: EmailRecipient[];
}

// ============================================================================
// Email Templates
// ============================================================================

function generateNAVReportHTML(options: NAVEmailOptions): string {
  const { navDate, navResults, customMessage, includeDetails } = options;

  const totalAUM = navResults.reduce((sum, r) => sum + r.netAssetValue, 0);
  const avgChange = navResults.reduce((sum, r) => sum + r.navChangePercent, 0) / navResults.length;

  // Group by fund
  const fundGroups = new Map<string, NAVCalculationResult[]>();
  navResults.forEach(r => {
    const existing = fundGroups.get(r.fundId) || [];
    existing.push(r);
    fundGroups.set(r.fundId, existing);
  });

  const fundRows = Array.from(fundGroups.entries()).map(([fundId, results]) => {
    const fundName = results[0]?.breakdown ? 'Fund' : fundId;
    const fundTotal = results.reduce((sum, r) => sum + r.netAssetValue, 0);
    
    return `
      <tr style="background-color: #f9fafb;">
        <td colspan="5" style="padding: 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">
          ${fundName}
          <span style="font-weight: normal; color: #6b7280; margin-left: 8px;">
            AUM: ${formatCurrency(fundTotal)}
          </span>
        </td>
      </tr>
      ${results.map(r => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">${r.shareClassId}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">
            ${r.navPerShare.toFixed(4)}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${r.navChangePercent >= 0 ? '#059669' : '#dc2626'};">
            ${r.navChangePercent >= 0 ? '+' : ''}${r.navChangePercent.toFixed(2)}%
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; text-align: right;">
            ${formatCurrency(r.netAssetValue)}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; text-align: center;">
            <span style="padding: 2px 8px; border-radius: 9999px; font-size: 11px; ${
              r.status === 'VALID' ? 'background-color: #d1fae5; color: #065f46;' :
              r.status === 'WARNINGS' ? 'background-color: #fef3c7; color: #92400e;' :
              'background-color: #fee2e2; color: #991b1b;'
            }">
              ${r.status}
            </span>
          </td>
        </tr>
      `).join('')}
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>NAV-rapport ${navDate}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #c0a280, #a08060); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">NAV-rapport</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${formatDate(navDate)}</p>
        </div>

        <!-- Summary -->
        <div style="background-color: white; padding: 24px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
          <div style="display: flex; gap: 20px; margin-bottom: 24px;">
            <div style="flex: 1; background-color: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #c0a280;">${formatCurrency(totalAUM)}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Totalt AUM</div>
            </div>
            <div style="flex: 1; background-color: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: ${avgChange >= 0 ? '#059669' : '#dc2626'};">
                ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Genomsnittlig förändring</div>
            </div>
            <div style="flex: 1; background-color: #f9fafb; padding: 16px; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #1f2937;">${navResults.length}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Andelsklasser</div>
            </div>
          </div>

          ${customMessage ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">${customMessage}</p>
            </div>
          ` : ''}

          <!-- NAV Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background-color: #1f2937;">
                <th style="padding: 12px; text-align: left; color: white; font-weight: 600;">Andelsklass</th>
                <th style="padding: 12px; text-align: right; color: white; font-weight: 600;">NAV</th>
                <th style="padding: 12px; text-align: right; color: white; font-weight: 600;">Förändring</th>
                <th style="padding: 12px; text-align: right; color: white; font-weight: 600;">AUM</th>
                <th style="padding: 12px; text-align: center; color: white; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${fundRows}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="background-color: #1f2937; padding: 20px; border-radius: 0 0 12px 12px; text-align: center;">
          <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 12px;">
            Genererad ${new Date().toLocaleString('sv-SE')} | AIFM AB
          </p>
          <p style="color: rgba(255,255,255,0.5); margin: 8px 0 0 0; font-size: 11px;">
            Detta meddelande är automatiskt genererat. Kontakta nav@aifm.se vid frågor.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateApprovalNotificationHTML(options: ApprovalNotificationOptions): string {
  const { approval, action, approverName } = options;

  const statusMessages = {
    CREATED: 'En ny NAV-beräkning väntar på godkännande',
    FIRST_APPROVED: `NAV har godkänts av ${approverName || 'första granskaren'}. Väntar på andra godkännande.`,
    APPROVED: `NAV har godkänts av ${approverName || 'andra granskaren'}. NAV är nu officiell.`,
    REJECTED: `NAV har avvisats av ${approverName || 'granskare'}.`,
  };

  const statusColors = {
    CREATED: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    FIRST_APPROVED: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    APPROVED: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    REJECTED: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  };

  const colors = statusColors[action];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>NAV Godkännande - ${approval.navDate}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background-color: #1f2937; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">NAV Godkännande</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0 0;">${formatDate(approval.navDate)}</p>
          </div>

          <!-- Content -->
          <div style="padding: 24px;">
            <div style="background-color: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
              <p style="margin: 0; color: ${colors.text}; font-weight: 600;">${statusMessages[action]}</p>
            </div>

            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Sammanfattning</h3>
            
            <table style="width: 100%; font-size: 14px; margin-bottom: 24px;">
              ${approval.navSummary.slice(0, 10).map(nav => `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6;">${nav.fundId} / ${nav.shareClassId}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${nav.navPerShare.toFixed(4)}</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f3f4f6; text-align: right; color: ${nav.navChange >= 0 ? '#059669' : '#dc2626'};">
                    ${nav.navChange >= 0 ? '+' : ''}${nav.navChange.toFixed(2)}%
                  </td>
                </tr>
              `).join('')}
            </table>

            ${action === 'CREATED' || action === 'FIRST_APPROVED' ? `
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.aifm.se'}/nav-admin" 
                 style="display: inline-block; background-color: #c0a280; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Granska NAV
              </a>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">AIFM AB | Automatiskt genererat meddelande</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// Email Functions
// ============================================================================

/**
 * Send NAV report email
 */
export async function sendNAVReportEmail(options: NAVEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const toAddresses = options.recipients.filter(r => r.type === 'TO').map(r => r.email);
    const ccAddresses = options.recipients.filter(r => r.type === 'CC').map(r => r.email);
    const bccAddresses = options.recipients.filter(r => r.type === 'BCC').map(r => r.email);

    if (toAddresses.length === 0) {
      throw new Error('At least one TO recipient is required');
    }

    const htmlBody = generateNAVReportHTML(options);
    const textBody = generateNAVReportText(options);

    const command = new SendEmailCommand({
      Source: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      Destination: {
        ToAddresses: toAddresses,
        CcAddresses: ccAddresses.length > 0 ? ccAddresses : undefined,
        BccAddresses: bccAddresses.length > 0 ? bccAddresses : undefined,
      },
      Message: {
        Subject: {
          Charset: 'UTF-8',
          Data: `NAV-rapport ${options.navDate}`,
        },
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody,
          },
          Text: {
            Charset: 'UTF-8',
            Data: textBody,
          },
        },
      },
    });

    const response = await sesClient.send(command);

    console.log(`[NAV Email] Sent NAV report to ${toAddresses.join(', ')} - MessageId: ${response.MessageId}`);

    return {
      success: true,
      messageId: response.MessageId,
    };

  } catch (error) {
    console.error('[NAV Email] Failed to send NAV report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send approval notification
 */
export async function sendApprovalNotification(options: ApprovalNotificationOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const toAddresses = options.recipients.filter(r => r.type === 'TO').map(r => r.email);

    if (toAddresses.length === 0) {
      return { success: true }; // No recipients, skip
    }

    const htmlBody = generateApprovalNotificationHTML(options);

    const subjectMap = {
      CREATED: `[Åtgärd krävs] NAV ${options.approval.navDate} väntar på godkännande`,
      FIRST_APPROVED: `[Info] NAV ${options.approval.navDate} - Första godkännandet klart`,
      APPROVED: `[Info] NAV ${options.approval.navDate} - Godkänd`,
      REJECTED: `[OBS] NAV ${options.approval.navDate} - Avvisad`,
    };

    const command = new SendEmailCommand({
      Source: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Charset: 'UTF-8',
          Data: subjectMap[options.action],
        },
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: htmlBody,
          },
        },
      },
    });

    const response = await sesClient.send(command);

    return {
      success: true,
      messageId: response.MessageId,
    };

  } catch (error) {
    console.error('[NAV Email] Failed to send approval notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} Mdr SEK`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} Mkr SEK`;
  }
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function generateNAVReportText(options: NAVEmailOptions): string {
  const { navDate, navResults } = options;
  const totalAUM = navResults.reduce((sum, r) => sum + r.netAssetValue, 0);

  let text = `NAV-RAPPORT ${navDate}\n`;
  text += `${'='.repeat(50)}\n\n`;
  text += `Totalt AUM: ${formatCurrency(totalAUM)}\n`;
  text += `Antal andelsklasser: ${navResults.length}\n\n`;
  text += `${'─'.repeat(50)}\n`;
  text += `Andelsklass\t\tNAV\t\tFörändring\n`;
  text += `${'─'.repeat(50)}\n`;

  navResults.forEach(r => {
    const change = r.navChangePercent >= 0 ? `+${r.navChangePercent.toFixed(2)}%` : `${r.navChangePercent.toFixed(2)}%`;
    text += `${r.shareClassId}\t\t${r.navPerShare.toFixed(4)}\t\t${change}\n`;
  });

  text += `\n${'─'.repeat(50)}\n`;
  text += `Genererad: ${new Date().toLocaleString('sv-SE')}\n`;
  text += `AIFM AB\n`;

  return text;
}
