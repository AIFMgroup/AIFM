'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, History, Search, Download, Calendar,
  User, CheckCircle2, XCircle, Clock, AlertTriangle, Edit2,
  Eye, FileText, Calculator, Shield, Mail, RefreshCw, Loader2,
  ChevronDown, ChevronRight
} from 'lucide-react';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  severity: string;
  actor: { name: string; email: string };
  target?: { type: string; id: string; name: string };
  details: Record<string, unknown>;
  source: string;
}

function formatDateTime(timestamp: string): { date: string; time: string } {
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString('sv-SE'),
    time: d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
  };
}

type ActionConfig = { icon: React.ElementType; color: string; bgColor: string; label: string };

function getActionConfig(action: string): ActionConfig {
  const configs: Record<string, ActionConfig> = {
    'JOB_CREATED': { icon: Calculator, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Jobb skapat' },
    'JOB_APPROVED': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Jobb godkänt' },
    'JOB_AUTO_APPROVED': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Auto-godkänt' },
    'JOB_REJECTED': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Jobb avvisat' },
    'JOB_SENT_TO_FORTNOX': { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Skickat till Fortnox' },
    'JOB_PRECHECK_FAILED': { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Förkontroll misslyckades' },
    'JOB_POLICY_BLOCKED': { icon: Shield, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Blockerat av policy' },
    'DOCUMENT_UPLOADED': { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Dokument uppladdat' },
    'DOCUMENT_DELETED': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Dokument raderat' },
    'FORTNOX_POSTING_STARTED': { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Fortnox-bokföring startad' },
    'FORTNOX_POSTING_COMPLETED': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Fortnox-bokföring klar' },
    'FORTNOX_POSTING_FAILED': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Fortnox-bokföring misslyckades' },
    'FORTNOX_CONNECTED': { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Fortnox ansluten' },
    'FORTNOX_DISCONNECTED': { icon: XCircle, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Fortnox frånkopplad' },
    'FORTNOX_SYNC_STARTED': { icon: RefreshCw, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Synk startad' },
    'FORTNOX_SYNC_COMPLETED': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Synk klar' },
    'FORTNOX_SYNC_FAILED': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Synk misslyckades' },
    'CLASSIFICATION_COMPLETED': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Klassificering klar' },
    'CLASSIFICATION_CORRECTED': { icon: Edit2, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Klassificering korrigerad' },
    'SETTINGS_CHANGED': { icon: Edit2, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Inställning ändrad' },
    'PAYMENT_CREATED': { icon: Calculator, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Betalning skapad' },
    'PAYMENT_COMPLETED': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Betalning genomförd' },
    'PAYMENT_FAILED': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Betalning misslyckades' },
    'PERIOD_CLOSED': { icon: Shield, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Period stängd' },
    'USER_LOGIN': { icon: User, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Inloggning' },
    'USER_LOGOUT': { icon: User, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Utloggning' },
    'VAT_REPORT_GENERATED': { icon: FileText, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Momsrapport genererad' },
    'VAT_REPORT_EXPORTED': { icon: Download, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Momsrapport exporterad' },
    'securities.created': { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Ansökan skapad' },
    'securities.submitted': { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Ansökan inskickad' },
    'securities.approved': { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Ansökan godkänd' },
    'securities.rejected': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Ansökan nekad' },
    'dataroom.upload': { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Dokument uppladdat' },
    'dataroom.download': { icon: Download, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Dokument nedladdat' },
    'dataroom.view': { icon: Eye, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Dokument visat' },
  };
  return configs[action] || { icon: Eye, color: 'text-gray-600', bgColor: 'bg-gray-100', label: action.replace(/[._]/g, ' ') };
}

function formatDetailKey(key: string): string {
  const labels: Record<string, string> = {
    fileName: 'Filnamn', fundName: 'Fond', status: 'Status', comment: 'Kommentar',
    reason: 'Anledning', confidence: 'Konfidensgrad', voucherId: 'Verifikats-ID',
    summary: 'Sammanfattning', setting: 'Inställning', oldValue: 'Gammalt värde',
    newValue: 'Nytt värde', amount: 'Belopp', supplier: 'Leverantör',
    roomId: 'Rum-ID', action: 'Åtgärd', title: 'Titel', message: 'Meddelande',
    read: 'Läst', userEmail: 'Användar-epost',
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
}

function formatDetailValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') {
    if (value > 1000000) return `${(value / 1000000).toFixed(1)} Mkr`;
    return value.toLocaleString('sv-SE');
  }
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value ?? '');
}

const filterTabs = [
  { id: 'all', label: 'Alla' },
  { id: 'accounting', label: 'Bokföring' },
  { id: 'securities', label: 'Värdepapper' },
  { id: 'dataroom', label: 'Datarum' },
  { id: 'system', label: 'System' },
];

function AuditEntryRow({ entry, isExpanded, onToggle }: { entry: AuditEntry; isExpanded: boolean; onToggle: () => void }) {
  const config = getActionConfig(entry.action);
  const Icon = config.icon;
  const { date, time } = formatDateTime(entry.timestamp);

  return (
    <>
      <tr 
        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <button className="p-1">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <div className="text-sm">
              <div className="font-medium text-aifm-charcoal">{date}</div>
              <div className="text-gray-500">{time}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <span className={`font-medium text-sm ${config.color}`}>{config.label}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="text-sm">
            <div className="font-medium text-aifm-charcoal">{entry.actor.name}</div>
            <div className="text-gray-500 text-xs">{entry.actor.email}</div>
          </div>
        </td>
        <td className="px-4 py-3">
          {entry.target ? (
            <div className="text-sm">
              <div className="font-medium text-aifm-charcoal">{entry.target.name}</div>
              <div className="text-gray-500 text-xs capitalize">{entry.target.type}</div>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            entry.severity === 'error' || entry.severity === 'critical' ? 'bg-red-100 text-red-700' :
            entry.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {entry.severity}
          </span>
        </td>
      </tr>
      
      {isExpanded && (
        <tr>
          <td colSpan={5} className="px-4 py-0">
            <div className="ml-12 mb-4 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Detaljer</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {Object.entries(entry.details)
                  .filter(([, v]) => v !== undefined && v !== null && v !== '')
                  .map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 mb-1">{formatDetailKey(key)}</div>
                    <div className="font-medium text-gray-900">{formatDetailValue(value)}</div>
                  </div>
                ))}
                {entry.target && (
                  <>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Mål-ID</div>
                      <div className="font-mono text-gray-900 text-xs">{entry.target.id}</div>
                    </div>
                  </>
                )}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Källa</div>
                  <div className="font-medium text-gray-900 capitalize">{entry.source}</div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogPage() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit-trail?limit=300');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditLog(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte hämta loggar');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filteredLog = auditLog.filter(entry => {
    const matchesSearch = searchQuery === '' ||
      entry.actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.actor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.target?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getActionConfig(entry.action).label.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesTab = true;
    if (activeFilter === 'accounting') {
      matchesTab = entry.category === 'accounting' || entry.category === 'financial' || entry.category === 'document';
    } else if (activeFilter === 'securities') {
      matchesTab = entry.category === 'securities';
    } else if (activeFilter === 'dataroom') {
      matchesTab = entry.category === 'dataroom';
    } else if (activeFilter === 'system') {
      matchesTab = entry.category === 'system' || entry.category === 'security' || entry.category === 'compliance';
    }

    return matchesSearch && matchesTab;
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  const exportLog = () => {
    const headers = ['Tidpunkt', 'Händelse', 'Användare', 'E-post', 'Mål', 'Kategori', 'Källa', 'Detaljer'];
    const rows = filteredLog.map(entry => [
      entry.timestamp,
      getActionConfig(entry.action).label,
      entry.actor.name,
      entry.actor.email,
      entry.target?.name || '',
      entry.category,
      entry.source,
      JSON.stringify(entry.details),
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: auditLog.length,
    approved: auditLog.filter(e => e.action.includes('APPROVED') || e.action.includes('approved')).length,
    rejected: auditLog.filter(e => e.action.includes('REJECTED') || e.action.includes('rejected')).length,
    warnings: auditLog.filter(e => e.severity === 'warning' || e.severity === 'error' || e.severity === 'critical').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/nav-admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Ändringslogg</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Spårbarhet och revision av alla händelser
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportLog}
            disabled={filteredLog.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Exportera</span>
          </button>
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="text-sm font-medium">Uppdatera</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <History className="w-4 h-4" />
            <span className="text-sm">Totalt</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">{stats.total}</div>
          <div className="text-xs text-gray-500 mt-1">händelser</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Godkända</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">{stats.approved}</div>
          <div className="text-xs text-gray-500 mt-1">godkännanden</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">Avvisade</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">{stats.rejected}</div>
          <div className="text-xs text-gray-500 mt-1">avvisade</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Varningar</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">{stats.warnings}</div>
          <div className="text-xs text-gray-500 mt-1">varningar/fel</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeFilter === tab.id
                  ? 'border-aifm-gold text-aifm-gold bg-aifm-gold/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök användare, händelse eller mål..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            />
          </div>
        </div>

        {isLoading && auditLog.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-aifm-gold mx-auto mb-4" />
            <p className="text-gray-500">Hämtar ändringslogg...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tidpunkt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Händelse</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Användare</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mål</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Nivå</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLog.map((entry) => (
                  <AuditEntryRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedIds.has(entry.id)}
                    onToggle={() => toggleExpanded(entry.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredLog.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {auditLog.length === 0
              ? 'Inga händelser har loggats ännu'
              : 'Inga händelser matchar filtret'}
          </div>
        )}

        {filteredLog.length > 0 && (
          <div className="p-4 border-t border-gray-100 text-center">
            <span className="text-sm text-gray-400">
              Visar {filteredLog.length} av {auditLog.length} händelser
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
