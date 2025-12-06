import { auth } from '@/auth';
import { NextResponse, type NextRequest } from 'next/server';

type Role = 'ADMIN' | 'CONTROLLER' | 'REVIEWER' | 'VIEWER' | 'LP' | 'COORDINATOR' | 'SPECIALIST';

type GuardOptions = {
  roles?: Role[];
  requireTwoManRule?: boolean;
};

/**
 * Minimal authz helper for API routes.
 * - Validates session
 * - Optionally restricts roles
 * - Optionally enforces 4-ögon (two-man rule) via header flag (demo placeholder)
 */
export async function requireAuth(request: NextRequest, opts: GuardOptions = {}) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const userRole = (session.user as any)?.role as Role | undefined;

  if (opts.roles && !opts.roles.includes(userRole ?? '')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (opts.requireTwoManRule) {
    // Placeholder for real 4-ögon: expect header x-two-man-approval=true
    const twoMan = request.headers.get('x-two-man-approval');
    if (twoMan !== 'true') {
      return { error: NextResponse.json({ error: 'Two-man approval required' }, { status: 409 }) };
    }
  }

  return { session, role: userRole };
}
