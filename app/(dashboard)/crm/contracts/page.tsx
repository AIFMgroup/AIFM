'use client';

import { useState } from 'react';
import { 
  FileText, Search, Plus, Filter, ChevronRight, Clock,
  CheckCircle2, AlertTriangle, XCircle, Send, Download,
  Eye, Edit, Trash2, Building2, Calendar, PenTool,
  RefreshCw, MoreHorizontal, ExternalLink, Copy
} from 'lucide-react';
import { Contract, ContractStatus, ContractType } from '@/lib/crm/types';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'contract-1',
    companyId: 'aifm-1',
    dataroomId: 'dr-1',
    name: 'Förvaltningsavtal 2025',
    contractNumber: 'AVT-2025-001',
    type: 'service',
    description: 'Löpande förvaltning av investeringsportfölj',
    crmCompanyId: 'crm-1',
    crmCompanyName: 'Nordic Investment AB',
    status: 'active',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    signedAt: '2024-12-15',
    value: 240000,
    currency: 'SEK',
    billingFrequency: 'monthly',
    autoRenewal: true,
    renewalReminderDays: 60,
    renewalDate: '2025-11-01',
    signatories: [
      { name: 'Anna Svensson', email: 'anna@nordic.se', role: 'VD', signedAt: '2024-12-14' },
      { name: 'Erik Lindberg', email: 'erik@aifm.se', role: 'Partner', signedAt: '2024-12-15' },
    ],
    version: 1,
    createdAt: '2024-12-01',
    createdBy: 'admin-1',
    updatedAt: '2024-12-15',
    updatedBy: 'admin-1',
  },
  {
    id: 'contract-2',
    companyId: 'aifm-1',
    dataroomId: 'dr-1',
    name: 'NDA - Tech Solutions',
    contractNumber: 'NDA-2025-012',
    type: 'nda',
    crmCompanyId: 'crm-2',
    crmCompanyName: 'Tech Solutions Group',
    status: 'sent',
    value: 0,
    currency: 'SEK',
    signatories: [
      { name: 'Johan Eriksson', email: 'johan@techsolutions.se', role: 'CEO' },
      { name: 'Maria Holm', email: 'maria@aifm.se', role: 'Legal' },
    ],
    version: 1,
    createdAt: '2025-01-05',
    createdBy: 'admin-1',
    updatedAt: '2025-01-05',
    updatedBy: 'admin-1',
  },
  {
    id: 'contract-3',
    companyId: 'aifm-1',
    dataroomId: 'dr-1',
    name: 'Licensavtal Enterprise',
    contractNumber: 'LIC-2024-089',
    type: 'license',
    description: 'Enterprise-licens för analysverktyg',
    crmCompanyId: 'crm-3',
    crmCompanyName: 'Global Capital Partners',
    dealId: 'deal-1',
    dealName: 'Enterprise License',
    status: 'negotiating',
    value: 500000,
    currency: 'SEK',
    billingFrequency: 'yearly',
    signatories: [
      { name: 'Lars Pettersson', email: 'lars@globalcapital.com', role: 'CFO' },
    ],
    version: 2,
    createdAt: '2024-11-20',
    createdBy: 'admin-1',
    updatedAt: '2025-01-02',
    updatedBy: 'admin-1',
  },
  {
    id: 'contract-4',
    companyId: 'aifm-1',
    dataroomId: 'dr-1',
    name: 'Partnerskap Q1 2025',
    contractNumber: 'PART-2024-003',
    type: 'partnership',
    crmCompanyId: 'crm-4',
    crmCompanyName: 'Scandinavian Holdings',
    status: 'draft',
    value: 1500000,
    currency: 'SEK',
    billingFrequency: 'quarterly',
    version: 1,
    createdAt: '2025-01-06',
    createdBy: 'admin-1',
    updatedAt: '2025-01-06',
    updatedBy: 'admin-1',
  },
  {
    id: 'contract-5',
    companyId: 'aifm-1',
    dataroomId: 'dr-1',
    name: 'Rådgivningsavtal 2024',
    contractNumber: 'AVT-2024-045',
    type: 'service',
    crmCompanyId: 'crm-1',
    crmCompanyName: 'Nordic Investment AB',
    status: 'expired',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    signedAt: '2023-12-20',
    value: 180000,
    currency: 'SEK',
    billingFrequency: 'monthly',
    version: 1,
    createdAt: '2023-12-15',
    createdBy: 'admin-1',
    updatedAt: '2024-12-31',
    updatedBy: 'system',
  },
];

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: ContractStatus }) {
  const config: Record<ContractStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    draft: { label: 'Utkast', color: 'bg-gray-100 text-gray-700', icon: Edit },
    sent: { label: 'Skickad', color: 'bg-blue-100 text-blue-700', icon: Send },
    negotiating: { label: 'Förhandling', color: 'bg-purple-100 text-purple-700', icon: RefreshCw },
    signed: { label: 'Signerat', color: 'bg-green-100 text-green-700', icon: PenTool },
    active: { label: 'Aktivt', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    expired: { label: 'Utgånget', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    terminated: { label: 'Avslutat', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: ContractType }) {
  const labels: Record<ContractType, string> = {
    service: 'Tjänst',
    license: 'Licens',
    subscription: 'Prenumeration',
    nda: 'NDA',
    partnership: 'Partnerskap',
    other: 'Övrigt',
  };

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
      {labels[type]}
    </span>
  );
}

// ============================================================================
// Scrive Sign Modal
// ============================================================================

interface ScriveSignModalProps {
  contract: Contract;
  onClose: () => void;
  onSend: () => void;
}

function ScriveSignModal({ contract, onClose, onSend }: ScriveSignModalProps) {
  const [signatories, setSignatories] = useState(contract.signatories || []);
  const [newSignatory, setNewSignatory] = useState({ name: '', email: '', role: '' });
  const [message, setMessage] = useState('');
  const [sendReminders, setSendReminders] = useState(true);

  const addSignatory = () => {
    if (newSignatory.name && newSignatory.email) {
      setSignatories([...signatories, newSignatory]);
      setNewSignatory({ name: '', email: '', role: '' });
    }
  };

  const removeSignatory = (index: number) => {
    setSignatories(signatories.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1a5f7a] rounded-xl flex items-center justify-center">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Skicka för e-signering</h2>
              <p className="text-sm text-gray-500">via Scrive</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Document Info */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{contract.name}</p>
                <p className="text-sm text-gray-500">{contract.contractNumber}</p>
              </div>
            </div>
          </div>

          {/* Signatories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Signatärer
            </label>
            <div className="space-y-2 mb-3">
              {signatories.map((sig, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-8 h-8 bg-[#c0a280]/20 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-[#c0a280]">
                      {sig.name.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{sig.name}</p>
                    <p className="text-xs text-gray-500 truncate">{sig.email}</p>
                  </div>
                  {sig.role && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {sig.role}
                    </span>
                  )}
                  {sig.signedAt ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <button
                      onClick={() => removeSignatory(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Signatory */}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Namn"
                value={newSignatory.name}
                onChange={(e) => setNewSignatory({ ...newSignatory, name: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              />
              <input
                type="email"
                placeholder="E-post"
                value={newSignatory.email}
                onChange={(e) => setNewSignatory({ ...newSignatory, email: e.target.value })}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              />
              <button
                onClick={addSignatory}
                disabled={!newSignatory.name || !newSignatory.email}
                className="px-3 py-2 text-sm font-medium text-[#c0a280] border border-[#c0a280] rounded-lg hover:bg-[#c0a280]/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lägg till
              </button>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meddelande till signatärer (valfritt)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Skriv ett personligt meddelande..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280] resize-none"
            />
          </div>

          {/* Options */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Automatiska påminnelser</p>
              <p className="text-xs text-gray-500">Skicka påminnelser var 3:e dag</p>
            </div>
            <button
              onClick={() => setSendReminders(!sendReminders)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                sendReminders ? 'bg-[#c0a280]' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  sendReminders ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Avbryt
          </button>
          <button
            onClick={onSend}
            disabled={signatories.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1a5f7a] hover:bg-[#134b5e] rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Skicka via Scrive
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// New Contract Modal
// ============================================================================

interface NewContractModalProps {
  onClose: () => void;
  onSave: (data: Partial<Contract>) => void;
}

function NewContractModal({ onClose, onSave }: NewContractModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'service' as ContractType,
    crmCompanyId: '',
    value: '',
    currency: 'SEK',
    billingFrequency: 'monthly' as Contract['billingFrequency'],
    startDate: '',
    endDate: '',
    autoRenewal: false,
  });

  const handleSave = () => {
    if (!formData.name) return;
    
    const newContract: Partial<Contract> = {
      name: formData.name,
      type: formData.type,
      crmCompanyId: formData.crmCompanyId || undefined,
      value: formData.value ? parseFloat(formData.value) : undefined,
      currency: formData.currency,
      billingFrequency: formData.billingFrequency,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      autoRenewal: formData.autoRenewal,
      status: 'draft',
    };
    
    onSave(newContract);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nytt avtal</h2>
          <p className="text-sm text-gray-500">Skapa ett nytt avtal eller kontrakt</p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Avtalsnamn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="T.ex. Förvaltningsavtal 2025"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avtalstyp
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ContractType })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              >
                <option value="service">Tjänsteavtal</option>
                <option value="license">Licensavtal</option>
                <option value="subscription">Prenumeration</option>
                <option value="nda">NDA</option>
                <option value="partnership">Partnerskap</option>
                <option value="other">Övrigt</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kopplat företag
              </label>
              <select
                value={formData.crmCompanyId}
                onChange={(e) => setFormData({ ...formData, crmCompanyId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              >
                <option value="">Välj företag...</option>
                <option value="crm-1">Nordic Investment AB</option>
                <option value="crm-2">Tech Solutions Group</option>
                <option value="crm-3">Global Capital Partners</option>
                <option value="crm-4">Scandinavian Holdings</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Värde
              </label>
              <div className="flex">
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-r-0 border-gray-200 rounded-l-lg focus:outline-none focus:border-[#c0a280]"
                />
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-r-lg focus:outline-none focus:border-[#c0a280] bg-gray-50"
                >
                  <option value="SEK">SEK</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faktureringsfrekvens
              </label>
              <select
                value={formData.billingFrequency}
                onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value as Contract['billingFrequency'] })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              >
                <option value="monthly">Månadsvis</option>
                <option value="quarterly">Kvartalsvis</option>
                <option value="yearly">Årsvis</option>
                <option value="one_time">Engångs</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Startdatum
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slutdatum
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Automatisk förnyelse</p>
              <p className="text-xs text-gray-500">Förnya automatiskt vid utgång</p>
            </div>
            <button
              onClick={() => setFormData({ ...formData, autoRenewal: !formData.autoRenewal })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                formData.autoRenewal ? 'bg-[#c0a280]' : 'bg-gray-300'
              }`}
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  formData.autoRenewal ? 'translate-x-5' : ''
                }`}
              />
            </button>
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
            disabled={!formData.name}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2d2a26] hover:bg-[#3d3a36] rounded-lg transition-colors disabled:opacity-50"
          >
            Skapa avtal
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>(MOCK_CONTRACTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedForSigning, setSelectedForSigning] = useState<Contract | null>(null);

  // Filter contracts
  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch = 
      contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.crmCompanyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    pending: contracts.filter(c => ['draft', 'sent', 'negotiating'].includes(c.status)).length,
    totalValue: contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.value || 0), 0),
    expiringSoon: contracts.filter(c => {
      if (!c.endDate || c.status !== 'active') return false;
      const daysUntilExpiry = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 60 && daysUntilExpiry > 0;
    }).length,
  };

  const formatCurrency = (value: number, currency: string = 'SEK') => {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency }).format(value);
  };

  return (
    <div className="p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avtal & Kontrakt</h1>
          <p className="text-gray-500 mt-1">Hantera avtal med e-signering via Scrive</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2d2a26] text-white rounded-lg hover:bg-[#3d3a36] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nytt avtal
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Totalt</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-medium">Aktiva</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">Utgår snart</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-[#c0a280] mb-1">
            <span className="text-xs font-medium">Aktivt värde</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök avtal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ContractStatus | 'all')}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#c0a280] bg-white"
          >
            <option value="all">Alla statusar</option>
            <option value="draft">Utkast</option>
            <option value="sent">Skickad</option>
            <option value="negotiating">Förhandling</option>
            <option value="signed">Signerat</option>
            <option value="active">Aktivt</option>
            <option value="expired">Utgånget</option>
            <option value="terminated">Avslutat</option>
          </select>
        </div>
      </div>

      {/* Contracts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredContracts.map((contract) => (
          <div 
            key={contract.id}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{contract.name}</h3>
                  <p className="text-xs text-gray-500">{contract.contractNumber}</p>
                </div>
              </div>
              <StatusBadge status={contract.status} />
            </div>

            {contract.crmCompanyName && (
              <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                <Building2 className="w-4 h-4" />
                {contract.crmCompanyName}
              </div>
            )}

            <div className="flex items-center gap-3 mb-3">
              <TypeBadge type={contract.type} />
              {contract.value !== undefined && contract.value > 0 && (
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(contract.value, contract.currency)}
                </span>
              )}
            </div>

            {/* Dates */}
            {(contract.startDate || contract.endDate) && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Calendar className="w-3.5 h-3.5" />
                {contract.startDate} - {contract.endDate || 'Löpande'}
              </div>
            )}

            {/* Signatories Progress */}
            {contract.signatories && contract.signatories.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Signaturer</span>
                  <span>
                    {contract.signatories.filter(s => s.signedAt).length}/{contract.signatories.length}
                  </span>
                </div>
                <div className="flex gap-1">
                  {contract.signatories.map((sig, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full ${
                        sig.signedAt ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                <Eye className="w-3.5 h-3.5" />
                Visa
              </button>
              {['draft', 'negotiating'].includes(contract.status) && (
                <button 
                  onClick={() => setSelectedForSigning(contract)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#1a5f7a] hover:bg-[#134b5e] rounded-lg transition-colors"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Signera
                </button>
              )}
              {contract.status === 'sent' && (
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Påminn
                </button>
              )}
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredContracts.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">Inga avtal hittades</p>
        </div>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewContractModal
          onClose={() => setShowNewModal(false)}
          onSave={(data) => {
            const newContract: Contract = {
              id: `contract-${Date.now()}`,
              companyId: 'aifm-1',
              dataroomId: 'dr-1',
              name: data.name!,
              contractNumber: `AVT-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`,
              type: data.type!,
              crmCompanyId: data.crmCompanyId,
              status: 'draft',
              value: data.value,
              currency: data.currency,
              billingFrequency: data.billingFrequency,
              startDate: data.startDate,
              endDate: data.endDate,
              autoRenewal: data.autoRenewal,
              version: 1,
              createdAt: new Date().toISOString(),
              createdBy: 'current-user',
              updatedAt: new Date().toISOString(),
              updatedBy: 'current-user',
            };
            setContracts([newContract, ...contracts]);
          }}
        />
      )}

      {selectedForSigning && (
        <ScriveSignModal
          contract={selectedForSigning}
          onClose={() => setSelectedForSigning(null)}
          onSend={() => {
            setContracts(prev => prev.map(c => 
              c.id === selectedForSigning.id 
                ? { ...c, status: 'sent' }
                : c
            ));
            setSelectedForSigning(null);
          }}
        />
      )}
    </div>
  );
}



