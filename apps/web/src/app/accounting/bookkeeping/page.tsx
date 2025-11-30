'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, Search,
  ArrowUpRight, ArrowDownRight, Eye, Check, X,
  FileText, Sparkles, ChevronRight, TrendingUp, Download,
  Filter, BarChart3
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  account: string;
  category: string;
  status: 'approved' | 'pending' | 'needs_review';
  source: string;
  aiConfidence?: number;
  document?: string;
}

const mockTransactions: Transaction[] = [
  {
    id: '1',
    date: '2024-11-25',
    description: 'Telia Sverige AB - Telefoni november',
    amount: 2450,
    type: 'expense',
    account: '6212 - Telefon och internet',
    category: 'Telefonkostnad',
    status: 'approved',
    source: 'Faktura',
    aiConfidence: 98,
    document: 'Faktura_Telia_Nov2024.pdf',
  },
  {
    id: '2',
    date: '2024-11-24',
    description: 'SJ AB - Tjänsteresa Stockholm-Göteborg',
    amount: 1890,
    type: 'expense',
    account: '5810 - Biljetter',
    category: 'Resekostnad',
    status: 'approved',
    source: 'Kvitto',
    aiConfidence: 95,
    document: 'Kvitto_SJ_Resa.jpg',
  },
  {
    id: '3',
    date: '2024-11-23',
    description: 'Vasakronan AB - Lokalhyra december',
    amount: 45000,
    type: 'expense',
    account: '5010 - Lokalhyra',
    category: 'Lokalkostnad',
    status: 'pending',
    source: 'Faktura',
    aiConfidence: 72,
    document: 'Hyresfaktura_Dec.pdf',
  },
  {
    id: '4',
    date: '2024-11-22',
    description: 'Office Depot AB - Kontorsmaterial',
    amount: 12500,
    type: 'expense',
    account: '4010 - Inköp varor',
    category: 'Inköp varor',
    status: 'approved',
    source: 'Faktura',
    aiConfidence: 94,
    document: 'Leverantörsfaktura_2024-1847.pdf',
  },
  {
    id: '5',
    date: '2024-11-21',
    description: 'Kundbetalning - Faktura #2024-089',
    amount: 125000,
    type: 'income',
    account: '3010 - Försäljning tjänster',
    category: 'Försäljning',
    status: 'approved',
    source: 'Bankimport',
  },
  {
    id: '6',
    date: '2024-11-20',
    description: 'AWS - Molntjänster november',
    amount: 8750,
    type: 'expense',
    account: '6540 - IT-tjänster',
    category: 'IT-kostnad',
    status: 'needs_review',
    source: 'Faktura',
    aiConfidence: 65,
  },
  {
    id: '7',
    date: '2024-11-19',
    description: 'Pensionsutbetalning - November',
    amount: 35000,
    type: 'expense',
    account: '7412 - Pensionsförsäkring',
    category: 'Lönekostnad',
    status: 'pending',
    source: 'Automatisk',
  },
  {
    id: '8',
    date: '2024-11-18',
    description: 'Advokatfirman Vinge - Juridisk rådgivning',
    amount: 75000,
    type: 'expense',
    account: '6550 - Konsultarvoden',
    category: 'Konsulttjänster',
    status: 'approved',
    source: 'Faktura',
    aiConfidence: 91,
  },
  {
    id: '9',
    date: '2024-11-17',
    description: 'Kundbetalning - Faktura #2024-088',
    amount: 89000,
    type: 'income',
    account: '3010 - Försäljning tjänster',
    category: 'Försäljning',
    status: 'approved',
    source: 'Bankimport',
  },
  {
    id: '10',
    date: '2024-11-16',
    description: 'Okänd transaktion - Bankbetalning',
    amount: 4500,
    type: 'expense',
    account: '6990 - Övriga kostnader',
    category: 'Övrigt',
    status: 'needs_review',
    source: 'Bankimport',
    aiConfidence: 45,
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: Transaction['status']) {
  switch (status) {
    case 'approved':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Godkänd
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <Clock className="w-3 h-3" />
          Väntar
        </span>
      );
    case 'needs_review':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Granska
        </span>
      );
  }
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
function HeroMetric({ label, value, trend }: { label: string; value: string; trend?: { value: string; positive: boolean } }) {
  return (
    <div className="text-center">
      <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wider mt-1">{label}</p>
      {trend && (
        <div className={`inline-flex items-center gap-1 mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
          trend.positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
        }`}>
          <TrendingUp className={`w-3 h-3 ${!trend.positive && 'rotate-180'}`} />
          {trend.value}
        </div>
      )}
    </div>
  );
}

export default function BookkeepingPage() {
  useCompany(); // Context for layout
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'needs_review' | 'approved'>('all');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);

  const getFilteredTransactions = () => {
    let filtered = transactions;
    
    if (searchQuery) {
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeTab !== 'all') {
      filtered = filtered.filter(tx => tx.status === activeTab);
    }
    
    return filtered;
  };

  const filteredTransactions = getFilteredTransactions();

  const handleApprove = (id: string) => {
    setTransactions(prev => 
      prev.map(tx => tx.id === id ? { ...tx, status: 'approved' as const } : tx)
    );
  };

  const handleBulkApprove = () => {
    setTransactions(prev => 
      prev.map(tx => selectedTransactions.includes(tx.id) ? { ...tx, status: 'approved' as const } : tx)
    );
    setSelectedTransactions([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    const selectableIds = filteredTransactions.filter(tx => tx.status !== 'approved').map(tx => tx.id);
    if (selectedTransactions.length === selectableIds.length && selectableIds.length > 0) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(selectableIds);
    }
  };

  const approvedCount = transactions.filter(tx => tx.status === 'approved').length;
  const pendingCount = transactions.filter(tx => tx.status === 'pending').length;
  const needsReviewCount = transactions.filter(tx => tx.status === 'needs_review').length;

  const totalIncome = transactions.filter(tx => tx.type === 'income' && tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'expense' && tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0);

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
            <span className="text-white/70">Löpande bokföring</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Löpande bokföring
              </h1>
              <p className="text-white/60 text-sm">
                Granska och godkänn transaktioner klassificerade av AI
              </p>
            </div>
            {selectedTransactions.length > 0 && (
              <button
                onClick={handleBulkApprove}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white 
                           bg-emerald-500 rounded-xl hover:bg-emerald-600 
                           shadow-lg shadow-emerald-500/30 transition-all self-start"
              >
                <CheckCircle2 className="w-4 h-4" />
                Godkänn {selectedTransactions.length} valda
              </button>
            )}
          </div>

          {/* Hero Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6">
            <HeroMetric label="Totalt" value={transactions.length.toString()} />
            <HeroMetric label="Godkända" value={approvedCount.toString()} trend={{ value: '+12%', positive: true }} />
            <HeroMetric label="Väntar" value={pendingCount.toString()} />
            <HeroMetric label="Granska" value={needsReviewCount.toString()} />
            <div className="col-span-2 sm:col-span-1 bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-white/50" />
                <span className="text-xs text-white/50">Nettoresultat</span>
              </div>
              <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(totalIncome - totalExpense)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100/50 mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-100 min-w-max">
          <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} count={transactions.length}>
            <BarChart3 className="w-4 h-4" />
            Alla
          </TabButton>
          <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} count={pendingCount}>
            <Clock className="w-4 h-4" />
            Väntar
          </TabButton>
          <TabButton active={activeTab === 'needs_review'} onClick={() => setActiveTab('needs_review')} count={needsReviewCount}>
            <AlertCircle className="w-4 h-4" />
            Granska
          </TabButton>
          <TabButton active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} count={approvedCount}>
            <CheckCircle2 className="w-4 h-4" />
            Godkända
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
              placeholder="Sök transaktion..."
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

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.length === filteredTransactions.filter(tx => tx.status !== 'approved').length && selectedTransactions.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Beskrivning</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Konto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Belopp</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">AI</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Åtgärd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className={`hover:bg-gray-50/50 transition-colors ${tx.status === 'needs_review' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    {tx.status !== 'approved' && (
                      <input
                        type="checkbox"
                        checked={selectedTransactions.includes(tx.id)}
                        onChange={() => toggleSelection(tx.id)}
                        className="rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-aifm-charcoal/70">{tx.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {tx.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-aifm-charcoal font-medium">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-aifm-charcoal/50">{tx.source}</span>
                          {tx.document && (
                            <span className="text-xs text-aifm-gold flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              <span className="hidden lg:inline">{tx.document}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-aifm-charcoal">{tx.account}</p>
                    <p className="text-xs text-aifm-charcoal/50">{tx.category}</p>
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium text-right ${tx.type === 'income' ? 'text-green-600' : 'text-aifm-charcoal'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {tx.aiConfidence !== undefined && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        tx.aiConfidence >= 90 ? 'bg-green-100 text-green-700' :
                        tx.aiConfidence >= 70 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        <Sparkles className="w-3 h-3" />
                        {tx.aiConfidence}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tx.status !== 'approved' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleApprove(tx.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Godkänn"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Granska"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                          title="Avvisa"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info about AI */}
      <div className="mt-6 p-4 bg-aifm-gold/10 rounded-xl flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-aifm-charcoal font-medium">AI-klassificering</p>
          <p className="text-xs text-aifm-charcoal/70 mt-1">
            Transaktioner klassificeras automatiskt av vår AI baserat på tidigare mönster och uppladdade underlag. 
            Grön indikerar hög säkerhet (90%+), gul medel (70-90%), och röd låg (&lt;70%).
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
