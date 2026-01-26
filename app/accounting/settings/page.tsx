'use client';


import { useState, useEffect, useCallback } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { 
  Settings, Link2, Unlink, CheckCircle2, AlertCircle, 
  RefreshCw, Building2, Calendar, Clock, ExternalLink,
  Shield, Loader2, FileText, Upload, CreditCard, Lock,
  ChevronDown, Filter, Search, Download, Eye, XCircle,
  Sparkles, Send, ClipboardList
} from 'lucide-react';

interface FortnoxStatus {
  connected: boolean;
  connectedAt?: string;
  fortnoxCompanyName?: string;
  fortnoxCompanyId?: string;
  lastSync?: string;
  lastError?: string;
  revokedAt?: string;
  bootstrapStatus?: 'not_started' | 'queued' | 'running' | 'ready' | 'error';
  bootstrapStartedAt?: string;
  bootstrapFinishedAt?: string;
  bootstrapLastError?: string;
  bootstrapStats?: Record<string, number>;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  companyId: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  success: boolean;
  errorMessage?: string;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  'DOCUMENT_UPLOADED': { label: 'Dokument uppladdat', icon: Upload, color: 'text-blue-600 bg-blue-50' },
  'JOB_APPROVED': { label: 'Transaktion godkänd', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  'JOB_AUTO_APPROVED': { label: 'Auto-godkänd', icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
  'JOB_REJECTED': { label: 'Avvisad', icon: XCircle, color: 'text-red-600 bg-red-50' },
  'JOB_SENT_TO_FORTNOX': { label: 'Skickad till Fortnox', icon: Send, color: 'text-green-600 bg-green-50' },
  'CLASSIFICATION_COMPLETED': { label: 'AI-klassificering', icon: Sparkles, color: 'text-purple-600 bg-purple-50' },
  'VAT_REPORT_GENERATED': { label: 'Momsrapport genererad', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  'PERIOD_CLOSED': { label: 'Period stängd', icon: Lock, color: 'text-gray-600 bg-gray-100' },
  'PAYMENT_COMPLETED': { label: 'Betalning genomförd', icon: CreditCard, color: 'text-green-600 bg-green-50' },
  'FORTNOX_CONNECTED': { label: 'Fortnox kopplad', icon: Link2, color: 'text-green-600 bg-green-50' },
  'SETTINGS_CHANGED': { label: 'Inställning ändrad', icon: Settings, color: 'text-gray-600 bg-gray-100' },
};

async function fetchFortnoxStatus(companyId: string): Promise<FortnoxStatus> {
  // Use /fortnox/* (non-/api) to avoid CloudFront routing conflicts
  const response = await fetch(`/fortnox/status?companyId=${companyId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }
  return response.json();
}

async function startFortnoxBootstrap(companyId: string): Promise<void> {
  // Use non-/api path to avoid CloudFront routing conflicts
  const response = await fetch(`/fortnox/bootstrap?companyId=${companyId}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to start bootstrap');
  }
}

async function disconnectFortnox(companyId: string): Promise<void> {
  const response = await fetch(`/api/integrations/fortnox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'disconnect', companyId }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error || 'Failed to disconnect');
}

async function fetchAuditLogs(companyId: string, options?: { 
  action?: string; 
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<AuditEntry[]> {
  const params = new URLSearchParams({ companyId });
  if (options?.action) params.append('action', options.action);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  
  const response = await fetch(`/api/accounting/audit?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch audit logs');
  }
  const data = await response.json();
  return data.logs || [];
}

export default function AccountingSettingsPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'integrations' | 'audit'>('integrations');
  const [fortnoxStatus, setFortnoxStatus] = useState<FortnoxStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  
  // Audit log state
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);

  useEffect(() => {
    if (selectedCompany) {
      loadStatus();
    }
  }, [selectedCompany]);

  // Load audit logs when tab changes to audit
  const loadAuditLogs = useCallback(async () => {
    if (!selectedCompany) return;
    
    setAuditLoading(true);
    try {
      const logs = await fetchAuditLogs(selectedCompany.id, {
        action: auditFilter || undefined,
        limit: 100,
      });
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setAuditLoading(false);
    }
  }, [selectedCompany, auditFilter]);

  useEffect(() => {
    if (activeTab === 'audit' && selectedCompany) {
      loadAuditLogs();
    }
  }, [activeTab, selectedCompany, loadAuditLogs]);

  // Check for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fortnoxResult = params.get('fortnox');
    const shouldBootstrap = params.get('bootstrap') === '1';
    
    if (fortnoxResult === 'success') {
      (async () => {
        await loadStatus();
        if (shouldBootstrap && selectedCompany) {
          try {
            setIsBootstrapping(true);
            await startFortnoxBootstrap(selectedCompany.id);
            await loadStatus();
          } catch (error) {
            console.error('Failed to start Fortnox bootstrap:', error);
          } finally {
            setIsBootstrapping(false);
          }
        }
      })();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadStatus = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    try {
      const status = await fetchFortnoxStatus(selectedCompany.id);
      setFortnoxStatus(status);
    } catch (error) {
      console.error('Failed to load Fortnox status:', error);
      setFortnoxStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    if (!selectedCompany) return;
    // Start OAuth via non-/api route to avoid CloudFront routing /api/* to backend origin.
    window.location.href = `/fortnox/connect?companyId=${selectedCompany.id}&returnTo=/accounting/settings`;
  };

  const handleDisconnect = async () => {
    if (!selectedCompany) return;
    
    if (!confirm('Är du säker på att du vill koppla bort Fortnox? Du kan koppla det igen senare.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      await disconnectFortnox(selectedCompany.id);
      setFortnoxStatus({ connected: false });
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Kunde inte koppla bort Fortnox');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('sv-SE');
  };

  const filteredLogs = auditLogs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.resourceId?.toLowerCase().includes(query) ||
      log.userEmail?.toLowerCase().includes(query) ||
      JSON.stringify(log.details).toLowerCase().includes(query)
    );
  });

  const getActionInfo = (action: string) => {
    return ACTION_LABELS[action] || { label: action, icon: ClipboardList, color: 'text-gray-600 bg-gray-100' };
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just nu';
    if (diffMins < 60) return `${diffMins} min sedan`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} tim sedan`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} dagar sedan`;
    
    return then.toLocaleDateString('sv-SE');
  };

  return (
    
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Bokföringsinställningar</h1>
          <p className="text-gray-500 mt-1">
            Hantera integrationer och inställningar för {selectedCompany?.name}
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`px-6 py-3 text-sm font-medium transition-all relative flex items-center gap-2 ${
                activeTab === 'integrations' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Link2 className="w-4 h-4" />
              Integrationer
              {activeTab === 'integrations' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-6 py-3 text-sm font-medium transition-all relative flex items-center gap-2 ${
                activeTab === 'audit' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Granskningslogg
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === 'audit' ? 'bg-[#c0a280]/20 text-[#c0a280]' : 'bg-gray-100 text-gray-500'
              }`}>
                {auditLogs.length}
              </span>
              {activeTab === 'audit' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />
              )}
            </button>
          </div>
        </div>

        {activeTab === 'integrations' && (
          <>
            {/* Fortnox Integration Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">Fx</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Fortnox</h2>
                <p className="text-sm text-gray-500">Synka bokföring automatiskt</p>
              </div>
            </div>
            
            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Laddar...</span>
              </div>
            ) : fortnoxStatus?.connected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Kopplad</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Ej kopplad</span>
              </div>
            )}
          </div>

          {/* Card Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : fortnoxStatus?.connected ? (
              <div className="space-y-6">
                {/* Connected Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Fortnox-bolag</span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {fortnoxStatus.fortnoxCompanyName || 'Okänt'}
                    </p>
                    {fortnoxStatus.fortnoxCompanyId && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        Org.nr: {fortnoxStatus.fortnoxCompanyId}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Kopplad sedan</span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatDate(fortnoxStatus.connectedAt)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Senaste synk</span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatDate(fortnoxStatus.lastSync)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Shield className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider">Status</span>
                    </div>
                    {fortnoxStatus.lastError ? (
                      <p className="font-medium text-red-600">{fortnoxStatus.lastError}</p>
                    ) : (
                      <p className="font-medium text-green-600">Allt fungerar</p>
                    )}
                  </div>
                </div>

                {/* Bootstrap readiness */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Förberedelse (kontoplan m.m.)</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Hämtar kontoplan, kostnadsställen, projekt, serier, räkenskapsår, leverantörer och artiklar.
                      </p>
                      {fortnoxStatus.bootstrapLastError && (
                        <p className="text-xs text-red-600 mt-2">{fortnoxStatus.bootstrapLastError}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {fortnoxStatus.bootstrapStatus === 'ready' ? (
                        <span className="px-3 py-1.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-medium">Redo</span>
                      ) : fortnoxStatus.bootstrapStatus === 'running' || isBootstrapping ? (
                        <span className="px-3 py-1.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Förbereder...
                        </span>
                      ) : fortnoxStatus.bootstrapStatus === 'error' ? (
                        <span className="px-3 py-1.5 rounded-full text-xs bg-red-50 text-red-700 font-medium">Fel</span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-full text-xs bg-gray-100 text-gray-600 font-medium">Ej startad</span>
                      )}

                      <button
                        onClick={async () => {
                          if (!selectedCompany) return;
                          try {
                            setIsBootstrapping(true);
                            await startFortnoxBootstrap(selectedCompany.id);
                            await loadStatus();
                          } catch (error) {
                            console.error(error);
                            alert('Kunde inte starta förberedelse');
                          } finally {
                            setIsBootstrapping(false);
                          }
                        }}
                        disabled={isBootstrapping || fortnoxStatus.bootstrapStatus === 'running'}
                        className="px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Kör nu
                      </button>
                    </div>
                  </div>

                  {fortnoxStatus.bootstrapStats && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                      <div className="bg-gray-50 rounded-lg p-2">Konton: {fortnoxStatus.bootstrapStats.accounts ?? '-'}</div>
                      <div className="bg-gray-50 rounded-lg p-2">Kställen: {fortnoxStatus.bootstrapStats.costCenters ?? '-'}</div>
                      <div className="bg-gray-50 rounded-lg p-2">Projekt: {fortnoxStatus.bootstrapStats.projects ?? '-'}</div>
                      <div className="bg-gray-50 rounded-lg p-2">Serier: {fortnoxStatus.bootstrapStats.voucherSeries ?? '-'}</div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={loadStatus}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Uppdatera status
                  </button>

                  <button
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Unlink className="w-4 h-4" />
                    )}
                    Koppla bort
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Link2 className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Koppla till Fortnox
                </h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  Genom att koppla till Fortnox kan du automatiskt skicka verifikationer 
                  och leverantörsfakturor direkt från AIFM till bokföringen.
                </p>
                <button
                  onClick={handleConnect}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Anslut till Fortnox
                </button>
                <p className="text-xs text-gray-400 mt-4">
                  Du kommer att omdirigeras till Fortnox för att logga in och godkänna anslutningen.
                </p>
              </div>
            )}
          </div>
        </div>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 rounded-xl p-4 flex gap-3">
              <div className="flex-shrink-0">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Säker anslutning</h4>
                <p className="text-sm text-blue-700 mt-1">
                  AIFM använder OAuth 2.0 för att säkert ansluta till Fortnox. 
                  Dina Fortnox-uppgifter lagras aldrig hos oss. Du kan när som helst 
                  koppla bort anslutningen.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            {/* Audit Log Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Sök i loggar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all"
                  />
                </div>

                {/* Filter */}
                <div className="relative">
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="appearance-none px-4 py-2.5 pr-10 bg-gray-50 border-0 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all cursor-pointer"
                  >
                    <option value="">Alla händelser</option>
                    <option value="DOCUMENT_UPLOADED">Dokumentuppladdningar</option>
                    <option value="JOB_APPROVED">Godkännanden</option>
                    <option value="JOB_SENT_TO_FORTNOX">Fortnox-synk</option>
                    <option value="VAT_REPORT_GENERATED">Momsrapporter</option>
                    <option value="PAYMENT_COMPLETED">Betalningar</option>
                    <option value="PERIOD_CLOSED">Periodstängningar</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                {/* Refresh */}
                <button
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
                </button>

                {/* Export */}
                <button
                  onClick={() => {
                    const csv = [
                      ['Tidpunkt', 'Händelse', 'Resurs', 'Användare', 'Status'].join(','),
                      ...filteredLogs.map(log => [
                        log.timestamp,
                        getActionInfo(log.action).label,
                        log.resourceId || '-',
                        log.userEmail || '-',
                        log.success ? 'OK' : 'Fel'
                      ].join(','))
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Exportera
                </button>
              </div>
            </div>

            {/* Audit Log List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {auditLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ClipboardList className="w-12 h-12 text-gray-300 mb-4" />
                  <p className="text-gray-500">Inga loggposter hittades</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {searchQuery || auditFilter ? 'Prova ändra filter eller sökord' : 'Loggposter visas här när aktivitet sker'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredLogs.map((log) => {
                    const actionInfo = getActionInfo(log.action);
                    const ActionIcon = actionInfo.icon;
                    
                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                        className="px-4 py-3 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${actionInfo.color}`}>
                            <ActionIcon className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{actionInfo.label}</span>
                              {!log.success && (
                                <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">Fel</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                              {log.resourceId && (
                                <>
                                  <span className="truncate max-w-[200px]">{log.resourceId}</span>
                                  <span>•</span>
                                </>
                              )}
                              {log.userEmail && (
                                <>
                                  <span>{log.userEmail}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{formatTimeAgo(log.timestamp)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {new Date(log.timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${selectedLog?.id === log.id ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {selectedLog?.id === log.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Tidpunkt:</span>
                                <span className="ml-2 text-gray-900">{new Date(log.timestamp).toLocaleString('sv-SE')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Resurs-typ:</span>
                                <span className="ml-2 text-gray-900">{log.resourceType}</span>
                              </div>
                              {log.ipAddress && (
                                <div>
                                  <span className="text-gray-500">IP-adress:</span>
                                  <span className="ml-2 text-gray-900">{log.ipAddress}</span>
                                </div>
                              )}
                              {log.errorMessage && (
                                <div className="col-span-2">
                                  <span className="text-red-500">Felmeddelande:</span>
                                  <span className="ml-2 text-red-600">{log.errorMessage}</span>
                                </div>
                              )}
                              {log.details && Object.keys(log.details).length > 0 && (
                                <div className="col-span-2">
                                  <span className="text-gray-500">Detaljer:</span>
                                  <pre className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-700 overflow-x-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 rounded-xl p-4 flex gap-3">
              <div className="flex-shrink-0">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-medium text-amber-900">Granskningslogg</h4>
                <p className="text-sm text-amber-700 mt-1">
                  Alla viktiga händelser i bokföringssystemet loggas här för spårbarhet och revision. 
                  Loggar sparas i 2 år och kan exporteras för extern granskning.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    
  );
}



