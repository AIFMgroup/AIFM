'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Send, Download, CheckCircle2, Clock, Building2,
  Globe, Upload, RefreshCw, ExternalLink, FileSpreadsheet,
  Calendar, AlertCircle, Settings, Eye, Database, Cloud,
  FileText, Edit3, X, Plus, Loader2, Check, AlertTriangle
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

interface Institution {
  id: string;
  name: string;
  type: 'bank' | 'exchange' | 'data_provider' | 'website';
  format: 'excel' | 'csv' | 'api' | 'manual';
  lastSent?: string;
  status: 'sent' | 'pending' | 'error';
  autoSend: boolean;
}

// ============================================================================
// Mock Data for Institutions
// ============================================================================

const mockInstitutions: Institution[] = [
  { id: '1', name: 'Nordea Markets', type: 'bank', format: 'excel', lastSent: '2025-01-17 09:15', status: 'sent', autoSend: true },
  { id: '2', name: 'SEB Prime', type: 'bank', format: 'excel', lastSent: '2025-01-17 09:15', status: 'sent', autoSend: true },
  { id: '3', name: 'Avanza', type: 'bank', format: 'api', lastSent: '2025-01-17 09:00', status: 'sent', autoSend: true },
  { id: '4', name: 'Morningstar', type: 'data_provider', format: 'csv', lastSent: '2025-01-17 09:30', status: 'sent', autoSend: true },
  { id: '5', name: 'Bloomberg', type: 'data_provider', format: 'api', status: 'pending', autoSend: false },
  { id: '6', name: 'Fondbolagens Förening', type: 'data_provider', format: 'excel', lastSent: '2025-01-17 09:20', status: 'sent', autoSend: true },
];

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
// Components
// ============================================================================

function SourceBadge({ source }: { source: PriceDataSource }) {
  const config: Record<PriceDataSource, { label: string; color: string; icon: React.ElementType }> = {
    mock: { label: 'Test', color: 'bg-gray-100 text-gray-600', icon: Database },
    csv: { label: 'CSV', color: 'bg-blue-50 text-blue-600', icon: FileSpreadsheet },
    manual: { label: 'Manuell', color: 'bg-amber-50 text-amber-600', icon: Edit3 },
    fund_registry: { label: 'Fondregister', color: 'bg-emerald-50 text-emerald-600', icon: Database },
    lseg: { label: 'LSEG', color: 'bg-purple-50 text-purple-600', icon: Globe },
  };

  const { label, color, icon: Icon } = config[source];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: Institution['status'] }) {
  const config = {
    sent: { label: 'Skickad', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
    pending: { label: 'Väntar', color: 'bg-amber-50 text-amber-600', icon: Clock },
    error: { label: 'Fel', color: 'bg-red-50 text-red-600', icon: AlertCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ProviderCard({ 
  source, 
  status, 
  isActive, 
  onSelect 
}: { 
  source: PriceDataSource; 
  status: ProviderStatus; 
  isActive: boolean;
  onSelect: () => void;
}) {
  const config: Record<PriceDataSource, { name: string; description: string; icon: React.ElementType; color: string }> = {
    mock: { 
      name: 'Test/Mock', 
      description: 'Använd testdata för utveckling',
      icon: Database, 
      color: 'from-gray-500 to-gray-600' 
    },
    csv: { 
      name: 'CSV Import', 
      description: 'Ladda upp prisdata från Excel/CSV',
      icon: FileSpreadsheet, 
      color: 'from-blue-500 to-blue-600' 
    },
    manual: { 
      name: 'Manuell inmatning', 
      description: 'Mata in priser direkt i systemet',
      icon: Edit3, 
      color: 'from-amber-500 to-amber-600' 
    },
    fund_registry: { 
      name: 'Fondregister', 
      description: 'Internt fondregister med NAV-data',
      icon: Database, 
      color: 'from-emerald-500 to-emerald-600' 
    },
    lseg: { 
      name: 'LSEG/Refinitiv', 
      description: 'Realtidspriser från LSEG (kräver licens)',
      icon: Globe, 
      color: 'from-purple-500 to-purple-600' 
    },
  };

  const { name, description, icon: Icon, color } = config[source];

  return (
    <button
      onClick={onSelect}
      className={`relative text-left p-4 rounded-xl border-2 transition-all ${
        isActive 
          ? 'border-aifm-gold bg-aifm-gold/5 shadow-md' 
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      {isActive && (
        <div className="absolute top-2 right-2">
          <Check className="w-5 h-5 text-aifm-gold" />
        </div>
      )}
      
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      
      <h4 className="font-semibold text-aifm-charcoal">{name}</h4>
      <p className="text-xs text-aifm-charcoal/60 mt-1">{description}</p>
      
      <div className="mt-3 flex items-center gap-2">
        {status.available ? (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Tillgänglig
          </span>
        ) : (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Ej konfigurerad
          </span>
        )}
      </div>
    </button>
  );
}

function CSVUploadModal({ 
  isOpen, 
  onClose, 
  onUpload 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onUpload: (data: any[]) => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      setError('CSV måste ha minst en rubrikrad och en datarad');
      return null;
    }

    const headers = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
    const requiredHeaders = ['isin', 'nav'];
    
    for (const req of requiredHeaders) {
      if (!headers.some(h => h.includes(req))) {
        setError(`CSV saknar obligatorisk kolumn: ${req}`);
        return null;
      }
    }

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
        else if (h.includes('aum') || h.includes('tillgång')) row.aum = parseFloat(values[idx].replace(',', '.'));
        else if (h.includes('andel') || h.includes('share')) row.outstandingShares = parseFloat(values[idx].replace(',', '.'));
        else if (h.includes('valuta') || h.includes('currency')) row.currency = values[idx];
      });

      if (row.isin && row.nav) {
        data.push(row);
      }
    }

    return data;
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    const data = parseCSV(csvText);
    if (data && data.length > 0) {
      onUpload(data);
      onClose();
      setCsvText('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-aifm-charcoal">Importera CSV</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-aifm-charcoal/60" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-aifm-charcoal mb-2">
              Välj CSV-fil eller klistra in data
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-aifm-gold transition-colors text-center"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-aifm-charcoal/70">Klicka för att välja fil eller dra och släpp</p>
              <p className="text-xs text-aifm-charcoal/50 mt-1">CSV, TXT (semikolon eller komma-separerad)</p>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-aifm-charcoal mb-2">
              CSV-innehåll
            </label>
            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setError(null); }}
              placeholder="ISIN;Fondnamn;NAV;Datum;Valuta&#10;SE0019175563;AUAG Essential Metals A;142.42;2025-01-17;SEK"
              className="w-full h-40 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-aifm-gold resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-aifm-charcoal mb-2">Obligatoriska kolumner:</h4>
            <ul className="text-xs text-aifm-charcoal/70 space-y-1">
              <li>• <code className="bg-white px-1 rounded">ISIN</code> - Fondens ISIN-kod</li>
              <li>• <code className="bg-white px-1 rounded">NAV</code> - NAV-kurs (decimal)</li>
            </ul>
            <h4 className="text-sm font-medium text-aifm-charcoal mt-3 mb-2">Valfria kolumner:</h4>
            <ul className="text-xs text-aifm-charcoal/70 space-y-1">
              <li>• <code className="bg-white px-1 rounded">Fondnamn/Name</code> - Fondens namn</li>
              <li>• <code className="bg-white px-1 rounded">Datum/Date</code> - Prisdatum (YYYY-MM-DD)</li>
              <li>• <code className="bg-white px-1 rounded">AUM</code> - Assets under management</li>
              <li>• <code className="bg-white px-1 rounded">Valuta/Currency</code> - Valutakod</li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-aifm-charcoal hover:bg-gray-100 rounded-lg"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={!csvText.trim()}
            className="px-4 py-2 text-sm bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 disabled:opacity-50"
          >
            Importera
          </button>
        </div>
      </div>
    </div>
  );
}

function ManualPriceModal({ 
  isOpen, 
  onClose, 
  onSave,
  existingFunds 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSave: (data: any) => void;
  existingFunds: PriceDataRecord[];
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

  const handleSubmit = () => {
    if (!formData.isin || !formData.nav) return;
    
    onSave({
      fundId: formData.fundId || formData.isin,
      fundName: formData.fundName || `Fund ${formData.isin}`,
      isin: formData.isin,
      date: formData.date,
      nav: parseFloat(formData.nav),
      aum: formData.aum ? parseFloat(formData.aum) : undefined,
      outstandingShares: formData.outstandingShares ? parseFloat(formData.outstandingShares) : undefined,
      currency: formData.currency,
    });
    
    onClose();
    setFormData({
      fundId: '',
      fundName: '',
      isin: '',
      date: new Date().toISOString().split('T')[0],
      nav: '',
      aum: '',
      outstandingShares: '',
      currency: 'SEK',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-aifm-charcoal">Mata in pris manuellt</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-aifm-charcoal/60" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {existingFunds.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-2">
                Välj befintlig fond
              </label>
              <select
                value={formData.fundId}
                onChange={(e) => handleFundSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">ISIN *</label>
              <input
                type="text"
                value={formData.isin}
                onChange={(e) => setFormData(prev => ({ ...prev, isin: e.target.value }))}
                placeholder="SE0019175563"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">Fondnamn</label>
              <input
                type="text"
                value={formData.fundName}
                onChange={(e) => setFormData(prev => ({ ...prev, fundName: e.target.value }))}
                placeholder="AUAG Essential Metals A"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">Datum</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-aifm-charcoal mb-1">Valuta</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-aifm-charcoal hover:bg-gray-100 rounded-lg"
          >
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.isin || !formData.nav}
            className="px-4 py-2 text-sm bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 disabled:opacity-50"
          >
            Spara
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PriceDataPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [priceData, setPriceData] = useState<PriceDataRecord[]>([]);
  const [activeSource, setActiveSource] = useState<PriceDataSource>('mock');
  const [providerStatuses, setProviderStatuses] = useState<Record<PriceDataSource, ProviderStatus>>({} as any);
  const [isLoading, setIsLoading] = useState(true);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch data on mount and when source changes
  useEffect(() => {
    fetchProviderStatus();
    fetchPriceData();
  }, [activeSource, selectedDate]);

  const fetchProviderStatus = async () => {
    try {
      const response = await fetch('/api/nav/price-data?action=status');
      if (response.ok) {
        const data = await response.json();
        setActiveSource(data.activeSource);
        setProviderStatuses(data.statuses);
      }
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
    }
  };

  const fetchPriceData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/nav/price-data?date=${selectedDate}`);
      if (response.ok) {
        const data = await response.json();
        setPriceData(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch price data:', error);
      setPriceData([]);
    }
    setIsLoading(false);
  };

  const handleSourceChange = async (source: PriceDataSource) => {
    try {
      const response = await fetch('/api/nav/price-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-source', source }),
      });
      
      if (response.ok) {
        setActiveSource(source);
        setNotification({ type: 'success', message: `Bytte till ${source} som priskälla` });
        fetchPriceData();
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Kunde inte byta priskälla' });
    }
  };

  const handleCSVImport = async (data: any[]) => {
    try {
      const response = await fetch('/api/nav/price-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import-csv', data }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setNotification({ 
          type: 'success', 
          message: `Importerade ${result.imported} priser` + (result.errors.length > 0 ? ` (${result.errors.length} fel)` : '')
        });
        
        // Switch to CSV source and refresh
        await handleSourceChange('csv');
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Kunde inte importera CSV' });
    }
  };

  const handleManualPrice = async (data: any) => {
    try {
      const response = await fetch('/api/nav/price-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-manual', ...data }),
      });
      
      if (response.ok) {
        setNotification({ type: 'success', message: `Sparade pris för ${data.fundName || data.isin}` });
        
        // Switch to manual source and refresh
        if (activeSource !== 'manual') {
          await handleSourceChange('manual');
        } else {
          fetchPriceData();
        }
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Kunde inte spara pris' });
    }
  };

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const toggleSelection = (isin: string) => {
    setSelectedRecords(prev =>
      prev.includes(isin) ? prev.filter(r => r !== isin) : [...prev, isin]
    );
  };

  const selectAll = () => {
    setSelectedRecords(priceData.map(r => r.isin));
  };

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/nav-admin" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-aifm-charcoal">Prisdata-hantering</h1>
          <p className="text-aifm-charcoal/60 mt-1">
            Hantera priskällor, importera data och skicka till institut
          </p>
        </div>
      </div>

      {/* Price Source Selection */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-aifm-charcoal">Priskälla</h2>
            <p className="text-sm text-aifm-charcoal/60">Välj var prisdata ska hämtas från</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCSVModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-sm"
            >
              <Upload className="w-4 h-4" />
              Importera CSV
            </button>
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 text-sm"
            >
              <Plus className="w-4 h-4" />
              Lägg till pris
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {(['fund_registry', 'csv', 'manual', 'mock', 'lseg'] as PriceDataSource[]).map(source => (
            <ProviderCard
              key={source}
              source={source}
              status={providerStatuses[source] || { available: false, lastCheck: '', message: 'Loading...' }}
              isActive={activeSource === source}
              onSelect={() => handleSourceChange(source)}
            />
          ))}
        </div>
        
        {activeSource === 'lseg' && !providerStatuses.lseg?.available && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">LSEG-licens krävs</h4>
                <p className="text-sm text-amber-700 mt-1">
                  För att använda LSEG som priskälla behöver du konfigurera API-nycklar. 
                  Kontakta din LSEG-representant för credentials, eller använd CSV/Manuell import i mellantiden.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-aifm-charcoal">{priceData.length}</p>
          <p className="text-sm text-aifm-charcoal/60">Andelsklasser</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-emerald-600">{mockInstitutions.filter(i => i.status === 'sent').length}</p>
          <p className="text-sm text-aifm-charcoal/60">Skickade idag</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-aifm-charcoal">{mockInstitutions.length}</p>
          <p className="text-sm text-aifm-charcoal/60">Mottagare</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2">
            <SourceBadge source={activeSource} />
          </div>
          <p className="text-sm text-aifm-charcoal/60 mt-1">Aktiv källa</p>
        </div>
      </div>

      {/* Date Selection & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-aifm-gold/50"
            />
          </div>
          <button 
            onClick={fetchPriceData}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-aifm-charcoal/60 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Uppdatera</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-aifm-charcoal/60" />
            <span className="text-sm">Exportera Excel</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 transition-colors">
            <Send className="w-4 h-4" />
            <span className="text-sm font-medium">Skicka till alla</span>
          </button>
        </div>
      </div>

      {/* Price Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-aifm-charcoal">NAV-data för {selectedDate}</h2>
            <SourceBadge source={activeSource} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-sm text-aifm-gold hover:underline">
              Välj alla
            </button>
            {selectedRecords.length > 0 && (
              <span className="text-sm text-aifm-charcoal/50">({selectedRecords.length} valda)</span>
            )}
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-aifm-gold animate-spin" />
          </div>
        ) : priceData.length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-aifm-charcoal/60">Ingen prisdata tillgänglig</p>
            <p className="text-sm text-aifm-charcoal/40 mt-1">
              {activeSource === 'csv' ? 'Importera en CSV-fil för att komma igång' : 
               activeSource === 'manual' ? 'Lägg till priser manuellt' :
               'Prisdata kunde inte hämtas från vald källa'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRecords.length === priceData.length && priceData.length > 0}
                      onChange={() => selectedRecords.length === priceData.length ? setSelectedRecords([]) : selectAll()}
                      className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase">ISIN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase">Fond</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase">Valuta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">NAV kurs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">Förändring</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">Totalt AUM</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase">Källa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {priceData.map((record) => (
                  <tr key={record.isin} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRecords.includes(record.isin)}
                        onChange={() => toggleSelection(record.isin)}
                        className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                      />
                    </td>
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
                        <span className={`font-medium ${record.navChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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

      {/* Institutions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-aifm-charcoal">Mottagare & Institut</h2>
          <Link href="/nav-admin/settings" className="flex items-center gap-2 text-sm text-aifm-gold hover:underline">
            <Settings className="w-4 h-4" />
            Hantera mottagare
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockInstitutions.map((institution) => (
            <div key={institution.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-aifm-charcoal">{institution.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-aifm-charcoal/50 uppercase">{institution.format}</span>
                  </div>
                </div>
                <StatusBadge status={institution.status} />
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div>
                  {institution.lastSent ? (
                    <p className="text-xs text-aifm-charcoal/50">Senast: {institution.lastSent}</p>
                  ) : (
                    <p className="text-xs text-aifm-charcoal/50">Ej skickad</p>
                  )}
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Skicka nu">
                  <Send className="w-4 h-4 text-aifm-gold" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <CSVUploadModal
        isOpen={isCSVModalOpen}
        onClose={() => setIsCSVModalOpen(false)}
        onUpload={handleCSVImport}
      />
      
      <ManualPriceModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleManualPrice}
        existingFunds={priceData}
      />
    </div>
  );
}
