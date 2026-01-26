'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, Check, X, Clock, AlertCircle, FileText,
  DollarSign, Users, CheckCircle2,
  ArrowRight, RefreshCw, ChevronRight, Eye
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';


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

// Animated Stat Card
function StatCard({ 
  label, 
  value, 
  color = 'default',
  delay = 0 
}: { 
  label: string; 
  value: number;
  color?: 'default' | 'gold' | 'primary';
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible) {
      const duration = 800;
      const start = Date.now();
      const animate = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        setAnimatedValue(Math.floor(progress * value));
        if (progress < 1) requestAnimationFrame(animate);
      };
      animate();
    }
  }, [isVisible, value]);

  const colorClasses = {
    default: 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50',
    gold: 'bg-gradient-to-br from-aifm-gold to-aifm-gold/90 text-white shadow-lg shadow-aifm-gold/20',
    primary: 'bg-aifm-charcoal text-white shadow-lg shadow-aifm-charcoal/20',
  };

  return (
    <>
    <div className={`
      relative group rounded-2xl p-6
      transition-all duration-500 ease-out
      hover:-translate-y-1
      ${colorClasses[color]}
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    `}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
        color === 'default' ? 'text-aifm-charcoal/50' : 'text-white/70'
      }`}>
        {label}
      </p>
      <p className={`text-3xl font-semibold tracking-tight ${
        color === 'default' ? 'text-aifm-charcoal' : 'text-white'
      }`}>
        {animatedValue}
      </p>
    </div>
    </>  );
}

// Tab Filter Button
function TabButton({ 
  label, 
  count, 
  isActive, 
  onClick,
  color
}: { 
  label: string; 
  count?: number; 
  isActive: boolean; 
  onClick: () => void;
  color?: string;
}) {
  return (
    <>
    <button
      onClick={onClick}
      className={`relative px-5 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
        isActive 
          ? 'bg-white text-aifm-charcoal shadow-lg' 
          : 'text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-white/50'
      }`}
    >
      <span className="flex items-center gap-2">
        {color && <div className={`w-2 h-2 rounded-full ${color}`} />}
        {label}
        {count !== undefined && count > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs ${
            isActive ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-200 text-gray-600'
          }`}>
            {count}
          </span>
        )}
      </span>
    </button>
    
    </>  );
}

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
  const pendingFirstCount = mockApprovals.filter(i => i.status === 'PENDING_FIRST').length;
  const pendingSecondCount = mockApprovals.filter(i => i.status === 'PENDING_SECOND').length;
  const approvedCount = mockApprovals.filter(i => i.status === 'APPROVED').length;

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
      case 'PENDING_FIRST': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'PENDING_SECOND': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
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
    <>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/80 
                          flex items-center justify-center shadow-lg shadow-aifm-charcoal/20">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Godkännandecenter</h1>
              <HelpTooltip 
                {...helpContent.approvals}
                learnMoreLink=""
                position="bottom"
                size="md"
              />
            </div>
            <p className="text-sm text-aifm-charcoal/50">Dubbelt godkännande för säkra transaktioner</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Väntande" value={pendingCount} color="gold" delay={0} />
        <StatCard label="1:a godkännande" value={pendingFirstCount} delay={100} />
        <StatCard label="2:a godkännande" value={pendingSecondCount} delay={200} />
        <StatCard label="Godkänt idag" value={approvedCount} color="primary" delay={300} />
      </div>

      {/* 4-Eyes Notice */}
      <div className="bg-white rounded-2xl border border-gray-100/50 p-6 mb-8 
                      hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-aifm-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Eye className="w-6 h-6 text-aifm-gold" />
          </div>
          <div>
            <h3 className="font-semibold text-aifm-charcoal mb-2">4-ögon principen</h3>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Alla finansiella transaktioner kräver godkännande från två separata behöriga användare innan genomförande.
            </p>
            <div className="flex flex-wrap gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded-full" />
                <span className="text-aifm-charcoal/60">1:a godkännande: Första granskning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-aifm-charcoal/60">2:a godkännande: Slutgiltigt beslut</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-aifm-charcoal/60">Godkänt: Genomfört</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-gray-100/80 rounded-2xl p-1.5 inline-flex mb-8">
        <TabButton 
          label="Väntande" 
          count={pendingCount} 
          isActive={filterStatus === 'pending'} 
          onClick={() => setFilterStatus('pending')}
          color="bg-amber-500"
        />
        <TabButton 
          label="Godkända" 
          count={approvedCount}
          isActive={filterStatus === 'approved'} 
          onClick={() => setFilterStatus('approved')}
          color="bg-emerald-500"
        />
        <TabButton 
          label="Avslagna" 
          isActive={filterStatus === 'rejected'} 
          onClick={() => setFilterStatus('rejected')}
          color="bg-red-500"
        />
        <TabButton 
          label="Alla" 
          isActive={filterStatus === 'all'} 
          onClick={() => setFilterStatus('all')}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Approval Queue - 3/5 */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-sm
                        hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Ärendekö</h3>
            <span className="text-xs text-aifm-charcoal/40">{filteredItems.length} ärenden</span>
          </div>
          
          <div className="divide-y divide-gray-50 max-h-[650px] overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-aifm-charcoal/60 font-medium">Inga ärenden matchar filtret</p>
              </div>
            ) : (
              filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-5 cursor-pointer transition-all duration-300 ${
                    selectedItem?.id === item.id 
                      ? 'bg-aifm-gold/5 border-l-4 border-l-aifm-gold' 
                      : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      item.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' :
                      item.status === 'REJECTED' ? 'bg-red-100 text-red-600' :
                      item.status === 'PENDING_SECOND' ? 'bg-blue-100 text-blue-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="font-medium text-aifm-charcoal truncate">{item.title}</p>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap border ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>
                      <p className="text-sm text-aifm-charcoal/50 mb-2 line-clamp-1">{item.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-aifm-charcoal">
                          {formatCurrency(item.amount, item.currency)}
                        </span>
                        <span className="text-xs text-aifm-charcoal/40">{item.fundName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Item Details - 2/5 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-sm
                        hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
          {selectedItem ? (
            <>
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Detaljer</h3>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(selectedItem.status)}`}>
                    {getStatusLabel(selectedItem.status)}
                  </span>
                </div>
              </div>
              
              <div className="p-6 border-b border-gray-100">
                <h4 className="font-semibold text-aifm-charcoal mb-2">{selectedItem.title}</h4>
                <p className="text-sm text-aifm-charcoal/60 mb-6">{selectedItem.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Belopp</p>
                    <p className="font-semibold text-aifm-charcoal">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Fond</p>
                    <p className="font-medium text-aifm-charcoal text-sm">{selectedItem.fundName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Skapad av</p>
                    <p className="font-medium text-aifm-charcoal text-sm">{selectedItem.createdBy}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Datum</p>
                    <p className="font-medium text-aifm-charcoal text-sm">{formatDate(selectedItem.createdAt)}</p>
                  </div>
                </div>

                {selectedItem.metadata && (
                  <div className="bg-aifm-charcoal/5 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-3">Ytterligare detaljer</p>
                    {Object.entries(selectedItem.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm mb-2 last:mb-0">
                        <span className="text-aifm-charcoal/60 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium text-aifm-charcoal">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approval Trail */}
              <div className="p-6 border-b border-gray-100">
                <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-5">Godkännandehistorik</h4>
                <div className="space-y-4">
                  {/* First Approval */}
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedItem.firstApproval ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      {selectedItem.firstApproval ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">1</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-aifm-charcoal">1:a godkännande</p>
                      {selectedItem.firstApproval ? (
                        <>
                          <p className="text-sm text-aifm-charcoal/60 mt-0.5">
                            {selectedItem.firstApproval.approvedBy} • {formatDate(selectedItem.firstApproval.approvedAt)}
                          </p>
                          {selectedItem.firstApproval.comment && (
                            <p className="text-xs text-aifm-charcoal/40 mt-1 italic bg-gray-50 px-3 py-2 rounded-lg">
                              &ldquo;{selectedItem.firstApproval.comment}&rdquo;
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-amber-600 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Väntar
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="ml-5 h-6 border-l-2 border-dashed border-gray-200" />

                  {/* Second Approval */}
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      selectedItem.secondApproval ? 'bg-emerald-100' : 
                      selectedItem.firstApproval ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {selectedItem.secondApproval ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <span className={`text-sm font-bold ${selectedItem.firstApproval ? 'text-blue-600' : 'text-gray-400'}`}>2</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-aifm-charcoal">2:a godkännande</p>
                      {selectedItem.secondApproval ? (
                        <p className="text-sm text-aifm-charcoal/60 mt-0.5">
                          {selectedItem.secondApproval.approvedBy} • {formatDate(selectedItem.secondApproval.approvedAt)}
                        </p>
                      ) : selectedItem.firstApproval ? (
                        <p className="text-sm text-blue-600 flex items-center gap-1 mt-0.5">
                          <ChevronRight className="w-3 h-3" />
                          Väntar på ditt godkännande
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-0.5">Väntar på första godkännande</p>
                      )}
                    </div>
                  </div>

                  {/* Rejection */}
                  {selectedItem.status === 'REJECTED' && (
                    <>
                      <div className="ml-5 h-6 border-l-2 border-dashed border-gray-200" />
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-100">
                          <X className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal">Avslaget</p>
                          <p className="text-sm text-aifm-charcoal/60 mt-0.5">
                            {selectedItem.rejectedBy} • {selectedItem.rejectedAt && formatDate(selectedItem.rejectedAt)}
                          </p>
                          {selectedItem.rejectionReason && (
                            <p className="text-sm text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">
                              {selectedItem.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedItem.status.startsWith('PENDING') && (
                <div className="p-6 bg-gray-50">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 py-3 px-4 flex items-center justify-center gap-2 
                                 text-red-600 bg-white border border-red-200 rounded-xl
                                 hover:bg-red-50 transition-colors font-medium"
                    >
                      <X className="w-4 h-4" />
                      Avslå
                    </button>
                    <button 
                      onClick={() => setShowApproveModal(true)}
                      className="flex-1 py-3 px-4 flex items-center justify-center gap-2 
                                 text-white bg-aifm-charcoal rounded-xl
                                 hover:bg-aifm-charcoal/90 transition-colors font-medium
                                 shadow-lg shadow-aifm-charcoal/20"
                    >
                      <Check className="w-4 h-4" />
                      Godkänn
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-aifm-charcoal/60 font-medium">Välj ett ärende för att se detaljer</p>
              <p className="text-sm text-aifm-charcoal/40 mt-2">Klicka på ett ärende i listan till vänster</p>
            </div>
          )}
        </div>
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Bekräfta godkännande</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 p-4 bg-emerald-50 rounded-xl">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal">{selectedItem.title}</p>
                  <p className="text-sm text-aifm-charcoal/60">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Kommentar (valfritt)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full h-24 resize-none rounded-xl border border-gray-200 px-4 py-3
                             focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold
                             text-aifm-charcoal placeholder:text-aifm-charcoal/40"
                  placeholder="Lägg till en kommentar..."
                />
              </div>

              <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Genom att godkänna bekräftar du att du har granskat ärendet.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button 
                onClick={() => setShowApproveModal(false)}
                className="flex-1 py-3 px-4 text-aifm-charcoal/70 bg-white border border-gray-200 
                           rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Avbryt
              </button>
              <button 
                onClick={handleApprove}
                className="flex-1 py-3 px-4 text-white bg-aifm-charcoal rounded-xl
                           hover:bg-aifm-charcoal/90 transition-colors font-medium
                           flex items-center justify-center gap-2 shadow-lg shadow-aifm-charcoal/20"
              >
                <Check className="w-4 h-4" />
                Bekräfta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Avslå ärende</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6 p-4 bg-red-50 rounded-xl">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal">{selectedItem.title}</p>
                  <p className="text-sm text-aifm-charcoal/60">{formatCurrency(selectedItem.amount, selectedItem.currency)}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Anledning till avslag <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full h-24 resize-none rounded-xl border border-gray-200 px-4 py-3
                             focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400
                             text-aifm-charcoal placeholder:text-aifm-charcoal/40"
                  placeholder="Förklara varför ärendet avslås..."
                  required
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 px-4 text-aifm-charcoal/70 bg-white border border-gray-200 
                           rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Avbryt
              </button>
              <button 
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 py-3 px-4 text-white bg-red-600 rounded-xl
                           hover:bg-red-700 transition-colors font-medium
                           flex items-center justify-center gap-2 
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
                Bekräfta avslag
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
