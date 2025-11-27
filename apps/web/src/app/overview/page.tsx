'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Calendar, ChevronRight,
  ArrowUpRight, ArrowDownRight, FolderLock, DollarSign
} from 'lucide-react';
import {
  mockCompanies, getCompanyDashboard, formatCurrencyCompact,
  Company
} from '@/lib/companyData';
import { DashboardLayout } from '@/components/DashboardLayout';

// Custom Select Component
function CustomSelect({ 
  options, 
  value, 
  onChange, 
  className = '' 
}: { 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (value: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gray-50 to-gray-100 
                   rounded-lg text-xs font-medium text-aifm-charcoal border border-gray-200
                   hover:from-aifm-gold/5 hover:to-aifm-gold/10 hover:border-aifm-gold/30
                   transition-all duration-300 group"
      >
        <span>{selectedOption?.label || value}</span>
        <svg className={`w-3 h-3 text-aifm-charcoal/40 group-hover:text-aifm-gold transition-all duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-xl border border-gray-100 
                          shadow-xl overflow-hidden z-50 min-w-[120px] animate-in fade-in slide-in-from-top-2 duration-200">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-xs text-left transition-all duration-200 
                           ${value === option.value 
                             ? 'bg-aifm-gold/10 text-aifm-gold font-medium' 
                             : 'text-aifm-charcoal hover:bg-gray-50'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Animated Bar Component - Larger and cleaner
function AnimatedBar({ 
  height, 
  color, 
  delay = 0, 
  value,
  label
}: { 
  height: number; 
  color: string; 
  delay?: number;
  value?: number;
  label?: string;
}) {
  const [animatedHeight, setAnimatedHeight] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedHeight(height);
    }, delay);
    return () => clearTimeout(timer);
  }, [height, delay]);

  return (
    <div 
      className="relative flex flex-col items-center group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip - positioned above the chart area */}
      {isHovered && value !== undefined && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-aifm-charcoal text-white 
                        text-[10px] rounded-lg whitespace-nowrap z-20 animate-in fade-in duration-150 pointer-events-none">
          {value.toFixed(0)}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-aifm-charcoal rotate-45" />
        </div>
      )}
      <div 
        className="w-4 rounded-t transition-all duration-700 ease-out hover:opacity-80"
        style={{ 
          height: `${animatedHeight}%`,
          backgroundColor: color,
          boxShadow: isHovered ? `0 0 12px ${color}40` : 'none'
        }}
      />
    </div>
  );
}

// Animated Donut Segment - Fixed to not overlap
function DonutSegment({ 
  percentage, 
  offset, 
  color, 
  delay = 0,
  isHovered,
  onHover
}: { 
  percentage: number; 
  offset: number; 
  color: string; 
  delay?: number;
  name: string;
  value: number;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
}) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const circumference = 2 * Math.PI * 35;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, delay);
    return () => clearTimeout(timer);
  }, [percentage, delay]);

  const strokeDasharray = `${(animatedPercentage / 100) * circumference} ${circumference}`;
  const strokeDashoffset = -((offset / 100) * circumference);

  return (
    <circle
      cx="50"
      cy="50"
      r="35"
      fill="none"
      stroke={color}
      strokeWidth={isHovered ? 22 : 18}
      strokeDasharray={strokeDasharray}
      strokeDashoffset={strokeDashoffset}
      className="transition-all duration-500 ease-out cursor-pointer"
      style={{
        filter: isHovered ? `drop-shadow(0 0 8px ${color}60)` : 'none',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        transformOrigin: 'center'
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    />
  );
}

export default function OverviewPage() {
  const [selectedCompany, setSelectedCompany] = useState<Company>(mockCompanies[0]);
  const [selectedKPI, setSelectedKPI] = useState('NAV');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  
  const dashboard = getCompanyDashboard(selectedCompany.id);

  if (!dashboard) {
    return <div>Laddar...</div>;
  }

  const { portfolio, transactions, tasks, kpiData, metrics } = dashboard;
  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + item.value, 0);

  const getTransactionTypeLabel = (type: string) => {
    switch(type) {
      case 'INVESTMENT': return 'Investering';
      case 'INCOME': return 'Intäkt';
      case 'DISTRIBUTION': return 'Utdelning';
      case 'EXPENSE': return 'Utgift';
      default: return type;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch(priority) {
      case 'HIGH': return 'Hög';
      case 'MEDIUM': return 'Medel';
      case 'LOW': return 'Låg';
      default: return priority;
    }
  };

  const kpiOptions = [
    { value: 'NAV', label: 'NAV' },
    { value: 'IRR', label: 'IRR' },
    { value: 'MOIC', label: 'MOIC' },
  ];

  const getSegmentOffset = (index: number) => {
    return portfolio.slice(0, index).reduce((sum, i) => sum + i.percentage, 0);
  };

  const hoveredInfo = portfolio.find(p => p.name === hoveredSegment);

  return (
    <DashboardLayout 
      selectedCompany={selectedCompany} 
      onCompanyChange={setSelectedCompany}
    >
      {/* Page Title */}
      <div className="mb-6">
        <h2 className="text-xl font-medium text-aifm-charcoal uppercase tracking-wider">Översikt</h2>
        <p className="text-sm text-aifm-charcoal/50 mt-1">Realtidsöverblick av {selectedCompany.shortName}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Portfolio Overview - Larger donut chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-aifm-gold/5 transition-all duration-300">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Portföljöversikt</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-12">
                {/* Larger Donut Chart */}
                <div className="relative w-56 h-56 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {portfolio.map((item, index) => (
                      <DonutSegment 
                        key={item.name} 
                        percentage={item.percentage} 
                        offset={getSegmentOffset(index)} 
                        color={item.color} 
                        delay={index * 100} 
                        name={item.name} 
                        value={item.value} 
                        isHovered={hoveredSegment === item.name} 
                        onHover={(hovered) => setHoveredSegment(hovered ? item.name : null)} 
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      {hoveredInfo ? (
                        <>
                          <p className="text-2xl font-bold text-aifm-charcoal animate-in fade-in duration-200">{hoveredInfo.percentage}%</p>
                          <p className="text-sm text-aifm-charcoal/50 animate-in fade-in duration-200">{hoveredInfo.name}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold text-aifm-charcoal">{formatCurrencyCompact(totalPortfolioValue)}</p>
                          <p className="text-sm text-aifm-charcoal/50">Totalt</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex-1 space-y-3">
                  {portfolio.map((item) => (
                    <div 
                      key={item.name} 
                      className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 cursor-pointer ${hoveredSegment === item.name ? 'bg-gray-50 scale-[1.02]' : 'hover:bg-gray-50'}`} 
                      onMouseEnter={() => setHoveredSegment(item.name)} 
                      onMouseLeave={() => setHoveredSegment(null)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-md transition-all duration-300" 
                          style={{ 
                            backgroundColor: item.color, 
                            boxShadow: hoveredSegment === item.name ? `0 0 12px ${item.color}60` : 'none' 
                          }} 
                        />
                        <span className="text-sm text-aifm-charcoal font-medium">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-aifm-charcoal">{item.percentage}%</span>
                        <span className="text-xs text-aifm-charcoal/50 ml-2">{formatCurrencyCompact(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-aifm-gold/5 transition-all duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Transaktioner</h3>
              <Link href="/treasury" className="text-xs text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1 hover:gap-2 transition-all duration-200">
                Visa alla <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {transactions.map((tx, index) => (
                <div 
                  key={tx.id} 
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-all duration-200 cursor-pointer group" 
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg 
                      ${tx.type === 'INVESTMENT' ? 'bg-blue-100 group-hover:shadow-blue-200' : 
                        tx.type === 'INCOME' ? 'bg-green-100 group-hover:shadow-green-200' : 
                        tx.type === 'DISTRIBUTION' ? 'bg-purple-100 group-hover:shadow-purple-200' : 
                        'bg-amber-100 group-hover:shadow-amber-200'}`}
                    >
                      {tx.type === 'INVESTMENT' && <ArrowUpRight className="w-5 h-5 text-blue-600" />}
                      {tx.type === 'INCOME' && <TrendingUp className="w-5 h-5 text-green-600" />}
                      {tx.type === 'DISTRIBUTION' && <ArrowDownRight className="w-5 h-5 text-purple-600" />}
                      {tx.type === 'EXPENSE' && <DollarSign className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div>
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-md uppercase mr-2 
                        ${tx.type === 'INVESTMENT' ? 'bg-blue-100 text-blue-700' : 
                          tx.type === 'INCOME' ? 'bg-green-100 text-green-700' : 
                          tx.type === 'DISTRIBUTION' ? 'bg-purple-100 text-purple-700' : 
                          'bg-amber-100 text-amber-700'}`}
                      >
                        {getTransactionTypeLabel(tx.type)}
                      </span>
                      <p className="text-sm text-aifm-charcoal">{tx.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? 'text-green-600' : 'text-aifm-charcoal'}`}>
                      {tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? '+' : '-'}{formatCurrencyCompact(tx.amount, tx.currency)}
                    </p>
                    <p className="text-xs text-aifm-charcoal/50">{tx.date.toLocaleDateString('sv-SE')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-aifm-gold/5 transition-all duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Uppgifter</h3>
              <Link href="/approvals" className="text-xs text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1 hover:gap-2 transition-all duration-200">
                Visa alla <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {tasks.map((task, index) => (
                <div 
                  key={task.id} 
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer hover:scale-[1.01] 
                    ${task.status === 'DONE' 
                      ? 'bg-gray-50/50 border-gray-100' 
                      : 'bg-white border-gray-200 hover:border-aifm-gold/50 hover:shadow-lg hover:shadow-aifm-gold/5'}`} 
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 
                      ${task.status === 'DONE' ? 'bg-aifm-gold border-aifm-gold' : 'border-gray-300 hover:border-aifm-gold'}`}
                    >
                      {task.status === 'DONE' && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${task.status === 'DONE' ? 'text-aifm-charcoal/50 line-through' : 'text-aifm-charcoal'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-aifm-charcoal/50 mt-0.5">{task.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-aifm-charcoal/50">
                          <Calendar className="w-3 h-3" />
                          {task.dueDate.toLocaleDateString('sv-SE')}
                        </span>
                        {task.assignee && <span className="text-xs text-aifm-charcoal/50">{task.assignee}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium 
                          ${task.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 
                            task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 
                            'bg-gray-100 text-gray-600'}`}
                        >
                          {getPriorityLabel(task.priority)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column - 1/3 width */}
        <div className="space-y-6">
          {/* KPI Chart - Larger */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-aifm-gold/5 transition-all duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Nyckeltal</h3>
              <CustomSelect options={kpiOptions} value={selectedKPI} onChange={setSelectedKPI} />
            </div>
            <div className="p-6">
              {/* Larger chart area with proper spacing for tooltips */}
              <div className="h-52 flex items-end justify-between gap-3 px-2 pt-8">
                {kpiData.map((data, index) => {
                  const maxValue = Math.max(...kpiData.map(d => Math.max(d.value1, d.value2)));
                  const height1 = (data.value1 / maxValue) * 85; // Max 85% to leave room for tooltips
                  const height2 = (data.value2 / maxValue) * 85;
                  return (
                    <div key={data.month} className="flex-1 flex flex-col items-center">
                      <div className="w-full h-44 flex items-end justify-center gap-1.5">
                        <AnimatedBar height={height1} color="#c0a280" delay={index * 100} value={data.value1} />
                        <AnimatedBar height={height2} color="#615c59" delay={index * 100 + 50} value={data.value2} />
                      </div>
                      <span className="text-[10px] text-aifm-charcoal/50 mt-3 font-medium">{data.month}</span>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-aifm-gold shadow-sm shadow-aifm-gold/30" />
                  <span className="text-xs text-aifm-charcoal/60 font-medium">Faktiskt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-aifm-charcoal shadow-sm" />
                  <span className="text-xs text-aifm-charcoal/60 font-medium">Mål</span>
                </div>
              </div>
            </div>
          </div>

          {/* MOIC & IRR Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-xl hover:shadow-aifm-gold/10 transition-all duration-300 hover:scale-105 cursor-pointer group">
              <p className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider mb-1">MOIC</p>
              <p className="text-3xl font-bold text-aifm-charcoal group-hover:text-aifm-gold transition-colors">{metrics.moic.toFixed(2)}x</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs text-green-600">Multipel på investerat</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-xl hover:shadow-aifm-gold/10 transition-all duration-300 hover:scale-105 cursor-pointer group">
              <p className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider mb-1">IRR</p>
              <p className="text-3xl font-bold text-aifm-charcoal group-hover:text-aifm-gold transition-colors">{metrics.irr.toFixed(1)}%</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs text-green-600">Internränta</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-aifm-gold/5 transition-all duration-300">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Sammanfattning</h3>
            </div>
            <div className="p-4 space-y-4">
              {[
                { label: 'NAV', value: metrics.nav, color: '#c0a280' }, 
                { label: 'Totalt investerat', value: metrics.totalInvested, color: '#615c59' }, 
                { label: 'Utdelat', value: metrics.totalDistributed, color: '#059669' }
              ].map((item, index) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-aifm-charcoal/60">{item.label}</span>
                    <span className="font-medium text-aifm-charcoal">{formatCurrencyCompact(item.value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ 
                        width: `${Math.min((item.value / metrics.nav) * 100, 100)}%`, 
                        backgroundColor: item.color, 
                        transitionDelay: `${index * 200}ms` 
                      }} 
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-aifm-charcoal/60">Orealiserad vinst</span>
                  <span className="font-bold text-green-600">+{formatCurrencyCompact(metrics.unrealizedGain)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-5 text-white shadow-xl shadow-aifm-charcoal/20">
            <h3 className="text-sm font-medium uppercase tracking-wider mb-4">Snabbåtgärder</h3>
            <div className="space-y-2">
              {[
                { href: '/capital-calls', label: 'Nytt kapitalanrop', icon: ArrowUpRight }, 
                { href: '/distributions', label: 'Ny utdelning', icon: ArrowDownRight }, 
                { href: '/data-rooms', label: 'Öppna datarum', icon: FolderLock }
              ].map((action) => (
                <Link 
                  key={action.href} 
                  href={action.href} 
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-aifm-gold/80 transition-all duration-300 group hover:shadow-lg hover:shadow-aifm-gold/20"
                >
                  <span className="text-sm">{action.label}</span>
                  <action.icon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
