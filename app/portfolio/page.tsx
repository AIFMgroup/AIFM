'use client';

import { useState } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, Globe,
  Download, Filter, Search,
  Eye, BarChart3, PieChart,
  Calendar, DollarSign, Briefcase
} from 'lucide-react';
import { formatCurrency, formatPercentage, formatDate } from '@/lib/fundData';
import type { Fund, PortfolioCompany } from '@/lib/fundData';
import { useFundsData, getPortfolioByFund } from '@/lib/fundsApi';
import { CustomSelect } from '@/components/CustomSelect';
import { PageHeader, SecondaryButton } from '@/components/shared/PageHeader';
import { Skeleton, EmptyState } from '@/components/ui/design-system';

export default function PortfolioPage() {
  const { data, loading, error } = useFundsData();
  const [selectedFundId, setSelectedFundId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedCompany, setSelectedCompany] = useState<PortfolioCompany | null>(null);

  const funds = data?.funds ?? [];
  const selectedFund = funds.find((f) => f.id === selectedFundId) ?? funds[0];
  const portfolio = data && selectedFund ? getPortfolioByFund(data, selectedFund.id) : [];

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/95 -m-2 sm:-m-4 p-2 sm:p-4">
        <div className="flex flex-wrap gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 flex-1 min-w-[140px] rounded-xl bg-white/10" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-white/10" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/95 -m-2 sm:-m-4 p-2 sm:p-4 flex items-center justify-center text-white">
        {error?.message ?? 'Kunde inte ladda fonddata'}
      </div>
    );
  }
  if (funds.length === 0) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/95 -m-2 sm:-m-4 p-2 sm:p-4 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md">
          <EmptyState
            icon={<Briefcase className="w-8 h-8 text-aifm-gold" />}
            title="Inga fonder att visa"
            description="Välj en fond eller lägg till portföljbolag för att se data."
          />
        </div>
      </div>
    );
  }
  
  // Calculate portfolio metrics
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
    <div className="w-full min-h-screen bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/95 -m-2 sm:-m-4 p-2 sm:p-4">
      <PageHeader
        title="Portföljövervakning"
        description="Följ portföljbolagens utveckling och värderingar"
        breadcrumbs={[
          { label: 'Fond' },
          { label: 'Portfölj' }
        ]}
        stats={[
          { 
            label: 'Portfolio Value', 
            value: formatCurrency(totalValue, selectedFund.currency), 
            icon: PieChart,
            trend: unrealizedGainPercent !== 0 ? { 
              value: `${unrealizedGainPercent >= 0 ? '+' : ''}${formatPercentage(unrealizedGainPercent)}`, 
              positive: unrealizedGainPercent >= 0 
            } : undefined
          },
          { 
            label: 'Totalt investerat', 
            value: formatCurrency(totalInvested, selectedFund.currency),
            subValue: `Across ${portfolio.length} investments`,
            icon: DollarSign 
          },
          { 
            label: 'Unrealized Gain', 
            value: `${unrealizedGain >= 0 ? '+' : ''}${formatCurrency(unrealizedGain, selectedFund.currency)}`,
            subValue: `${formatPercentage(unrealizedGainPercent)} return`,
            icon: TrendingUp 
          },
          { 
            label: 'Aktiva bolag', 
            value: activeCompanies.toString(),
            subValue: `of ${portfolio.length} total`,
            icon: Building2 
          },
        ]}
        actions={
          <>
            <CustomSelect
              options={funds.map((fund) => ({
                value: fund.id,
                label: fund.name,
                icon: <Briefcase className="w-4 h-4 text-aifm-gold" />
              }))}
              value={selectedFundId || selectedFund.id}
              onChange={(value) => setSelectedFundId(value)}
              className="min-w-[200px]"
              variant="minimal"
              size="md"
            />
            <SecondaryButton icon={Download}>Exportera</SecondaryButton>
          </>
        }
      />

      {/* Sector Breakdown */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
        <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-6">Sektorallokering</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(bySector).map(([sector, value]) => {
            const percentage = (value / totalValue) * 100;
            return (
              <div key={sector} className="p-4 bg-white/10 rounded-xl">
                <p className="text-xs text-white/60 uppercase tracking-wider mb-2 truncate">{sector}</p>
                <p className="text-lg font-medium text-white">{formatPercentage(percentage)}</p>
                <div className="w-full bg-white/20 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-aifm-gold rounded-full h-1.5"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* View Toggle & Search */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Sök bolag..."
              className="py-2.5 pl-10 pr-4 w-64 bg-white/10 border border-white/20 rounded-xl text-sm text-white
                         placeholder:text-white/40 focus:outline-none focus:border-aifm-gold/50 
                         focus:ring-2 focus:ring-aifm-gold/20 transition-all"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white/70 
                             bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all">
            <Filter className="w-4 h-4" />
            Filtrera
          </button>
        </div>
        <div className="flex items-center gap-2 bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-white/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-white/60'
            }`}
          >
            <Briefcase className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Portfolio Grid */}
      {viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolio.map((company) => {
            const gain = company.currentValuation - company.initialInvestment;
            const gainPercent = (gain / company.initialInvestment) * 100;
            return (
              <div 
                key={company.id}
                className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/15 transition-all cursor-pointer group"
                onClick={() => setSelectedCompany(company)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-aifm-gold/20 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-aifm-gold" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white group-hover:text-aifm-gold transition-colors">
                          {company.name}
                        </h3>
                        <p className="text-sm text-white/60">{company.sector}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      company.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                      company.status === 'REALIZED' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-white/10 text-white/70'
                    }`}>
                      {company.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Current Value</span>
                      <span className="font-medium text-white">{formatCurrency(company.currentValuation, selectedFund.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Invested</span>
                      <span className="text-sm text-white">{formatCurrency(company.initialInvestment, selectedFund.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Return</span>
                      <span className={`font-medium ${gainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-white/50">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {company.country}
                      </span>
                      <span>{formatPercentage(company.ownership)} ownership</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(company.investmentDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {company.metrics && (
                  <div className="px-6 py-4 bg-white/5 rounded-b-2xl border-t border-white/10">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider">Revenue</p>
                        <p className="font-medium text-white text-sm">{company.metrics.revenue ? `${(company.metrics.revenue / 1000000).toFixed(1)}M` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider">EBITDA</p>
                        <p className={`font-medium text-sm ${(company.metrics.ebitda || 0) >= 0 ? 'text-white' : 'text-red-400'}`}>
                          {company.metrics.ebitda ? `${(company.metrics.ebitda / 1000000).toFixed(1)}M` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider">Team</p>
                        <p className="font-medium text-white text-sm">{company.metrics.employees || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 uppercase tracking-wider">Growth</p>
                        <p className="font-medium text-green-400 text-sm">
                          {company.metrics.growth ? `+${company.metrics.growth}%` : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Company</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Sector</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Invested</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Current Value</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Return</th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Ownership</th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {portfolio.map((company) => {
                  const gain = company.currentValuation - company.initialInvestment;
                  const gainPercent = (gain / company.initialInvestment) * 100;
                  return (
                    <tr key={company.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-aifm-gold/20 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-aifm-gold" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{company.name}</p>
                            <p className="text-xs text-white/50">{company.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white">{company.sector}</td>
                      <td className="px-6 py-4 text-sm text-white text-right">{formatCurrency(company.initialInvestment, selectedFund.currency)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-white text-right">{formatCurrency(company.currentValuation, selectedFund.currency)}</td>
                      <td className={`px-6 py-4 text-sm font-medium text-right ${gainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
                      </td>
                      <td className="px-6 py-4 text-sm text-white text-center">{formatPercentage(company.ownership)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          company.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          company.status === 'REALIZED' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-white/10 text-white/70'
                        }`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 text-white/40 hover:text-aifm-gold hover:bg-aifm-gold/20 rounded-lg transition-colors">
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
    </div>
  );
}
