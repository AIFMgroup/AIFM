'use client';


import { useEffect, useMemo, useState } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';

type Recipient = {
  supplierName: string;
  supplierKey: string;
  iban?: string;
  bic?: string;
  bankgiro?: string;
  plusgiro?: string;
  referenceHint?: string;
  updatedAt: string;
};

export default function PaymentRecipientsPage() {
  const { selectedCompany } = useCompany();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [bankgiro, setBankgiro] = useState('');
  const [plusgiro, setPlusgiro] = useState('');
  const [referenceHint, setReferenceHint] = useState('');

  const canLoad = !!selectedCompany?.id;

  const load = async () => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounting/payment-recipients?companyId=${selectedCompany.id}`);
      const data = await res.json();
      setRecipients(data.recipients || []);
    } catch (e) {
      setError('Kunde inte hämta mottagare.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  const sorted = useMemo(() => {
    return [...recipients].sort((a, b) => (a.supplierName || '').localeCompare(b.supplierName || ''));
  }, [recipients]);

  const save = async () => {
    if (!selectedCompany?.id) return;
    if (!supplierName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/accounting/payment-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          supplierName: supplierName.trim(),
          iban: iban.trim() || undefined,
          bic: bic.trim() || undefined,
          bankgiro: bankgiro.trim() || undefined,
          plusgiro: plusgiro.trim() || undefined,
          referenceHint: referenceHint.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'Save failed');
      }

      setSupplierName('');
      setIban('');
      setBic('');
      setBankgiro('');
      setPlusgiro('');
      setReferenceHint('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara mottagare.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (supplierKey: string) => {
    if (!selectedCompany?.id) return;
    if (!confirm('Ta bort mottagare?')) return;
    try {
      await fetch('/api/accounting/payment-recipients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id, supplierKey }),
      });
      await load();
    } catch (e) {
      setError('Kunde inte ta bort mottagare.');
    }
  };

  return (
    
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Mottagare (bankuppgifter)</h1>
            <p className="text-sm text-gray-500 mt-1">Lägg in IBAN/BIC per leverantör för att kunna exportera betalfiler (pain.001).</p>
          </div>
          <button onClick={load} className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Uppdatera
          </button>
        </div>

        {!canLoad && (
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            Välj ett bolag först.
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Leverantör *</label>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20" placeholder="t.ex. Telia AB" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Referenshint</label>
              <input value={referenceHint} onChange={(e) => setReferenceHint(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20" placeholder="t.ex. OCR/meddelande-format" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">IBAN</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20" placeholder="SE..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">BIC</label>
              <input value={bic} onChange={(e) => setBic(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20" placeholder="t.ex. ESSESESS" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Bankgiro</label>
              <input value={bankgiro} onChange={(e) => setBankgiro(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20" placeholder="XXXX-XXXX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Plusgiro</label>
              <input value={plusgiro} onChange={(e) => setPlusgiro(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20" placeholder="XXXXXXX-X" />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={save}
              disabled={!canLoad || saving || !supplierName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Spara
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Registrerade mottagare</h2>
            <span className="text-xs text-gray-500">{sorted.length} st</span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Laddar...
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-sm text-gray-500">Inga mottagare ännu.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leverantör</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IBAN</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BIC</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BG/PG</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map((r) => (
                    <tr key={r.supplierKey} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{r.supplierName}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.iban || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.bic || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{[r.bankgiro, r.plusgiro].filter(Boolean).join(' / ') || '-'}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => remove(r.supplierKey)} className="px-3 py-1.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          Ta bort
                        </button>
                      </td>
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



