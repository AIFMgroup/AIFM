import { NextRequest, NextResponse } from 'next/server';
import {
  createApproval,
  getApproval,
  updateApproval,
  submitApproval,
  approveApproval,
  rejectApproval,
  requestInfo,
  respondToInfoRequest,
  addComment,
  deleteApproval,
  listApprovalsByFund,
  listApprovalsByUser,
  listApprovalsByStatus,
  getAllPendingApprovals,
  getApprovalSummary,
  searchApprovals,
  type SecurityApprovalRequest,
} from '@/lib/integrations/securities';
import { createNotification } from '@/lib/notifications/notification-store';
import { notifyReviewersOnSubmission, notifySubmitterOnDecision } from '@/lib/integrations/securities/email-notifications';

const INTERNAL_ORIGIN = 'http://localhost:3000';

async function triggerAIReview(approvalId: string): Promise<void> {
  try {
    const url = `${INTERNAL_ORIGIN}/api/securities/ai-review`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aifm-role': 'operation',
      },
      body: JSON.stringify({ approvalId }),
    });
    if (res.ok) {
      console.log(`[Securities] Auto AI review triggered for ${approvalId}`);
    } else {
      console.warn(`[Securities] AI review returned ${res.status} for ${approvalId}`);
    }
  } catch (err) {
    console.error(`[Securities] AI review trigger failed for ${approvalId}:`, err);
  }
}

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
        if (result) {
          // Email reviewers (fire-and-forget)
          notifyReviewersOnSubmission(result).catch((err) =>
            console.error('[Securities] Failed to email reviewers:', err)
          );
          // In-app notification for reviewers
          const reviewerEmails = (process.env.SECURITIES_REVIEWER_EMAILS || 'christopher.genberg@aifm.se')
            .split(',').map((e: string) => e.trim()).filter(Boolean);
          for (const email of reviewerEmails) {
            createNotification({
              userEmail: email,
              type: 'approval_submitted',
              title: 'Ny värdepappersansökan',
              message: `${result.basicInfo?.name ?? 'Värdepapper'} för ${result.fundName} har skickats in av ${result.createdBy}.`,
              link: '/risk/review-securities',
              priority: 'high',
              metadata: {
                approvalId: result.id,
                securityName: result.basicInfo?.name ?? '',
                fundName: result.fundName ?? '',
              },
            }).catch((err) => console.error('[Securities] Notification failed:', err));
          }
          // Auto-trigger AI review (fire-and-forget)
          triggerAIReview(result.id).catch((err) =>
            console.error('[Securities] Auto AI review failed:', err)
          );
        }
        break;
      
      case 'approve': {
        if (!data.reviewedBy || !data.reviewedByEmail) {
          return NextResponse.json(
            { error: 'Reviewer information required' },
            { status: 400 }
          );
        }
        result = await approveApproval(id, data.reviewedBy, data.reviewedByEmail, data.comments);
        if (result?.createdByEmail) {
          try {
            await createNotification({
              userEmail: result.createdByEmail,
              type: 'approval_completed',
              title: 'Värdepapper godkänt',
              message: `${result.basicInfo?.name ?? 'Värdepapper'} för ${result.fundName} har godkänts av ${result.reviewedBy}.`,
              link: '/securities/approved',
              priority: 'medium',
              metadata: {
                approvalId: result.id,
                securityName: result.basicInfo?.name ?? '',
                fundName: result.fundName ?? '',
                reviewedBy: result.reviewedBy ?? '',
              },
            });
          } catch (err) {
            console.error('Failed to create approval_completed notification:', err);
          }
          notifySubmitterOnDecision(result, 'approved').catch((err) =>
            console.error('[Securities] Approval email failed:', err)
          );
        }
        break;
      }

      case 'reject': {
        if (!data.reviewedBy || !data.reviewedByEmail || !data.reason) {
          return NextResponse.json(
            { error: 'Reviewer information and rejection reason required' },
            { status: 400 }
          );
        }
        result = await rejectApproval(id, data.reviewedBy, data.reviewedByEmail, data.reason);
        if (result?.createdByEmail) {
          try {
            await createNotification({
              userEmail: result.createdByEmail,
              type: 'approval_rejected',
              title: 'Värdepappersansökan avvisad',
              message: `${result.basicInfo?.name ?? 'Ansökan'} för ${result.fundName} har avvisats av ${result.reviewedBy}.`,
              link: '/securities?filter=rejected',
              priority: 'high',
              metadata: {
                approvalId: result.id,
                securityName: result.basicInfo?.name ?? '',
                fundName: result.fundName ?? '',
                reviewedBy: result.reviewedBy ?? '',
              },
            });
          } catch (err) {
            console.error('Failed to create approval_rejected notification:', err);
          }
          notifySubmitterOnDecision(result, 'rejected').catch((err) =>
            console.error('[Securities] Rejection email failed:', err)
          );
        }
        break;
      }

      case 'request_info': {
        if (!data.reviewedBy || !data.reviewedByEmail || !data.question?.trim()) {
          return NextResponse.json(
            { error: 'Reviewer information and question required' },
            { status: 400 }
          );
        }
        result = await requestInfo(id, data.reviewedBy, data.reviewedByEmail, data.question.trim());
        if (result?.createdByEmail) {
          try {
            await createNotification({
              userEmail: result.createdByEmail,
              type: 'info_requested',
              title: 'Komplettering begärd',
              message: `${result.basicInfo?.name ?? 'Ansökan'} för ${result.fundName}: Operations begär mer information.`,
              link: '/securities',
              priority: 'high',
              metadata: {
                approvalId: result.id,
                securityName: result.basicInfo?.name ?? '',
                fundName: result.fundName ?? '',
              },
            });
          } catch (err) {
            console.error('Failed to create info_requested notification:', err);
          }
        }
        break;
      }

      case 'respond_info': {
        if (!data.response?.trim()) {
          return NextResponse.json(
            { error: 'Response text required' },
            { status: 400 }
          );
        }
        const existing = await getApproval(id);
        if (!existing || existing.status !== 'needs_info') {
          return NextResponse.json(
            { error: 'Approval not in needs_info state' },
            { status: 400 }
          );
        }
        result = await respondToInfoRequest(id, data.response.trim());
        if (result?.reviewedByEmail) {
          try {
            await createNotification({
              userEmail: result.reviewedByEmail,
              type: 'info_responded',
              title: 'Svar på kompletteringsbegäran',
              message: `${result.basicInfo?.name ?? 'Ansökan'} – förvaltare har lämnat svar och ansökan är åter inskickad.`,
              link: '/risk/review-securities',
              priority: 'medium',
              metadata: {
                approvalId: result.id,
                securityName: result.basicInfo?.name ?? '',
                fundName: result.fundName ?? '',
              },
            });
          } catch (err) {
            console.error('Failed to create info_responded notification:', err);
          }
        }
        break;
      }

      case 'add_comment': {
        if (!data.author?.trim() || !data.authorEmail?.trim() || !data.role || !data.message?.trim()) {
          return NextResponse.json(
            { error: 'Author, authorEmail, role and message required' },
            { status: 400 }
          );
        }
        const role = data.role as 'forvaltare' | 'operation';
        if (role !== 'forvaltare' && role !== 'operation') {
          return NextResponse.json({ error: 'Role must be forvaltare or operation' }, { status: 400 });
        }
        result = await addComment(id, data.author.trim(), data.authorEmail.trim(), role, data.message.trim());
        if (result) {
          const notifyEmail = role === 'forvaltare' ? result.reviewedByEmail : result.createdByEmail;
          if (notifyEmail) {
            try {
              await createNotification({
                userEmail: notifyEmail,
                type: 'approval_comment',
                title: 'Ny kommentar på ansökan',
                message: `${result.basicInfo?.name ?? 'Ansökan'} – ${data.author} har lagt till en kommentar.`,
                link: '/securities',
                priority: 'medium',
                metadata: {
                  approvalId: result.id,
                  securityName: result.basicInfo?.name ?? '',
                },
              });
            } catch (err) {
              console.error('Failed to create approval_comment notification:', err);
            }
          }
        }
        break;
      }

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
