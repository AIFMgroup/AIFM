'use client';


import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, Clock, AlertCircle, CreditCard, Send,
  Calendar, Building2, FileText, Plus, Search, ChevronRight,
  Filter, Download, TrendingUp, TrendingDown, Wallet, X, Check,
  Sparkles, RefreshCw, Loader2
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';

// Simple Card components
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

// Minimalist Select Component
function MinimalSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Välj...',
  icon: Icon
}: { 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-gray-50 rounded-xl text-sm text-left flex items-center justify-between
                   hover:bg-gray-100 transition-all ${isOpen ? 'ring-2 ring-[#c0a280]/20' : ''}`}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          <span className={selectedOption ? 'text-gray-900' : 'text-gray-400'}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 
                        overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-sm text-left flex items-center justify-between
                         hover:bg-gray-50 transition-colors ${value === option.value ? 'bg-[#c0a280]/5' : ''}`}
            >
              <span className={value === option.value ? 'text-[#c0a280] font-medium' : 'text-gray-900'}>
                {option.label}
              </span>
              {value === option.value && <Check className="w-4 h-4 text-[#c0a280]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Payment {
  id: string;
  jobId?: string;
  supplier: string;
  invoiceNumber?: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';
  paymentMethod?: 'manual' | 'tink' | 'fortnox';
  scheduledDate?: string;
  paidAt?: string;
  bankReference?: string;
}

interface PaymentSummary {
  totalPending: number;
  totalOverdue: number;
  totalScheduled: number;
  totalPaid: number;
  overdueCount: number;
  pendingCount: number;
  scheduledCount: number;
}

function getStatusBadge(status: Payment['status']) {
  switch (status) {
    case 'completed':
      return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium"><CheckCircle2 className="w-3 h-3" />Betald</span>;
    case 'pending':
      return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium"><Clock className="w-3 h-3" />Väntar</span>;
    case 'scheduled':
      return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium"><Calendar className="w-3 h-3" />Schemalagd</span>;
    case 'processing':
      return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium"><Loader2 className="w-3 h-3 animate-spin" />Bearbetas</span>;
    case 'failed':
      return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium"><AlertCircle className="w-3 h-3" />Misslyckad</span>;
  }
}

function isOverdue(payment: Payment): boolean {
  return payment.status === 'pending' && new Date(payment.dueDate) < new Date();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(amount);
}

const bankAccounts = [
  { value: 'seb-1', label: 'SEB Företagskonto ****4521' },
  { value: 'nordea-1', label: 'Nordea Huvudkonto ****8834' },
  { value: 'swedbank-1', label: 'Swedbank Likviditet ****2290' },
];

function NewPaymentModal({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (payment: Partial<Payment>) => void }) {
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reference, setReference] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  const handleSubmit = () => {
    if (!recipient || !description || !amount || !dueDate) return;
    onSubmit({ 
      supplier: recipient, 
      description, 
      amount: parseFloat(amount), 
      dueDate, 
      invoiceNumber: reference || undefined,
      status: isScheduled ? 'scheduled' : 'pending',
    });
    setRecipient(''); setDescription(''); setAmount(''); setDueDate(''); setReference(''); setBankAccount(''); setIsScheduled(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c0a280]/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-[#c0a280]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ny betalning</h2>
              <p className="text-xs text-gray-500">Skapa en ny utgående betalning</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Mottagare *</label>
            <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Företagsnamn eller person" className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Beskrivning *</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="t.ex. Faktura december 2024" className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Belopp (SEK) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Förfallodatum *</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Referens</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Fakturanummer eller OCR" className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/20 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">Från konto</label>
              <MinimalSelect options={bankAccounts} value={bankAccount} onChange={setBankAccount} placeholder="Välj konto" icon={CreditCard} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <input type="checkbox" id="schedule" checked={isScheduled} onChange={(e) => setIsScheduled(e.target.checked)} className="rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]" />
            <label htmlFor="schedule" className="flex-1 text-sm text-gray-900 cursor-pointer">
              <span className="font-medium">Schemalägg betalning</span>
              <p className="text-xs text-gray-500 mt-0.5">Betalningen utförs automatiskt på förfallodagen</p>
            </label>
            <Calendar className="w-5 h-5 text-gray-300" />
          </div>
          <div className="flex items-start gap-3 p-4 bg-[#c0a280]/5 rounded-xl border border-[#c0a280]/20">
            <Sparkles className="w-5 h-5 text-[#c0a280] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">AI-förslag</p>
              <p className="text-xs text-gray-600 mt-0.5">Baserat på tidigare betalningar till denna mottagare rekommenderar vi konto SEB Företagskonto.</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button onClick={onClose} className="flex-1 py-3 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">Avbryt</button>
          <button onClick={handleSubmit} disabled={!recipient || !description || !amount || !dueDate} className="flex-1 py-3 px-4 text-sm font-medium text-white bg-[#c0a280] rounded-xl hover:bg-[#a08260] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#c0a280]/20 transition-all flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            {isScheduled ? 'Schemalägg' : 'Skapa betalning'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const { selectedCompany: company } = useCompany();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'scheduled' | 'overdue' | 'completed'>('all');
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);

  const handleExportPain001 = async () => {
    if (!company?.id) return;
    if (selectedPayments.length === 0) {
      alert('Välj minst en betalning att exportera.');
      return;
    }

    const executionDate = prompt('Execution date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!executionDate) return;

    const debtorName = prompt('Betalare (företagsnamn):', company.name || 'AIFM') || '';
    const debtorIban = prompt('Betalare IBAN:', '') || '';
    const debtorBic = prompt('Betalare BIC:', '') || '';

    if (!debtorName || !debtorIban || !debtorBic) {
      alert('Debtor (name, IBAN, BIC) krävs för att exportera pain.001.');
      return;
    }

    const res = await fetch('/api/accounting/payments/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company.id,
        paymentIds: selectedPayments,
        executionDate,
        debtor: { name: debtorName, iban: debtorIban, bic: debtorBic },
      }),
    });

    if (!res.ok) {
      const err: unknown = await res.json().catch(() => null);
      const missingRecipients =
        err && typeof err === 'object' && 'missingRecipients' in err
          ? (err as { missingRecipients?: unknown }).missingRecipients
          : undefined;
      if (Array.isArray(missingRecipients) && missingRecipients.length > 0) {
        const suppliers = missingRecipients
          .map((m) => {
            const supplier =
              m && typeof m === 'object' && 'supplier' in m ? (m as { supplier?: unknown }).supplier : undefined;
            const supplierKey =
              m && typeof m === 'object' && 'supplierKey' in m ? (m as { supplierKey?: unknown }).supplierKey : undefined;
            return `${typeof supplier === 'string' ? supplier : 'Okänd'} (${typeof supplierKey === 'string' ? supplierKey : 'unknown'})`;
          })
          .join('\n');
        alert(
          `Saknar bankuppgifter (IBAN/BIC) för mottagare:\n\n${suppliers}\n\nLägg in på /accounting/payment-recipients och försök igen.`
        );
        return;
      }
      const errorMsg =
        err && typeof err === 'object' && 'error' in err ? (err as { error?: unknown }).error : undefined;
      alert(typeof errorMsg === 'string' ? errorMsg : 'Kunde inte exportera betalfiler.');
      return;
    }

    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const m = /filename="([^"]+)"/.exec(cd);
    const fileName = m?.[1] || `pain.001_${executionDate}.xml`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const fetchPayments = useCallback(async (showRefreshIndicator = false) => {
    if (!company?.id) return;

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/accounting/payments?companyId=${company.id}`);
      const data = await response.json();

      if (data.success) {
        setPayments(data.payments);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const getFilteredPayments = () => {
    let filtered = payments;
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (activeTab === 'overdue') {
      filtered = filtered.filter(p => isOverdue(p));
    } else if (activeTab !== 'all') {
      filtered = filtered.filter(p => p.status === activeTab);
    }
    return filtered;
  };

  const filteredPayments = getFilteredPayments();

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const response = await fetch('/api/accounting/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          action: 'mark-paid',
        }),
      });

      if (response.ok) {
        setPayments(prev => prev.map(p => 
          p.id === paymentId ? { ...p, status: 'completed' as const } : p
        ));
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error);
    }
  };

  const handleBulkPay = async () => {
    for (const paymentId of selectedPayments) {
      await handleMarkAsPaid(paymentId);
    }
    setSelectedPayments([]);
  };

  const handleSchedulePayment = async (paymentId: string, scheduledDate: string) => {
    try {
      const response = await fetch('/api/accounting/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          action: 'schedule',
          scheduledDate,
          paymentMethod: 'manual',
        }),
      });

      if (response.ok) {
        setPayments(prev => prev.map(p => 
          p.id === paymentId ? { ...p, status: 'scheduled' as const, scheduledDate } : p
        ));
      }
    } catch (error) {
      console.error('Error scheduling payment:', error);
    }
  };

  const handleNewPayment = (paymentData: Partial<Payment>) => {
    // For now, add to local state (in production, this would POST to API)
    const newPayment: Payment = {
      id: `manual-${Date.now()}`,
      supplier: paymentData.supplier || '',
      description: paymentData.description || '',
      amount: paymentData.amount || 0,
      dueDate: paymentData.dueDate || new Date().toISOString().split('T')[0],
      status: paymentData.status || 'pending',
      invoiceNumber: paymentData.invoiceNumber,
    };
    setPayments(prev => [newPayment, ...prev]);
  };

  const toggleSelection = (id: string) => {
    setSelectedPayments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const scheduledCount = payments.filter(p => p.status === 'scheduled').length;
  const overdueCount = payments.filter(p => isOverdue(p)).length;
  const completedCount = payments.filter(p => p.status === 'completed').length;

  const pendingAmount = summary?.totalPending || 0;
  const overdueAmount = summary?.totalOverdue || 0;
  const paidThisMonth = summary?.totalPaid || 0;

  // Find next due date
  const nextDueDate = payments
    .filter(p => p.status === 'pending' || p.status === 'scheduled')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]?.dueDate;

  if (!company) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Välj ett bolag för att se betalningar.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-6 w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">Betalningar</h1>
            <p className="text-gray-500 mt-1">{company.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchPayments(true)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Uppdatera"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {selectedPayments.length > 0 && (
              <button onClick={handleBulkPay} className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2">
                <Send className="w-4 h-4" />Markera {selectedPayments.length} som betalda
              </button>
            )}
            <button onClick={() => setShowNewPaymentModal(true)} className="px-4 py-2 text-sm bg-[#c0a280] hover:bg-[#a08260] text-white rounded-lg flex items-center gap-2">
              <Plus className="w-4 h-4" />Ny betalning
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#c0a280]">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Wallet className="w-4 h-4" /><span className="text-sm">Att betala</span></div>
              <div className="text-2xl font-light text-gray-900">{loading ? '-' : formatCurrency(pendingAmount)}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1"><AlertCircle className="w-4 h-4 text-red-500" /><span className="text-sm">Förfallna</span></div>
              <div className="text-2xl font-light text-red-600">{loading ? '-' : formatCurrency(overdueAmount)}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1"><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-sm">Betalt i månaden</span></div>
              <div className="text-2xl font-light text-green-600">{loading ? '-' : formatCurrency(paidThisMonth)}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1"><Calendar className="w-4 h-4 text-amber-500" /><span className="text-sm">Nästa förfallodag</span></div>
              <div className="text-2xl font-light text-gray-900">
                {loading ? '-' : nextDueDate ? new Date(nextDueDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '-'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            <div className="flex border-b border-gray-100">
              {[
                { key: 'all', label: 'Alla', count: payments.length, icon: Wallet },
                { key: 'pending', label: 'Väntar', count: pendingCount, icon: Clock },
                { key: 'scheduled', label: 'Schemalagda', count: scheduledCount, icon: Calendar },
                { key: 'overdue', label: 'Förfallna', count: overdueCount, icon: AlertCircle },
                { key: 'completed', label: 'Betalda', count: completedCount, icon: CheckCircle2 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-6 py-3 text-sm font-medium transition-all relative flex items-center gap-2 ${activeTab === tab.key ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-[#c0a280]/20 text-[#c0a280]' : 'bg-gray-100 text-gray-500'}`}>
                    {loading ? '-' : tab.count}
                  </span>
                  {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Sök leverantör eller beskrivning..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-[#c0a280]/10 transition-all" />
              </div>
              <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors"><Filter className="w-4 h-4" />Filter</button>
              <button onClick={handleExportPain001} className="px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg flex items-center gap-2 hover:bg-gray-800 transition-colors"><Download className="w-4 h-4" />Exportera pain.001</button>
              <a href="/accounting/payment-recipients" className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center">
                Mottagare
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Payments Table */}
        <Card>
          {loading ? (
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin mb-4" />
                <p className="text-gray-500">Laddar betalningar...</p>
              </div>
            </CardContent>
          ) : payments.length === 0 ? (
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <Wallet className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">Inga betalningar att visa</p>
                <p className="text-sm text-gray-400">Betalningar skapas automatiskt från godkända fakturor</p>
              </div>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input 
                        type="checkbox" 
                        onChange={() => { 
                          const unpaidIds = filteredPayments.filter(p => p.status !== 'completed').map(p => p.id); 
                          setSelectedPayments(prev => prev.length === unpaidIds.length ? [] : unpaidIds); 
                        }} 
                        checked={selectedPayments.length === filteredPayments.filter(p => p.status !== 'completed').length && selectedPayments.length > 0} 
                        className="rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]" 
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leverantör</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beskrivning</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Förfallodatum</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Belopp</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className={`hover:bg-gray-50/50 transition-colors ${isOverdue(payment) ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        {payment.status !== 'completed' && (
                          <input 
                            type="checkbox" 
                            checked={selectedPayments.includes(payment.id)} 
                            onChange={() => toggleSelection(payment.id)} 
                            className="rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]" 
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{payment.supplier}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">{payment.invoiceNumber || 'Faktura'}</p>
                        {payment.description && <p className="text-xs text-gray-500 mt-0.5">{payment.description}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {payment.dueDate}
                        {isOverdue(payment) && (
                          <span className="ml-2 text-xs text-red-600">(Förfallen)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(payment.status)}</td>
                      <td className="px-4 py-3 text-right">
                        {payment.status !== 'completed' && (
                          <button 
                            onClick={() => handleMarkAsPaid(payment.id)} 
                            className="px-3 py-1.5 bg-[#c0a280] text-white text-xs font-medium rounded-lg hover:bg-[#a08260] transition-colors flex items-center gap-1 ml-auto"
                          >
                            <Check className="w-3.5 h-3.5" />Markera betald
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="bg-[#c0a280]/10 border-[#c0a280]/20">
          <CardContent>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#c0a280] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900 font-medium">Automatisk betalningsimport</p>
                <p className="text-xs text-gray-700 mt-1">
                  Betalningar skapas automatiskt från godkända leverantörsfakturor i bokföringen. 
                  För automatiska betalningar via Open Banking (Tink) krävs separat konfiguration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <NewPaymentModal isOpen={showNewPaymentModal} onClose={() => setShowNewPaymentModal(false)} onSubmit={handleNewPayment} />
      </div>
    
  );
}
