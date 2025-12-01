'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, CreditCard, Send,
  Calendar, Building2, FileText, Plus, Search, ChevronRight,
  Filter, Download, TrendingUp, TrendingDown, Wallet, X, Check,
  Sparkles, User
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

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
                   hover:bg-gray-100 transition-all ${isOpen ? 'ring-2 ring-aifm-gold/20' : ''}`}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-4 h-4 text-aifm-charcoal/40" />}
          <span className={selectedOption ? 'text-aifm-charcoal' : 'text-aifm-charcoal/40'}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-aifm-charcoal/40 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
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
                         hover:bg-gray-50 transition-colors ${value === option.value ? 'bg-aifm-gold/5' : ''}`}
            >
              <span className={value === option.value ? 'text-aifm-gold font-medium' : 'text-aifm-charcoal'}>
                {option.label}
              </span>
              {value === option.value && <Check className="w-4 h-4 text-aifm-gold" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Payment {
  id: string;
  recipient: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'scheduled' | 'overdue';
  type: 'invoice' | 'tax' | 'salary' | 'other';
  reference?: string;
  bankAccount?: string;
}

const mockPayments: Payment[] = [
  {
    id: '1',
    recipient: 'Skatteverket',
    description: 'Moms Q4 2024',
    amount: 125000,
    dueDate: '2025-01-12',
    status: 'scheduled',
    type: 'tax',
    reference: 'Moms 202404',
  },
  {
    id: '2',
    recipient: 'Vasakronan AB',
    description: 'Lokalhyra januari 2025',
    amount: 45000,
    dueDate: '2024-12-28',
    status: 'pending',
    type: 'invoice',
    reference: 'Faktura 2024-1892',
  },
  {
    id: '3',
    recipient: 'Anställda',
    description: 'Löner december 2024',
    amount: 485000,
    dueDate: '2024-12-25',
    status: 'scheduled',
    type: 'salary',
  },
  {
    id: '4',
    recipient: 'Skatteverket',
    description: 'Arbetsgivaravgifter december',
    amount: 152000,
    dueDate: '2025-01-12',
    status: 'scheduled',
    type: 'tax',
  },
  {
    id: '5',
    recipient: 'Telia Sverige AB',
    description: 'Telefoni november',
    amount: 2450,
    dueDate: '2024-11-30',
    status: 'paid',
    type: 'invoice',
    reference: 'Faktura TL-2024-8847',
  },
  {
    id: '6',
    recipient: 'Office Depot AB',
    description: 'Kontorsmaterial',
    amount: 12500,
    dueDate: '2024-11-25',
    status: 'paid',
    type: 'invoice',
    reference: 'Faktura OD-2024-1847',
  },
  {
    id: '7',
    recipient: 'Advokatfirman Vinge',
    description: 'Juridisk rådgivning Q4',
    amount: 75000,
    dueDate: '2024-12-15',
    status: 'overdue',
    type: 'invoice',
    reference: 'Faktura V-2024-445',
  },
  {
    id: '8',
    recipient: 'AWS',
    description: 'Molntjänster november',
    amount: 8750,
    dueDate: '2024-12-05',
    status: 'pending',
    type: 'invoice',
    reference: 'Invoice AWS-2024-11',
  },
];

function getStatusBadge(status: Payment['status']) {
  switch (status) {
    case 'paid':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Betald
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <Clock className="w-3 h-3" />
          Väntar
        </span>
      );
    case 'scheduled':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
          <Calendar className="w-3 h-3" />
          Schemalagd
        </span>
      );
    case 'overdue':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Förfallen
        </span>
      );
  }
}

function getTypeIcon(type: Payment['type']) {
  switch (type) {
    case 'invoice': return <FileText className="w-4 h-4" />;
    case 'tax': return <Building2 className="w-4 h-4" />;
    case 'salary': return <CreditCard className="w-4 h-4" />;
    default: return <CreditCard className="w-4 h-4" />;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Tab Button Component
function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap ${
        active 
          ? 'text-aifm-charcoal' 
          : 'text-aifm-charcoal/50 hover:text-aifm-charcoal/70'
      }`}
    >
      <span className="flex items-center gap-2">
        {children}
        {count !== undefined && count > 0 && (
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
            active ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-100 text-gray-500'
          }`}>
            {count}
          </span>
        )}
      </span>
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aifm-gold rounded-full" />
      )}
    </button>
  );
}

// Hero Metric
function HeroMetric({ label, value, color = 'white', icon: Icon }: { label: string; value: string; color?: 'white' | 'green' | 'red' | 'amber'; icon: React.ElementType }) {
  const textColors = {
    white: 'text-white',
    green: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  };
  
  return (
    <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-white/70" />
        </div>
        <div>
          <p className={`text-xl sm:text-2xl font-bold ${textColors[color]}`}>{value}</p>
          <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Payment Type Options
const paymentTypes = [
  { value: 'invoice', label: 'Faktura' },
  { value: 'tax', label: 'Skatt' },
  { value: 'salary', label: 'Lön' },
  { value: 'other', label: 'Övrigt' },
];

// Bank Account Options
const bankAccounts = [
  { value: 'seb-1', label: 'SEB Företagskonto ****4521' },
  { value: 'nordea-1', label: 'Nordea Huvudkonto ****8834' },
  { value: 'swedbank-1', label: 'Swedbank Likviditet ****2290' },
];

// New Payment Modal
function NewPaymentModal({ 
  isOpen, 
  onClose,
  onSubmit 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSubmit: (payment: Omit<Payment, 'id' | 'status'>) => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [type, setType] = useState('');
  const [reference, setReference] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  const handleSubmit = () => {
    if (!recipient || !description || !amount || !dueDate || !type) {
      return;
    }
    onSubmit({
      recipient,
      description,
      amount: parseFloat(amount),
      dueDate,
      type: type as Payment['type'],
      reference: reference || undefined,
      bankAccount: bankAccount || undefined,
    });
    // Reset form
    setRecipient('');
    setDescription('');
    setAmount('');
    setDueDate('');
    setType('');
    setReference('');
    setBankAccount('');
    setIsScheduled(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aifm-gold/10 flex items-center justify-center">
              <Send className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aifm-charcoal">Ny betalning</h2>
              <p className="text-xs text-aifm-charcoal/50">Skapa en ny utgående betalning</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-aifm-charcoal/50" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Recipient & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
                Mottagare *
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Företagsnamn eller person"
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                           focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
                Typ *
              </label>
              <MinimalSelect
                options={paymentTypes}
                value={type}
                onChange={setType}
                placeholder="Välj typ"
                icon={FileText}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
              Beskrivning *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="t.ex. Faktura december 2024"
              className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                         focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
            />
          </div>

          {/* Amount & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
                Belopp (SEK) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                           focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
                Förfallodatum *
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                           focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
              />
            </div>
          </div>

          {/* Reference & Bank Account */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
                Referens
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Fakturanummer eller OCR"
                className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm
                           focus:bg-white focus:ring-2 focus:ring-aifm-gold/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-2">
                Från konto
              </label>
              <MinimalSelect
                options={bankAccounts}
                value={bankAccount}
                onChange={setBankAccount}
                placeholder="Välj konto"
                icon={CreditCard}
              />
            </div>
          </div>

          {/* Schedule Option */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="schedule"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
              className="rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
            />
            <label htmlFor="schedule" className="flex-1 text-sm text-aifm-charcoal cursor-pointer">
              <span className="font-medium">Schemalägg betalning</span>
              <p className="text-xs text-aifm-charcoal/50 mt-0.5">Betalningen utförs automatiskt på förfallodagen</p>
            </label>
            <Calendar className="w-5 h-5 text-aifm-charcoal/30" />
          </div>

          {/* AI Suggestion */}
          <div className="flex items-start gap-3 p-4 bg-aifm-gold/5 rounded-xl border border-aifm-gold/20">
            <Sparkles className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-aifm-charcoal">AI-förslag</p>
              <p className="text-xs text-aifm-charcoal/60 mt-0.5">
                Baserat på tidigare betalningar till denna mottagare rekommenderar vi konto SEB Företagskonto.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-gray-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 
                       bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={!recipient || !description || !amount || !dueDate || !type}
            className="flex-1 py-3 px-4 text-sm font-medium text-white 
                       bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg shadow-aifm-charcoal/20 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isScheduled ? 'Schemalägg' : 'Skapa betalning'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  useCompany(); // Context for layout
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'scheduled' | 'overdue' | 'paid'>('all');
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [showNewPaymentModal, setShowNewPaymentModal] = useState(false);

  const getFilteredPayments = () => {
    let filtered = payments;
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeTab !== 'all') {
      filtered = filtered.filter(p => p.status === activeTab);
    }
    
    return filtered;
  };

  const filteredPayments = getFilteredPayments();

  const handlePay = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' as const } : p));
  };

  const handleBulkPay = () => {
    setPayments(prev => prev.map(p => selectedPayments.includes(p.id) ? { ...p, status: 'paid' as const } : p));
    setSelectedPayments([]);
  };

  const handleNewPayment = (paymentData: Omit<Payment, 'id' | 'status'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: `new-${Date.now()}`,
      status: 'pending',
    };
    setPayments(prev => [newPayment, ...prev]);
  };

  const toggleSelection = (id: string) => {
    setSelectedPayments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const pendingCount = payments.filter(p => p.status === 'pending').length;
  const scheduledCount = payments.filter(p => p.status === 'scheduled').length;
  const overdueCount = payments.filter(p => p.status === 'overdue').length;
  const paidCount = payments.filter(p => p.status === 'paid').length;

  const pendingAmount = payments.filter(p => p.status === 'pending' || p.status === 'scheduled').reduce((sum, p) => sum + p.amount, 0);
  const overdueAmount = payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0);
  const paidThisMonth = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-white/40 mb-4">
            <Link href="/accounting" className="hover:text-white/60 transition-colors">Bokföring</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70">Betalningar</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Betalningar
              </h1>
              <p className="text-white/60 text-sm">
                Hantera utgående betalningar, skatter och löner
              </p>
            </div>
            <div className="flex items-center gap-3">
              {selectedPayments.length > 0 && (
                <button
                  onClick={handleBulkPay}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                             bg-emerald-500 rounded-xl hover:bg-emerald-600 
                             shadow-lg shadow-emerald-500/30 transition-all"
                >
                  <Send className="w-4 h-4" />
                  Betala {selectedPayments.length}
                </button>
              )}
              <button 
                onClick={() => setShowNewPaymentModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aifm-charcoal 
                         bg-aifm-gold rounded-xl hover:bg-aifm-gold/90 
                         shadow-lg shadow-aifm-gold/30 transition-all">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Ny betalning</span>
              </button>
            </div>
          </div>

          {/* Hero Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <HeroMetric label="Att betala" value={formatCurrency(pendingAmount)} icon={Wallet} />
            <HeroMetric label="Förfallna" value={formatCurrency(overdueAmount)} color="red" icon={AlertCircle} />
            <HeroMetric label="Betalt i månaden" value={formatCurrency(paidThisMonth)} color="green" icon={CheckCircle2} />
            <HeroMetric label="Nästa förfallodag" value="5 dec" color="amber" icon={Calendar} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100/50 mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-100 min-w-max">
          <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} count={payments.length}>
            <Wallet className="w-4 h-4" />
            Alla
          </TabButton>
          <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} count={pendingCount}>
            <Clock className="w-4 h-4" />
            Väntar
          </TabButton>
          <TabButton active={activeTab === 'scheduled'} onClick={() => setActiveTab('scheduled')} count={scheduledCount}>
            <Calendar className="w-4 h-4" />
            Schemalagda
          </TabButton>
          <TabButton active={activeTab === 'overdue'} onClick={() => setActiveTab('overdue')} count={overdueCount}>
            <AlertCircle className="w-4 h-4" />
            Förfallna
          </TabButton>
          <TabButton active={activeTab === 'paid'} onClick={() => setActiveTab('paid')} count={paidCount}>
            <CheckCircle2 className="w-4 h-4" />
            Betalda
          </TabButton>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100/50 p-3 sm:p-4 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök mottagare eller beskrivning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm
                         focus:bg-white focus:ring-2 focus:ring-aifm-gold/10 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2.5 text-sm font-medium text-aifm-charcoal/60 bg-gray-100 rounded-xl flex items-center gap-2 hover:bg-gray-200 transition-colors">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>
            <button className="px-4 py-2.5 text-sm font-medium text-white bg-aifm-charcoal rounded-xl flex items-center gap-2 hover:bg-aifm-charcoal/90 transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    onChange={() => {
                      const unpaidIds = filteredPayments.filter(p => p.status !== 'paid').map(p => p.id);
                      setSelectedPayments(prev => prev.length === unpaidIds.length ? [] : unpaidIds);
                    }}
                    checked={selectedPayments.length === filteredPayments.filter(p => p.status !== 'paid').length && selectedPayments.length > 0}
                    className="rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Mottagare</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Beskrivning</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Förfallodatum</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Belopp</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Åtgärd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className={`hover:bg-gray-50/50 transition-colors ${payment.status === 'overdue' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    {payment.status !== 'paid' && (
                      <input
                        type="checkbox"
                        checked={selectedPayments.includes(payment.id)}
                        onChange={() => toggleSelection(payment.id)}
                        className="rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                        ${payment.type === 'tax' ? 'bg-blue-100 text-blue-600' :
                          payment.type === 'salary' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'}`}
                      >
                        {getTypeIcon(payment.type)}
                      </div>
                      <span className="text-sm font-medium text-aifm-charcoal">{payment.recipient}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-aifm-charcoal">{payment.description}</p>
                    {payment.reference && (
                      <p className="text-xs text-aifm-charcoal/50 mt-0.5">{payment.reference}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-aifm-charcoal/70">{payment.dueDate}</td>
                  <td className="px-4 py-3 text-sm font-medium text-aifm-charcoal text-right">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payment.status !== 'paid' && (
                      <button
                        onClick={() => handlePay(payment.id)}
                        className="px-3 py-1.5 bg-aifm-gold text-white text-xs font-medium rounded-lg hover:bg-aifm-gold/90 transition-colors flex items-center gap-1 ml-auto"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Betala
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-4">
            Kommande skatteinbetalningar
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-aifm-charcoal/70">Moms Q4</span>
              <span className="text-sm font-medium text-aifm-charcoal">125 000 SEK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-aifm-charcoal/70">Arbetsgivaravgifter</span>
              <span className="text-sm font-medium text-aifm-charcoal">152 000 SEK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-aifm-charcoal/70">Preliminärskatt</span>
              <span className="text-sm font-medium text-aifm-charcoal">85 000 SEK</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="text-sm font-medium text-aifm-charcoal">Totalt</span>
              <span className="text-sm font-medium text-aifm-charcoal">362 000 SEK</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-5 sm:p-6">
          <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-4">
            Löneutbetalning december
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-aifm-charcoal/70">Bruttolöner</span>
              <span className="text-sm font-medium text-aifm-charcoal">650 000 SEK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-aifm-charcoal/70">Skatteavdrag</span>
              <span className="text-sm font-medium text-aifm-charcoal">-165 000 SEK</span>
            </div>
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="text-sm font-medium text-aifm-charcoal">Nettolön</span>
              <span className="text-sm font-medium text-green-600">485 000 SEK</span>
            </div>
          </div>
          <p className="text-xs text-aifm-charcoal/50 mt-3">Utbetalningsdag: 25 december</p>
        </div>
        <div className="bg-aifm-charcoal rounded-xl sm:rounded-2xl p-5 sm:p-6 text-white">
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
            Kassaprognos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-white/70">Aktuellt saldo</span>
              <span className="text-sm font-medium">1 850 000 SEK</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/70">Kommande inbetalningar</span>
              <span className="text-sm font-medium text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                +450 000 SEK
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/70">Kommande utbetalningar</span>
              <span className="text-sm font-medium text-red-400 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                -947 000 SEK
              </span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-sm font-medium">Prognos 31 dec</span>
              <span className="text-sm font-medium">1 353 000 SEK</span>
            </div>
          </div>
        </div>
      </div>

      {/* New Payment Modal */}
      <NewPaymentModal 
        isOpen={showNewPaymentModal}
        onClose={() => setShowNewPaymentModal(false)}
        onSubmit={handleNewPayment}
      />
    </DashboardLayout>
  );
}
