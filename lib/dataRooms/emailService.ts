/**
 * Data Rooms Email Service (SES)
 *
 * Best-effort emails for Data Rooms (invites, notifications).
 * If SES env is not configured, functions no-op.
 */

const SES_REGION = process.env.SES_REGION || 'eu-west-1';

function getAppUrl(): string {
  // Prefer explicit app URL; otherwise use CloudFront prod
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://d31zvrvfawczta.cloudfront.net').replace(/\/$/, '');
}

export async function sendDataRoomInviteEmail(input: {
  toEmail: string;
  toName?: string;
  roomId: string;
  roomName: string;
  invitedBy: string;
  role: string;
  expiresAt?: string;
}) {
  if (!process.env.SES_FROM_EMAIL) {
    console.log('[DataRoomsEmail] SES not configured, skipping invite email');
    return;
  }

  const appUrl = getAppUrl();
  const roomUrl = `${appUrl}/data-rooms/${input.roomId}`;

  const subject = `Du är inbjuden till datarummet: ${input.roomName}`;

  const htmlBody = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 0; }
          .container { max-width: 640px; margin: 0 auto; padding: 24px; }
          .card { background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb; }
          .title { font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
          .muted { color: #6b7280; font-size: 13px; margin: 0 0 16px 0; }
          .row { color: #374151; font-size: 14px; margin: 10px 0; }
          .button { display: inline-block; background: #111827; color: white !important; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 600; }
          .footer { color: #9ca3af; font-size: 12px; margin-top: 18px; }
          .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #f3f4f6; color: #374151; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <p class="title">Inbjudan till datarum</p>
            <p class="muted">Du har blivit inbjuden till ett datarum i AIFM.</p>

            <p class="row"><strong>Datarum:</strong> ${escapeHtml(input.roomName)}</p>
            <p class="row"><strong>Inbjuden av:</strong> ${escapeHtml(input.invitedBy)}</p>
            <p class="row"><strong>Roll:</strong> <span class="pill">${escapeHtml(input.role)}</span></p>
            ${input.expiresAt ? `<p class="row"><strong>Giltig till:</strong> ${escapeHtml(input.expiresAt)}</p>` : ''}

            <div style="margin-top: 18px;">
              <a class="button" href="${roomUrl}">Öppna datarummet</a>
            </div>

            <p class="footer">
              Om du inte förväntade dig detta mail kan du ignorera det.<br/>
              Skickat från AIFM.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses' as any);
    const sesClient = new SESClient({ region: SES_REGION });

    await sesClient.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [input.toEmail] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
      },
    }));
  } catch (err: any) {
    console.warn('[DataRoomsEmail] Failed to send invite email:', err?.message || err);
  }
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}



