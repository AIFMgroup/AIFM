'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, Search, Filter, Download, ArrowLeft, Building2, User,
  TrendingUp, Calendar, ChevronDown, ChevronRight, Eye,
  PieChart, BarChart3, Globe, Briefcase, FileSpreadsheet,
  RefreshCw, Loader2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Shareholder {
  id: string;
  name: string;
  type: 'INDIVIDUAL' | 'INSTITUTIONAL' | 'FUND' | 'NOMINEE';
  country: string;
  holdings: {
    fundId: string;
    fundName: string;
    shareClassId: string;
    shareClassName: string;
    isin: string;
    shares: number;
    sharesPercent: number;
    marketValue: number;
    currency: string;
    averageCost?: number;
  }[];
  totalValue: number;
  firstInvestmentDate?: string;
  lastTransactionDate?: string;
}

interface FundSummary {
  fundId: string;
  fundName: string;
  totalShares: number;
  totalValue: number;
  shareholderCount: number;
  topHolders: { name: string; percent: number }[];
}

// ============================================================================
// Mock Data
// ============================================================================

const mockShareholders: Shareholder[] = [
  {
    id: 'sh1',
    name: 'Avanza Pension',
    type: 'NOMINEE',
    country: 'SE',
    holdings: [
      { fundId: 'f1', fundName: 'AUAG Essential Metals', shareClassId: 'sc1a', shareClassName: 'A', isin: 'SE0019175563', shares: 450000, sharesPercent: 18.3, marketValue: 64089000, currency: 'SEK' },
      { fundId: 'f2', fundName: 'AuAg Gold Rush', shareClassId: 'sc2a', shareClassName: 'A', isin: 'SE0020677946', shares: 320000, sharesPercent: 13.2, marketValue: 66787200, currency: 'SEK' },
      { fundId: 'f4', fundName: 'AuAg Silver Bullet', shareClassId: 'sc4a', shareClassName: 'A', isin: 'SE0013358181', shares: 1200000, sharesPercent: 13.4, marketValue: 453996000, currency: 'SEK' },
    ],
    totalValue: 584872200,
    firstInvestmentDate: '2021-03-15',
    lastTransactionDate: '2026-01-28',
  },
  {
    id: 'sh2',
    name: 'Nordnet Pensionsförsäkring',
    type: 'NOMINEE',
    country: 'SE',
    holdings: [
      { fundId: 'f1', fundName: 'AUAG Essential Metals', shareClassId: 'sc1a', shareClassName: 'A', isin: 'SE0019175563', shares: 280000, sharesPercent: 11.4, marketValue: 39877600, currency: 'SEK' },
      { fundId: 'f3', fundName: 'AuAg Precious Green', shareClassId: 'sc3a', shareClassName: 'A', isin: 'SE0014808440', shares: 180000, sharesPercent: 10.9, marketValue: 35796600, currency: 'SEK' },
      { fundId: 'f4', fundName: 'AuAg Silver Bullet', shareClassId: 'sc4a', shareClassName: 'A', isin: 'SE0013358181', shares: 850000, sharesPercent: 9.5, marketValue: 321580500, currency: 'SEK' },
    ],
    totalValue: 397254700,
    firstInvestmentDate: '2020-11-20',
    lastTransactionDate: '2026-01-29',
  },
  {
    id: 'sh3',
    name: 'SEB Life International',
    type: 'INSTITUTIONAL',
    country: 'IE',
    holdings: [
      { fundId: 'f2', fundName: 'AuAg Gold Rush', shareClassId: 'sc2a', shareClassName: 'A', isin: 'SE0020677946', shares: 180000, sharesPercent: 7.4, marketValue: 37567800, currency: 'SEK' },
      { fundId: 'f4', fundName: 'AuAg Silver Bullet', shareClassId: 'sc4b', shareClassName: 'B', isin: 'SE0013358199', shares: 420000, sharesPercent: 18.5, marketValue: 15636600, currency: 'EUR' },
    ],
    totalValue: 53204400,
    firstInvestmentDate: '2022-06-01',
    lastTransactionDate: '2026-01-15',
  },
  {
    id: 'sh4',
    name: 'Clearstream Banking S.A.',
    type: 'NOMINEE',
    country: 'LU',
    holdings: [
      { fundId: 'f1', fundName: 'AUAG Essential Metals', shareClassId: 'sc1b', shareClassName: 'B', isin: 'SE0019175571', shares: 150000, sharesPercent: 55.7, marketValue: 2197500, currency: 'EUR' },
      { fundId: 'f2', fundName: 'AuAg Gold Rush', shareClassId: 'sc2h', shareClassName: 'H', isin: 'SE0020678001', shares: 200000, sharesPercent: 41.0, marketValue: 39446000, currency: 'NOK' },
    ],
    totalValue: 41643500,
    firstInvestmentDate: '2023-01-10',
    lastTransactionDate: '2026-01-20',
  },
  {
    id: 'sh5',
    name: 'Svenska Handelsbanken AB',
    type: 'INSTITUTIONAL',
    country: 'SE',
    holdings: [
      { fundId: 'f4', fundName: 'AuAg Silver Bullet', shareClassId: 'sc4a', shareClassName: 'A', isin: 'SE0013358181', shares: 500000, sharesPercent: 5.6, marketValue: 189165000, currency: 'SEK' },
    ],
    totalValue: 189165000,
    firstInvestmentDate: '2021-09-01',
    lastTransactionDate: '2025-12-15',
  },
  {
    id: 'sh6',
    name: 'Erik Andersson',
    type: 'INDIVIDUAL',
    country: 'SE',
    holdings: [
      { fundId: 'f3', fundName: 'AuAg Precious Green', shareClassId: 'sc3a', shareClassName: 'A', isin: 'SE0014808440', shares: 5000, sharesPercent: 0.3, marketValue: 994350, currency: 'SEK' },
    ],
    totalValue: 994350,
    firstInvestmentDate: '2024-03-15',
    lastTransactionDate: '2024-03-15',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getTypeIcon(type: Shareholder['type']) {
  switch (type) {
    case 'INDIVIDUAL': return User;
    case 'INSTITUTIONAL': return Building2;
    case 'FUND': return PieChart;
    case 'NOMINEE': return Briefcase;
    default: return Users;
  }
}

function getTypeLabel(type: Shareholder['type']): string {
  switch (type) {
    case 'INDIVIDUAL': return 'Privatperson';
    case 'INSTITUTIONAL': return 'Institution';
    case 'FUND': return 'Fond';
    case 'NOMINEE': return 'Förvaltare';
    default: return type;
  }
}

function getCountryFlag(countryCode: string): string {
  // Convert country code to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// ============================================================================
// Components
// ============================================================================

function ShareholderRow({ 
  shareholder, 
  isExpanded, 
  onToggle 
}: { 
  shareholder: Shareholder;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const TypeIcon = getTypeIcon(shareholder.type);

  return (
    <>
      <tr 
        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <button className="p-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              shareholder.type === 'NOMINEE' ? 'bg-purple-100 text-purple-600' :
              shareholder.type === 'INSTITUTIONAL' ? 'bg-blue-100 text-blue-600' :
              shareholder.type === 'FUND' ? 'bg-emerald-100 text-emerald-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-medium text-aifm-charcoal">{shareholder.name}</div>
              <div className="text-xs text-gray-500">{getTypeLabel(shareholder.type)}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="flex items-center gap-1.5">
            <span className="text-lg">{getCountryFlag(shareholder.country)}</span>
            <span className="text-sm text-gray-600">{shareholder.country}</span>
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
            {shareholder.holdings.length}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-aifm-charcoal">
          {formatCurrency(shareholder.totalValue)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-600">
          {shareholder.lastTransactionDate || '-'}
        </td>
        <td className="px-4 py-3 text-center">
          <button 
            onClick={(e) => { e.stopPropagation(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </button>
        </td>
      </tr>
      
      {/* Expanded Holdings */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="px-4 py-0">
            <div className="ml-12 mb-4 bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Innehav</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="text-left py-2">Fond</th>
                    <th className="text-left py-2">ISIN</th>
                    <th className="text-right py-2">Andelar</th>
                    <th className="text-right py-2">Andel %</th>
                    <th className="text-right py-2">Värde</th>
                  </tr>
                </thead>
                <tbody>
                  {shareholder.holdings.map((holding, idx) => (
                    <tr key={idx} className="border-t border-gray-200">
                      <td className="py-2">
                        {holding.fundName} <span className="text-gray-400">{holding.shareClassName}</span>
                      </td>
                      <td className="py-2 font-mono text-gray-600">{holding.isin}</td>
                      <td className="py-2 text-right">{formatNumber(holding.shares)}</td>
                      <td className="py-2 text-right">{formatPercent(holding.sharesPercent)}</td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(holding.marketValue, holding.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ShareholdersPage() {
  const [shareholders, setShareholders] = useState<Shareholder[]>(mockShareholders);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [fundFilter, setFundFilter] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Get unique funds
  const uniqueFunds = Array.from(
    new Set(shareholders.flatMap(s => s.holdings.map(h => h.fundId)))
  ).map(fundId => {
    const holding = shareholders.flatMap(s => s.holdings).find(h => h.fundId === fundId);
    return { id: fundId, name: holding?.fundName || fundId };
  });

  // Filter shareholders
  const filteredShareholders = shareholders.filter(sh => {
    const matchesSearch = searchQuery === '' || 
      sh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sh.holdings.some(h => h.isin.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === 'all' || sh.type === typeFilter;
    
    const matchesFund = fundFilter === 'all' || sh.holdings.some(h => h.fundId === fundFilter);
    
    return matchesSearch && matchesType && matchesFund;
  });

  // Calculate totals
  const totalValue = filteredShareholders.reduce((sum, sh) => sum + sh.totalValue, 0);
  const totalShareholders = filteredShareholders.length;

  // Toggle expanded
  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  // Export to Excel
  const exportToExcel = () => {
    const headers = ['Namn', 'Typ', 'Land', 'Fond', 'ISIN', 'Andelar', 'Andel %', 'Värde', 'Valuta'];
    const rows: string[][] = [];
    
    filteredShareholders.forEach(sh => {
      sh.holdings.forEach(h => {
        rows.push([
          sh.name,
          getTypeLabel(sh.type),
          sh.country,
          `${h.fundName} ${h.shareClassName}`,
          h.isin,
          h.shares.toString(),
          h.sharesPercent.toFixed(2),
          h.marketValue.toString(),
          h.currency,
        ]);
      });
    });

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `andelsagare_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/nav-admin"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Andelsägare</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Översikt över fondernas andelsägare
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-sm font-medium">Exportera</span>
          </button>
          <button
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="text-sm font-medium">Uppdatera</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm">Andelsägare</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">{totalShareholders}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Totalt värde</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">{formatCurrency(totalValue)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Building2 className="w-4 h-4" />
            <span className="text-sm">Institutioner</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">
            {filteredShareholders.filter(s => s.type === 'INSTITUTIONAL').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <Globe className="w-4 h-4" />
            <span className="text-sm">Länder</span>
          </div>
          <div className="text-2xl font-bold text-aifm-charcoal">
            {new Set(filteredShareholders.map(s => s.country)).size}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök namn eller ISIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          >
            <option value="all">Alla typer</option>
            <option value="NOMINEE">Förvaltare</option>
            <option value="INSTITUTIONAL">Institution</option>
            <option value="FUND">Fond</option>
            <option value="INDIVIDUAL">Privatperson</option>
          </select>

          {/* Fund Filter */}
          <select
            value={fundFilter}
            onChange={(e) => setFundFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          >
            <option value="all">Alla fonder</option>
            {uniqueFunds.map(fund => (
              <option key={fund.id} value={fund.id}>{fund.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Shareholders Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="w-12 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Namn</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Land</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Innehav</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Värde</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Senaste</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Åtgärd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredShareholders.map(shareholder => (
                <ShareholderRow
                  key={shareholder.id}
                  shareholder={shareholder}
                  isExpanded={expandedIds.has(shareholder.id)}
                  onToggle={() => toggleExpanded(shareholder.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {filteredShareholders.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Inga andelsägare matchar filtret
          </div>
        )}
      </div>
    </div>
  );
}
