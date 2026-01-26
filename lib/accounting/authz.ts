export type UserRole = 'customer' | 'accountant' | 'manager' | 'executive' | 'admin' | 'auditor';

export type AccountingAction =
  | 'VIEW'
  | 'EDIT_CLASSIFICATION'
  | 'APPROVE_JOB'
  | 'SEND_TO_FORTNOX'
  | 'APPROVE_REQUEST';

const ROLE_LEVEL: Record<UserRole, number> = {
  customer: 1,
  accountant: 2,
  manager: 3,
  executive: 4,
  admin: 5,
  auditor: 0, // explicit read-only
};

function normalizeGroups(groups?: unknown): string[] {
  if (!groups) return [];
  if (Array.isArray(groups)) return groups.map(String);
  // Cognito can (in some setups) emit a single string
  return [String(groups)];
}

/**
 * Map Cognito groups (or similar identity groups) to an application role.
 *
 * IMPORTANT: This is used as the source of truth in production RBAC.
 * - Keep it least-privilege by default (fallback role).
 * - Prefer explicit `aifm-*` group names but also accept simple names.
 */
export function getRoleFromGroups(groups?: unknown): UserRole {
  const rawGroups = normalizeGroups(groups).map((g) => g.toLowerCase());

  const has = (...candidates: string[]) =>
    candidates.some((c) => rawGroups.includes(c.toLowerCase()));

  // Highest privilege first
  if (has('aifm-admin', 'admin')) return 'admin';
  if (has('aifm-executive', 'executive', 'cfo', 'ceo')) return 'executive';
  if (has('aifm-manager', 'manager')) return 'manager';
  if (has('aifm-accountant', 'accountant', 'finance')) return 'accountant';
  if (has('aifm-auditor', 'auditor', 'read-only', 'readonly')) return 'auditor';
  if (has('aifm-customer', 'customer')) return 'customer';

  const fallback = (process.env.AIFM_DEFAULT_ROLE || '').toLowerCase();
  const allowed: UserRole[] = ['customer', 'accountant', 'manager', 'executive', 'admin', 'auditor'];
  return (allowed.includes(fallback as UserRole) ? (fallback as UserRole) : 'customer');
}

export function getRoleFromRequest(request: Request): UserRole {
  const raw = (request.headers.get('x-aifm-role') || '').toLowerCase();
  const allowed: UserRole[] = ['customer', 'accountant', 'manager', 'executive', 'admin', 'auditor'];
  return (allowed.includes(raw as UserRole) ? (raw as UserRole) : 'accountant');
}

export function can(role: UserRole, action: AccountingAction): boolean {
  if (role === 'admin') return true;
  if (role === 'auditor') return action === 'VIEW';

  switch (action) {
    case 'VIEW':
      return true;
    case 'EDIT_CLASSIFICATION':
      return ROLE_LEVEL[role] >= ROLE_LEVEL.accountant;
    case 'APPROVE_JOB':
      return ROLE_LEVEL[role] >= ROLE_LEVEL.accountant;
    case 'SEND_TO_FORTNOX':
      return ROLE_LEVEL[role] >= ROLE_LEVEL.accountant;
    case 'APPROVE_REQUEST':
      return ROLE_LEVEL[role] >= ROLE_LEVEL.accountant;
    default:
      return false;
  }
}

export function assertCan(role: UserRole, action: AccountingAction): void {
  if (!can(role, action)) throw new Error(`Forbidden: ${role} cannot ${action}`);
}


