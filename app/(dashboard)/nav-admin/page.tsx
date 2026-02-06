'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, FileText, Send, Users, Clock, CheckCircle2,
  AlertCircle, ArrowRight, Calendar, BarChart3, Download,
  Mail, RefreshCw, Zap, Target, Timer, Activity, Shield, Settings,
  Building2, GitCompare, Database, Wifi, WifiOff, Loader2, History,
  Calculator, ClipboardList, Sparkles
} from 'lucide-react';
import { ProcessMonitor } from '@/components/nav/ProcessMonitor';
import { NAVApprovalCard } from '@/components/nav/NAVApprovalCard';
import { PriceDataModal } from '@/components/nav/PriceDataModal';

// ============================================================================
// Types
// ============================================================================

interface FundNAV {
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
  status: string;
}

interface SystemStatus {
  secura: {
    configured: boolean;
    connected: boolean;
    host: string;
    error: string | null;
  };
  database: {
    connected: boolean;
  };
  readiness: {
    fullyOperational: boolean;
  };
}

interface ProcessStatus {
  id: string;
  name: string;
  status: 'completed' | 'pending' | 'running' | 'failed';
  lastRun?: string;
  nextRun?: string;
  savedTime?: string;
}

const mockProcesses: ProcessStatus[] = [
  { id: 'nav-reports', name: 'NAV-rapporter utskick', status: 'completed', lastRun: '2026-01-29 08:30', nextRun: '2026-01-30 08:30', savedTime: '45 min' },
  { id: 'notor', name: 'Notor (gårdagens flöden)', status: 'completed', lastRun: '2026-01-29 07:00', nextRun: '2026-01-30 07:00', savedTime: '20 min' },
  { id: 'subred', name: 'SubRed (dagens flöden)', status: 'pending', nextRun: '2026-01-29 15:00', savedTime: '25 min' },
  { id: 'price-data', name: 'Prisdata till institut', status: 'completed', lastRun: '2026-01-29 09:00', nextRun: '2026-01-30 09:00', savedTime: '15 min' },
  { id: 'owner-data', name: 'Ägardata (Clearstream)', status: 'completed', lastRun: '2026-01-29 09:15', nextRun: '2026-01-30 09:15', savedTime: '15 min' },
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
  onClick,
  color,
  badge
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType; 
  href?: string;
  onClick?: () => void;
  color: string;
  badge?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {badge && (
          <span className="px-2 py-1 bg-aifm-gold/10 text-aifm-gold text-xs font-medium rounded-full">
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-semibold text-aifm-charcoal mb-1">{title}</h3>
      <p className="text-sm text-aifm-charcoal/60">{description}</p>
      <div className="flex items-center gap-1 mt-3 text-aifm-gold text-sm font-medium">
        <span>Öppna</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-aifm-gold/30 hover:shadow-lg transition-all text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href || '#'}
      className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-aifm-gold/30 hover:shadow-lg transition-all"
    >
      {content}
    </Link>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function NAVAdminPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPriceDataModalOpen, setIsPriceDataModalOpen] = useState(false);
  
  // API data state
  const [fundNAVs, setFundNAVs] = useState<FundNAV[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [dataSource, setDataSource] = useState<string>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch NAV data from API
  const fetchNAVData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    
    try {
      // Fetch NAV data
      const navResponse = await fetch(`/api/nav/funds?date=${selectedDate}`);
      if (navResponse.ok) {
        const navData = await navResponse.json();
        if (navData.success) {
          setFundNAVs(navData.data.funds);
          setDataSource(navData.meta?.source || 'unknown');
        }
      }

      // Fetch system status
      const statusResponse = await fetch('/api/nav/status');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.success) {
          setSystemStatus(statusData.status);
        }
      }

      setError(null);
    } catch (err) {
      setError('Kunde inte hämta NAV-data');
      console.error('Error fetching NAV data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  // Fetch data on mount and when date changes
  useEffect(() => {
    fetchNAVData();
  }, [fetchNAVData]);

  // Handle NAV approval
  const handleApprove = async (requestId: string, comment?: string) => {
    try {
      const response = await fetch('/api/nav/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_first', // or 'approve_second' based on state
          approvalId: requestId,
          userId: 'current-user', // TODO: Get from auth
          userName: 'Användare', // TODO: Get from auth
          comment,
        }),
      });
      
      if (response.ok) {
        alert('NAV godkänt!');
        fetchNAVData(true);
      } else {
        throw new Error('Approval failed');
      }
    } catch (err) {
      alert('Kunde inte godkänna NAV');
      console.error('Approval error:', err);
    }
  };

  // Handle NAV rejection
  const handleReject = async (requestId: string, reason: string) => {
    try {
      const response = await fetch('/api/nav/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approvalId: requestId,
          userId: 'current-user',
          userName: 'Användare',
          reason,
        }),
      });
      
      if (response.ok) {
        alert('NAV avvisat');
        fetchNAVData(true);
      } else {
        throw new Error('Rejection failed');
      }
    } catch (err) {
      alert('Kunde inte avvisa NAV');
      console.error('Rejection error:', err);
    }
  };
  
  // Calculate totals from API data
  const totalAUMValue = fundNAVs.reduce((sum, fund) => sum + fund.netAssetValue, 0);
  const uniqueFundIds = new Set(fundNAVs.map(f => f.fundName.split(' ').slice(0, -1).join(' ')));
  
  const totalTimeSaved = mockProcesses.reduce((sum, p) => {
    if (p.savedTime) {
      const minutes = parseInt(p.savedTime);
      return sum + (isNaN(minutes) ? 0 : minutes);
    }
    return sum;
  }, 0);

  return (
    <div className="space-y-8">
      {/* Connection Status Banner */}
      {systemStatus && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
          systemStatus.secura.connected 
            ? 'bg-emerald-50 border border-emerald-200' 
            : systemStatus.secura.configured
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-blue-50 border border-blue-200'
        }`}>
          {systemStatus.secura.connected ? (
            <>
              <Wifi className="w-5 h-5 text-emerald-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-800">SECURA ansluten</p>
                <p className="text-xs text-emerald-600">Live-data från {systemStatus.secura.host}</p>
              </div>
            </>
          ) : systemStatus.secura.configured ? (
            <>
              <WifiOff className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">SECURA ej tillgänglig</p>
                <p className="text-xs text-amber-600">{systemStatus.secura.error || 'Anslutningen misslyckades'}</p>
              </div>
            </>
          ) : (
            <>
              <Database className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">Demo-läge</p>
                <p className="text-xs text-blue-600">Konfigurera SECURA API-nyckel för live-data</p>
              </div>
              <Link
                href="/nav-admin/settings"
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Konfigurera
              </Link>
            </>
          )}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            dataSource === 'secura' ? 'bg-emerald-100 text-emerald-700' :
            dataSource === 'database' ? 'bg-purple-100 text-purple-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {dataSource === 'secura' ? 'SECURA' : dataSource === 'database' ? 'Databas' : 'Mock'}
          </span>
        </div>
      )}

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
          <button 
            onClick={() => fetchNAVData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span className="text-sm font-medium hidden sm:inline">Uppdatera data</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3" />
                <div className="h-7 bg-gray-200 rounded w-24 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </>
        ) : (
          <>
            <StatCard
              title="Totalt AUM"
              value={formatLargeCurrency(totalAUMValue)}
              subtitle="Alla fonder"
              icon={TrendingUp}
              color="gold"
            />
            <StatCard
              title="Fonder"
              value={uniqueFundIds.size.toString()}
              subtitle={`${fundNAVs.length} andelsklasser`}
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
          </>
        )}
      </div>

      {/* NAV Approval Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-aifm-gold" />
          <h2 className="text-lg font-semibold text-aifm-charcoal">Dagens NAV-godkännande</h2>
        </div>
        <NAVApprovalCard
          onApprove={handleApprove}
          onReject={handleReject}
          onViewDetails={(requestId) => {
            console.log('View details:', requestId);
          }}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-aifm-charcoal mb-4">Snabbåtgärder</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <QuickActionCard
            title="NAV-historik"
            description="Bläddra och exportera historiska NAV"
            icon={History}
            href="/nav-admin/history"
            color="bg-gradient-to-br from-indigo-500 to-indigo-600"
            badge="Nytt"
          />
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
            title="Prisdata & NAV"
            description="Hantera priskällor, import och rapporter"
            icon={Database}
            onClick={() => setIsPriceDataModalOpen(true)}
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
        
        {/* Tools & Analysis Section */}
        <h2 className="text-lg font-semibold text-aifm-charcoal mb-4 mt-8">Verktyg & Analys</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <QuickActionCard
            title="NAV-simulator"
            description="What-if analys för marknadsförändringar"
            icon={Calculator}
            href="/nav-admin/simulator"
            color="bg-gradient-to-br from-pink-500 to-pink-600"
            badge="Nytt"
          />
          <QuickActionCard
            title="Ändringslogg"
            description="Audit trail och spårbarhet"
            icon={ClipboardList}
            href="/nav-admin/audit"
            color="bg-gradient-to-br from-slate-500 to-slate-600"
            badge="Nytt"
          />
          <QuickActionCard
            title="E-postmallar"
            description="Anpassa NAV-rapporter och notiser"
            icon={Mail}
            href="/nav-admin/email-templates"
            color="bg-gradient-to-br from-sky-500 to-sky-600"
            badge="Nytt"
          />
        </div>

        {/* Investor Management Section */}
        <h2 className="text-lg font-semibold text-aifm-charcoal mb-4 mt-8">Investerarhantering</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <QuickActionCard
            title="Andelsägare"
            description="Visa och hantera fondernas andelsägare"
            icon={Users}
            href="/nav-admin/shareholders"
            color="bg-gradient-to-br from-violet-500 to-violet-600"
          />
          <QuickActionCard
            title="Ägardata export"
            description="Exportera ägardata för Clearstream"
            icon={Download}
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
        
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-aifm-gold mx-auto mb-3" />
            <p className="text-sm text-aifm-charcoal/60">Laddar NAV-data...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-red-600">{error}</p>
            <button 
              onClick={() => fetchNAVData(true)}
              className="mt-3 px-4 py-2 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              Försök igen
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">ISIN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Fond</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Valuta</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">NAV kurs</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Förändring</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">AUM</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Utst. andelar</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-aifm-charcoal/70 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fundNAVs.map((fund) => (
                  <tr key={fund.isin} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-aifm-charcoal/70">{fund.isin}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-aifm-charcoal">{fund.fundName}</span>
                        <span className="ml-1 text-xs text-aifm-charcoal/50">{fund.shareClassName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-aifm-charcoal/70">
                        {fund.currency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-aifm-charcoal">
                      {formatCurrency(fund.navPerShare)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-medium ${
                        fund.navChangePercent > 0 ? 'text-emerald-600' : 
                        fund.navChangePercent < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {fund.navChangePercent > 0 ? '+' : ''}{fund.navChangePercent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                      {formatLargeCurrency(fund.netAssetValue)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-aifm-charcoal/70">
                      {formatCurrency(fund.sharesOutstanding)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        fund.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        fund.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {fund.status === 'APPROVED' ? 'Godkänd' :
                         fund.status === 'PUBLISHED' ? 'Publicerad' : 'Preliminär'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* Price Data Modal */}
      <PriceDataModal
        isOpen={isPriceDataModalOpen}
        onClose={() => setIsPriceDataModalOpen(false)}
      />
    </div>
  );
}
