'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, Search, Plus, Filter, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, XCircle, RefreshCw, FileText, User,
  Building2, Calendar, ArrowUpDown, MoreHorizontal, Eye,
  Download, Trash2, Edit
} from 'lucide-react';
import { KycRecord, KycStatus, CrmCompany } from '@/lib/crm/types';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_KYC_RECORDS: KycRecord[] = [
  {
    id: 'kyc-1',
    companyId: 'aifm-1',
    crmCompanyId: 'crm-1',
    status: 'approved',
    riskLevel: 'low',
    checklist: [
      { id: 'c1', name: 'Verklig huvudman identifierad', required: true, completed: true, completedAt: '2025-10-15' },
      { id: 'c2', name: 'ID-verifiering', required: true, completed: true, completedAt: '2025-10-15' },
      { id: 'c3', name: 'Adressverifiering', required: true, completed: true, completedAt: '2025-10-16' },
      { id: 'c4', name: 'PEP-kontroll', required: true, completed: true, completedAt: '2025-10-16' },
      { id: 'c5', name: 'Sanktionslistekontroll', required: true, completed: true, completedAt: '2025-10-16' },
    ],
    startedAt: '2025-10-15',
    completedAt: '2025-10-18',
    approvedAt: '2025-10-18',
    approvedBy: 'admin-1',
    expiresAt: '2026-10-18',
    nextReviewAt: '2026-04-18',
    createdAt: '2025-10-15',
    createdBy: 'admin-1',
    updatedAt: '2025-10-18',
    updatedBy: 'admin-1',
  },
  {
    id: 'kyc-2',
    companyId: 'aifm-1',
    crmCompanyId: 'crm-2',
    status: 'in_progress',
    riskLevel: 'medium',
    checklist: [
      { id: 'c1', name: 'Verklig huvudman identifierad', required: true, completed: true, completedAt: '2025-12-20' },
      { id: 'c2', name: 'ID-verifiering', required: true, completed: true, completedAt: '2025-12-21' },
      { id: 'c3', name: 'Adressverifiering', required: true, completed: false },
      { id: 'c4', name: 'PEP-kontroll', required: true, completed: false },
      { id: 'c5', name: 'Sanktionslistekontroll', required: true, completed: false },
    ],
    startedAt: '2025-12-20',
    createdAt: '2025-12-20',
    createdBy: 'admin-1',
    updatedAt: '2025-12-21',
    updatedBy: 'admin-1',
  },
  {
    id: 'kyc-3',
    companyId: 'aifm-1',
    crmCompanyId: 'crm-3',
    status: 'pending_review',
    riskLevel: 'high',
    checklist: [
      { id: 'c1', name: 'Verklig huvudman identifierad', required: true, completed: true, completedAt: '2025-11-10' },
      { id: 'c2', name: 'ID-verifiering', required: true, completed: true, completedAt: '2025-11-10' },
      { id: 'c3', name: 'Adressverifiering', required: true, completed: true, completedAt: '2025-11-11' },
      { id: 'c4', name: 'PEP-kontroll', required: true, completed: true, completedAt: '2025-11-12' },
      { id: 'c5', name: 'Sanktionslistekontroll', required: true, completed: true, completedAt: '2025-11-12' },
      { id: 'c6', name: 'Förstärkt kundkännedom (EDD)', required: true, completed: true, completedAt: '2025-11-15' },
    ],
    startedAt: '2025-11-10',
    completedAt: '2025-11-15',
    createdAt: '2025-11-10',
    createdBy: 'admin-1',
    updatedAt: '2025-11-15',
    updatedBy: 'admin-1',
    notes: 'Hög risk pga politiskt exponerad person i styrelsen.',
  },
  {
    id: 'kyc-4',
    companyId: 'aifm-1',
    crmCompanyId: 'crm-4',
    status: 'expired',
    riskLevel: 'low',
    checklist: [
      { id: 'c1', name: 'Verklig huvudman identifierad', required: true, completed: true },
      { id: 'c2', name: 'ID-verifiering', required: true, completed: true },
      { id: 'c3', name: 'Adressverifiering', required: true, completed: true },
      { id: 'c4', name: 'PEP-kontroll', required: true, completed: true },
      { id: 'c5', name: 'Sanktionslistekontroll', required: true, completed: true },
    ],
    startedAt: '2024-01-10',
    completedAt: '2024-01-15',
    approvedAt: '2024-01-15',
    expiresAt: '2025-01-15',
    createdAt: '2024-01-10',
    createdBy: 'admin-1',
    updatedAt: '2024-01-15',
    updatedBy: 'admin-1',
  },
];

const MOCK_CRM_COMPANIES: Record<string, { name: string; orgNumber?: string }> = {
  'crm-1': { name: 'Nordic Investment AB', orgNumber: '556789-1234' },
  'crm-2': { name: 'Tech Solutions Group', orgNumber: '556234-5678' },
  'crm-3': { name: 'Global Capital Partners', orgNumber: '556345-6789' },
  'crm-4': { name: 'Scandinavian Holdings', orgNumber: '556456-7890' },
};

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: KycStatus }) {
  const config: Record<KycStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    not_started: { label: 'Ej påbörjad', color: 'bg-gray-100 text-gray-700', icon: Clock },
    in_progress: { label: 'Pågår', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
    pending_review: { label: 'Väntar granskning', color: 'bg-amber-100 text-amber-700', icon: Eye },
    approved: { label: 'Godkänd', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    rejected: { label: 'Avvisad', color: 'bg-red-100 text-red-700', icon: XCircle },
    expired: { label: 'Utgången', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const config = {
    low: { label: 'Låg risk', color: 'bg-green-100 text-green-700' },
    medium: { label: 'Medel risk', color: 'bg-amber-100 text-amber-700' },
    high: { label: 'Hög risk', color: 'bg-red-100 text-red-700' },
  };

  const { label, color } = config[level];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

// ============================================================================
// KYC Detail Modal
// ============================================================================

interface KycDetailModalProps {
  record: KycRecord;
  companyName: string;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

function KycDetailModal({ record, companyName, onClose, onApprove, onReject }: KycDetailModalProps) {
  const completedCount = record.checklist.filter(c => c.completed).length;
  const totalCount = record.checklist.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{companyName}</h2>
              <p className="text-sm text-gray-500">KYC-granskning</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={record.status} />
              <RiskBadge level={record.riskLevel} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Framsteg</span>
              <span className="text-sm text-gray-500">{completedCount} av {totalCount} krav</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#c0a280] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Checklista</h3>
            <div className="space-y-2">
              {record.checklist.map((item) => (
                <div 
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.completed 
                      ? 'bg-green-50 border-green-100' 
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    item.completed ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {item.completed ? (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    ) : (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      item.completed ? 'text-green-900' : 'text-gray-700'
                    }`}>
                      {item.name}
                      {item.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {item.completedAt && (
                      <p className="text-xs text-gray-500">Slutförd {item.completedAt}</p>
                    )}
                  </div>
                  {item.documentId && (
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Påbörjad</p>
              <p className="text-sm font-medium text-gray-900">{record.startedAt || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Slutförd</p>
              <p className="text-sm font-medium text-gray-900">{record.completedAt || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Godkänd</p>
              <p className="text-sm font-medium text-gray-900">{record.approvedAt || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Utgår</p>
              <p className={`text-sm font-medium ${
                record.status === 'expired' ? 'text-red-600' : 'text-gray-900'
              }`}>
                {record.expiresAt || '-'}
              </p>
            </div>
          </div>

          {/* Notes */}
          {record.notes && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
              <h4 className="text-sm font-medium text-amber-800 mb-1">Anteckningar</h4>
              <p className="text-sm text-amber-700">{record.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Stäng
          </button>
          
          {record.status === 'pending_review' && (
            <div className="flex items-center gap-2">
              <button
                onClick={onReject}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Avvisa
              </button>
              <button
                onClick={onApprove}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                Godkänn KYC
              </button>
            </div>
          )}

          {record.status === 'expired' && (
            <button className="px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] hover:bg-[#3d3a36] rounded-lg transition-colors">
              Förnya KYC
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// New KYC Modal
// ============================================================================

interface NewKycModalProps {
  onClose: () => void;
  onSave: (data: Partial<KycRecord>) => void;
}

const DEFAULT_CHECKLIST = [
  { id: 'c1', name: 'Verklig huvudman identifierad', required: true, completed: false },
  { id: 'c2', name: 'ID-verifiering', required: true, completed: false },
  { id: 'c3', name: 'Adressverifiering', required: true, completed: false },
  { id: 'c4', name: 'PEP-kontroll (Politiskt exponerad person)', required: true, completed: false },
  { id: 'c5', name: 'Sanktionslistekontroll', required: true, completed: false },
  { id: 'c6', name: 'Verksamhetsbeskrivning', required: false, completed: false },
  { id: 'c7', name: 'Kapitalets ursprung verifierat', required: false, completed: false },
];

function NewKycModal({ onClose, onSave }: NewKycModalProps) {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [showEdd, setShowEdd] = useState(false);

  const handleSave = () => {
    if (!selectedCompany) return;
    
    const newRecord: Partial<KycRecord> = {
      crmCompanyId: selectedCompany,
      status: 'in_progress',
      riskLevel,
      checklist: showEdd 
        ? [...checklist, { id: 'edd', name: 'Förstärkt kundkännedom (EDD)', required: true, completed: false }]
        : checklist,
      startedAt: new Date().toISOString().split('T')[0],
    };
    
    onSave(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Ny KYC-granskning</h2>
          <p className="text-sm text-gray-500">Starta en ny kundkännedomskontroll</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Company Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Välj företag <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280] focus:ring-1 focus:ring-[#c0a280]/20"
            >
              <option value="">Välj företag...</option>
              {Object.entries(MOCK_CRM_COMPANIES).map(([id, company]) => (
                <option key={id} value={id}>
                  {company.name} ({company.orgNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Initial riskbedömning
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setRiskLevel(level);
                    setShowEdd(level === 'high');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    riskLevel === level
                      ? level === 'low'
                        ? 'bg-green-100 border-green-200 text-green-700'
                        : level === 'medium'
                        ? 'bg-amber-100 border-amber-200 text-amber-700'
                        : 'bg-red-100 border-red-200 text-red-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {level === 'low' ? 'Låg' : level === 'medium' ? 'Medel' : 'Hög'}
                </button>
              ))}
            </div>
          </div>

          {/* EDD Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Förstärkt kundkännedom (EDD)</p>
              <p className="text-xs text-gray-500">Krävs för högriskklassade kunder</p>
            </div>
            <button
              onClick={() => setShowEdd(!showEdd)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                showEdd ? 'bg-[#c0a280]' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  showEdd ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* Checklist Preview */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Inkluderade kontroller</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                  {item.name}
                  {item.required && <span className="text-red-500">*</span>}
                </div>
              ))}
              {showEdd && (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  Förstärkt kundkännedom (EDD)
                  <span className="text-red-500">*</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedCompany}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] hover:bg-[#3d3a36] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Starta KYC
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function KycPage() {
  const [records, setRecords] = useState<KycRecord[]>(MOCK_KYC_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<KycStatus | 'all'>('all');
  const [selectedRecord, setSelectedRecord] = useState<KycRecord | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Filter records
  const filteredRecords = records.filter((record) => {
    const companyName = MOCK_CRM_COMPANIES[record.crmCompanyId]?.name || '';
    const matchesSearch = companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: records.length,
    approved: records.filter(r => r.status === 'approved').length,
    inProgress: records.filter(r => r.status === 'in_progress').length,
    pendingReview: records.filter(r => r.status === 'pending_review').length,
    expired: records.filter(r => r.status === 'expired').length,
  };

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC-hantering</h1>
          <p className="text-gray-500 mt-1">Kundkännedom och regelefterlevnad</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2d2a26] text-white rounded-lg hover:bg-[#3d3a36] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ny KYC-kontroll
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Totalt</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">Godkända</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <RefreshCw className="w-4 h-4" />
            <span className="text-xs font-medium">Pågår</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Eye className="w-4 h-4" />
            <span className="text-xs font-medium">Väntar granskning</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.pendingReview}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">Utgångna</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök företag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280] focus:ring-1 focus:ring-[#c0a280]/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as KycStatus | 'all')}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280] bg-white"
          >
            <option value="all">Alla statusar</option>
            <option value="not_started">Ej påbörjad</option>
            <option value="in_progress">Pågår</option>
            <option value="pending_review">Väntar granskning</option>
            <option value="approved">Godkänd</option>
            <option value="rejected">Avvisad</option>
            <option value="expired">Utgången</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Företag
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Risknivå
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Framsteg
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Utgår
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.map((record) => {
                const company = MOCK_CRM_COMPANIES[record.crmCompanyId];
                const completedCount = record.checklist.filter(c => c.completed).length;
                const totalCount = record.checklist.length;
                const progress = Math.round((completedCount / totalCount) * 100);

                return (
                  <tr 
                    key={record.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{company?.name}</p>
                          <p className="text-sm text-gray-500">{company?.orgNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-4">
                      <RiskBadge level={record.riskLevel} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div 
                            className="h-full bg-[#c0a280] rounded-full"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-500">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${
                        record.status === 'expired' ? 'text-red-600 font-medium' : 'text-gray-500'
                      }`}>
                        {record.expiresAt || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRecord(record);
                        }}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRecords.length === 0 && (
          <div className="py-12 text-center">
            <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">Inga KYC-granskningar hittades</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedRecord && (
        <KycDetailModal
          record={selectedRecord}
          companyName={MOCK_CRM_COMPANIES[selectedRecord.crmCompanyId]?.name || ''}
          onClose={() => setSelectedRecord(null)}
          onApprove={() => {
            setRecords(prev => prev.map(r => 
              r.id === selectedRecord.id 
                ? { ...r, status: 'approved', approvedAt: new Date().toISOString().split('T')[0] }
                : r
            ));
            setSelectedRecord(null);
          }}
          onReject={() => {
            setRecords(prev => prev.map(r => 
              r.id === selectedRecord.id 
                ? { ...r, status: 'rejected' }
                : r
            ));
            setSelectedRecord(null);
          }}
        />
      )}

      {showNewModal && (
        <NewKycModal
          onClose={() => setShowNewModal(false)}
          onSave={(data) => {
            const newRecord: KycRecord = {
              id: `kyc-${Date.now()}`,
              companyId: 'aifm-1',
              crmCompanyId: data.crmCompanyId!,
              status: 'in_progress',
              riskLevel: data.riskLevel!,
              checklist: data.checklist!,
              startedAt: data.startedAt,
              createdAt: new Date().toISOString(),
              createdBy: 'current-user',
              updatedAt: new Date().toISOString(),
              updatedBy: 'current-user',
            };
            setRecords(prev => [newRecord, ...prev]);
          }}
        />
      )}
    </div>
  );
}



