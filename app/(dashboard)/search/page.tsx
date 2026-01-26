'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { useCompany } from '@/components/CompanyContext';

type SearchGroup = { label: string; items: Array<{ type: string; title: string; subtitle?: string; href: string; score: number }> };

function SearchPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const q = (params.get('q') || '').trim();

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[]>([]);

  const companyId = useMemo(() => selectedCompany?.id || '', [selectedCompany?.id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (q.length < 2) {
        setGroups([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        setGroups(Array.isArray(data.groups) ? data.groups : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [companyId, q]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-aifm-charcoal">Sök</h1>
        <p className="text-sm text-aifm-charcoal/50 mt-1">
          Resultat för <span className="font-medium text-aifm-charcoal">“{q || '—'}”</span>
        </p>
      </div>

      {q.length < 2 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Search className="w-10 h-10 text-aifm-charcoal/10 mx-auto mb-3" />
          <p className="text-sm text-aifm-charcoal/60">Skriv minst 2 tecken för att söka.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-sm text-aifm-charcoal/60">Söker…</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Search className="w-10 h-10 text-aifm-charcoal/10 mx-auto mb-3" />
          <p className="text-sm text-aifm-charcoal/60">Inga träffar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.label} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <p className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">{g.label}</p>
              </div>
              <div className="p-2">
                {g.items.map((it) => (
                  <button
                    key={`${it.type}-${it.href}-${it.title}`}
                    onClick={() => router.push(it.href)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-aifm-charcoal truncate">{it.title}</p>
                        {it.subtitle && <p className="text-xs text-aifm-charcoal/50 truncate">{it.subtitle}</p>}
                      </div>
                      <ArrowRight className="w-4 h-4 text-aifm-charcoal/20" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchLoadingFallback() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <p className="text-sm text-aifm-charcoal/60">Laddar sök…</p>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoadingFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}


