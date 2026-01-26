/**
 * Email Service
 * Sends notifications to users via SendGrid
 */

import { logInfo, logError } from './logger';

// SendGrid API - will be installed via npm
// This is a template that works once @sendgrid/mail is installed

interface SendgridMailType {
  send: (msg: any) => Promise<any>;
}

let sgMail: SendgridMailType | null = null;

// Initialize SendGrid (lazy load to avoid errors if not installed)
function getSgMail(): SendgridMailType {
  if (!sgMail) {
    try {
      const sgMailModule = require('@sendgrid/mail');
      const mailInstance = sgMailModule.default || sgMailModule;
      mailInstance.setApiKey(process.env.SENDGRID_API_KEY || '');
      sgMail = mailInstance;
    } catch (error) {
      logError('SendGrid module not installed', error as Error);
      throw new Error('Email service not configured');
    }
  }
  return sgMail!;
}

// Email templates
const EMAIL_TEMPLATES = {
  TASK_ASSIGNED: 'task-assigned',
  TASK_APPROVED: 'task-approved',
  TASK_REJECTED: 'task-rejected',
  REPORT_SUBMITTED: 'report-submitted',
  REPORT_APPROVED: 'report-approved',
  REPORT_READY: 'report-ready',
  SYSTEM_ALERT: 'system-alert',
};

// Build email template
function buildEmail(templateId: string, data: Record<string, any>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  switch (templateId) {
    case EMAIL_TEMPLATES.TASK_ASSIGNED:
      return {
        subject: `New Task: ${data.taskType}`,
        html: `
          <h2>You have a new task</h2>
          <p>Task: <strong>${data.taskType}</strong></p>
          <p>Client: <strong>${data.clientName}</strong></p>
          <p>Priority: <strong>${data.priority || 'Normal'}</strong></p>
          <p><a href="${baseUrl}/coordinator/inbox">View Task</a></p>
        `,
      };

    case EMAIL_TEMPLATES.TASK_APPROVED:
      return {
        subject: `Task Approved: ${data.taskType}`,
        html: `
          <h2>Your task has been approved</h2>
          <p>Task: <strong>${data.taskType}</strong></p>
          <p>Approved by: <strong>${data.approverName}</strong></p>
          <p>Next steps will follow.</p>
        `,
      };

    case EMAIL_TEMPLATES.REPORT_SUBMITTED:
      return {
        subject: `Report Submitted for Review: ${data.reportType}`,
        html: `
          <h2>Report submitted for QC review</h2>
          <p>Report: <strong>${data.reportType}</strong></p>
          <p>Period: <strong>${data.period}</strong></p>
          <p>Awaiting coordinator review.</p>
        `,
      };

    case EMAIL_TEMPLATES.REPORT_APPROVED:
      return {
        subject: `Report Approved: ${data.reportType}`,
        html: `
          <h2>Your report has been approved!</h2>
          <p>Report: <strong>${data.reportType}</strong></p>
          <p>Next: Please sign off on the report.</p>
          <p><a href="${baseUrl}/specialist/board">Sign Off</a></p>
        `,
      };

    case EMAIL_TEMPLATES.REPORT_READY:
      return {
        subject: `Your Report is Ready: ${data.reportType}`,
        html: `
          <h2>Your report is ready!</h2>
          <p>Report: <strong>${data.reportType}</strong></p>
          <p>Period: <strong>${data.period}</strong></p>
          <p><a href="${baseUrl}/client/dashboard">Download Report</a></p>
        `,
      };

    case EMAIL_TEMPLATES.SYSTEM_ALERT:
      return {
        subject: `⚠️ System Alert: ${data.alertType}`,
        html: `
          <h2>System Alert</h2>
          <p><strong>${data.alertType}</strong></p>
          <p>${data.message}</p>
          <p>Severity: <strong>${data.severity || 'Medium'}</strong></p>
        `,
      };

    default:
      return {
        subject: data.subject || 'Notification',
        html: data.html || '<p>Notification from FINANS</p>',
      };
  }
}

// Main send function
export async function sendEmail(
  to: string,
  templateId: string,
  data: Record<string, any>,
  options?: { cc?: string[]; bcc?: string[] }
): Promise<boolean> {
  try {
    // Check if SendGrid is configured
    if (!process.env.SENDGRID_API_KEY) {
      logInfo('SendGrid not configured, skipping email', { to, templateId });
      return false;
    }

    const sgMail = getSgMail();
    const template = buildEmail(templateId, data);

    const msg = {
      to,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@finans.com',
      subject: template.subject,
      html: template.html,
      ...(options?.cc && { cc: options.cc }),
      ...(options?.bcc && { bcc: options.bcc }),
    };

    await sgMail.send(msg);

    logInfo('Email sent successfully', { to, templateId });
    return true;
  } catch (error) {
    logError('Failed to send email', error as Error, { to, templateId });
    return false;
  }
}

// Convenience functions
export async function notifyTaskAssigned(
  userEmail: string,
  taskType: string,
  clientName: string,
  priority?: string
): Promise<boolean> {
  return sendEmail(userEmail, EMAIL_TEMPLATES.TASK_ASSIGNED, {
    taskType,
    clientName,
    priority,
  });
}

export async function notifyReportReady(
  clientEmail: string,
  reportType: string,
  period: string
): Promise<boolean> {
  return sendEmail(clientEmail, EMAIL_TEMPLATES.REPORT_READY, {
    reportType,
    period,
  });
}

export async function notifyReportApproved(
  specialistEmail: string,
  reportType: string
): Promise<boolean> {
  return sendEmail(specialistEmail, EMAIL_TEMPLATES.REPORT_APPROVED, {
    reportType,
  });
}

export async function sendSystemAlert(
  adminEmail: string,
  alertType: string,
  message: string,
  severity?: string
): Promise<boolean> {
  return sendEmail(adminEmail, EMAIL_TEMPLATES.SYSTEM_ALERT, {
    alertType,
    message,
    severity,
  });
}

// Export for use in API routes
export { EMAIL_TEMPLATES };
