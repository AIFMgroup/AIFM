/**
 * API Routes for Bulk Operations Service
 * 
 * Endpoints:
 * - GET /api/admin/bulk - List bulk operations
 * - POST /api/admin/bulk - Create a new bulk operation
 * - GET /api/admin/bulk/templates - Get templates
 * - GET /api/admin/bulk/comments - Get standard comments
 * - GET /api/admin/bulk/recurring - Get recurring jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { bulkOperationsService } from '@/lib/workflows/bulkOperationsService';

// ============================================================================
// GET - List Operations, Templates, Comments, or Recurring Jobs
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role || !['admin', 'manager', 'accountant'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'operations';
    const tenantId = searchParams.get('tenantId') || 'default';
    const companyId = searchParams.get('companyId');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const action = searchParams.get('action');

    switch (type) {
      case 'operations': {
        const operations = await bulkOperationsService.getOperations({
          tenantId,
          companyId: companyId || undefined,
          status: status as any,
        });
        return NextResponse.json({ operations });
      }

      case 'templates': {
        const templates = await bulkOperationsService.getTemplates({
          tenantId,
          companyId: companyId || undefined,
          category: category as any,
        });
        return NextResponse.json({ templates });
      }

      case 'comments': {
        const comments = await bulkOperationsService.getStandardComments({
          tenantId,
          companyId: companyId || undefined,
          category: category || undefined,
          action: action || undefined,
        });
        return NextResponse.json({ comments });
      }

      case 'recurring': {
        const jobs = await bulkOperationsService.getRecurringJobs({
          tenantId,
          companyId: companyId || undefined,
        });
        return NextResponse.json({ jobs });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: operations, templates, comments, or recurring' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Bulk GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bulk data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create New Operation, Template, Comment, or Recurring Job
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    const userId = request.headers.get('x-aifm-user-id') || 'unknown';
    const userName = request.headers.get('x-aifm-user-name') || 'Unknown User';

    if (!role || !['admin', 'manager', 'accountant'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type = 'operation' } = body;

    switch (type) {
      case 'operation': {
        const {
          tenantId = 'default',
          companyId,
          actionType,
          name,
          description,
          targetType = 'document',
          targetIds,
          action,
          scheduledFor,
          requiresApproval,
        } = body;

        if (!companyId || !actionType || !name || !targetIds || targetIds.length === 0) {
          return NextResponse.json(
            { error: 'Missing required fields: companyId, actionType, name, targetIds' },
            { status: 400 }
          );
        }

        const operation = await bulkOperationsService.createBulkOperation({
          tenantId,
          companyId,
          type: actionType,
          name,
          description,
          targetType,
          targetIds,
          action: action || {},
          createdBy: userId,
          createdByName: userName,
          scheduledFor,
          requiresApproval,
        });

        // If not requiring approval and not scheduled, execute immediately
        if (!operation.requiresApproval && !operation.scheduledFor) {
          const executedOperation = await bulkOperationsService.executeBulkOperation(operation);
          return NextResponse.json({ operation: executedOperation }, { status: 201 });
        }

        return NextResponse.json({ operation }, { status: 201 });
      }

      case 'template': {
        const {
          tenantId = 'default',
          companyId,
          category,
          name,
          description,
          content,
          variables = [],
          tags = [],
          isPublic = true,
        } = body;

        if (!category || !name || !content) {
          return NextResponse.json(
            { error: 'Missing required fields: category, name, content' },
            { status: 400 }
          );
        }

        const template = await bulkOperationsService.saveTemplate({
          id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenantId,
          companyId,
          category,
          name,
          description: description || '',
          content,
          variables,
          tags,
          isDefault: false,
          isPublic,
          usageCount: 0,
          createdBy: userId,
        });

        return NextResponse.json({ template }, { status: 201 });
      }

      case 'recurring': {
        const {
          tenantId = 'default',
          companyId,
          name,
          description,
          actionType,
          action,
          selectionCriteria,
          schedule,
          notifyOnComplete = true,
          notifyOnFailure = true,
          notifyRecipients = [],
        } = body;

        if (!companyId || !name || !actionType || !schedule) {
          return NextResponse.json(
            { error: 'Missing required fields: companyId, name, actionType, schedule' },
            { status: 400 }
          );
        }

        const job = await bulkOperationsService.createRecurringJob({
          tenantId,
          companyId,
          name,
          description: description || '',
          actionType,
          action: action || {},
          selectionCriteria: selectionCriteria || { type: 'query', query: {} },
          schedule,
          notifyOnComplete,
          notifyOnFailure,
          notifyRecipients,
          createdBy: userId,
        });

        return NextResponse.json({ job }, { status: 201 });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: operation, template, or recurring' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Bulk POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create bulk item' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Operation Status / Execute
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role || !['admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      tenantId = 'default',
      operationId,
      action, // 'approve' | 'reject' | 'execute' | 'cancel'
    } = body;

    if (!operationId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: operationId, action' },
        { status: 400 }
      );
    }

    const operation = await bulkOperationsService.getOperation(tenantId, operationId);
    if (!operation) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'approve': {
        if (operation.status !== 'PENDING_APPROVAL') {
          return NextResponse.json(
            { error: 'Operation is not pending approval' },
            { status: 400 }
          );
        }
        operation.status = 'PENDING';
        await bulkOperationsService.updateOperation(operation);
        // Execute immediately
        const executedOperation = await bulkOperationsService.executeBulkOperation(operation);
        return NextResponse.json({ operation: executedOperation });
      }

      case 'reject': {
        if (operation.status !== 'PENDING_APPROVAL') {
          return NextResponse.json(
            { error: 'Operation is not pending approval' },
            { status: 400 }
          );
        }
        operation.status = 'CANCELLED';
        operation.completedAt = new Date().toISOString();
        await bulkOperationsService.updateOperation(operation);
        return NextResponse.json({ operation });
      }

      case 'execute': {
        if (operation.status !== 'PENDING') {
          return NextResponse.json(
            { error: 'Operation cannot be executed (not in PENDING status)' },
            { status: 400 }
          );
        }
        const executedOperation = await bulkOperationsService.executeBulkOperation(operation);
        return NextResponse.json({ operation: executedOperation });
      }

      case 'cancel': {
        if (!['PENDING', 'PENDING_APPROVAL'].includes(operation.status)) {
          return NextResponse.json(
            { error: 'Operation cannot be cancelled' },
            { status: 400 }
          );
        }
        operation.status = 'CANCELLED';
        operation.completedAt = new Date().toISOString();
        await bulkOperationsService.updateOperation(operation);
        return NextResponse.json({ operation });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: approve, reject, execute, or cancel' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Bulk PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update operation' },
      { status: 500 }
    );
  }
}


