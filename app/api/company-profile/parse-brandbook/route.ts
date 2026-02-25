import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { parseBrandbookText } from '@/lib/documents/brandbookParser';
import { updateCompanyProfile } from '@/lib/companyProfileStore';

const DEFAULT_COMPANY_ID = 'default';

/**
 * POST /api/company-profile/parse-brandbook
 * Body: { text: string, applyToProfile?: boolean }
 * Parses brandbook text and optionally updates the company profile.
 */
export async function POST(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { text?: string; applyToProfile?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text || text.length < 100) {
    return NextResponse.json(
      { error: 'text is required and must be at least 100 characters' },
      { status: 400 }
    );
  }

  try {
    const parsed = await parseBrandbookText(text);
    if (body.applyToProfile) {
      await updateCompanyProfile(DEFAULT_COMPANY_ID, {
        brandVoice: parsed.brandVoice,
        brandColors: parsed.brandColors,
        documentStyle: parsed.documentStyle,
        letterTemplate: parsed.letterTemplate,
        reportTemplate: parsed.reportTemplate,
      });
    }
    return NextResponse.json({ success: true, parsed, applied: !!body.applyToProfile });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
