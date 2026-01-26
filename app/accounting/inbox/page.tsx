'use client';


import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { useCompany } from '@/components/CompanyContext';
import { DocumentDetailView } from '@/components/accounting/DocumentDetailViews';
import {
  PageHeader, Card, CardHeader, CardTitle, Button, Badge, Tabs, 
  StatCard, EmptyState
} from '@/components/ui/design-system';
import { 
  AlertTriangle, CheckCircle2, Clock, Loader2, Play, RefreshCw, 
  Send, XCircle, Inbox, FileCheck, Database, ChevronRight, Eye
} from 'lucide-react';
import type { AccountingJob } from '@/lib/accounting/jobStore';

type ApprovalLevel = 'AUTO' | 'STANDARD' | 'MANAGER' | 'EXECUTIVE';
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'DELEGATED';

interface ApprovalRequest {
  id: string;
  jobId: string;
  companyId: string;
  requestedLevel: ApprovalLevel;
  currentStatus: ApprovalStatus;
  amount: number;
  supplier: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
}

interface InboxItem {
  job: AccountingJob;
  flags: {
    hasCriticalValidation: boolean;
    hasPolicyBlock: boolean;
    hasFx: boolean;
    hasFxMissing: boolean;
  };
  validation: unknown;
}

interface FortnoxIssue {
  companyId: string;
  jobId: string;
  status: 'error' | 'dead_letter';
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  updatedAt: string;
}

interface InboxResponse {
  summary: {
    totalJobs: number;
    needsReview: number;
    errors: number;
    needsApproval: number;
    fortnoxIssues: number;
    ocrFailures: number;
  };
  review: InboxItem[];
  approvals: ApprovalRequest[];
  fortnoxIssues: FortnoxIssue[];
}

export default function AccountingInboxPage() {
  return (
    <Suspense fallback={
      
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
        </div>
      
    }>
      <AccountingInboxContent />
    </Suspense>
  );
}

function AccountingInboxContent() {
  const { selectedCompany } = useCompany();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'review' | 'approvals' | 'fortnox'>('review');
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueResult, setQueueResult] = useState<{ success: boolean; message: string } | null>(null);

  const urlJobId = searchParams.get('job');

  const load = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/inbox?companyId=${selectedCompany.id}`);
      if (!res.ok) throw new Error('Failed to load inbox');
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  useEffect(() => {
    if (urlJobId && data && !selectedJobId) {
      const jobExists = data.review.some(i => i.job.id === urlJobId);
      if (jobExists) {
        setSelectedJobId(urlJobId);
        setActiveTab('review');
      }
    }
  }, [urlJobId, data, selectedJobId]);

  const selectedJob = useMemo(() => {
    if (!data || !selectedJobId) return null;
    const fromReview = data.review.find(i => i.job.id === selectedJobId)?.job;
    if (fromReview) return fromReview;
    return null;
  }, [data, selectedJobId]);

  const handleViewDocument = async (jobId: string) => {
    try {
      const response = await fetch(`/api/accounting/jobs/${jobId}/document`);
      if (!response.ok) throw new Error('Failed to get document URL');
      const d = await response.json();
      window.open(d.url, '_blank');
    } catch (e) {
      console.error('Failed to view document:', e);
      alert('Kunde inte öppna dokumentet');
    }
  };

  const handleUpdateLineItem = async (jobId: string, lineItemId: string, field: string, value: string) => {
    try {
      await fetch(`/api/accounting/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineItems: [{ id: lineItemId, [field]: value }] }),
      });
      await load();
    } catch (e) {
      console.error('Update error:', e);
      await load();
    }
  };

  const handleUpdateClassification = async (jobId: string, updates: Record<string, unknown>) => {
    try {
      await fetch(`/api/accounting/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification: updates }),
      });
      await load();
    } catch (e) {
      console.error('Update classification error:', e);
      await load();
    }
  };

  const handleApprove = async (jobId: string) => {
    await fetch('/accounting/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action: 'approve' }),
    });
    await load();
  };

  const handleSendToFortnox = async (jobId: string) => {
    await fetch('/accounting/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, action: 'sendToFortnox' }),
    });
    await load();
  };

  const approveRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!data) return;
    setBusy(requestId);
    try {
      const body =
        action === 'approve'
          ? { companyId: selectedCompany?.id, requestId, action: 'approve' }
          : { companyId: selectedCompany?.id, requestId, action: 'reject', reason: 'Avvisad' };

      const res = await fetch('/api/accounting/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Approval action failed');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const processFortnoxQueue = async () => {
    if (!selectedCompany) return;
    setProcessingQueue(true);
    setQueueResult(null);
    try {
      const res = await fetch('/api/fortnox/posting-queue/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setQueueResult({ success: true, message: `Kön processad. ${json.processed ?? 0} jobb hanterade.` });
      } else {
        setQueueResult({ success: false, message: json.error || 'Kunde inte processa kön' });
      }
      await load();
    } catch (e: unknown) {
      setQueueResult({ success: false, message: e instanceof Error ? e.message : 'Nätverksfel' });
    } finally {
      setProcessingQueue(false);
    }
  };

  const retryFortnoxJob = async (jobId: string) => {
    if (!selectedCompany) return;
    setBusy(jobId);
    try {
      const res = await fetch('/api/fortnox/posting-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id, jobId, action: 'retry' }),
      });
      if (!res.ok) throw new Error('Retry failed');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const tabs = [
    { key: 'review', label: 'Granskning', count: data?.summary.needsReview, icon: <Eye className="w-4 h-4" /> },
    { key: 'approvals', label: 'Attest', count: data?.summary.needsApproval, icon: <FileCheck className="w-4 h-4" /> },
    { key: 'fortnox', label: 'Fortnox-fel', count: data?.summary.fortnoxIssues, icon: <Database className="w-4 h-4" /> },
  ];

  return (
    
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader
          title="Inkorg"
          description="Agenten hanterar majoriteten automatiskt. Här hamnar undantag som behöver mänsklig granskning/attest."
          icon={<Inbox className="w-5 h-5" />}
          actions={
            <Button
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={load}
              loading={loading}
            >
              Uppdatera
            </Button>
          }
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Behöver granskning"
            value={data?.summary.needsReview ?? '—'}
            icon={<Clock className="w-4 h-4" />}
            accentColor="gold"
          />
          <StatCard
            label="Fel"
            value={data?.summary.errors ?? '—'}
            icon={<XCircle className="w-4 h-4" />}
            accentColor="red"
          />
          <StatCard
            label="Attest"
            value={data?.summary.needsApproval ?? '—'}
            icon={<AlertTriangle className="w-4 h-4" />}
            accentColor="blue"
          />
          <StatCard
            label="Fortnox fel/DLQ"
            value={data?.summary.fortnoxIssues ?? '—'}
            icon={<Send className="w-4 h-4" />}
            accentColor={data?.summary.fortnoxIssues && data.summary.fortnoxIssues > 0 ? 'red' : 'green'}
          />
          <StatCard
            label="OCR-fel"
            value={data?.summary.ocrFailures ?? '—'}
            icon={<AlertTriangle className="w-4 h-4" />}
            accentColor="gray"
          />
        </div>

        {/* Tabs */}
        <Card padding="none">
          <div className="px-2 pt-2">
            <Tabs 
              tabs={tabs} 
              activeTab={activeTab} 
              onChange={(key) => setActiveTab(key as typeof activeTab)} 
              variant="pills" 
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3 text-gray-600 py-16">
              <div className="w-5 h-5 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Laddar inkorg...</span>
            </div>
          )}

          {!loading && data && activeTab === 'review' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              {/* Document List */}
              <div>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Dokument</h2>
                    <p className="text-xs text-gray-400">Klicka för att granska och korrigera</p>
                  </div>
                  <Badge variant="default">{data.review.length} st</Badge>
                </div>
                <div className="divide-y divide-gray-50 max-h-[70vh] overflow-auto">
                  {data.review.map((item) => (
                    <button
                      key={item.job.id}
                      onClick={() => setSelectedJobId(item.job.id)}
                      className={`w-full text-left px-5 py-4 transition-colors ${
                        selectedJobId === item.job.id 
                          ? 'bg-[#c0a280]/5 border-l-2 border-l-[#c0a280]' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {item.job.classification?.supplier || item.job.fileName}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.job.classification?.invoiceDate || item.job.createdAt?.split('T')[0]} · {' '}
                            <span className="font-medium">
                              {item.job.classification?.totalAmount?.toLocaleString('sv-SE')} {item.job.classification?.currency}
                            </span>
                          </div>
                          {item.job.classification?.policy?.summary && (
                            <div className="text-xs text-amber-600 mt-1.5 bg-amber-50 px-2 py-1 rounded inline-block">
                              {item.job.classification.policy.summary}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant={item.job.status === 'error' ? 'error' : 'warning'}>
                            {item.job.status === 'error' ? 'Fel' : 'Granska'}
                          </Badge>
                          {item.flags.hasCriticalValidation && <Badge variant="error" size="sm">Validering</Badge>}
                          {item.flags.hasPolicyBlock && <Badge variant="error" size="sm">Policy</Badge>}
                          {item.flags.hasFx && <Badge variant="info" size="sm">FX</Badge>}
                        </div>
                      </div>
                    </button>
                  ))}
                  {data.review.length === 0 && (
                    <EmptyState
                      icon={<CheckCircle2 />}
                      title="Allt i ordning"
                      description="Inga dokument behöver granskas just nu"
                    />
                  )}
                </div>
              </div>

              {/* Detail View */}
              <div>
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Granskning</h2>
                  <p className="text-xs text-gray-400">Förklaringar, korrigering och attest/skicka</p>
                </div>
                <div className="p-4">
                  {selectedJob ? (
                    <DocumentDetailView
                      job={selectedJob}
                      onClose={() => setSelectedJobId(null)}
                      onApprove={async () => { await handleApprove(selectedJob.id); }}
                      onSendToFortnox={async () => { await handleSendToFortnox(selectedJob.id); }}
                      onUpdateLineItem={(lineItemId, field, value) => handleUpdateLineItem(selectedJob.id, lineItemId, field, value)}
                      onUpdateClassification={async (updates) =>
                        handleUpdateClassification(
                          selectedJob.id,
                          updates as Partial<NonNullable<AccountingJob['classification']>>
                        )
                      }
                      onViewDocument={() => handleViewDocument(selectedJob.id)}
                    />
                  ) : (
                    <div className="py-16 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <ChevronRight className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-500">Välj ett dokument till vänster</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && data && activeTab === 'approvals' && (
            <div>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Attestkö</h2>
                  <p className="text-xs text-gray-400">Väntar på godkännande enligt belopp/risk</p>
                </div>
                <Badge variant="default">{data.approvals.length} st</Badge>
              </div>
              <div className="divide-y divide-gray-50">
                {data.approvals.map((req) => (
                  <div key={req.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{req.supplier}</div>
                      <div className="text-xs text-gray-500 mt-1">{req.description}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="accent">{req.amount.toLocaleString('sv-SE')} kr</Badge>
                        <Badge variant="default">Nivå {req.requestedLevel}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy === req.id}
                        onClick={() => approveRequest(req.id, 'reject')}
                      >
                        Avvisa
                      </Button>
                      <Button
                        size="sm"
                        loading={busy === req.id}
                        icon={<CheckCircle2 className="w-4 h-4" />}
                        onClick={() => approveRequest(req.id, 'approve')}
                      >
                        Godkänn
                      </Button>
                    </div>
                  </div>
                ))}
                {data.approvals.length === 0 && (
                  <EmptyState
                    icon={<CheckCircle2 />}
                    title="Ingen väntande attest"
                    description="Alla dokument är godkända"
                  />
                )}
              </div>
            </div>
          )}

          {!loading && data && activeTab === 'fortnox' && (
            <div>
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Fortnox fel / Dead-letter</h2>
                  <p className="text-xs text-gray-400">Postningar som behöver åtgärd</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="default">{data.fortnoxIssues.length} st</Badge>
                  <Button
                    variant="accent"
                    size="sm"
                    icon={<Play className="w-4 h-4" />}
                    loading={processingQueue}
                    onClick={processFortnoxQueue}
                  >
                    Kör kö
                  </Button>
                </div>
              </div>
              {queueResult && (
                <div className={`px-5 py-3 text-sm flex items-center gap-2 ${
                  queueResult.success 
                    ? 'bg-emerald-50 text-emerald-800' 
                    : 'bg-red-50 text-red-800'
                }`}>
                  {queueResult.success 
                    ? <CheckCircle2 className="w-4 h-4" /> 
                    : <XCircle className="w-4 h-4" />
                  }
                  {queueResult.message}
                </div>
              )}
              <div className="divide-y divide-gray-50">
                {data.fortnoxIssues.map((it) => (
                  <div key={`${it.companyId}-${it.jobId}`} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">Jobb {it.jobId.slice(0, 8)}...</span>
                        <Badge variant={it.status === 'dead_letter' ? 'error' : 'warning'}>
                          {it.status === 'dead_letter' ? 'DLQ' : 'Fel'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        Försök: {it.attempts} · Status: {it.status}
                      </div>
                      {it.nextRetryAt && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          Nästa försök: {new Date(it.nextRetryAt).toLocaleString('sv-SE')}
                        </div>
                      )}
                      {it.lastError && (
                        <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded">
                          {it.lastError}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy === it.jobId}
                        onClick={() => retryFortnoxJob(it.jobId)}
                      >
                        Försök igen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveTab('review');
                          setSelectedJobId(it.jobId);
                        }}
                      >
                        Öppna
                      </Button>
                    </div>
                  </div>
                ))}
                {data.fortnoxIssues.length === 0 && (
                  <EmptyState
                    icon={<CheckCircle2 />}
                    title="Inga Fortnox-fel"
                    description="Alla postningar har gått igenom utan problem"
                  />
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    
  );
}
