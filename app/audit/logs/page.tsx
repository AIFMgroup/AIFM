'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, Search, Filter, Download, RefreshCw, 
  ChevronDown, Calendar, User, Activity, Shield,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Eye, ChevronLeft, ChevronRight, X
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type AuditAction = 
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_DELETED'
  | 'JOB_CREATED'
  | 'JOB_APPROVED'
  | 'JOB_REJECTED'
  | 'JOB_AUTO_APPROVED'
  | 'JOB_SENT_TO_FORTNOX'
  | 'CLASSIFICATION_COMPLETED'
  | 'CLASSIFICATION_CORRECTED'
  | 'VAT_REPORT_GENERATED'
  | 'PERIOD_CLOSED'
  | 'PAYMENT_COMPLETED'
  | 'FORTNOX_CONNECTED'
  | 'SETTINGS_CHANGED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

interface AuditEntry {
  id: string;
  timestamp: string;
  companyId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockAuditLogs: AuditEntry[] = [
  {
    id: 'audit-1',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-1',
    userEmail: 'anna.svensson@aifm.se',
    action: 'JOB_APPROVED',
    resourceType: 'job',
    resourceId: 'job-123',
    details: { supplier: 'Advokatfirman Lindahl', amount: 185000 },
    ipAddress: '192.168.1.100',
    success: true,
  },
  {
    id: 'audit-2',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-2',
    userEmail: 'erik.johansson@aifm.se',
    action: 'DOCUMENT_UPLOADED',
    resourceType: 'document',
    resourceId: 'doc-456',
    details: { fileName: 'Faktura_2024_Q4.pdf', fileSize: 245000 },
    ipAddress: '192.168.1.101',
    success: true,
  },
  {
    id: 'audit-3',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userEmail: 'system@aifm.se',
    action: 'JOB_AUTO_APPROVED',
    resourceType: 'job',
    resourceId: 'job-124',
    details: { confidence: 0.95, supplier: 'Telia', amount: 3500 },
    success: true,
  },
  {
    id: 'audit-4',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-1',
    userEmail: 'anna.svensson@aifm.se',
    action: 'USER_LOGIN',
    resourceType: 'auth',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    success: true,
  },
  {
    id: 'audit-5',
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-3',
    userEmail: 'maria.lindgren@aifm.se',
    action: 'JOB_REJECTED',
    resourceType: 'job',
    resourceId: 'job-125',
    details: { reason: 'Felaktig leverantör', supplier: 'Okänd AB', amount: 500000 },
    success: true,
  },
  {
    id: 'audit-6',
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-1',
    userEmail: 'anna.svensson@aifm.se',
    action: 'SETTINGS_CHANGED',
    resourceType: 'settings',
    details: { setting: 'autoApprovalMaxAmount', oldValue: 5000, newValue: 10000 },
    success: true,
  },
  {
    id: 'audit-7',
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userEmail: 'system@aifm.se',
    action: 'JOB_SENT_TO_FORTNOX',
    resourceType: 'fortnox',
    resourceId: 'job-120',
    details: { voucherId: 'V2024-1234', supplier: 'KPMG' },
    success: true,
  },
  {
    id: 'audit-8',
    timestamp: new Date(Date.now() - 180 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-4',
    userEmail: 'carl.berg@aifm.se',
    action: 'VAT_REPORT_GENERATED',
    resourceType: 'vat_report',
    details: { period: '2024-Q4', totalVat: 125000 },
    success: true,
  },
  {
    id: 'audit-9',
    timestamp: new Date(Date.now() - 240 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userEmail: 'unknown@external.com',
    action: 'USER_LOGIN',
    resourceType: 'auth',
    ipAddress: '45.67.89.10',
    success: false,
    errorMessage: 'Invalid credentials',
  },
  {
    id: 'audit-10',
    timestamp: new Date(Date.now() - 300 * 60000).toISOString(),
    companyId: 'nordic-fund-1',
    userId: 'user-1',
    userEmail: 'anna.svensson@aifm.se',
    action: 'FORTNOX_CONNECTED',
    resourceType: 'fortnox',
    details: { orgNumber: '559123-4567' },
    success: true,
  },
];

// ============================================================================
// Helper Components
// ============================================================================

const actionLabels: Record<AuditAction, string> = {
  DOCUMENT_UPLOADED: 'Dokument uppladdat',
  DOCUMENT_DELETED: 'Dokument raderat',
  JOB_CREATED: 'Jobb skapat',
  JOB_APPROVED: 'Jobb godkänt',
  JOB_REJECTED: 'Jobb avvisat',
  JOB_AUTO_APPROVED: 'Auto-godkänt',
  JOB_SENT_TO_FORTNOX: 'Skickat till Fortnox',
  CLASSIFICATION_COMPLETED: 'Klassificering klar',
  CLASSIFICATION_CORRECTED: 'Klassificering korrigerad',
  VAT_REPORT_GENERATED: 'Momsrapport genererad',
  PERIOD_CLOSED: 'Period stängd',
  PAYMENT_COMPLETED: 'Betalning genomförd',
  FORTNOX_CONNECTED: 'Fortnox ansluten',
  SETTINGS_CHANGED: 'Inställning ändrad',
  USER_LOGIN: 'Inloggning',
  USER_LOGOUT: 'Utloggning',
};

const actionColors: Record<string, string> = {
  JOB_APPROVED: 'bg-emerald-100 text-emerald-700',
  JOB_AUTO_APPROVED: 'bg-emerald-100 text-emerald-700',
  JOB_REJECTED: 'bg-red-100 text-red-700',
  USER_LOGIN: 'bg-blue-100 text-blue-700',
  USER_LOGOUT: 'bg-gray-100 text-gray-700',
  SETTINGS_CHANGED: 'bg-amber-100 text-amber-700',
  DOCUMENT_UPLOADED: 'bg-purple-100 text-purple-700',
  DOCUMENT_DELETED: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
};

function ActionBadge({ action }: { action: AuditAction }) {
  const colorClass = actionColors[action] || actionColors.default;
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${colorClass}`}>
      {actionLabels[action] || action}
    </span>
  );
}

function StatusIcon({ success }: { success: boolean }) {
  if (success) {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just nu';
  if (minutes < 60) return `${minutes} min sedan`;
  if (hours < 24) return `${hours} tim sedan`;
  if (days < 7) return `${days} dagar sedan`;
  return date.toLocaleDateString('sv-SE');
}

// ============================================================================
// Filter Tabs
// ============================================================================

type FilterTab = 'all' | 'approvals' | 'auth' | 'documents' | 'settings';

function FilterTabs({ 
  activeTab, 
  onTabChange,
  counts 
}: { 
  activeTab: FilterTab; 
  onTabChange: (tab: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'Alla' },
    { id: 'approvals', label: 'Godkännanden' },
    { id: 'auth', label: 'Inloggningar' },
    { id: 'documents', label: 'Dokument' },
    { id: 'settings', label: 'Inställningar' },
  ];

  return (
    <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
            activeTab === tab.id
              ? 'bg-white text-aifm-charcoal shadow-sm'
              : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
          }`}
        >
          {tab.label}
          {counts[tab.id] > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeTab === tab.id ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-200 text-gray-600'
            }`}>
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Detail Modal
// ============================================================================

function DetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              entry.success ? 'bg-emerald-100' : 'bg-red-100'
            }`}>
              <StatusIcon success={entry.success} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aifm-charcoal">Händelsedetaljer</h2>
              <p className="text-xs text-aifm-charcoal/50">{entry.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-aifm-charcoal/50" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Tidpunkt</p>
              <p className="text-sm font-medium text-aifm-charcoal">{formatTimestamp(entry.timestamp)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Händelse</p>
              <ActionBadge action={entry.action} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Användare</p>
              <p className="text-sm font-medium text-aifm-charcoal">{entry.userEmail || 'System'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Resurstyp</p>
              <p className="text-sm font-medium text-aifm-charcoal capitalize">{entry.resourceType}</p>
            </div>
          </div>

          {entry.resourceId && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Resurs-ID</p>
              <p className="text-sm font-mono text-aifm-charcoal">{entry.resourceId}</p>
            </div>
          )}

          {entry.ipAddress && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">IP-adress</p>
              <p className="text-sm font-mono text-aifm-charcoal">{entry.ipAddress}</p>
            </div>
          )}

          {entry.details && Object.keys(entry.details).length > 0 && (
            <div className="bg-aifm-charcoal/5 rounded-xl p-4">
              <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-3">Detaljer</p>
              <div className="space-y-2">
                {Object.entries(entry.details).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-aifm-charcoal/60 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-medium text-aifm-charcoal">
                      {typeof value === 'number' && key.toLowerCase().includes('amount')
                        ? `${value.toLocaleString('sv-SE')} kr`
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.errorMessage && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs text-red-600/70 uppercase tracking-wider mb-1">Felmeddelande</p>
              <p className="text-sm text-red-700">{entry.errorMessage}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-aifm-charcoal/70 hover:text-aifm-charcoal
                       hover:bg-white rounded-xl transition-colors"
          >
            Stäng
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>(mockAuditLogs);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const itemsPerPage = 20;

  // Filter logs based on tab and search
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Filter by tab
    if (activeTab === 'approvals') {
      filtered = filtered.filter(l => 
        ['JOB_APPROVED', 'JOB_REJECTED', 'JOB_AUTO_APPROVED'].includes(l.action)
      );
    } else if (activeTab === 'auth') {
      filtered = filtered.filter(l => 
        ['USER_LOGIN', 'USER_LOGOUT'].includes(l.action)
      );
    } else if (activeTab === 'documents') {
      filtered = filtered.filter(l => 
        ['DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'JOB_SENT_TO_FORTNOX'].includes(l.action)
      );
    } else if (activeTab === 'settings') {
      filtered = filtered.filter(l => 
        ['SETTINGS_CHANGED', 'FORTNOX_CONNECTED'].includes(l.action)
      );
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.userEmail?.toLowerCase().includes(query) ||
        l.action.toLowerCase().includes(query) ||
        l.resourceId?.toLowerCase().includes(query) ||
        JSON.stringify(l.details).toLowerCase().includes(query)
      );
    }

    // Filter by date range
    const now = new Date();
    if (dateRange === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(l => new Date(l.timestamp) >= today);
    } else if (dateRange === '7days') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(l => new Date(l.timestamp) >= weekAgo);
    } else if (dateRange === '30days') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(l => new Date(l.timestamp) >= monthAgo);
    }

    return filtered;
  }, [logs, activeTab, searchQuery, dateRange]);

  // Calculate counts for tabs
  const tabCounts: Record<FilterTab, number> = useMemo(() => ({
    all: logs.length,
    approvals: logs.filter(l => ['JOB_APPROVED', 'JOB_REJECTED', 'JOB_AUTO_APPROVED'].includes(l.action)).length,
    auth: logs.filter(l => ['USER_LOGIN', 'USER_LOGOUT'].includes(l.action)).length,
    documents: logs.filter(l => ['DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'JOB_SENT_TO_FORTNOX'].includes(l.action)).length,
    settings: logs.filter(l => ['SETTINGS_CHANGED', 'FORTNOX_CONNECTED'].includes(l.action)).length,
  }), [logs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleRefresh = async () => {
    setIsLoading(true);
    // In production, fetch from API
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ['Tidpunkt', 'Användare', 'Händelse', 'Resurs', 'Status', 'Detaljer'].join(','),
      ...filteredLogs.map(l => [
        formatTimestamp(l.timestamp),
        l.userEmail || 'System',
        actionLabels[l.action] || l.action,
        l.resourceId || '-',
        l.success ? 'Lyckad' : 'Misslyckad',
        JSON.stringify(l.details || {}),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Audit Logs</h1>
            <p className="text-sm text-aifm-charcoal/50">Spårbarhet och compliance-loggning</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl
                       text-sm font-medium text-aifm-charcoal/70 hover:bg-gray-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl
                       text-sm font-medium hover:bg-aifm-charcoal/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-aifm-charcoal/70" />
            </div>
            <span className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Totalt</span>
          </div>
          <p className="text-2xl font-semibold text-aifm-charcoal">{filteredLogs.length}</p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">händelser</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Lyckade</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-600">
            {filteredLogs.filter(l => l.success).length}
          </p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">
            {((filteredLogs.filter(l => l.success).length / filteredLogs.length) * 100 || 0).toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Misslyckade</span>
          </div>
          <p className="text-2xl font-semibold text-red-600">
            {filteredLogs.filter(l => !l.success).length}
          </p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">händelser</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-aifm-charcoal/40 uppercase tracking-wider">Användare</span>
          </div>
          <p className="text-2xl font-semibold text-blue-600">
            {new Set(filteredLogs.map(l => l.userEmail).filter(Boolean)).size}
          </p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">unika användare</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <FilterTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          counts={tabCounts}
        />
        
        <div className="flex items-center gap-3">
          {/* Date Range */}
          <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
            {(['today', '7days', '30days', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  dateRange === range
                    ? 'bg-white text-aifm-charcoal shadow-sm'
                    : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
                }`}
              >
                {range === 'today' ? 'Idag' : range === '7days' ? '7 dagar' : range === '30days' ? '30 dagar' : 'Alla'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
            <input
              type="text"
              placeholder="Sök i loggar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm
                         focus:outline-none focus:border-aifm-gold/50 focus:ring-2 focus:ring-aifm-gold/10
                         placeholder:text-aifm-charcoal/40 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                  Tidpunkt
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                  Användare
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                  Händelse
                </th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                  Resurs
                </th>
                <th className="text-center px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">
                  Åtgärd
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-aifm-charcoal/50">Inga loggposter hittades</p>
                    <p className="text-xs text-aifm-charcoal/40 mt-1">Prova att ändra filter eller sökord</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm text-aifm-charcoal">{formatTimestamp(entry.timestamp)}</p>
                        <p className="text-xs text-aifm-charcoal/40">{formatRelativeTime(entry.timestamp)}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-semibold text-aifm-charcoal/60">
                            {(entry.userEmail || 'SYS').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-aifm-charcoal">{entry.userEmail || 'System'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm text-aifm-charcoal capitalize">{entry.resourceType}</p>
                        {entry.resourceId && (
                          <p className="text-xs text-aifm-charcoal/40 font-mono">{entry.resourceId}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusIcon success={entry.success} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="p-2 text-aifm-charcoal/40 hover:text-aifm-gold hover:bg-aifm-gold/10 
                                   rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <p className="text-sm text-aifm-charcoal/50">
              Visar {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredLogs.length)} av {filteredLogs.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-aifm-charcoal/60" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                if (page > totalPages) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-aifm-charcoal text-white'
                        : 'text-aifm-charcoal/60 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-aifm-charcoal/60" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <DetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </>
  );
}
