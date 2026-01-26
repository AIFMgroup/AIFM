import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyIdToken } from '@/lib/auth/tokens';
import { dataRoomStore } from '@/lib/dataRooms/dataRoomService';
import { activityStore, crmCompanyStore, contactStore, dealStore, taskStore } from '@/lib/crm/store';
import { NAV_SEARCH_ITEMS, rankResults, makeSuggestions, type SearchResultItem } from '@/lib/search/searchIndex';

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__Host-aifm_id_token')?.value;
  if (!token) return null;

  try {
    const payload = await verifyIdToken(token);
    return { sub: payload.sub as string, email: payload.email as string | undefined };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const companyId = (searchParams.get('companyId') || '').trim();

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [], groups: [] });
  }

  // Build candidate items (unscored)
  const candidates: Omit<SearchResultItem, 'score'>[] = [];

  // Navigation search (always available)
  for (const item of NAV_SEARCH_ITEMS) {
    candidates.push({
      type: 'nav',
      title: item.title,
      subtitle: item.keywords?.join(', '),
      href: item.href,
    });
  }

  // Data rooms (names only; safe and fast)
  try {
    const rooms = await dataRoomStore.getAllRooms();
    for (const r of rooms.slice(0, 200)) {
      candidates.push({
        type: 'dataroom',
        title: r.name,
        subtitle: r.fundName ? `Datarum • ${r.fundName}` : 'Datarum',
        href: `/data-rooms/${r.id}`,
      });
    }
  } catch (e) {
    // Don't fail whole search
    console.error('[Search] data rooms error', e);
  }

  // CRM search (scoped to current company)
  if (companyId) {
    try {
      const [companies, contacts, deals, tasks, activities] = await Promise.all([
        crmCompanyStore.list(companyId),
        contactStore.list(companyId),
        dealStore.list(companyId),
        taskStore.list(companyId),
        activityStore.list(companyId),
      ]);

      for (const c of companies.slice(0, 250)) {
        candidates.push({
          type: 'crm_company',
          title: c.name,
          subtitle: `Företag • ${c.status}`,
          href: `/crm/companies`,
        });
      }
      for (const c of contacts.slice(0, 250)) {
        candidates.push({
          type: 'crm_contact',
          title: `${c.firstName} ${c.lastName}`.trim(),
          subtitle: `Kontakt • ${c.email || c.phone || ''}`.trim(),
          href: `/crm/contacts`,
        });
      }
      for (const d of deals.slice(0, 250)) {
        candidates.push({
          type: 'crm_deal',
          title: d.name,
          subtitle: `Deal • ${d.stage} • ${d.value?.toLocaleString?.('sv-SE') ?? d.value ?? ''} ${d.currency ?? ''}`.trim(),
          href: `/crm/pipeline`,
        });
      }
      for (const t of tasks.slice(0, 250)) {
        candidates.push({
          type: 'crm_task',
          title: t.title,
          subtitle: `Uppgift • ${t.status} • ${t.priority}`,
          href: `/crm/tasks`,
        });
      }
      for (const a of activities.slice(0, 250)) {
        candidates.push({
          type: 'crm_activity',
          title: a.title,
          subtitle: `Aktivitet • ${a.type} • ${a.status}`,
          href: `/crm/activities`,
        });
      }
    } catch (e) {
      console.error('[Search] crm error', e);
    }
  }

  const ranked = rankResults(q, candidates).slice(0, 30);
  const suggestions = makeSuggestions(q, ranked, 6);

  const groups = [
    { label: 'Förslag', items: ranked.filter((r) => r.type === 'nav') },
    { label: 'CRM', items: ranked.filter((r) => r.type.startsWith('crm_')) },
    { label: 'Datarum', items: ranked.filter((r) => r.type === 'dataroom') },
  ].filter((g) => g.items.length > 0);

  return NextResponse.json({
    suggestions,
    groups,
  });
}


