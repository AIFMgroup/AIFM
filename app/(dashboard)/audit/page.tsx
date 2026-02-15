'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  ChevronDown,
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
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ============ Types ============
interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  category: 'user' | 'document' | 'compliance' | 'financial' | 'system' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  companyId?: string;
  companyName?: string;
}

// ============ Mock Data ============
const mockAuditLogs: AuditLogEntry[] = [
  {
    id: '1',
    timestamp: '2026-01-08T14:32:15Z',
    action: 'document.uploaded',
    category: 'document',
    severity: 'info',
    actor: { id: 'u1', name: 'Anna Svensson', email: 'anna@example.com', role: 'Admin' },
    target: { type: 'document', id: 'd1', name: 'Q4_Financial_Report.pdf' },
    details: { size: '2.4 MB', format: 'PDF' },
    ipAddress: '192.168.1.100',
    companyId: 'c1',
    companyName: 'Mitt Företag AB',
  },
  {
    id: '2',
    timestamp: '2026-01-08T14:28:45Z',
    action: 'user.login',
    category: 'security',
    severity: 'info',
    actor: { id: 'u2', name: 'Erik Johansson', email: 'erik@example.com', role: 'User' },
    details: { method: 'SSO', provider: 'Microsoft' },
    ipAddress: '10.0.0.15',
  },
  {
    id: '3',
    timestamp: '2026-01-08T14:15:00Z',
    action: 'compliance.task_completed',
    category: 'compliance',
    severity: 'info',
    actor: { id: 'u1', name: 'Anna Svensson', email: 'anna@example.com', role: 'Admin' },
    target: { type: 'task', id: 't1', name: 'Årsrapport FI' },
    details: { dueDate: '2026-01-15', completedEarly: true },
    companyId: 'c1',
    companyName: 'Mitt Företag AB',
  },
  {
    id: '4',
    timestamp: '2026-01-08T13:45:22Z',
    action: 'financial.transaction_approved',
    category: 'financial',
    severity: 'info',
    actor: { id: 'u3', name: 'Maria Lindgren', email: 'maria@example.com', role: 'CFO' },
    target: { type: 'transaction', id: 'tx1', name: 'Capital Call #24' },
    details: { amount: '5,000,000 SEK', investors: 12 },
    companyId: 'c2',
    companyName: 'Tech Fund I AB',
  },
  {
    id: '5',
    timestamp: '2026-01-08T12:30:00Z',
    action: 'user.permission_changed',
    category: 'security',
    severity: 'warning',
    actor: { id: 'u1', name: 'Anna Svensson', email: 'anna@example.com', role: 'Admin' },
    target: { type: 'user', id: 'u4', name: 'Kalle Andersson' },
    details: { oldRole: 'Viewer', newRole: 'Editor', reason: 'Project assignment' },
  },
  {
    id: '6',
    timestamp: '2026-01-08T11:15:33Z',
    action: 'system.backup_completed',
    category: 'system',
    severity: 'info',
    actor: { id: 'system', name: 'System', email: 'system@aifm.se', role: 'System' },
    details: { type: 'Full backup', size: '45.2 GB', duration: '12 min' },
  },
  {
    id: '7',
    timestamp: '2026-01-08T10:00:00Z',
    action: 'security.failed_login',
    category: 'security',
    severity: 'error',
    actor: { id: 'unknown', name: 'Okänd', email: 'test@attacker.com', role: 'Unknown' },
    details: { attempts: 5, blocked: true, reason: 'Invalid credentials' },
    ipAddress: '203.0.113.50',
  },
  {
    id: '8',
    timestamp: '2026-01-08T09:45:00Z',
    action: 'document.shared',
    category: 'document',
    severity: 'info',
    actor: { id: 'u2', name: 'Erik Johansson', email: 'erik@example.com', role: 'User' },
    target: { type: 'document', id: 'd2', name: 'Investment_Memo.docx' },
    details: { sharedWith: ['investor@client.com'], expiry: '2026-01-15' },
    companyId: 'c1',
    companyName: 'Mitt Företag AB',
  },
  {
    id: '9',
    timestamp: '2026-01-07T16:30:00Z',
    action: 'compliance.violation_detected',
    category: 'compliance',
    severity: 'critical',
    actor: { id: 'system', name: 'Compliance Agent', email: 'compliance@aifm.se', role: 'System' },
    target: { type: 'policy', id: 'p1', name: 'AIFMD Article 21' },
    details: { description: 'Missing depository agreement', deadline: '2026-01-20' },
    companyId: 'c2',
    companyName: 'Tech Fund I AB',
  },
  {
    id: '10',
    timestamp: '2026-01-07T14:00:00Z',
    action: 'user.created',
    category: 'user',
    severity: 'info',
    actor: { id: 'u1', name: 'Anna Svensson', email: 'anna@example.com', role: 'Admin' },
    target: { type: 'user', id: 'u5', name: 'Lisa Bergström' },
    details: { role: 'Analyst', department: 'Fund Management' },
  },
];

// ============ Helper Functions ============
const getCategoryIcon = (category: string) => {
  const icons: Record<string, React.ReactNode> = {
    user: <User className="w-4 h-4" />,
    document: <FileText className="w-4 h-4" />,
    compliance: <Shield className="w-4 h-4" />,
    financial: <DollarSign className="w-4 h-4" />,
    system: <Settings className="w-4 h-4" />,
    security: <AlertTriangle className="w-4 h-4" />,
  };
  return icons[category] || <Eye className="w-4 h-4" />;
};

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    user: 'bg-aifm-gold/10 text-aifm-charcoal',
    document: 'bg-aifm-charcoal/[0.06] text-aifm-charcoal',
    compliance: 'bg-aifm-gold/15 text-aifm-charcoal',
    financial: 'bg-amber-100 text-amber-700',
    system: 'bg-gray-100 text-aifm-charcoal/70',
    security: 'bg-red-100 text-red-700',
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

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    'document.uploaded': 'Dokument uppladdat',
    'document.shared': 'Dokument delat',
    'document.deleted': 'Dokument raderat',
    'user.login': 'Användare loggade in',
    'user.logout': 'Användare loggade ut',
    'user.created': 'Användare skapad',
    'user.permission_changed': 'Behörighet ändrad',
    'compliance.task_completed': 'Compliance-uppgift slutförd',
    'compliance.violation_detected': 'Regelöverträdelse upptäckt',
    'financial.transaction_approved': 'Transaktion godkänd',
    'system.backup_completed': 'Backup slutförd',
    'security.failed_login': 'Misslyckad inloggning',
  };
  return labels[action] || action;
};

// ============ Main Component ============
export default function AuditTrailPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Filter logs
  const filteredLogs = useMemo(() => {
    return mockAuditLogs.filter(log => {
      const matchesSearch = 
        searchQuery === '' ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.target?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.companyName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
      const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
      
      return matchesSearch && matchesCategory && matchesSeverity;
    });
  }, [searchQuery, selectedCategory, selectedSeverity]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = mockAuditLogs.filter(l => new Date(l.timestamp).toDateString() === today);
    return {
      total: mockAuditLogs.length,
      today: todayLogs.length,
      critical: mockAuditLogs.filter(l => l.severity === 'critical').length,
      warnings: mockAuditLogs.filter(l => l.severity === 'warning' || l.severity === 'error').length,
    };
  }, []);

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
              <button className="inline-flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportera</span>
              </button>
              <button className="inline-flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
                <RefreshCw className="w-4 h-4" />
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
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.total}</div>
                <div className="text-sm text-aifm-charcoal/40">Totala loggar</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-aifm-gold/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-aifm-gold" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.today}</div>
                <div className="text-sm text-aifm-charcoal/40">Idag</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.critical}</div>
                <div className="text-sm text-aifm-charcoal/40">Kritiska</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{stats.warnings}</div>
                <div className="text-sm text-aifm-charcoal/40">Varningar</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
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
            
            {/* Category Filter */}
            <div className="w-full lg:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
              >
                <option value="all">Alla kategorier</option>
                <option value="user">Användare</option>
                <option value="document">Dokument</option>
                <option value="compliance">Compliance</option>
                <option value="financial">Finansiellt</option>
                <option value="system">System</option>
                <option value="security">Säkerhet</option>
              </select>
            </div>
            
            {/* Severity Filter */}
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

            {/* Date Range */}
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

        {/* Audit Log List */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`transition-colors ${expandedLog === log.id ? 'bg-aifm-charcoal/[0.02]' : 'hover:bg-aifm-charcoal/[0.01]'}`}
              >
                {/* Main Row */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Category Icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${getCategoryColor(log.category)}`}>
                      {getCategoryIcon(log.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-aifm-charcoal">{getActionLabel(log.action)}</span>
                            {getSeverityBadge(log.severity)}
                          </div>
                          <div className="text-sm text-aifm-charcoal/40 mt-1">
                            <span className="font-medium text-aifm-charcoal/70">{log.actor.name}</span>
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
                      
                      {/* Company badge */}
                      {log.companyName && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-aifm-gold/15 text-aifm-charcoal rounded-full text-xs font-medium">
                            <Building2 className="w-3 h-3" />
                            {log.companyName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === log.id && (
                  <div className="px-4 pb-4">
                    <div className="ml-13 pl-4 border-l-2 border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {/* Actor Info */}
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
                            <div className="flex justify-between">
                              <span className="text-aifm-charcoal/40">Roll:</span>
                              <span className="text-aifm-charcoal">{log.actor.role}</span>
                            </div>
                            {log.ipAddress && (
                              <div className="flex justify-between">
                                <span className="text-aifm-charcoal/40">IP-adress:</span>
                                <span className="text-aifm-charcoal font-mono text-xs">{log.ipAddress}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-aifm-charcoal/70">Detaljer</h4>
                          <div className="bg-aifm-charcoal/[0.03] rounded-xl p-3 space-y-1">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-aifm-charcoal/40 capitalize">{key.replace(/_/g, ' ')}:</span>
                                <span className="text-aifm-charcoal">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Target Info */}
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

                        {/* Timestamp */}
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

          {/* Empty State */}
          {filteredLogs.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-aifm-charcoal/[0.03] rounded-full flex items-center justify-center">
                <Search className="w-8 h-8 text-aifm-charcoal/20" />
              </div>
              <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight mb-1">Inga loggar hittades</h3>
              <p className="text-aifm-charcoal/40">Försök justera dina sökfilter</p>
            </div>
          )}

          {/* Load More */}
          {filteredLogs.length > 0 && (
            <div className="p-4 border-t border-gray-100 text-center">
              <button className="text-sm text-aifm-charcoal/40 hover:text-aifm-charcoal font-medium transition-colors">
                Ladda fler loggar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



