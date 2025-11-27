'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, TrendingUp, TrendingDown, Globe,
  Download, Search, Plus, Eye, LayoutGrid, List,
  Calendar, Wallet, ArrowUpRight, ChevronRight
} from 'lucide-react';
import {
  getFundByCompanyId, getPortfolioByCompanyId,
  formatCurrency, formatPercentage, formatDate, PortfolioCompany
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Metric Card with hover glow
function MetricCard({ 
  label, 
  value, 
  subLabel,
  trend,
  variant = 'default',
  icon: Icon
}: { 
  label: string; 
  value: string; 
  subLabel?: string;
  trend?: { value: string; positive: boolean };
  variant?: 'default' | 'primary';
  icon: React.ElementType;
}) {
  const isPrimary = variant === 'primary';
  
  return (
    <div className={`
      relative group rounded-2xl p-6 transition-all duration-500
      ${isPrimary 
        ? 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20' 
        : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20 hover:-translate-y-0.5'
      }
    `}>
      {/* Subtle animated glow */}
      {!isPrimary && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl ${isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'} transition-colors duration-300`}>
            <Icon className={`w-5 h-5 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold'} transition-colors duration-300`} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
              trend.positive 
                ? isPrimary ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                : isPrimary ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600'
            }`}>
              {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
            </div>
          )}
        </div>
        
        <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>
          {value}
        </p>
        {subLabel && (
          <p className={`text-sm mt-2 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/40'}`}>{subLabel}</p>
        )}
      </div>
    </div>
  );
}

// Company Card
function CompanyCard({ 
  company, 
  currency, 
  onClick 
}: { 
  company: PortfolioCompany; 
  currency: string;
  onClick: () => void;
}) {
  const gain = company.currentValuation - company.initialInvestment;
  const gainPercent = (gain / company.initialInvestment) * 100;
  
  return (
    <div 
      onClick={onClick}
      className="group bg-white rounded-2xl border border-gray-100/50 overflow-hidden 
                 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20 
                 hover:-translate-y-1 transition-all duration-500 cursor-pointer"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-aifm-charcoal/5 to-aifm-charcoal/10 rounded-xl 
                            flex items-center justify-center group-hover:from-aifm-gold/10 group-hover:to-aifm-gold/20 transition-all duration-300">
              <Building2 className="w-6 h-6 text-aifm-charcoal/60 group-hover:text-aifm-gold transition-colors duration-300" />
            </div>
            <div>
              <h3 className="font-semibold text-aifm-charcoal group-hover:text-aifm-gold transition-colors duration-300">
                {company.name}
              </h3>
              <p className="text-sm text-aifm-charcoal/50">{company.sector}</p>
            </div>
          </div>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            company.status === 'ACTIVE' 
              ? 'bg-emerald-50 text-emerald-600' 
              : company.status === 'REALIZED' 
                ? 'bg-blue-50 text-blue-600' 
                : 'bg-gray-100 text-gray-600'
          }`}>
            {company.status === 'ACTIVE' ? 'Aktiv' : company.status === 'REALIZED' ? 'Realiserad' : company.status}
          </span>
        </div>

        {/* Metrics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-aifm-charcoal/50">Nuvarande värde</span>
            <span className="text-lg font-semibold text-aifm-charcoal">{formatCurrency(company.currentValuation, currency)}</span>
          </div>
          
          <div className="h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-aifm-charcoal/50">Investerat</span>
            <span className="text-sm text-aifm-charcoal">{formatCurrency(company.initialInvestment, currency)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-aifm-charcoal/50">Avkastning</span>
            <span className={`text-sm font-semibold flex items-center gap-1 ${gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {gainPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100/50">
        <div className="flex items-center justify-between text-xs text-aifm-charcoal/40">
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            {company.country}
          </span>
          <span>{formatPercentage(company.ownership)} ägande</span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(company.investmentDate)}
          </span>
        </div>
      </div>

      {/* Metrics Row - if available */}
      {company.metrics && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { label: 'Omsättning', value: company.metrics.revenue ? `${(company.metrics.revenue / 1000000).toFixed(1)}M` : '-' },
              { label: 'EBITDA', value: company.metrics.ebitda ? `${(company.metrics.ebitda / 1000000).toFixed(1)}M` : '-', negative: (company.metrics.ebitda || 0) < 0 },
              { label: 'Anställda', value: company.metrics.employees?.toString() || '-' },
              { label: 'Tillväxt', value: company.metrics.growth ? `+${company.metrics.growth}%` : '-', positive: true },
            ].map((metric) => (
              <div key={metric.label}>
                <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider mb-1">{metric.label}</p>
                <p className={`text-sm font-semibold ${
                  metric.negative ? 'text-red-600' : metric.positive ? 'text-emerald-600' : 'text-aifm-charcoal'
                }`}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// View Mode Tabs
function ViewModeTabs({ 
  value, 
  onChange 
}: { 
  value: 'grid' | 'table'; 
  onChange: (value: 'grid' | 'table') => void;
}) {
  return (
    <div className="inline-flex bg-gray-100/80 rounded-xl p-1">
      <button
        onClick={() => onChange('grid')}
        className={`p-2.5 rounded-lg transition-all duration-300 ${
          value === 'grid' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('table')}
        className={`p-2.5 rounded-lg transition-all duration-300 ${
          value === 'table' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
        }`}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function PortfolioPage() {
  const { selectedCompany } = useCompany();
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedPortfolioCompany, setSelectedPortfolioCompany] = useState<PortfolioCompany | null>(null);

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const portfolio = getPortfolioByCompanyId(selectedCompany.id);
  const currency = selectedFund?.currency || 'SEK';
  
  // Filter by search
  const filteredPortfolio = portfolio.filter(pc => 
    pc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pc.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Calculate metrics
  const totalInvested = portfolio.reduce((sum, pc) => sum + pc.initialInvestment, 0);
  const totalValue = portfolio.reduce((sum, pc) => sum + pc.currentValuation, 0);
  const unrealizedGain = totalValue - totalInvested;
  const unrealizedGainPercent = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
  const activeCompanies = portfolio.filter(pc => pc.status === 'ACTIVE').length;

  // Group by sector
  const bySector = portfolio.reduce((acc, pc) => {
    acc[pc.sector] = (acc[pc.sector] || 0) + pc.currentValuation;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Portfölj</h1>
          <p className="text-aifm-charcoal/40 mt-2">Följ portföljbolagens utveckling och värderingar</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                             bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                             hover:text-aifm-charcoal transition-all duration-300">
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                             bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                             shadow-lg shadow-aifm-charcoal/20 transition-all duration-300">
            <Plus className="w-4 h-4" />
            Lägg till bolag
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          label="Portföljvärde" 
          value={formatCurrency(totalValue, currency)}
          trend={{ value: formatPercentage(unrealizedGainPercent), positive: unrealizedGainPercent >= 0 }}
          variant="primary"
          icon={Wallet}
        />
        <MetricCard 
          label="Totalt investerat" 
          value={formatCurrency(totalInvested, currency)}
          subLabel={`Fördelat på ${portfolio.length} bolag`}
          icon={ArrowUpRight}
        />
        <MetricCard 
          label="Orealiserad vinst" 
          value={`${unrealizedGain >= 0 ? '+' : ''}${formatCurrency(unrealizedGain, currency)}`}
          trend={{ value: formatPercentage(unrealizedGainPercent), positive: unrealizedGain >= 0 }}
          icon={TrendingUp}
        />
        <MetricCard 
          label="Aktiva bolag" 
          value={activeCompanies.toString()}
          subLabel={`av ${portfolio.length} totalt`}
          icon={Building2}
        />
      </div>

      {/* Sector Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100/50 p-8 mb-10 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Sektorfördelning</h2>
          <Link href="/portfolio/sectors" className="text-xs text-aifm-charcoal/40 hover:text-aifm-gold flex items-center gap-1 transition-colors">
            Detaljer <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {Object.entries(bySector).map(([sector, value]) => {
            const percentage = (value / totalValue) * 100;
            return (
              <div key={sector} className="group">
                <div className="p-4 bg-gray-50/50 rounded-xl hover:bg-gray-50 transition-colors duration-300">
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-3 truncate">{sector}</p>
                  <p className="text-xl font-semibold text-aifm-charcoal mb-3">{formatPercentage(percentage)}</p>
                  <div className="w-full bg-gray-200/50 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-aifm-gold rounded-full h-1.5 transition-all duration-700 group-hover:shadow-sm group-hover:shadow-aifm-gold/50"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="relative">
          <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Sök bolag eller sektor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 py-3 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm
                       placeholder:text-aifm-charcoal/30 focus:outline-none focus:border-aifm-gold/30 
                       focus:ring-2 focus:ring-aifm-gold/10 transition-all duration-300"
          />
        </div>
        <ViewModeTabs value={viewMode} onChange={setViewMode} />
      </div>

      {/* Portfolio Content */}
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPortfolio.map((company) => (
            <CompanyCard 
              key={company.id} 
              company={company} 
              currency={currency}
              onClick={() => setSelectedPortfolioCompany(company)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Bolag</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Sektor</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Investerat</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Värde</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Avkastning</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Ägande</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPortfolio.map((company) => {
                  const gain = company.currentValuation - company.initialInvestment;
                  const gainPercent = (gain / company.initialInvestment) * 100;
                  return (
                    <tr key={company.id} className="hover:bg-gray-50/50 transition-colors duration-200">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-aifm-charcoal/5 rounded-xl flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-aifm-charcoal/50" />
                          </div>
                          <div>
                            <p className="font-medium text-aifm-charcoal">{company.name}</p>
                            <p className="text-xs text-aifm-charcoal/40">{company.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-aifm-charcoal/70">{company.sector}</td>
                      <td className="px-6 py-5 text-sm text-aifm-charcoal text-right">{formatCurrency(company.initialInvestment, currency)}</td>
                      <td className="px-6 py-5 text-sm font-semibold text-aifm-charcoal text-right">{formatCurrency(company.currentValuation, currency)}</td>
                      <td className={`px-6 py-5 text-sm font-semibold text-right ${gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
                      </td>
                      <td className="px-6 py-5 text-sm text-aifm-charcoal text-center">{formatPercentage(company.ownership)}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          company.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' :
                          company.status === 'REALIZED' ? 'bg-blue-50 text-blue-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {company.status === 'ACTIVE' ? 'Aktiv' : company.status === 'REALIZED' ? 'Realiserad' : company.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button className="p-2 text-aifm-charcoal/30 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-all duration-300">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
