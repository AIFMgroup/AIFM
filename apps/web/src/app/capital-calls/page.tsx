'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowUpRight, Plus, CheckCircle2, Clock,
  Send, Download, Wallet, FileText, Bell, X,
  ChevronRight, AlertCircle, Users, TrendingUp
} from 'lucide-react';
import {
  getFundByCompanyId, getCapitalCallsByCompanyId, getCommitmentsByFund,
  formatCurrency, formatDate, formatPercentage, CapitalCall
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Animated progress bar
function AnimatedProgressBar({ percentage, color = 'aifm-gold' }: { percentage: number; color?: string }) {
  const [width, setWidth] = useState(0);
  
  useEffect(() => {
    setTimeout(() => setWidth(percentage), 100);
  }, [percentage]);
  
  return (
    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
      <div 
        className={`bg-${color} rounded-full h-3 transition-all duration-1000 ease-out relative`}
        style={{ width: `${width}%`, background: color === 'aifm-gold' ? '#c0a280' : undefined }}
      >
        <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
      </div>
    </div>
  );
}

// Animated bar chart
function BarChart({ data, currency }: { data: { month: string; amount: number; paid: number }[]; currency: string }) {
  const [animatedData, setAnimatedData] = useState(data.map(d => ({ ...d, animated: 0, animatedPaid: 0 })));
  const maxValue = Math.max(...data.map(d => d.amount));
  
  useEffect(() => {
    setTimeout(() => {
      setAnimatedData(data.map(d => ({ 
        ...d, 
        animated: (d.amount / maxValue) * 100,
        animatedPaid: (d.paid / maxValue) * 100
      })));
    }, 100);
  }, [data, maxValue]);
  
  return (
    <div className="h-48 flex items-end justify-between gap-3 px-4">
      {animatedData.map((item, index) => (
        <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full h-40 relative flex items-end justify-center gap-1">
            {/* Called amount bar */}
            <div 
              className="w-6 rounded-t-lg bg-aifm-charcoal/20 transition-all duration-700 ease-out relative group cursor-pointer"
              style={{ height: `${item.animated}%`, transitionDelay: `${index * 50}ms` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-aifm-charcoal text-white text-[10px] font-medium rounded whitespace-nowrap z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatCurrency(item.amount, currency)}
              </div>
            </div>
            {/* Paid amount bar */}
            <div 
              className="w-6 rounded-t-lg bg-emerald-500 transition-all duration-700 ease-out relative group cursor-pointer"
              style={{ height: `${item.animatedPaid}%`, transitionDelay: `${index * 50 + 100}ms` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-emerald-600 text-white text-[10px] font-medium rounded whitespace-nowrap z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatCurrency(item.paid, currency)}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-aifm-charcoal/50 uppercase tracking-wider font-medium">{item.month}</span>
        </div>
      ))}
    </div>
  );
}

// Donut chart for call status
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const [animatedData, setAnimatedData] = useState<{ label: string; value: number; color: string; animated: number; offset: number }[]>(
    data.map(d => ({ ...d, animated: 0, offset: 0 }))
  );
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  useEffect(() => {
    setTimeout(() => {
      let offset = 0;
      setAnimatedData(data.map(d => {
        const percentage = (d.value / total) * 100;
        const result = { ...d, animated: percentage, offset };
        offset += percentage;
        return result;
      }));
    }, 100);
  }, [data, total]);
  
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {animatedData.map((item, index) => {
          const circumference = Math.PI * 70;
          const strokeDasharray = `${(item.animated / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -((item.offset / 100) * circumference);
          
          return (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r="35"
              fill="transparent"
              stroke={item.color}
              strokeWidth="12"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              style={{ transitionDelay: `${index * 100}ms` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-bold text-aifm-charcoal">{total}</span>
      </div>
    </div>
  );
}

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
  const [newCallDueDate, setNewCallDueDate] = useState('');
  const [newCallType, setNewCallType] = useState('investment');

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const fundCalls = getCapitalCallsByCompanyId(selectedCompany.id);
  const commitments = selectedFund ? getCommitmentsByFund(selectedFund.id) : [];
  const currency = selectedFund?.currency || 'SEK';
  const fundName = selectedFund?.name || selectedCompany.shortName;
  
  const totalCommitted = commitments.reduce((sum, c) => sum + c.committedAmount, 0);
  const totalCalled = commitments.reduce((sum, c) => sum + c.calledAmount, 0);
  const remainingToCall = totalCommitted - totalCalled;
  const callPercentage = totalCommitted > 0 ? (totalCalled / totalCommitted) * 100 : 0;

  // Chart data
  const monthlyData = [
    { month: 'Jul', amount: 5000000, paid: 4800000 },
    { month: 'Aug', amount: 8000000, paid: 7500000 },
    { month: 'Sep', amount: 12000000, paid: 11000000 },
    { month: 'Okt', amount: 6000000, paid: 6000000 },
    { month: 'Nov', amount: 15000000, paid: 10000000 },
    { month: 'Dec', amount: 10000000, paid: 0 },
  ];

  const statusData = [
    { label: 'Betalda', value: fundCalls.filter(c => c.status === 'FULLY_PAID').length, color: '#10b981' },
    { label: 'Delvis', value: fundCalls.filter(c => c.status === 'PARTIALLY_PAID').length, color: '#3b82f6' },
    { label: 'Skickade', value: fundCalls.filter(c => c.status === 'SENT').length, color: '#f59e0b' },
    { label: 'Utkast', value: fundCalls.filter(c => c.status === 'DRAFT').length, color: '#9ca3af' },
  ];

  const callTypes = [
    { value: 'investment', label: 'Ny investering' },
    { value: 'follow_on', label: 'Uppföljningsinvestering' },
    { value: 'fees', label: 'Förvaltningsavgift' },
    { value: 'expenses', label: 'Fondkostnader' },
  ];

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

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-8 mb-10">
        {/* Progress & Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 p-8 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Kapitalanropsförlopp</h2>
              <p className="text-aifm-charcoal/40 text-sm mt-1">Månadsvis översikt av anrop och inbetalningar</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-aifm-charcoal">{formatPercentage(callPercentage)}</p>
              <p className="text-sm text-aifm-charcoal/40">inropat</p>
            </div>
          </div>
          
          <div className="mb-8">
            <AnimatedProgressBar percentage={callPercentage} />
            <div className="flex justify-between mt-2 text-xs text-aifm-charcoal/40 font-medium">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <BarChart data={monthlyData} currency={currency} />
          
          <div className="flex items-center justify-center gap-6 mt-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-aifm-charcoal/20" />
              <span className="text-aifm-charcoal/60">Inropat belopp</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-aifm-charcoal/60">Mottagna betalningar</span>
            </div>
          </div>
        </div>

        {/* Status Donut */}
        <div className="bg-white rounded-2xl border border-gray-100/50 p-8 hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-6">Statusfördelning</h2>
          
          <div className="flex flex-col items-center">
            <DonutChart data={statusData} />
            
            <div className="w-full mt-6 space-y-3">
              {statusData.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-aifm-charcoal/70">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-aifm-charcoal">{item.value}</span>
                </div>
              ))}
            </div>
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
          
          <div className="max-h-[500px] overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-4 mb-4">
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
              
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                {selectedCall.items.map((item) => {
                  const investor = commitments.find(c => c.investorId === item.investorId)?.investor;
                  return (
                    <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
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
                            {item.paidAt ? `Betalt ${formatDate(item.paidAt)}` : 'Väntar'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-aifm-charcoal text-sm">{formatCurrency(item.amount, currency)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="p-6 bg-gray-50/50">
                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                                     bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all">
                    <Send className="w-4 h-4" />
                    Påminnelse
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                                     bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all">
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
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="text-xl font-semibold text-aifm-charcoal">Nytt kapitalanrop</h3>
                <p className="text-sm text-aifm-charcoal/40 mt-1">Skapa ett nytt kapitalanrop till investerare</p>
              </div>
              <button 
                onClick={() => setShowNewCallModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Fund Info */}
              <div className="bg-gradient-to-br from-aifm-charcoal/5 to-transparent rounded-xl p-5 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-aifm-gold/20 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-aifm-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-aifm-charcoal">{fundName}</p>
                    <p className="text-sm text-aifm-charcoal/50">Återstående att inropa: {formatCurrency(remainingToCall, currency)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-aifm-charcoal">{formatPercentage(callPercentage)}</p>
                    <p className="text-xs text-aifm-charcoal/40">inropat</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

              {/* Call Type */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-3 uppercase tracking-wider">
                  Typ av anrop *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {callTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewCallType(type.value)}
                      className={`px-4 py-4 rounded-xl text-sm font-medium transition-all duration-300 border-2 text-left ${
                        newCallType === type.value
                          ? 'bg-aifm-charcoal text-white border-aifm-charcoal shadow-lg shadow-aifm-charcoal/20'
                          : 'bg-white text-aifm-charcoal/60 border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Anropsbelopp ({currency}) *
                  </label>
                  <input
                    type="number"
                    value={newCallAmount}
                    onChange={(e) => setNewCallAmount(e.target.value)}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                               focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                    placeholder="Ange belopp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                    Förfallodatum *
                  </label>
                  <input
                    type="date"
                    value={newCallDueDate}
                    onChange={(e) => setNewCallDueDate(e.target.value)}
                    className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm
                               focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  />
                </div>
              </div>
              
              {/* Purpose */}
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Syfte *
                </label>
                <textarea
                  value={newCallPurpose}
                  onChange={(e) => setNewCallPurpose(e.target.value)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm h-24 resize-none
                             focus:outline-none focus:border-aifm-gold/30 focus:ring-2 focus:ring-aifm-gold/10 transition-all"
                  placeholder="T.ex. Investering i TechStartup AB - Serie A"
                />
              </div>
              
              {/* Preview */}
              {newCallAmount && (
                <div className="bg-aifm-gold/5 rounded-xl p-6 border border-aifm-gold/10">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-aifm-gold" />
                    <p className="text-sm font-semibold text-aifm-charcoal">Fördelning per investerare</p>
                  </div>
                  <div className="space-y-3">
                    {commitments.slice(0, 4).map((commitment) => {
                      const allocation = newCallAmount ? 
                        (parseFloat(newCallAmount) * commitment.ownershipPercentage / 100) : 0;
                      return (
                        <div key={commitment.id} className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-aifm-charcoal/10 rounded-full flex items-center justify-center text-xs font-medium text-aifm-charcoal/60">
                              {commitment.investor?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                            </div>
                            <div>
                              <span className="text-sm text-aifm-charcoal">{commitment.investor?.name}</span>
                              <p className="text-xs text-aifm-charcoal/40">{formatPercentage(commitment.ownershipPercentage)}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-aifm-charcoal">
                            {formatCurrency(allocation, currency)}
                          </span>
                        </div>
                      );
                    })}
                    {commitments.length > 4 && (
                      <p className="text-xs text-aifm-charcoal/40 pt-3 border-t border-aifm-gold/10">
                        + {commitments.length - 4} fler investerare
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-8 py-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button 
                onClick={() => setShowNewCallModal(false)}
                className="flex-1 py-3.5 px-4 text-sm font-medium text-aifm-charcoal/70 
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
                  setNewCallDueDate('');
                }}
                className="flex-1 py-3.5 px-4 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                           shadow-lg shadow-aifm-charcoal/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Skapa kapitalanrop
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
