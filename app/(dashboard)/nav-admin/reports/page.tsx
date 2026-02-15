'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText, Send, Download, Clock, CheckCircle2, AlertCircle,
  ArrowLeft, Mail, FolderOpen, Calendar, Users, Filter,
  RefreshCw, Eye, Paperclip, ChevronDown, Settings, Zap
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Report {
  id: string;
  fundName: string;
  reportType: 'NAV' | 'Nota' | 'SubRed' | 'Kontoutdrag';
  date: string;
  status: 'ready' | 'sent' | 'pending' | 'error';
  recipient?: string;
  sentAt?: string;
  fileSize?: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  funds: string[];
  reportTypes: string[];
}

// ============================================================================
// Mock Data
// ============================================================================

const mockReports: Report[] = [
  { id: '1', fundName: 'AUAG Essential Metals', reportType: 'NAV', date: '2025-01-17', status: 'ready', fileSize: '245 KB' },
  { id: '2', fundName: 'AuAg Gold Rush', reportType: 'NAV', date: '2025-01-17', status: 'ready', fileSize: '312 KB' },
  { id: '3', fundName: 'AuAg Precious Green', reportType: 'NAV', date: '2025-01-17', status: 'sent', recipient: 'förvaltare@example.com', sentAt: '08:35', fileSize: '198 KB' },
  { id: '4', fundName: 'AuAg Silver Bullet', reportType: 'NAV', date: '2025-01-17', status: 'sent', recipient: 'förvaltare@example.com', sentAt: '08:35', fileSize: '287 KB' },
  { id: '5', fundName: 'AUAG Essential Metals', reportType: 'Nota', date: '2025-01-17', status: 'ready', fileSize: '156 KB' },
  { id: '6', fundName: 'AuAg Gold Rush', reportType: 'Nota', date: '2025-01-17', status: 'ready', fileSize: '178 KB' },
  { id: '7', fundName: 'AuAg Precious Green', reportType: 'SubRed', date: '2025-01-17', status: 'pending', fileSize: '134 KB' },
  { id: '8', fundName: 'AuAg Silver Bullet', reportType: 'SubRed', date: '2025-01-17', status: 'pending', fileSize: '145 KB' },
  { id: '9', fundName: 'AuAg Gold Rush', reportType: 'Kontoutdrag', date: '2025-01-18', status: 'ready', fileSize: '89 KB' },
];

const mockRecipients: Recipient[] = [
  { id: '1', name: 'Johan Andersson', email: 'johan.andersson@forvaltare.se', funds: ['AUAG Essential Metals', 'AuAg Gold Rush'], reportTypes: ['NAV', 'Nota'] },
  { id: '2', name: 'Maria Svensson', email: 'maria.svensson@forvaltare.se', funds: ['AuAg Precious Green', 'AuAg Silver Bullet'], reportTypes: ['NAV', 'SubRed'] },
  { id: '3', name: 'Erik Lindberg', email: 'erik.lindberg@forvaltare.se', funds: ['AuAg Gold Rush', 'AuAg Silver Bullet'], reportTypes: ['NAV', 'Nota', 'SubRed', 'Kontoutdrag'] },
];

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: Report['status'] }) {
  const config = {
    ready: { label: 'Redo att skicka', color: 'bg-aifm-gold/15 text-aifm-charcoal', icon: FileText },
    sent: { label: 'Skickad', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
    pending: { label: 'Genereras', color: 'bg-amber-50 text-amber-600', icon: Clock },
    error: { label: 'Fel', color: 'bg-red-50 text-red-600', icon: AlertCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function ReportTypeBadge({ type }: { type: Report['reportType'] }) {
  const colors = {
    NAV: 'bg-aifm-gold/15 text-aifm-charcoal',
    Nota: 'bg-aifm-charcoal/[0.06] text-aifm-charcoal',
    SubRed: 'bg-emerald-50 text-emerald-600',
    Kontoutdrag: 'bg-amber-50 text-amber-600',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type]}`}>
      {type}
    </span>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NAVReportsPage() {
  const [selectedDate, setSelectedDate] = useState('2025-01-17');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);

  const filteredReports = mockReports.filter(report => {
    if (selectedType !== 'all' && report.reportType !== selectedType) return false;
    return true;
  });

  const readyReports = filteredReports.filter(r => r.status === 'ready');
  const sentReports = filteredReports.filter(r => r.status === 'sent');

  const toggleReportSelection = (id: string) => {
    setSelectedReports(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const selectAllReady = () => {
    setSelectedReports(readyReports.map(r => r.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 -mx-6 -mt-6 px-6 py-4 mb-2">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-aifm-charcoal/[0.04] rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">NAV-rapporter</h1>
            <p className="text-sm text-aifm-charcoal/40">
              Hantera och skicka ut NAV-rapporter, Notor och SubReds till förvaltare
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{readyReports.length}</p>
          <p className="text-sm text-aifm-charcoal/40">Redo att skicka</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <p className="text-2xl font-semibold tracking-tight text-emerald-600">{sentReports.length}</p>
          <p className="text-sm text-aifm-charcoal/40">Skickade idag</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{mockRecipients.length}</p>
          <p className="text-sm text-aifm-charcoal/40">Mottagare</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <p className="text-2xl font-semibold tracking-tight text-aifm-gold">~45 min</p>
          <p className="text-sm text-aifm-charcoal/40">Tid sparad/dag</p>
        </div>
      </div>

      {/* Automation Banner */}
      <div className="bg-aifm-charcoal/[0.03] rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-aifm-charcoal rounded-xl">
              <Zap className="w-6 h-6 text-aifm-gold" />
            </div>
            <div>
              <h3 className="font-semibold text-aifm-charcoal tracking-tight">Automatisk utskick aktiverat</h3>
              <p className="text-sm text-aifm-charcoal/40">
                NAV-rapporter skickas automatiskt kl 08:30 varje bankdag till konfigurerade mottagare
              </p>
            </div>
          </div>
          <Link
            href="/nav-admin/settings"
            className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all"
          >
            <Settings className="w-4 h-4" />
            Konfigurera
          </Link>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
            />
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="all">Alla typer</option>
            <option value="NAV">NAV-rapporter</option>
            <option value="Nota">Notor</option>
            <option value="SubRed">SubReds</option>
            <option value="Kontoutdrag">Kontoutdrag</option>
          </select>

          <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
            <RefreshCw className="w-4 h-4" />
            Uppdatera
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedReports.length > 0 && (
            <span className="text-sm text-aifm-charcoal/60">
              {selectedReports.length} valda
            </span>
          )}
          <button
            onClick={selectAllReady}
            className="px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all"
          >
            Välj alla redo
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            disabled={selectedReports.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Skicka valda ({selectedReports.length})
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-aifm-charcoal/[0.03] border-b border-gray-100">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedReports.length === readyReports.length && readyReports.length > 0}
                    onChange={() => selectedReports.length === readyReports.length ? setSelectedReports([]) : selectAllReady()}
                    className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Fond</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Typ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Storlek</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-aifm-charcoal/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedReports.includes(report.id)}
                      onChange={() => toggleReportSelection(report.id)}
                      disabled={report.status !== 'ready'}
                      className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20 disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-aifm-charcoal/30" />
                      <span className="font-medium text-aifm-charcoal">{report.fundName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ReportTypeBadge type={report.reportType} />
                  </td>
                  <td className="px-4 py-3 text-sm text-aifm-charcoal/70">
                    {report.date}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={report.status} />
                    {report.sentAt && (
                      <span className="ml-2 text-xs text-aifm-charcoal/50">kl {report.sentAt}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-aifm-charcoal/50">
                    {report.fileSize}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Förhandsgranska">
                        <Eye className="w-4 h-4 text-aifm-charcoal/50" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Ladda ned">
                        <Download className="w-4 h-4 text-aifm-charcoal/50" />
                      </button>
                      {report.status === 'ready' && (
                        <button className="p-2 hover:bg-aifm-gold/10 rounded-lg transition-colors" title="Skicka">
                          <Send className="w-4 h-4 text-aifm-gold" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipients Overview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Konfigurerade mottagare</h2>
          <button className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
            <Users className="w-4 h-4" />
            Hantera mottagare
          </button>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
          {mockRecipients.map((recipient) => (
            <div key={recipient.id} className="p-4 bg-aifm-charcoal/[0.02] rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-aifm-gold/20 rounded-full flex items-center justify-center">
                  <span className="text-sm font-semibold text-aifm-gold">
                    {recipient.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal">{recipient.name}</p>
                  <p className="text-xs text-aifm-charcoal/50">{recipient.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-aifm-charcoal/50 mb-1">Fonder</p>
                  <div className="flex flex-wrap gap-1">
                    {recipient.funds.map((fund) => (
                      <span key={fund} className="px-2 py-0.5 bg-white rounded text-xs text-aifm-charcoal/70">
                        {fund}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-aifm-charcoal/50 mb-1">Rapporttyper</p>
                  <div className="flex flex-wrap gap-1">
                    {recipient.reportTypes.map((type) => (
                      <ReportTypeBadge key={type} type={type as Report['reportType']} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Skicka rapporter</h3>
              <p className="text-sm text-aifm-charcoal/60 mt-1">
                {selectedReports.length} rapporter kommer att skickas till konfigurerade mottagare
              </p>
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-6">
                {selectedReports.map((id) => {
                  const report = mockReports.find(r => r.id === id);
                  if (!report) return null;
                  return (
                    <div key={id} className="flex items-center justify-between p-3 bg-aifm-charcoal/[0.02] rounded-xl">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-aifm-charcoal/40" />
                        <span className="text-sm text-aifm-charcoal">{report.fundName}</span>
                        <ReportTypeBadge type={report.reportType} />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 px-4 py-2.5 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm font-medium transition-all"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => {
                    alert(`Skickar ${selectedReports.length} rapporter...`);
                    setShowSendModal(false);
                    setSelectedReports([]);
                  }}
                  className="flex-1 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Skicka nu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
