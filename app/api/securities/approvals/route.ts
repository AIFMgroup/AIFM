import { NextRequest, NextResponse } from 'next/server';
import {
  createApproval,
  getApproval,
  updateApproval,
  submitApproval,
  approveApproval,
  rejectApproval,
  deleteApproval,
  listApprovalsByFund,
  listApprovalsByUser,
  listApprovalsByStatus,
  getAllPendingApprovals,
  getApprovalSummary,
  searchApprovals,
  type SecurityApprovalRequest,
} from '@/lib/integrations/securities';

// Helper to check if error is DynamoDB table not found
function isDynamoDBError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('ResourceNotFoundException') ||
           error.message.includes('Table') ||
           error.name === 'ResourceNotFoundException';
  }
  return false;
}

// GET - List or get single approval
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const fundId = searchParams.get('fundId');
  const userEmail = searchParams.get('userEmail');
  const status = searchParams.get('status') as SecurityApprovalRequest['status'] | null;
  const pending = searchParams.get('pending');
  const summary = searchParams.get('summary');
  const search = searchParams.get('search');

  try {
    // Get single approval
    if (id) {
      const approval = await getApproval(id);
      if (!approval) {
        return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
      }
      return NextResponse.json(approval);
    }

    // Get summary for dashboard
    if (summary === 'true') {
      const summaryData = await getApprovalSummary();
      return NextResponse.json(summaryData);
    }

    // Get all pending for Operations
    if (pending === 'true') {
      const pendingApprovals = await getAllPendingApprovals();
      return NextResponse.json({ approvals: pendingApprovals });
    }

    // Search
    if (search) {
      const results = await searchApprovals(search);
      return NextResponse.json({ approvals: results });
    }

    // List by fund
    if (fundId) {
      const approvals = await listApprovalsByFund(fundId);
      return NextResponse.json({ approvals });
    }

    // List by user
    if (userEmail) {
      const approvals = await listApprovalsByUser(userEmail);
      return NextResponse.json({ approvals });
    }

    // List by status
    if (status) {
      const approvals = await listApprovalsByStatus(status);
      return NextResponse.json({ approvals });
    }

    // Default: return summary
    const summaryData = await getApprovalSummary();
    return NextResponse.json(summaryData);

  } catch (error) {
    console.error('Get approvals error:', error);
    
    // If DynamoDB table doesn't exist, return empty results
    if (isDynamoDBError(error)) {
      if (summary === 'true') {
        return NextResponse.json({
          totalPending: 0,
          totalApproved: 0,
          totalRejected: 0,
          recentApprovals: [],
          expiringApprovals: [],
        });
      }
      return NextResponse.json({ approvals: [] });
    }
    
    return NextResponse.json(
      { error: 'Failed to get approvals' },
      { status: 500 }
    );
  }
}

// POST - Create new approval
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.fundId || !data.fundName || !data.basicInfo) {
      return NextResponse.json(
        { error: 'Missing required fields: fundId, fundName, basicInfo' },
        { status: 400 }
      );
    }

    const approval = await createApproval(data);
    return NextResponse.json(approval, { status: 201 });

  } catch (error) {
    console.error('Create approval error:', error);
    
    // If DynamoDB table doesn't exist, return helpful error
    if (isDynamoDBError(error)) {
      return NextResponse.json(
        { error: 'Database not configured. Please contact administrator.' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create approval' },
      { status: 500 }
    );
  }
}

// PUT - Update approval
export async function PUT(request: NextRequest) {
  try {
    const { id, action, ...data } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Approval ID is required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'submit':
        result = await submitApproval(id);
        break;
      
      case 'approve':
        if (!data.reviewedBy || !data.reviewedByEmail) {
          return NextResponse.json(
            { error: 'Reviewer information required' },
            { status: 400 }
          );
        }
        result = await approveApproval(id, data.reviewedBy, data.reviewedByEmail, data.comments);
        break;
      
      case 'reject':
        if (!data.reviewedBy || !data.reviewedByEmail || !data.reason) {
          return NextResponse.json(
            { error: 'Reviewer information and rejection reason required' },
            { status: 400 }
          );
        }
        result = await rejectApproval(id, data.reviewedBy, data.reviewedByEmail, data.reason);
        break;
      
      default:
        // Regular update
        result = await updateApproval(id, data);
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Update approval error:', error);
    return NextResponse.json(
      { error: 'Failed to update approval' },
      { status: 500 }
    );
  }
}

// DELETE - Delete approval (only drafts)
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Approval ID is required' },
      { status: 400 }
    );
  }

  try {
    const deleted = await deleteApproval(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Approval not found or cannot be deleted (only drafts can be deleted)' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete approval error:', error);
    return NextResponse.json(
      { error: 'Failed to delete approval' },
      { status: 500 }
    );
  }
}
