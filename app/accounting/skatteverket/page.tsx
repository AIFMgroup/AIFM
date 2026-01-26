'use client';


import { useEffect, useState } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { Loader2, RefreshCw, Plus } from 'lucide-react';

type Submission = {
  id: string;
  type: 'VAT';
  periodKey: string;
  status: 'queued' | 'submitted' | 'failed' | 'cancelled';
  createdAtIso: string;
  updatedAtIso: string;
  error?: string;
};

export default function SkatteverketSubmissionsPage() {
  const { selectedCompany } = useCompany();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/skatteverket/submissions?companyId=${selectedCompany.id}`);
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (e) {
      setError('Kunde inte hämta submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  const queueVat = async () => {
    if (!selectedCompany?.id) return;
    const yearStr = prompt('År (t.ex. 2025):', new Date().getFullYear().toString());
    if (!yearStr) return;
    const year = parseInt(yearStr, 10);
    const monthStr = prompt('Månad (1-12), lämna tomt för kvartal:', '');
    const quarterStr = monthStr ? '' : prompt('Kvartal (1-4):', '');

    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    const quarter = quarterStr ? parseInt(quarterStr, 10) : undefined;

    try {
      const res = await fetch('/api/accounting/skatteverket/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id, year, month, quarter }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'queue failed');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte queue:a momsdeklaration.');
    }
  };

  return (
    
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Skatteverket (queue)</h1>
            <p className="text-sm text-gray-500 mt-1">
              Förberett flöde: vi skapar/persisterar exakt payload (XML) men skickar inte till Skatteverket förrän API-integrationen är på plats.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Uppdatera
            </button>
            <button onClick={queueVat} className="px-4 py-2 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Queue moms
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Submissions</h2>
            <span className="text-xs text-gray-500">{submissions.length} st</span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laddar...
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-sm text-gray-500">Inget queued ännu.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Skapad</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uppdaterad</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((s) => (
                    <tr key={`${s.type}-${s.periodKey}-${s.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{s.periodKey}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{s.status}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{new Date(s.createdAtIso).toLocaleString('sv-SE')}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{new Date(s.updatedAtIso).toLocaleString('sv-SE')}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{s.error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    
  );
}



