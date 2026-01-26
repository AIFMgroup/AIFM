/**
 * API Routes for Automation Engine
 * 
 * Endpoints:
 * - GET /api/admin/automation - List automation rules
 * - POST /api/admin/automation - Create new rule or emit event
 * - GET /api/admin/automation/executions - List executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/workflows/automationEngine';

// ============================================================================
// GET - List Rules or Executions
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    if (!role || !['admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'rules';
    const tenantId = searchParams.get('tenantId') || 'default';
    const companyId = searchParams.get('companyId');

    if (type === 'rules') {
      const rules = await automationEngine.getRules(tenantId, companyId || undefined);
      return NextResponse.json({ rules });
    } else if (type === 'executions') {
      // Would fetch from DB - returning empty for now
      return NextResponse.json({ executions: [] });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('[API] Automation GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation data' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Emit Event or Create Rule
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const role = request.headers.get('x-aifm-role');
    
    const body = await request.json();
    const { action = 'emit' } = body;

    if (action === 'emit') {
      // Allow any authenticated user to emit events
      if (!role) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { tenantId = 'default', companyId, type, source, data, correlationId } = body;

      if (!companyId || !type || !source) {
        return NextResponse.json(
          { error: 'Missing required fields: companyId, type, source' },
          { status: 400 }
        );
      }

      const executions = await automationEngine.emit({
        tenantId,
        companyId,
        type,
        source,
        data: data || {},
        correlationId,
      });

      return NextResponse.json({ 
        success: true, 
        executionsTriggered: executions.length,
        executions: executions.map(e => ({
          id: e.id,
          ruleId: e.ruleId,
          status: e.status,
        })),
      });
    } else if (action === 'create_rule') {
      // Only admins can create rules
      if (!role || role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 401 });
      }

      // Would create custom rule in DB
      return NextResponse.json({ 
        error: 'Custom rule creation not implemented - use default rules',
      }, { status: 501 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API] Automation POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process automation request' },
      { status: 500 }
    );
  }
}


