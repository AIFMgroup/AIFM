import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  const h = await headers();
  const role = (h.get('x-aifm-role') || 'unknown').toLowerCase();
  return NextResponse.json({ role });
}


