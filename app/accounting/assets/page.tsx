'use client';


import { useEffect, useMemo, useState } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { Loader2, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

type StoredAsset = {
  id: string;
  name: string;
  account: string;
  acquisitionDate: string;
  acquisitionValue: number;
  usefulLifeMonths: number;
  depreciationMethod: 'linear' | 'declining';
  status: 'active' | 'disposed';
};

function getErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return 'Okänt fel';
}

export default function AssetsPage() {
  const { selectedCompany } = useCompany();
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    account: '1220',
    acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionValue: 0,
    usefulLifeMonths: 60,
    depreciationMethod: 'linear' as 'linear' | 'declining',
  });

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/accounting/assets?companyId=${selectedCompany.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load assets');
      setAssets(json.assets || []);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Kunde inte hämta tillgångar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  const addAsset = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/accounting/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          action: 'create',
          ...form,
          acquisitionValue: Number(form.acquisitionValue),
          usefulLifeMonths: Number(form.usefulLifeMonths),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Kunde inte skapa tillgång');
      setResult('Tillgång skapad.');
      setForm((f) => ({ ...f, name: '', acquisitionValue: 0 }));
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Kunde inte skapa tillgång');
    } finally {
      setLoading(false);
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!selectedCompany) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/accounting/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id, action: 'delete', assetId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Kunde inte ta bort tillgång');
      setResult('Tillgång borttagen.');
      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Kunde inte ta bort tillgång');
    } finally {
      setLoading(false);
    }
  };

  const activeCount = useMemo(() => assets.filter(a => a.status === 'active').length, [assets]);

  return (
    
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Anläggningsregister</h1>
            <p className="text-sm text-gray-500">Lägg in tillgångar för automatiska avskrivningar i bokslut.</p>
          </div>
          <div className="text-sm text-gray-600">
            Aktiva: <span className="font-semibold text-gray-900">{activeCount}</span> · Totalt: {assets.length}
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
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Lägg till tillgång</h2>
            <p className="text-xs text-gray-500">Minsta fält för att kunna beräkna avskrivning.</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm"
              placeholder="Namn (t.ex. MacBook Pro)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
              placeholder="Konto (t.ex. 1220)"
              value={form.account}
              onChange={(e) => setForm((f) => ({ ...f, account: e.target.value }))}
            />
            <input
              type="date"
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
              value={form.acquisitionDate}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))}
            />
            <input
              type="number"
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
              placeholder="Anskaffningsvärde"
              value={form.acquisitionValue}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionValue: Number(e.target.value) }))}
            />
            <input
              type="number"
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
              placeholder="Livslängd (mån)"
              value={form.usefulLifeMonths}
              onChange={(e) => setForm((f) => ({ ...f, usefulLifeMonths: Number(e.target.value) }))}
            />
            <select
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
              value={form.depreciationMethod}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  depreciationMethod: (e.target.value === 'declining' ? 'declining' : 'linear'),
                }))
              }
            >
              <option value="linear">Linjär</option>
              <option value="declining">Degressiv</option>
            </select>
            <button
              onClick={addAsset}
              disabled={loading || !form.name || !selectedCompany}
              className="md:col-span-6 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Lägg till
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Tillgångar</h2>
              <p className="text-xs text-gray-500">Används av bokslut → avskrivningar.</p>
            </div>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          <div className="divide-y divide-gray-100">
            {assets.map((a) => (
              <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">{a.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Konto {a.account} · {a.acquisitionDate} · {a.depreciationMethod === 'linear' ? 'Linjär' : 'Degressiv'} · {a.usefulLifeMonths} mån
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{a.acquisitionValue.toLocaleString('sv-SE')} kr</div>
                </div>
                <button
                  onClick={() => deleteAsset(a.id)}
                  disabled={loading}
                  className="px-3 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-2 text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  Ta bort
                </button>
              </div>
            ))}
            {assets.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-500">Inga tillgångar ännu.</div>
            )}
          </div>
        </div>
      </div>
    
  );
}



