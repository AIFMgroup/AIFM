'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  FileText,
  Building2,
  Loader2,
  RefreshCw,
  Calendar,
  User,
  TrendingUp,
  Copy,
  Edit3,
  Trash2,
  Download,
  Leaf,
  ShieldAlert,
} from 'lucide-react';
import type { SecurityApprovalRequest, SecurityApprovalSummary } from '@/lib/integrations/securities';

const STATUS_CONFIG = {
  draft: { label: 'Utkast', color: 'bg-gray-100 text-gray-700', icon: FileText },
  submitted: { label: 'Inskickad', color: 'bg-blue-100 text-blue-700', icon: Clock },
  under_review: { label: 'Granskas', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  approved: { label: 'Godkänd', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Avvisad', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Utgången', color: 'bg-gray-100 text-gray-500', icon: Calendar },
};

interface DraftInfo {
  id: string;
  name: string;
  isin: string;
  ticker: string;
  fundName: string;
  fundId: string;
  updatedAt: string;
  createdAt: string;
  step: number;
}

export default function SecuritiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [approvals, setApprovals] = useState<SecurityApprovalRequest[]>([]);
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [summary, setSummary] = useState<SecurityApprovalSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [copySearchQuery, setCopySearchQuery] = useState('');
  const [copySearchResults, setCopySearchResults] = useState<any[]>([]);
  const [isSearchingCopy, setIsSearchingCopy] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  useEffect(() => {
    if (searchParams.get('submitted') === 'true') {
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    loadApprovals();
    loadDrafts();
  }, [statusFilter]);

  const loadDrafts = async () => {
    try {
      const res = await fetch('/api/securities/drafts?userEmail=user@aifm.se');
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } catch (error) {
      console.error('Failed to load drafts:', error);
    }
  };

  const loadApprovals = async () => {
    setIsLoading(true);
    try {
      // Load summary
      const summaryRes = await fetch('/api/securities/approvals?summary=true');
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      // Load approvals with filter
      let url = '/api/securities/approvals?userEmail=user@aifm.se';
      if (statusFilter !== 'all') {
        url = `/api/securities/approvals?status=${statusFilter}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error('Failed to load approvals:', error);
    }
    setIsLoading(false);
  };

  const searchCopyApprovals = async (query: string) => {
    if (query.length < 2) {
      setCopySearchResults([]);
      return;
    }
    setIsSearchingCopy(true);
    try {
      const res = await fetch(`/api/securities/drafts?searchApproved=true&search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCopySearchResults(data.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
    setIsSearchingCopy(false);
  };

  const handleCopyApproval = async (sourceId: string) => {
    try {
      const res = await fetch('/api/securities/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          sourceId,
          targetFundId: 'fund-1', // Would be selected by user
          targetFundName: 'Nordic Ventures I',
          createdBy: 'Current User',
          createdByEmail: 'user@aifm.se',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/securities/new-approval?draftId=${data.draftId}`);
      }
    } catch (error) {
      console.error('Copy error:', error);
    }
    setShowCopyModal(false);
  };

  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Vill du radera detta utkast?')) return;
    try {
      const res = await fetch(`/api/securities/drafts?id=${draftId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadDrafts();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleDownloadPDF = async (approvalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/securities/pdf?id=${approvalId}&format=download`, '_blank');
  };

  const filteredApprovals = approvals.filter(approval => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      approval.basicInfo.name.toLowerCase().includes(query) ||
      approval.basicInfo.isin.toLowerCase().includes(query) ||
      approval.basicInfo.ticker.toLowerCase().includes(query) ||
      approval.fundName.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Värdepappersgodkännanden</h1>
              <p className="text-sm text-aifm-charcoal/40 mt-1">Hantera ansökningar för nya värdepapper i fonderna</p>
            </div>
            <button
              onClick={() => router.push('/securities/new-approval')}
              className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full hover:bg-aifm-charcoal/90 transition-all shadow-sm text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ny ansökan
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-aifm-gold/5 border border-aifm-gold/20 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-aifm-gold" />
            <div>
              <p className="font-medium text-aifm-charcoal">Ansökan skickad!</p>
              <p className="text-sm text-aifm-charcoal/60">Din ansökan har skickats till Operations för granskning.</p>
            </div>
          </div>
        )}

        {/* Drafts Section */}
        {drafts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-aifm-charcoal tracking-tight">Dina utkast</h2>
              <button
                onClick={() => setShowCopyModal(true)}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                Kopiera från tidigare
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  onClick={() => router.push(`/securities/new-approval?draftId=${draft.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-aifm-gold/30 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] cursor-pointer transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-aifm-charcoal truncate">
                        {draft.name || 'Namnlös ansökan'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        {draft.ticker && <span>{draft.ticker}</span>}
                        {draft.isin && <span>• {draft.isin}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2.5 py-0.5 text-xs font-medium bg-aifm-gold/10 text-aifm-charcoal/70 rounded-full">
                          Steg {draft.step}/8
                        </span>
                        <span className="text-xs text-gray-400">
                          {draft.fundName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/securities/new-approval?draftId=${draft.id}`);
                        }}
                        className="p-1.5 text-gray-400 hover:text-aifm-gold hover:bg-gray-100 rounded"
                        title="Redigera"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Radera"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      Senast ändrad: {new Date(draft.updatedAt).toLocaleDateString('sv-SE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Copy from Previous Modal */}
        {showCopyModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-aifm-charcoal tracking-tight">Kopiera från tidigare ansökan</h3>
                  <button
                    onClick={() => setShowCopyModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Sök bland godkända värdepapper och kopiera som ny ansökan
                </p>
              </div>
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={copySearchQuery}
                    onChange={(e) => {
                      setCopySearchQuery(e.target.value);
                      searchCopyApprovals(e.target.value);
                    }}
                    placeholder="Sök på namn, ISIN eller ticker..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
                    autoFocus
                  />
                  {isSearchingCopy && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                </div>
                <div className="mt-4 max-h-64 overflow-y-auto">
                  {copySearchResults.length === 0 && copySearchQuery.length >= 2 && !isSearchingCopy && (
                    <p className="text-sm text-gray-500 text-center py-4">Inga godkända ansökningar hittades</p>
                  )}
                  {copySearchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleCopyApproval(result.id)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-aifm-charcoal truncate">{result.name}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span>{result.ticker}</span>
                          <span>•</span>
                          <span>{result.isin}</span>
                        </div>
                      </div>
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-aifm-gold/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-aifm-gold" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-aifm-charcoal tracking-tight">{summary.totalPending}</p>
                  <p className="text-xs text-aifm-charcoal/40">Väntar på beslut</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-aifm-charcoal/60" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-aifm-charcoal tracking-tight">{summary.totalApproved}</p>
                  <p className="text-xs text-aifm-charcoal/40">Godkända</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-aifm-charcoal tracking-tight">{summary.totalRejected}</p>
                  <p className="text-xs text-aifm-charcoal/40">Avvisade</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-aifm-gold/8 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-aifm-gold" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-aifm-charcoal tracking-tight">{summary.expiringApprovals.length}</p>
                  <p className="text-xs text-aifm-charcoal/40">Utgår inom 30 dagar</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök på namn, ISIN, ticker eller fond..."
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
            >
              <option value="all">Alla status</option>
              <option value="draft">Utkast</option>
              <option value="submitted">Inskickade</option>
              <option value="approved">Godkända</option>
              <option value="rejected">Avvisade</option>
            </select>
            <button
              onClick={loadApprovals}
              className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full transition-all text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Uppdatera
            </button>
          </div>
        </div>

        {/* Approvals List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Inga ansökningar hittades</p>
              <button
                onClick={() => router.push('/securities/new-approval')}
                className="mt-4 text-aifm-gold hover:underline"
              >
                Skapa ny ansökan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredApprovals.map((approval) => {
                const statusConfig = STATUS_CONFIG[approval.status];
                const StatusIcon = statusConfig.icon;
                const daysUntilExpiry = approval.expiresAt ? getDaysUntilExpiry(approval.expiresAt) : null;

                return (
                  <div
                    key={approval.id}
                    onClick={() => router.push(`/securities/${approval.id}`)}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/5 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-aifm-charcoal/60" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-aifm-charcoal truncate">
                          {approval.basicInfo.name}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{approval.basicInfo.ticker}</span>
                        <span>•</span>
                        <span>{approval.basicInfo.isin}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {approval.fundName}
                        </span>
                        {approval.esgInfo && (
                          <>
                            <span>•</span>
                            {approval.esgInfo.meetsExclusionCriteria ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <Leaf className="w-3 h-3" />
                                ESG OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600">
                                <ShieldAlert className="w-3 h-3" />
                                ESG-varning
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:block text-right">
                      <p className="text-sm text-gray-500">
                        {approval.status === 'approved' && daysUntilExpiry !== null ? (
                          <span className={daysUntilExpiry < 30 ? 'text-amber-600' : ''}>
                            Utgår om {daysUntilExpiry} dagar
                          </span>
                        ) : (
                          formatDate(approval.updatedAt)
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {approval.createdBy}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {(approval.status === 'approved' || approval.status === 'submitted') && (
                        <button
                          onClick={(e) => handleDownloadPDF(approval.id, e)}
                          className="p-1.5 text-gray-400 hover:text-aifm-gold hover:bg-gray-100 rounded"
                          title="Ladda ner PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expiring Soon Section */}
        {summary && summary.expiringApprovals.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-aifm-charcoal mb-4">Utgår snart</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-amber-200">
                {summary.expiringApprovals.map((approval) => {
                  const daysUntilExpiry = getDaysUntilExpiry(approval.expiresAt!);
                  
                  return (
                    <div
                      key={approval.id}
                      onClick={() => router.push(`/securities/${approval.id}`)}
                      className="flex items-center gap-4 p-4 hover:bg-aifm-gold/5 cursor-pointer transition-colors"
                    >
                      <AlertCircle className="w-5 h-5 text-aifm-gold flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-aifm-charcoal">{approval.basicInfo.name}</p>
                        <p className="text-sm text-aifm-charcoal/60">{approval.fundName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-aifm-charcoal">
                          {daysUntilExpiry} dagar kvar
                        </p>
                        <p className="text-xs text-aifm-charcoal/40">
                          Utgår {formatDate(approval.expiresAt!)}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-aifm-charcoal/30" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
