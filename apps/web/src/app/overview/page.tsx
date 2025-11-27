'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronRight, ArrowUpRight, ArrowDownRight, FolderOpen,
  TrendingUp, Wallet, PieChart, BarChart3, CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import {
  getCompanyDashboard, formatCurrencyCompact
} from '@/lib/companyData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Animated metric card with glow effect
function MetricCard({ 
  label, 
  value, 
  subValue, 
  trend,
  icon: Icon,
  delay = 0 
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className={`
      relative group bg-white rounded-2xl p-8 
      border border-gray-100/50 
      transition-all duration-700 ease-out
      hover:shadow-2xl hover:shadow-aifm-gold/10 hover:border-aifm-gold/20
      hover:-translate-y-1
      ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
    `}>
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div className="p-3 bg-aifm-charcoal/5 rounded-xl group-hover:bg-aifm-gold/10 transition-colors duration-300">
            <Icon className="w-5 h-5 text-aifm-charcoal/60 group-hover:text-aifm-gold transition-colors duration-300" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend === 'up' ? 'bg-emerald-50 text-emerald-600' :
              trend === 'down' ? 'bg-red-50 text-red-600' :
              'bg-gray-50 text-gray-600'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : null}
              {subValue}
            </div>
          )}
        </div>
        
        <p className="text-sm text-aifm-charcoal/50 uppercase tracking-wider font-medium mb-2">{label}</p>
        <p className="text-3xl font-semibold text-aifm-charcoal tracking-tight">{value}</p>
      </div>
    </div>
  );
}

// Animated Bar for charts
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
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-aifm-charcoal text-white 
                        text-xs font-medium rounded-lg whitespace-nowrap z-20 shadow-lg">
          {value.toFixed(2)}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-aifm-charcoal rotate-45" />
        </div>
      )}
      <div 
        className={`w-6 rounded-lg transition-all duration-700 ease-out ${isActual ? '' : 'opacity-40'}`}
        style={{ 
          height: `${animatedHeight}%`,
          backgroundColor: color,
          boxShadow: isHovered ? `0 0 20px ${color}50, 0 4px 12px ${color}30` : 'none'
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
      <div className="mb-12">
        <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Översikt</h1>
        <p className="text-aifm-charcoal/40 mt-2 text-sm">{selectedCompany.name}</p>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <MetricCard 
          label="Nettotillgångsvärde" 
          value={formatCurrencyCompact(metrics.nav)}
          icon={Wallet}
          delay={0}
        />
        <MetricCard 
          label="MOIC" 
          value={`${metrics.moic.toFixed(2)}x`}
          subValue="+12.3%"
          trend="up"
          icon={TrendingUp}
          delay={100}
        />
        <MetricCard 
          label="IRR" 
          value={`${metrics.irr.toFixed(1)}%`}
          subValue="Över mål"
          trend="up"
          icon={BarChart3}
          delay={200}
        />
        <MetricCard 
          label="Orealiserad vinst" 
          value={`+${formatCurrencyCompact(metrics.unrealizedGain)}`}
          icon={TrendingUp}
          delay={300}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Portfolio Chart Card */}
          <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
                  <PieChart className="w-4 h-4 text-aifm-charcoal/60" />
                </div>
                <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Portföljfördelning</h2>
              </div>
              <Link href="/portfolio" className="text-xs text-aifm-charcoal/40 hover:text-aifm-gold flex items-center gap-1 transition-colors">
                Detaljer <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                {/* Donut Chart */}
                <div className="relative w-64 h-64 lg:w-72 lg:h-72 flex-shrink-0">
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
                          <p className="text-4xl font-semibold text-aifm-charcoal">{hoveredInfo.percentage}%</p>
                          <p className="text-sm text-aifm-charcoal/50 mt-1">{hoveredInfo.name}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-4xl font-semibold text-aifm-charcoal">{formatCurrencyCompact(totalPortfolioValue)}</p>
                          <p className="text-sm text-aifm-charcoal/50 mt-1">Totalt värde</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex-1 w-full space-y-4">
                  {portfolio.map((item) => (
                    <div 
                      key={item.name} 
                      className={`flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer transition-all duration-300 ${
                        hoveredSegment === item.name 
                          ? 'bg-gray-50 shadow-sm' 
                          : 'hover:bg-gray-50/50'
                      }`}
                      onMouseEnter={() => setHoveredSegment(item.name)} 
                      onMouseLeave={() => setHoveredSegment(null)}
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-3 h-3 rounded-full transition-transform duration-300"
                          style={{ 
                            backgroundColor: item.color,
                            transform: hoveredSegment === item.name ? 'scale(1.3)' : 'scale(1)',
                            boxShadow: hoveredSegment === item.name ? `0 0 8px ${item.color}60` : 'none'
                          }} 
                        />
                        <span className="text-sm font-medium text-aifm-charcoal">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-aifm-charcoal">{item.percentage}%</span>
                        <span className="text-xs text-aifm-charcoal/40 ml-3">{formatCurrencyCompact(item.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* KPI Chart Card */}
          <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
            <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-aifm-charcoal/60" />
                </div>
                <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Nyckeltal över tid</h2>
              </div>
              <KPITabs options={kpiOptions} value={selectedKPI} onChange={setSelectedKPI} />
            </div>
            
            <div className="p-8 lg:p-12">
              {/* Current Value Display */}
              <div className="mb-10">
                <p className="text-5xl font-semibold text-aifm-charcoal tracking-tight">
                  {selectedKPI === 'NAV' && `${(metrics.nav / 1000000).toFixed(1)} MSEK`}
                  {selectedKPI === 'IRR' && `${metrics.irr.toFixed(1)}%`}
                  {selectedKPI === 'MOIC' && `${metrics.moic.toFixed(2)}x`}
                </p>
                <p className="text-sm text-aifm-charcoal/40 mt-2">
                  {selectedKPI === 'NAV' && 'Nettotillgångsvärde'}
                  {selectedKPI === 'IRR' && 'Internränta (årlig)'}
                  {selectedKPI === 'MOIC' && 'Multiple on Invested Capital'}
                </p>
              </div>
              
              {/* Chart */}
              <div className="h-80 flex items-end justify-between gap-6 lg:gap-10 px-4">
                {(() => {
                  const currentKpiData = selectedKPI === 'NAV' ? kpiDataSet.nav 
                    : selectedKPI === 'IRR' ? kpiDataSet.irr 
                    : kpiDataSet.moic;
                  const maxValue = Math.max(...currentKpiData.map(d => Math.max(d.value1, d.value2)));
                  
                  return currentKpiData.map((data, index) => {
                    const height1 = (data.value1 / maxValue) * 90;
                    const height2 = (data.value2 / maxValue) * 90;
                    return (
                      <div key={data.month} className="flex-1 flex flex-col items-center">
                        <div className="w-full h-64 flex items-end justify-center gap-2">
                          <AnimatedBar height={height1} color="#c0a280" delay={index * 100} value={data.value1} isActual={true} />
                          <AnimatedBar height={height2} color="#2d2a26" delay={index * 100 + 50} value={data.value2} isActual={false} />
                        </div>
                        <span className="text-xs text-aifm-charcoal/40 mt-4 uppercase tracking-wider font-medium">{data.month}</span>
                      </div>
                    );
                  });
                })()}
              </div>
              
              {/* Legend */}
              <div className="flex items-center justify-center gap-8 mt-8 pt-6 border-t border-gray-100">
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
          </div>
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-8">
          
          {/* Tasks Card */}
          <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-aifm-charcoal/60" />
                </div>
                <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Uppgifter</h2>
              </div>
              <Link href="/approvals" className="text-xs text-aifm-charcoal/40 hover:text-aifm-gold flex items-center gap-1 transition-colors">
                Alla <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="p-4 space-y-3">
              {tasks.slice(0, 4).map((task) => (
                <div 
                  key={task.id} 
                  className={`p-4 rounded-xl transition-all duration-300 ${
                    task.status === 'DONE' 
                      ? 'bg-gray-50/50' 
                      : 'bg-gray-50 hover:bg-gray-100/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      task.status === 'DONE' 
                        ? 'bg-emerald-500' 
                        : task.status === 'IN_PROGRESS'
                          ? 'bg-amber-500'
                          : 'bg-gray-200'
                    }`}>
                      {task.status === 'DONE' && <CheckCircle2 className="w-3 h-3 text-white" />}
                      {task.status === 'IN_PROGRESS' && <Clock className="w-3 h-3 text-white" />}
                      {task.status === 'TODO' && <AlertCircle className="w-3 h-3 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        task.status === 'DONE' ? 'text-aifm-charcoal/40 line-through' : 'text-aifm-charcoal'
                      }`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-aifm-charcoal/40 mt-1">
                        {task.dueDate.toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-aifm-charcoal/5 rounded-lg">
                  <Wallet className="w-4 h-4 text-aifm-charcoal/60" />
                </div>
                <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Transaktioner</h2>
              </div>
              <Link href="/treasury" className="text-xs text-aifm-charcoal/40 hover:text-aifm-gold flex items-center gap-1 transition-colors">
                Alla <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-50">
              {transactions.slice(0, 4).map((tx) => (
                <div key={tx.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' 
                          ? 'bg-emerald-500' 
                          : 'bg-aifm-charcoal/30'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-aifm-charcoal truncate max-w-[140px]">{tx.description}</p>
                        <p className="text-xs text-aifm-charcoal/40">{getTransactionTypeLabel(tx.type)}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${
                      tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' 
                        ? 'text-emerald-600' 
                        : 'text-aifm-charcoal'
                    }`}>
                      {tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? '+' : '-'}
                      {formatCurrencyCompact(tx.amount, tx.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 shadow-xl shadow-aifm-charcoal/20">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5">Snabbåtgärder</h3>
            <div className="space-y-2">
              {[
                { href: '/capital-calls', label: 'Nytt kapitalanrop', icon: ArrowUpRight }, 
                { href: '/distributions', label: 'Ny utdelning', icon: ArrowDownRight }, 
                { href: '/data-rooms', label: 'Öppna datarum', icon: FolderOpen }
              ].map((action) => (
                <Link 
                  key={action.href} 
                  href={action.href} 
                  className="flex items-center justify-between p-4 bg-white/5 rounded-xl text-white 
                             hover:bg-white/10 hover:translate-x-1 transition-all duration-300 group"
                >
                  <span className="text-sm font-medium">{action.label}</span>
                  <action.icon className="w-4 h-4 text-white/40 group-hover:text-aifm-gold transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
