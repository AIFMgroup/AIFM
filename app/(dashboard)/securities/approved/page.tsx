'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  RefreshCw,
  FileText,
  Loader2,
  Building2,
} from 'lucide-react';

interface ApprovalRow {
  id: string;
  status: string;
  fundId: string;
  fundName: string;
  basicInfo: { name: string; isin?: string };
  reviewedAt?: string;
  expiresAt?: string;
  reviewComments?: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function ApprovedSecuritiesPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/role', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { email?: string | null }) => {
        if (!cancelled) setEmail(data.email ?? null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/securities/approvals?userEmail=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data: { approvals?: ApprovalRow[] }) => {
        if (!cancelled) {
          const list = data.approvals || [];
          setApprovals(list.filter((a: ApprovalRow) => a.status === 'approved'));
        }
      })
      .catch(() => { if (!cancelled) setApprovals([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [email]);

  const handleRenew = async (approval: ApprovalRow) => {
    setRenewingId(approval.id);
    try {
      const res = await fetch('/api/securities/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          sourceId: approval.id,
          targetFundId: approval.fundId,
          targetFundName: approval.fundName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kunde inte skapa utkast');
      if (data.draftId) {
        router.push(`/securities/new-approval?draftId=${data.draftId}`);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setRenewingId(null);
    }
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const exp = new Date(expiresAt).getTime();
    return exp - Date.now() < THIRTY_DAYS_MS && exp > Date.now();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-aifm-charcoal">Godkända värdepapper</h1>
        <p className="text-sm text-aifm-charcoal/60 mt-1">
          Översikt över dina godkända värdepapper. Godkännanden gäller 12 månader.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-aifm-charcoal/70">Inga godkända värdepapper</p>
          <Link
            href="/securities/new-approval"
            className="inline-flex items-center gap-2 mt-4 text-aifm-gold font-medium hover:underline"
          >
            Ansök om nytt värdepapper
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Värdepapper</th>
                  <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Fond</th>
                  <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Godkänt</th>
                  <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Utgång</th>
                  <th className="text-left py-3 px-4 font-semibold text-aifm-charcoal">Kommentar</th>
                  <th className="text-right py-3 px-4 font-semibold text-aifm-charcoal">Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-aifm-charcoal">{a.basicInfo?.name || a.id}</span>
                        {a.basicInfo?.isin && (
                          <span className="text-xs text-gray-500">{a.basicInfo.isin}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-aifm-charcoal/80">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {a.fundName}
                      </span>
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
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5">
                        {a.expiresAt ? (
                          new Date(a.expiresAt).toLocaleDateString('sv-SE', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        ) : (
                          '–'
                        )}
                        {isExpiringSoon(a.expiresAt) && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
                            title="Utgår inom 30 dagar"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Snart utgång
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <span className="text-aifm-charcoal/80 line-clamp-2" title={a.reviewComments}>
                        {a.reviewComments?.trim() || '–'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRenew(a)}
                        disabled={!!renewingId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-aifm-gold border border-aifm-gold/40 rounded-lg hover:bg-aifm-gold/10 disabled:opacity-50"
                      >
                        {renewingId === a.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        Förnya
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
