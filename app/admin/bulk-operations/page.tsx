'use client';

import { useState, useEffect } from 'react';
import { 
  Layers, Play, Pause, Check, X, Clock, AlertTriangle,
  FileText, Users, RefreshCw, ChevronDown, Filter, Search,
  Copy, Trash2, Archive, Send, Tag, UserPlus, Settings,
  Calendar, BarChart3, Plus, Eye, Download
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type BulkActionType = 
  | 'APPROVE_DOCUMENTS'
  | 'REJECT_DOCUMENTS'
  | 'SYNC_TO_FORTNOX'
  | 'UPDATE_ACCOUNTS'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'ASSIGN_USER'
  | 'ARCHIVE_DOCUMENTS'
  | 'DELETE_DOCUMENTS';

type OperationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING_APPROVAL';

interface BulkOperation {
  id: string;
  type: BulkActionType;
  name: string;
  targetCount: number;
  status: OperationStatus;
  progress: number;
  results: {
    successful: number;
    failed: number;
    errors: { targetId: string; error: string }[];
  };
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  requiresApproval: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  usageCount: number;
}

interface StandardComment {
  id: string;
  category: string;
  text: string;
  shortcut?: string;
  usageCount: number;
}

interface RecurringJob {
  id: string;
  name: string;
  actionType: BulkActionType;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'partial' | 'failed';
  nextRunAt: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockOperations: BulkOperation[] = [
  { id: 'op-1', type: 'APPROVE_DOCUMENTS', name: 'Godkänn månadsfakturor', targetCount: 45, status: 'COMPLETED', progress: 100, results: { successful: 44, failed: 1, errors: [{ targetId: 'doc-123', error: 'Saknar godkännare' }] }, createdBy: 'Anna S.', createdAt: '2024-12-08T10:30:00', completedAt: '2024-12-08T10:32:45', requiresApproval: false },
  { id: 'op-2', type: 'SYNC_TO_FORTNOX', name: 'Synka Q4 transaktioner', targetCount: 120, status: 'RUNNING', progress: 65, results: { successful: 78, failed: 0, errors: [] }, createdBy: 'Erik J.', createdAt: '2024-12-08T11:00:00', requiresApproval: true },
  { id: 'op-3', type: 'ADD_TAG', name: 'Tagga kostnadsställe', targetCount: 30, status: 'PENDING_APPROVAL', progress: 0, results: { successful: 0, failed: 0, errors: [] }, createdBy: 'Maria L.', createdAt: '2024-12-08T09:15:00', requiresApproval: true },
  { id: 'op-4', type: 'ARCHIVE_DOCUMENTS', name: 'Arkivera 2023 dokument', targetCount: 500, status: 'COMPLETED', progress: 100, results: { successful: 500, failed: 0, errors: [] }, createdBy: 'System', createdAt: '2024-12-01T02:00:00', completedAt: '2024-12-01T02:15:00', requiresApproval: false },
  { id: 'op-5', type: 'DELETE_DOCUMENTS', name: 'Radera dubbletter', targetCount: 15, status: 'FAILED', progress: 40, results: { successful: 6, failed: 9, errors: [{ targetId: 'doc-456', error: 'Dokument låst' }] }, createdBy: 'Admin', createdAt: '2024-12-07T16:00:00', completedAt: '2024-12-07T16:05:00', requiresApproval: true },
];

const mockTemplates: Template[] = [
  { id: 'tpl-1', name: 'Standard leverantörsfaktura', description: 'Mall för vanliga leverantörsfakturor', category: 'INVOICE_CLASSIFICATION', usageCount: 156 },
  { id: 'tpl-2', name: 'Reseräkning', description: 'Mall för reseersättningar och utlägg', category: 'EXPENSE_REPORT', usageCount: 42 },
  { id: 'tpl-3', name: 'Periodisering', description: 'Mall för periodiseringsbokningar', category: 'JOURNAL_ENTRY', usageCount: 28 },
  { id: 'tpl-4', name: 'Kvartalsrapport', description: 'Mall för kvartalsrapportering', category: 'REPORT', usageCount: 12 },
];

const mockComments: StandardComment[] = [
  { id: 'c-1', category: 'approval', text: 'Godkänt utan anmärkning', shortcut: '/ok', usageCount: 234 },
  { id: 'c-2', category: 'approval', text: 'Godkänt med mindre avvikelser', shortcut: '/okm', usageCount: 89 },
  { id: 'c-3', category: 'rejection', text: 'Avvisas - behöver kompletterande information', shortcut: '/info', usageCount: 56 },
  { id: 'c-4', category: 'rejection', text: 'Avvisas - belopp stämmer inte', shortcut: '/belopp', usageCount: 34 },
  { id: 'c-5', category: 'verification', text: 'Verifierat mot kontoutdrag', shortcut: '/ver', usageCount: 123 },
];

const mockRecurringJobs: RecurringJob[] = [
  { id: 'job-1', name: 'Daglig Fortnox-synk', actionType: 'SYNC_TO_FORTNOX', schedule: 'Varje dag 06:00', enabled: true, lastRunAt: '2024-12-08T06:00:00', lastRunStatus: 'success', nextRunAt: '2024-12-09T06:00:00' },
  { id: 'job-2', name: 'Veckovis arkivering', actionType: 'ARCHIVE_DOCUMENTS', schedule: 'Söndag 02:00', enabled: true, lastRunAt: '2024-12-01T02:00:00', lastRunStatus: 'success', nextRunAt: '2024-12-08T02:00:00' },
  { id: 'job-3', name: 'Auto-godkännande <500kr', actionType: 'APPROVE_DOCUMENTS', schedule: 'Varje timme', enabled: false, lastRunAt: '2024-12-07T12:00:00', lastRunStatus: 'partial', nextRunAt: '-' },
];

// ============================================================================
// Components
// ============================================================================

const actionIcons: Record<BulkActionType, typeof FileText> = {
  APPROVE_DOCUMENTS: Check,
  REJECT_DOCUMENTS: X,
  SYNC_TO_FORTNOX: Send,
  UPDATE_ACCOUNTS: Settings,
  ADD_TAG: Tag,
  REMOVE_TAG: Tag,
  ASSIGN_USER: UserPlus,
  ARCHIVE_DOCUMENTS: Archive,
  DELETE_DOCUMENTS: Trash2,
};

const actionLabels: Record<BulkActionType, string> = {
  APPROVE_DOCUMENTS: 'Godkänn dokument',
  REJECT_DOCUMENTS: 'Avvisa dokument',
  SYNC_TO_FORTNOX: 'Synka till Fortnox',
  UPDATE_ACCOUNTS: 'Uppdatera konton',
  ADD_TAG: 'Lägg till tagg',
  REMOVE_TAG: 'Ta bort tagg',
  ASSIGN_USER: 'Tilldela användare',
  ARCHIVE_DOCUMENTS: 'Arkivera dokument',
  DELETE_DOCUMENTS: 'Ta bort dokument',
};

function StatusBadge({ status }: { status: OperationStatus }) {
  const config: Record<OperationStatus, { label: string; color: string; icon: typeof Clock }> = {
    PENDING: { label: 'Väntar', color: 'bg-gray-100 text-gray-600', icon: Clock },
    RUNNING: { label: 'Körs', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
    COMPLETED: { label: 'Klar', color: 'bg-emerald-100 text-emerald-700', icon: Check },
    FAILED: { label: 'Misslyckad', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    PENDING_APPROVAL: { label: 'Väntar godkännande', color: 'bg-amber-100 text-amber-700', icon: Clock },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${color}`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'RUNNING' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: OperationStatus }) {
  const colorClass = {
    COMPLETED: 'bg-emerald-500',
    FAILED: 'bg-red-500',
    RUNNING: 'bg-blue-500',
    PENDING: 'bg-gray-400',
    PENDING_APPROVAL: 'bg-amber-500',
  }[status];

  return (
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div 
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function OperationCard({ operation }: { operation: BulkOperation }) {
  const Icon = actionIcons[operation.type];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              operation.status === 'COMPLETED' ? 'bg-emerald-100' :
              operation.status === 'FAILED' ? 'bg-red-100' :
              operation.status === 'RUNNING' ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <Icon className={`w-5 h-5 ${
                operation.status === 'COMPLETED' ? 'text-emerald-600' :
                operation.status === 'FAILED' ? 'text-red-600' :
                operation.status === 'RUNNING' ? 'text-blue-600' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <h3 className="font-medium text-aifm-charcoal">{operation.name}</h3>
              <p className="text-xs text-aifm-charcoal/50">
                {actionLabels[operation.type]} • {operation.targetCount} objekt
              </p>
            </div>
          </div>
          <StatusBadge status={operation.status} />
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-aifm-charcoal/60 mb-1">
            <span>Framsteg</span>
            <span>{operation.results.successful}/{operation.targetCount} ({operation.progress}%)</span>
          </div>
          <ProgressBar progress={operation.progress} status={operation.status} />
        </div>

        <div className="flex items-center justify-between text-xs text-aifm-charcoal/40">
          <span>{operation.createdBy} • {new Date(operation.createdAt).toLocaleString('sv-SE')}</span>
          {operation.results.failed > 0 && (
            <span className="text-red-600">{operation.results.failed} misslyckade</span>
          )}
        </div>

        {(operation.results.errors.length > 0 || operation.status === 'PENDING_APPROVAL') && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-1 text-xs text-aifm-charcoal/50 hover:text-aifm-charcoal"
          >
            {expanded ? 'Dölj detaljer' : 'Visa detaljer'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50/50">
          {operation.status === 'PENDING_APPROVAL' && (
            <div className="pt-4 flex gap-2">
              <button className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                Godkänn
              </button>
              <button className="flex-1 py-2.5 bg-white border border-gray-200 text-aifm-charcoal rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Avvisa
              </button>
            </div>
          )}
          {operation.results.errors.length > 0 && (
            <div className="pt-4 space-y-2">
              <p className="text-xs font-semibold text-aifm-charcoal/50 uppercase">Fel</p>
              {operation.results.errors.slice(0, 5).map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{err.targetId}: {err.error}</span>
                </div>
              ))}
              {operation.results.errors.length > 5 && (
                <p className="text-xs text-aifm-charcoal/40">
                  +{operation.results.errors.length - 5} fler fel...
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-purple-600" />
        </div>
        <button className="p-2 text-aifm-charcoal/30 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <h3 className="font-medium text-aifm-charcoal mb-1">{template.name}</h3>
      <p className="text-xs text-aifm-charcoal/50 mb-3 line-clamp-2">{template.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-aifm-charcoal/40">Använd {template.usageCount}x</span>
        <button className="text-xs text-aifm-gold font-medium hover:text-aifm-gold/80 transition-colors">
          Använd →
        </button>
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: StandardComment }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-aifm-gold/30 transition-all cursor-pointer group">
      <div className="flex items-center gap-3">
        {comment.shortcut && (
          <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-aifm-charcoal/70 group-hover:bg-aifm-gold/10 group-hover:text-aifm-gold transition-colors">
            {comment.shortcut}
          </span>
        )}
        <span className="text-sm text-aifm-charcoal">{comment.text}</span>
      </div>
      <span className="text-xs text-aifm-charcoal/40">{comment.usageCount}x</span>
    </div>
  );
}

function RecurringJobCard({ job }: { job: RecurringJob }) {
  const Icon = actionIcons[job.actionType];

  return (
    <div className={`bg-white rounded-xl border p-5 transition-all ${
      job.enabled ? 'border-gray-100 hover:shadow-lg' : 'border-gray-100 opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            job.enabled ? 'bg-aifm-gold/10' : 'bg-gray-100'
          }`}>
            <Icon className={`w-5 h-5 ${job.enabled ? 'text-aifm-gold' : 'text-gray-400'}`} />
          </div>
          <div>
            <h3 className="font-medium text-aifm-charcoal">{job.name}</h3>
            <p className="text-xs text-aifm-charcoal/50">{job.schedule}</p>
          </div>
        </div>
        <button className={`relative w-10 h-6 rounded-full transition-colors ${
          job.enabled ? 'bg-aifm-gold' : 'bg-gray-200'
        }`}>
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            job.enabled ? 'right-1' : 'left-1'
          }`} />
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        {job.lastRunStatus && (
          <span className={`flex items-center gap-1 ${
            job.lastRunStatus === 'success' ? 'text-emerald-600' :
            job.lastRunStatus === 'failed' ? 'text-red-600' : 'text-amber-600'
          }`}>
            {job.lastRunStatus === 'success' ? <Check className="w-3.5 h-3.5" /> :
             job.lastRunStatus === 'failed' ? <X className="w-3.5 h-3.5" /> :
             <AlertTriangle className="w-3.5 h-3.5" />}
            Senast {new Date(job.lastRunAt!).toLocaleDateString('sv-SE')}
          </span>
        )}
        {job.enabled && (
          <span className="text-aifm-charcoal/40 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Nästa: {new Date(job.nextRunAt).toLocaleDateString('sv-SE')}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tab Navigation
// ============================================================================

type Tab = 'operations' | 'templates' | 'comments' | 'recurring';

function TabNav({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: typeof Layers }[] = [
    { id: 'operations', label: 'Operationer', icon: Layers },
    { id: 'templates', label: 'Mallar', icon: FileText },
    { id: 'comments', label: 'Kommentarer', icon: FileText },
    { id: 'recurring', label: 'Schemalagda', icon: Calendar },
  ];

  return (
    <div className="bg-gray-100/80 rounded-xl p-1 inline-flex">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-aifm-charcoal shadow-sm'
                : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// New Bulk Operation Modal
// ============================================================================

function NewOperationModal({ onClose }: { onClose: () => void }) {
  const [actionType, setActionType] = useState<BulkActionType>('APPROVE_DOCUMENTS');
  const [name, setName] = useState('');
  const [selectedCount] = useState(0);

  const actionOptions: { type: BulkActionType; label: string; description: string }[] = [
    { type: 'APPROVE_DOCUMENTS', label: 'Godkänn dokument', description: 'Godkänn valda dokument för bokföring' },
    { type: 'REJECT_DOCUMENTS', label: 'Avvisa dokument', description: 'Avvisa och returnera valda dokument' },
    { type: 'SYNC_TO_FORTNOX', label: 'Synka till Fortnox', description: 'Synka valda transaktioner till Fortnox' },
    { type: 'ADD_TAG', label: 'Lägg till tagg', description: 'Lägg till en tagg på valda dokument' },
    { type: 'ASSIGN_USER', label: 'Tilldela användare', description: 'Tilldela en användare till valda dokument' },
    { type: 'ARCHIVE_DOCUMENTS', label: 'Arkivera', description: 'Arkivera valda dokument' },
    { type: 'DELETE_DOCUMENTS', label: 'Ta bort', description: 'Ta bort valda dokument permanent' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-aifm-charcoal">Ny bulk-operation</h2>
            <p className="text-xs text-aifm-charcoal/50 mt-0.5">{selectedCount} objekt valda</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-aifm-charcoal/50" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-2">
              Namn
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Godkänn december-fakturor"
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                         focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-2">
              Åtgärd
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {actionOptions.map((option) => {
                const Icon = actionIcons[option.type];
                return (
                  <button
                    key={option.type}
                    onClick={() => setActionType(option.type)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      actionType === option.type
                        ? 'bg-aifm-gold/10 border-2 border-aifm-gold'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      actionType === option.type ? 'bg-aifm-gold/20' : 'bg-white'
                    }`}>
                      <Icon className={`w-5 h-5 ${actionType === option.type ? 'text-aifm-gold' : 'text-aifm-charcoal/50'}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${actionType === option.type ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-aifm-charcoal/50">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {actionType === 'DELETE_DOCUMENTS' && (
            <div className="p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm font-medium">Varning: Permanent borttagning</p>
              </div>
              <p className="text-xs text-red-600 mt-1">
                Denna åtgärd kan inte ångras. Dokumenten kommer raderas permanent.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-sm font-medium text-aifm-charcoal/70 hover:bg-white rounded-xl transition-colors"
          >
            Avbryt
          </button>
          <button 
            disabled={!name}
            className="flex-1 py-3 bg-aifm-charcoal text-white rounded-xl text-sm font-medium
                       hover:bg-aifm-charcoal/90 transition-all flex items-center justify-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Starta operation
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function BulkOperationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('operations');
  const [showNewModal, setShowNewModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | OperationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOperations = mockOperations.filter(op => {
    if (statusFilter !== 'all' && op.status !== statusFilter) return false;
    if (searchQuery && !op.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: mockOperations.length,
    running: mockOperations.filter(o => o.status === 'RUNNING').length,
    pending: mockOperations.filter(o => o.status === 'PENDING_APPROVAL').length,
    completed: mockOperations.filter(o => o.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Bulk-operationer</h1>
            <p className="text-sm text-aifm-charcoal/50">Massuppdateringar, mallar och schemalagda jobb</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl
                     text-sm font-medium hover:bg-aifm-charcoal/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          Ny operation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Totalt</p>
          <p className="text-2xl font-semibold text-aifm-charcoal mt-1">{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
          <p className="text-xs text-blue-600/70 uppercase tracking-wider">Körs</p>
          <p className="text-2xl font-semibold text-blue-700 mt-1">{stats.running}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
          <p className="text-xs text-amber-600/70 uppercase tracking-wider">Väntar godkännande</p>
          <p className="text-2xl font-semibold text-amber-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5">
          <p className="text-xs text-emerald-600/70 uppercase tracking-wider">Slutförda</p>
          <p className="text-2xl font-semibold text-emerald-700 mt-1">{stats.completed}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Sök operationer..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm
                           focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'RUNNING', 'PENDING_APPROVAL', 'COMPLETED', 'FAILED'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-aifm-charcoal text-white'
                      : 'bg-gray-100 text-aifm-charcoal/60 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'Alla' : 
                   status === 'RUNNING' ? 'Körs' :
                   status === 'PENDING_APPROVAL' ? 'Väntar' :
                   status === 'COMPLETED' ? 'Klara' : 'Misslyckade'}
                </button>
              ))}
            </div>
          </div>

          {/* Operations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOperations.length === 0 ? (
              <div className="col-span-full py-16 text-center">
                <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-aifm-charcoal/50">Inga operationer hittades</p>
              </div>
            ) : (
              filteredOperations.map(op => (
                <OperationCard key={op.id} operation={op} />
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-aifm-charcoal/50">{mockTemplates.length} mallar</p>
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-aifm-gold font-medium hover:bg-aifm-gold/10 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Ny mall
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockTemplates.map(tpl => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-aifm-charcoal/50">{mockComments.length} standardkommentarer</p>
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-aifm-gold font-medium hover:bg-aifm-gold/10 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Ny kommentar
            </button>
          </div>
          <div className="space-y-2">
            {mockComments.map(comment => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
          <div className="p-4 bg-aifm-charcoal/5 rounded-xl">
            <p className="text-xs text-aifm-charcoal/50 mb-2">
              <strong>Tips:</strong> Använd genvägar som <code className="px-1.5 py-0.5 bg-gray-200 rounded text-aifm-charcoal">/ok</code> i kommentarsfält för snabb infogning.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'recurring' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-aifm-charcoal/50">{mockRecurringJobs.length} schemalagda jobb</p>
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-aifm-gold font-medium hover:bg-aifm-gold/10 rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Nytt schemalagt jobb
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mockRecurringJobs.map(job => (
              <RecurringJobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* New Operation Modal */}
      {showNewModal && <NewOperationModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}


