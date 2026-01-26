'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Send, Download, CheckCircle2, Clock, Building2,
  Globe, Upload, RefreshCw, ExternalLink, FileSpreadsheet,
  Calendar, AlertCircle, Settings, Eye
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PriceDataRecord {
  isin: string;
  fundName: string;
  currency: string;
  navKurs: number;
  totalAUM: number;
  classAUM: number;
  sharesOutstanding: number;
  date: string;
  change: number;
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
// Mock Data
// ============================================================================

const mockPriceData: PriceDataRecord[] = [
  { isin: 'SE0019175563', fundName: 'AUAG Essential Metals A', currency: 'SEK', navKurs: 142.42, totalAUM: 395584099.11, classAUM: 349892028.52, sharesOutstanding: 2456766.31, date: '2025-01-17', change: 1.23 },
  { isin: 'SE0019175571', fundName: 'AUAG Essential Metals B', currency: 'EUR', navKurs: 14.65, totalAUM: 395584099.11, classAUM: 43120778.87, sharesOutstanding: 269451.12, date: '2025-01-17', change: 1.18 },
  { isin: 'SE0019175589', fundName: 'AUAG Essential Metals C', currency: 'SEK', navKurs: 128.56, totalAUM: 395584099.11, classAUM: 2571291.72, sharesOutstanding: 20000.00, date: '2025-01-17', change: 1.21 },
  { isin: 'SE0020677946', fundName: 'AuAg Gold Rush A', currency: 'SEK', navKurs: 208.71, totalAUM: 613070568.95, classAUM: 505494096.59, sharesOutstanding: 2422025.74, date: '2025-01-17', change: 2.45 },
  { isin: 'SE0020677953', fundName: 'AuAg Gold Rush B', currency: 'EUR', navKurs: 22.63, totalAUM: 613070568.95, classAUM: 98912.81, sharesOutstanding: 400.00, date: '2025-01-17', change: 2.38 },
  { isin: 'SE0014808440', fundName: 'AuAg Precious Green A', currency: 'SEK', navKurs: 198.87, totalAUM: 347295087.92, classAUM: 328924859.33, sharesOutstanding: 1653996.37, date: '2025-01-17', change: 0.87 },
  { isin: 'SE0013358181', fundName: 'AuAg Silver Bullet A', currency: 'SEK', navKurs: 378.33, totalAUM: 4344439682.78, classAUM: 3400248947.80, sharesOutstanding: 8987586.35, date: '2025-01-17', change: 3.12 },
  { isin: 'SE0013358199', fundName: 'AuAg Silver Bullet B', currency: 'EUR', navKurs: 37.23, totalAUM: 4344439682.78, classAUM: 921562837.38, sharesOutstanding: 2265711.61, date: '2025-01-17', change: 3.05 },
];

const mockInstitutions: Institution[] = [
  { id: '1', name: 'Nordea Markets', type: 'bank', format: 'excel', lastSent: '2025-01-17 09:15', status: 'sent', autoSend: true },
  { id: '2', name: 'SEB Prime', type: 'bank', format: 'excel', lastSent: '2025-01-17 09:15', status: 'sent', autoSend: true },
  { id: '3', name: 'Avanza', type: 'bank', format: 'api', lastSent: '2025-01-17 09:00', status: 'sent', autoSend: true },
  { id: '4', name: 'Morningstar', type: 'data_provider', format: 'csv', lastSent: '2025-01-17 09:30', status: 'sent', autoSend: true },
  { id: '5', name: 'Bloomberg', type: 'data_provider', format: 'api', status: 'pending', autoSend: false },
  { id: '6', name: 'Fondbolagens Förening', type: 'data_provider', format: 'excel', lastSent: '2025-01-17 09:20', status: 'sent', autoSend: true },
  { id: '7', name: 'AuAg Hemsida', type: 'website', format: 'manual', lastSent: '2025-01-17 09:45', status: 'sent', autoSend: false },
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

function InstitutionTypeBadge({ type }: { type: Institution['type'] }) {
  const config = {
    bank: { label: 'Bank', color: 'bg-blue-50 text-blue-600', icon: Building2 },
    exchange: { label: 'Börs', color: 'bg-purple-50 text-purple-600', icon: Building2 },
    data_provider: { label: 'Dataleverantör', color: 'bg-emerald-50 text-emerald-600', icon: Globe },
    website: { label: 'Hemsida', color: 'bg-amber-50 text-amber-600', icon: Globe },
  };

  const { label, color, icon: Icon } = config[type];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function InstitutionCard({ institution }: { institution: Institution }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-aifm-charcoal">{institution.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <InstitutionTypeBadge type={institution.type} />
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
          {institution.autoSend && (
            <p className="text-xs text-emerald-600 mt-0.5">✓ Auto-utskick</p>
          )}
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Skicka nu">
          <Send className="w-4 h-4 text-aifm-gold" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PriceDataPage() {
  const [selectedDate, setSelectedDate] = useState('2025-01-17');
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

  const toggleSelection = (isin: string) => {
    setSelectedRecords(prev =>
      prev.includes(isin) ? prev.filter(r => r !== isin) : [...prev, isin]
    );
  };

  const selectAll = () => {
    setSelectedRecords(mockPriceData.map(r => r.isin));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/nav-admin"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-aifm-charcoal/60" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-aifm-charcoal">Prisdata-utskick</h1>
          <p className="text-aifm-charcoal/60 mt-1">
            Exportera och skicka NAV-data till institut och hemsida
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-2xl font-bold text-aifm-charcoal">{mockPriceData.length}</p>
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
          <p className="text-2xl font-bold text-aifm-gold">~30 min</p>
          <p className="text-sm text-aifm-charcoal/60">Tid sparad/dag</p>
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
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <RefreshCw className="w-4 h-4 text-aifm-charcoal/60" />
            <span className="text-sm">Uppdatera från källa</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-aifm-charcoal/60" />
            <span className="text-sm">Exportera Excel</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
            <Upload className="w-4 h-4 text-aifm-charcoal/60" />
            <span className="text-sm">Ladda upp till hemsida</span>
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
          <h2 className="font-semibold text-aifm-charcoal">NAV-data för {selectedDate}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-sm text-aifm-gold hover:underline"
            >
              Välj alla
            </button>
            {selectedRecords.length > 0 && (
              <span className="text-sm text-aifm-charcoal/50">
                ({selectedRecords.length} valda)
              </span>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRecords.length === mockPriceData.length}
                    onChange={() => selectedRecords.length === mockPriceData.length ? setSelectedRecords([]) : selectAll()}
                    className="w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold/20"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase">ISIN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase">Fond</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase">Valuta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">NAV kurs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">Förändring</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">Totalt AUM</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase">Utst. andelar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockPriceData.map((record) => (
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
                    {formatCurrency(record.navKurs)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${record.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {record.change >= 0 ? '+' : ''}{record.change.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                    {formatLargeCurrency(record.totalAUM)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                    {formatCurrency(record.sharesOutstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Institutions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-aifm-charcoal">Mottagare & Institut</h2>
          <Link
            href="/nav-admin/settings"
            className="flex items-center gap-2 text-sm text-aifm-gold hover:underline"
          >
            <Settings className="w-4 h-4" />
            Hantera mottagare
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mockInstitutions.map((institution) => (
            <InstitutionCard key={institution.id} institution={institution} />
          ))}
        </div>
      </div>

      {/* Website Upload Section */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-2xl p-6 border border-amber-200/50">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 rounded-xl">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">Uppdatera hemsidan</h3>
              <p className="text-sm text-amber-700 mt-1">
                Senast uppdaterad: 2025-01-17 09:45. Generera och ladda upp ny prisdata till AuAg hemsida.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 rounded-lg hover:bg-amber-50 transition-colors text-sm font-medium border border-amber-200">
                  <Eye className="w-4 h-4" />
                  Förhandsgranska
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  Ladda upp nu
                </button>
              </div>
            </div>
          </div>
          <a
            href="https://auag.se"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-amber-600 hover:underline"
          >
            Öppna hemsida
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
