'use client';


import { useEffect, useMemo, useState } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { Loader2, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';

type DueEntry = {
  scheduleId: string;
  supplierName?: string;
  description?: string;
  originalAmount: number;
  entry: {
    date: string;
    period: string;
    debitAccount: string;
    debitAmount: number;
    creditAccount: string;
    creditAmount: number;
    description: string;
    isProcessed: boolean;
  };
};

function getErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Okänt fel';
}

export default function PeriodizationsPage() {
  const { selectedCompany } = useCompany();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DueEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const period = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/accounting/periodizations?companyId=${selectedCompany.id}&period=${period}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load periodizations');
      setItems(json.entries || []);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Kunde inte hämta periodiseringar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id, period]);

  const bookAll = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/accounting/periodizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id, action: 'book-period', period }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Kunde inte bokföra periodiseringar');
      setResult(`Bokförde ${json.booked || 0} verifikationer (misslyckade: ${json.failed || 0}).`);
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Kunde inte bokföra periodiseringar');
    } finally {
      setLoading(false);
    }
  };

  const markProcessed = async (scheduleId: string) => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/accounting/periodizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id, action: 'process', scheduleId, period }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Kunde inte markera som bokförd');
      setResult('Markerad som bokförd.');
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Kunde inte markera som bokförd');
    } finally {
      setLoading(false);
    }
  };

  return (
    
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Periodiseringar</h1>
            <p className="text-sm text-gray-500">Se och bokför månadens periodiseringar.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                className="text-sm outline-none bg-transparent"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 5 }).map((_, i) => {
                  const y = new Date().getFullYear() - 2 + i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <select
                className="text-sm outline-none bg-transparent"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>{String(i + 1).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <button
              onClick={bookAll}
              disabled={loading || !selectedCompany}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Bokför alla
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-xl bg-emerald-50 text-emerald-800 px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 inline mr-2" />
            {result}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Förfallna poster ({period})</h2>
              <p className="text-xs text-gray-500">Poster som ska periodiseras denna månad.</p>
            </div>
            <span className="text-xs text-gray-500">{items.length} st</span>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((it) => (
              <div key={`${it.scheduleId}-${it.entry.period}`} className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">{it.supplierName || 'Periodisering'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{it.description || it.entry.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {it.entry.debitAccount} debet {it.entry.debitAmount.toLocaleString('sv-SE')} · {it.entry.creditAccount} kredit {it.entry.creditAmount.toLocaleString('sv-SE')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => markProcessed(it.scheduleId)}
                    disabled={loading}
                    className="px-3 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    title="Markera som bokförd (manuellt)"
                  >
                    Markera bokförd
                  </button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-500">Inga periodiseringar för vald period.</div>
            )}
          </div>
        </div>
      </div>
    
  );
}



