/**
 * NAV Approval API Routes
 * 
 * Endpoints för att godkänna NAV-värden med 4-ögon-princip
 */

import { NextRequest, NextResponse } from 'next/server';
import { navApprovalService, NAVApprovalVote } from '@/lib/integrations/secura/nav-approval';

// Default config - should be loaded from database per tenant
const DEFAULT_CONFIG = {
  tenantId: 'default',
  companyId: 'default',
  requireFourEyes: true,
  autoApproveThreshold: undefined,
  approverRoles: ['fund_accountant', 'manager', 'admin'],
  autoDistributeOnApproval: true,
  distributionDelay: 0,
};

/**
 * GET /api/nav-automation/approvals
 * 
 * Hämta väntande godkännanden eller historik
 * 
 * Query params:
 * - type: 'pending' | 'history' | 'today'
 * - companyId: string
 * - limit: number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'pending';
    const companyId = searchParams.get('companyId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '30');
    const tenantId = request.headers.get('x-tenant-id') || 'default';

    switch (type) {
      case 'pending':
        const pending = await navApprovalService.getPendingApprovals(tenantId, companyId);
        return NextResponse.json({ approvals: pending });

      case 'history':
        const history = await navApprovalService.getApprovalHistory(tenantId, companyId, limit);
        return NextResponse.json({ approvals: history });

      case 'today':
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId required for today status' },
            { status: 400 }
          );
        }
        const status = await navApprovalService.getTodayStatus(tenantId, companyId);
        return NextResponse.json(status);

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('[NAV Approvals API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/nav-automation/approvals
 * 
 * Skapa nytt godkännande-request eller rösta
 * 
 * Body:
 * {
 *   "action": "create" | "vote" | "distribute",
 *   ...
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const userId = request.headers.get('x-user-id') || 'system';
    const userName = request.headers.get('x-user-name') || 'System';
    
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { companyId, navDate, funds } = body;
        
        if (!companyId || !navDate || !funds) {
          return NextResponse.json(
            { error: 'Missing required fields: companyId, navDate, funds' },
            { status: 400 }
          );
        }

        const approval = await navApprovalService.createApprovalRequest(
          tenantId,
          companyId,
          navDate,
          funds,
          userId
        );

        return NextResponse.json({
          success: true,
          approval,
          message: 'NAV-data skapat för godkännande',
        });
      }

      case 'vote': {
        const { requestId, voteAction, comment, reason } = body;
        
        if (!requestId || !voteAction) {
          return NextResponse.json(
            { error: 'Missing required fields: requestId, voteAction' },
            { status: 400 }
          );
        }

        const vote: NAVApprovalVote = {
          requestId,
          userId,
          userName,
          action: voteAction,
          comment,
          reason,
        };

        const approval = await navApprovalService.vote(tenantId, vote, DEFAULT_CONFIG);

        // If approved and auto-distribute is enabled, trigger distribution
        if (approval.status === 'APPROVED' && DEFAULT_CONFIG.autoDistributeOnApproval) {
          // Start distribution (async)
          navApprovalService.startDistribution(tenantId, requestId).catch(err => {
            console.error('[NAV Approvals] Distribution start failed:', err);
          });
        }

        return NextResponse.json({
          success: true,
          approval,
          message: voteAction === 'APPROVE' 
            ? (approval.status === 'APPROVED' 
              ? 'NAV godkänt - distribution startar' 
              : 'Första godkännandet registrerat - väntar på andra godkännare')
            : 'NAV avvisat',
        });
      }

      case 'distribute': {
        const { requestId } = body;
        
        if (!requestId) {
          return NextResponse.json(
            { error: 'Missing required field: requestId' },
            { status: 400 }
          );
        }

        const approval = await navApprovalService.startDistribution(tenantId, requestId);

        return NextResponse.json({
          success: true,
          approval,
          message: 'Distribution startad',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, vote, or distribute' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[NAV Approvals API] POST error:', error);
    return NextResponse.json(
      { 
        error: 'Operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
