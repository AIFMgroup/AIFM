/**
 * Approval Workflow API
 * 
 * Hanterar godkännandeflöden
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
  escalateRequest,
  delegateRequest,
  getApprovalStats,
  checkOverdueApprovals,
  autoEscalateOverdue,
  getApprovalConfig,
  saveApprovalConfig,
} from '@/lib/accounting/services/approvalWorkflow';
import { recordApproval } from '@/lib/accounting/services/autoApprovalEngine';
import { jobStore } from '@/lib/accounting/jobStore';
import { assertCan, getRoleFromRequest } from '@/lib/accounting/authz';
import { getSession } from '@/lib/auth/session';

// GET - Hämta väntande godkännanden och statistik
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');
  const action = searchParams.get('action');
  // Role is derived by middleware from a verified token (Cognito groups).
  // Do NOT trust client-provided query params for authorization.
  const role = getRoleFromRequest(request);

  if (!companyId) {
    return NextResponse.json({ error: 'companyId krävs' }, { status: 400 });
  }

  try {
    if (action === 'pending') {
      const pending = await getPendingApprovals(companyId, role);
      return NextResponse.json({ pending, count: pending.length });
    }

    if (action === 'stats') {
      const stats = await getApprovalStats(companyId);
      return NextResponse.json({ stats });
    }

    if (action === 'overdue') {
      const overdue = await checkOverdueApprovals(companyId);
      return NextResponse.json({ overdue, count: overdue.length });
    }

    if (action === 'config') {
      const config = await getApprovalConfig(companyId);
      return NextResponse.json({ config });
    }

    // Default: returnera sammanfattning
    const [pending, stats, overdue] = await Promise.all([
      getPendingApprovals(companyId, role),
      getApprovalStats(companyId),
      checkOverdueApprovals(companyId),
    ]);

    return NextResponse.json({
      pending,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      stats,
    });

  } catch (error) {
    console.error('[Approval API] GET Error:', error);
    return NextResponse.json(
      { error: 'Kunde inte hämta godkännanden' },
      { status: 500 }
    );
  }
}

// POST - Utför godkännandeaction
export async function POST(request: NextRequest) {
  try {
    const role = getRoleFromRequest(request);
    const session = await getSession().catch(() => null);
    const actor = {
      userId: session?.email || 'unknown',
      userName: session?.name || session?.email || 'Unknown',
      userRole: role,
    };
    const body = await request.json();
    const { companyId, requestId, action, comment, delegateTo, delegateToName, reason } = body;

    if (!companyId || !action) {
      return NextResponse.json(
        { error: 'companyId och action krävs' },
        { status: 400 }
      );
    }

    // Auto-eskalering
    if (action === 'auto-escalate') {
      const count = await autoEscalateOverdue(companyId);
      return NextResponse.json({
        success: true,
        message: `${count} begäran(n) eskalerades automatiskt`,
        escalatedCount: count,
      });
    }

    // Uppdatera konfiguration
    if (action === 'update-config') {
      const { config } = body;
      if (!config) {
        return NextResponse.json({ error: 'config krävs' }, { status: 400 });
      }
      await saveApprovalConfig({ ...config, companyId });
      return NextResponse.json({ success: true, message: 'Konfiguration uppdaterad' });
    }

    // Resterande actions kräver requestId
    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId krävs för denna action' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'approve':
        assertCan(role, 'APPROVE_REQUEST');
        result = await approveRequest(companyId, requestId, actor, comment);
        
        // Om godkänt, uppdatera jobbet och registrera för lärande
        if (result.success && result.request?.currentStatus === 'APPROVED') {
          const job = await jobStore.get(result.request.jobId);
          if (job) {
            await jobStore.update(result.request.jobId, {
              status: 'approved',
              approvedBy: actor.userId,
              approvedAt: new Date().toISOString(),
            });

            if (job.classification) {
              await recordApproval(companyId, {
                id: job.id,
                classification: job.classification,
              }, false);
            }
          }
        }
        break;

      case 'reject':
        assertCan(role, 'APPROVE_REQUEST');
        result = await rejectRequest(companyId, requestId, actor, reason || 'Avvisad utan angiven anledning');
        break;

      case 'escalate':
        result = await escalateRequest(companyId, requestId, actor, 'next-level', reason);
        break;

      case 'delegate':
        if (!delegateTo || !delegateToName) {
          return NextResponse.json(
            { error: 'delegateTo och delegateToName krävs' },
            { status: 400 }
          );
        }
        result = await delegateRequest(companyId, requestId, actor, delegateTo, delegateToName, reason);
        break;

      default:
        return NextResponse.json(
          { error: `Okänd action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Approval API] POST Error:', error);
    return NextResponse.json(
      { error: 'Action misslyckades', message: error instanceof Error ? error.message : 'Okänt fel' },
      { status: 500 }
    );
  }
}
