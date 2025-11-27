'use client';

import { useState } from 'react';
import { 
  ArrowUpRight, Plus, CheckCircle2, Clock,
  Send, Download, Wallet, FileText, Bell, X,
  ChevronRight, AlertCircle, Users
} from 'lucide-react';
import {
  getFundByCompanyId, getCapitalCallsByCompanyId, getCommitmentsByFund,
  formatCurrency, formatDate, formatPercentage, CapitalCall
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Metric Card with modern styling
function MetricCard({ 
  label, 
  value, 
  subValue,
  icon: Icon,
  variant = 'default'
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
  variant?: 'default' | 'primary' | 'highlight';
}) {
  const styles = {
    default: 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20',
    primary: 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20',
    highlight: 'bg-gradient-to-br from-aifm-gold via-aifm-gold to-aifm-gold/90 text-white shadow-xl shadow-aifm-gold/30',
  };

  const iconStyles = {
    default: 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10 text-aifm-charcoal/50 group-hover:text-aifm-gold',
    primary: 'bg-white/10 text-white/60',
    highlight: 'bg-white/20 text-white/80',
  };

  const isPrimary = variant !== 'default';

  return (
    <div className={`group relative rounded-2xl p-6 transition-all duration-500 hover:-translate-y-0.5 ${styles[variant]}`}>
      {!isPrimary && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl transition-colors duration-300 ${iconStyles[variant]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>
          {value}
        </p>
        {subValue && (
          <p className={`text-sm mt-2 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>{subValue}</p>
        )}
      </div>
    </div>
  );
}

// Capital Call Card
function CapitalCallCard({ 
  call, 
  currency, 
  isSelected, 
  onClick 
}: { 
  call: CapitalCall; 
  currency: string; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const paidAmount = call.items.reduce((sum, item) => sum + item.paidAmount, 0);
  const paidPercentage = (paidAmount / call.totalAmount) * 100;

  const getStatusStyles = (status: CapitalCall['status']) => {
    switch (status) {
      case 'FULLY_PAID': return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Betald' };
      case 'PARTIALLY_PAID': return { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Delvis betald' };
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
      className={`
        p-5 cursor-pointer transition-all duration-300 rounded-xl mx-3 my-2
        ${isSelected 
          ? 'bg-aifm-gold/5 border border-aifm-gold/20 shadow-lg shadow-aifm-gold/10' 
          : 'hover:bg-gray-50/80 border border-transparent'
        }
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-sm
            ${isSelected ? 'bg-aifm-gold text-white' : 'bg-aifm-charcoal/5 text-aifm-charcoal/70'}
          `}>
            #{call.callNumber}
          </div>
          <div>
            <p className="text-lg font-semibold text-aifm-charcoal">{formatCurrency(call.totalAmount, currency)}</p>
            <p className="text-xs text-aifm-charcoal/40">Förfaller: {formatDate(call.dueDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          <ChevronRight className={`w-4 h-4 text-aifm-charcoal/30 transition-transform duration-300 ${isSelected ? 'rotate-90' : ''}`} />
        </div>
      </div>
      
      <p className="text-sm text-aifm-charcoal/60 mb-4 line-clamp-1">{call.purpose}</p>
      
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-aifm-charcoal/40 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {call.items.filter(i => i.status === 'PAID').length}/{call.items.length} betalat
        </span>
        <span className="font-medium text-aifm-charcoal/60">{formatPercentage(paidPercentage)}</span>
      </div>
      
      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-emerald-500 rounded-full h-1.5 transition-all duration-500"
          style={{ width: `${paidPercentage}%` }}
        />
      </div>
    </div>
  );
}

export default function CapitalCallsPage() {
  const { selectedCompany } = useCompany();
  const [selectedCall, setSelectedCall] = useState<CapitalCall | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [newCallAmount, setNewCallAmount] = useState('');
  const [newCallPurpose, setNewCallPurpose] = useState('');

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const fundCalls = getCapitalCallsByCompanyId(selectedCompany.id);
  const commitments = selectedFund ? getCommitmentsByFund(selectedFund.id) : [];
  const currency = selectedFund?.currency || 'SEK';
  const fundName = selectedFund?.name || selectedCompany.shortName;
  
  const totalCommitted = commitments.reduce((sum, c) => sum + c.committedAmount, 0);
  const totalCalled = commitments.reduce((sum, c) => sum + c.calledAmount, 0);
  const remainingToCall = totalCommitted - totalCalled;
  const callPercentage = totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0;

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Kapitalanrop</h1>
          <p className="text-aifm-charcoal/40 mt-2">Hantera kapitalanrop och spåra investerares inbetalningar</p>
        </div>
        <button 
          onClick={() => setShowNewCallModal(true)}
          className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-white 
                     bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                     shadow-lg shadow-aifm-charcoal/20 transition-all duration-300"
        >
          <Plus className="w-4 h-4" />
          Nytt kapitalanrop
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          label="Totalt åtagande" 
          value={formatCurrency(totalCommitted, currency)}
          icon={Wallet}
          variant="primary"
        />
        <MetricCard 
          label="Inropat hittills" 
          value={formatCurrency(totalCalled, currency)}
          subValue={`${formatPercentage(callPercentage)} av åtagande`}
          icon={ArrowUpRight}
        />
        <MetricCard 
          label="Återstående" 
          value={formatCurrency(remainingToCall, currency)}
          icon={Clock}
        />
        <MetricCard 
          label="Aktiva anrop" 
          value={fundCalls.filter(c => c.status === 'SENT').length.toString()}
          icon={Bell}
          variant="highlight"
        />
      </div>

      {/* Progress Section */}
      <div className="bg-white rounded-2xl border border-gray-100/50 p-8 mb-10 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Kapitalanropsförlopp</h2>
            <p className="text-aifm-charcoal/40 text-sm mt-1">Övergripande status för kapitalinsamling</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-aifm-charcoal">{formatPercentage(callPercentage)}</p>
            <p className="text-sm text-aifm-charcoal/40">inropat</p>
          </div>
        </div>
        
        <div className="relative">
          <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-aifm-gold to-aifm-gold/80 rounded-full h-4 transition-all duration-700 relative"
              style={{ width: `${callPercentage}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
          </div>
          <div className="flex justify-between mt-3 text-xs text-aifm-charcoal/40 font-medium">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Capital Calls List */}
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
                <FileText className="w-4 h-4 text-aifm-charcoal/60" />
              </div>
              <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Kapitalanrop</h2>
            </div>
            <span className="text-xs text-aifm-charcoal/40 bg-gray-100 px-3 py-1 rounded-full">{fundCalls.length} totalt</span>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            {fundCalls.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ArrowUpRight className="w-8 h-8 text-aifm-charcoal/20" />
                </div>
                <p className="text-aifm-charcoal/50 font-medium">Inga kapitalanrop ännu</p>
                <p className="text-sm text-aifm-charcoal/30 mt-1 mb-6">Skapa ditt första kapitalanrop</p>
                <button 
                  onClick={() => setShowNewCallModal(true)}
                  className="px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors"
                >
                  Skapa anrop
                </button>
              </div>
            ) : (
              <div className="py-2">
                {fundCalls.map((call) => (
                  <CapitalCallCard 
                    key={call.id}
                    call={call}
                    currency={currency}
                    isSelected={selectedCall?.id === call.id}
                    onClick={() => setSelectedCall(call)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Call Details */}
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          {selectedCall ? (
            <>
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-aifm-gold rounded-xl flex items-center justify-center text-white font-semibold text-sm">
                    #{selectedCall.callNumber}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Kapitalanrop</h2>
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
                   selectedCall.status === 'PARTIALLY_PAID' ? 'Delvis betald' :
                   selectedCall.status === 'SENT' ? 'Skickad' :
                   selectedCall.status === 'OVERDUE' ? 'Förfallen' : 'Utkast'}
                </span>
              </div>
              
              <div className="p-6 border-b border-gray-100">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {[
                    { label: 'Anropsdatum', value: formatDate(selectedCall.callDate) },
                    { label: 'Förfallodatum', value: formatDate(selectedCall.dueDate) },
                    { label: 'Totalt belopp', value: formatCurrency(selectedCall.totalAmount, currency) },
                    { label: 'Mottaget', value: formatCurrency(selectedCall.items.reduce((sum, i) => sum + i.paidAmount, 0), currency), highlight: true },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50/50 rounded-xl p-4">
                      <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">{item.label}</p>
                      <p className={`font-semibold ${item.highlight ? 'text-emerald-600' : 'text-aifm-charcoal'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50/50 rounded-xl p-4">
                  <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Syfte</p>
                  <p className="text-aifm-charcoal">{selectedCall.purpose}</p>
                </div>
              </div>

              {/* Investor Breakdown */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Investerarbetalningar</h3>
                <span className="text-xs text-aifm-charcoal/40">
                  {selectedCall.items.filter(i => i.status === 'PAID').length} av {selectedCall.items.length} betalat
                </span>
              </div>
              
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                {selectedCall.items.map((item) => {
                  const investor = commitments.find(c => c.investorId === item.investorId)?.investor;
                  return (
                    <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          item.status === 'PAID' ? 'bg-emerald-100' :
                          item.status === 'PARTIAL' ? 'bg-blue-100' :
                          'bg-amber-100'
                        }`}>
                          {item.status === 'PAID' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : item.status === 'PARTIAL' ? (
                            <Clock className="w-4 h-4 text-blue-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal text-sm">{investor?.name || 'Okänd'}</p>
                          <p className="text-xs text-aifm-charcoal/40">
                            {item.paidAt ? `Betalt ${formatDate(item.paidAt)}` : 'Väntar på betalning'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-aifm-charcoal text-sm">{formatCurrency(item.amount, currency)}</p>
                        {item.paidAmount > 0 && item.paidAmount < item.amount && (
                          <p className="text-xs text-blue-600">{formatCurrency(item.paidAmount, currency)} betalt</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="p-6 bg-gray-50/50">
                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-aifm-charcoal/70 
                                     bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                                     hover:text-aifm-charcoal transition-all duration-300">
                    <Send className="w-4 h-4" />
                    Skicka påminnelse
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-aifm-charcoal/70 
                                     bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                                     hover:text-aifm-charcoal transition-all duration-300">
                    <Download className="w-4 h-4" />
                    Exportera
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-16 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-aifm-charcoal/20" />
              </div>
              <p className="text-aifm-charcoal/50 font-medium text-lg">Välj ett kapitalanrop</p>
              <p className="text-sm text-aifm-charcoal/30 mt-2">Klicka på ett anrop för att se detaljer</p>
            </div>
          )}
        </div>
      </div>

      {/* New Capital Call Modal */}
      {showNewCallModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Nytt kapitalanrop</h3>
              <button 
                onClick={() => setShowNewCallModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider mb-1">Fond</p>
                <p className="font-semibold text-aifm-charcoal">{fundName}</p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Anropsbelopp ({currency})
                </label>
                <input
                  type="number"
                  value={newCallAmount}
                  onChange={(e) => setNewCallAmount(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="Ange belopp"
                />
                <p className="text-xs text-aifm-charcoal/40 mt-2">
                  Återstående ej inropat: <span className="font-medium">{formatCurrency(remainingToCall, currency)}</span>
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Syfte
                </label>
                <textarea
                  value={newCallPurpose}
                  onChange={(e) => setNewCallPurpose(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm h-24 resize-none
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="T.ex. ny investering i Bolag X"
                />
              </div>
              
              <div className="bg-aifm-gold/5 rounded-xl p-5 border border-aifm-gold/10">
                <p className="text-sm font-semibold text-aifm-charcoal mb-4">Fördelningsförhandsgranskning</p>
                <div className="space-y-3">
                  {commitments.slice(0, 3).map((commitment) => {
                    const allocation = newCallAmount ? 
                      (parseFloat(newCallAmount) * commitment.ownershipPercentage / 100) : 0;
                    return (
                      <div key={commitment.id} className="flex justify-between items-center">
                        <span className="text-sm text-aifm-charcoal/60">{commitment.investor?.name}</span>
                        <span className="text-sm font-semibold text-aifm-charcoal">
                          {formatCurrency(allocation, currency)}
                        </span>
                      </div>
                    );
                  })}
                  {commitments.length > 3 && (
                    <p className="text-xs text-aifm-charcoal/40 pt-2 border-t border-aifm-gold/10">
                      + {commitments.length - 3} fler investerare
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowNewCallModal(false)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 
                           bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => {
                  alert('Kapitalanrop skapat! (Demo)');
                  setShowNewCallModal(false);
                  setNewCallAmount('');
                  setNewCallPurpose('');
                }}
                className="flex-1 py-3 px-4 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                           shadow-lg shadow-aifm-charcoal/20 transition-all"
              >
                Skapa anrop
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
