'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, Plus, CheckCircle2, Clock,
  Send, Download, Wallet, FileText, Bell, X,
  AlertCircle, Users, TrendingUp, BarChart3
} from 'lucide-react';
import { formatCurrency, formatDate, formatPercentage } from '@/lib/fundData';
import type { CapitalCall } from '@/lib/fundData';
import { useFundsData, getFundByCompanyId, getCapitalCallsByCompanyId, getCommitmentsByFund } from '@/lib/fundsApi';
import { useCompany } from '@/components/CompanyContext';
import { PageHeader, PrimaryButton } from '@/components/shared/PageHeader';

type TabType = 'active' | 'history' | 'statistics';

// Hero Metric Card
function HeroMetricCard({ 
  label, value, subValue, icon: Icon, variant = 'default'
}: { 
  label: string; value: string; subValue?: string; icon: React.ElementType; variant?: 'default' | 'primary' | 'highlight';
}) {
  const styles = {
    default: 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50',
    primary: 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20',
    highlight: 'bg-gradient-to-br from-aifm-gold via-aifm-gold to-aifm-gold/90 text-white shadow-xl shadow-aifm-gold/30',
  };
  const isPrimary = variant !== 'default';

  return (
    <div className={`group relative rounded-xl sm:rounded-2xl p-4 sm:p-5 transition-all duration-500 hover:-translate-y-0.5 ${styles[variant]}`}>
      <div className="relative">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors duration-300 ${isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'}`}>
            <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold'}`} />
          </div>
        </div>
        <p className={`text-[10px] sm:text-xs uppercase tracking-wider font-medium mb-1 sm:mb-1.5 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>{label}</p>
        <p className={`text-base sm:text-xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>{value}</p>
        {subValue && <p className={`text-[10px] sm:text-xs mt-1 sm:mt-1.5 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>{subValue}</p>}
      </div>
    </div>
  );
}

// Tab Navigation
function TabNavigation({ activeTab, onChange }: { activeTab: TabType; onChange: (tab: TabType) => void; }) {
  const tabs: { value: TabType; label: string; icon: React.ElementType }[] = [
    { value: 'active', label: 'Aktiva anrop', icon: Bell },
    { value: 'history', label: 'Historik', icon: FileText },
    { value: 'statistics', label: 'Statistik', icon: BarChart3 },
  ];

  return (
    <div className="flex bg-gray-100/80 rounded-xl p-1 sm:p-1.5 mb-6 sm:mb-8">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
              activeTab === tab.value ? 'bg-white text-aifm-charcoal shadow-lg' : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Capital Call Card - Compact
function CapitalCallCard({ call, currency, isSelected, onClick }: { call: CapitalCall; currency: string; isSelected: boolean; onClick: () => void; }) {
  const paidAmount = call.items.reduce((sum, item) => sum + item.paidAmount, 0);
  const paidPercentage = (paidAmount / call.totalAmount) * 100;

  const getStatusStyles = (status: CapitalCall['status']) => {
    switch (status) {
      case 'FULLY_PAID': return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Betald' };
      case 'PARTIALLY_PAID': return { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Delvis' };
      case 'SENT': return { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Skickad' };
      case 'DRAFT': return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Utkast' };
      case 'OVERDUE': return { bg: 'bg-red-50', text: 'text-red-600', label: 'Förfallen' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
    }
  };
  const status = getStatusStyles(call.status);

  return (
    <div
      onClick={onClick}
      className={`p-4 cursor-pointer transition-all duration-300 rounded-xl ${
        isSelected ? 'bg-aifm-gold/5 border border-aifm-gold/20 shadow-lg' : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-xs ${isSelected ? 'bg-aifm-gold text-white' : 'bg-aifm-charcoal/5 text-aifm-charcoal/70'}`}>
            #{call.callNumber}
          </div>
          <div>
            <p className="font-semibold text-aifm-charcoal">{formatCurrency(call.totalAmount, currency)}</p>
            <p className="text-xs text-aifm-charcoal/40">Förfaller {formatDate(call.dueDate)}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 text-[10px] font-medium rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
      </div>
      
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-aifm-charcoal/40 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {call.items.filter(i => i.status === 'PAID').length}/{call.items.length}
        </span>
        <span className="font-medium text-aifm-charcoal/60">{formatPercentage(paidPercentage)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className="bg-emerald-500 rounded-full h-1.5 transition-all duration-500" style={{ width: `${paidPercentage}%` }} />
      </div>
    </div>
  );
}

// Animated Progress Bar
function AnimatedProgressBar({ percentage }: { percentage: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(percentage), 100); }, [percentage]);
  
  return (
    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
      <div className="bg-aifm-gold rounded-full h-3 transition-all duration-1000 ease-out relative" style={{ width: `${width}%` }}>
        <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
      </div>
    </div>
  );
}

export default function CapitalCallsPage() {
  const { selectedCompany } = useCompany();
  const { data: fundsData, loading, error } = useFundsData();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedCall, setSelectedCall] = useState<CapitalCall | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [newCallAmount, setNewCallAmount] = useState('');
  const [newCallPurpose, setNewCallPurpose] = useState('');
  const [newCallDueDate, setNewCallDueDate] = useState('');
  const [newCallType, setNewCallType] = useState('investment');

  const selectedFund = fundsData ? getFundByCompanyId(fundsData, selectedCompany.id) : undefined;
  const fundCalls = fundsData ? getCapitalCallsByCompanyId(fundsData, selectedCompany.id) : [];
  const commitments = fundsData && selectedFund ? getCommitmentsByFund(fundsData, selectedFund.id) : [];
  const currency = selectedFund?.currency || 'SEK';
  const fundName = selectedFund?.name || selectedCompany.shortName;
  
  const totalCommitted = commitments.reduce((sum, c) => sum + c.committedAmount, 0);
  const totalCalled = commitments.reduce((sum, c) => sum + c.calledAmount, 0);
  const remainingToCall = totalCommitted - totalCalled;
  const callPercentage = totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0;

  // Filter calls by tab
  const activeCalls = fundCalls.filter(c => c.status === 'SENT' || c.status === 'PARTIALLY_PAID' || c.status === 'DRAFT');
  const historyCalls = fundCalls.filter(c => c.status === 'FULLY_PAID' || c.status === 'OVERDUE');
  const displayCalls = activeTab === 'active' ? activeCalls : activeTab === 'history' ? historyCalls : fundCalls;

  // Monthly data for statistics
  const monthlyData = [
    { month: 'Jul', amount: 5000000, paid: 4800000 },
    { month: 'Aug', amount: 8000000, paid: 7500000 },
    { month: 'Sep', amount: 12000000, paid: 11000000 },
    { month: 'Okt', amount: 6000000, paid: 6000000 },
    { month: 'Nov', amount: 15000000, paid: 10000000 },
    { month: 'Dec', amount: 10000000, paid: 0 },
  ];

  const callTypes = [
    { value: 'investment', label: 'Ny investering' },
    { value: 'follow_on', label: 'Uppföljning' },
    { value: 'fees', label: 'Avgift' },
    { value: 'expenses', label: 'Kostnader' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-8 h-8 border-2 border-aifm-gold border-t-transparent rounded-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        {error.message ?? 'Kunde inte ladda kapitalanropsdata'}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Kapitalanrop"
        description="Hantera kapitalanrop och inbetalningar"
        breadcrumbs={[
          { label: 'Kapital' },
          { label: 'Kapitalanrop' }
        ]}
        stats={[
          { label: 'Totalt åtagande', value: formatCurrency(totalCommitted, currency), icon: Wallet },
          { label: 'Inropat', value: formatCurrency(totalCalled, currency), subValue: formatPercentage(callPercentage), icon: ArrowUpRight },
          { label: 'Återstående', value: formatCurrency(remainingToCall, currency), icon: Clock },
          { label: 'Aktiva anrop', value: activeCalls.length.toString(), icon: Bell },
        ]}
        actions={
          <PrimaryButton icon={Plus} onClick={() => setShowNewCallModal(true)}>
            Nytt anrop
          </PrimaryButton>
        }
      />

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl border border-gray-100/50 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Inropat kapital</p>
          <p className="text-2xl font-semibold text-aifm-charcoal">{formatPercentage(callPercentage)}</p>
        </div>
        <AnimatedProgressBar percentage={callPercentage} />
        <div className="flex justify-between mt-2 text-xs text-aifm-charcoal/40 font-medium">
          <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB: Active & History - List/Detail view */}
      {(activeTab === 'active' || activeTab === 'history') && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Call List - 2/5 */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">
                {activeTab === 'active' ? 'Aktiva' : 'Historik'}
              </h3>
              <span className="text-xs text-aifm-charcoal/40">{displayCalls.length} st</span>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto p-2 space-y-2">
              {displayCalls.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-7 h-7 text-aifm-charcoal/20" />
                  </div>
                  <p className="text-aifm-charcoal/50 font-medium text-sm">Inga anrop</p>
                </div>
              ) : (
                displayCalls.map((call) => (
                  <CapitalCallCard 
                    key={call.id} call={call} currency={currency}
                    isSelected={selectedCall?.id === call.id}
                    onClick={() => setSelectedCall(call)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Call Details - 3/5 */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
            {selectedCall ? (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-aifm-gold rounded-xl flex items-center justify-center text-white font-semibold text-sm">
                      #{selectedCall.callNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Kapitalanrop</p>
                      <p className="text-xs text-aifm-charcoal/40">{formatDate(selectedCall.callDate)}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${
                    selectedCall.status === 'FULLY_PAID' ? 'bg-emerald-50 text-emerald-600' :
                    selectedCall.status === 'PARTIALLY_PAID' ? 'bg-blue-50 text-blue-600' :
                    selectedCall.status === 'SENT' ? 'bg-amber-50 text-amber-600' :
                    selectedCall.status === 'OVERDUE' ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedCall.status === 'FULLY_PAID' ? 'Betald' :
                     selectedCall.status === 'PARTIALLY_PAID' ? 'Delvis' :
                     selectedCall.status === 'SENT' ? 'Skickad' :
                     selectedCall.status === 'OVERDUE' ? 'Förfallen' : 'Utkast'}
                  </span>
                </div>
                
                <div className="p-5 border-b border-gray-100">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[
                      { label: 'Totalt', value: formatCurrency(selectedCall.totalAmount, currency) },
                      { label: 'Mottaget', value: formatCurrency(selectedCall.items.reduce((sum, i) => sum + i.paidAmount, 0), currency), highlight: true },
                      { label: 'Anropsdatum', value: formatDate(selectedCall.callDate) },
                      { label: 'Förfallodatum', value: formatDate(selectedCall.dueDate) },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50/50 rounded-xl p-4">
                        <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">{item.label}</p>
                        <p className={`font-semibold text-sm ${item.highlight ? 'text-emerald-600' : 'text-aifm-charcoal'}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50/50 rounded-xl p-4">
                    <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Syfte</p>
                    <p className="text-aifm-charcoal text-sm">{selectedCall.purpose}</p>
                  </div>
                </div>

                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Investerare</h3>
                  <span className="text-xs text-aifm-charcoal/40">
                    {selectedCall.items.filter(i => i.status === 'PAID').length}/{selectedCall.items.length} betalat
                  </span>
                </div>
                
                <div className="max-h-36 overflow-y-auto divide-y divide-gray-50">
                  {selectedCall.items.map((item) => {
                    const investor = commitments.find(c => c.investorId === item.investorId)?.investor;
                    return (
                      <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            item.status === 'PAID' ? 'bg-emerald-100' : item.status === 'PARTIAL' ? 'bg-blue-100' : 'bg-amber-100'
                          }`}>
                            {item.status === 'PAID' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                             item.status === 'PARTIAL' ? <Clock className="w-4 h-4 text-blue-600" /> :
                             <AlertCircle className="w-4 h-4 text-amber-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-aifm-charcoal text-sm">{investor?.name || 'Okänd'}</p>
                            <p className="text-xs text-aifm-charcoal/40">{item.paidAt ? formatDate(item.paidAt) : 'Väntar'}</p>
                          </div>
                        </div>
                        <p className="font-semibold text-aifm-charcoal text-sm">{formatCurrency(item.amount, currency)}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="p-5 bg-gray-50/50 flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all">
                    <Send className="w-4 h-4" />
                    Påminnelse
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all">
                    <Download className="w-4 h-4" />
                    Exportera
                  </button>
                </div>
              </>
            ) : (
              <div className="p-14 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FileText className="w-8 h-8 text-aifm-charcoal/20" />
                </div>
                <p className="text-aifm-charcoal/50 font-medium">Välj ett anrop</p>
                <p className="text-sm text-aifm-charcoal/30 mt-1">Klicka för detaljer</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: Statistics */}
      {activeTab === 'statistics' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Monthly Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">Månadsvis översikt</h3>
            
            <div className="h-48 flex items-end justify-between gap-3">
              {monthlyData.map((item) => {
                const maxVal = Math.max(...monthlyData.map(d => d.amount));
                const h1 = (item.amount / maxVal) * 100;
                const h2 = (item.paid / maxVal) * 100;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center">
                    <div className="w-full h-40 flex items-end justify-center gap-1">
                      <div className="w-6 rounded-t-lg bg-aifm-charcoal/20 transition-all duration-500" style={{ height: `${h1}%` }} />
                      <div className="w-6 rounded-t-lg bg-emerald-500 transition-all duration-500" style={{ height: `${h2}%` }} />
                    </div>
                    <span className="text-[10px] text-aifm-charcoal/40 mt-2 uppercase tracking-wider font-medium">{item.month}</span>
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-aifm-charcoal/20" />
                <span className="text-xs text-aifm-charcoal/50">Inropat</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500" />
                <span className="text-xs text-aifm-charcoal/50">Betalt</span>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Genomförda anrop</p>
              <p className="text-3xl font-semibold text-aifm-charcoal">{fundCalls.filter(c => c.status === 'FULLY_PAID').length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Snittsbelopp</p>
              <p className="text-xl font-semibold text-aifm-charcoal">
                {fundCalls.length > 0 ? formatCurrency(fundCalls.reduce((sum, c) => sum + c.totalAmount, 0) / fundCalls.length, currency) : '-'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Betalningsgrad</p>
              <p className="text-3xl font-semibold text-emerald-600">
                {fundCalls.length > 0 ? formatPercentage(
                  (fundCalls.reduce((sum, c) => sum + c.items.reduce((s, i) => s + i.paidAmount, 0), 0) / 
                   fundCalls.reduce((sum, c) => sum + c.totalAmount, 0)) * 100
                ) : '-'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100/50 p-5">
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-2">Försenade</p>
              <p className="text-3xl font-semibold text-red-500">{fundCalls.filter(c => c.status === 'OVERDUE').length}</p>
            </div>
          </div>
        </div>
      )}

      {/* New Capital Call Modal */}
      {showNewCallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-lg font-semibold text-aifm-charcoal">Nytt kapitalanrop</h3>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5">Skicka anrop till investerare</p>
              </div>
              <button onClick={() => setShowNewCallModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-aifm-gold/20 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-aifm-gold" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-aifm-charcoal text-sm">{fundName}</p>
                  <p className="text-xs text-aifm-charcoal/50">Återstår: {formatCurrency(remainingToCall, currency)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Typ *</label>
                <div className="grid grid-cols-2 gap-2">
                  {callTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewCallType(type.value)}
                      className={`px-3 py-3 rounded-xl text-sm font-medium transition-all border ${
                        newCallType === type.value
                          ? 'bg-aifm-charcoal text-white border-aifm-charcoal'
                          : 'bg-white text-aifm-charcoal/60 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Belopp ({currency}) *</label>
                  <input
                    type="number"
                    value={newCallAmount}
                    onChange={(e) => setNewCallAmount(e.target.value)}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10"
                    placeholder="5000000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Förfallodatum *</label>
                  <input
                    type="date"
                    value={newCallDueDate}
                    onChange={(e) => setNewCallDueDate(e.target.value)}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">Syfte *</label>
                <textarea
                  value={newCallPurpose}
                  onChange={(e) => setNewCallPurpose(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm h-20 resize-none focus:outline-none focus:border-aifm-gold/30"
                  placeholder="T.ex. Investering i TechStartup AB"
                />
              </div>
              
              {newCallAmount && (
                <div className="bg-aifm-gold/5 rounded-xl p-4 border border-aifm-gold/10">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-aifm-gold" />
                    <p className="text-sm font-semibold text-aifm-charcoal">Fördelning</p>
                  </div>
                  <div className="space-y-2">
                    {commitments.slice(0, 3).map((c) => {
                      const allocation = parseFloat(newCallAmount) * c.ownershipPercentage / 100;
                      return (
                        <div key={c.id} className="flex justify-between text-sm">
                          <span className="text-aifm-charcoal/60">{c.investor?.name}</span>
                          <span className="font-semibold text-aifm-charcoal">{formatCurrency(allocation, currency)}</span>
                        </div>
                      );
                    })}
                    {commitments.length > 3 && <p className="text-xs text-aifm-charcoal/40">+ {commitments.length - 3} fler</p>}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setShowNewCallModal(false)} className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30">
                Avbryt
              </button>
              <button 
                onClick={() => { alert('Kapitalanrop skapat! (Demo)'); setShowNewCallModal(false); setNewCallAmount(''); setNewCallPurpose(''); setNewCallDueDate(''); }}
                className="flex-1 py-3 px-4 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 shadow-lg shadow-aifm-charcoal/20 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Skapa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
