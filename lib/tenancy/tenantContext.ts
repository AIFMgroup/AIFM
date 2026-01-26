/**
 * Tenant Context & Isolation Service
 * 
 * Provides hard tenant isolation across the platform.
 * All data access must go through tenant context validation.
 * 
 * CRITICAL: This is the core security layer for multi-tenancy.
 * DO NOT bypass tenant checks in any API route.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ============================================================================
// Types
// ============================================================================

export interface TenantContext {
  /** The tenant/customer ID (top-level organization) */
  tenantId: string;
  /** Current user's ID */
  userId: string;
  /** User's email */
  userEmail: string;
  /** User's role within the tenant */
  role: TenantRole;
  /** Companies the user has access to */
  allowedCompanyIds: string[];
  /** Specific permissions */
  permissions: string[];
  /** IP address for audit */
  ipAddress?: string;
  /** Session ID for tracking */
  sessionId?: string;
}

export type TenantRole = 
  | 'tenant_admin'      // Full access to tenant
  | 'tenant_manager'    // Manage companies and users
  | 'company_admin'     // Full access to specific companies
  | 'company_user'      // Standard user access
  | 'company_viewer'    // Read-only access
  | 'external_auditor'  // Limited audit access
  | 'external_client';  // Client portal access

export interface Tenant {
  id: string;
  name: string;
  orgNumber?: string;
  status: 'active' | 'suspended' | 'trial';
  plan: 'starter' | 'professional' | 'enterprise';
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  /** Max users allowed */
  maxUsers: number;
  /** Max companies allowed */
  maxCompanies: number;
  /** Features enabled */
  features: string[];
  /** Data retention days */
  dataRetentionDays: number;
  /** Require MFA for all users */
  requireMfa: boolean;
  /** Allowed IP ranges (CIDR) */
  allowedIpRanges?: string[];
  /** Custom branding */
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

export interface TenantUser {
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  role: TenantRole;
  companyAccess: CompanyAccess[];
  status: 'active' | 'invited' | 'disabled';
  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  mfaEnabled: boolean;
}

export interface CompanyAccess {
  companyId: string;
  companyName: string;
  role: 'admin' | 'editor' | 'viewer';
  grantedAt: string;
  grantedBy: string;
}

// ============================================================================
// DynamoDB Setup
// ============================================================================

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(ddbClient);
const TENANTS_TABLE = process.env.TENANTS_TABLE_NAME || 'aifm-tenants';
const TENANT_USERS_TABLE = process.env.TENANT_USERS_TABLE_NAME || 'aifm-tenant-users';

// ============================================================================
// Tenant Context Functions
// ============================================================================

/**
 * Build tenant context from session/request
 * This should be called at the beginning of every API request
 */
export async function buildTenantContext(params: {
  userId: string;
  userEmail: string;
  tenantId?: string;
  companyId?: string;
  ipAddress?: string;
  sessionId?: string;
}): Promise<TenantContext | null> {
  const { userId, userEmail, tenantId, companyId, ipAddress, sessionId } = params;

  // Get user's tenant membership
  const userTenants = await getUserTenantMemberships(userId);
  
  if (userTenants.length === 0) {
    console.warn(`[TenantContext] User ${userId} has no tenant memberships`);
    return null;
  }

  // If tenantId specified, verify access
  let activeTenant: TenantUser | undefined;
  if (tenantId) {
    activeTenant = userTenants.find(t => t.tenantId === tenantId);
    if (!activeTenant) {
      console.warn(`[TenantContext] User ${userId} not authorized for tenant ${tenantId}`);
      return null;
    }
  } else {
    // Default to first tenant (or primary)
    activeTenant = userTenants[0];
  }

  // Build allowed company IDs
  let allowedCompanyIds = activeTenant.companyAccess.map(c => c.companyId);
  
  // If tenant admin/manager, they have access to all companies in tenant
  if (activeTenant.role === 'tenant_admin' || activeTenant.role === 'tenant_manager') {
    const allCompanies = await getTenantCompanyIds(activeTenant.tenantId);
    allowedCompanyIds = allCompanies;
  }

  // If specific companyId requested, validate access
  if (companyId && !allowedCompanyIds.includes(companyId)) {
    console.warn(`[TenantContext] User ${userId} not authorized for company ${companyId}`);
    return null;
  }

  // Build permissions based on role
  const permissions = getRolePermissions(activeTenant.role);

  return {
    tenantId: activeTenant.tenantId,
    userId,
    userEmail,
    role: activeTenant.role,
    allowedCompanyIds,
    permissions,
    ipAddress,
    sessionId,
  };
}

/**
 * Validate that a resource belongs to the tenant context
 */
export function validateResourceAccess(
  context: TenantContext,
  resourceTenantId: string,
  resourceCompanyId?: string
): boolean {
  // Must match tenant
  if (context.tenantId !== resourceTenantId) {
    return false;
  }

  // If resource is company-scoped, validate company access
  if (resourceCompanyId && !context.allowedCompanyIds.includes(resourceCompanyId)) {
    return false;
  }

  return true;
}

/**
 * Get DynamoDB filter condition for tenant isolation
 * Use this in all queries to ensure data isolation
 */
export function getTenantFilterExpression(context: TenantContext): {
  filterExpression: string;
  expressionAttributeValues: Record<string, unknown>;
} {
  return {
    filterExpression: 'tenantId = :tenantId',
    expressionAttributeValues: {
      ':tenantId': context.tenantId,
    },
  };
}

/**
 * Get S3 key prefix for tenant-isolated storage
 */
export function getTenantS3Prefix(tenantId: string, companyId?: string): string {
  if (companyId) {
    return `tenants/${tenantId}/companies/${companyId}/`;
  }
  return `tenants/${tenantId}/`;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getUserTenantMemberships(userId: string): Promise<TenantUser[]> {
  try {
    const command = new QueryCommand({
      TableName: TENANT_USERS_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#status = :active',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':active': 'active',
      },
    });

    const response = await docClient.send(command);
    return (response.Items || []) as TenantUser[];
  } catch (error) {
    console.error('[TenantContext] Error fetching user tenants:', error);
    return [];
  }
}

async function getTenantCompanyIds(tenantId: string): Promise<string[]> {
  try {
    const command = new QueryCommand({
      TableName: TENANTS_TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'COMPANY#',
      },
      ProjectionExpression: 'companyId',
    });

    const response = await docClient.send(command);
    return (response.Items || []).map(item => item.companyId as string);
  } catch (error) {
    console.error('[TenantContext] Error fetching tenant companies:', error);
    return [];
  }
}

function getRolePermissions(role: TenantRole): string[] {
  const basePermissions: Record<TenantRole, string[]> = {
    tenant_admin: [
      'tenant:*',
      'company:*',
      'user:*',
      'document:*',
      'accounting:*',
      'compliance:*',
      'settings:*',
      'audit:read',
    ],
    tenant_manager: [
      'company:*',
      'user:read', 'user:write',
      'document:*',
      'accounting:read', 'accounting:write',
      'compliance:read',
      'settings:read',
      'audit:read',
    ],
    company_admin: [
      'company:read', 'company:write',
      'user:read',
      'document:*',
      'accounting:*',
      'compliance:read', 'compliance:write',
      'settings:read',
    ],
    company_user: [
      'company:read',
      'document:read', 'document:write',
      'accounting:read', 'accounting:write',
      'compliance:read',
    ],
    company_viewer: [
      'company:read',
      'document:read',
      'accounting:read',
      'compliance:read',
    ],
    external_auditor: [
      'document:read',
      'accounting:read',
      'compliance:read',
      'audit:read',
    ],
    external_client: [
      'document:read',
    ],
  };

  return basePermissions[role] || [];
}

// ============================================================================
// Tenant Management Functions
// ============================================================================

/**
 * Create a new tenant
 */
export async function createTenant(params: {
  name: string;
  orgNumber?: string;
  plan?: Tenant['plan'];
  adminUserId: string;
  adminEmail: string;
  adminName: string;
}): Promise<Tenant> {
  const now = new Date().toISOString();
  const tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const tenant: Tenant = {
    id: tenantId,
    name: params.name,
    orgNumber: params.orgNumber,
    status: 'active',
    plan: params.plan || 'starter',
    settings: getDefaultSettings(params.plan || 'starter'),
    createdAt: now,
    updatedAt: now,
  };

  // Save tenant
  await docClient.send(new PutCommand({
    TableName: TENANTS_TABLE,
    Item: {
      pk: `TENANT#${tenantId}`,
      sk: 'METADATA',
      ...tenant,
    },
  }));

  // Add admin user
  const adminUser: TenantUser = {
    tenantId,
    userId: params.adminUserId,
    email: params.adminEmail,
    name: params.adminName,
    role: 'tenant_admin',
    companyAccess: [],
    status: 'active',
    activatedAt: now,
    mfaEnabled: false,
  };

  await docClient.send(new PutCommand({
    TableName: TENANT_USERS_TABLE,
    Item: {
      pk: `TENANT#${tenantId}`,
      sk: `USER#${params.adminUserId}`,
      ...adminUser,
    },
  }));

  console.log(`[TenantContext] Created tenant ${tenantId} with admin ${params.adminEmail}`);

  return tenant;
}

/**
 * Get tenant by ID
 */
export async function getTenant(tenantId: string): Promise<Tenant | null> {
  try {
    const command = new GetCommand({
      TableName: TENANTS_TABLE,
      Key: {
        pk: `TENANT#${tenantId}`,
        sk: 'METADATA',
      },
    });

    const response = await docClient.send(command);
    return response.Item as Tenant | null;
  } catch (error) {
    console.error('[TenantContext] Error fetching tenant:', error);
    return null;
  }
}

/**
 * Add user to tenant
 */
export async function addUserToTenant(params: {
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  role: TenantRole;
  companyAccess?: CompanyAccess[];
  invitedBy: string;
}): Promise<TenantUser> {
  const now = new Date().toISOString();

  const user: TenantUser = {
    tenantId: params.tenantId,
    userId: params.userId,
    email: params.email,
    name: params.name,
    role: params.role,
    companyAccess: params.companyAccess || [],
    status: 'invited',
    invitedAt: now,
    mfaEnabled: false,
  };

  await docClient.send(new PutCommand({
    TableName: TENANT_USERS_TABLE,
    Item: {
      pk: `TENANT#${params.tenantId}`,
      sk: `USER#${params.userId}`,
      ...user,
    },
  }));

  console.log(`[TenantContext] Added user ${params.email} to tenant ${params.tenantId}`);

  return user;
}

/**
 * Grant company access to user
 */
export async function grantCompanyAccess(params: {
  tenantId: string;
  userId: string;
  companyId: string;
  companyName: string;
  role: CompanyAccess['role'];
  grantedBy: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const access: CompanyAccess = {
    companyId: params.companyId,
    companyName: params.companyName,
    role: params.role,
    grantedAt: now,
    grantedBy: params.grantedBy,
  };

  await docClient.send(new UpdateCommand({
    TableName: TENANT_USERS_TABLE,
    Key: {
      pk: `TENANT#${params.tenantId}`,
      sk: `USER#${params.userId}`,
    },
    UpdateExpression: 'SET companyAccess = list_append(if_not_exists(companyAccess, :empty), :access)',
    ExpressionAttributeValues: {
      ':access': [access],
      ':empty': [],
    },
  }));

  console.log(`[TenantContext] Granted ${params.role} access to company ${params.companyId} for user ${params.userId}`);
}

function getDefaultSettings(plan: Tenant['plan']): TenantSettings {
  const defaults: Record<Tenant['plan'], TenantSettings> = {
    starter: {
      maxUsers: 5,
      maxCompanies: 3,
      features: ['accounting', 'documents'],
      dataRetentionDays: 365,
      requireMfa: false,
    },
    professional: {
      maxUsers: 25,
      maxCompanies: 15,
      features: ['accounting', 'documents', 'compliance', 'crm', 'workflows'],
      dataRetentionDays: 2555, // 7 years
      requireMfa: false,
    },
    enterprise: {
      maxUsers: -1, // Unlimited
      maxCompanies: -1,
      features: ['accounting', 'documents', 'compliance', 'crm', 'workflows', 'api', 'sso', 'audit'],
      dataRetentionDays: 3650, // 10 years
      requireMfa: true,
    },
  };

  return defaults[plan];
}

// ============================================================================
// Export singleton helper for request context
// ============================================================================

let currentContext: TenantContext | null = null;

export function setCurrentTenantContext(context: TenantContext | null): void {
  currentContext = context;
}

export function getCurrentTenantContext(): TenantContext | null {
  return currentContext;
}

/**
 * Higher-order function to wrap API handlers with tenant context
 */
export function withTenantContext<T>(
  handler: (context: TenantContext, ...args: unknown[]) => Promise<T>
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]) => {
    const context = getCurrentTenantContext();
    if (!context) {
      throw new Error('Tenant context not initialized');
    }
    return handler(context, ...args);
  };
}


