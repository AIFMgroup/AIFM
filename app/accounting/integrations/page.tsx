'use client';


import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { 
  PageHeader, Card, Button, Badge, StatCard, Tabs, EmptyState 
} from '@/components/ui/design-system';
import { 
  CheckCircle2, AlertTriangle, RefreshCw, Play, Link2, 
  Zap, Database, Clock, RotateCcw, ExternalLink, Plug
} from 'lucide-react';

type FortnoxStatus = {
  connected: boolean;
  connectedAt?: string;
  fortnoxCompanyName?: string;
  fortnoxCompanyId?: string;
  lastSync?: string;
  lastError?: string | null;
  revokedAt?: string | null;
  bootstrapStatus?: string;
  bootstrapStartedAt?: string | null;
  bootstrapFinishedAt?: string | null;
  bootstrapLastError?: string | null;
  expiresAt?: string;
};

type IntegrationJob = {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

type FortnoxPostingRecord = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'dead_letter';
  attempts: number;
  lastError?: string;
  nextRetryAt?: string;
  createdAt: string;
  updatedAt: string;
};

export default function IntegrationsPage() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [fortnox, setFortnox] = useState<FortnoxStatus | null>(null);
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [fortnoxQueue, setFortnoxQueue] = useState<FortnoxPostingRecord[]>([]);

  // Handle OAuth callback status from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const integration = params.get('integration');
    const message = params.get('message');

    if (status === 'connected' && integration === 'fortnox') {
      setResult('Fortnox ansluten! Tokens sparade säkert.');
      window.history.replaceState({}, '', '/accounting/integrations');
    } else if (status === 'error') {
      setError(message || 'OAuth-fel inträffade.');
      window.history.replaceState({}, '', '/accounting/integrations');
    }
  }, []);

  const deadLetters = useMemo(() => jobs.filter((j) => j.status === 'dead_letter').length, [jobs]);
  const failed = useMemo(() => jobs.filter((j) => j.status === 'failed').length, [jobs]);

  const fortnoxQueueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of fortnoxQueue) counts[r.status] = (counts[r.status] || 0) + 1;
    return counts;
  }, [fortnoxQueue]);

  const fortnoxIssues = useMemo(
    () => fortnoxQueue.filter((r) => r.status === 'error' || r.status === 'dead_letter'),
    [fortnoxQueue]
  );

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [fortnoxRes, jobsRes, fortnoxQueueRes, fortnoxOAuthRes] = await Promise.all([
        fetch(`/api/fortnox/status?companyId=${companyId}`),
        fetch(`/api/integrations/jobs?companyId=${companyId}&limit=200`),
        fetch(`/api/fortnox/posting-queue?companyId=${companyId}`),
        fetch(`/api/integrations/fortnox?companyId=${companyId}`),
      ]);

      if (fortnoxRes.ok) {
        const oldStatus = await fortnoxRes.json();
        if (fortnoxOAuthRes.ok) {
          const oauthStatus = await fortnoxOAuthRes.json();
          setFortnox({ ...oldStatus, ...oauthStatus });
        } else {
          setFortnox(oldStatus);
        }
      } else if (fortnoxOAuthRes.ok) {
        setFortnox(await fortnoxOAuthRes.json());
      } else {
        setFortnox(null);
      }

      if (jobsRes.ok) {
        const json = await jobsRes.json();
        setJobs((json?.jobs || []) as IntegrationJob[]);
      } else {
        setJobs([]);
      }

      if (fortnoxQueueRes.ok) {
        const json = await fortnoxQueueRes.json();
        setFortnoxQueue((json?.items || []) as FortnoxPostingRecord[]);
      } else {
        setFortnoxQueue([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte ladda integrationsstatus.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runIntegrationWorker = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/integrations/jobs/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, limit: 25 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Worker failed');
      setResult(`Worker körd. Hanterade ${json.processed ?? 0} jobb (ok: ${json.success ?? 0}, fail: ${json.failed ?? 0}).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte köra worker.');
    } finally {
      setLoading(false);
    }
  };

  const runFortnoxQueueWorker = async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/fortnox/posting-queue/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, limit: 25 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Fortnox worker failed');
      setResult(`Fortnox-kö körd. Hanterade ${json.processed ?? 0} jobb (ok: ${json.success ?? 0}, fail: ${json.failed ?? 0}).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte köra Fortnox-kön.');
    } finally {
      setLoading(false);
    }
  };

  const retryJob = async (jobId: string) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/integrations/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'retry', jobId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Retry failed');
      setResult('Job re-queue:ad.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte retry:a.');
    } finally {
      setLoading(false);
    }
  };

  const retryFortnoxPosting = async (jobId: string) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/fortnox/posting-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, jobId, action: 'retry' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'Retry failed');
      setResult('Fortnox-postning re-queue:ad.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte retry:a Fortnox-jobb.');
    } finally {
      setLoading(false);
    }
  };

  const connectFortnox = async () => {
    if (!companyId) return;
    // Use non-/api connect route to avoid CloudFront routing issues
    window.location.href = `/fortnox/connect?companyId=${companyId}&returnTo=/accounting/integrations`;
  };

  const disconnectFortnox = async () => {
    if (!companyId) return;
    if (!confirm('Är du säker på att du vill koppla bort Fortnox? Detta raderar alla lagrade tokens.')) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/integrations/fortnox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect', companyId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Disconnect failed');
      
      setResult('Fortnox-anslutning borttagen.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte koppla bort Fortnox.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'overview', label: 'Översikt', icon: <Link2 className="w-4 h-4" /> },
    { key: 'fortnox', label: 'Fortnox-kö', count: fortnoxIssues.length, icon: <Database className="w-4 h-4" /> },
    { key: 'jobs', label: 'Jobs', count: jobs.length, icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader
          title="Integrationer"
          description="Hantera kopplingar till externa system som Fortnox, Tink m.fl."
          icon={<Plug className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={load}
                loading={loading}
                disabled={!companyId}
              >
                Uppdatera
              </Button>
              <Button
                icon={<Play className="w-4 h-4" />}
                onClick={runIntegrationWorker}
                loading={loading}
                disabled={!companyId}
              >
                Kör worker
              </Button>
              <Button
                variant="accent"
                icon={<Play className="w-4 h-4" />}
                onClick={runFortnoxQueueWorker}
                loading={loading}
                disabled={!companyId}
              >
                Kör Fortnox-kö
              </Button>
            </div>
          }
        />

        {/* Alerts */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 text-red-800 px-4 py-3 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {result}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fortnox</p>
                <div className="flex items-center gap-2">
                  <Badge variant={fortnox?.connected ? 'success' : 'error'}>
                    {fortnox?.connected ? 'Kopplad' : 'Ej kopplad'}
                  </Badge>
                </div>
                {fortnox?.fortnoxCompanyName && (
                  <p className="text-xs text-gray-500 mt-2">{fortnox.fortnoxCompanyName}</p>
                )}
              </div>
              {fortnox?.connected ? (
                <Button variant="ghost" size="sm" onClick={disconnectFortnox} disabled={loading}>
                  Koppla bort
                </Button>
              ) : (
                <Button variant="accent" size="sm" onClick={connectFortnox} disabled={loading} icon={<ExternalLink className="w-3 h-3" />}>
                  Anslut
                </Button>
              )}
            </div>
            {fortnox?.expiresAt && (
              <p className="text-[10px] text-gray-400 mt-3">
                Token utgår: {new Date(fortnox.expiresAt).toLocaleDateString('sv-SE')}
              </p>
            )}
            <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-[#c0a280]/5 rounded-full" />
          </Card>

          <StatCard
            label="Integration jobs"
            value={jobs.length}
            icon={<Zap className="w-4 h-4" />}
            accentColor="blue"
          />

          <StatCard
            label="Failed / DLQ"
            value={`${failed} / ${deadLetters}`}
            icon={<AlertTriangle className="w-4 h-4" />}
            accentColor={failed + deadLetters > 0 ? 'red' : 'green'}
          />

          <StatCard
            label="Fortnox-kö"
            value={fortnoxQueue.length}
            icon={<Database className="w-4 h-4" />}
            accentColor="gold"
          />
        </div>

        {/* Tabs */}
        <Card padding="none">
          <div className="px-2 pt-2">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />
          </div>

          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fortnox Status */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Database className="w-4 h-4 text-gray-400" />
                    Fortnox Status
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Anslutning</span>
                      <Badge variant={fortnox?.connected ? 'success' : 'error'}>
                        {fortnox?.connected ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bootstrap</span>
                      <Badge variant={fortnox?.bootstrapStatus === 'ready' ? 'success' : 'warning'}>
                        {fortnox?.bootstrapStatus || 'Okänd'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fel i kö</span>
                      <span className="font-medium text-gray-900">{fortnoxQueueCounts.error || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dead letter</span>
                      <span className="font-medium text-gray-900">{fortnoxQueueCounts.dead_letter || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Integration Health */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gray-400" />
                    Integrationshälsa
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Totalt jobb</span>
                      <span className="font-medium text-gray-900">{jobs.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Misslyckade</span>
                      <span className="font-medium text-gray-900">{failed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dead letter</span>
                      <span className="font-medium text-gray-900">{deadLetters}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lyckade</span>
                      <span className="font-medium text-gray-900">{jobs.filter(j => j.status === 'completed').length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'fortnox' && (
            <div className="divide-y divide-gray-100">
              {fortnoxIssues.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title="Inga Fortnox-fel"
                  description="Alla postningar har gått igenom utan problem"
                />
              ) : (
                fortnoxIssues.map((r) => (
                  <div key={r.jobId} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">Job {r.jobId.slice(0, 8)}...</span>
                        <Badge variant={r.status === 'dead_letter' ? 'error' : 'warning'}>
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          {r.attempts} försök
                        </span>
                        {r.nextRetryAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Nästa: {new Date(r.nextRetryAt).toLocaleString('sv-SE')}
                          </span>
                        )}
                      </div>
                      {r.lastError && (
                        <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded">
                          {r.lastError}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => retryFortnoxPosting(r.jobId)}
                      disabled={loading}
                    >
                      Retry
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="divide-y divide-gray-100">
              {jobs.length === 0 ? (
                <EmptyState
                  icon={<Zap />}
                  title="Inga jobs"
                  description="Det finns inga integration jobs ännu"
                />
              ) : (
                jobs.map((j) => (
                  <div key={j.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{j.type}</span>
                        <Badge 
                          variant={
                            j.status === 'completed' ? 'success' : 
                            j.status === 'failed' || j.status === 'dead_letter' ? 'error' : 
                            'default'
                          }
                        >
                          {j.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-3">
                        <span>{j.attempts}/{j.maxAttempts} försök</span>
                        <span>Nästa: {j.nextRunAt}</span>
                      </div>
                      {j.lastError && (
                        <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1 rounded">
                          {j.lastError}
                        </p>
                      )}
                    </div>
                    {(j.status === 'failed' || j.status === 'dead_letter') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => retryJob(j.id)}
                        disabled={loading}
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    
  );
}
