'use client';

import { useState } from 'react';
import { 
  ArrowDownRight, Plus, CheckCircle2,
  Users, FileText, Shield,
  Check, X, Eye, Download, TrendingUp, Clock, BarChart3
} from 'lucide-react';
import {
  getFundByCompanyId, getDistributionsByCompanyId, getCommitmentsByFund,
  formatCurrency, formatDate, Distribution
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

type TabType = 'pending' | 'completed' | 'statistics';

// Hero Metric Card
function HeroMetricCard({ 
  label, value, subValue, icon: Icon, variant = 'default'
}: { 
  label: string; value: string; subValue?: string; icon: React.ElementType; variant?: 'default' | 'primary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <div className={`group relative rounded-2xl p-5 transition-all duration-500 hover:-translate-y-0.5 ${
      isPrimary 
        ? 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20' 
        : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50'
    }`}>
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-xl transition-colors duration-300 ${isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'}`}>
            <Icon className={`w-4 h-4 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold'}`} />
          </div>
        </div>
        <p className={`text-xs uppercase tracking-wider font-medium mb-1.5 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>{label}</p>
        <p className={`text-xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>{value}</p>
        {subValue && <p className={`text-xs mt-1.5 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>{subValue}</p>}
      </div>
    </div>
  );
}

// Tab Navigation
function TabNavigation({ activeTab, onChange }: { activeTab: TabType; onChange: (tab: TabType) => void; }) {
  const tabs: { value: TabType; label: string; icon: React.ElementType }[] = [
    { value: 'pending', label: 'Väntande', icon: Clock },
    { value: 'completed', label: 'Genomförda', icon: CheckCircle2 },
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
              activeTab === tab.value ? 'bg-white text-aifm-charcoal shadow-lg' : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
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

// Distribution Card - Compact
function DistributionCard({ distribution, currency, isSelected, onClick }: { distribution: Distribution; currency: string; isSelected: boolean; onClick: () => void; }) {
  const getStatusStyles = (status: Distribution['status']) => {
    switch (status) {
      case 'PAID': return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Slutförd' };
      case 'APPROVED': return { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Väntar' };
      case 'DRAFT': return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Utkast' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
    }
  };

  const getTypeLabel = (type: Distribution['type']) => {
    switch (type) {
      case 'DIVIDEND': return 'Utdelning';
      case 'RETURN_OF_CAPITAL': return 'Kapitalåterbäring';
      case 'PROFIT_DISTRIBUTION': return 'Vinstutdelning';
      default: return type;
    }
  };

  const status = getStatusStyles(distribution.status);

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all duration-300 rounded-xl ${
        isSelected ? 'bg-emerald-50/50 border border-emerald-200/50 shadow-lg' : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-xs ${isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
            #{distribution.distributionNumber}
          </div>
          <div>
            <p className="font-semibold text-aifm-charcoal">{formatCurrency(distribution.totalAmount, currency)}</p>
            <p className="text-xs text-aifm-charcoal/40">{formatDate(distribution.distributionDate)}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-[10px] font-medium rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
      </div>
      
      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">{getTypeLabel(distribution.type)}</span>
        <span className="text-xs text-aifm-charcoal/40 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {distribution.items.length} mottagare
        </span>
      </div>
    </div>
  );
}

// Distribution Type Selector
function TypeSelector({ value, onChange }: { value: Distribution['type']; onChange: (type: Distribution['type']) => void; }) {
  const types: { value: Distribution['type']; label: string }[] = [
    { value: 'PROFIT_DISTRIBUTION', label: 'Vinstutdelning' },
    { value: 'RETURN_OF_CAPITAL', label: 'Kapitalåterbäring' },
    { value: 'DIVIDEND', label: 'Utdelning' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {types.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          className={`px-3 py-3 rounded-xl text-sm font-medium transition-all ${
            value === type.value ? 'bg-aifm-charcoal text-white shadow-lg' : 'bg-gray-100 text-aifm-charcoal/70 hover:bg-gray-200'
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

export default function DistributionsPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(null);
  const [showNewDistModal, setShowNewDistModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [newDistAmount, setNewDistAmount] = useState('');
  const [newDistType, setNewDistType] = useState<Distribution['type']>('PROFIT_DISTRIBUTION');

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const fundDists = getDistributionsByCompanyId(selectedCompany.id);
  const commitments = selectedFund ? getCommitmentsByFund(selectedFund.id) : [];
  const currency = selectedFund?.currency || 'SEK';
  
  const totalDistributed = commitments.reduce((sum, c) => sum + c.distributedAmount, 0);
  
  // Filter by tab
  const pendingDists = fundDists.filter(d => d.status === 'APPROVED' || d.status === 'DRAFT');
  const completedDists = fundDists.filter(d => d.status === 'PAID');
  const displayDists = activeTab === 'pending' ? pendingDists : activeTab === 'completed' ? completedDists : fundDists;

  const getTypeLabel = (type: Distribution['type']) => {
    switch (type) {
      case 'DIVIDEND': return 'Utdelning';
      case 'RETURN_OF_CAPITAL': return 'Kapitalåterbäring';
      case 'PROFIT_DISTRIBUTION': return 'Vinstutdelning';
      default: return type;
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Utdelningar</h1>
          <p className="text-aifm-charcoal/40 mt-1 text-sm">Hantera fondutdelningar med 4-ögon godkännande</p>
        </div>
        <button 
          onClick={() => setShowNewDistModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 shadow-lg shadow-aifm-charcoal/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          Ny utdelning
        </button>
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <HeroMetricCard label="Totalt utdelat" value={formatCurrency(totalDistributed, currency)} icon={ArrowDownRight} variant="primary" />
        <HeroMetricCard label="DPI" value={`${(selectedFund?.dpi || 0).toFixed(2)}x`} subValue="Distributed to Paid-In" icon={TrendingUp} />
        <HeroMetricCard label="Utdelningar" value={fundDists.length.toString()} subValue="totalt" icon={FileText} />
        <HeroMetricCard label="Väntar" value={pendingDists.length.toString()} icon={Shield} />
      </div>

      {/* 4-Eyes Notice */}
      <div className="bg-gradient-to-r from-aifm-gold/10 via-aifm-gold/5 to-transparent border border-aifm-gold/20 rounded-2xl p-5 mb-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-aifm-gold/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-aifm-gold" />
        </div>
        <div>
          <p className="font-semibold text-aifm-charcoal text-sm">4-ögonprincipen aktiv</p>
          <p className="text-xs text-aifm-charcoal/50 mt-0.5">Alla utdelningar kräver dubbelt godkännande före verkställande</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB: Pending & Completed */}
      {(activeTab === 'pending' || activeTab === 'completed') && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Distribution List - 2/5 */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
                {activeTab === 'pending' ? 'Väntande' : 'Genomförda'}
              </h3>
              <span className="text-xs text-aifm-charcoal/40">{displayDists.length} st</span>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto p-2 space-y-2">
              {displayDists.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ArrowDownRight className="w-7 h-7 text-emerald-500" />
                  </div>
                  <p className="text-aifm-charcoal/50 font-medium text-sm">Inga utdelningar</p>
                </div>
              ) : (
                displayDists.map((dist) => (
                  <DistributionCard 
                    key={dist.id} distribution={dist} currency={currency}
                    isSelected={selectedDistribution?.id === dist.id}
                    onClick={() => setSelectedDistribution(dist)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Distribution Details - 3/5 */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
            {selectedDistribution ? (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-semibold text-sm">
                      #{selectedDistribution.distributionNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Utdelning</p>
                      <p className="text-xs text-aifm-charcoal/40">{formatDate(selectedDistribution.distributionDate)}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${
                    selectedDistribution.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                    selectedDistribution.status === 'APPROVED' ? 'bg-amber-50 text-amber-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedDistribution.status === 'PAID' ? 'Slutförd' :
                     selectedDistribution.status === 'APPROVED' ? 'Väntar' : 'Utkast'}
                  </span>
                </div>
                
                <div className="p-5 border-b border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Datum', value: formatDate(selectedDistribution.distributionDate) },
                      { label: 'Typ', value: getTypeLabel(selectedDistribution.type) },
                      { label: 'Totalt', value: formatCurrency(selectedDistribution.totalAmount, currency), highlight: true },
                      { label: 'Mottagare', value: `${selectedDistribution.items.length} investerare` },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50/50 rounded-xl p-4">
                        <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">{item.label}</p>
                        <p className={`font-semibold text-sm ${item.highlight ? 'text-emerald-600' : 'text-aifm-charcoal'}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Fördelning</h3>
                </div>
                
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                  {selectedDistribution.items.map((item) => {
                    const investor = commitments.find(c => c.investorId === item.investorId)?.investor;
                    return (
                      <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-aifm-charcoal/5 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-aifm-charcoal/40" />
                          </div>
                          <p className="font-medium text-aifm-charcoal text-sm">{investor?.name || 'Okänd'}</p>
                        </div>
                        <p className="font-semibold text-emerald-600 text-sm">{formatCurrency(item.amount, currency)}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Approval Section */}
                {selectedDistribution.status === 'APPROVED' && (
                  <div className="p-5 bg-gradient-to-r from-amber-50 to-amber-50/50 border-t border-amber-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">Väntar på 2:a godkännande</p>
                        <p className="text-xs text-amber-700/70">Kräver ytterligare ett godkännande</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowApprovalModal(true)}
                      className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Godkänn & verkställ
                    </button>
                  </div>
                )}

                {selectedDistribution.status === 'PAID' && (
                  <div className="p-5 bg-gradient-to-r from-emerald-50 to-emerald-50/50 border-t border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-800 text-sm">Utdelning slutförd</p>
                        <p className="text-xs text-emerald-700/70">Alla betalningar genomförda</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedDistribution.status === 'DRAFT' && (
                  <div className="p-5 bg-gray-50/50 flex gap-3">
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30">
                      <Eye className="w-4 h-4" />
                      Visa detaljer
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30">
                      <Download className="w-4 h-4" />
                      Exportera
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-14 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FileText className="w-8 h-8 text-aifm-charcoal/20" />
                </div>
                <p className="text-aifm-charcoal/50 font-medium">Välj en utdelning</p>
                <p className="text-sm text-aifm-charcoal/30 mt-1">Klicka för detaljer</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Statistics */}
      {activeTab === 'statistics' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Distribution by Type */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">Utdelningar per typ</h3>
            
            {['PROFIT_DISTRIBUTION', 'RETURN_OF_CAPITAL', 'DIVIDEND'].map((type) => {
              const typeDists = fundDists.filter(d => d.type === type);
              const totalAmount = typeDists.reduce((sum, d) => sum + d.totalAmount, 0);
              const percentage = totalDistributed > 0 ? (totalAmount / totalDistributed) * 100 : 0;
              
              return (
                <div key={type} className="mb-6 last:mb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-aifm-charcoal text-sm">{getTypeLabel(type as Distribution['type'])}</p>
                      <p className="text-xs text-aifm-charcoal/40">{typeDists.length} utdelningar</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-aifm-charcoal text-sm">{formatCurrency(totalAmount, currency)}</p>
                      <p className="text-xs text-aifm-charcoal/40">{formatPercentage(percentage)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 rounded-full h-2 transition-all duration-700" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats Cards */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Totalt antal</p>
              <p className="text-3xl font-semibold text-aifm-charcoal">{fundDists.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Snittsbelopp</p>
              <p className="text-xl font-semibold text-aifm-charcoal">
                {fundDists.length > 0 ? formatCurrency(totalDistributed / fundDists.length, currency) : '-'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Slutförda</p>
              <p className="text-3xl font-semibold text-emerald-600">{completedDists.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* New Distribution Modal */}
      {showNewDistModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-aifm-charcoal">Ny utdelning</h3>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5">Skapa ny utdelning till investerare</p>
              </div>
              <button onClick={() => setShowNewDistModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Fond</p>
                <p className="font-semibold text-aifm-charcoal">{selectedFund?.name || selectedCompany.shortName}</p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-3 uppercase tracking-wider">Utdelningstyp</label>
                <TypeSelector value={newDistType} onChange={setNewDistType} />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Totalt belopp ({currency})</label>
                <input
                  type="number"
                  value={newDistAmount}
                  onChange={(e) => setNewDistAmount(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10"
                  placeholder="Ange belopp"
                />
              </div>
              
              {newDistAmount && (
                <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/50">
                  <p className="text-sm font-semibold text-aifm-charcoal mb-3">Fördelning</p>
                  <div className="space-y-2">
                    {commitments.slice(0, 3).map((c) => {
                      const allocation = parseFloat(newDistAmount) * c.ownershipPercentage / 100;
                      return (
                        <div key={c.id} className="flex justify-between text-sm">
                          <span className="text-aifm-charcoal/60">{c.investor?.name}</span>
                          <span className="font-semibold text-emerald-600">{formatCurrency(allocation, currency)}</span>
                        </div>
                      );
                    })}
                    {commitments.length > 3 && <p className="text-xs text-aifm-charcoal/40">+ {commitments.length - 3} fler</p>}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowNewDistModal(false)} className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30">
                Avbryt
              </button>
              <button 
                onClick={() => { alert('Utdelning skapad! (Demo)'); setShowNewDistModal(false); setNewDistAmount(''); }}
                className="flex-1 py-3 px-4 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 shadow-lg shadow-aifm-charcoal/20"
              >
                Skapa utdelning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-aifm-charcoal mb-2">Bekräfta godkännande</h3>
              <p className="text-sm text-aifm-charcoal/50 mb-6">
                Genom att godkänna initieras betalningar till alla investerare.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Totalt belopp</p>
                <p className="text-2xl font-semibold text-emerald-600">
                  {selectedDistribution && formatCurrency(selectedDistribution.totalAmount, currency)}
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowApprovalModal(false)} className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30">
                  Avbryt
                </button>
                <button 
                  onClick={() => { alert('Utdelning godkänd! (Demo)'); setShowApprovalModal(false); }}
                  className="flex-1 py-3 px-4 text-sm font-medium text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/30"
                >
                  Bekräfta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
