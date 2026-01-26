'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Wallet, 
  ArrowUpRight, ArrowDownRight, DollarSign,
  ChevronRight, Download, Building2, Briefcase, BarChart3
} from 'lucide-react';
import { 
  mockFunds, getCommitmentsByFund, getPortfolioByFund,
  formatCurrency, formatPercentage, formatDate, Fund
} from '@/lib/fundData';
import { CustomSelect } from '@/components/CustomSelect';
import { PageHeader, SecondaryButton } from '@/components/shared/PageHeader';

export default function FundOverviewPage() {
  const [selectedFund, setSelectedFund] = useState<Fund>(mockFunds[0]);

  const commitments = getCommitmentsByFund(selectedFund.id);
  const portfolio = getPortfolioByFund(selectedFund.id);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/95 -m-2 sm:-m-4 p-2 sm:p-4">
      <PageHeader
        title="Fondöversikt"
        description="Övervaka fondprestanda, NAV och nyckeltal"
        breadcrumbs={[
          { label: 'Fond & Kapital' },
          { label: 'Fondöversikt' }
        ]}
        stats={[
          { 
            label: 'NAV', 
            value: formatCurrency(selectedFund.nav, selectedFund.currency),
            trend: { value: `+${selectedFund.irr}% IRR`, positive: true },
            icon: DollarSign
          },
          { 
            label: 'Committed', 
            value: formatCurrency(selectedFund.committedCapital, selectedFund.currency),
            subValue: `${formatPercentage((selectedFund.committedCapital / selectedFund.targetSize) * 100)} of target`,
            icon: Wallet
          },
          { 
            label: 'Called', 
            value: formatCurrency(selectedFund.calledCapital, selectedFund.currency),
            subValue: `${formatPercentage((selectedFund.calledCapital / selectedFund.committedCapital) * 100)} of committed`,
            icon: ArrowUpRight
          },
          { 
            label: 'Distributed', 
            value: formatCurrency(selectedFund.distributedCapital, selectedFund.currency),
            subValue: `DPI: ${selectedFund.dpi.toFixed(2)}x`,
            icon: ArrowDownRight
          },
        ]}
        actions={
          <>
            <CustomSelect
              options={mockFunds.map((fund) => ({
                value: fund.id,
                label: fund.name,
                icon: <Building2 className="w-4 h-4 text-aifm-gold" />
              }))}
              value={selectedFund.id}
              onChange={(value) => setSelectedFund(mockFunds.find(f => f.id === value) || mockFunds[0])}
              className="min-w-[200px]"
              variant="gold"
              size="md"
            />
            <SecondaryButton>
              <Download className="w-4 h-4" />
              Exportera
            </SecondaryButton>
          </>
        }
      />

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-aifm-gold" />
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">TVPI</p>
          </div>
          <p className="text-2xl font-semibold text-white">{selectedFund.tvpi.toFixed(2)}x</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight className="w-4 h-4 text-aifm-gold" />
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">DPI</p>
          </div>
          <p className="text-2xl font-semibold text-white">{selectedFund.dpi.toFixed(2)}x</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">Net IRR</p>
          </div>
          <p className="text-2xl font-semibold text-green-400">+{selectedFund.irr}%</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:bg-white/15 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-aifm-gold" />
            <p className="text-xs font-medium uppercase tracking-wider text-white/60">Vintage</p>
          </div>
          <p className="text-2xl font-semibold text-white">{selectedFund.vintage}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Investors List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Investerare</h3>
            <Link href="/investors" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
              Visa alla <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {commitments.slice(0, 5).map((commitment) => (
              <div key={commitment.id} className="px-6 py-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{commitment.investor?.name}</p>
                    <p className="text-sm text-white/60">{commitment.investor?.type.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">{formatCurrency(commitment.committedAmount, selectedFund.currency)}</p>
                    <p className="text-sm text-white/60">{formatPercentage(commitment.ownershipPercentage)} ägarandel</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>Inbetalt: {formatPercentage((commitment.calledAmount / commitment.committedAmount) * 100)}</span>
                    <span>{formatCurrency(commitment.calledAmount, selectedFund.currency)}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-1.5">
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
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Portfölj</h3>
            <Link href="/portfolio" className="text-sm text-aifm-gold hover:underline flex items-center gap-1">
              Visa alla <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {portfolio.slice(0, 5).map((company) => {
              const gain = company.currentValuation - company.initialInvestment;
              const gainPercent = (gain / company.initialInvestment) * 100;
              return (
                <div key={company.id} className="px-6 py-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{company.name}</p>
                      <p className="text-sm text-white/60">{company.sector}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">{formatCurrency(company.currentValuation, selectedFund.currency)}</p>
                      <p className={`text-sm ${gainPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-white/50">
                    <span>{company.country}</span>
                    <span>•</span>
                    <span>{formatPercentage(company.ownership)} ägarandel</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full ${
                      company.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                      company.status === 'REALIZED' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-white/10 text-white/70'
                    }`}>
                      {company.status === 'ACTIVE' ? 'Aktiv' : company.status === 'REALIZED' ? 'Realiserad' : company.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fund Details */}
      <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-6">Fonddetaljer</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Fondtyp</p>
            <p className="font-medium text-white">{selectedFund.type.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Status</p>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              selectedFund.status === 'INVESTING' ? 'bg-green-500/20 text-green-400' :
              selectedFund.status === 'RAISING' ? 'bg-blue-500/20 text-blue-400' :
              selectedFund.status === 'HARVESTING' ? 'bg-amber-500/20 text-amber-400' :
              'bg-white/10 text-white/70'
            }`}>
              {selectedFund.status === 'INVESTING' ? 'Investerande' : 
               selectedFund.status === 'RAISING' ? 'Kapitalanskaffning' : 
               selectedFund.status === 'HARVESTING' ? 'Avyttrande' : selectedFund.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Förvaltningsavgift</p>
            <p className="font-medium text-white">{selectedFund.managementFee}%</p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Carried Interest</p>
            <p className="font-medium text-white">{selectedFund.carriedInterest}%</p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Målstorlek</p>
            <p className="font-medium text-white">{formatCurrency(selectedFund.targetSize, selectedFund.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Valuta</p>
            <p className="font-medium text-white">{selectedFund.currency}</p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Vintage</p>
            <p className="font-medium text-white">{selectedFund.vintage}</p>
          </div>
          <div>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Startdatum</p>
            <p className="font-medium text-white">{formatDate(selectedFund.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
