'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Building2,
  User,
  ExternalLink,
  Sparkles,
  Bot,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { ApprovalDiscussion } from '@/components/securities/ApprovalDiscussion';
import { AuditTrailPanel } from '@/components/securities/AuditTrailPanel';

interface ApprovalComment {
  id: string;
  approvalId: string;
  author: string;
  authorEmail: string;
  role: 'forvaltare' | 'operation';
  message: string;
  createdAt: string;
}

interface ApprovalItem {
  id: string;
  status: string;
  fundId: string;
  fundName: string;
  createdBy: string;
  createdByEmail: string;
  basicInfo: { name: string; isin?: string; ticker?: string };
  esgInfo?: { fundArticle?: string };
  submittedAt?: string;
  updatedAt?: string;
  infoRequest?: string;
  infoResponse?: string;
  comments?: ApprovalComment[];
  auditTrail?: Array<{ timestamp: string; action: string; actor: string; actorEmail: string; details?: string }>;
}

interface AIReviewResult {
  analysis: string;
  model: string;
  approvalId: string;
  fundName: string;
  securityName: string;
}

function AIAnalysisPanel({
  approvalId,
  securityName,
}: {
  approvalId: string;
  securityName: string;
}) {
  const [result, setResult] = useState<AIReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setRequested(true);
    try {
      const res = await fetch('/api/securities/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI-analys misslyckades');
      }
      const data: AIReviewResult = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setLoading(false);
    }
  };

  if (!requested) {
    return (
      <button
        type="button"
        onClick={runAnalysis}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-aifm-charcoal bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-all"
      >
        <Sparkles className="w-4 h-4 text-purple-600" />
        AI-analys (Claude Opus)
      </button>
    );
  }

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/80 to-indigo-50/80 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100">
            <Bot className="w-5 h-5 text-purple-600 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-semibold text-purple-900">AI analyserar...</p>
            <p className="text-xs text-purple-600">
              Claude Opus granskar {securityName} mot fondvillkoren
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-purple-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Djupanalys pågår – detta kan ta 10–30 sekunder...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-5">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-sm font-semibold text-red-900">AI-analys misslyckades</p>
        </div>
        <p className="text-sm text-red-700 mb-3">{error}</p>
        <button
          type="button"
          onClick={runAnalysis}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-lg hover:bg-red-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Försök igen
        </button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-purple-100/60 to-indigo-100/60 border-b border-purple-200/60">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600 shadow-sm">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-purple-900">
            AI-bedömning — {result.securityName}
          </p>
          <p className="text-xs text-purple-600">
            Claude 4.6 Opus · {result.fundName}
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          className="p-1.5 rounded-lg text-purple-500 hover:text-purple-700 hover:bg-purple-100 transition-colors"
          title="Kör analysen igen"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4 text-sm text-aifm-charcoal/90 leading-relaxed prose prose-sm max-w-none prose-headings:text-aifm-charcoal prose-headings:font-semibold prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:my-1.5 prose-ul:my-1 prose-li:my-0.5">
        <MarkdownRenderer content={result.analysis} />
      </div>
      <div className="px-5 py-2.5 bg-purple-50/50 border-t border-purple-100 flex items-center gap-2 text-xs text-purple-500">
        <Sparkles className="w-3 h-3" />
        <span>
          AI-genererad analys — använd som beslutsunderlag, inte som slutgiltigt beslut
        </span>
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const blocks = content.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc pl-5 my-1.5 space-y-0.5">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  for (const line of blocks) {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-base font-semibold mt-4 mb-2 text-aifm-charcoal">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-lg font-semibold mt-4 mb-2 text-aifm-charcoal">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={key++} className="my-1.5 text-sm">
          {renderInline(trimmed)}
        </p>
      );
    }
  }
  flushList();

  return <>{elements}</>;
}

export default function ReviewSecuritiesPage() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerEmail, setReviewerEmail] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModalFor, setRejectModalFor] = useState<ApprovalItem | null>(null);
  const [approveComment, setApproveComment] = useState<Record<string, string>>({});
  const [requestInfoModalFor, setRequestInfoModalFor] = useState<ApprovalItem | null>(null);
  const [requestInfoQuestion, setRequestInfoQuestion] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/role', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { email?: string | null }) => {
        if (!cancelled) {
          setReviewerEmail(data.email ?? '');
          setReviewerName(data.email?.split('@')[0] ?? 'Granskare');
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadApprovals = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/securities/approvals?status=submitted').then((r) => r.json()),
      fetch('/api/securities/approvals?status=needs_info').then((r) => r.json()),
    ])
      .then(([submittedData, needsInfoData]) => {
        const submitted = (submittedData.approvals || []) as ApprovalItem[];
        const needsInfo = (needsInfoData.approvals || []) as ApprovalItem[];
        const merged = [...submitted, ...needsInfo].sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        setApprovals(merged);
      })
      .catch(() => setApprovals([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleApprove = async (item: ApprovalItem) => {
    setActioningId(item.id);
    try {
      const res = await fetch('/api/securities/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          action: 'approve',
          reviewedBy: reviewerName,
          reviewedByEmail: reviewerEmail,
          comments: approveComment[item.id]?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Kunde inte godkänna');
      }
      setApprovals((prev) => prev.filter((a) => a.id !== item.id));
      setExpandedId(null);
      setApproveComment((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectModalFor || !rejectReason.trim()) return;
    const item = rejectModalFor;
    setActioningId(item.id);
    try {
      const res = await fetch('/api/securities/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          action: 'reject',
          reviewedBy: reviewerName,
          reviewedByEmail: reviewerEmail,
          reason: rejectReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Kunde inte avvisa');
      }
      setApprovals((prev) => prev.filter((a) => a.id !== item.id));
      setExpandedId(null);
      setRejectModalFor(null);
      setRejectReason('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setActioningId(null);
    }
  };

  const handleRequestInfoSubmit = async () => {
    if (!requestInfoModalFor || !requestInfoQuestion.trim()) return;
    const item = requestInfoModalFor;
    setActioningId(item.id);
    try {
      const res = await fetch('/api/securities/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          action: 'request_info',
          reviewedBy: reviewerName,
          reviewedByEmail: reviewerEmail,
          question: requestInfoQuestion.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Kunde inte skicka begäran');
      }
      setApprovals((prev) => prev.filter((a) => a.id !== item.id));
      setExpandedId(null);
      setRequestInfoModalFor(null);
      setRequestInfoQuestion('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-aifm-charcoal">Granska värdepapper</h1>
        <p className="text-sm text-aifm-charcoal/60 mt-1">
          Ansökningar som väntar på granskning. Öppna för att se detaljer, kör AI-analys och godkänn eller avvisa.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-aifm-gold" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500/60 mx-auto mb-3" />
          <p className="text-aifm-charcoal/70">Inga ansökningar att granska</p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
              >
                {expandedId === item.id ? (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <FileText className="w-5 h-5 text-aifm-gold flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-aifm-charcoal truncate">
                    {item.basicInfo?.name || item.id}
                  </p>
                  <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {item.fundName}
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {item.createdByEmail}
                    </span>
                    {item.esgInfo?.fundArticle && (
                      <span>Art. {item.esgInfo.fundArticle}</span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleDateString('sv-SE')
                    : ''}
                </span>
              </button>

              {expandedId === item.id && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50">
                  <div className="flex flex-wrap gap-3 mb-4">
                    <a
                      href={`/securities/${item.id}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-aifm-charcoal bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Visa fullständig ansökan
                    </a>
                    <a
                      href={`/api/securities/pdf?id=${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-aifm-gold hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Öppna PDF
                    </a>
                  </div>

                  <AIAnalysisPanel
                    approvalId={item.id}
                    securityName={item.basicInfo?.name || item.id}
                  />

                  <div className="mt-4">
                    <AuditTrailPanel auditTrail={item.auditTrail} />
                  </div>
                  <div className="mt-4">
                    <ApprovalDiscussion
                      approvalId={item.id}
                      comments={item.comments}
                      currentUserName={reviewerName}
                      currentUserEmail={reviewerEmail}
                      currentUserRole="operation"
                      onCommentAdded={loadApprovals}
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Villkor / Kommentar (valfritt)
                    </label>
                    <textarea
                      value={approveComment[item.id] ?? ''}
                      onChange={(e) =>
                        setApproveComment((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold mb-3"
                      placeholder="T.ex. villkor eller kommentar till förvaltaren..."
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(item)}
                      disabled={!!actioningId}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {actioningId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Godkänn
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestInfoModalFor(item)}
                      disabled={!!actioningId}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Begär komplettering
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectModalFor(item)}
                      disabled={!!actioningId}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Avvisa
                    </button>
                  </div>
                  {item.status === 'needs_info' && item.infoResponse && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm">
                      <p className="font-medium text-amber-900 mb-1">Svar från förvaltare</p>
                      <p className="text-amber-800 whitespace-pre-wrap">{item.infoResponse}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {requestInfoModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { if (!actioningId) { setRequestInfoModalFor(null); setRequestInfoQuestion(''); } }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-aifm-charcoal mb-2">Begär komplettering</h3>
            <p className="text-sm text-gray-600 mb-4">
              {requestInfoModalFor.basicInfo?.name || requestInfoModalFor.id}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fråga till förvaltare (obligatoriskt)
            </label>
            <textarea
              value={requestInfoQuestion}
              onChange={(e) => setRequestInfoQuestion(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              placeholder="Vad behöver du veta för att kunna granska ansökan?"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setRequestInfoModalFor(null); setRequestInfoQuestion(''); }}
                disabled={!!actioningId}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleRequestInfoSubmit}
                disabled={!requestInfoQuestion.trim() || !!actioningId}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                Skicka begäran
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!actioningId) setRejectModalFor(null);
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-aifm-charcoal mb-2">Avvisa ansökan</h3>
            <p className="text-sm text-gray-600 mb-4">
              {rejectModalFor.basicInfo?.name || rejectModalFor.id}
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivering (obligatoriskt)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              placeholder="Ange varför ansökan avvisas..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setRejectModalFor(null);
                  setRejectReason('');
                }}
                disabled={!!actioningId}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || !!actioningId}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Avvisa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
