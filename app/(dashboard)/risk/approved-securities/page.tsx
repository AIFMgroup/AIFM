'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Loader2,
  Building2,
  User,
  Filter,
} from 'lucide-react';

interface ApprovalRow {
  id: string;
  status: string;
  fundId: string;
  fundName: string;
  createdBy: string;
  createdByEmail: string;
  basicInfo: { name: string; isin?: string };
  reviewedAt?: string;
  expiresAt?: string;
}

export default function AllApprovedSecuritiesPage() {
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFund, setFilterFund] = useState('');
  const [filterForvaltare, setFilterForvaltare] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/securities/approvals?status=approved')
      .then((r) => r.json())
      .then((data: { approvals?: ApprovalRow[] }) => {
        if (!cancelled) setApprovals(data.approvals || []);
      })
      .catch(() => setApprovals([]))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const funds = useMemo(() => {
    const set = new Set(approvals.map((a) => a.fundId));
    return Array.from(set).map((id) => {
      const a = approvals.find((x) => x.fundId === id);
      return { id, name: a?.fundName ?? id };
    });
  }, [approvals]);

  const forvaltares = useMemo(() => {
    const set = new Set(approvals.map((a) => a.createdByEmail));
    return Array.from(set).sort();
  }, [approvals]);

  const filtered = useMemo(() => {
    return approvals.filter((a) => {
      if (filterFund && a.fundId !== filterFund) return false;
      if (filterForvaltare && a.createdByEmail !== filterForvaltare) return false;
      return true;
    });
  }, [approvals, filterFund, filterForvaltare]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-aifm-charcoal">Alla godkända värdepapper</h1>
        <p className="text-sm text-aifm-charcoal/60 mt-1">
          Översikt över alla godkända värdepapper. Filtrera per fond eller förvaltare.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <span className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="w-4 h-4" />
              Filtrera:
            </span>
            <select
              value={filterFund}
              onChange={(e) => setFilterFund(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            >
              <option value="">Alla fonder</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={filterForvaltare}
              onChange={(e) => setFilterForvaltare(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            >
              <option value="">Alla förvaltare</option>
              {forvaltares.map((email) => (
                <option key={email} value={email}>
                  {email}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Värdepapper</th>
                    <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Fond</th>
                    <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Förvaltare</th>
                    <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Godkänt</th>
                    <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Utgång</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        Inga godkända värdepapper
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-aifm-charcoal">
                            {a.basicInfo?.name || a.id}
                          </span>
                          {a.basicInfo?.isin && (
                            <span className="text-xs text-gray-500 ml-1">{a.basicInfo.isin}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-aifm-charcoal/80 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {a.fundName}
                        </td>
                        <td className="py-3 px-4 text-aifm-charcoal/80 flex items-center gap-1.5">
                          <User className="w-4 h-4 text-gray-400" />
                          {a.createdByEmail}
                        </td>
                        <td className="py-3 px-4 text-aifm-charcoal/80">
                          {a.reviewedAt
                            ? new Date(a.reviewedAt).toLocaleDateString('sv-SE', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '–'}
                        </td>
                        <td className="py-3 px-4 text-aifm-charcoal/80">
                          {a.expiresAt
                            ? new Date(a.expiresAt).toLocaleDateString('sv-SE', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '–'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
