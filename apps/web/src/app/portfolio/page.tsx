'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, TrendingUp, TrendingDown, Globe,
  Download, Filter, Search,
  Plus, Eye, BarChart3, PieChart,
  Calendar, DollarSign, Briefcase, BookOpen
} from 'lucide-react';
import {
  mockFunds, getPortfolioByFund,
  formatCurrency, formatPercentage, formatDate, Fund, PortfolioCompany
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { CustomSelect } from '@/components/CustomSelect';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function PortfolioPage() {
  const [selectedFund, setSelectedFund] = useState<Fund>(mockFunds[0]);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedCompany, setSelectedCompany] = useState<PortfolioCompany | null>(null);

  const portfolio = getPortfolioByFund(selectedFund.id);
  
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
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Portföljövervakning</h1>
            <HelpTooltip 
              {...helpContent.portfolio}
              learnMoreLink="/guide#portfolio"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">Följ portföljbolagens utveckling och värderingar</p>
            <Link href="/guide#portfolio" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <CustomSelect
            options={mockFunds.map((fund) => ({
              value: fund.id,
              label: fund.name,
              icon: <Briefcase className="w-4 h-4 text-aifm-gold" />
            }))}
            value={selectedFund.id}
            onChange={(value) => {
              const fund = mockFunds.find(f => f.id === value);
              if (fund) setSelectedFund(fund);
            }}
            className="min-w-[280px]"
            variant="gold"
            size="md"
          />
          <button className="btn-outline py-2 px-4 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button className="btn-primary py-2 px-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Lägg till bolag
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-white/60">Portfolio Value</span>
            <PieChart className="w-5 h-5 text-white/40" />
          </div>
          <p className="text-3xl font-medium">{formatCurrency(totalValue, selectedFund.currency)}</p>
          <div className="flex items-center gap-2 mt-2">
            {unrealizedGainPercent >= 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">+{formatPercentage(unrealizedGainPercent)}</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">{formatPercentage(unrealizedGainPercent)}</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Totalt investerat</span>
            <DollarSign className="w-5 h-5 text-aifm-charcoal/30" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(totalInvested, selectedFund.currency)}</p>
          <p className="text-sm text-aifm-charcoal/60 mt-2">Across {portfolio.length} investments</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Unrealized Gain</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className={`text-2xl font-medium ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {unrealizedGain >= 0 ? '+' : ''}{formatCurrency(unrealizedGain, selectedFund.currency)}
          </p>
          <p className="text-sm text-aifm-charcoal/60 mt-2">{formatPercentage(unrealizedGainPercent)} return</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Aktiva bolag</span>
            <Building2 className="w-5 h-5 text-aifm-charcoal/30" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{activeCompanies}</p>
          <p className="text-sm text-aifm-charcoal/60 mt-2">of {portfolio.length} total</p>
        </div>
      </div>

      {/* Sector Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
        <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-6">Sector Allocation</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(bySector).map(([sector, value]) => {
            const percentage = (value / totalValue) * 100;
            return (
              <div key={sector} className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-aifm-charcoal/60 uppercase tracking-wider mb-2 truncate">{sector}</p>
                <p className="text-lg font-medium text-aifm-charcoal">{formatPercentage(percentage)}</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
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
            <Search className="w-4 h-4 text-aifm-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Sök bolag..."
              className="input py-2 pl-10 pr-4 w-64"
            />
          </div>
          <button className="btn-outline py-2 px-4 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtrera
          </button>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'table' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/60'
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
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => setSelectedCompany(company)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-aifm-gold/10 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-aifm-gold" />
                      </div>
                      <div>
                        <h3 className="font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">
                          {company.name}
                        </h3>
                        <p className="text-sm text-aifm-charcoal/60">{company.sector}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      company.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      company.status === 'REALIZED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {company.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-aifm-charcoal/60">Current Value</span>
                      <span className="font-medium text-aifm-charcoal">{formatCurrency(company.currentValuation, selectedFund.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-aifm-charcoal/60">Invested</span>
                      <span className="text-sm text-aifm-charcoal">{formatCurrency(company.initialInvestment, selectedFund.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-aifm-charcoal/60">Return</span>
                      <span className={`font-medium ${gainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs text-aifm-charcoal/50">
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
                  <div className="px-6 py-4 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Revenue</p>
                        <p className="font-medium text-aifm-charcoal text-sm">{company.metrics.revenue ? `${(company.metrics.revenue / 1000000).toFixed(1)}M` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">EBITDA</p>
                        <p className={`font-medium text-sm ${(company.metrics.ebitda || 0) >= 0 ? 'text-aifm-charcoal' : 'text-red-600'}`}>
                          {company.metrics.ebitda ? `${(company.metrics.ebitda / 1000000).toFixed(1)}M` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Team</p>
                        <p className="font-medium text-aifm-charcoal text-sm">{company.metrics.employees || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Growth</p>
                        <p className="font-medium text-green-600 text-sm">
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Company</th>
                  <th className="text-left px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Sector</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Invested</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Current Value</th>
                  <th className="text-right px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Return</th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Ownership</th>
                  <th className="text-center px-6 py-4 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {portfolio.map((company) => {
                  const gain = company.currentValuation - company.initialInvestment;
                  const gainPercent = (gain / company.initialInvestment) * 100;
                  return (
                    <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-aifm-gold" />
                          </div>
                          <div>
                            <p className="font-medium text-aifm-charcoal">{company.name}</p>
                            <p className="text-xs text-aifm-charcoal/50">{company.country}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-aifm-charcoal">{company.sector}</td>
                      <td className="px-6 py-4 text-sm text-aifm-charcoal text-right">{formatCurrency(company.initialInvestment, selectedFund.currency)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-aifm-charcoal text-right">{formatCurrency(company.currentValuation, selectedFund.currency)}</td>
                      <td className={`px-6 py-4 text-sm font-medium text-right ${gainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
                      </td>
                      <td className="px-6 py-4 text-sm text-aifm-charcoal text-center">{formatPercentage(company.ownership)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          company.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                          company.status === 'REALIZED' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {company.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-2 text-aifm-charcoal/40 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-colors">
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
