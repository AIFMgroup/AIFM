'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar, Download, Filter, Search, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, BarChart3, FileText, Table,
  ArrowLeft, RefreshCw, Loader2, AlertCircle, CheckCircle2,
  Clock, Eye, FileSpreadsheet
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface NAVRecord {
  fundId: string;
  shareClassId: string;
  isin: string;
  fundName: string;
  shareClassName: string;
  currency: string;
  navPerShare: number;
  previousNav?: number;
  navChange: number;
  navChangePercent: number;
  navDate: string;
  netAssetValue: number;
  grossAssets: number;
  totalLiabilities: number;
  sharesOutstanding: number;
  status: 'PRELIMINARY' | 'APPROVED' | 'PUBLISHED';
}

interface DateSummary {
  date: string;
  fundCount: number;
  shareClassCount: number;
  totalAUM: number;
  avgChange: number;
  status: 'PRELIMINARY' | 'APPROVED' | 'PUBLISHED' | 'MIXED';
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatLargeCurrency(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} Mdr`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} Mkr`;
  }
  return formatCurrency(value);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sv-SE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Mock Data Generator
// ============================================================================

function generateMockHistory(startDate: string, days: number): DateSummary[] {
  const history: DateSummary[] = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() - i);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    const avgChange = (Math.random() - 0.5) * 2; // -1% to +1%
    
    history.push({
      date: date.toISOString().split('T')[0],
      fundCount: 4,
      shareClassCount: 8,
      totalAUM: 5700000000 + (Math.random() - 0.5) * 100000000,
      avgChange,
      status: i === 0 ? 'PRELIMINARY' : i < 3 ? 'APPROVED' : 'PUBLISHED',
    });
  }
  
  return history;
}

function generateMockNAVRecords(date: string): NAVRecord[] {
  const baseData = [
    { fundId: 'f1', fundName: 'AUAG Essential Metals', shareClasses: [
      { id: 'sc1a', name: 'A', isin: 'SE0019175563', currency: 'SEK', baseNav: 142 },
      { id: 'sc1b', name: 'B', isin: 'SE0019175571', currency: 'EUR', baseNav: 14.5 },
    ]},
    { fundId: 'f2', fundName: 'AuAg Gold Rush', shareClasses: [
      { id: 'sc2a', name: 'A', isin: 'SE0020677946', currency: 'SEK', baseNav: 208 },
      { id: 'sc2h', name: 'H', isin: 'SE0020678001', currency: 'NOK', baseNav: 197 },
    ]},
    { fundId: 'f3', fundName: 'AuAg Precious Green', shareClasses: [
      { id: 'sc3a', name: 'A', isin: 'SE0014808440', currency: 'SEK', baseNav: 198 },
    ]},
    { fundId: 'f4', fundName: 'AuAg Silver Bullet', shareClasses: [
      { id: 'sc4a', name: 'A', isin: 'SE0013358181', currency: 'SEK', baseNav: 378 },
      { id: 'sc4b', name: 'B', isin: 'SE0013358199', currency: 'EUR', baseNav: 37 },
    ]},
  ];
  
  const records: NAVRecord[] = [];
  const dateObj = new Date(date);
  const daysDiff = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
  
  for (const fund of baseData) {
    for (const sc of fund.shareClasses) {
      // Simulate price variation based on date
      const priceVariation = (Math.sin(daysDiff * 0.1 + fund.fundId.charCodeAt(1)) * 0.05) + 
                            (Math.random() - 0.5) * 0.01;
      const navPerShare = sc.baseNav * (1 + priceVariation);
      const previousNav = navPerShare / (1 + (Math.random() - 0.5) * 0.02);
      const navChange = navPerShare - previousNav;
      const navChangePercent = (navChange / previousNav) * 100;
      
      const netAssetValue = navPerShare * (100000 + Math.random() * 900000);
      
      records.push({
        fundId: fund.fundId,
        shareClassId: sc.id,
        isin: sc.isin,
        fundName: fund.fundName,
        shareClassName: sc.name,
        currency: sc.currency,
        navPerShare,
        previousNav,
        navChange,
        navChangePercent,
        navDate: date,
        netAssetValue,
        grossAssets: netAssetValue * 1.01,
        totalLiabilities: netAssetValue * 0.01,
        sharesOutstanding: netAssetValue / navPerShare,
        status: daysDiff === 0 ? 'PRELIMINARY' : daysDiff < 3 ? 'APPROVED' : 'PUBLISHED',
      });
    }
  }
  
  return records;
}

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config = {
    PRELIMINARY: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Preliminär' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Godkänd' },
    PUBLISHED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Publicerad' },
    MIXED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Blandad' },
  };
  
  const { bg, text, label } = config[status as keyof typeof config] || config.PRELIMINARY;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-emerald-600">
        <TrendingUp className="w-4 h-4" />
        +{change.toFixed(2)}%
      </span>
    );
  } else if (change < 0) {
    return (
      <span className="flex items-center gap-1 text-red-600">
        <TrendingDown className="w-4 h-4" />
        {change.toFixed(2)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-gray-500">
      <Minus className="w-4 h-4" />
      0.00%
    </span>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NAVHistoryPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState<'calendar' | 'table'>('table');
  const [dateHistory, setDateHistory] = useState<DateSummary[]>([]);
  const [navRecords, setNavRecords] = useState<NAVRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFund, setSelectedFund] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Try API first
      const response = await fetch(`/api/nav/funds?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.funds.length > 0) {
          setNavRecords(data.data.funds);
        } else {
          // Fall back to mock
          setNavRecords(generateMockNAVRecords(selectedDate));
        }
      } else {
        setNavRecords(generateMockNAVRecords(selectedDate));
      }
      
      // Generate date history
      setDateHistory(generateMockHistory(selectedDate, 30));
    } catch (error) {
      console.error('Error fetching NAV data:', error);
      setNavRecords(generateMockNAVRecords(selectedDate));
      setDateHistory(generateMockHistory(selectedDate, 30));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter records
  const filteredRecords = navRecords.filter(record => {
    const matchesFund = selectedFund === 'all' || record.fundId === selectedFund;
    const matchesSearch = searchQuery === '' || 
      record.fundName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.isin.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFund && matchesSearch;
  });

  // Get unique funds for filter
  const uniqueFunds = Array.from(new Set(navRecords.map(r => r.fundId)))
    .map(id => {
      const record = navRecords.find(r => r.fundId === id);
      return { id, name: record?.fundName || id };
    });

  // Navigate dates
  const goToPreviousDate = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDate = () => {
    const date = new Date(selectedDate);
    const today = new Date();
    date.setDate(date.getDate() + 1);
    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    // Don't go beyond today
    if (date <= today) {
      setSelectedDate(date.toISOString().split('T')[0]);
    }
  };

  // Export functions
  const exportToExcel = () => {
    // Create CSV content
    const headers = ['ISIN', 'Fond', 'Andelsklass', 'Valuta', 'NAV', 'Förändring %', 'AUM', 'Andelar', 'Status'];
    const rows = filteredRecords.map(r => [
      r.isin,
      r.fundName,
      r.shareClassName,
      r.currency,
      r.navPerShare.toFixed(4),
      r.navChangePercent.toFixed(2),
      r.netAssetValue.toFixed(2),
      r.sharesOutstanding.toFixed(2),
      r.status,
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NAV_${selectedDate}.csv`;
    link.click();
  };

  const exportToPDF = async () => {
    try {
      const response = await fetch('/api/ai/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `NAV-rapport ${selectedDate}`,
          content: filteredRecords.map(r => 
            `${r.fundName} ${r.shareClassName}\nISIN: ${r.isin}\nNAV: ${r.navPerShare.toFixed(4)} ${r.currency}\nFörändring: ${r.navChangePercent.toFixed(2)}%\nAUM: ${formatLargeCurrency(r.netAssetValue)}\n`
          ).join('\n---\n'),
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `NAV_${selectedDate}.pdf`;
        link.click();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Kunde inte generera PDF');
    }
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
            <h1 className="text-2xl font-bold text-aifm-charcoal">NAV-historik</h1>
            <p className="text-aifm-charcoal/60 mt-1">
              Bläddra och exportera historiska NAV-kurser
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-sm font-medium">Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-red-500 hover:text-red-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium">PDF</span>
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Uppdatera</span>
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousDate}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-aifm-gold" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              />
            </div>
            
            <button
              onClick={goToNextDate}
              disabled={selectedDate >= new Date().toISOString().split('T')[0]}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-gray-600 ml-2">
              {formatDate(selectedDate)}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Sök fond eller ISIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold w-64"
              />
            </div>
            
            {/* Fund Filter */}
            <select
              value={selectedFund}
              onChange={(e) => setSelectedFund(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            >
              <option value="all">Alla fonder</option>
              {uniqueFunds.map(fund => (
                <option key={fund.id} value={fund.id}>{fund.name}</option>
              ))}
            </select>
            
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setView('table')}
                className={`p-2 rounded-md transition-colors ${view === 'table' ? 'bg-white shadow-sm' : ''}`}
              >
                <Table className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`p-2 rounded-md transition-colors ${view === 'calendar' ? 'bg-white shadow-sm' : ''}`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Date Selection */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dateHistory.slice(0, 10).map((day) => (
          <button
            key={day.date}
            onClick={() => setSelectedDate(day.date)}
            className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all ${
              day.date === selectedDate
                ? 'bg-aifm-gold text-white border-aifm-gold'
                : 'bg-white border-gray-200 hover:border-aifm-gold/50'
            }`}
          >
            <div className="text-xs font-medium">
              {new Date(day.date).toLocaleDateString('sv-SE', { weekday: 'short' })}
            </div>
            <div className="text-lg font-bold">
              {new Date(day.date).getDate()}
            </div>
            <div className={`text-xs ${day.date === selectedDate ? 'text-white/80' : ''}`}>
              <ChangeIndicator change={day.avgChange} />
            </div>
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm text-gray-600">Totalt AUM</div>
          <div className="text-2xl font-bold text-aifm-charcoal mt-1">
            {formatLargeCurrency(filteredRecords.reduce((sum, r) => sum + r.netAssetValue, 0))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm text-gray-600">Andelsklasser</div>
          <div className="text-2xl font-bold text-aifm-charcoal mt-1">
            {filteredRecords.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm text-gray-600">Genomsnittlig förändring</div>
          <div className="text-2xl font-bold mt-1">
            <ChangeIndicator 
              change={filteredRecords.reduce((sum, r) => sum + r.navChangePercent, 0) / filteredRecords.length || 0} 
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-sm text-gray-600">Status</div>
          <div className="mt-2">
            <StatusBadge status={filteredRecords[0]?.status || 'PRELIMINARY'} />
          </div>
        </div>
      </div>

      {/* NAV Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-aifm-charcoal">NAV-kurser för {formatDate(selectedDate)}</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-aifm-gold mx-auto mb-3" />
            <p className="text-sm text-gray-600">Laddar NAV-data...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600">Inga NAV-kurser hittades för valt datum</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ISIN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fond</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Valuta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">NAV</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Förändring</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">AUM</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Andelar</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecords.map((record) => (
                  <tr key={`${record.isin}-${record.navDate}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-700">{record.isin}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-aifm-charcoal">{record.fundName}</span>
                        <span className="ml-1 text-xs text-gray-500">{record.shareClassName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {record.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-aifm-charcoal">
                        {formatCurrency(record.navPerShare, 4)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChangeIndicator change={record.navChangePercent} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {formatLargeCurrency(record.netAssetValue)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {formatCurrency(record.sharesOutstanding, 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Visa detaljer"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical Trend (placeholder) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-aifm-charcoal mb-4">NAV-utveckling senaste 30 dagarna</h2>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl">
          <div className="text-center text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Graf kommer här</p>
            <p className="text-xs text-gray-400">(Kräver chartbibliotek)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
