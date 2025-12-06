import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { requireAuth } from '@/lib/authz';

/**
 * POST /api/compliance/notify
 * Send email notifications for compliance issues
 * Roles: ADMIN, CONTROLLER, REVIEWER, COORDINATOR
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuth(request, { roles: ['ADMIN', 'CONTROLLER', 'REVIEWER', 'COORDINATOR'] });
    if (error) return error;

    const { documentId, complianceStatus, recipients } = await request.json();

    if (!documentId || !complianceStatus || !recipients || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId, complianceStatus, recipients' },
        { status: 400 }
      );
    }

    const nonCompliantChecks = complianceStatus.checks.filter(
      (check: any) => check.status === 'NON_COMPLIANT' || check.status === 'NEEDS_REVIEW'
    );

    if (nonCompliantChecks.length === 0) {
      return NextResponse.json({ 
        message: 'No compliance issues found. No notifications sent.',
        sent: false 
      });
    }

    const emailSubject = `Compliance Alert: ${nonCompliantChecks.length} Issue(s) Found`;
    const emailBody = `
      <h2>Compliance Alert</h2>
      <p>The following compliance issues were detected:</p>
      <ul>
        ${nonCompliantChecks.map((check: any) => `
          <li>
            <strong>${check.policyName}</strong>: ${check.requirement}<br>
            Status: ${check.status}<br>
            Score: ${(check.score * 100).toFixed(1)}%
            ${check.gaps && check.gaps.length > 0 ? `<br>Gaps: ${check.gaps.join(', ')}` : ''}
          </li>
        `).join('')}
      </ul>
      <p>Overall Compliance Score: ${(complianceStatus.score * 100).toFixed(1)}%</p>
      <p>Please review and address these issues as soon as possible.</p>
    `;

    // Send emails to all recipients
    const emailResults = await Promise.allSettled(
      recipients.map((email: string) =>
        sendEmail({
          to: email,
          subject: emailSubject,
          html: emailBody,
        })
      )
    );

    const successful = emailResults.filter(r => r.status === 'fulfilled').length;
    const failed = emailResults.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      sent: successful > 0,
      recipients: {
        total: recipients.length,
        successful,
        failed,
      },
    });
  } catch (error: any) {
    console.error('Error sending compliance notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send notifications', details: error?.message },
      { status: 500 }
    );
  }
}
