/**
 * Tenant Middleware
 * 
 * Integrates tenant context into Next.js API routes.
 * This middleware ensures all requests are properly tenant-isolated.
 * 
 * IMPORTANT: This extends the existing middleware, not replaces it.
 * The existing auth middleware (middleware.ts) handles authentication.
 * This adds tenant context after authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildTenantContext, TenantContext, setCurrentTenantContext } from './tenantContext';

// ============================================================================
// Types
// ============================================================================

export interface TenantRequest extends NextRequest {
  tenantContext?: TenantContext;
}

export interface TenantApiHandler {
  (req: TenantRequest, context: TenantContext): Promise<NextResponse>;
}

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * Wraps an API handler with tenant context initialization
 * 
 * Usage in API route:
 * ```typescript
 * import { withTenant } from '@/lib/tenancy/tenantMiddleware';
 * 
 * export const GET = withTenant(async (req, tenantContext) => {
 *   // tenantContext is guaranteed to be valid
 *   const data = await fetchDataForTenant(tenantContext.tenantId);
 *   return NextResponse.json(data);
 * });
 * ```
 */
export function withTenant(handler: TenantApiHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Extract auth info from headers (set by main middleware)
      const userId = req.headers.get('x-aifm-user');
      const userEmail = req.headers.get('x-aifm-email') || '';
      const role = req.headers.get('x-aifm-role');
      
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized - no user context' },
          { status: 401 }
        );
      }

      // Get tenant/company from query params or headers
      const { searchParams } = new URL(req.url);
      const tenantId = searchParams.get('tenantId') || req.headers.get('x-aifm-tenant');
      const companyId = searchParams.get('companyId') || req.headers.get('x-aifm-company');
      
      // Get client info for audit
      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
      const sessionId = req.headers.get('x-aifm-session') || undefined;

      // Build tenant context
      const tenantContext = await buildTenantContext({
        userId,
        userEmail,
        tenantId: tenantId || undefined,
        companyId: companyId || undefined,
        ipAddress: ipAddress || undefined,
        sessionId,
      });

      if (!tenantContext) {
        return NextResponse.json(
          { error: 'Unauthorized - no tenant access' },
          { status: 403 }
        );
      }

      // Set global context (for nested service calls)
      setCurrentTenantContext(tenantContext);

      try {
        // Call the actual handler
        const tenantReq = req as TenantRequest;
        tenantReq.tenantContext = tenantContext;
        
        return await handler(tenantReq, tenantContext);
      } finally {
        // Clear context after request
        setCurrentTenantContext(null);
      }
    } catch (error) {
      console.error('[TenantMiddleware] Error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(context: TenantContext, permission: string): boolean {
  // Check for wildcard permission
  const [category, action] = permission.split(':');
  
  return context.permissions.some(p => {
    if (p === permission) return true;
    if (p === `${category}:*`) return true;
    if (p === '*:*' || p === '*') return true;
    return false;
  });
}

/**
 * Require specific permission (throws if not authorized)
 */
export function requirePermission(context: TenantContext, permission: string): void {
  if (!hasPermission(context, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

/**
 * Check if user has access to a specific company
 */
export function hasCompanyAccess(context: TenantContext, companyId: string): boolean {
  if (context.role === 'tenant_admin' || context.role === 'tenant_manager') {
    return true;
  }
  return context.allowedCompanyIds.includes(companyId);
}

/**
 * Require company access (throws if not authorized)
 */
export function requireCompanyAccess(context: TenantContext, companyId: string): void {
  if (!hasCompanyAccess(context, companyId)) {
    throw new CompanyAccessDeniedError(companyId);
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class PermissionDeniedError extends Error {
  constructor(public permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = 'PermissionDeniedError';
  }
}

export class CompanyAccessDeniedError extends Error {
  constructor(public companyId: string) {
    super(`Access denied to company: ${companyId}`);
    this.name = 'CompanyAccessDeniedError';
  }
}

export class TenantNotFoundError extends Error {
  constructor(public tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = 'TenantNotFoundError';
  }
}

// ============================================================================
// Query Helpers for DynamoDB
// ============================================================================

/**
 * Add tenant isolation to DynamoDB query parameters
 */
export function addTenantFilter(
  context: TenantContext,
  params: Record<string, unknown>
): Record<string, unknown> {
  const existingFilter = params.FilterExpression as string | undefined;
  const tenantFilter = 'tenantId = :tenantId';

  return {
    ...params,
    FilterExpression: existingFilter 
      ? `(${existingFilter}) AND ${tenantFilter}`
      : tenantFilter,
    ExpressionAttributeValues: {
      ...(params.ExpressionAttributeValues as Record<string, unknown> || {}),
      ':tenantId': context.tenantId,
    },
  };
}

/**
 * Add company isolation to DynamoDB query parameters
 */
export function addCompanyFilter(
  context: TenantContext,
  params: Record<string, unknown>,
  companyId: string
): Record<string, unknown> {
  // First validate company access
  requireCompanyAccess(context, companyId);

  const existingFilter = params.FilterExpression as string | undefined;
  const companyFilter = 'companyId = :companyId';

  const tenantFiltered = addTenantFilter(context, params);

  return {
    ...tenantFiltered,
    FilterExpression: existingFilter 
      ? `(${tenantFiltered.FilterExpression}) AND ${companyFilter}`
      : `${tenantFiltered.FilterExpression} AND ${companyFilter}`,
    ExpressionAttributeValues: {
      ...(tenantFiltered.ExpressionAttributeValues as Record<string, unknown>),
      ':companyId': companyId,
    },
  };
}

// ============================================================================
// S3 Helpers
// ============================================================================

/**
 * Get S3 key with tenant/company prefix
 */
export function getTenantS3Key(context: TenantContext, companyId: string, path: string): string {
  requireCompanyAccess(context, companyId);
  return `tenants/${context.tenantId}/companies/${companyId}/${path}`;
}

/**
 * Validate S3 key belongs to tenant
 */
export function validateS3Key(context: TenantContext, key: string): boolean {
  const expectedPrefix = `tenants/${context.tenantId}/`;
  if (!key.startsWith(expectedPrefix)) {
    return false;
  }

  // Also validate company access if key is company-scoped
  const companyMatch = key.match(/companies\/([^/]+)\//);
  if (companyMatch) {
    const companyId = companyMatch[1];
    return hasCompanyAccess(context, companyId);
  }

  return true;
}


