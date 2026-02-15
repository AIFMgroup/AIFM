'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Users, Download, Send, RefreshCw, Search,
  Building2, FileSpreadsheet, Calendar, CheckCircle2, Clock,
  AlertCircle, Eye, Filter, ChevronDown, Mail
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface OwnerRecord {
  id: string;
  investorName: string;
  investorType: 'institution' | 'individual' | 'nominee' | 'clearstream';
  fundName: string;
  isin: string;
  shares: number;
  ownership: number;
  marketValue: number;
  currency: string;
  accountType: string;
  lastUpdated: string;
}

interface ClearstreamClient {
  id: string;
  name: string;
  clientCode: string;
  email: string;
  funds: string[];
  lastSent?: string;
  status: 'sent' | 'pending' | 'error';
}

// ============================================================================
// Mock Data
// ============================================================================

const mockOwnerData: OwnerRecord[] = [
  { id: '1', investorName: 'Nordea Liv & Pension', investorType: 'institution', fundName: 'AuAg Silver Bullet A', isin: 'SE0013358181', shares: 2500000, ownership: 27.82, marketValue: 945825000, currency: 'SEK', accountType: 'ISK', lastUpdated: '2025-01-17' },
  { id: '2', investorName: 'SEB Investment Management', investorType: 'institution', fundName: 'AuAg Silver Bullet A', isin: 'SE0013358181', shares: 1800000, ownership: 20.03, marketValue: 680994000, currency: 'SEK', accountType: 'Fond', lastUpdated: '2025-01-17' },
  { id: '3', investorName: 'Clearstream Banking S.A.', investorType: 'clearstream', fundName: 'AuAg Silver Bullet B', isin: 'SE0013358199', shares: 1500000, ownership: 66.21, marketValue: 55845000, currency: 'EUR', accountType: 'Nominee', lastUpdated: '2025-01-17' },
  { id: '4', investorName: 'Avanza Pension', investorType: 'institution', fundName: 'AuAg Gold Rush A', isin: 'SE0020677946', shares: 800000, ownership: 33.03, marketValue: 166968000, currency: 'SEK', accountType: 'Pension', lastUpdated: '2025-01-17' },
  { id: '5', investorName: 'Euroclear Sweden AB', investorType: 'nominee', fundName: 'AUAG Essential Metals A', isin: 'SE0019175563', shares: 1200000, ownership: 48.84, marketValue: 170904000, currency: 'SEK', accountType: 'Nominee', lastUpdated: '2025-01-17' },
  { id: '6', investorName: 'Handelsbanken Fonder', investorType: 'institution', fundName: 'AuAg Precious Green A', isin: 'SE0014808440', shares: 500000, ownership: 30.23, marketValue: 99435000, currency: 'SEK', accountType: 'Fond', lastUpdated: '2025-01-17' },
  { id: '7', investorName: 'Clearstream Banking S.A.', investorType: 'clearstream', fundName: 'AuAg Gold Rush B', isin: 'SE0020677953', shares: 350, ownership: 87.50, marketValue: 7920.50, currency: 'EUR', accountType: 'Nominee', lastUpdated: '2025-01-17' },
  { id: '8', investorName: 'Folksam', investorType: 'institution', fundName: 'AuAg Silver Bullet A', isin: 'SE0013358181', shares: 1000000, ownership: 11.13, marketValue: 378330000, currency: 'SEK', accountType: 'Fond', lastUpdated: '2025-01-17' },
];

const mockClearstreamClients: ClearstreamClient[] = [
  { id: '1', name: 'Deutsche Bank AG', clientCode: 'DEUTDEFF', email: 'custody@db.com', funds: ['AuAg Silver Bullet B', 'AuAg Gold Rush B'], lastSent: '2025-01-17 10:00', status: 'sent' },
  { id: '2', name: 'BNP Paribas Securities', clientCode: 'BNPAFRPP', email: 'custody@bnpparibas.com', funds: ['AuAg Silver Bullet B'], lastSent: '2025-01-17 10:00', status: 'sent' },
  { id: '3', name: 'UBS Switzerland AG', clientCode: 'UBSWCHZH', email: 'custody@ubs.com', funds: ['AuAg Gold Rush B', 'AuAg Essential Metals B'], status: 'pending' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' ' + currency;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return value.toFixed(2) + '%';
}

// ============================================================================
// Components
// ============================================================================

function InvestorTypeBadge({ type }: { type: OwnerRecord['investorType'] }) {
  const config = {
    institution: { label: 'Institution', color: 'bg-aifm-charcoal/[0.06] text-aifm-charcoal' },
    individual: { label: 'Privatperson', color: 'bg-gray-100 text-aifm-charcoal/60' },
    nominee: { label: 'Förvaltare', color: 'bg-aifm-gold/15 text-aifm-charcoal' },
    clearstream: { label: 'Clearstream', color: 'bg-amber-50 text-amber-600' },
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config[type].color}`}>
      {config[type].label}
    </span>
  );
}

function StatusBadge({ status }: { status: 'sent' | 'pending' | 'error' }) {
  const config = {
    sent: { label: 'Skickad', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
    pending: { label: 'Väntar', color: 'bg-amber-50 text-amber-600', icon: Clock },
    error: { label: 'Fel', color: 'bg-red-50 text-red-600', icon: AlertCircle },
  };

  const { label, color, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ClearstreamClientCard({ client }: { client: ClearstreamClient }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-aifm-charcoal">{client.name}</h4>
          <p className="text-xs text-aifm-charcoal/50 font-mono mt-0.5">{client.clientCode}</p>
        </div>
        <StatusBadge status={client.status} />
      </div>
      
      <p className="text-xs text-aifm-charcoal/60 mb-2">{client.email}</p>
      
      <div className="flex flex-wrap gap-1 mb-3">
        {client.funds.map((fund) => (
          <span key={fund} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-aifm-charcoal/70">
            {fund}
          </span>
        ))}
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {client.lastSent ? (
          <p className="text-xs text-aifm-charcoal/50">Senast: {client.lastSent}</p>
        ) : (
          <p className="text-xs text-aifm-charcoal/50">Ej skickad</p>
        )}
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

export default function OwnerDataPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedFund, setSelectedFund] = useState<string>('all');

  const uniqueFunds = [...new Set(mockOwnerData.map(o => o.fundName))];
  
  const filteredOwners = mockOwnerData.filter(owner => {
    if (selectedType !== 'all' && owner.investorType !== selectedType) return false;
    if (selectedFund !== 'all' && owner.fundName !== selectedFund) return false;
    if (searchTerm && !owner.investorName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const clearstreamOwners = mockOwnerData.filter(o => o.investorType === 'clearstream');

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
            <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Ägardata</h1>
            <p className="text-sm text-aifm-charcoal/40">
              Hantera och exportera ägaruppgifter, inklusive Clearstream-data
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-aifm-charcoal/[0.06]"><Users className="w-4 h-4 text-aifm-charcoal/60" /></div>
            <span className="text-sm text-aifm-charcoal/40">Totalt ägare</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{mockOwnerData.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-aifm-gold/10"><Building2 className="w-4 h-4 text-aifm-gold" /></div>
            <span className="text-sm text-aifm-charcoal/40">Institutioner</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{mockOwnerData.filter(o => o.investorType === 'institution').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-50"><AlertCircle className="w-4 h-4 text-amber-500" /></div>
            <span className="text-sm text-aifm-charcoal/40">Clearstream</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-aifm-charcoal">{clearstreamOwners.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-aifm-charcoal/[0.03] transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-50"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
            <span className="text-sm text-aifm-charcoal/40">Utskick klara</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight text-emerald-600">{mockClearstreamClients.filter(c => c.status === 'sent').length}/{mockClearstreamClients.length}</p>
        </div>
      </div>

      {/* Clearstream Section */}
      <div className="bg-aifm-charcoal/[0.03] rounded-2xl p-6 border border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Clearstream-utskick</h2>
            <p className="text-sm text-aifm-charcoal/40 mt-1">
              Extrahera och skicka ägardata för Clearstream-konton till respektive kund
            </p>
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-aifm-charcoal text-white rounded-full text-sm font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm">
            <Send className="w-4 h-4" />
            Skicka till alla
          </button>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
          {mockClearstreamClients.map((client) => (
            <ClearstreamClientCard key={client.id} client={client} />
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aifm-charcoal/40" />
            <input
              type="text"
              placeholder="Sök ägare..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors w-64"
            />
          </div>
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="all">Alla typer</option>
            <option value="institution">Institutioner</option>
            <option value="clearstream">Clearstream</option>
            <option value="nominee">Förvaltare</option>
            <option value="individual">Privatpersoner</option>
          </select>
          
          <select
            value={selectedFund}
            onChange={(e) => setSelectedFund(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-colors"
          >
            <option value="all">Alla fonder</option>
            {uniqueFunds.map((fund) => (
              <option key={fund} value={fund}>{fund}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
            <RefreshCw className="w-4 h-4" />
            <span>Uppdatera</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-aifm-charcoal/50 hover:text-aifm-charcoal border border-gray-200 hover:border-gray-300 rounded-full text-sm transition-all">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportera Excel</span>
          </button>
        </div>
      </div>

      {/* Owner Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-aifm-charcoal tracking-tight">Ägarförteckning</h2>
          <p className="text-sm text-aifm-charcoal/50 mt-0.5">
            Visar {filteredOwners.length} av {mockOwnerData.length} ägare
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-aifm-charcoal/[0.03]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Ägare</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Typ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Fond</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Andelar</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Andel %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Marknadsvärde</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Kontotyp</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/60 uppercase tracking-wider">Åtgärder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOwners.map((owner) => (
                <tr key={owner.id} className="hover:bg-aifm-charcoal/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-aifm-charcoal/[0.06] rounded-full flex items-center justify-center">
                        <Users className="w-4 h-4 text-aifm-charcoal/40" />
                      </div>
                      <span className="font-medium text-aifm-charcoal">{owner.investorName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <InvestorTypeBadge type={owner.investorType} />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-aifm-charcoal">{owner.fundName}</p>
                      <p className="text-xs text-aifm-charcoal/50 font-mono">{owner.isin}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-aifm-charcoal">
                    {formatNumber(owner.shares)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-aifm-gold">{formatPercent(owner.ownership)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                    {formatCurrency(owner.marketValue, owner.currency)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-aifm-charcoal/70">
                      {owner.accountType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Visa detaljer">
                        <Eye className="w-4 h-4 text-aifm-charcoal/50" />
                      </button>
                      {owner.investorType === 'clearstream' && (
                        <button className="p-2 hover:bg-aifm-gold/10 rounded-lg transition-colors" title="Skicka rapport">
                          <Mail className="w-4 h-4 text-aifm-gold" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
