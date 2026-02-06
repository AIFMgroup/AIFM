// Local Role enum (matches @aifm/shared/types)
export enum Role {
  COORDINATOR = 'coordinator',
  SPECIALIST = 'specialist',
  CLIENT = 'client',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  [Role.COORDINATOR]: new Set([
    'task:view',
    'task:approve',
    'task:reject',
    'task:assign',
    'report:view',
    'report:review',
    'audit:view',
    'client:view',
  ]),
  [Role.SPECIALIST]: new Set([
    'report:create',
    'report:edit',
    'report:view',
    'report:signoff',
    'task:view',
    'audit:view:own',
  ]),
  [Role.CLIENT]: new Set([
    'report:view:own',
    'report:download',
    'audit:view:own',
    'dashboard:view',
  ]),
  [Role.ADMIN]: new Set([
    'client:create',
    'client:edit',
    'client:delete',
    'user:create',
    'user:edit',
    'user:delete',
    'datafeed:create',
    'datafeed:edit',
    'datafeed:delete',
    'datafeed:sync',
    'system:config',
    'system:logs',
    'system:health',
    'audit:view:all',
    'report:view:all',
    'task:view:all',
  ]),
  [Role.SUPER_ADMIN]: new Set([
    'client:create',
    'client:edit',
    'client:delete',
    'user:create',
    'user:edit',
    'user:delete',
    'datafeed:create',
    'datafeed:edit',
    'datafeed:delete',
    'datafeed:sync',
    'system:config',
    'system:logs',
    'system:health',
    'audit:view:all',
    'report:view:all',
    'task:view:all',
    'admin:all',
  ]),
};

// Check if a role has a specific permission
export const hasPermission = (role: Role | null | undefined, permission: string): boolean => {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
};

// Get all permissions for a role
export const getPermissions = (role: Role | null | undefined): string[] => {
  if (!role) return [];
  return Array.from(ROLE_PERMISSIONS[role] ?? new Set());
};

// Middleware to enforce permissions in API routes
export const requirePermission = (requiredPermission: string) => {
  return (req: any, res: any, next: any) => {
    const userRole = req.user?.role as Role | undefined;

    if (!hasPermission(userRole, requiredPermission)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `This action requires the "${requiredPermission}" permission`,
      });
    }

    next();
  };
};

// Middleware to require specific roles
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: any, res: any, next: any) => {
    const userRole = req.user?.role as Role | undefined;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

// Check multiple permissions (AND logic)
export const hasAllPermissions = (role: Role | null | undefined, permissions: string[]): boolean => {
  return permissions.every((permission) => hasPermission(role, permission));
};

// Check multiple permissions (OR logic)
export const hasAnyPermission = (role: Role | null | undefined, permissions: string[]): boolean => {
  return permissions.some((permission) => hasPermission(role, permission));
};

// Get permission groups for UI visibility
export const getPermissionGroups = (role: Role | null | undefined) => {
  const permissions = getPermissions(role);

  return {
    tasks: permissions.filter((p) => p.startsWith('task:')),
    reports: permissions.filter((p) => p.startsWith('report:')),
    clients: permissions.filter((p) => p.startsWith('client:')),
    users: permissions.filter((p) => p.startsWith('user:')),
    datafeeds: permissions.filter((p) => p.startsWith('datafeed:')),
    audit: permissions.filter((p) => p.startsWith('audit:')),
    system: permissions.filter((p) => p.startsWith('system:')),
  };
};

export default {
  hasPermission,
  getPermissions,
  requirePermission,
  requireRole,
  hasAllPermissions,
  hasAnyPermission,
  getPermissionGroups,
};
