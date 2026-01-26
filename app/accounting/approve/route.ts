import type { NextRequest } from 'next/server';
import { POST as approvePost } from '@/app/api/accounting/approve/route';

/**
 * POST /accounting/approve
 *
 * Non-/api mirror of /api/accounting/approve to avoid CloudFront routing conflicts.
 * Re-exports the exact same handler.
 */
export async function POST(request: NextRequest) {
  return approvePost(request);
}


