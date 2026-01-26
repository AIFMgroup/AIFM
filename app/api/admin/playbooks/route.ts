/**
 * API Routes for Playbook Service
 * 
 * Endpoints:
 * - GET /api/admin/playbooks - List playbook templates and instances
 * - POST /api/admin/playbooks - Create a new playbook instance
 * - GET /api/admin/playbooks/[id] - Get playbook details
 * - PATCH /api/admin/playbooks/[id] - Update playbook step status
 */

import { NextRequest, NextResponse } from 'next/server';
import { playbookService } from '@/lib/workflows/playbookService';

// ============================================================================
// GET - List Templates and Instances
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role || !['admin', 'manager', 'accountant'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'templates'; // 'templates' | 'instances'
    const tenantId = searchParams.get('tenantId') || 'default';
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');

    if (type === 'templates') {
      const templates = await playbookService.getTemplates(
        category as any
      );
      return NextResponse.json({ templates });
    } else {
      const instances = await playbookService.getInstances({
        tenantId,
        companyId: companyId || undefined,
        status: status as any,
        category: category as any,
      });
      return NextResponse.json({ instances });
    }
  } catch (error) {
    console.error('[API] Playbooks GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch playbooks' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create New Instance
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role || !['admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      templateId,
      tenantId = 'default',
      companyId,
      fundId,
      ownerId,
      ownerName,
      startDate,
      dueDate,
      context,
    } = body;

    if (!templateId || !companyId || !ownerId || !ownerName) {
      return NextResponse.json(
        { error: 'Missing required fields: templateId, companyId, ownerId, ownerName' },
        { status: 400 }
      );
    }

    const instance = await playbookService.createInstance({
      templateId,
      tenantId,
      companyId,
      fundId,
      ownerId,
      ownerName,
      startDate,
      dueDate,
      context,
      createdBy: ownerId,
    });

    return NextResponse.json({ instance }, { status: 201 });
  } catch (error) {
    console.error('[API] Playbooks POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create playbook instance' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Step Status
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      tenantId = 'default',
      instanceId,
      stepId,
      action, // 'update_status' | 'approve'
      status,
      completionComment,
      actualMinutes,
      approved,
      comment,
      userId,
      userName,
    } = body;

    if (!instanceId || !stepId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: instanceId, stepId, action' },
        { status: 400 }
      );
    }

    let updatedInstance;

    if (action === 'update_status') {
      if (!status || !userId) {
        return NextResponse.json(
          { error: 'Missing required fields for status update: status, userId' },
          { status: 400 }
        );
      }

      updatedInstance = await playbookService.updateStepStatus({
        tenantId,
        instanceId,
        stepId,
        status,
        completionComment,
        actualMinutes,
        userId,
      });
    } else if (action === 'approve') {
      if (approved === undefined || !userId || !userName) {
        return NextResponse.json(
          { error: 'Missing required fields for approval: approved, userId, userName' },
          { status: 400 }
        );
      }

      updatedInstance = await playbookService.approveStep({
        tenantId,
        instanceId,
        stepId,
        approved,
        comment,
        approverId: userId,
        approverName: userName,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "update_status" or "approve"' },
        { status: 400 }
      );
    }

    if (!updatedInstance) {
      return NextResponse.json(
        { error: 'Playbook instance not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ instance: updatedInstance });
  } catch (error) {
    console.error('[API] Playbooks PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update playbook' },
      { status: 500 }
    );
  }
}


