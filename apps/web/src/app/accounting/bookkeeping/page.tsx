'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, Search, Filter,
  ArrowUpRight, ArrowDownRight, Eye, Check, X, ChevronDown,
  FileText, Sparkles
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

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

export default function BookkeepingPage() {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'needs_review'>('all');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tx.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
    const pendingIds = filteredTransactions.filter(tx => tx.status !== 'approved').map(tx => tx.id);
    if (selectedTransactions.length === pendingIds.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(pendingIds);
    }
  };

  const approvedCount = transactions.filter(tx => tx.status === 'approved').length;
  const pendingCount = transactions.filter(tx => tx.status === 'pending').length;
  const needsReviewCount = transactions.filter(tx => tx.status === 'needs_review').length;

  const totalIncome = transactions.filter(tx => tx.type === 'income' && tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'expense' && tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-aifm-charcoal/40 mb-2">
          <Link href="/accounting" className="hover:text-aifm-gold transition-colors">Bokföring</Link>
          <span>/</span>
          <span className="text-aifm-charcoal">Löpande bokföring</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
              Löpande bokföring
            </h1>
            <p className="text-aifm-charcoal/60">
              Granska och godkänn transaktioner klassificerade av AI
            </p>
          </div>
          {selectedTransactions.length > 0 && (
            <button
              onClick={handleBulkApprove}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Godkänn {selectedTransactions.length} valda
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Totalt</p>
          <p className="text-2xl font-medium text-aifm-charcoal">{transactions.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Godkända</p>
          <p className="text-2xl font-medium text-green-600">{approvedCount}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Väntar</p>
          <p className="text-2xl font-medium text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Intäkter</p>
          <p className="text-2xl font-medium text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Kostnader</p>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök transaktion, konto eller kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm appearance-none bg-white
                         focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
            >
              <option value="all">Alla status</option>
              <option value="approved">Godkända</option>
              <option value="pending">Väntar</option>
              <option value="needs_review">Behöver granskas</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">
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
                            {tx.document}
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

