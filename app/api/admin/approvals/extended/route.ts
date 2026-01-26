/**
 * API Routes for Extended Approval Service
 * 
 * Endpoints:
 * - GET /api/admin/approvals/extended - List approval requests
 * - POST /api/admin/approvals/extended - Create approval request
 * - POST /api/admin/approvals/extended/vote - Vote on request
 */

import { NextRequest, NextResponse } from 'next/server';
import { extendedApprovalService } from '@/lib/workflows/extendedApprovalService';

// ============================================================================
// GET - List Requests or Get Policies
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'requests';
    const tenantId = searchParams.get('tenantId') || 'default';
    const companyId = searchParams.get('companyId');
    const domain = searchParams.get('domain');
    const requestType = searchParams.get('requestType');
    const approverId = searchParams.get('approverId');

    if (type === 'policies') {
      const policies = domain 
        ? extendedApprovalService.getPoliciesByDomain(domain as any)
        : extendedApprovalService.getAllPolicies();
      return NextResponse.json({ policies });
    }

    if (type === 'requests') {
      const requests = await extendedApprovalService.getPendingRequests({
        tenantId,
        companyId: companyId || undefined,
        domain: domain as any,
        type: requestType as any,
        approverId: approverId || undefined,
        approverRole: role,
      });
      return NextResponse.json({ requests });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('[API] Extended Approvals GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Request or Vote
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    const userId = request.headers.get('x-aifm-user-id') || 'unknown';
    const userName = request.headers.get('x-aifm-user-name') || 'Unknown User';
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    if (!role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action = 'create' } = body;

    if (action === 'create') {
      const {
        tenantId = 'default',
        companyId,
        type,
        title,
        description,
        data = {},
        changePreview,
        requestComment,
      } = body;

      if (!companyId || !type || !title) {
        return NextResponse.json(
          { error: 'Missing required fields: companyId, type, title' },
          { status: 400 }
        );
      }

      const approvalRequest = await extendedApprovalService.createRequest({
        tenantId,
        companyId,
        type,
        title,
        description: description || '',
        data,
        changePreview,
        requestedBy: userId,
        requestedByName: userName,
        requestedByRole: role,
        requestComment,
        ipAddress: ipAddress as string,
      });

      return NextResponse.json({ request: approvalRequest }, { status: 201 });
    }

    if (action === 'vote') {
      const {
        tenantId = 'default',
        requestId,
        decision,
        comment,
      } = body;

      if (!requestId || !decision || !['APPROVE', 'REJECT'].includes(decision)) {
        return NextResponse.json(
          { error: 'Missing required fields: requestId, decision (APPROVE/REJECT)' },
          { status: 400 }
        );
      }

      const updatedRequest = await extendedApprovalService.vote({
        tenantId,
        requestId,
        userId,
        userName,
        userRole: role,
        decision,
        comment,
        ipAddress: ipAddress as string,
      });

      return NextResponse.json({ request: updatedRequest });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API] Extended Approvals POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process approval request' },
      { status: 500 }
    );
  }
}


