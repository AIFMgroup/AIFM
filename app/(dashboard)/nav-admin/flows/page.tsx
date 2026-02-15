'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, Calendar, Download,
  Send, RefreshCw, Clock, CheckCircle2, Filter, Search,
  TrendingUp, TrendingDown, Wallet, FileSpreadsheet, Mail
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface FlowEntry {
  id: string;
  fundName: string;
  isin: string;
  type: 'inflow' | 'outflow';
  amount: number;
  currency: string;
  shares: number;
  navPrice: number;
  investor: string;
  date: string;
  status: 'confirmed' | 'pending' | 'processing';
}

interface DailySummary {
  fundName: string;
  totalInflow: number;
  totalOutflow: number;
  netFlow: number;
  currency: string;
  transactionCount: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockYesterdayFlows: FlowEntry[] = [
  { id: '1', fundName: 'AUAG Essential Metals A', isin: 'SE0019175563', type: 'inflow', amount: 500000, currency: 'SEK', shares: 3511.23, navPrice: 142.42, investor: 'Pension Fund AB', date: '2025-01-16', status: 'confirmed' },
  { id: '2', fundName: 'AUAG Essential Metals A', isin: 'SE0019175563', type: 'outflow', amount: 150000, currency: 'SEK', shares: 1053.37, navPrice: 142.42, investor: 'Individual Investor', date: '2025-01-16', status: 'confirmed' },
  { id: '3', fundName: 'AuAg Gold Rush A', isin: 'SE0020677946', type: 'inflow', amount: 1200000, currency: 'SEK', shares: 5749.55, navPrice: 208.71, investor: 'Insurance Company', date: '2025-01-16', status: 'confirmed' },
  { id: '4', fundName: 'AuAg Silver Bullet A', isin: 'SE0013358181', type: 'inflow', amount: 2500000, currency: 'SEK', shares: 6607.53, navPrice: 378.33, investor: 'Foundation X', date: '2025-01-16', status: 'confirmed' },
  { id: '5', fundName: 'AuAg Precious Green A', isin: 'SE0014808440', type: 'outflow', amount: 300000, currency: 'SEK', shares: 1508.45, navPrice: 198.87, investor: 'Private Bank Client', date: '2025-01-16', status: 'confirmed' },
];

const mockTodayFlows: FlowEntry[] = [
  { id: '6', fundName: 'AuAg Gold Rush A', isin: 'SE0020677946', type: 'inflow', amount: 800000, currency: 'SEK', shares: 3833.04, navPrice: 208.71, investor: 'Corporate Client', date: '2025-01-17', status: 'pending' },
  { id: '7', fundName: 'AUAG Essential Metals A', isin: 'SE0019175563', type: 'outflow', amount: 200000, currency: 'SEK', shares: 1404.49, navPrice: 142.42, investor: 'Retail Investor', date: '2025-01-17', status: 'pending' },
  { id: '8', fundName: 'AuAg Silver Bullet A', isin: 'SE0013358181', type: 'inflow', amount: 1500000, currency: 'SEK', shares: 3964.52, navPrice: 378.33, investor: 'Asset Manager', date: '2025-01-17', status: 'processing' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' ' + currency;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function calculateSummary(flows: FlowEntry[]): DailySummary[] {
  const summaryMap = new Map<string, DailySummary>();
  
  flows.forEach(flow => {
    const existing = summaryMap.get(flow.fundName) || {
      fundName: flow.fundName,
      totalInflow: 0,
      totalOutflow: 0,
      netFlow: 0,
      currency: flow.currency,
      transactionCount: 0,
    };
    
    if (flow.type === 'inflow') {
      existing.totalInflow += flow.amount;
    } else {
      existing.totalOutflow += flow.amount;
    }
    existing.netFlow = existing.totalInflow - existing.totalOutflow;
    existing.transactionCount += 1;
    
    summaryMap.set(flow.fundName, existing);
  });
  
  return Array.from(summaryMap.values());
}

// ============================================================================
// Components
// ============================================================================

function FlowTypeBadge({ type }: { type: 'inflow' | 'outflow' }) {
  if (type === 'inflow') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">
        <ArrowDownRight className="w-3 h-3" />
        Inflöde
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
      <ArrowUpRight className="w-3 h-3" />
      Utflöde
    </span>
  );
}

function StatusBadge({ status }: { status: FlowEntry['status'] }) {
  const config = {
    confirmed: { label: 'Bekräftad', color: 'bg-emerald-50 text-emerald-600' },
    pending: { label: 'Väntar', color: 'bg-amber-50 text-amber-600' },
    processing: { label: 'Behandlas', color: 'bg-aifm-gold/15 text-aifm-charcoal' },
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config[status].color}`}>
      {config[status].label}
    </span>
  );
}

function SummaryCard({ summary, type }: { summary: DailySummary; type: 'yesterday' | 'today' }) {
  const isPositive = summary.netFlow >= 0;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-aifm-charcoal truncate">{summary.fundName}</h4>
        <span className="px-2.5 py-0.5 text-xs font-medium bg-aifm-gold/15 text-aifm-charcoal rounded-full">{summary.transactionCount} trans.</span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-aifm-charcoal/50 mb-1">Inflöde</p>
          <p className="text-sm font-semibold text-emerald-600">
            +{formatNumber(summary.totalInflow)}
          </p>
        </div>
        <div>
          <p className="text-xs text-aifm-charcoal/50 mb-1">Utflöde</p>
          <p className="text-sm font-semibold text-red-600">
            -{formatNumber(summary.totalOutflow)}
          </p>
        </div>
        <div>
          <p className="text-xs text-aifm-charcoal/50 mb-1">Netto</p>
          <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {isPositive ? '+' : ''}{formatNumber(summary.netFlow)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function FlowsPage() {
  const [activeTab, setActiveTab] = useState<'notor' | 'subred'>('notor');
  const [searchTerm, setSearchTerm] = useState('');

  const yesterdaySummary = calculateSummary(mockYesterdayFlows);
  const todaySummary = calculateSummary(mockTodayFlows);

  const totalYesterdayInflow = mockYesterdayFlows.filter(f => f.type === 'inflow').reduce((sum, f) => sum + f.amount, 0);
  const totalYesterdayOutflow = mockYesterdayFlows.filter(f => f.type === 'outflow').reduce((sum, f) => sum + f.amount, 0);
  const totalTodayInflow = mockTodayFlows.filter(f => f.type === 'inflow').reduce((sum, f) => sum + f.amount, 0);
  const totalTodayOutflow = mockTodayFlows.filter(f => f.type === 'outflow').reduce((sum, f) => sum + f.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 -mx-6 -mt-6 px-6 py-4 mb-2">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-aifm-charcoal/[0.04] rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Notor & SubReds</h1>
            <p className="text-sm text-aifm-charcoal/40">
              Hantera och exportera in- och utflöden för fonder
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
              <RefreshCw className="w-4 h-4" />
              <span>Uppdatera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-aifm-charcoal/[0.04] p-1.5 rounded-full w-fit">
        <button
          onClick={() => setActiveTab('notor')}
          className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
            activeTab === 'notor'
              ? 'bg-white text-aifm-charcoal shadow-sm'
              : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Notor (Gårdagens flöden)
          </span>
        </button>
        <button
          onClick={() => setActiveTab('subred')}
          className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
            activeTab === 'subred'
              ? 'bg-white text-aifm-charcoal shadow-sm'
              : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
          }`}
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            SubRed (Dagens flöden)
          </span>
        </button>
      </div>

      {/* Notor Tab */}
      {activeTab === 'notor' && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50"><ArrowDownRight className="w-4 h-4 text-emerald-500" /></div>
                <span className="text-sm text-aifm-charcoal/40">Totalt inflöde</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-emerald-600">+{formatCurrency(totalYesterdayInflow)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-red-50"><ArrowUpRight className="w-4 h-4 text-red-500" /></div>
                <span className="text-sm text-aifm-charcoal/40">Totalt utflöde</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-red-600">-{formatCurrency(totalYesterdayOutflow)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-aifm-gold/10"><Wallet className="w-4 h-4 text-aifm-gold" /></div>
                <span className="text-sm text-aifm-charcoal/40">Nettoflöde</span>
              </div>
              <p className={`text-xl font-semibold tracking-tight ${totalYesterdayInflow - totalYesterdayOutflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalYesterdayInflow - totalYesterdayOutflow >= 0 ? '+' : ''}{formatCurrency(totalYesterdayInflow - totalYesterdayOutflow)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-aifm-charcoal/[0.06]"><CheckCircle2 className="w-4 h-4 text-aifm-charcoal/60" /></div>
                <span className="text-sm text-aifm-charcoal/40">Transaktioner</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-aifm-charcoal">{mockYesterdayFlows.length}</p>
            </div>
          </div>

          {/* Per-Fund Summary */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Sammanfattning per fond</h2>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportera Excel</span>
                </button>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
                  <Mail className="w-4 h-4" />
                  <span>Skicka till förvaltare</span>
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {yesterdaySummary.map((summary) => (
                <SummaryCard key={summary.fundName} summary={summary} type="yesterday" />
              ))}
            </div>
          </div>

          {/* Detailed Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-aifm-charcoal tracking-tight">Detaljerade transaktioner - {new Date('2025-01-16').toLocaleDateString('sv-SE')}</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
                <input
                  type="text"
                  placeholder="Sök fond eller investerare..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-aifm-charcoal/[0.03]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Fond</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Typ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Belopp</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Andelar</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">NAV</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Investerare</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockYesterdayFlows.map((flow) => (
                    <tr key={flow.id} className="hover:bg-aifm-charcoal/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-aifm-charcoal">{flow.fundName}</p>
                          <p className="text-xs text-aifm-charcoal/50 font-mono">{flow.isin}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <FlowTypeBadge type={flow.type} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${flow.type === 'inflow' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {flow.type === 'inflow' ? '+' : '-'}{formatCurrency(flow.amount, flow.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                        {formatNumber(flow.shares)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                        {formatNumber(flow.navPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-aifm-charcoal/70">
                        {flow.investor}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={flow.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SubRed Tab */}
      {activeTab === 'subred' && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-50"><ArrowDownRight className="w-4 h-4 text-emerald-500" /></div>
                <span className="text-sm text-aifm-charcoal/40">Planerat inflöde</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-emerald-600">+{formatCurrency(totalTodayInflow)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-red-50"><ArrowUpRight className="w-4 h-4 text-red-500" /></div>
                <span className="text-sm text-aifm-charcoal/40">Planerat utflöde</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-red-600">-{formatCurrency(totalTodayOutflow)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-aifm-gold/10"><Wallet className="w-4 h-4 text-aifm-gold" /></div>
                <span className="text-sm text-aifm-charcoal/40">Förväntat netto</span>
              </div>
              <p className={`text-xl font-semibold tracking-tight ${totalTodayInflow - totalTodayOutflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalTodayInflow - totalTodayOutflow >= 0 ? '+' : ''}{formatCurrency(totalTodayInflow - totalTodayOutflow)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-50"><Clock className="w-4 h-4 text-amber-500" /></div>
                <span className="text-sm text-aifm-charcoal/40">Väntande</span>
              </div>
              <p className="text-xl font-semibold tracking-tight text-aifm-charcoal">{mockTodayFlows.filter(f => f.status === 'pending').length}</p>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-aifm-charcoal/[0.03] rounded-xl p-4 border border-gray-100">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-aifm-gold mt-0.5" />
              <div>
                <p className="font-medium text-aifm-charcoal">SubRed för morgondagen</p>
                <p className="text-sm text-aifm-charcoal/40 mt-1">
                  Visar planerade in- och utflöden för {new Date('2025-01-18').toLocaleDateString('sv-SE')}. 
                  Kontoutdrag genereras automatiskt och skickas till förvaltare kl 16:00.
                </p>
              </div>
            </div>
          </div>

          {/* Per-Fund Summary */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Planerade flöden per fond</h2>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportera Excel</span>
                </button>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
                  <Mail className="w-4 h-4" />
                  <span>Skicka SubRed + Kontoutdrag</span>
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySummary.map((summary) => (
                <SummaryCard key={summary.fundName} summary={summary} type="today" />
              ))}
            </div>
          </div>

          {/* Detailed Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-aifm-charcoal tracking-tight">Planerade transaktioner - {new Date('2025-01-17').toLocaleDateString('sv-SE')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-aifm-charcoal/[0.03]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Fond</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Typ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Belopp</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Andelar</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">NAV</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Investerare</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockTodayFlows.map((flow) => (
                    <tr key={flow.id} className="hover:bg-aifm-charcoal/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-aifm-charcoal">{flow.fundName}</p>
                          <p className="text-xs text-aifm-charcoal/50 font-mono">{flow.isin}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <FlowTypeBadge type={flow.type} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${flow.type === 'inflow' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {flow.type === 'inflow' ? '+' : '-'}{formatCurrency(flow.amount, flow.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                        {formatNumber(flow.shares)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                        {formatNumber(flow.navPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-aifm-charcoal/70">
                        {flow.investor}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={flow.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
