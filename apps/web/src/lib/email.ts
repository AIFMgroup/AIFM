/**
 * Email Service for web app
 * Provides email sending functionality for compliance notifications
 */

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
}

type SendGridClient = {
  setApiKey: (key: string) => void;
  send: (msg: any) => Promise<any>;
} | null;

let sgMail: SendGridClient = null;

/**
 * Lazy-load SendGrid only when a key exists and on the server.
 * Uses runtime import to avoid bundling an optional dependency in the client build.
 */
async function loadSendGrid() {
  if (typeof window !== 'undefined') return null;
  if (!process.env.SENDGRID_API_KEY) return null;
  if (sgMail) return sgMail;

  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (
      modulePath: string
    ) => Promise<any>;
    const sgMailModule = await dynamicImport('@sendgrid/mail');
    const client = sgMailModule?.default ?? sgMailModule;
    if (client?.setApiKey) {
      client.setApiKey(process.env.SENDGRID_API_KEY);
      sgMail = client;
    }
  } catch (error) {
    console.warn('SendGrid not available, falling back to console logging', error);
    sgMail = null;
  }

  return sgMail;
}

/**
 * Send email using SendGrid or console fallback
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const { to, subject, html, cc, bcc } = options;

    // Check if SendGrid is configured
    const sg = await loadSendGrid();
    if (sg) {
      const msg: any = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@aifm.com',
        subject,
        html,
      };

      if (cc && cc.length > 0) msg.cc = cc;
      if (bcc && bcc.length > 0) msg.bcc = bcc;

      await sg.send(msg);
      console.log('Email sent successfully via SendGrid', { to, subject });
      return true;
    }

    // Fallback: Log to console in development/production if SendGrid not configured
    console.log('📧 Email (not sent - SendGrid not configured):');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body:', html);
    if (cc) console.log('CC:', cc);
    if (bcc) console.log('BCC:', bcc);
    
    return true; // Return true even in fallback mode to not break the flow
  } catch (error) {
    console.error('Failed to send email', error, options);
    return false;
  }
}

