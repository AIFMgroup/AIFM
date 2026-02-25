'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, 
  Download, 
  RefreshCw,
  ChevronRight,
  User,
  FileText,
  Shield,
  DollarSign,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Calendar,
  Building2,
  FolderOpen,
  Loader2,
  Database,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: {
    name: string;
    email: string;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  details: Record<string, unknown>;
  source: string;
}

interface AuditStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: { info: number; warning: number; error: number; critical: number };
}

const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ReactNode> = {
    securities: <Shield className="w-4 h-4" />,
    document: <FileText className="w-4 h-4" />,
    compliance: <Shield className="w-4 h-4" />,
    financial: <DollarSign className="w-4 h-4" />,
    system: <Settings className="w-4 h-4" />,
    security: <AlertTriangle className="w-4 h-4" />,
    dataroom: <FolderOpen className="w-4 h-4" />,
    accounting: <Database className="w-4 h-4" />,
  };
  return icons[category] || <Eye className="w-4 h-4" />;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    securities: 'bg-aifm-gold/15 text-aifm-charcoal',
    document: 'bg-aifm-charcoal/[0.06] text-aifm-charcoal',
    compliance: 'bg-aifm-gold/10 text-aifm-charcoal',
    financial: 'bg-amber-100 text-amber-700',
    system: 'bg-gray-100 text-aifm-charcoal/70',
    security: 'bg-red-100 text-red-700',
    dataroom: 'bg-blue-100 text-blue-700',
    accounting: 'bg-emerald-100 text-emerald-700',
  };
  return colors[category] || 'bg-gray-100 text-aifm-charcoal/70';
};

const getSeverityBadge = (severity: string) => {
  const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    info: { bg: 'bg-aifm-gold/10', text: 'text-aifm-charcoal', icon: <CheckCircle className="w-3 h-3" /> },
    warning: { bg: 'bg-amber-50', text: 'text-amber-600', icon: <AlertTriangle className="w-3 h-3" /> },
    error: { bg: 'bg-red-50', text: 'text-red-600', icon: <AlertTriangle className="w-3 h-3" /> },
    critical: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const style = styles[severity] || styles.info;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.icon}
      {severity}
    </span>
  );
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  
  return date.toLocaleDateString('sv-SE', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const ACTION_LABELS: Record<string, string> = {
  'securities.created': 'Värdepappersansökan skapad',
  'securities.submitted': 'Ansökan inskickad',
  'securities.approved': 'Ansökan godkänd',
  'securities.rejected': 'Ansökan nekad',
  'securities.info_requested': 'Komplettering begärd',
  'securities.info_responded': 'Komplettering besvarad',
  'securities.comment_added': 'Kommentar tillagd',
  'securities.renewed': 'Ansökan förnyad',
  'securities.expired': 'Ansökan utgången',
  'dataroom.upload': 'Dokument uppladdat',
  'dataroom.download': 'Dokument nedladdat',
  'dataroom.view': 'Dokument visat',
  'dataroom.delete': 'Dokument raderat',
  'dataroom.invite': 'Medlem inbjuden',
  'dataroom.accept_invite': 'Inbjudan accepterad',
  'dataroom.update_settings': 'Inställningar uppdaterade',
  'dataroom.create_folder': 'Mapp skapad',
  'DOCUMENT_UPLOADED': 'Dokument uppladdat',
  'DOCUMENT_DELETED': 'Dokument raderat',
  'JOB_CREATED': 'Bokföringsjobb skapat',
  'JOB_APPROVED': 'Jobb godkänt',
  'JOB_REJECTED': 'Jobb avvisat',
  'JOB_AUTO_APPROVED': 'Jobb auto-godkänt',
  'JOB_SENT_TO_FORTNOX': 'Skickat till Fortnox',
  'JOB_PRECHECK_FAILED': 'Förkontroll misslyckades',
  'JOB_POLICY_BLOCKED': 'Blockerat av policy',
  'FORTNOX_POSTING_STARTED': 'Fortnox-bokföring startad',
  'FORTNOX_POSTING_COMPLETED': 'Fortnox-bokföring klar',
  'FORTNOX_POSTING_FAILED': 'Fortnox-bokföring misslyckades',
  'FORTNOX_CONNECTED': 'Fortnox ansluten',
  'FORTNOX_DISCONNECTED': 'Fortnox frånkopplad',
  'FORTNOX_SYNC_STARTED': 'Fortnox-synk startad',
  'FORTNOX_SYNC_COMPLETED': 'Fortnox-synk klar',
  'FORTNOX_SYNC_FAILED': 'Fortnox-synk misslyckades',
  'CLASSIFICATION_COMPLETED': 'Klassificering klar',
  'CLASSIFICATION_CORRECTED': 'Klassificering korrigerad',
  'VAT_REPORT_GENERATED': 'Momsrapport genererad',
  'VAT_REPORT_EXPORTED': 'Momsrapport exporterad',
  'PERIOD_CLOSED': 'Period stängd',
  'PERIOD_LOCKED': 'Period låst',
  'PAYMENT_CREATED': 'Betalning skapad',
  'PAYMENT_SCHEDULED': 'Betalning schemalagd',
  'PAYMENT_COMPLETED': 'Betalning genomförd',
  'PAYMENT_FAILED': 'Betalning misslyckades',
  'SETTINGS_CHANGED': 'Inställningar ändrade',
  'USER_LOGIN': 'Inloggning',
  'USER_LOGOUT': 'Utloggning',
  'notification.security_review_alert': 'Granskningsnotis',
  'notification.security_expiring': 'Utgångsvarning',
  'notification.approval_completed': 'Godkännande klart',
  'notification.approval_rejected': 'Godkännande nekat',
  'notification.system': 'Systemnotis',
};

const getActionLabel = (action: string) => ACTION_LABELS[action] || action.replace(/[._]/g, ' ');

const CATEGORY_LABELS: Record<string, string> = {
  securities: 'Värdepapper',
  document: 'Dokument',
  compliance: 'Compliance',
  financial: 'Finansiellt',
  system: 'System',
  security: 'Säkerhet',
  dataroom: 'Datarum',
  accounting: 'Bokföring',
};

const SOURCE_LABELS: Record<string, string> = {
  'audit-logs': 'Bokföring',
  securities: 'Värdepapper',
  dataroom: 'Datarum',
  notifications: 'Notifikationer',
};

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (dateRange.from) params.set('startDate', new Date(dateRange.from).toISOString());
      if (dateRange.to) params.set('endDate', new Date(dateRange.to + 'T23:59:59').toISOString());
      params.set('limit', '200');

      const res = await fetch(`/api/audit-trail?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta audit trail');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, dateRange]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        searchQuery === '' ||
        getActionLabel(log.action).toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.source.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
      
      return matchesSearch && matchesSeverity;
    });
  }, [logs, searchQuery, selectedSeverity]);

  const exportCsv = () => {
    const headers = ['Tidpunkt', 'Händelse', 'Kategori', 'Allvarlighet', 'Användare', 'E-post', 'Mål', 'Källa', 'Detaljer'];
    const rows = filteredLogs.map(log => [
      log.timestamp,
      getActionLabel(log.action),
      CATEGORY_LABELS[log.category] || log.category,
      log.severity,
      log.actor.name,
      log.actor.email,
      log.target?.name || '',
      SOURCE_LABELS[log.source] || log.source,
      JSON.stringify(log.details),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const categories = useMemo(() => {
    const cats = new Set(logs.map(l => l.category));
    return Array.from(cats).sort();
  }, [logs]);

  return (
    <div className="min-h-screen">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Audit Trail</h1>
              <p className="text-sm text-aifm-charcoal/40">Spåra alla händelser och aktiviteter i systemet</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportCsv}
                disabled={filteredLogs.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportera</span>
              </button>
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="hidden sm:inline">Uppdatera</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-aifm-charcoal/[0.06] flex items-center justify-center">
                <FileText className="w-5 h-5 text-aifm-charcoal/60" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats?.total ?? '–'}</div>
                <div className="text-sm text-aifm-charcoal/40">Totala händelser</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-aifm-gold/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-aifm-gold" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats?.byCategory?.securities ?? 0}</div>
                <div className="text-sm text-aifm-charcoal/40">Värdepapper</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats?.byCategory?.dataroom ?? 0}</div>
                <div className="text-sm text-aifm-charcoal/40">Datarum</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">
                  {(stats?.bySeverity?.warning ?? 0) + (stats?.bySeverity?.error ?? 0) + (stats?.bySeverity?.critical ?? 0)}
                </div>
                <div className="text-sm text-aifm-charcoal/40">Varningar/Fel</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Sök händelser, användare, dokument..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
                />
              </div>
            </div>
            
            <div className="w-full lg:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              >
                <option value="all">Alla kategorier</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full lg:w-40">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              >
                <option value="all">Alla nivåer</option>
                <option value="info">Info</option>
                <option value="warning">Varning</option>
                <option value="error">Fel</option>
                <option value="critical">Kritisk</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
              <span className="text-aifm-charcoal/30">–</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && logs.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-aifm-gold mx-auto mb-4" />
            <p className="text-aifm-charcoal/40">Hämtar audit trail...</p>
          </div>
        )}

        {/* Audit Log List */}
        {!loading || logs.length > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`transition-colors ${expandedLog === log.id ? 'bg-aifm-charcoal/[0.02]' : 'hover:bg-aifm-charcoal/[0.01]'}`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getCategoryColor(log.category)}`}>
                        {getCategoryIcon(log.category)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-aifm-charcoal">{getActionLabel(log.action)}</span>
                              {getSeverityBadge(log.severity)}
                            </div>
                            <div className="text-sm text-aifm-charcoal/40 mt-1">
                              <span className="font-medium text-aifm-charcoal/70">{log.actor.name}</span>
                              {log.actor.email && (
                                <span className="text-aifm-charcoal/30 ml-1">({log.actor.email})</span>
                              )}
                              {log.target && (
                                <>
                                  <span className="mx-1">→</span>
                                  <span>{log.target.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm text-aifm-charcoal/30">{formatTimestamp(log.timestamp)}</span>
                            <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expandedLog === log.id ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                            {getCategoryIcon(log.category)}
                            {CATEGORY_LABELS[log.category] || log.category}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-aifm-charcoal/50 rounded-full text-xs">
                            {SOURCE_LABELS[log.source] || log.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="px-4 pb-4">
                      <div className="ml-13 pl-4 border-l-2 border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <h4 className="font-medium text-aifm-charcoal/70">Användare</h4>
                            <div className="bg-aifm-charcoal/[0.03] rounded-xl p-3 space-y-1">
                              <div className="flex justify-between">
                                <span className="text-aifm-charcoal/40">Namn:</span>
                                <span className="text-aifm-charcoal">{log.actor.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-aifm-charcoal/40">E-post:</span>
                                <span className="text-aifm-charcoal">{log.actor.email}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="font-medium text-aifm-charcoal/70">Detaljer</h4>
                            <div className="bg-aifm-charcoal/[0.03] rounded-xl p-3 space-y-1">
                              {Object.entries(log.details)
                                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                                .map(([key, value]) => (
                                <div key={key} className="flex justify-between">
                                  <span className="text-aifm-charcoal/40 capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}:</span>
                                  <span className="text-aifm-charcoal text-right max-w-[60%] truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {log.target && (
                            <div className="space-y-2">
                              <h4 className="font-medium text-aifm-charcoal/70">Mål</h4>
                              <div className="bg-aifm-charcoal/[0.03] rounded-xl p-3 space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-aifm-charcoal/40">Typ:</span>
                                  <span className="text-aifm-charcoal capitalize">{log.target.type}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-aifm-charcoal/40">Namn:</span>
                                  <span className="text-aifm-charcoal">{log.target.name}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-aifm-charcoal/40">ID:</span>
                                  <span className="text-aifm-charcoal font-mono text-xs">{log.target.id}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <h4 className="font-medium text-aifm-charcoal/70">Tidsstämpel</h4>
                            <div className="bg-aifm-charcoal/[0.03] rounded-xl p-3">
                              <div className="flex items-center gap-2 text-aifm-charcoal">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {new Date(log.timestamp).toLocaleString('sv-SE', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filteredLogs.length === 0 && !loading && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-aifm-charcoal/[0.03] rounded-full flex items-center justify-center">
                  <Search className="w-8 h-8 text-aifm-charcoal/20" />
                </div>
                <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-1">
                  {logs.length === 0 ? 'Inga händelser ännu' : 'Inga loggar hittades'}
                </h3>
                <p className="text-aifm-charcoal/40">
                  {logs.length === 0
                    ? 'Händelser loggas automatiskt när du använder systemet'
                    : 'Försök justera dina sökfilter'}
                </p>
              </div>
            )}

            {filteredLogs.length > 0 && (
              <div className="p-4 border-t border-gray-100 text-center">
                <span className="text-sm text-aifm-charcoal/40">
                  Visar {filteredLogs.length} av {logs.length} händelser
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
