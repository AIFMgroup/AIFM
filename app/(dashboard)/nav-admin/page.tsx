'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, FileText, Send, Users, Clock, CheckCircle2,
  AlertCircle, ArrowRight, Calendar, BarChart3, Download,
  Mail, RefreshCw, Zap, Target, Timer, Activity, Shield, Settings,
  Building2, GitCompare
} from 'lucide-react';
import { ProcessMonitor } from '@/components/nav/ProcessMonitor';
import { NAVApprovalCard } from '@/components/nav/NAVApprovalCard';

// ============================================================================
// Types
// ============================================================================

interface FundNAV {
  isin: string;
  fundName: string;
  currency: string;
  navKurs: number;
  date: string;
  totalNetAssetsSEK: number;
  classNetAssetsSEK: number;
  sharesOutstanding: number;
}

interface ProcessStatus {
  id: string;
  name: string;
  status: 'completed' | 'pending' | 'running' | 'failed';
  lastRun?: string;
  nextRun?: string;
  savedTime?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockFundNAVs: FundNAV[] = [
  { isin: 'SE0019175563', fundName: 'AUAG Essential Metals A', currency: 'SEK', navKurs: 142.42, date: '2025-12-16', totalNetAssetsSEK: 395584099.11, classNetAssetsSEK: 349892028.52, sharesOutstanding: 2456766.31 },
  { isin: 'SE0019175571', fundName: 'AUAG Essential Metals B', currency: 'EUR', navKurs: 14.65, date: '2025-12-16', totalNetAssetsSEK: 395584099.11, classNetAssetsSEK: 43120778.87, sharesOutstanding: 269451.12 },
  { isin: 'SE0019175589', fundName: 'AUAG Essential Metals C', currency: 'SEK', navKurs: 128.56, date: '2025-12-16', totalNetAssetsSEK: 395584099.11, classNetAssetsSEK: 2571291.72, sharesOutstanding: 20000.00 },
  { isin: 'SE0020677946', fundName: 'AuAg Gold Rush A', currency: 'SEK', navKurs: 208.71, date: '2025-12-16', totalNetAssetsSEK: 613070568.95, classNetAssetsSEK: 505494096.59, sharesOutstanding: 2422025.74 },
  { isin: 'SE0020677953', fundName: 'AuAg Gold Rush B', currency: 'EUR', navKurs: 22.63, date: '2025-12-16', totalNetAssetsSEK: 613070568.95, classNetAssetsSEK: 98912.81, sharesOutstanding: 400.00 },
  { isin: 'SE0020677961', fundName: 'AuAg Gold Rush C', currency: 'SEK', navKurs: 170.52, date: '2025-12-16', totalNetAssetsSEK: 613070568.95, classNetAssetsSEK: 12710988.85, sharesOutstanding: 74543.90 },
  { isin: 'SE0020678001', fundName: 'AuAg Gold Rush H', currency: 'NOK', navKurs: 197.23, date: '2025-12-16', totalNetAssetsSEK: 613070568.95, classNetAssetsSEK: 87854781.97, sharesOutstanding: 488103.97 },
  { isin: 'SE0020678050', fundName: 'AuAg Gold Rush L', currency: 'USD', navKurs: 11.96, date: '2025-12-16', totalNetAssetsSEK: 613070568.95, classNetAssetsSEK: 3336387.66, sharesOutstanding: 30000.00 },
  { isin: 'SE0020678076', fundName: 'AuAg Gold Rush N', currency: 'CHF', navKurs: 15.48, date: '2025-12-16', totalNetAssetsSEK: 613070568.95, classNetAssetsSEK: 3575401.07, sharesOutstanding: 19766.01 },
  { isin: 'SE0014808440', fundName: 'AuAg Precious Green A', currency: 'SEK', navKurs: 198.87, date: '2025-12-16', totalNetAssetsSEK: 347295087.92, classNetAssetsSEK: 328924859.33, sharesOutstanding: 1653996.37 },
  { isin: 'SE0014808457', fundName: 'AuAg Precious Green B', currency: 'EUR', navKurs: 18.88, date: '2025-12-16', totalNetAssetsSEK: 347295087.92, classNetAssetsSEK: 12524335.34, sharesOutstanding: 60729.92 },
  { isin: 'SE0015948641', fundName: 'AuAg Precious Green C', currency: 'SEK', navKurs: 140.36, date: '2025-12-16', totalNetAssetsSEK: 347295087.92, classNetAssetsSEK: 5845893.25, sharesOutstanding: 41648.44 },
  { isin: 'SE0013358181', fundName: 'AuAg Silver Bullet A', currency: 'SEK', navKurs: 378.33, date: '2025-12-16', totalNetAssetsSEK: 4344439682.78, classNetAssetsSEK: 3400248947.80, sharesOutstanding: 8987586.35 },
  { isin: 'SE0013358199', fundName: 'AuAg Silver Bullet B', currency: 'EUR', navKurs: 37.23, date: '2025-12-16', totalNetAssetsSEK: 4344439682.78, classNetAssetsSEK: 921562837.38, sharesOutstanding: 2265711.61 },
];

const mockProcesses: ProcessStatus[] = [
  { id: 'nav-reports', name: 'NAV-rapporter utskick', status: 'completed', lastRun: '2025-01-17 08:30', nextRun: '2025-01-20 08:30', savedTime: '45 min' },
  { id: 'notor', name: 'Notor (gårdagens flöden)', status: 'completed', lastRun: '2025-01-17 07:00', nextRun: '2025-01-20 07:00', savedTime: '20 min' },
  { id: 'subred', name: 'SubRed (dagens flöden)', status: 'pending', nextRun: '2025-01-17 15:00', savedTime: '25 min' },
  { id: 'price-data', name: 'Prisdata till institut', status: 'completed', lastRun: '2025-01-17 09:00', nextRun: '2025-01-20 09:00', savedTime: '15 min' },
  { id: 'owner-data', name: 'Ägardata (Clearstream)', status: 'completed', lastRun: '2025-01-17 09:15', nextRun: '2025-01-20 09:15', savedTime: '15 min' },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number, currency: string = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'decimal',
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

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'gold' 
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  icon: React.ElementType; 
  trend?: string;
  color?: 'gold' | 'green' | 'blue' | 'purple';
}) {
  const colors = {
    gold: 'bg-aifm-gold/10 text-aifm-gold',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-aifm-charcoal">{value}</p>
      <p className="text-sm text-aifm-charcoal/60 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-aifm-charcoal/40 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ProcessCard({ process }: { process: ProcessStatus }) {
  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Klar' },
    pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Väntar' },
    running: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Körs' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Fel' },
  };

  const config = statusConfig[process.status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl hover:bg-gray-100/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <StatusIcon className={`w-4 h-4 ${config.color} ${process.status === 'running' ? 'animate-spin' : ''}`} />
        </div>
        <div>
          <p className="font-medium text-aifm-charcoal text-sm">{process.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {process.lastRun && (
              <span className="text-xs text-aifm-charcoal/50">Senast: {process.lastRun}</span>
            )}
            {process.nextRun && (
              <span className="text-xs text-aifm-charcoal/50">Nästa: {process.nextRun}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {process.savedTime && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
            <Timer className="w-3 h-3" />
            {process.savedTime} sparad
          </span>
        )}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}

function QuickActionCard({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  color 
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType; 
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-aifm-gold/30 hover:shadow-lg transition-all"
    >
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-semibold text-aifm-charcoal mb-1">{title}</h3>
      <p className="text-sm text-aifm-charcoal/60">{description}</p>
      <div className="flex items-center gap-1 mt-3 text-aifm-gold text-sm font-medium">
        <span>Öppna</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NAVAdminPage() {
  const [selectedDate, setSelectedDate] = useState('2025-01-17');
  
  // Calculate totals
  const totalAUM = mockFundNAVs.reduce((sum, fund) => {
    // Only count unique funds (by total net assets)
    return sum;
  }, 0);
  
  // Get unique fund totals
  const uniqueFunds = new Map<number, FundNAV>();
  mockFundNAVs.forEach(fund => {
    if (!uniqueFunds.has(fund.totalNetAssetsSEK)) {
      uniqueFunds.set(fund.totalNetAssetsSEK, fund);
    }
  });
  const totalAUMValue = Array.from(uniqueFunds.values()).reduce((sum, fund) => sum + fund.totalNetAssetsSEK, 0);
  
  const totalTimeSaved = mockProcesses.reduce((sum, p) => {
    if (p.savedTime) {
      const minutes = parseInt(p.savedTime);
      return sum + (isNaN(minutes) ? 0 : minutes);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-aifm-charcoal">NAV-processer</h1>
          <p className="text-aifm-charcoal/60 mt-1">
            Automatisera NAV-rapportering, prisdata och ägardata
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/50"
          />
          <Link
            href="/nav-admin/settings"
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border border-gray-200 text-aifm-charcoal rounded-xl hover:border-aifm-gold/50 hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Inställningar</span>
          </Link>
          <button className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors">
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Uppdatera data</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Totalt AUM"
          value={formatLargeCurrency(totalAUMValue)}
          subtitle="Alla fonder"
          icon={TrendingUp}
          color="gold"
        />
        <StatCard
          title="Fonder"
          value={uniqueFunds.size.toString()}
          subtitle={`${mockFundNAVs.length} andelsklasser`}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Automatiserade processer"
          value={mockProcesses.filter(p => p.status === 'completed').length.toString()}
          subtitle={`av ${mockProcesses.length} totalt`}
          icon={Zap}
          color="green"
        />
        <StatCard
          title="Tid sparad idag"
          value={`~${totalTimeSaved} min`}
          subtitle="Uppskattad besparing"
          icon={Timer}
          color="purple"
          trend="+45 min/dag"
        />
      </div>

      {/* NAV Approval Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-aifm-gold" />
          <h2 className="text-lg font-semibold text-aifm-charcoal">Dagens NAV-godkännande</h2>
        </div>
        <NAVApprovalCard
          onApprove={async (requestId, comment) => {
            console.log('Approving NAV:', requestId, comment);
            // TODO: Call API
            alert('NAV godkänt! (Demo)');
          }}
          onReject={async (requestId, reason) => {
            console.log('Rejecting NAV:', requestId, reason);
            // TODO: Call API
            alert('NAV avvisat! (Demo)');
          }}
          onViewDetails={(requestId) => {
            console.log('View details:', requestId);
          }}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-aifm-charcoal mb-4">Snabbåtgärder</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <QuickActionCard
            title="NAV-rapporter"
            description="Skicka ut NAV-rapporter till förvaltare"
            icon={FileText}
            href="/nav-admin/reports"
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <QuickActionCard
            title="Notor & SubReds"
            description="Hantera dagens in- och utflöden"
            icon={Activity}
            href="/nav-admin/flows"
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <QuickActionCard
            title="Prisdata"
            description="Uppdatera och skicka prisdata till institut"
            icon={Send}
            href="/nav-admin/price-data"
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <QuickActionCard
            title="Ägardata"
            description="Exportera ägardata för Clearstream"
            icon={Users}
            href="/nav-admin/owner-data"
            color="bg-gradient-to-br from-aifm-gold to-amber-600"
          />
        </div>
        
        {/* Bank Integration Section */}
        <h2 className="text-lg font-semibold text-aifm-charcoal mb-4 mt-8">Bankintegration</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <QuickActionCard
            title="Bankavstämning"
            description="Jämför NAV-data med SEB/Swedbank"
            icon={GitCompare}
            href="/nav-admin/reconciliation"
            color="bg-gradient-to-br from-cyan-500 to-cyan-600"
          />
          <QuickActionCard
            title="Swedbank PDF"
            description="Ladda upp och processa custody-PDF"
            icon={Building2}
            href="/nav-admin/bank-reconciliation"
            color="bg-gradient-to-br from-orange-500 to-orange-600"
          />
          <QuickActionCard
            title="Inställningar"
            description="Konfigurera fonder, mottagare och scheman"
            icon={Settings}
            href="/nav-admin/settings"
            color="bg-gradient-to-br from-gray-600 to-gray-700"
          />
        </div>
      </div>

      {/* Process Monitor */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <ProcessMonitor
          onRunJob={async (jobId) => {
            console.log('Running job:', jobId);
            // TODO: Call API
            alert(`Kör jobb: ${jobId} (Demo)`);
          }}
          onToggleJob={async (jobId, enabled) => {
            console.log('Toggle job:', jobId, enabled);
            // TODO: Call API
          }}
          onRefresh={async () => {
            console.log('Refreshing...');
            // TODO: Call API
          }}
        />
      </div>

      {/* NAV Table Preview */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-aifm-charcoal">Aktuella NAV-kurser</h2>
            <p className="text-xs sm:text-sm text-aifm-charcoal/50 mt-0.5">Data från {selectedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-aifm-charcoal/70 hover:text-aifm-charcoal border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera Excel</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-aifm-gold rounded-lg hover:bg-aifm-gold/90 transition-colors">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Skicka rapport</span>
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">ISIN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Fond</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Valuta</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">NAV kurs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Totalt AUM (SEK)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Klass AUM (SEK)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Utst. andelar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mockFundNAVs.map((fund, index) => (
                <tr key={fund.isin} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-aifm-charcoal/70">{fund.isin}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-aifm-charcoal">{fund.fundName}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-aifm-charcoal/70">
                      {fund.currency}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-aifm-charcoal">
                    {formatCurrency(fund.navKurs)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                    {formatCurrency(fund.totalNetAssetsSEK)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                    {formatCurrency(fund.classNetAssetsSEK)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                    {formatCurrency(fund.sharesOutstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Efficiency Summary */}
      <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-base sm:text-lg font-semibold mb-2">Effektiviseringsöversikt</h2>
            <p className="text-white/70 text-xs sm:text-sm mb-4">
              Genom automatisering av NAV-processer sparar ni uppskattningsvis:
            </p>
            <div className="grid grid-cols-3 gap-3 sm:gap-6">
              <div>
                <p className="text-xl sm:text-3xl font-bold text-aifm-gold">45-90 min</p>
                <p className="text-xs sm:text-sm text-white/60">per dag</p>
              </div>
              <div>
                <p className="text-xl sm:text-3xl font-bold text-aifm-gold">~6 tim</p>
                <p className="text-xs sm:text-sm text-white/60">per vecka</p>
              </div>
              <div>
                <p className="text-xl sm:text-3xl font-bold text-aifm-gold">~25 tim</p>
                <p className="text-xs sm:text-sm text-white/60">per månad</p>
              </div>
            </div>
          </div>
          <Target className="w-10 h-10 sm:w-16 sm:h-16 text-aifm-gold/30 hidden sm:block" />
        </div>
      </div>
    </div>
  );
}
