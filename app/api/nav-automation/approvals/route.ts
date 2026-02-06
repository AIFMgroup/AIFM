/**
 * NAV Approval API Routes
 * 
 * Endpoints för att godkänna NAV-värden med 4-ögon-princip
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFundRegistry } from '@/lib/fund-registry';

// In-memory storage for approvals (in production, use database)
interface NAVApproval {
  id: string;
  tenantId: string;
  companyId: string;
  navDate: string;
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'APPROVED' | 'REJECTED';
  funds: Array<{
    fundId: string;
    fundName: string;
    nav: number;
    aum: number;
    currency: string;
  }>;
  votes: Array<{
    userId: string;
    userName: string;
    action: 'APPROVE' | 'REJECT';
    timestamp: string;
    comment?: string;
  }>;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

const approvalStore: Map<string, NAVApproval> = new Map();

// Initialize with demo data
function initDemoApprovals() {
  const today = new Date().toISOString().split('T')[0];
  const demoApproval: NAVApproval = {
    id: `nav_${Date.now()}`,
    tenantId: 'default',
    companyId: 'auag',
    navDate: today,
    status: 'PENDING_FIRST',
    funds: [
      { fundId: 'SE0013358181', fundName: 'AuAg Silver Bullet A', nav: 378.33, aum: 3400248947.80, currency: 'SEK' },
      { fundId: 'SE0020677946', fundName: 'AuAg Gold Rush A', nav: 208.71, aum: 505494096.59, currency: 'SEK' },
    ],
    votes: [],
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    updatedAt: new Date().toISOString(),
  };
  approvalStore.set(demoApproval.id, demoApproval);
}
initDemoApprovals();

/**
 * GET /api/nav-automation/approvals
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'pending';
    const tenantId = request.headers.get('x-tenant-id') || 'default';

    const approvals = Array.from(approvalStore.values())
      .filter(a => a.tenantId === tenantId);

    switch (type) {
      case 'pending':
        const pending = approvals.filter(a => 
          a.status === 'PENDING_FIRST' || a.status === 'PENDING_SECOND'
        );
        return NextResponse.json({ approvals: pending });

      case 'history':
        const history = approvals
          .filter(a => a.status === 'APPROVED' || a.status === 'REJECTED')
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return NextResponse.json({ approvals: history });

      case 'today': {
        const today = new Date().toISOString().split('T')[0];
        const todayApprovals = approvals.filter(a => a.navDate === today);
        return NextResponse.json({
          date: today,
          hasApprovalRequest: todayApprovals.length > 0,
          status: todayApprovals[0]?.status || 'NO_REQUEST',
          approvals: todayApprovals,
        });
      }

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
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const userId = request.headers.get('x-user-id') || 'user_1';
    const userName = request.headers.get('x-user-name') || 'Test User';
    
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { companyId, navDate } = body;
        
        if (!companyId || !navDate) {
          return NextResponse.json(
            { error: 'Missing required fields: companyId, navDate' },
            { status: 400 }
          );
        }

        // Get funds from registry
        const registry = getFundRegistry();
        const priceData = await registry.getPriceData(navDate);

        const approval: NAVApproval = {
          id: `nav_${Date.now()}`,
          tenantId,
          companyId,
          navDate,
          status: 'PENDING_FIRST',
          funds: priceData.map(p => ({
            fundId: p.fundId,
            fundName: p.fundName,
            nav: p.nav,
            aum: p.aum,
            currency: p.currency,
          })),
          votes: [],
          createdAt: new Date().toISOString(),
          createdBy: userId,
          updatedAt: new Date().toISOString(),
        };

        approvalStore.set(approval.id, approval);

        return NextResponse.json({
          success: true,
          approval,
          message: 'NAV-data skapat för godkännande',
        });
      }

      case 'vote': {
        const { requestId, voteAction, comment } = body;
        
        if (!requestId || !voteAction) {
          return NextResponse.json(
            { error: 'Missing required fields: requestId, voteAction' },
            { status: 400 }
          );
        }

        const approval = approvalStore.get(requestId);
        if (!approval) {
          return NextResponse.json(
            { error: 'Approval request not found' },
            { status: 404 }
          );
        }

        // Check if user already voted
        if (approval.votes.some(v => v.userId === userId)) {
          return NextResponse.json(
            { error: 'Du har redan röstat på denna förfrågan' },
            { status: 400 }
          );
        }

        // Add vote
        approval.votes.push({
          userId,
          userName,
          action: voteAction,
          timestamp: new Date().toISOString(),
          comment,
        });

        // Update status based on votes
        if (voteAction === 'REJECT') {
          approval.status = 'REJECTED';
        } else if (approval.votes.filter(v => v.action === 'APPROVE').length >= 2) {
          approval.status = 'APPROVED';
        } else if (approval.status === 'PENDING_FIRST') {
          approval.status = 'PENDING_SECOND';
        }

        approval.updatedAt = new Date().toISOString();
        approvalStore.set(requestId, approval);

        return NextResponse.json({
          success: true,
          approval,
          message: voteAction === 'APPROVE' 
            ? (approval.status === 'APPROVED' 
              ? 'NAV godkänt - distribution kan starta' 
              : 'Första godkännandet registrerat - väntar på andra godkännare')
            : 'NAV avvisat',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create or vote' },
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
