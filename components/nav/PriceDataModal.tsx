'use client';

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import {
  X, Database, FileSpreadsheet, Edit3, Cloud, Globe, Upload,
  Plus, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle,
  Download, Send, Calendar, Clock, TrendingUp, Search, Filter,
  ChevronDown, ExternalLink, Settings, History, BarChart3,
  Loader2, Check, Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type PriceDataSource = 'mock' | 'csv' | 'manual' | 'fund_registry' | 'lseg';

interface PriceDataRecord {
  fundId: string;
  fundName: string;
  isin: string;
  date: string;
  nav: number;
  navChange?: number;
  previousNav?: number;
  aum: number;
  outstandingShares: number;
  currency: string;
  source: PriceDataSource;
  lastUpdated: string;
}

interface ProviderStatus {
  available: boolean;
  lastCheck: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface PriceDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'overview' | 'sources' | 'import' | 'manual' | 'history' | 'settings';

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

// ============================================================================
// Sub-Components
// ============================================================================

function SourceBadge({ source, size = 'sm' }: { source: PriceDataSource; size?: 'sm' | 'lg' }) {
  const config: Record<PriceDataSource, { label: string; color: string; icon: React.ElementType }> = {
    mock: { label: 'Test', color: 'bg-gray-100 text-gray-600', icon: Database },
    csv: { label: 'CSV', color: 'bg-blue-50 text-blue-600', icon: FileSpreadsheet },
    manual: { label: 'Manuell', color: 'bg-amber-50 text-amber-600', icon: Edit3 },
    fund_registry: { label: 'Fondregister', color: 'bg-emerald-50 text-emerald-600', icon: Database },
    lseg: { label: 'LSEG', color: 'bg-purple-50 text-purple-600', icon: Globe },
  };

  const { label, color, icon: Icon } = config[source];
  const sizeClasses = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded font-medium ${color} ${sizeClasses}`}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {label}
    </span>
  );
}

function TabButton({ 
  id, 
  label, 
  icon: Icon, 
  isActive, 
  onClick,
  badge
}: { 
  id: TabId; 
  label: string; 
  icon: React.ElementType; 
  isActive: boolean; 
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        isActive 
          ? 'border-aifm-gold text-aifm-gold' 
          : 'border-transparent text-aifm-charcoal/60 hover:text-aifm-charcoal hover:border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge !== undefined && (
        <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
          isActive ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-100 text-gray-600'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  trend,
  color = 'gray'
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType; 
  trend?: { value: number; label: string };
  color?: 'gold' | 'green' | 'blue' | 'purple' | 'gray';
}) {
  const colors = {
    gold: 'bg-aifm-gold/10 text-aifm-gold',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(2)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-aifm-charcoal">{value}</p>
      <p className="text-xs text-aifm-charcoal/60 mt-0.5">{label}</p>
      {subValue && <p className="text-xs text-aifm-charcoal/40">{subValue}</p>}
    </div>
  );
}

// ============================================================================
// Tab Content Components
// ============================================================================

function OverviewTab({ 
  priceData, 
  activeSource, 
  isLoading,
  onRefresh,
  selectedDate,
  onDateChange
}: { 
  priceData: PriceDataRecord[]; 
  activeSource: PriceDataSource;
  isLoading: boolean;
  onRefresh: () => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  const filteredData = priceData.filter(record =>
    record.fundName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.isin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAUM = priceData.reduce((sum, record) => sum + record.aum, 0);
  const avgChange = priceData.length > 0 
    ? priceData.reduce((sum, r) => sum + (r.navChange || 0), 0) / priceData.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Totalt AUM"
          value={formatLargeCurrency(totalAUM)}
          icon={TrendingUp}
          color="gold"
        />
        <StatCard
          label="Andelsklasser"
          value={priceData.length.toString()}
          subValue={`${new Set(priceData.map(p => p.fundName.split(' ').slice(0, -1).join(' '))).size} fonder`}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          label="Aktiv källa"
          value={activeSource.toUpperCase()}
          icon={Database}
          color="purple"
        />
        <StatCard
          label="Snittförändring"
          value={`${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`}
          icon={TrendingUp}
          color={avgChange >= 0 ? 'green' : 'gray'}
          trend={{ value: avgChange, label: 'idag' }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Sök fond eller ISIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-64 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-sm">
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 text-sm font-medium">
            <Send className="w-4 h-4" />
            Skicka rapport
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-aifm-charcoal/60">Ingen prisdata hittades</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase">ISIN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase">Fond</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase">Valuta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">NAV</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">Förändring</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">AUM</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase">Källa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((record) => (
                  <tr key={record.isin} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-aifm-charcoal/70">{record.isin}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-aifm-charcoal">{record.fundName}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-aifm-charcoal/70">
                        {record.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-aifm-charcoal">
                      {formatCurrency(record.nav)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.navChange !== undefined && (
                        <span className={`font-medium ${record.navChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {record.navChange >= 0 ? '+' : ''}{record.navChange.toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                      {formatLargeCurrency(record.aum)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SourceBadge source={record.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SourcesTab({ 
  activeSource, 
  providerStatuses, 
  onChangeSource 
}: { 
  activeSource: PriceDataSource; 
  providerStatuses: Record<PriceDataSource, ProviderStatus>;
  onChangeSource: (source: PriceDataSource) => void;
}) {
  const sources: Array<{
    source: PriceDataSource;
    name: string;
    description: string;
    icon: React.ElementType;
    color: string;
    details: string;
  }> = [
    {
      source: 'fund_registry',
      name: 'Fondregister',
      description: 'Internt fondregister med NAV-data',
      icon: Database,
      color: 'from-emerald-500 to-emerald-600',
      details: 'Använder det interna fondregistret. Rekommenderad källa för produktion.',
    },
    {
      source: 'csv',
      name: 'CSV Import',
      description: 'Importera prisdata från Excel/CSV-fil',
      icon: FileSpreadsheet,
      color: 'from-blue-500 to-blue-600',
      details: 'Ladda upp en CSV-fil med ISIN och NAV-kurser. Stödjer svenska kolumnnamn.',
    },
    {
      source: 'manual',
      name: 'Manuell inmatning',
      description: 'Mata in NAV-kurser direkt i systemet',
      icon: Edit3,
      color: 'from-amber-500 to-amber-600',
      details: 'Lägg till eller uppdatera priser manuellt. Bra för enstaka korrigeringar.',
    },
    {
      source: 'mock',
      name: 'Test/Mock',
      description: 'Testdata för utveckling och demo',
      icon: Database,
      color: 'from-gray-500 to-gray-600',
      details: 'Använder fördefinierad testdata. Perfekt för utveckling och demonstration.',
    },
    {
      source: 'lseg',
      name: 'LSEG/Refinitiv',
      description: 'Realtidspriser från LSEG Data Platform',
      icon: Globe,
      color: 'from-purple-500 to-purple-600',
      details: 'Professionell prisdata i realtid. Kräver LSEG-licens och API-credentials.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-aifm-charcoal">Välj priskälla</h3>
          <p className="text-sm text-aifm-charcoal/60">Bestäm varifrån NAV-data ska hämtas</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-aifm-charcoal/60">Aktiv källa:</span>
          <SourceBadge source={activeSource} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map(({ source, name, description, icon: Icon, color, details }) => {
          const status = providerStatuses[source];
          const isActive = activeSource === source;
          
          return (
            <button
              key={source}
              onClick={() => onChangeSource(source)}
              className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                isActive 
                  ? 'border-aifm-gold bg-aifm-gold/5 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {isActive && (
                <div className="absolute top-3 right-3">
                  <div className="p-1 bg-aifm-gold rounded-full">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-aifm-charcoal">{name}</h4>
                  <p className="text-sm text-aifm-charcoal/60 mt-0.5">{description}</p>
                  <p className="text-xs text-aifm-charcoal/50 mt-2">{details}</p>
                  
                  <div className="mt-3 flex items-center gap-3">
                    {status?.available ? (
                      <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tillgänglig
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Ej konfigurerad
                      </span>
                    )}
                    
                    {status?.message && (
                      <span className="text-xs text-aifm-charcoal/40 truncate">
                        {status.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* LSEG Info Box */}
      {activeSource === 'lseg' && !providerStatuses.lseg?.available && (
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-purple-900">LSEG-licens krävs</h4>
              <p className="text-sm text-purple-700 mt-1">
                LSEG Data Platform kräver ett aktivt licensavtal. Kontakta din LSEG-representant 
                för att få API-credentials. Under tiden kan du använda CSV eller manuell inmatning.
              </p>
              <a 
                href="https://developers.lseg.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-purple-600 hover:underline mt-2"
              >
                LSEG Developer Portal
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportTab({ onImport }: { onImport: (data: any[]) => Promise<void> }) {
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,;\t]/).map(v => v.trim());
      if (values.length < headers.length) continue;

      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        if (h.includes('isin')) row.isin = values[idx];
        else if (h.includes('nav') || h.includes('kurs')) row.nav = parseFloat(values[idx].replace(',', '.'));
        else if (h.includes('namn') || h.includes('name')) row.fundName = values[idx];
        else if (h.includes('datum') || h.includes('date')) row.date = values[idx];
        else if (h.includes('aum')) row.aum = parseFloat(values[idx].replace(',', '.'));
        else if (h.includes('valuta') || h.includes('currency')) row.currency = values[idx];
      });

      if (row.isin && row.nav) data.push(row);
    }

    return data;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const data = parseCSV(csvText);
    if (data.length === 0) {
      setResult({ imported: 0, errors: ['Ingen giltig data hittades i CSV-filen'] });
      return;
    }

    setIsImporting(true);
    try {
      await onImport(data);
      setResult({ imported: data.length, errors: [] });
      setCsvText('');
    } catch (error) {
      setResult({ imported: 0, errors: [error instanceof Error ? error.message : 'Import misslyckades'] });
    }
    setIsImporting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-aifm-charcoal">Importera från CSV</h3>
        <p className="text-sm text-aifm-charcoal/60">Ladda upp en CSV-fil med prisdata</p>
      </div>

      {/* File Upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-aifm-gold transition-colors text-center group"
        >
          <Upload className="w-10 h-10 text-gray-400 group-hover:text-aifm-gold mx-auto mb-3 transition-colors" />
          <p className="text-sm text-aifm-charcoal/70">Klicka för att välja fil eller dra och släpp</p>
          <p className="text-xs text-aifm-charcoal/50 mt-1">CSV, TXT (semikolon eller komma-separerad)</p>
        </button>
      </div>

      {/* CSV Preview/Edit */}
      <div>
        <label className="block text-sm font-medium text-aifm-charcoal mb-2">
          CSV-innehåll (redigera vid behov)
        </label>
        <textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setResult(null); }}
          placeholder="ISIN;Fondnamn;NAV;Datum;Valuta&#10;SE0019175563;AUAG Essential Metals A;142.42;2025-01-17;SEK"
          className="w-full h-48 px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-aifm-gold resize-none"
        />
      </div>

      {/* Format Help */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-aifm-charcoal mb-2">Obligatoriska kolumner</h4>
          <ul className="text-xs text-aifm-charcoal/70 space-y-1">
            <li className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded">ISIN</code>
              Fondens ISIN-kod
            </li>
            <li className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded">NAV</code>
              NAV-kurs (decimal)
            </li>
          </ul>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-aifm-charcoal mb-2">Valfria kolumner</h4>
          <ul className="text-xs text-aifm-charcoal/70 space-y-1">
            <li className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded">Fondnamn</code>
              Fondens namn
            </li>
            <li className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded">Datum</code>
              YYYY-MM-DD
            </li>
            <li className="flex items-center gap-2">
              <code className="bg-white px-1.5 py-0.5 rounded">Valuta</code>
              SEK, EUR, etc.
            </li>
          </ul>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-xl ${
          result.errors.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {result.errors.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            )}
            <span className={result.errors.length > 0 ? 'text-red-700' : 'text-emerald-700'}>
              {result.errors.length > 0 
                ? result.errors[0] 
                : `Importerade ${result.imported} priser`}
            </span>
          </div>
        </div>
      )}

      {/* Import Button */}
      <div className="flex justify-end">
        <button
          onClick={handleImport}
          disabled={!csvText.trim() || isImporting}
          className="flex items-center gap-2 px-6 py-2.5 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 disabled:opacity-50 font-medium"
        >
          {isImporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Importera
        </button>
      </div>
    </div>
  );
}

function ManualTab({ 
  existingFunds, 
  onSave 
}: { 
  existingFunds: PriceDataRecord[];
  onSave: (data: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    fundId: '',
    fundName: '',
    isin: '',
    date: new Date().toISOString().split('T')[0],
    nav: '',
    aum: '',
    outstandingShares: '',
    currency: 'SEK',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFundSelect = (fundId: string) => {
    const fund = existingFunds.find(f => f.fundId === fundId);
    if (fund) {
      setFormData(prev => ({
        ...prev,
        fundId: fund.fundId,
        fundName: fund.fundName,
        isin: fund.isin,
        currency: fund.currency,
        aum: fund.aum.toString(),
        outstandingShares: fund.outstandingShares.toString(),
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.isin || !formData.nav) return;
    
    setIsSaving(true);
    try {
      await onSave({
        fundId: formData.fundId || formData.isin,
        fundName: formData.fundName || `Fund ${formData.isin}`,
        isin: formData.isin,
        date: formData.date,
        nav: parseFloat(formData.nav),
        aum: formData.aum ? parseFloat(formData.aum) : undefined,
        outstandingShares: formData.outstandingShares ? parseFloat(formData.outstandingShares) : undefined,
        currency: formData.currency,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        nav: '',
      }));
    } catch (error) {
      console.error(error);
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-aifm-charcoal">Manuell prisinmatning</h3>
        <p className="text-sm text-aifm-charcoal/60">Mata in eller uppdatera NAV-kurser manuellt</p>
      </div>

      {/* Quick Select */}
      {existingFunds.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-2">
            Välj befintlig fond för snabbval
          </label>
          <select
            value={formData.fundId}
            onChange={(e) => handleFundSelect(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          >
            <option value="">-- Välj fond --</option>
            {existingFunds.map(f => (
              <option key={f.fundId} value={f.fundId}>
                {f.fundName} ({f.isin})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Form Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-aifm-charcoal mb-1">ISIN *</label>
          <input
            type="text"
            value={formData.isin}
            onChange={(e) => setFormData(prev => ({ ...prev, isin: e.target.value }))}
            placeholder="SE0019175563"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          />
        </div>
        
        <div className="col-span-2">
          <label className="block text-sm font-medium text-aifm-charcoal mb-1">Fondnamn</label>
          <input
            type="text"
            value={formData.fundName}
            onChange={(e) => setFormData(prev => ({ ...prev, fundName: e.target.value }))}
            placeholder="AUAG Essential Metals A"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-1">NAV-kurs *</label>
          <input
            type="number"
            step="0.01"
            value={formData.nav}
            onChange={(e) => setFormData(prev => ({ ...prev, nav: e.target.value }))}
            placeholder="142.42"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-1">Datum</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-1">Valuta</label>
          <select
            value={formData.currency}
            onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          >
            <option value="SEK">SEK</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="NOK">NOK</option>
            <option value="CHF">CHF</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-aifm-charcoal mb-1">AUM</label>
          <input
            type="number"
            step="0.01"
            value={formData.aum}
            onChange={(e) => setFormData(prev => ({ ...prev, aum: e.target.value }))}
            placeholder="395584099.11"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
          />
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-emerald-700">Pris sparat!</span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!formData.isin || !formData.nav || isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 disabled:opacity-50 font-medium"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Spara pris
        </button>
      </div>
    </div>
  );
}

function HistoryTab({ priceData }: { priceData: PriceDataRecord[] }) {
  // Mock history data
  const historyData = [
    { date: '2025-01-17', count: 14, source: 'mock' as PriceDataSource, status: 'completed' },
    { date: '2025-01-16', count: 14, source: 'csv' as PriceDataSource, status: 'completed' },
    { date: '2025-01-15', count: 14, source: 'csv' as PriceDataSource, status: 'completed' },
    { date: '2025-01-14', count: 14, source: 'manual' as PriceDataSource, status: 'completed' },
    { date: '2025-01-13', count: 12, source: 'csv' as PriceDataSource, status: 'partial' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-aifm-charcoal">Prisdata-historik</h3>
        <p className="text-sm text-aifm-charcoal/60">Senaste importeringar och uppdateringar</p>
      </div>

      <div className="space-y-3">
        {historyData.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-aifm-charcoal">{entry.date}</p>
                <p className="text-sm text-aifm-charcoal/60">{entry.count} andelsklasser</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SourceBadge source={entry.source} />
              <span className={`text-xs px-2 py-1 rounded-full ${
                entry.status === 'completed' 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : 'bg-amber-50 text-amber-600'
              }`}>
                {entry.status === 'completed' ? 'Komplett' : 'Delvis'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-aifm-charcoal">Inställningar</h3>
        <p className="text-sm text-aifm-charcoal/60">Konfigurera prisdatafunktioner</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-white border border-gray-100 rounded-xl">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-aifm-charcoal">Automatisk import</p>
              <p className="text-sm text-aifm-charcoal/60">Hämta prisdata automatiskt varje morgon</p>
            </div>
            <input type="checkbox" className="w-5 h-5 rounded text-aifm-gold" />
          </label>
        </div>

        <div className="p-4 bg-white border border-gray-100 rounded-xl">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-aifm-charcoal">Notifieringar</p>
              <p className="text-sm text-aifm-charcoal/60">Få avisering vid avvikelser eller fel</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-aifm-gold" />
          </label>
        </div>

        <div className="p-4 bg-white border border-gray-100 rounded-xl">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-medium text-aifm-charcoal">Historik-lagring</p>
              <p className="text-sm text-aifm-charcoal/60">Spara alla prisändringar för revision</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 rounded text-aifm-gold" />
          </label>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function PriceDataModal({ isOpen, onClose }: PriceDataModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [priceData, setPriceData] = useState<PriceDataRecord[]>([]);
  const [activeSource, setActiveSource] = useState<PriceDataSource>('mock');
  const [providerStatuses, setProviderStatuses] = useState<Record<PriceDataSource, ProviderStatus>>({} as any);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, dataRes] = await Promise.all([
        fetch('/api/nav/price-data?action=status'),
        fetch(`/api/nav/price-data?date=${selectedDate}`),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setActiveSource(statusData.activeSource);
        setProviderStatuses(statusData.statuses);
      }

      if (dataRes.ok) {
        const priceDataResult = await dataRes.json();
        setPriceData(priceDataResult.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Handlers
  const handleSourceChange = async (source: PriceDataSource) => {
    try {
      const response = await fetch('/api/nav/price-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-source', source }),
      });
      
      if (response.ok) {
        setActiveSource(source);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to change source:', error);
    }
  };

  const handleCSVImport = async (data: any[]) => {
    const response = await fetch('/api/nav/price-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'import-csv', data }),
    });
    
    if (response.ok) {
      await handleSourceChange('csv');
      setActiveTab('overview');
    }
  };

  const handleManualSave = async (data: any) => {
    const response = await fetch('/api/nav/price-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-manual', ...data }),
    });
    
    if (response.ok && activeSource !== 'manual') {
      await handleSourceChange('manual');
    }
    fetchData();
  };

  if (!isOpen) return null;

  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType; badge?: number }> = [
    { id: 'overview', label: 'Översikt', icon: BarChart3, badge: priceData.length },
    { id: 'sources', label: 'Priskällor', icon: Database },
    { id: 'import', label: 'CSV Import', icon: Upload },
    { id: 'manual', label: 'Manuell', icon: Edit3 },
    { id: 'history', label: 'Historik', icon: History },
    { id: 'settings', label: 'Inställningar', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-aifm-gold/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aifm-charcoal">Prisdata & NAV-hantering</h2>
              <p className="text-sm text-aifm-charcoal/60">Hantera priskällor, importera data och skicka rapporter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-aifm-charcoal/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 bg-white border-b border-gray-200 flex overflow-x-auto flex-shrink-0">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              id={tab.id}
              label={tab.label}
              icon={tab.icon}
              isActive={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              badge={tab.badge}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              priceData={priceData}
              activeSource={activeSource}
              isLoading={isLoading}
              onRefresh={fetchData}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          )}
          {activeTab === 'sources' && (
            <SourcesTab
              activeSource={activeSource}
              providerStatuses={providerStatuses}
              onChangeSource={handleSourceChange}
            />
          )}
          {activeTab === 'import' && (
            <ImportTab onImport={handleCSVImport} />
          )}
          {activeTab === 'manual' && (
            <ManualTab
              existingFunds={priceData}
              onSave={handleManualSave}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab priceData={priceData} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab />
          )}
        </div>
      </div>
    </div>
  );
}

export default PriceDataModal;
