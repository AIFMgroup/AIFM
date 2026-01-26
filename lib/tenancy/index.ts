/**
 * Tenancy Module - Main Export
 * 
 * Provides multi-tenancy and client isolation features.
 */

// Core tenant context
export {
  type TenantContext,
  type TenantRole,
  type Tenant,
  type TenantSettings,
  type TenantUser,
  type CompanyAccess,
  buildTenantContext,
  validateResourceAccess,
  getTenantFilterExpression,
  getTenantS3Prefix,
  createTenant,
  getTenant,
  addUserToTenant,
  grantCompanyAccess,
  getCurrentTenantContext,
  setCurrentTenantContext,
  withTenantContext,
} from './tenantContext';

// Hierarchy model
export {
  type HierarchyNode,
  type CompanyNode,
  type FundNode,
  type PortfolioNode,
  type AnyHierarchyNode,
  hierarchyService,
  migrateExistingCompanies,
} from './hierarchy';

// Middleware and helpers
export {
  type TenantRequest,
  type TenantApiHandler,
  withTenant,
  hasPermission,
  requirePermission,
  hasCompanyAccess,
  requireCompanyAccess,
  addTenantFilter,
  addCompanyFilter,
  getTenantS3Key,
  validateS3Key,
  PermissionDeniedError,
  CompanyAccessDeniedError,
  TenantNotFoundError,
} from './tenantMiddleware';


