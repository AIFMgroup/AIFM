'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, FolderOpen,
  TrendingUp, Wallet, PieChart, BarChart3, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import {
  getCompanyDashboard, formatCurrencyCompact
} from '@/lib/companyData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Hero Metric Card - Always visible, larger
function HeroMetricCard({ 
  label, 
  value, 
  subValue, 
  trend,
  icon: Icon,
  delay = 0,
  variant = 'default'
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  delay?: number;
  variant?: 'default' | 'primary';
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const isPrimary = variant === 'primary';

  return (
    <div className={`
      relative group rounded-2xl p-6 
      transition-all duration-700 ease-out
      hover:-translate-y-1
      ${isPrimary 
        ? 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20' 
        : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20'
      }
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    `}>
      {!isPrimary && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl transition-colors duration-300 ${
            isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'
          }`}>
            <Icon className={`w-5 h-5 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/60 group-hover:text-aifm-gold'} transition-colors duration-300`} />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend === 'up' 
                ? isPrimary ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-600' 
                : isPrimary ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : null}
              {subValue}
            </div>
          )}
        </div>
        
        <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// Collapsible Section
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  linkHref,
  linkText
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  linkHref?: string;
  linkText?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
            <Icon className="w-4 h-4 text-aifm-charcoal/60" />
          </div>
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {linkHref && linkText && isOpen && (
            <Link 
              href={linkHref} 
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-aifm-charcoal/40 hover:text-aifm-gold flex items-center gap-1 transition-colors"
            >
              {linkText} <ChevronRight className="w-3 h-3" />
            </Link>
          )}
          <ChevronDown className={`w-5 h-5 text-aifm-charcoal/40 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
}

// Animated Bar for charts - thinner bars
function AnimatedBar({ 
  height, 
  color, 
  delay = 0, 
  value,
  isActual = true
}: { 
  height: number; 
  color: string; 
  delay?: number;
  value?: number;
  isActual?: boolean;
}) {
  const [animatedHeight, setAnimatedHeight] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedHeight(height), delay);
    return () => clearTimeout(timer);
  }, [height, delay]);

  return (
    <div 
      className="relative flex flex-col items-center group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && value !== undefined && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-aifm-charcoal text-white 
                        text-[10px] font-medium rounded whitespace-nowrap z-20 shadow-lg">
          {value.toFixed(1)}
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-aifm-charcoal rotate-45" />
        </div>
      )}
      <div 
        className={`w-4 rounded transition-all duration-700 ease-out ${isActual ? '' : 'opacity-40'}`}
        style={{ 
          height: `${animatedHeight}%`,
          backgroundColor: color,
          boxShadow: isHovered ? `0 0 12px ${color}40` : 'none'
        }}
      />
    </div>
  );
}

// Donut Segment
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
  const circumference = 2 * Math.PI * 38;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercentage(percentage), delay);
    return () => clearTimeout(timer);
  }, [percentage, delay]);

  return (
    <circle
      cx="50"
      cy="50"
      r="38"
      fill="none"
      stroke={color}
      strokeWidth={isHovered ? 14 : 10}
      strokeDasharray={`${(animatedPercentage / 100) * circumference} ${circumference}`}
      strokeDashoffset={-((offset / 100) * circumference)}
      strokeLinecap="round"
      className="transition-all duration-500 ease-out cursor-pointer"
      style={{
        filter: isHovered ? `drop-shadow(0 0 12px ${color}80)` : 'none',
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    />
  );
}

// KPI Selector Tabs
function KPITabs({ 
  options, 
  value, 
  onChange 
}: { 
  options: { value: string; label: string }[]; 
  value: string; 
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex bg-gray-100/80 rounded-xl p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-300 ${
            value === option.value
              ? 'bg-white text-aifm-charcoal shadow-sm'
              : 'text-aifm-charcoal/50 hover:text-aifm-charcoal'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Task Item
function TaskItem({ task }: { task: { id: string; title: string; status: string; dueDate: Date } }) {
  return (
    <div className={`p-4 rounded-xl transition-all duration-300 ${
      task.status === 'DONE' ? 'bg-gray-50/50' : 'bg-gray-50 hover:bg-gray-100/50'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
          task.status === 'DONE' ? 'bg-emerald-500' : task.status === 'IN_PROGRESS' ? 'bg-amber-500' : 'bg-gray-200'
        }`}>
          {task.status === 'DONE' && <CheckCircle2 className="w-3 h-3 text-white" />}
          {task.status === 'IN_PROGRESS' && <Clock className="w-3 h-3 text-white" />}
          {task.status === 'TODO' && <AlertCircle className="w-3 h-3 text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${task.status === 'DONE' ? 'text-aifm-charcoal/40 line-through' : 'text-aifm-charcoal'}`}>
            {task.title}
          </p>
          <p className="text-xs text-aifm-charcoal/40 mt-1">
            {task.dueDate.toLocaleDateString('sv-SE')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { selectedCompany } = useCompany();
  const [selectedKPI, setSelectedKPI] = useState('NAV');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  
  const dashboard = getCompanyDashboard(selectedCompany.id);

  if (!dashboard) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-pulse text-aifm-charcoal/40">Laddar...</div>
        </div>
      </DashboardLayout>
    );
  }

  const { portfolio, transactions, tasks, kpiDataSet, metrics } = dashboard;
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

  const getSegmentOffset = (index: number) => {
    return portfolio.slice(0, index).reduce((sum, i) => sum + i.percentage, 0);
  };

  const kpiOptions = [
    { value: 'NAV', label: 'NAV' },
    { value: 'IRR', label: 'IRR' },
    { value: 'MOIC', label: 'MOIC' },
  ];

  const hoveredInfo = portfolio.find(p => p.name === hoveredSegment);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Översikt</h1>
        <p className="text-aifm-charcoal/40 mt-2 text-sm">{selectedCompany.name}</p>
      </div>

      {/* HERO: Key Metrics - Always Visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <HeroMetricCard 
          label="Nettotillgångsvärde" 
          value={formatCurrencyCompact(metrics.nav)}
          icon={Wallet}
          delay={0}
          variant="primary"
        />
        <HeroMetricCard 
          label="MOIC" 
          value={`${metrics.moic.toFixed(2)}x`}
          subValue="+12.3%"
          trend="up"
          icon={TrendingUp}
          delay={100}
        />
        <HeroMetricCard 
          label="IRR" 
          value={`${metrics.irr.toFixed(1)}%`}
          subValue="Över mål"
          trend="up"
          icon={BarChart3}
          delay={200}
        />
        <HeroMetricCard 
          label="Orealiserad vinst" 
          value={`+${formatCurrencyCompact(metrics.unrealizedGain)}`}
          icon={TrendingUp}
          delay={300}
        />
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-3 mb-10">
        <Link 
          href="/capital-calls" 
          className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium 
                     text-aifm-charcoal/70 hover:border-aifm-gold/30 hover:text-aifm-charcoal transition-all"
        >
          <ArrowUpRight className="w-4 h-4" />
          Nytt kapitalanrop
        </Link>
        <Link 
          href="/distributions" 
          className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium 
                     text-aifm-charcoal/70 hover:border-aifm-gold/30 hover:text-aifm-charcoal transition-all"
        >
          <ArrowDownRight className="w-4 h-4" />
          Ny utdelning
        </Link>
        <Link 
          href="/data-rooms" 
          className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium 
                     text-aifm-charcoal/70 hover:border-aifm-gold/30 hover:text-aifm-charcoal transition-all"
        >
          <FolderOpen className="w-4 h-4" />
          Öppna datarum
        </Link>
      </div>

      {/* Collapsible Sections */}
      <div className="space-y-6">
        
        {/* Portfolio Distribution - Collapsed by default */}
        <CollapsibleSection 
          title="Portföljfördelning" 
          icon={PieChart} 
          defaultOpen={true}
          linkHref="/portfolio"
          linkText="Detaljer"
        >
          <div className="p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              {/* Donut Chart */}
              <div className="relative w-48 h-48 lg:w-56 lg:h-56 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {portfolio.map((item, index) => (
                    <DonutSegment 
                      key={item.name} 
                      percentage={item.percentage} 
                      offset={getSegmentOffset(index)} 
                      color={item.color} 
                      delay={index * 150} 
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
                        <p className="text-xl font-semibold text-aifm-charcoal">{hoveredInfo.percentage}%</p>
                        <p className="text-xs text-aifm-charcoal/50 mt-0.5">{hoveredInfo.name}</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xl font-semibold text-aifm-charcoal">{formatCurrencyCompact(totalPortfolioValue)}</p>
                        <p className="text-xs text-aifm-charcoal/50 mt-0.5">Totalt</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex-1 w-full space-y-2">
                {portfolio.map((item) => (
                  <div 
                    key={item.name} 
                    className={`flex items-center justify-between py-2.5 px-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      hoveredSegment === item.name ? 'bg-gray-50 shadow-sm' : 'hover:bg-gray-50/50'
                    }`}
                    onMouseEnter={() => setHoveredSegment(item.name)} 
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-2.5 h-2.5 rounded-full transition-transform duration-300"
                        style={{ 
                          backgroundColor: item.color,
                          transform: hoveredSegment === item.name ? 'scale(1.3)' : 'scale(1)',
                        }} 
                      />
                      <span className="text-sm font-medium text-aifm-charcoal">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-aifm-charcoal">{item.percentage}%</span>
                      <span className="text-xs text-aifm-charcoal/40 ml-2">{formatCurrencyCompact(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* KPI Over Time - Collapsed by default */}
        <CollapsibleSection 
          title="Nyckeltal över tid" 
          icon={BarChart3} 
          defaultOpen={false}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xl font-semibold text-aifm-charcoal tracking-tight">
                  {selectedKPI === 'NAV' && `${(metrics.nav / 1000000).toFixed(1)} MSEK`}
                  {selectedKPI === 'IRR' && `${metrics.irr.toFixed(1)}%`}
                  {selectedKPI === 'MOIC' && `${metrics.moic.toFixed(2)}x`}
                </p>
                <p className="text-xs text-aifm-charcoal/40 mt-0.5 uppercase tracking-wider">
                  {selectedKPI === 'NAV' && 'Nettotillgångsvärde'}
                  {selectedKPI === 'IRR' && 'Internränta (årlig)'}
                  {selectedKPI === 'MOIC' && 'Multiple on Invested Capital'}
                </p>
              </div>
              <KPITabs options={kpiOptions} value={selectedKPI} onChange={setSelectedKPI} />
            </div>
            
            {/* Chart */}
            <div className="h-48 flex items-end justify-between gap-4 lg:gap-6 px-4">
              {(() => {
                const currentKpiData = selectedKPI === 'NAV' ? kpiDataSet.nav 
                  : selectedKPI === 'IRR' ? kpiDataSet.irr 
                  : kpiDataSet.moic;
                const maxValue = Math.max(...currentKpiData.map(d => Math.max(d.value1, d.value2)));
                
                return currentKpiData.map((data, index) => {
                  const height1 = (data.value1 / maxValue) * 80;
                  const height2 = (data.value2 / maxValue) * 80;
                  return (
                    <div key={data.month} className="flex-1 flex flex-col items-center">
                      <div className="w-full h-36 flex items-end justify-center gap-1">
                        <AnimatedBar height={height1} color="#c0a280" delay={index * 100} value={data.value1} isActual={true} />
                        <AnimatedBar height={height2} color="#2d2a26" delay={index * 100 + 50} value={data.value2} isActual={false} />
                      </div>
                      <span className="text-[10px] text-aifm-charcoal/40 mt-2 uppercase tracking-wider font-medium">{data.month}</span>
                    </div>
                  );
                });
              })()}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-aifm-gold" />
                <span className="text-xs text-aifm-charcoal/50 font-medium">Faktiskt</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-aifm-charcoal/30" />
                <span className="text-xs text-aifm-charcoal/50 font-medium">Mål</span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Two Column: Tasks & Transactions */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Tasks - Collapsed by default */}
          <CollapsibleSection 
            title="Uppgifter" 
            icon={CheckCircle2} 
            defaultOpen={false}
            linkHref="/approvals"
            linkText="Alla"
          >
            <div className="p-4 space-y-2">
              {tasks.slice(0, 4).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </CollapsibleSection>

          {/* Recent Transactions - Collapsed by default */}
          <CollapsibleSection 
            title="Transaktioner" 
            icon={Wallet} 
            defaultOpen={false}
            linkHref="/treasury"
            linkText="Alla"
          >
            <div className="divide-y divide-gray-50">
              {transactions.slice(0, 4).map((tx) => (
                <div key={tx.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? 'bg-emerald-500' : 'bg-aifm-charcoal/30'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-aifm-charcoal truncate max-w-[140px]">{tx.description}</p>
                        <p className="text-xs text-aifm-charcoal/40">{getTransactionTypeLabel(tx.type)}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${
                      tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? 'text-emerald-600' : 'text-aifm-charcoal'
                    }`}>
                      {tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? '+' : '-'}
                      {formatCurrencyCompact(tx.amount, tx.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </DashboardLayout>
  );
}
