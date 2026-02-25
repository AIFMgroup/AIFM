/**
 * NAV Approvals API
 *
 * Hanterar NAV-godkännanden med 4-ögon-principen.
 * Använder DynamoDB när NAV_APPROVALS_TABLE är satt; annars mock för demo.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getNAVApprovalStore,
  getNAVRecordStore,
  NAVApproval,
} from '@/lib/nav-engine/nav-store';
import { triggerDistributionAfterApproval } from '@/lib/nav-engine/distribution';

const USE_DYNAMODB = !!process.env.NAV_APPROVALS_TABLE;

// Mock data only when DynamoDB is not configured
const MOCK_PENDING_APPROVAL: NAVApproval = {
  approvalId: 'APR-2026-02-04-001',
  navDate: new Date().toISOString().split('T')[0],
  fundIds: ['f1', 'f2', 'f3', 'f4'],
  status: 'PENDING_FIRST',
  navSummary: [
    { fundId: 'f1', shareClassId: 'sc1a', navPerShare: 142.42, navChange: 0.57 },
    { fundId: 'f1', shareClassId: 'sc1b', navPerShare: 14.65, navChange: 0.07 },
    { fundId: 'f2', shareClassId: 'sc2a', navPerShare: 208.71, navChange: 1.26 },
    { fundId: 'f3', shareClassId: 'sc3a', navPerShare: 198.87, navChange: 0.95 },
    { fundId: 'f4', shareClassId: 'sc4a', navPerShare: 378.33, navChange: 2.44 },
  ],
  runId: 'NAV-2026-02-04-mock',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
let mockApprovals: NAVApproval[] = [MOCK_PENDING_APPROVAL];

// ============================================================================
// GET - Hämta godkännanden
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const approvalId = searchParams.get('id');
    const status = searchParams.get('status');
    const navDate = searchParams.get('date');

    let approvals: NAVApproval[] = [];
    let source: 'database' | 'mock' = 'mock';

    if (USE_DYNAMODB) {
      const approvalStore = getNAVApprovalStore();
      try {
        if (approvalId) {
          const approval = await approvalStore.getApproval(approvalId);
          if (approval) {
            approvals = [approval];
            source = 'database';
          }
        } else {
          const pending = await approvalStore.getPendingApprovals();
          if (status) {
            approvals = pending.filter((a) => a.status === status);
          } else if (navDate) {
            approvals = pending.filter((a) => a.navDate === navDate);
          } else {
            approvals = pending;
          }
          if (approvals.length > 0) source = 'database';
        }
      } catch (dbError) {
        console.error('[NAV Approvals API] DynamoDB query failed:', dbError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch approvals from database' },
          { status: 500 }
        );
      }
    }

    if (approvals.length === 0 && !USE_DYNAMODB) {
      if (approvalId) approvals = mockApprovals.filter((a) => a.approvalId === approvalId);
      else if (status) approvals = mockApprovals.filter((a) => a.status === status);
      else if (navDate) approvals = mockApprovals.filter((a) => a.navDate === navDate);
      else approvals = mockApprovals.filter((a) => a.status === 'PENDING_FIRST' || a.status === 'PENDING_SECOND');
    }

    return NextResponse.json({
      success: true,
      data: approvals,
      meta: { source, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('[NAV Approvals API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Skapa nytt godkännande eller godkänn/avslå
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, approvalId, userId, userName, comment, reason } = body;

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    let result: NAVApproval | null = null;
    let source = 'mock';

    const approvalStore = getNAVApprovalStore();
    const navRecordStore = getNAVRecordStore();

    switch (action) {
      case 'create': {
        const { runId, navDate, navSummary } = body;
        if (!runId || !navDate || !navSummary) {
          return NextResponse.json(
            { success: false, error: 'runId, navDate, and navSummary are required' },
            { status: 400 }
          );
        }
        if (USE_DYNAMODB) {
          try {
            result = await approvalStore.createApproval(runId, navDate, navSummary as Parameters<typeof approvalStore.createApproval>[2]);
            source = 'database';
          } catch (err) {
            console.error('[NAV Approvals API] create failed:', err);
            return NextResponse.json(
              { success: false, error: 'Failed to create approval' },
              { status: 500 }
            );
          }
        } else {
          const newApproval: NAVApproval = {
            approvalId: `APR-${navDate}-${Date.now()}`,
            navDate,
            fundIds: [...new Set(navSummary.map((n: { fundId: string }) => n.fundId))],
            status: 'PENDING_FIRST',
            navSummary,
            runId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          mockApprovals.push(newApproval);
          result = newApproval;
        }
        break;
      }

      case 'approve_first': {
        if (!approvalId || !userId || !userName) {
          return NextResponse.json(
            { success: false, error: 'approvalId, userId, and userName are required' },
            { status: 400 }
          );
        }
        if (USE_DYNAMODB) {
          try {
            result = await approvalStore.approveFirst(approvalId, userId, userName, comment);
            source = 'database';
          } catch (err) {
            console.error('[NAV Approvals API] approve_first failed:', err);
            return NextResponse.json(
              { success: false, error: 'Failed to record first approval' },
              { status: 500 }
            );
          }
        } else {
          const idx = mockApprovals.findIndex((a) => a.approvalId === approvalId);
          if (idx >= 0) {
            mockApprovals[idx] = {
              ...mockApprovals[idx],
              status: 'PENDING_SECOND',
              firstApprover: { userId, name: userName, approvedAt: new Date().toISOString(), comment },
              updatedAt: new Date().toISOString(),
            };
            result = mockApprovals[idx];
          }
        }
        break;
      }

      case 'approve_second': {
        if (!approvalId || !userId || !userName) {
          return NextResponse.json(
            { success: false, error: 'approvalId, userId, and userName are required' },
            { status: 400 }
          );
        }
        if (USE_DYNAMODB) {
          try {
            result = await approvalStore.approveSecond(approvalId, userId, userName, comment);
            source = 'database';
            if (result) {
              for (const nav of result.navSummary) {
                try {
                  await navRecordStore.updateNAVStatus(
                    nav.fundId,
                    nav.shareClassId,
                    result.navDate,
                    'APPROVED',
                    {
                      approvalId: result.approvalId,
                      approvedBy: [
                        result.firstApprover?.userId || '',
                        result.secondApprover?.userId || '',
                      ].filter(Boolean),
                      approvedAt: new Date().toISOString(),
                    }
                  );
                } catch (updateError) {
                  console.warn('[NAV Approvals API] Failed to update NAV record status:', updateError);
                }
              }
              await triggerDistributionAfterApproval(result);
            }
          } catch (err) {
            console.error('[NAV Approvals API] approve_second failed:', err);
            return NextResponse.json(
              { success: false, error: 'Failed to record second approval' },
              { status: 500 }
            );
          }
        } else {
          const idx = mockApprovals.findIndex((a) => a.approvalId === approvalId);
          if (idx >= 0) {
            mockApprovals[idx] = {
              ...mockApprovals[idx],
              status: 'APPROVED',
              secondApprover: { userId, name: userName, approvedAt: new Date().toISOString(), comment },
              updatedAt: new Date().toISOString(),
            };
            result = mockApprovals[idx];
          }
        }
        break;
      }

      case 'reject': {
        if (!approvalId || !userId || !userName || !reason) {
          return NextResponse.json(
            { success: false, error: 'approvalId, userId, userName, and reason are required' },
            { status: 400 }
          );
        }
        if (USE_DYNAMODB) {
          try {
            result = await approvalStore.reject(approvalId, userId, userName, reason);
            source = 'database';
          } catch (err) {
            console.error('[NAV Approvals API] reject failed:', err);
            return NextResponse.json(
              { success: false, error: 'Failed to record rejection' },
              { status: 500 }
            );
          }
        } else {
          const idx = mockApprovals.findIndex((a) => a.approvalId === approvalId);
          if (idx >= 0) {
            mockApprovals[idx] = {
              ...mockApprovals[idx],
              status: 'REJECTED',
              rejectedBy: { userId, name: userName, rejectedAt: new Date().toISOString(), reason },
              updatedAt: new Date().toISOString(),
            };
            result = mockApprovals[idx];
          }
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Approval not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        source,
        action,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[NAV Approvals API] POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process approval',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
