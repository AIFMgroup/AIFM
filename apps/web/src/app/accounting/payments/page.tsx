'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, CreditCard, Send,
  Calendar, Building2, FileText, ChevronDown, Plus, Search
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

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

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'scheduled' | 'overdue'>('all');
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         payment.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handlePay = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' as const } : p));
  };

  const handleBulkPay = () => {
    setPayments(prev => prev.map(p => selectedPayments.includes(p.id) ? { ...p, status: 'paid' as const } : p));
    setSelectedPayments([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedPayments(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const pendingAmount = payments.filter(p => p.status === 'pending' || p.status === 'scheduled').reduce((sum, p) => sum + p.amount, 0);
  const overdueAmount = payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0);
  const paidThisMonth = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-aifm-charcoal/40 mb-2">
          <Link href="/accounting" className="hover:text-aifm-gold transition-colors">Bokföring</Link>
          <span>/</span>
          <span className="text-aifm-charcoal">Betalningar</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
              Betalningar
            </h1>
            <p className="text-aifm-charcoal/60">
              Hantera utgående betalningar, skatter och löner
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedPayments.length > 0 && (
              <button
                onClick={handleBulkPay}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Betala {selectedPayments.length} valda
              </button>
            )}
            <button className="px-4 py-2 bg-aifm-charcoal text-white rounded-lg text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Ny betalning
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Att betala</p>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Förfallna</p>
          <p className="text-2xl font-medium text-red-600">{formatCurrency(overdueAmount)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Betalt denna månad</p>
          <p className="text-2xl font-medium text-green-600">{formatCurrency(paidThisMonth)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Nästa förfallodag</p>
          <p className="text-2xl font-medium text-aifm-charcoal">5 dec</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök mottagare eller beskrivning..."
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
              <option value="pending">Väntar</option>
              <option value="scheduled">Schemalagda</option>
              <option value="overdue">Förfallna</option>
              <option value="paid">Betalda</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
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

      {/* Upcoming Payments Summary */}
      <div className="mt-8 grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
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
        <div className="bg-white rounded-xl border border-gray-100 p-6">
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
        <div className="bg-aifm-charcoal rounded-xl p-6 text-white">
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
            Kassaprognos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-white/70">Aktuellt saldo</span>
              <span className="text-sm font-medium">1 850 000 SEK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/70">Kommande inbetalningar</span>
              <span className="text-sm font-medium text-green-400">+450 000 SEK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-white/70">Kommande utbetalningar</span>
              <span className="text-sm font-medium text-red-400">-947 000 SEK</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between">
              <span className="text-sm font-medium">Prognos 31 dec</span>
              <span className="text-sm font-medium">1 353 000 SEK</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


