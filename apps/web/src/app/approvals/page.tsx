'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Shield, Check, X, Clock, AlertCircle, FileText,
  DollarSign, Users, CheckCircle2, Filter,
  ArrowRight, RefreshCw, BookOpen
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { CustomSelect } from '@/components/CustomSelect';
import { DashboardLayout } from '@/components/DashboardLayout';

// Types for approval workflow
interface ApprovalItem {
  id: string;
  type: 'DISTRIBUTION' | 'PAYMENT' | 'INVOICE' | 'TRANSFER' | 'CAPITAL_CALL';
  title: string;
  description: string;
  amount: number;
  currency: string;
  fundName: string;
  createdAt: Date;
  createdBy: string;
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'APPROVED' | 'REJECTED';
  firstApproval?: {
    approvedBy: string;
    approvedAt: Date;
    comment?: string;
  };
  secondApproval?: {
    approvedBy: string;
    approvedAt: Date;
    comment?: string;
  };
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: Record<string, string | number>;
}

// Mock approval items
const mockApprovals: ApprovalItem[] = [
  {
    id: 'appr-1',
    type: 'DISTRIBUTION',
    title: 'Vinstutdelning - Q4 2024',
    description: 'Kvartalsvis vinstutdelning till 5 investerare baserat på ägarandelar',
    amount: 15000000,
    currency: 'SEK',
    fundName: 'Nordic Growth Fund I',
    createdAt: new Date('2024-11-25'),
    createdBy: 'Anna Svensson',
    status: 'PENDING_SECOND',
    firstApproval: {
      approvedBy: 'Carl Johansson',
      approvedAt: new Date('2024-11-26'),
      comment: 'Verified calculation matches NAV report',
    },
  },
  {
    id: 'appr-2',
    type: 'PAYMENT',
    title: 'Legal Services Payment',
    description: 'Payment to Advokatfirman Lindahl for Q4 compliance review',
    amount: 185000,
    currency: 'SEK',
    fundName: 'Nordic Growth Fund I',
    createdAt: new Date('2024-11-24'),
    createdBy: 'AI Agent',
    status: 'PENDING_FIRST',
    metadata: {
      vendor: 'Advokatfirman Lindahl',
      invoiceNumber: 'LIN-2024-5678',
    },
  },
  {
    id: 'appr-3',
    type: 'TRANSFER',
    title: 'Inter-fund Transfer',
    description: 'Transfer from operating account to custody account',
    amount: 5000000,
    currency: 'SEK',
    fundName: 'Nordic Growth Fund I',
    createdAt: new Date('2024-11-23'),
    createdBy: 'System',
    status: 'PENDING_FIRST',
    metadata: {
      fromAccount: 'SEB Operating',
      toAccount: 'Swedbank Custody',
    },
  },
  {
    id: 'appr-4',
    type: 'INVOICE',
    title: 'Audit Services Invoice',
    description: 'Annual audit services from KPMG',
    amount: 245000,
    currency: 'SEK',
    fundName: 'Nordic Growth Fund I',
    createdAt: new Date('2024-11-22'),
    createdBy: 'AI Agent',
    status: 'PENDING_SECOND',
    firstApproval: {
      approvedBy: 'Anna Svensson',
      approvedAt: new Date('2024-11-23'),
    },
    metadata: {
      vendor: 'KPMG',
      invoiceNumber: 'KPMG-2024-9012',
      account: '6420 - Revisorsarvoden',
    },
  },
  {
    id: 'appr-5',
    type: 'DISTRIBUTION',
    title: 'Return of Capital',
    description: 'Return of capital from Baltic Real Estate Fund exit',
    amount: 12000000,
    currency: 'EUR',
    fundName: 'Baltic Real Estate Fund',
    createdAt: new Date('2024-11-20'),
    createdBy: 'Eva Larsson',
    status: 'APPROVED',
    firstApproval: {
      approvedBy: 'Carl Johansson',
      approvedAt: new Date('2024-11-21'),
    },
    secondApproval: {
      approvedBy: 'Anna Svensson',
      approvedAt: new Date('2024-11-22'),
    },
  },
  {
    id: 'appr-6',
    type: 'PAYMENT',
    title: 'Suspicious Vendor Payment',
    description: 'Payment request from unverified vendor',
    amount: 500000,
    currency: 'SEK',
    fundName: 'Nordic Growth Fund I',
    createdAt: new Date('2024-11-18'),
    createdBy: 'Unknown',
    status: 'REJECTED',
    rejectedBy: 'Anna Svensson',
    rejectedAt: new Date('2024-11-19'),
    rejectionReason: 'Vendor not in approved vendor list. Requires compliance review.',
  },
];

export default function ApprovalsPage() {
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [comment, setComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const filteredItems = mockApprovals.filter(item => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return item.status.startsWith('PENDING');
    if (filterStatus === 'approved') return item.status === 'APPROVED';
    if (filterStatus === 'rejected') return item.status === 'REJECTED';
    return true;
  });

  const pendingCount = mockApprovals.filter(i => i.status.startsWith('PENDING')).length;

  const getTypeIcon = (type: ApprovalItem['type']) => {
    switch (type) {
      case 'DISTRIBUTION': return <DollarSign className="w-5 h-5" />;
      case 'PAYMENT': return <ArrowRight className="w-5 h-5" />;
      case 'INVOICE': return <FileText className="w-5 h-5" />;
      case 'TRANSFER': return <RefreshCw className="w-5 h-5" />;
      case 'CAPITAL_CALL': return <Users className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: ApprovalItem['status']) => {
    switch (status) {
      case 'PENDING_FIRST': return 'bg-amber-100 text-amber-700';
      case 'PENDING_SECOND': return 'bg-blue-100 text-blue-700';
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: ApprovalItem['status']) => {
    switch (status) {
      case 'PENDING_FIRST': return 'Väntar 1:a';
      case 'PENDING_SECOND': return 'Väntar 2:a';
      case 'APPROVED': return 'Godkänd';
      case 'REJECTED': return 'Avslagen';
      default: return status;
    }
  };

  const handleApprove = () => {
    alert(`Ärende godkänt med kommentar: ${comment || '(ingen kommentar)'}\n\nDetta aktiverar nästa steg i godkännandeflödet.`);
    setShowApproveModal(false);
    setComment('');
    setSelectedItem(null);
  };

  const handleReject = () => {
    alert(`Ärende avslaget. Anledning: ${rejectionReason}\n\nSkaparen kommer att notifieras.`);
    setShowRejectModal(false);
    setRejectionReason('');
    setSelectedItem(null);
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Godkännandecenter</h1>
            <HelpTooltip 
              {...helpContent.approvals}
              learnMoreLink="/guide#approvals"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">4-ögon principen: Alla finansiella åtgärder kräver dubbelt godkännande</p>
            <Link href="/guide#approvals" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <CustomSelect
            options={[
              { value: 'all', label: 'Alla ärenden', icon: <Filter className="w-4 h-4 text-aifm-charcoal/40" /> },
              { value: 'pending', label: `Väntande (${pendingCount})`, icon: <Clock className="w-4 h-4 text-amber-500" /> },
              { value: 'approved', label: 'Godkända', icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
              { value: 'rejected', label: 'Avslagna', icon: <X className="w-4 h-4 text-red-500" /> },
            ]}
            value={filterStatus}
            onChange={(value) => setFilterStatus(value as typeof filterStatus)}
            className="min-w-[200px]"
            variant="minimal"
            size="md"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Väntande</span>
          <p className="text-2xl font-medium text-aifm-charcoal mt-2">{pendingCount}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">1:a godkännande</span>
          <p className="text-2xl font-medium text-aifm-charcoal mt-2">
            {mockApprovals.filter(i => i.status === 'PENDING_FIRST').length}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">2:a godkännande</span>
          <p className="text-2xl font-medium text-aifm-charcoal mt-2">
            {mockApprovals.filter(i => i.status === 'PENDING_SECOND').length}
          </p>
        </div>

        <div className="bg-aifm-charcoal rounded-2xl p-6 text-white">
          <span className="text-xs font-medium uppercase tracking-wider text-white/70">Godkänt idag</span>
          <p className="text-2xl font-medium mt-2">{mockApprovals.filter(i => i.status === 'APPROVED').length}</p>
        </div>
      </div>

      {/* 4-Eyes Notice */}
      <div className="bg-gradient-to-r from-aifm-gold/10 to-aifm-gold/5 border border-aifm-gold/30 rounded-2xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-aifm-gold/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-aifm-gold" />
          </div>
          <div>
            <h3 className="font-medium text-aifm-charcoal mb-1">4-ögon principen</h3>
            <p className="text-sm text-aifm-charcoal/70 mb-3">
              Alla finansiella transaktioner kräver godkännande från två separata behöriga användare innan genomförande.
              Denna dubbla kontrollmekanism säkerställer noggrannhet, förhindrar bedrägeri och upprätthåller regelefterlevnad.
            </p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-aifm-charcoal/60">1:a godkännande: Första granskning och verifiering</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-aifm-charcoal/60">2:a godkännande: Slutligt beslut och genomförande</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Approval Queue */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Ärendekö</h3>
            <span className="text-xs text-aifm-charcoal/50">{filteredItems.length} ärenden</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-aifm-charcoal/60">Inga ärenden matchar filtret</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedItem?.id === item.id ? 'bg-aifm-gold/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                      item.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                      'bg-aifm-gold/10 text-aifm-gold'
                    }`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-aifm-charcoal truncate">{item.title}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                      <p className="text-sm text-aifm-charcoal/60 mb-2 line-clamp-1">{item.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-aifm-charcoal">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                        <span className="text-xs text-aifm-charcoal/50">{item.fundName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Item Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {selectedItem ? (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Detaljer</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedItem.status)}`}>
                    {getStatusLabel(selectedItem.status)}
                  </span>
                </div>
              </div>
              
              <div className="p-6 border-b border-gray-100">
                <h4 className="font-medium text-aifm-charcoal mb-2">{selectedItem.title}</h4>
                <p className="text-sm text-aifm-charcoal/60 mb-4">{selectedItem.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Belopp</p>
                    <p className="font-medium text-aifm-charcoal">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Fond</p>
                    <p className="font-medium text-aifm-charcoal">{selectedItem.fundName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Skapad av</p>
                    <p className="font-medium text-aifm-charcoal">{selectedItem.createdBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Skapad</p>
                    <p className="font-medium text-aifm-charcoal">{formatDate(selectedItem.createdAt)}</p>
                  </div>
                </div>

                {selectedItem.metadata && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Ytterligare detaljer</p>
                    {Object.entries(selectedItem.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm mb-1 last:mb-0">
                        <span className="text-aifm-charcoal/60 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium text-aifm-charcoal">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval Trail */}
              <div className="p-6 border-b border-gray-100">
                <h4 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-4">Godkännandehistorik</h4>
                <div className="space-y-4">
                  {/* First Approval */}
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedItem.firstApproval ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {selectedItem.firstApproval ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className="text-xs font-medium text-gray-400">1</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-aifm-charcoal text-sm">1:a godkännande</p>
                      {selectedItem.firstApproval ? (
                        <>
                          <p className="text-xs text-aifm-charcoal/60">
                            {selectedItem.firstApproval.approvedBy} • {formatDate(selectedItem.firstApproval.approvedAt)}
                          </p>
                          {selectedItem.firstApproval.comment && (
                            <p className="text-xs text-aifm-charcoal/50 mt-1 italic">
                              &ldquo;{selectedItem.firstApproval.comment}&rdquo;
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-amber-600">Väntar</p>
                      )}
                    </div>
                  </div>

                  {/* Second Approval */}
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedItem.secondApproval ? 'bg-green-100' : 
                      selectedItem.firstApproval ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {selectedItem.secondApproval ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <span className={`text-xs font-medium ${selectedItem.firstApproval ? 'text-blue-600' : 'text-gray-400'}`}>2</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-aifm-charcoal text-sm">2:a godkännande</p>
                      {selectedItem.secondApproval ? (
                        <p className="text-xs text-aifm-charcoal/60">
                          {selectedItem.secondApproval.approvedBy} • {formatDate(selectedItem.secondApproval.approvedAt)}
                        </p>
                      ) : selectedItem.firstApproval ? (
                        <p className="text-xs text-blue-600">Väntar på ditt godkännande</p>
                      ) : (
                        <p className="text-xs text-gray-400">Väntar på första godkännande</p>
                      )}
                    </div>
                  </div>

                  {/* Rejection (if applicable) */}
                  {selectedItem.status === 'REJECTED' && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-red-100">
                        <X className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-aifm-charcoal text-sm">Avslaget</p>
                        <p className="text-xs text-aifm-charcoal/60">
                          {selectedItem.rejectedBy} • {selectedItem.rejectedAt && formatDate(selectedItem.rejectedAt)}
                        </p>
                        {selectedItem.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1">
                            {selectedItem.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedItem.status.startsWith('PENDING') && (
                <div className="p-6 bg-gray-50">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 btn-outline py-2 flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                      Avslå
                    </button>
                    <button 
                      onClick={() => setShowApproveModal(true)}
                      className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Godkänn
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <Shield className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
              <p className="text-aifm-charcoal/60">Välj ett ärende för att se detaljer</p>
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Bekräfta godkännande</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal">{selectedItem.title}</p>
                  <p className="text-sm text-aifm-charcoal/60">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Kommentar (valfritt)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input w-full h-24 resize-none"
                  placeholder="Lägg till en kommentar för godkännandehistoriken..."
                />
              </div>

              <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Bekräftelse av godkännande</p>
                  <p className="text-xs text-amber-700">Genom att godkänna bekräftar du att du har granskat ärendet och godkänner åtgärden.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowApproveModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Avbryt
              </button>
              <button 
                onClick={handleApprove}
                className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Bekräfta godkännande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Avslå ärende</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal">{selectedItem.title}</p>
                  <p className="text-sm text-aifm-charcoal/60">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Anledning till avslag <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="input w-full h-24 resize-none"
                  placeholder="Förklara varför ärendet avslås..."
                  required
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Avbryt
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 py-2 flex items-center justify-center gap-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <X className="w-4 h-4" />
                Bekräfta avslag
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
