'use client';


import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, FileText, Receipt, Clock, 
  CheckCircle2, AlertTriangle, Building2, Sparkles,
  Download, Calendar, ChevronDown, BarChart3, PieChart,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Users
} from 'lucide-react';
import { useCompany } from '@/components/CompanyContext';

// ============ Types ============
interface DashboardKPIs {
  totalDocuments: number;
  documentsThisMonth: number;
  pendingReview: number;
  autoApprovedRate: number;
  totalAmountThisMonth: number;
  totalAmountLastMonth: number;
  monthOverMonthChange: number;
  invoiceCount: number;
  receiptCount: number;
  otherCount: number;
  averageConfidence: number;
  anomalyRate: number;
  processingTimeAvg: number;
  uniqueSuppliers: number;
  topSuppliers: { name: string; amount: number; count: number }[];
  monthlyTrends: {
    month: string;
    documentCount: number;
    totalAmount: number;
    autoApproved: number;
  }[];
}

// ============ Helpers ============
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('sv-SE').format(value);
}

// ============ Components ============

function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  trend,
  trendValue,
  color = 'gray'
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'gray' | 'green' | 'blue' | 'amber' | 'red' | 'purple';
}) {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-600',
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm font-medium ${
            trend === 'up' ? 'text-emerald-600' : 
            trend === 'down' ? 'text-red-600' : 
            'text-gray-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" /> : 
             trend === 'down' ? <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" /> :
             <Minus className="w-3 h-3 sm:w-4 sm:h-4" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className="mt-3 sm:mt-4">
        <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{title}</p>
        {subtitle && (
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function TrendChart({ data }: { data: DashboardKPIs['monthlyTrends'] }) {
  const maxAmount = Math.max(...data.map(d => d.totalAmount), 1);
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Månadstrend</h3>
          <p className="text-sm text-gray-500">Senaste 6 månaderna</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-aifm-gold" />
            <span className="text-gray-600">Belopp</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-gray-600">Auto-godkända</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-end justify-between gap-2 h-48">
        {data.map((month, i) => {
          const heightPercent = (month.totalAmount / maxAmount) * 100;
          const autoPercent = month.documentCount > 0 
            ? (month.autoApproved / month.documentCount) * 100 
            : 0;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full h-40 flex flex-col items-center justify-end">
                {/* Amount bar */}
                <div 
                  className="w-full max-w-[40px] bg-gradient-to-t from-aifm-gold to-aifm-gold/60 rounded-t-lg transition-all duration-500 relative group"
                  style={{ height: `${Math.max(heightPercent, 5)}%` }}
                >
                  {/* Tooltip */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {formatCurrency(month.totalAmount)}
                  </div>
                  {/* Auto-approved indicator */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-lg"
                    style={{ height: `${autoPercent}%` }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-600">
                  {month.month.split(' ')[0].slice(0, 3)}
                </p>
                <p className="text-[10px] text-gray-400">{month.documentCount} dok</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopSuppliersCard({ suppliers }: { suppliers: DashboardKPIs['topSuppliers'] }) {
  const maxAmount = Math.max(...suppliers.map(s => s.amount), 1);
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Top leverantörer</h3>
          <p className="text-sm text-gray-500">Högst belopp denna period</p>
        </div>
        <Building2 className="w-5 h-5 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        {suppliers.slice(0, 5).map((supplier, i) => {
          const widthPercent = (supplier.amount / maxAmount) * 100;
          
          return (
            <div key={i} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">
                  {supplier.name}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(supplier.amount)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-aifm-gold to-aifm-gold/70 rounded-full transition-all duration-500 group-hover:from-aifm-charcoal group-hover:to-aifm-charcoal/70"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{supplier.count} fakturor</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentTypeChart({ invoices, receipts, other }: { invoices: number; receipts: number; other: number }) {
  const total = invoices + receipts + other;
  const invoicePercent = total > 0 ? (invoices / total) * 100 : 0;
  const receiptPercent = total > 0 ? (receipts / total) * 100 : 0;
  const otherPercent = total > 0 ? (other / total) * 100 : 0;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Dokumenttyper</h3>
          <p className="text-sm text-gray-500">Fördelning</p>
        </div>
        <PieChart className="w-5 h-5 text-gray-400" />
      </div>
      
      {/* Simple bar chart */}
      <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
        <div 
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${invoicePercent}%` }}
        />
        <div 
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${receiptPercent}%` }}
        />
        <div 
          className="h-full bg-gray-400 transition-all duration-500"
          style={{ width: `${otherPercent}%` }}
        />
      </div>
      
      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-600">Fakturor</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{invoices}</p>
          <p className="text-xs text-gray-400">{invoicePercent.toFixed(0)}%</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-600">Kvitton</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{receipts}</p>
          <p className="text-xs text-gray-400">{receiptPercent.toFixed(0)}%</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span className="text-xs text-gray-600">Övrigt</span>
          </div>
          <p className="text-lg font-bold text-gray-900">{other}</p>
          <p className="text-xs text-gray-400">{otherPercent.toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}

function AIPerformanceCard({ confidence, anomalyRate, processingTime }: {
  confidence: number;
  anomalyRate: number;
  processingTime: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">AI-prestanda</h3>
          <p className="text-sm text-gray-500">Klassificeringskvalitet</p>
        </div>
        <Sparkles className="w-5 h-5 text-aifm-gold" />
      </div>
      
      <div className="space-y-4">
        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Genomsnittlig säkerhet</span>
            <span className={`text-sm font-bold ${
              confidence >= 0.9 ? 'text-emerald-600' :
              confidence >= 0.7 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {formatPercent(confidence)}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                confidence >= 0.9 ? 'bg-emerald-500' :
                confidence >= 0.7 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>
        
        {/* Anomaly rate */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Anomalifrekvens</span>
            <span className={`text-sm font-bold ${
              anomalyRate <= 0.05 ? 'text-emerald-600' :
              anomalyRate <= 0.15 ? 'text-amber-600' :
              'text-red-600'
            }`}>
              {formatPercent(anomalyRate)}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                anomalyRate <= 0.05 ? 'bg-emerald-500' :
                anomalyRate <= 0.15 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(anomalyRate * 100, 100)}%` }}
            />
          </div>
        </div>
        
        {/* Processing time */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Snittid per dokument</span>
            <span className="text-sm font-bold text-gray-900">{processingTime.toFixed(1)}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Component ============

export default function AccountingDashboardPage() {
  const { selectedCompany } = useCompany();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounting/reports?companyId=${selectedCompany.id}&type=dashboard`);
      if (!response.ok) throw new Error('Failed to load dashboard');
      const data = await response.json();
      setKpis(data.kpis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedCompany.id]);

  if (isLoading) {
    return (
      <>
        <div className="h-[calc(100vh-120px)] flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-aifm-gold animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Laddar dashboard...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !kpis) {
    return (
      <>
        <div className="h-[calc(100vh-120px)] flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">{error || 'Kunde inte ladda data'}</p>
            <button 
              onClick={loadDashboard}
              className="mt-4 px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90"
            >
              Försök igen
            </button>
          </div>
        </div>
      </>
    );
  }

  const amountTrend = kpis.monthOverMonthChange >= 0 ? 'up' : 'down';
  const amountTrendValue = `${kpis.monthOverMonthChange >= 0 ? '+' : ''}${formatPercent(kpis.monthOverMonthChange)}`;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Bokföringsöversikt</h1>
            <p className="text-sm text-gray-500 mt-1 truncate">
              Dashboard för {selectedCompany.name}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={loadDashboard}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Uppdatera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <a
              href={`/api/accounting/reports?companyId=${selectedCompany.id}&type=monthly&format=csv`}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera</span>
            </a>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Dokument denna månad"
            value={kpis.documentsThisMonth}
            subtitle={`${kpis.totalDocuments} totalt`}
            icon={FileText}
            color="blue"
          />
          <StatCard
            title="Belopp denna månad"
            value={formatCurrency(kpis.totalAmountThisMonth)}
            icon={TrendingUp}
            trend={amountTrend}
            trendValue={amountTrendValue}
            color="green"
          />
          <StatCard
            title="Väntar på granskning"
            value={kpis.pendingReview}
            subtitle="Kräver åtgärd"
            icon={Clock}
            color={kpis.pendingReview > 10 ? 'amber' : 'gray'}
          />
          <StatCard
            title="Auto-godkända"
            value={formatPercent(kpis.autoApprovedRate)}
            subtitle="Sparad arbetstid"
            icon={CheckCircle2}
            color="green"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <TrendChart data={kpis.monthlyTrends} />
          <TopSuppliersCard suppliers={kpis.topSuppliers} />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <DocumentTypeChart 
            invoices={kpis.invoiceCount}
            receipts={kpis.receiptCount}
            other={kpis.otherCount}
          />
          <AIPerformanceCard
            confidence={kpis.averageConfidence}
            anomalyRate={kpis.anomalyRate}
            processingTime={kpis.processingTimeAvg}
          />
          
          {/* Quick Stats */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Snabbstatistik</h3>
                <p className="text-sm text-gray-500">Nyckeltal</p>
              </div>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Unika leverantörer</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{kpis.uniqueSuppliers}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Receipt className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Fakturor</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{kpis.invoiceCount}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Kvitton</span>
                </div>
                <span className="text-lg font-bold text-gray-900">{kpis.receiptCount}</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="text-sm text-gray-600">Med anomalier</span>
                </div>
                <span className="text-lg font-bold text-amber-600">
                  {Math.round(kpis.totalDocuments * kpis.anomalyRate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
