/**
 * Cron endpoint: scan approved securities with expiresAt within 30 days
 * and create notifications for the assigned forvaltare (createdByEmail).
 * Deduplicates by checking existing security_expiring notifications for the same approvalId.
 * Call with: GET /api/securities/expiry-check
 * Header: x-aifm-cron-secret: <AIFM_CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { listApprovalsByStatus } from '@/lib/integrations/securities';
import { createNotification, getNotificationsForUser } from '@/lib/notifications/notification-store';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const secret = process.env.AIFM_CRON_SECRET;
  const header = request.headers.get('x-aifm-cron-secret');
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const approved = await listApprovalsByStatus('approved');
    const now = Date.now();
    const inThirtyDays = now + THIRTY_DAYS_MS;

    const expiring = approved.filter((a) => {
      if (!a.expiresAt) return false;
      const exp = new Date(a.expiresAt).getTime();
      return exp > now && exp <= inThirtyDays;
    });

    // Group by user email to batch notification lookups
    const byEmail = new Map<string, typeof expiring>();
    for (const a of expiring) {
      const list = byEmail.get(a.createdByEmail) ?? [];
      list.push(a);
      byEmail.set(a.createdByEmail, list);
    }

    let created = 0;
    for (const [email, approvals] of byEmail) {
      const existing = await getNotificationsForUser(email, 100);
      const existingApprovalIds = new Set(
        (existing || [])
          .filter((n) => n.type === 'security_expiring' && n.metadata?.approvalId)
          .map((n) => n.metadata!.approvalId)
      );
      for (const a of approvals) {
        if (existingApprovalIds.has(a.id)) continue;
        try {
          await createNotification({
            userEmail: a.createdByEmail,
            type: 'security_expiring',
            title: 'Värdepappersgodkännande utgår snart',
            message: `${a.basicInfo?.name || a.id} (${a.fundName}) utgår ${a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('sv-SE') : ''}. Överväg att förnya.`,
            link: '/securities/approved',
            priority: 'high',
            metadata: {
              approvalId: a.id,
              expiresAt: a.expiresAt ?? '',
              securityName: a.basicInfo?.name ?? '',
              fundName: a.fundName ?? '',
            },
          });
          created++;
          existingApprovalIds.add(a.id);
        } catch (err) {
          console.error('Expiry notification create failed for', a.id, err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      expiringCount: expiring.length,
      notificationsCreated: created,
    });
  } catch (error) {
    console.error('Securities expiry-check error:', error);
    return NextResponse.json(
      { error: 'Failed to run expiry check' },
      { status: 500 }
    );
  }
}
