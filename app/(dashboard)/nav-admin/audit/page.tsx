'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, History, Search, Filter, Download, Calendar,
  User, CheckCircle2, XCircle, Clock, AlertTriangle, Edit2,
  Eye, FileText, Calculator, Shield, Mail, RefreshCw, Loader2,
  ChevronDown, ChevronRight
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type AuditAction = 
  | 'NAV_CALCULATED'
  | 'NAV_APPROVED_FIRST'
  | 'NAV_APPROVED_SECOND'
  | 'NAV_REJECTED'
  | 'NAV_PUBLISHED'
  | 'CONFIG_CHANGED'
  | 'RECIPIENT_ADDED'
  | 'RECIPIENT_REMOVED'
  | 'EMAIL_SENT'
  | 'EXPORT_GENERATED'
  | 'MANUAL_OVERRIDE';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId: string;
  userName: string;
  userEmail: string;
  fundId?: string;
  fundName?: string;
  shareClassId?: string;
  navDate?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockAuditLog: AuditEntry[] = [
  {
    id: 'a1',
    timestamp: '2026-02-02T15:32:00Z',
    action: 'NAV_APPROVED_SECOND',
    userId: 'u1',
    userName: 'Christopher Genberg',
    userEmail: 'christopher.genberg@aifm.se',
    fundId: 'f4',
    fundName: 'AuAg Silver Bullet',
    shareClassId: 'sc4a',
    navDate: '2026-02-02',
    details: { navPerShare: 378.33, previousNav: 377.15, change: '+0.31%' },
    ipAddress: '192.168.1.100',
  },
  {
    id: 'a2',
    timestamp: '2026-02-02T15:28:00Z',
    action: 'NAV_APPROVED_FIRST',
    userId: 'u2',
    userName: 'Anna Lindberg',
    userEmail: 'anna.lindberg@aifm.se',
    fundId: 'f4',
    fundName: 'AuAg Silver Bullet',
    shareClassId: 'sc4a',
    navDate: '2026-02-02',
    details: { navPerShare: 378.33, validationStatus: 'PASSED' },
    ipAddress: '192.168.1.101',
  },
  {
    id: 'a3',
    timestamp: '2026-02-02T15:15:00Z',
    action: 'NAV_CALCULATED',
    userId: 'system',
    userName: 'System',
    userEmail: 'system@aifm.se',
    fundId: 'f4',
    fundName: 'AuAg Silver Bullet',
    shareClassId: 'sc4a',
    navDate: '2026-02-02',
    details: { navPerShare: 378.33, grossAssets: 8956000000, liabilities: 45000000, runId: 'NAV-2026-02-02-001' },
  },
  {
    id: 'a4',
    timestamp: '2026-02-02T14:45:00Z',
    action: 'EMAIL_SENT',
    userId: 'system',
    userName: 'System',
    userEmail: 'system@aifm.se',
    details: { recipients: ['nav@aifm.se', 'christopher.genberg@aifm.se'], subject: 'NAV-rapport 2026-02-02', messageId: 'SES-12345' },
  },
  {
    id: 'a5',
    timestamp: '2026-02-02T10:30:00Z',
    action: 'CONFIG_CHANGED',
    userId: 'u1',
    userName: 'Christopher Genberg',
    userEmail: 'christopher.genberg@aifm.se',
    details: { field: 'navTime', oldValue: '14:30', newValue: '15:00', section: 'schedule' },
    ipAddress: '192.168.1.100',
  },
  {
    id: 'a6',
    timestamp: '2026-02-01T15:35:00Z',
    action: 'NAV_PUBLISHED',
    userId: 'system',
    userName: 'System',
    userEmail: 'system@aifm.se',
    fundId: 'f4',
    fundName: 'AuAg Silver Bullet',
    navDate: '2026-02-01',
    details: { publishedTo: ['Bloomberg', 'Morningstar', 'SIX'], shareClasses: ['A', 'B'] },
  },
  {
    id: 'a7',
    timestamp: '2026-02-01T15:30:00Z',
    action: 'EXPORT_GENERATED',
    userId: 'u1',
    userName: 'Christopher Genberg',
    userEmail: 'christopher.genberg@aifm.se',
    navDate: '2026-02-01',
    details: { format: 'PDF', funds: ['AuAg Silver Bullet', 'AuAg Gold Rush'], fileName: 'nav-rapport-2026-02-01.pdf' },
    ipAddress: '192.168.1.100',
  },
  {
    id: 'a8',
    timestamp: '2026-01-31T16:00:00Z',
    action: 'NAV_REJECTED',
    userId: 'u2',
    userName: 'Anna Lindberg',
    userEmail: 'anna.lindberg@aifm.se',
    fundId: 'f2',
    fundName: 'AuAg Gold Rush',
    shareClassId: 'sc2a',
    navDate: '2026-01-31',
    details: { reason: 'Prisdata saknas för 3 positioner', navPerShare: 208.71 },
    ipAddress: '192.168.1.101',
  },
  {
    id: 'a9',
    timestamp: '2026-01-31T15:15:00Z',
    action: 'RECIPIENT_ADDED',
    userId: 'u1',
    userName: 'Christopher Genberg',
    userEmail: 'christopher.genberg@aifm.se',
    details: { recipientName: 'Finansinspektionen', recipientEmail: 'rapporter@fi.se', type: 'REGULATOR' },
    ipAddress: '192.168.1.100',
  },
  {
    id: 'a10',
    timestamp: '2026-01-30T11:20:00Z',
    action: 'MANUAL_OVERRIDE',
    userId: 'u1',
    userName: 'Christopher Genberg',
    userEmail: 'christopher.genberg@aifm.se',
    fundId: 'f1',
    fundName: 'AUAG Essential Metals',
    shareClassId: 'sc1a',
    navDate: '2026-01-30',
    details: { field: 'position_price', securityId: 'SE0012455673', oldPrice: 145.50, newPrice: 146.20, reason: 'Bloomberg-pris felaktigt' },
    ipAddress: '192.168.1.100',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateTime(timestamp: string): { date: string; time: string } {
  const d = new Date(timestamp);
  return {
    date: d.toLocaleDateString('sv-SE'),
    time: d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getActionConfig(action: AuditAction): { icon: React.ElementType; color: string; bgColor: string; label: string } {
  const configs: Record<AuditAction, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
    NAV_CALCULATED: { icon: Calculator, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'NAV beräknad' },
    NAV_APPROVED_FIRST: { icon: CheckCircle2, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Första godkännande' },
    NAV_APPROVED_SECOND: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Slutgodkänd' },
    NAV_REJECTED: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Avvisad' },
    NAV_PUBLISHED: { icon: FileText, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Publicerad' },
    CONFIG_CHANGED: { icon: Edit2, color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Konfiguration ändrad' },
    RECIPIENT_ADDED: { icon: User, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Mottagare tillagd' },
    RECIPIENT_REMOVED: { icon: User, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Mottagare borttagen' },
    EMAIL_SENT: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'E-post skickad' },
    EXPORT_GENERATED: { icon: Download, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Export genererad' },
    MANUAL_OVERRIDE: { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Manuell ändring' },
  };
  return configs[action];
}

// ============================================================================
// Components
// ============================================================================

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
            <div className="font-medium text-aifm-charcoal">{entry.userName}</div>
            <div className="text-gray-500 text-xs">{entry.userEmail}</div>
          </div>
        </td>
        <td className="px-4 py-3">
          {entry.fundName ? (
            <div className="text-sm">
              <div className="font-medium text-aifm-charcoal">{entry.fundName}</div>
              {entry.shareClassId && <div className="text-gray-500 text-xs">Klass {entry.shareClassId.replace(/sc\d+/, '').toUpperCase()}</div>}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
        </td>
      </tr>
      
      {/* Expanded Details */}
      {isExpanded && (
        <tr>
          <td colSpan={5} className="px-4 py-0">
            <div className="ml-12 mb-4 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Detaljer</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {Object.entries(entry.details).map(([key, value]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 mb-1">{formatDetailKey(key)}</div>
                    <div className="font-medium text-gray-900">{formatDetailValue(value)}</div>
                  </div>
                ))}
                {entry.ipAddress && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">IP-adress</div>
                    <div className="font-mono text-gray-900">{entry.ipAddress}</div>
                  </div>
                )}
                {entry.navDate && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">NAV-datum</div>
                    <div className="font-medium text-gray-900">{entry.navDate}</div>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatDetailKey(key: string): string {
  const labels: Record<string, string> = {
    navPerShare: 'NAV per andel',
    previousNav: 'Tidigare NAV',
    change: 'Förändring',
    validationStatus: 'Valideringsstatus',
    grossAssets: 'Bruttotillgångar',
    liabilities: 'Skulder',
    runId: 'Körnings-ID',
    recipients: 'Mottagare',
    subject: 'Ämne',
    messageId: 'Meddelande-ID',
    field: 'Fält',
    oldValue: 'Gammalt värde',
    newValue: 'Nytt värde',
    section: 'Sektion',
    publishedTo: 'Publicerad till',
    shareClasses: 'Andelsklasser',
    format: 'Format',
    funds: 'Fonder',
    fileName: 'Filnamn',
    reason: 'Anledning',
    recipientName: 'Mottagarnamn',
    recipientEmail: 'Mottagare e-post',
    type: 'Typ',
    securityId: 'Värdepappers-ID',
    oldPrice: 'Gammalt pris',
    newPrice: 'Nytt pris',
  };
  return labels[key] || key;
}

function formatDetailValue(value: any): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'number') {
    if (value > 1000000) {
      return `${(value / 1000000).toFixed(1)} Mkr`;
    }
    return value.toLocaleString('sv-SE');
  }
  return String(value);
}

// ============================================================================
// Filter Tabs
// ============================================================================

const filterTabs = [
  { id: 'all', label: 'Alla' },
  { id: 'nav', label: 'NAV-händelser' },
  { id: 'approvals', label: 'Godkännanden' },
  { id: 'config', label: 'Konfiguration' },
  { id: 'exports', label: 'Exporter' },
];

// ============================================================================
// Main Page
// ============================================================================

export default function AuditLogPage() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(mockAuditLog);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('7d');

  // Filter logic
  const filteredLog = auditLog.filter(entry => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      entry.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.fundName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getActionConfig(entry.action).label.toLowerCase().includes(searchQuery.toLowerCase());

    // Tab filter
    let matchesTab = true;
    if (activeFilter === 'nav') {
      matchesTab = ['NAV_CALCULATED', 'NAV_PUBLISHED'].includes(entry.action);
    } else if (activeFilter === 'approvals') {
      matchesTab = ['NAV_APPROVED_FIRST', 'NAV_APPROVED_SECOND', 'NAV_REJECTED'].includes(entry.action);
    } else if (activeFilter === 'config') {
      matchesTab = ['CONFIG_CHANGED', 'RECIPIENT_ADDED', 'RECIPIENT_REMOVED', 'MANUAL_OVERRIDE'].includes(entry.action);
    } else if (activeFilter === 'exports') {
      matchesTab = ['EXPORT_GENERATED', 'EMAIL_SENT'].includes(entry.action);
    }

    return matchesSearch && matchesTab;
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const exportLog = () => {
    const headers = ['Tidpunkt', 'Händelse', 'Användare', 'E-post', 'Fond', 'NAV-datum', 'Detaljer'];
    const rows = filteredLog.map(entry => [
      entry.timestamp,
      getActionConfig(entry.action).label,
      entry.userName,
      entry.userEmail,
      entry.fundName || '',
      entry.navDate || '',
      JSON.stringify(entry.details),
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Ändringslogg</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Spårbarhet och revision av alla NAV-händelser
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportLog}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Exportera</span>
          </button>
          <button
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors"
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
          <div className="text-2xl font-bold text-aifm-charcoal">{auditLog.length}</div>
          <div className="text-xs text-gray-500 mt-1">händelser</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">Godkända</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">
            {auditLog.filter(e => e.action === 'NAV_APPROVED_SECOND').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">NAV godkända</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">Avvisade</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">
            {auditLog.filter(e => e.action === 'NAV_REJECTED').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">NAV avvisade</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-orange-600 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Manuella</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">
            {auditLog.filter(e => e.action === 'MANUAL_OVERRIDE').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">ändringar</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Tab Filter */}
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

        {/* Search & Date Filter */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök användare, fond eller händelse..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            />
          </div>
          <div className="flex gap-2">
            {(['today', '7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-aifm-gold text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === 'today' ? 'Idag' : range === '7d' ? '7 dagar' : range === '30d' ? '30 dagar' : 'Alla'}
              </button>
            ))}
          </div>
        </div>

        {/* Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tidpunkt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Händelse</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Användare</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fond</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Åtgärd</th>
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

        {filteredLog.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Inga händelser matchar filtret
          </div>
        )}
      </div>
    </div>
  );
}
