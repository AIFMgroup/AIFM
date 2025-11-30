'use client';

import { useState } from 'react';
import { 
  Building2, TrendingUp, TrendingDown, Globe,
  Download, Search, Plus, Eye, LayoutGrid, List,
  Calendar, Wallet, ArrowUpRight, X,
  FileSpreadsheet, FileText, Check, PieChart, BarChart3
} from 'lucide-react';
import {
  getFundByCompanyId, getPortfolioByCompanyId,
  formatCurrency, formatPercentage, formatDate, PortfolioCompany
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

type TabType = 'companies' | 'sectors' | 'statistics';

// Hero Metric Card
function HeroMetricCard({ 
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
      relative group rounded-2xl p-5 transition-all duration-500
      ${isPrimary 
        ? 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20' 
        : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20 hover:-translate-y-0.5'
      }
    `}>
      {!isPrimary && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-xl ${isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'} transition-colors duration-300`}>
            <Icon className={`w-4 h-4 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold'} transition-colors duration-300`} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend.positive 
                ? isPrimary ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                : isPrimary ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600'
            }`}>
              {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
            </div>
          )}
        </div>
        
        <p className={`text-xs uppercase tracking-wider font-medium mb-1.5 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>
          {label}
        </p>
        <p className={`text-xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>
          {value}
        </p>
        {subLabel && (
          <p className={`text-xs mt-1.5 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/40'}`}>{subLabel}</p>
        )}
      </div>
    </div>
  );
}

// Tab Navigation
function TabNavigation({ 
  activeTab, 
  onChange 
}: { 
  activeTab: TabType; 
  onChange: (tab: TabType) => void;
}) {
  const tabs: { value: TabType; label: string; icon: React.ElementType }[] = [
    { value: 'companies', label: 'Bolag', icon: Building2 },
    { value: 'sectors', label: 'Sektorer', icon: PieChart },
    { value: 'statistics', label: 'Statistik', icon: BarChart3 },
  ];

  return (
    <div className="flex bg-gray-100/80 rounded-xl p-1.5 mb-8">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === tab.value
                ? 'bg-white text-aifm-charcoal shadow-lg'
                : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
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
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-aifm-charcoal/5 to-aifm-charcoal/10 rounded-xl 
                            flex items-center justify-center group-hover:from-aifm-gold/10 group-hover:to-aifm-gold/20 transition-all duration-300">
              <Building2 className="w-5 h-5 text-aifm-charcoal/60 group-hover:text-aifm-gold transition-colors duration-300" />
            </div>
            <div>
              <h3 className="font-semibold text-aifm-charcoal text-sm group-hover:text-aifm-gold transition-colors duration-300">
                {company.name}
              </h3>
              <p className="text-xs text-aifm-charcoal/50">{company.sector}</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-medium rounded-full ${
            company.status === 'ACTIVE' 
              ? 'bg-emerald-50 text-emerald-600' 
              : company.status === 'REALIZED' 
                ? 'bg-blue-50 text-blue-600' 
                : 'bg-gray-100 text-gray-600'
          }`}>
            {company.status === 'ACTIVE' ? 'Aktiv' : company.status === 'REALIZED' ? 'Realiserad' : company.status}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-aifm-charcoal/50">Värde</span>
            <span className="text-sm font-semibold text-aifm-charcoal">{formatCurrency(company.currentValuation, currency)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-aifm-charcoal/50">Avkastning</span>
            <span className={`text-sm font-semibold flex items-center gap-1 ${gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {gainPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100/50">
        <div className="flex items-center justify-between text-[10px] text-aifm-charcoal/40">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {company.country}
          </span>
          <span>{formatPercentage(company.ownership)} ägande</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(company.investmentDate)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Sector options
const SECTORS = [
  'Teknologi', 'Hälsovård', 'Fintech', 'E-handel', 'SaaS',
  'Cleantech', 'Fastigheter', 'Industri', 'Konsument', 'Övrigt'
];

const COUNTRIES = [
  'Sverige', 'Norge', 'Danmark', 'Finland', 'Tyskland', 'Storbritannien', 'USA', 'Övrigt'
];

export default function PortfolioPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<TabType>('companies');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');
  const [exportSuccess, setExportSuccess] = useState(false);
  
  // Form state for new company
  const [newCompany, setNewCompany] = useState({
    name: '', sector: '', country: 'Sverige',
    investmentAmount: '', ownership: '',
    investmentDate: new Date().toISOString().split('T')[0],
    description: ''
  });
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedPortfolioCompany, setSelectedPortfolioCompany] = useState<PortfolioCompany | null>(null);

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const portfolio = getPortfolioByCompanyId(selectedCompany.id);
  const currency = selectedFund?.currency || 'SEK';
  
  const filteredPortfolio = portfolio.filter(pc => 
    pc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pc.sector.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalInvested = portfolio.reduce((sum, pc) => sum + pc.initialInvestment, 0);
  const totalValue = portfolio.reduce((sum, pc) => sum + pc.currentValuation, 0);
  const unrealizedGain = totalValue - totalInvested;
  const unrealizedGainPercent = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;
  const activeCompanies = portfolio.filter(pc => pc.status === 'ACTIVE').length;

  // Sector breakdown
  const bySector = portfolio.reduce((acc, pc) => {
    acc[pc.sector] = (acc[pc.sector] || 0) + pc.currentValuation;
    return acc;
  }, {} as Record<string, number>);

  // Country breakdown
  const byCountry = portfolio.reduce((acc, pc) => {
    acc[pc.country] = (acc[pc.country] || 0) + pc.currentValuation;
    return acc;
  }, {} as Record<string, number>);

  // Export function
  const handleExport = () => {
    const exportData = portfolio.map(company => ({
      'Bolagsnamn': company.name,
      'Sektor': company.sector,
      'Land': company.country,
      'Investerat belopp': formatCurrency(company.initialInvestment, currency),
      'Nuvarande värde': formatCurrency(company.currentValuation, currency),
      'Avkastning (%)': formatPercentage((company.currentValuation - company.initialInvestment) / company.initialInvestment * 100),
      'Ägarandel (%)': formatPercentage(company.ownership),
      'Status': company.status === 'ACTIVE' ? 'Aktiv' : company.status === 'REALIZED' ? 'Realiserad' : company.status,
      'Investeringsdatum': formatDate(company.investmentDate)
    }));

    if (exportFormat === 'csv') {
      const headers = Object.keys(exportData[0]).join(';');
      const rows = exportData.map(row => Object.values(row).join(';')).join('\n');
      const csv = `${headers}\n${rows}`;
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `portfölj_${selectedCompany.shortName}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else if (exportFormat === 'excel') {
      const headers = Object.keys(exportData[0]).join('\t');
      const rows = exportData.map(row => Object.values(row).join('\t')).join('\n');
      const tsv = `${headers}\n${rows}`;
      const blob = new Blob(['\ufeff' + tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `portfölj_${selectedCompany.shortName}_${new Date().toISOString().split('T')[0]}.xls`;
      link.click();
    } else {
      alert('PDF-export genereras... (Demo)');
    }
    
    setExportSuccess(true);
    setTimeout(() => {
      setExportSuccess(false);
      setShowExportModal(false);
    }, 1500);
  };

  const handleAddCompany = () => {
    if (!newCompany.name || !newCompany.sector || !newCompany.investmentAmount) {
      alert('Vänligen fyll i alla obligatoriska fält');
      return;
    }
    alert(`Bolag "${newCompany.name}" tillagt! (Demo)`);
    setShowAddModal(false);
    setNewCompany({
      name: '', sector: '', country: 'Sverige',
      investmentAmount: '', ownership: '',
      investmentDate: new Date().toISOString().split('T')[0],
      description: ''
    });
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Portfölj</h1>
          <p className="text-aifm-charcoal/40 mt-1 text-sm">Följ portföljbolagens utveckling</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                       bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                       bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                       shadow-lg shadow-aifm-charcoal/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Lägg till
          </button>
        </div>
      </div>

      {/* Hero Metrics - Always Visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroMetricCard 
          label="Portföljvärde" 
          value={formatCurrency(totalValue, currency)}
          trend={{ value: formatPercentage(unrealizedGainPercent), positive: unrealizedGainPercent >= 0 }}
          variant="primary"
          icon={Wallet}
        />
        <HeroMetricCard 
          label="Investerat" 
          value={formatCurrency(totalInvested, currency)}
          subLabel={`${portfolio.length} bolag`}
          icon={ArrowUpRight}
        />
        <HeroMetricCard 
          label="Orealiserad" 
          value={`${unrealizedGain >= 0 ? '+' : ''}${formatCurrency(unrealizedGain, currency)}`}
          trend={{ value: formatPercentage(unrealizedGainPercent), positive: unrealizedGain >= 0 }}
          icon={TrendingUp}
        />
        <HeroMetricCard 
          label="Aktiva" 
          value={activeCompanies.toString()}
          subLabel={`av ${portfolio.length} totalt`}
          icon={Building2}
        />
      </div>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB: Companies */}
      {activeTab === 'companies' && (
        <>
          {/* Search & View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="relative">
              <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Sök bolag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-72 py-2.5 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm
                           placeholder:text-aifm-charcoal/30 focus:outline-none focus:border-aifm-gold/30 
                           focus:ring-2 focus:ring-aifm-gold/10 transition-all"
              />
            </div>
            <div className="inline-flex bg-gray-100/80 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  viewMode === 'grid' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  viewMode === 'table' ? 'bg-white shadow-sm text-aifm-charcoal' : 'text-aifm-charcoal/40 hover:text-aifm-charcoal'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid View */}
          {viewMode === 'grid' ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
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
            /* Table View */
            <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Bolag</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Sektor</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Värde</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Avkastning</th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredPortfolio.map((company) => {
                      const gainPercent = ((company.currentValuation - company.initialInvestment) / company.initialInvestment) * 100;
                      return (
                        <tr key={company.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-aifm-charcoal/5 rounded-lg flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-aifm-charcoal/50" />
                              </div>
                              <div>
                                <p className="font-medium text-aifm-charcoal text-sm">{company.name}</p>
                                <p className="text-xs text-aifm-charcoal/40">{company.country}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-aifm-charcoal/70">{company.sector}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-aifm-charcoal text-right">{formatCurrency(company.currentValuation, currency)}</td>
                          <td className={`px-5 py-4 text-sm font-semibold text-right ${gainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {gainPercent >= 0 ? '+' : ''}{formatPercentage(gainPercent)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`px-2.5 py-1 text-[10px] font-medium rounded-full ${
                              company.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' :
                              company.status === 'REALIZED' ? 'bg-blue-50 text-blue-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {company.status === 'ACTIVE' ? 'Aktiv' : company.status === 'REALIZED' ? 'Realiserad' : company.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <button className="p-2 text-aifm-charcoal/30 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-all">
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
        </>
      )}

      {/* TAB: Sectors */}
      {activeTab === 'sectors' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sector Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">Sektorfördelning</h3>
            <div className="space-y-4">
              {Object.entries(bySector)
                .sort((a, b) => b[1] - a[1])
                .map(([sector, value]) => {
                  const percentage = (value / totalValue) * 100;
                  const companiesInSector = portfolio.filter(pc => pc.sector === sector).length;
                  return (
                    <div key={sector} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-aifm-charcoal/5 rounded-lg flex items-center justify-center 
                                          group-hover:bg-aifm-gold/10 transition-colors">
                            <PieChart className="w-4 h-4 text-aifm-charcoal/40 group-hover:text-aifm-gold transition-colors" />
                          </div>
                          <div>
                            <p className="font-medium text-aifm-charcoal text-sm">{sector}</p>
                            <p className="text-xs text-aifm-charcoal/40">{companiesInSector} bolag</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-aifm-charcoal text-sm">{formatPercentage(percentage)}</p>
                          <p className="text-xs text-aifm-charcoal/40">{formatCurrency(value, currency)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-aifm-gold rounded-full h-2 transition-all duration-700 group-hover:shadow-sm group-hover:shadow-aifm-gold/50"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Country Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">Geografisk fördelning</h3>
            <div className="space-y-4">
              {Object.entries(byCountry)
                .sort((a, b) => b[1] - a[1])
                .map(([country, value]) => {
                  const percentage = (value / totalValue) * 100;
                  const companiesInCountry = portfolio.filter(pc => pc.country === country).length;
                  return (
                    <div key={country} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-aifm-charcoal/5 rounded-lg flex items-center justify-center 
                                          group-hover:bg-aifm-gold/10 transition-colors">
                            <Globe className="w-4 h-4 text-aifm-charcoal/40 group-hover:text-aifm-gold transition-colors" />
                          </div>
                          <div>
                            <p className="font-medium text-aifm-charcoal text-sm">{country}</p>
                            <p className="text-xs text-aifm-charcoal/40">{companiesInCountry} bolag</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-aifm-charcoal text-sm">{formatPercentage(percentage)}</p>
                          <p className="text-xs text-aifm-charcoal/40">{formatCurrency(value, currency)}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-aifm-charcoal/60 rounded-full h-2 transition-all duration-700"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Statistics */}
      {activeTab === 'statistics' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Performance Summary */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">Prestationsöversikt</h3>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Total avkastning</p>
                <p className={`text-2xl font-semibold ${unrealizedGainPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {unrealizedGainPercent >= 0 ? '+' : ''}{formatPercentage(unrealizedGainPercent)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Genomsnittlig ägarandel</p>
                <p className="text-2xl font-semibold text-aifm-charcoal">
                  {formatPercentage(portfolio.reduce((sum, pc) => sum + pc.ownership, 0) / portfolio.length)}
                </p>
              </div>
            </div>

            {/* Top Performers */}
            <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Bäst presterande</h4>
            <div className="space-y-3">
              {portfolio
                .map(pc => ({ ...pc, return: ((pc.currentValuation - pc.initialInvestment) / pc.initialInvestment) * 100 }))
                .sort((a, b) => b.return - a.return)
                .slice(0, 3)
                .map((company, index) => (
                  <div key={company.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                        index === 0 ? 'bg-aifm-gold' : index === 1 ? 'bg-aifm-charcoal/60' : 'bg-aifm-charcoal/40'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-aifm-charcoal text-sm">{company.name}</p>
                        <p className="text-xs text-aifm-charcoal/40">{company.sector}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">+{formatPercentage(company.return)}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Antal sektorer</p>
              <p className="text-3xl font-semibold text-aifm-charcoal">{Object.keys(bySector).length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Antal länder</p>
              <p className="text-3xl font-semibold text-aifm-charcoal">{Object.keys(byCountry).length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Realiserade</p>
              <p className="text-3xl font-semibold text-aifm-charcoal">{portfolio.filter(pc => pc.status === 'REALIZED').length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Snitt investering</p>
              <p className="text-xl font-semibold text-aifm-charcoal">{formatCurrency(totalInvested / portfolio.length, currency)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-aifm-charcoal">Lägg till bolag</h3>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5">Registrera ny investering</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Bolagsnamn *</label>
                <input
                  type="text"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10"
                  placeholder="t.ex. TechStartup AB"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Sektor *</label>
                  <select
                    value={newCompany.sector}
                    onChange={(e) => setNewCompany({ ...newCompany, sector: e.target.value })}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                  >
                    <option value="">Välj sektor</option>
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Land</label>
                  <select
                    value={newCompany.country}
                    onChange={(e) => setNewCompany({ ...newCompany, country: e.target.value })}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Investering ({currency}) *</label>
                  <input
                    type="number"
                    value={newCompany.investmentAmount}
                    onChange={(e) => setNewCompany({ ...newCompany, investmentAmount: e.target.value })}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                    placeholder="10000000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Ägarandel (%)</label>
                  <input
                    type="number"
                    value={newCompany.ownership}
                    onChange={(e) => setNewCompany({ ...newCompany, ownership: e.target.value })}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                    placeholder="15"
                  />
                </div>
              </div>

              {newCompany.name && newCompany.investmentAmount && (
                <div className="bg-aifm-gold/5 rounded-xl p-4 border border-aifm-gold/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-aifm-gold/20 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-aifm-gold" />
                      </div>
                      <div>
                        <p className="font-semibold text-aifm-charcoal text-sm">{newCompany.name}</p>
                        <p className="text-xs text-aifm-charcoal/50">{newCompany.sector || 'Ingen sektor'}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-aifm-charcoal text-sm">{formatCurrency(parseFloat(newCompany.investmentAmount) || 0, currency)}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30">
                Avbryt
              </button>
              <button onClick={handleAddCompany} className="flex-1 py-3 px-4 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 shadow-lg shadow-aifm-charcoal/20 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Lägg till
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-aifm-charcoal">Exportera portfölj</h3>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5">{portfolio.length} bolag</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            {exportSuccess ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-lg font-semibold text-aifm-charcoal">Export klar!</p>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-3">
                  {[
                    { id: 'excel', icon: FileSpreadsheet, label: 'Excel', desc: 'Öppnas i Excel' },
                    { id: 'csv', icon: FileText, label: 'CSV', desc: 'Universellt format' },
                    { id: 'pdf', icon: FileText, label: 'PDF', desc: 'För utskrift' },
                  ].map((format) => (
                    <button
                      key={format.id}
                      onClick={() => setExportFormat(format.id as typeof exportFormat)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        exportFormat === format.id ? 'border-aifm-gold bg-aifm-gold/5' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${exportFormat === format.id ? 'bg-aifm-gold/20' : 'bg-gray-100'}`}>
                        <format.icon className={`w-5 h-5 ${exportFormat === format.id ? 'text-aifm-gold' : 'text-aifm-charcoal/40'}`} />
                      </div>
                      <div className="text-left flex-1">
                        <p className={`font-medium text-sm ${exportFormat === format.id ? 'text-aifm-charcoal' : 'text-aifm-charcoal/70'}`}>{format.label}</p>
                        <p className="text-xs text-aifm-charcoal/40">{format.desc}</p>
                      </div>
                      {exportFormat === format.id && (
                        <div className="w-5 h-5 bg-aifm-gold rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                  <button onClick={() => setShowExportModal(false)} className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30">
                    Avbryt
                  </button>
                  <button onClick={handleExport} className="flex-1 py-3 px-4 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 shadow-lg shadow-aifm-charcoal/20 flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Exportera
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
