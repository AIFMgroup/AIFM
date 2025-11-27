'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, ArrowUpRight, ArrowDownRight, FolderLock
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
  value
}: { 
  height: number; 
  color: string; 
  delay?: number;
  value?: number;
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
      {/* Page Title - More space */}
      <div className="mb-10">
        <h2 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Översikt</h2>
        <p className="text-aifm-charcoal/40 mt-2">{selectedCompany.shortName}</p>
      </div>

      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        <div className="bg-white rounded-xl p-6">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">NAV</p>
          <p className="text-2xl font-medium text-aifm-charcoal mt-2">{formatCurrencyCompact(metrics.nav)}</p>
        </div>
        <div className="bg-white rounded-xl p-6">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">MOIC</p>
          <p className="text-2xl font-medium text-aifm-charcoal mt-2">{metrics.moic.toFixed(2)}x</p>
        </div>
        <div className="bg-white rounded-xl p-6">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">IRR</p>
          <p className="text-2xl font-medium text-aifm-charcoal mt-2">{metrics.irr.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl p-6">
          <p className="text-xs text-aifm-charcoal/40 uppercase tracking-wider">Orealiserad vinst</p>
          <p className="text-2xl font-medium text-green-600 mt-2">+{formatCurrencyCompact(metrics.unrealizedGain)}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left column - 2/3 width */}
        <div className="lg:col-span-2 space-y-8">
          {/* Portfolio Overview - Larger donut chart */}
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50">
              <h3 className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Portföljöversikt</h3>
            </div>
            <div className="p-8">
              <div className="flex items-center gap-16">
                {/* Larger Donut Chart */}
                <div className="relative w-64 h-64 flex-shrink-0">
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
                          <p className="text-3xl font-medium text-aifm-charcoal">{hoveredInfo.percentage}%</p>
                          <p className="text-sm text-aifm-charcoal/40 mt-1">{hoveredInfo.name}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-3xl font-medium text-aifm-charcoal">{formatCurrencyCompact(totalPortfolioValue)}</p>
                          <p className="text-sm text-aifm-charcoal/40 mt-1">Totalt</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex-1 space-y-4">
                  {portfolio.map((item) => (
                    <div 
                      key={item.name} 
                      className={`flex items-center justify-between py-2 cursor-pointer transition-all ${hoveredSegment === item.name ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`} 
                      onMouseEnter={() => setHoveredSegment(item.name)} 
                      onMouseLeave={() => setHoveredSegment(null)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-aifm-charcoal">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-aifm-charcoal">{item.percentage}%</span>
                        <span className="text-xs text-aifm-charcoal/40 ml-3">{formatCurrencyCompact(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Chart - Much Larger */}
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Nyckeltal</h3>
              <CustomSelect options={kpiOptions} value={selectedKPI} onChange={setSelectedKPI} />
            </div>
            <div className="p-8">
              {/* Much larger chart area */}
              <div className="h-80 flex items-end justify-between gap-6 px-4 pb-8">
                {kpiData.map((data, index) => {
                  const maxValue = Math.max(...kpiData.map(d => Math.max(d.value1, d.value2)));
                  const height1 = (data.value1 / maxValue) * 75;
                  const height2 = (data.value2 / maxValue) * 75;
                  return (
                    <div key={data.month} className="flex-1 flex flex-col items-center">
                      <div className="w-full h-64 flex items-end justify-center gap-2">
                        <AnimatedBar height={height1} color="#c0a280" delay={index * 100} value={data.value1} />
                        <AnimatedBar height={height2} color="#615c59" delay={index * 100 + 50} value={data.value2} />
                      </div>
                      <span className="text-xs text-aifm-charcoal/40 mt-4">{data.month}</span>
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-8 pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-aifm-gold" />
                  <span className="text-xs text-aifm-charcoal/50">Faktiskt</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-aifm-charcoal" />
                  <span className="text-xs text-aifm-charcoal/50">Mål</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions - Simplified */}
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Senaste transaktioner</h3>
              <Link href="/treasury" className="text-xs text-aifm-charcoal/40 hover:text-aifm-charcoal flex items-center gap-1">
                Visa alla <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {transactions.slice(0, 4).map((tx) => (
                <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full 
                      ${tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? 'bg-green-500' : 'bg-aifm-charcoal/30'}`} 
                    />
                    <div>
                      <p className="text-sm text-aifm-charcoal">{tx.description}</p>
                      <p className="text-xs text-aifm-charcoal/40 mt-0.5">{getTransactionTypeLabel(tx.type)} • {tx.date.toLocaleDateString('sv-SE')}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-medium ${tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? 'text-green-600' : 'text-aifm-charcoal'}`}>
                    {tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? '+' : '-'}{formatCurrencyCompact(tx.amount, tx.currency)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column - 1/3 width */}
        <div className="space-y-8">
          {/* Tasks - Simplified */}
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Uppgifter</h3>
              <Link href="/approvals" className="text-xs text-aifm-charcoal/40 hover:text-aifm-charcoal flex items-center gap-1">
                Visa alla <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 space-y-2">
              {tasks.slice(0, 4).map((task) => (
                <div key={task.id} className={`p-4 rounded-lg ${task.status === 'DONE' ? 'bg-gray-50' : 'bg-gray-50/50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center 
                      ${task.status === 'DONE' ? 'bg-aifm-charcoal border-aifm-charcoal' : 'border-gray-300'}`}
                    >
                      {task.status === 'DONE' && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${task.status === 'DONE' ? 'text-aifm-charcoal/40 line-through' : 'text-aifm-charcoal'}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-aifm-charcoal/40">
                          {task.dueDate.toLocaleDateString('sv-SE')}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded 
                          ${task.priority === 'HIGH' ? 'bg-red-100 text-red-600' : 
                            task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-600' : 
                            'bg-gray-100 text-gray-500'}`}
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

          {/* Summary */}
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50">
              <h3 className="text-xs font-medium text-aifm-charcoal/40 uppercase tracking-wider">Sammanfattning</h3>
            </div>
            <div className="p-6 space-y-5">
              {[
                { label: 'NAV', value: metrics.nav, color: '#c0a280' }, 
                { label: 'Totalt investerat', value: metrics.totalInvested, color: '#615c59' }, 
                { label: 'Utdelat', value: metrics.totalDistributed, color: '#059669' }
              ].map((item, index) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-aifm-charcoal/50">{item.label}</span>
                    <span className="text-sm font-medium text-aifm-charcoal">{formatCurrencyCompact(item.value)}</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
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
            </div>
          </div>

          {/* Quick Actions - Fixed white text */}
          <div className="bg-aifm-charcoal rounded-xl p-6">
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-5">Snabbåtgärder</h3>
            <div className="space-y-2">
              {[
                { href: '/capital-calls', label: 'Nytt kapitalanrop', icon: ArrowUpRight }, 
                { href: '/distributions', label: 'Ny utdelning', icon: ArrowDownRight }, 
                { href: '/data-rooms', label: 'Öppna datarum', icon: FolderLock }
              ].map((action) => (
                <Link 
                  key={action.href} 
                  href={action.href} 
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm">{action.label}</span>
                  <action.icon className="w-4 h-4 text-white/50" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
