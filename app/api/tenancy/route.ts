/**
 * Tenancy API
 * 
 * Manages tenants, hierarchy, and access control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { 
  buildTenantContext, 
  createTenant, 
  getTenant,
  addUserToTenant,
  grantCompanyAccess,
  type TenantRole,
} from '@/lib/tenancy/tenantContext';
import { hierarchyService, type CompanyNode, type FundNode, type PortfolioNode } from '@/lib/tenancy/hierarchy';

// ============================================================================
// GET - Get tenant info, hierarchy, or specific node
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'info';
    const tenantId = searchParams.get('tenantId');
    const companyId = searchParams.get('companyId');
    const nodeId = searchParams.get('nodeId');

    // Build context
    const userId = request.headers.get('x-aifm-user') || session.email;
    const context = await buildTenantContext({
      userId,
      userEmail: session.email,
      tenantId: tenantId || undefined,
      companyId: companyId || undefined,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    if (!context) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    switch (type) {
      case 'info': {
        const tenant = await getTenant(context.tenantId);
        return NextResponse.json({
          tenant,
          context: {
            tenantId: context.tenantId,
            role: context.role,
            allowedCompanyIds: context.allowedCompanyIds,
            permissions: context.permissions,
          },
        });
      }

      case 'hierarchy': {
        const hierarchy = await hierarchyService.getHierarchy(context);
        return NextResponse.json({ hierarchy });
      }

      case 'companies': {
        const companies = await hierarchyService.getCompanies(context);
        return NextResponse.json({ companies });
      }

      case 'funds': {
        if (!companyId) {
          return NextResponse.json({ error: 'companyId required' }, { status: 400 });
        }
        const funds = await hierarchyService.getFunds(context, companyId);
        return NextResponse.json({ funds });
      }

      case 'portfolios': {
        const fundId = searchParams.get('fundId');
        if (!fundId) {
          return NextResponse.json({ error: 'fundId required' }, { status: 400 });
        }
        const portfolios = await hierarchyService.getPortfolios(context, fundId);
        return NextResponse.json({ portfolios });
      }

      case 'node': {
        if (!nodeId) {
          return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
        }
        const node = await hierarchyService.getNode(context, nodeId);
        if (!node) {
          return NextResponse.json({ error: 'Node not found' }, { status: 404 });
        }
        return NextResponse.json({ node });
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Tenancy API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create tenant, add user, grant access, or create hierarchy node
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    const userId = request.headers.get('x-aifm-user') || session.email;
    const tenantId = body.tenantId || request.headers.get('x-aifm-tenant');

    switch (action) {
      case 'create-tenant': {
        // Only system admins can create tenants
        const role = request.headers.get('x-aifm-role');
        if (role !== 'admin') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, orgNumber, plan } = body;
        if (!name) {
          return NextResponse.json({ error: 'Name required' }, { status: 400 });
        }

        const tenant = await createTenant({
          name,
          orgNumber,
          plan: plan || 'starter',
          adminUserId: userId,
          adminEmail: session.email,
          adminName: body.adminName || session.email,
        });

        return NextResponse.json({ success: true, tenant });
      }

      case 'add-user': {
        const context = await buildTenantContext({
          userId,
          userEmail: session.email,
          tenantId: tenantId || undefined,
        });

        if (!context || (context.role !== 'tenant_admin' && context.role !== 'tenant_manager')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { email, name, userRole, companyAccess } = body;
        if (!email) {
          return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        // Generate user ID for new user (would normally come from Cognito)
        const newUserId = `user-${Date.now()}`;

        const user = await addUserToTenant({
          tenantId: context.tenantId,
          userId: newUserId,
          email,
          name: name || email,
          role: (userRole || 'company_viewer') as TenantRole,
          companyAccess,
          invitedBy: userId,
        });

        return NextResponse.json({ success: true, user });
      }

      case 'grant-company-access': {
        const context = await buildTenantContext({
          userId,
          userEmail: session.email,
          tenantId: tenantId || undefined,
        });

        if (!context || (context.role !== 'tenant_admin' && context.role !== 'tenant_manager')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { targetUserId, companyId, companyName, accessRole } = body;
        if (!targetUserId || !companyId) {
          return NextResponse.json({ error: 'userId and companyId required' }, { status: 400 });
        }

        await grantCompanyAccess({
          tenantId: context.tenantId,
          userId: targetUserId,
          companyId,
          companyName: companyName || companyId,
          role: accessRole || 'viewer',
          grantedBy: userId,
        });

        return NextResponse.json({ success: true });
      }

      case 'create-company': {
        const context = await buildTenantContext({
          userId,
          userEmail: session.email,
          tenantId: tenantId || undefined,
        });

        if (!context || (context.role !== 'tenant_admin' && context.role !== 'tenant_manager')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { name, shortName, orgNumber, metadata } = body;
        if (!name) {
          return NextResponse.json({ error: 'Name required' }, { status: 400 });
        }

        const company = await hierarchyService.createNode<CompanyNode>(context, {
          type: 'company',
          name,
          shortName,
          orgNumber,
          status: 'active',
          metadata: metadata || {},
        });

        return NextResponse.json({ success: true, company });
      }

      case 'create-fund': {
        const context = await buildTenantContext({
          userId,
          userEmail: session.email,
          tenantId: tenantId || undefined,
        });

        if (!context) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { companyId, name, metadata } = body;
        if (!companyId || !name) {
          return NextResponse.json({ error: 'companyId and name required' }, { status: 400 });
        }

        // Validate company access
        if (!context.allowedCompanyIds.includes(companyId) && 
            context.role !== 'tenant_admin' && context.role !== 'tenant_manager') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const fund = await hierarchyService.createNode<FundNode>(context, {
          type: 'fund',
          parentId: companyId,
          name,
          status: 'active',
          metadata: metadata || { fundType: 'private_equity' },
        });

        return NextResponse.json({ success: true, fund });
      }

      case 'create-portfolio': {
        const context = await buildTenantContext({
          userId,
          userEmail: session.email,
          tenantId: tenantId || undefined,
        });

        if (!context) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { fundId, name, metadata } = body;
        if (!fundId || !name) {
          return NextResponse.json({ error: 'fundId and name required' }, { status: 400 });
        }

        // Validate fund access
        const hasAccess = await hierarchyService.validateNodeAccess(context, fundId);
        if (!hasAccess) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const portfolio = await hierarchyService.createNode<PortfolioNode>(context, {
          type: 'portfolio',
          parentId: fundId,
          name,
          status: 'active',
          metadata: metadata || {},
        });

        return NextResponse.json({ success: true, portfolio });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Tenancy API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update tenant, user, or hierarchy node
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, nodeId, updates } = body;

    const userId = request.headers.get('x-aifm-user') || session.email;
    const tenantId = body.tenantId || request.headers.get('x-aifm-tenant');

    const context = await buildTenantContext({
      userId,
      userEmail: session.email,
      tenantId: tenantId || undefined,
    });

    if (!context) {
      return NextResponse.json({ error: 'No tenant access' }, { status: 403 });
    }

    switch (action) {
      case 'update-node': {
        if (!nodeId) {
          return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
        }

        // Validate node access
        const hasAccess = await hierarchyService.validateNodeAccess(context, nodeId);
        if (!hasAccess && context.role !== 'tenant_admin' && context.role !== 'tenant_manager') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updated = await hierarchyService.updateNode(context, nodeId, updates);
        return NextResponse.json({ success: true, node: updated });
      }

      case 'archive-node': {
        if (!nodeId) {
          return NextResponse.json({ error: 'nodeId required' }, { status: 400 });
        }

        if (context.role !== 'tenant_admin' && context.role !== 'tenant_manager') {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await hierarchyService.archiveNode(context, nodeId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Tenancy API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}


