'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Wallet, 
  ArrowUpRight, ArrowDownRight, DollarSign,
  ChevronRight, RefreshCw, Download, BookOpen, Building2
} from 'lucide-react';
import { 
  mockFunds, getCommitmentsByFund, getPortfolioByFund,
  formatCurrency, formatPercentage, formatDate, Fund
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { CustomSelect } from '@/components/CustomSelect';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function FundOverviewPage() {
  const [selectedFund, setSelectedFund] = useState<Fund>(mockFunds[0]);
  const [refreshing, setRefreshing] = useState(false);

  const commitments = getCommitmentsByFund(selectedFund.id);
  const portfolio = getPortfolioByFund(selectedFund.id);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="heading-2">Fondöversikt</h1>
              <HelpTooltip 
                {...helpContent.fundDashboard}
                learnMoreLink="/guide#funds"
                position="bottom"
                size="md"
              />
            </div>
            <div className="flex items-center gap-4">
              <p className="text-aifm-charcoal/60">Övervaka fondprestanda, NAV och nyckeltal</p>
              <Link href="/guide#funds" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Guide
              </Link>
            </div>
          </div>
          
          {/* Fund Selector */}
          <div className="flex items-center gap-3">
            <CustomSelect
              options={mockFunds.map((fund) => ({
                value: fund.id,
                label: fund.name,
                icon: <Building2 className="w-4 h-4 text-aifm-gold" />
              }))}
              value={selectedFund.id}
              onChange={(value) => setSelectedFund(mockFunds.find(f => f.id === value) || mockFunds[0])}
              className="min-w-[280px]"
              variant="gold"
              size="md"
            />
            <button className="btn-outline py-2 px-4 flex items-center gap-2 hover:border-aifm-gold hover:text-aifm-gold transition-all duration-300">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera</span>
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wider text-white/60">NAV</span>
              <DollarSign className="w-5 h-5 text-white/40" />
            </div>
            <p className="text-3xl font-medium mb-1">{formatCurrency(selectedFund.nav, selectedFund.currency)}</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">+{selectedFund.irr}% IRR</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Committed</span>
              <Wallet className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal mb-1">{formatCurrency(selectedFund.committedCapital, selectedFund.currency)}</p>
            <p className="text-sm text-aifm-charcoal/60">{formatPercentage((selectedFund.committedCapital / selectedFund.targetSize) * 100)} of target</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Called</span>
              <ArrowUpRight className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal mb-1">{formatCurrency(selectedFund.calledCapital, selectedFund.currency)}</p>
            <p className="text-sm text-aifm-charcoal/60">{formatPercentage((selectedFund.calledCapital / selectedFund.committedCapital) * 100)} of committed</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-aifm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Distributed</span>
              <ArrowDownRight className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal mb-1">{formatCurrency(selectedFund.distributedCapital, selectedFund.currency)}</p>
            <p className="text-sm text-aifm-charcoal/60">DPI: {selectedFund.dpi.toFixed(2)}x</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-aifm-gold/5 rounded-xl p-5 border border-aifm-gold/20">
            <p className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60 mb-2">TVPI</p>
            <p className="text-2xl font-medium text-aifm-charcoal">{selectedFund.tvpi.toFixed(2)}x</p>
          </div>
          <div className="bg-aifm-gold/5 rounded-xl p-5 border border-aifm-gold/20">
            <p className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60 mb-2">DPI</p>
            <p className="text-2xl font-medium text-aifm-charcoal">{selectedFund.dpi.toFixed(2)}x</p>
          </div>
          <div className="bg-aifm-gold/5 rounded-xl p-5 border border-aifm-gold/20">
            <p className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60 mb-2">Net IRR</p>
            <p className="text-2xl font-medium text-green-600">+{selectedFund.irr}%</p>
          </div>
          <div className="bg-aifm-gold/5 rounded-xl p-5 border border-aifm-gold/20">
            <p className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60 mb-2">Vintage</p>
            <p className="text-2xl font-medium text-aifm-charcoal">{selectedFund.vintage}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Investors List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Investors</h3>
              <Link href="/investors" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {commitments.slice(0, 5).map((commitment) => (
                <div key={commitment.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-aifm-charcoal">{commitment.investor?.name}</p>
                      <p className="text-sm text-aifm-charcoal/60">{commitment.investor?.type.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-aifm-charcoal">{formatCurrency(commitment.committedAmount, selectedFund.currency)}</p>
                      <p className="text-sm text-aifm-charcoal/60">{formatPercentage(commitment.ownershipPercentage)} ownership</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-aifm-charcoal/50 mb-1">
                      <span>Called: {formatPercentage((commitment.calledAmount / commitment.committedAmount) * 100)}</span>
                      <span>{formatCurrency(commitment.calledAmount, selectedFund.currency)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div 
                        className="bg-aifm-gold rounded-full h-1.5 transition-all"
                        style={{ width: `${(commitment.calledAmount / commitment.committedAmount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Companies */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-aifm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Portfolio</h3>
              <Link href="/portfolio" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {portfolio.slice(0, 5).map((company) => {
                const gain = company.currentValuation - company.initialInvestment;
                const gainPercent = (gain / company.initialInvestment) * 100;
                return (
                  <div key={company.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-aifm-charcoal">{company.name}</p>
                        <p className="text-sm text-aifm-charcoal/60">{company.sector}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-aifm-charcoal">{formatCurrency(company.currentValuation, selectedFund.currency)}</p>
                        <p className={`text-sm ${gainPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-aifm-charcoal/50">
                      <span>{company.country}</span>
                      <span>•</span>
                      <span>{formatPercentage(company.ownership)} ownership</span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        company.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        company.status === 'REALIZED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {company.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Fund Details */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-aifm p-6">
          <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-6">Fund Details</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Fund Type</p>
              <p className="font-medium text-aifm-charcoal">{selectedFund.type.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Status</p>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                selectedFund.status === 'INVESTING' ? 'bg-green-100 text-green-700' :
                selectedFund.status === 'RAISING' ? 'bg-blue-100 text-blue-700' :
                selectedFund.status === 'HARVESTING' ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {selectedFund.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Management Fee</p>
              <p className="font-medium text-aifm-charcoal">{selectedFund.managementFee}%</p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Carried Interest</p>
              <p className="font-medium text-aifm-charcoal">{selectedFund.carriedInterest}%</p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Target Size</p>
              <p className="font-medium text-aifm-charcoal">{formatCurrency(selectedFund.targetSize, selectedFund.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Currency</p>
              <p className="font-medium text-aifm-charcoal">{selectedFund.currency}</p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Vintage Year</p>
              <p className="font-medium text-aifm-charcoal">{selectedFund.vintage}</p>
            </div>
            <div>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Inception Date</p>
              <p className="font-medium text-aifm-charcoal">{formatDate(selectedFund.createdAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

