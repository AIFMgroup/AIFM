/**
 * Securities Approval Email Notifications
 * Sends email via AWS SES when approvals are submitted, approved, or rejected.
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { SecurityApprovalRequest } from './types';

const SES_REGION = process.env.SES_REGION || 'eu-west-1';
const SENDER_EMAIL = process.env.SECURITIES_SENDER_EMAIL || 'christopher.genberg@aifm.se';
const SENDER_NAME = 'AIFM Värdepapper';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://d31zvrvfawczta.cloudfront.net';

const REVIEWER_EMAILS = (process.env.SECURITIES_REVIEWER_EMAILS || 'christopher.genberg@aifm.se,joakim.eriksson@aifm.se,edwin.sjogren@aifm.se')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const sesClient = new SESClient({ region: SES_REGION });

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSubmittedHTML(approval: SecurityApprovalRequest): string {
  const secName = approval.basicInfo?.name || 'Okänt värdepapper';
  const isin = approval.basicInfo?.isin || '–';
  const fund = approval.fundName || '–';
  const submitter = approval.createdBy || approval.createdByEmail || 'Okänd';
  const date = approval.submittedAt ? formatDate(approval.submittedAt) : formatDate(approval.updatedAt);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#1f2937;margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#2d2a26;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#c0a280;margin:0;font-size:20px;">Ny värdepappersansökan</h1>
    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px;">Väntar på granskning</p>
  </div>
  <div style="background:#fff;padding:24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="margin:0;color:#1e40af;font-weight:600;">En ny ansökan har skickats in och väntar på din granskning.</p>
    </div>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Värdepapper</td><td style="padding:8px 0;font-weight:600;">${secName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">ISIN</td><td style="padding:8px 0;">${isin}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Fond</td><td style="padding:8px 0;">${fund}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Inskickad av</td><td style="padding:8px 0;">${submitter}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Datum</td><td style="padding:8px 0;">${date}</td></tr>
    </table>
    <div style="margin-top:24px;text-align:center;">
      <a href="${APP_URL}/risk/review-securities" style="display:inline-block;background:#c0a280;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Granska ansökan
      </a>
    </div>
  </div>
  <div style="background:#2d2a26;padding:16px;border-radius:0 0 12px 12px;text-align:center;">
    <p style="color:rgba(255,255,255,0.5);margin:0;font-size:11px;">AIFM Capital AB – Automatiskt meddelande</p>
  </div>
</div>
</body></html>`;
}

function buildDecisionHTML(approval: SecurityApprovalRequest, decision: 'approved' | 'rejected'): string {
  const secName = approval.basicInfo?.name || 'Okänt värdepapper';
  const fund = approval.fundName || '–';
  const reviewer = approval.reviewedBy || approval.reviewedByEmail || 'Granskare';
  const date = approval.reviewedAt ? formatDate(approval.reviewedAt) : formatDate(approval.updatedAt);
  const isApproved = decision === 'approved';

  const statusBg = isApproved ? '#d1fae5' : '#fee2e2';
  const statusBorder = isApproved ? '#10b981' : '#ef4444';
  const statusColor = isApproved ? '#065f46' : '#991b1b';
  const statusText = isApproved ? 'Godkänd' : 'Avvisad';
  const reason = !isApproved && approval.rejectionReason
    ? `<div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:8px;"><p style="margin:0;font-size:13px;color:#991b1b;"><strong>Anledning:</strong> ${approval.rejectionReason}</p></div>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#1f2937;margin:0;padding:0;background:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#2d2a26;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:#c0a280;margin:0;font-size:20px;">Värdepappersansökan – ${statusText}</h1>
  </div>
  <div style="background:#fff;padding:24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <div style="background:${statusBg};border-left:4px solid ${statusBorder};padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
      <p style="margin:0;color:${statusColor};font-weight:600;">${secName} för ${fund} har ${statusText.toLowerCase()} av ${reviewer}.</p>
    </div>
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Värdepapper</td><td style="padding:8px 0;font-weight:600;">${secName}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Fond</td><td style="padding:8px 0;">${fund}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Granskare</td><td style="padding:8px 0;">${reviewer}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;">Datum</td><td style="padding:8px 0;">${date}</td></tr>
    </table>
    ${reason}
    <div style="margin-top:24px;text-align:center;">
      <a href="${APP_URL}/securities" style="display:inline-block;background:#c0a280;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Visa ansökan
      </a>
    </div>
  </div>
  <div style="background:#2d2a26;padding:16px;border-radius:0 0 12px 12px;text-align:center;">
    <p style="color:rgba(255,255,255,0.5);margin:0;font-size:11px;">AIFM Capital AB – Automatiskt meddelande</p>
  </div>
</div>
</body></html>`;
}

async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  try {
    await sesClient.send(new SendEmailCommand({
      Source: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      Destination: { ToAddresses: to },
      Message: {
        Subject: { Charset: 'UTF-8', Data: subject },
        Body: { Html: { Charset: 'UTF-8', Data: html } },
      },
    }));
    console.log(`[Securities Email] Sent to ${to.join(', ')}: ${subject}`);
  } catch (err) {
    console.error('[Securities Email] Failed:', err);
  }
}

export async function notifyReviewersOnSubmission(approval: SecurityApprovalRequest): Promise<void> {
  if (REVIEWER_EMAILS.length === 0) return;
  const secName = approval.basicInfo?.name || 'Värdepapper';
  const subject = `[Åtgärd krävs] Ny värdepappersansökan: ${secName} – ${approval.fundName}`;
  const html = buildSubmittedHTML(approval);
  await sendEmail(REVIEWER_EMAILS, subject, html);
}

export async function notifySubmitterOnDecision(approval: SecurityApprovalRequest, decision: 'approved' | 'rejected'): Promise<void> {
  const email = approval.createdByEmail;
  if (!email) return;
  const secName = approval.basicInfo?.name || 'Värdepapper';
  const label = decision === 'approved' ? 'Godkänd' : 'Avvisad';
  const subject = `[${label}] Värdepappersansökan: ${secName} – ${approval.fundName}`;
  const html = buildDecisionHTML(approval, decision);
  await sendEmail([email], subject, html);
}
