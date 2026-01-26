export type SearchResultItem = {
  type: 'nav' | 'crm_company' | 'crm_contact' | 'crm_deal' | 'crm_task' | 'crm_activity' | 'dataroom';
  title: string;
  subtitle?: string;
  href: string;
  score: number;
};

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

function scoreMatch(query: string, text: string): number {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  if (t.includes(` ${q}`)) return 650;
  if (t.includes(q)) return 500;

  // Subsequence fuzzy match scoring (cheap)
  let qi = 0;
  let hits = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      qi++;
      hits++;
    }
  }
  if (qi < q.length) return 0;
  return 250 + hits * 10 - Math.max(0, t.length - q.length);
}

export function rankResults(query: string, items: Omit<SearchResultItem, 'score'>[]): SearchResultItem[] {
  const scored = items
    .map((it) => ({
      ...it,
      score: Math.max(scoreMatch(query, it.title), it.subtitle ? scoreMatch(query, it.subtitle) - 50 : 0),
    }))
    .filter((it) => it.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored;
}

export function makeSuggestions(query: string, ranked: SearchResultItem[], max = 6): string[] {
  const q = normalize(query);
  if (q.length < 4) return [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const r of ranked) {
    const cand = r.title.trim();
    const nc = normalize(cand);
    if (!nc.includes(q)) continue;
    if (seen.has(nc)) continue;
    seen.add(nc);
    out.push(cand);
    if (out.length >= max) break;
  }

  return out;
}

export const NAV_SEARCH_ITEMS: Array<{
  title: string;
  href: string;
  keywords?: string[];
}> = [
  { title: 'Översikt', href: '/overview', keywords: ['dashboard', 'home'] },
  { title: 'CRM', href: '/crm', keywords: ['kontakter', 'företag', 'pipeline', 'kalender'] },
  { title: 'CRM – Kontakter', href: '/crm/contacts', keywords: ['kontakt', 'person'] },
  { title: 'CRM – Företag', href: '/crm/companies', keywords: ['bolag', 'company'] },
  { title: 'CRM – Pipeline', href: '/crm/pipeline', keywords: ['deals', 'affärer', 'kanban'] },
  { title: 'CRM – Kalender', href: '/crm/calendar', keywords: ['möten', 'events'] },
  { title: 'CRM – Uppgifter', href: '/crm/tasks', keywords: ['todo', 'tasks'] },
  { title: 'Datarum', href: '/data-rooms', keywords: ['dokument', 'uploads'] },
  { title: 'Bokföring – Dashboard', href: '/accounting/dashboard', keywords: ['redovisning', 'accounting'] },
  { title: 'Bokföring – Inkorg', href: '/accounting/inbox', keywords: ['fakturor', 'approvals'] },
  { title: 'Bokföring – Ladda upp', href: '/accounting/upload', keywords: ['upload', 'kvitto'] },
  { title: 'Bokföring – Rapporter', href: '/accounting/reports', keywords: ['reporting'] },
  { title: 'Inställningar', href: '/settings', keywords: ['profil', 'security', 'lösenord'] },
];


