'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Upload, FileText, Calculator, FileCheck, CreditCard, 
  CheckCircle2, Clock, AlertCircle, ArrowRight, TrendingUp,
  Calendar, ChevronRight, Sparkles, BarChart3, Eye,
  ChevronDown, Settings, Download, Filter
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

interface AccountingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  status: 'completed' | 'in_progress' | 'pending' | 'not_started';
  progress?: number;
  dueDate?: string;
  tasks?: { completed: number; total: number };
}

const accountingSteps: AccountingStep[] = [
  {
    id: 'upload',
    title: 'Ladda upp material',
    description: 'Ladda upp kvitton, fakturor och andra underlag',
    href: '/accounting/upload',
    icon: Upload,
    status: 'in_progress',
    progress: 75,
    tasks: { completed: 45, total: 60 },
  },
  {
    id: 'bookkeeping',
    title: 'Löpande bokföring',
    description: 'Granska och godkänn automatiskt klassificerade transaktioner',
    href: '/accounting/bookkeeping',
    icon: Calculator,
    status: 'in_progress',
    progress: 60,
    tasks: { completed: 128, total: 215 },
  },
  {
    id: 'closing',
    title: 'Bokslut',
    description: 'Förbered och stäng av perioden',
    href: '/accounting/closing',
    icon: FileText,
    status: 'pending',
    dueDate: '2024-12-31',
  },
  {
    id: 'annual',
    title: 'Årsredovisning',
    description: 'Generera och granska årsredovisningen',
    href: '/accounting/annual-report',
    icon: FileCheck,
    status: 'not_started',
    dueDate: '2025-06-30',
  },
  {
    id: 'payments',
    title: 'Betalningar',
    description: 'Hantera utgående betalningar och skatter',
    href: '/accounting/payments',
    icon: CreditCard,
    status: 'in_progress',
    tasks: { completed: 12, total: 15 },
  },
];

const recentActivity = [
  { id: '1', action: 'Faktura uppladdad', details: 'Leverantörsfaktura #2024-1847', time: '5 min sedan', type: 'upload', icon: Upload },
  { id: '2', action: 'Transaktion godkänd', details: 'Hyresbetalning december', time: '15 min sedan', type: 'approve', icon: CheckCircle2 },
  { id: '3', action: 'AI-klassificering', details: '12 transaktioner klassificerade', time: '1 timme sedan', type: 'ai', icon: Sparkles },
  { id: '4', action: 'Betalning genomförd', details: 'Skatteinbetalning Q4', time: '2 timmar sedan', type: 'payment', icon: CreditCard },
];

// Mock report data
const reports = [
  { id: '1', name: 'Balansräkning', period: 'Nov 2024', date: '2024-11-30', type: 'balance' },
  { id: '2', name: 'Resultaträkning', period: 'Nov 2024', date: '2024-11-30', type: 'income' },
  { id: '3', name: 'Huvudbok', period: 'Q4 2024', date: '2024-12-15', type: 'ledger' },
  { id: '4', name: 'Momsrapport', period: 'Q4 2024', date: '2024-12-31', type: 'tax' },
];

// Animated progress ring
function ProgressRing({ progress, size = 120 }: { progress: number; size?: number }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedProgress / 100) * circumference;

  useEffect(() => {
    setTimeout(() => setAnimatedProgress(progress), 100);
  }, [progress]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="text-gray-100"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-aifm-gold transition-all duration-1000 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl sm:text-3xl font-bold text-aifm-charcoal">{Math.round(animatedProgress)}%</span>
        <span className="text-[10px] sm:text-xs text-aifm-charcoal/50 uppercase tracking-wider">Klart</span>
      </div>
    </div>
  );
}

// Hero Metric
function HeroMetric({ label, value, trend, icon: Icon }: { label: string; value: string; trend?: { value: string; positive: boolean }; icon: React.ElementType }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 mx-auto rounded-xl bg-white/10 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-white/70" />
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wider mt-1">{label}</p>
      {trend && (
        <div className={`inline-flex items-center gap-1 mt-2 text-xs font-medium px-2 py-0.5 rounded-full ${
          trend.positive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
        }`}>
          <TrendingUp className={`w-3 h-3 ${!trend.positive && 'rotate-180'}`} />
          {trend.value}
        </div>
      )}
    </div>
  );
}

// Step Card
function StepCard({ step, index }: { step: AccountingStep; index: number }) {
  const Icon = step.icon;
  
  const getStatusStyles = (status: AccountingStep['status']) => {
    switch (status) {
      case 'completed': return { bg: 'bg-emerald-100', icon: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', label: 'Klart' };
      case 'in_progress': return { bg: 'bg-aifm-gold/20', icon: 'text-aifm-gold', badge: 'bg-aifm-gold/10 text-aifm-gold', label: 'Pågår' };
      case 'pending': return { bg: 'bg-amber-100', icon: 'text-amber-600', badge: 'bg-amber-50 text-amber-600', label: 'Väntar' };
      case 'not_started': return { bg: 'bg-gray-100', icon: 'text-gray-400', badge: 'bg-gray-100 text-gray-500', label: 'Ej påbörjad' };
    }
  };

  const styles = getStatusStyles(step.status);

  return (
    <Link 
      href={step.href}
      className="group relative bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20 hover:-translate-y-1 transition-all duration-500"
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        step.status === 'completed' ? 'bg-emerald-500' :
        step.status === 'in_progress' ? 'bg-aifm-gold' :
        step.status === 'pending' ? 'bg-amber-400' :
        'bg-gray-200'
      }`} />
      
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${styles.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
              {step.status === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
              ) : (
                <Icon className={`w-6 h-6 sm:w-7 sm:h-7 ${styles.icon}`} />
              )}
            </div>
            <div>
              <span className="text-[10px] sm:text-xs text-aifm-charcoal/40 font-medium uppercase tracking-wider">Steg {index + 1}</span>
              <h3 className="text-base sm:text-lg font-semibold text-aifm-charcoal mt-0.5 group-hover:text-aifm-gold transition-colors">
                {step.title}
              </h3>
            </div>
          </div>
          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${styles.badge}`}>
            {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {step.status === 'in_progress' && <Clock className="w-3.5 h-3.5" />}
            {step.status === 'pending' && <AlertCircle className="w-3.5 h-3.5" />}
            {styles.label}
          </span>
        </div>
        
        {/* Description */}
        <p className="text-xs sm:text-sm text-aifm-charcoal/60 mb-4">{step.description}</p>

        {/* Progress or Due Date */}
        {step.progress !== undefined && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-aifm-charcoal/50">Framsteg</span>
              <span className="font-semibold text-aifm-charcoal">{step.progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-aifm-gold rounded-full transition-all duration-700 relative"
                style={{ width: `${step.progress}%` }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" />
              </div>
            </div>
          </div>
        )}
        
        {step.tasks && (
          <p className="text-xs text-aifm-charcoal/50 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {step.tasks.completed} av {step.tasks.total} uppgifter klara
          </p>
        )}
        
        {step.dueDate && (
          <p className="text-xs text-aifm-charcoal/50 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Deadline: <span className="font-medium text-aifm-charcoal">{step.dueDate}</span>
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 sm:px-6 py-3 sm:py-4 bg-gray-50/50 border-t border-gray-100/50 flex items-center justify-between">
        <span className="text-[10px] sm:text-xs text-aifm-charcoal/40">Klicka för att öppna</span>
        <ChevronRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}

// Tab Button Component
function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap ${
        active 
          ? 'text-aifm-charcoal' 
          : 'text-aifm-charcoal/50 hover:text-aifm-charcoal/70'
      }`}
    >
      <span className="flex items-center gap-2">
        {children}
        {count !== undefined && (
          <span className={`px-1.5 py-0.5 rounded-full text-xs ${
            active ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-100 text-gray-500'
          }`}>
            {count}
          </span>
        )}
      </span>
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aifm-gold rounded-full" />
      )}
    </button>
  );
}

export default function AccountingOverviewPage() {
  const { selectedCompany } = useCompany();
  const [selectedPeriod, setSelectedPeriod] = useState('2024');
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'reports' | 'settings'>('overview');
  const [showDetails, setShowDetails] = useState(true);

  const completedSteps = accountingSteps.filter(s => s.status === 'completed').length;
  const totalSteps = accountingSteps.length;
  const overallProgress = Math.round((completedSteps / totalSteps) * 100 + 
    accountingSteps.filter(s => s.status === 'in_progress' && s.progress).reduce((sum, s) => sum + (s.progress || 0) / totalSteps / 2, 0));

  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <p className="text-xs sm:text-sm text-white/50 uppercase tracking-wider mb-1">Bokföring</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {selectedCompany?.shortName || 'Fond'}
              </h1>
              <p className="text-white/60 mt-1 text-sm">Räkenskapsår {selectedPeriod}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white
                           focus:outline-none focus:ring-2 focus:ring-aifm-gold/50 transition-all"
              >
                <option value="2024" className="text-aifm-charcoal">Räkenskapsår 2024</option>
                <option value="2023" className="text-aifm-charcoal">Räkenskapsår 2023</option>
                <option value="2022" className="text-aifm-charcoal">Räkenskapsår 2022</option>
              </select>
              <Link 
                href="/accounting/upload"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aifm-charcoal 
                           bg-aifm-gold rounded-xl hover:bg-aifm-gold/90 
                           shadow-lg shadow-aifm-gold/30 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Ladda upp</span>
              </Link>
            </div>
          </div>

          {/* Hero Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <ProgressRing progress={overallProgress} size={80} />
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white">{completedSteps}/{totalSteps}</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Steg klara</p>
              </div>
            </div>
            <HeroMetric 
              label="Godkända" 
              value="185" 
              icon={CheckCircle2}
              trend={{ value: '+12%', positive: true }}
            />
            <HeroMetric 
              label="Väntar" 
              value="30" 
              icon={Clock}
            />
            <HeroMetric 
              label="AI-klassificerade" 
              value="156" 
              icon={Sparkles}
              trend={{ value: '+23%', positive: true }}
            />
          </div>
        </div>

        {/* Collapse Toggle */}
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"
        >
          <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100/50 mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-100 min-w-max">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            <BarChart3 className="w-4 h-4" />
            Översikt
          </TabButton>
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} count={recentActivity.length}>
            <Clock className="w-4 h-4" />
            Aktivitet
          </TabButton>
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} count={reports.length}>
            <FileText className="w-4 h-4" />
            Rapporter
          </TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
            <Settings className="w-4 h-4" />
            Inställningar
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && showDetails && (
        <div className="space-y-6 sm:space-y-8">
          {/* Accounting Steps */}
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Bokföringskedjan</h2>
              <span className="text-xs text-aifm-charcoal/40">{completedSteps} av {totalSteps} steg klara</span>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {accountingSteps.map((step, index) => (
                <StepCard key={step.id} step={step} index={index} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Snabbåtgärder</h3>
              </div>
              <div className="p-3 sm:p-4 space-y-2">
                {[
                  { label: 'Ladda upp underlag', href: '/accounting/upload', icon: Upload },
                  { label: 'Granska transaktioner', href: '/accounting/bookkeeping', icon: CheckCircle2 },
                  { label: 'Hantera betalningar', href: '/accounting/payments', icon: CreditCard },
                  { label: 'Visa rapporter', href: '/accounting/closing', icon: FileText },
                ].map((action) => (
                  <Link 
                    key={action.href}
                    href={action.href}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-xl hover:bg-aifm-gold/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-aifm-charcoal/5 rounded-lg flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
                        <action.icon className="w-4 h-4 sm:w-5 sm:h-5 text-aifm-charcoal/50 group-hover:text-aifm-gold transition-colors" />
                      </div>
                      <span className="text-sm font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">{action.label}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            </div>

            {/* AI Info */}
            <div className="lg:col-span-2 bg-gradient-to-br from-aifm-gold/10 to-aifm-gold/5 rounded-2xl border border-aifm-gold/20 p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-aifm-gold/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-aifm-gold" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-aifm-charcoal mb-2">AI-driven bokföring</h3>
                  <p className="text-sm text-aifm-charcoal/70 mb-4">
                    Vår AI analyserar och klassificerar dina dokument automatiskt enligt BAS-kontoplanen. 
                    Transaktioner med hög säkerhet (90%+) kan godkännas automatiskt.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-aifm-charcoal/70">90%+ = Hög säkerhet</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-aifm-charcoal/70">70-90% = Medel</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-aifm-charcoal/70">&lt;70% = Granska</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Senaste aktivitet</h3>
            <button className="text-xs text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1">
              Visa alla <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activity.type === 'upload' ? 'bg-blue-50' :
                  activity.type === 'approve' ? 'bg-emerald-50' :
                  activity.type === 'ai' ? 'bg-aifm-gold/10' :
                  'bg-purple-50'
                }`}>
                  <activity.icon className={`w-5 h-5 ${
                    activity.type === 'upload' ? 'text-blue-500' :
                    activity.type === 'approve' ? 'text-emerald-500' :
                    activity.type === 'ai' ? 'text-aifm-gold' :
                    'text-purple-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aifm-charcoal">{activity.action}</p>
                  <p className="text-xs text-aifm-charcoal/50 truncate">{activity.details}</p>
                </div>
                <span className="text-xs text-aifm-charcoal/40 flex-shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Tillgängliga rapporter</h3>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs font-medium text-aifm-charcoal/60 hover:text-aifm-charcoal bg-gray-100 rounded-lg flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                Filter
              </button>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-aifm-charcoal rounded-lg flex items-center gap-1.5 hover:bg-aifm-charcoal/90">
                <Download className="w-3.5 h-3.5" />
                Exportera alla
              </button>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {reports.map((report) => (
              <div key={report.id} className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-aifm-gold/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-aifm-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-aifm-charcoal">{report.name}</p>
                  <p className="text-xs text-aifm-charcoal/50">{report.period} • Skapad {report.date}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-4">Kontoplan</h3>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Anpassa BAS-kontoplanen för ditt bolag. Du kan lägga till egna konton och ändra beskrivningar.
            </p>
            <button className="px-4 py-2 text-sm font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Hantera kontoplan
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-4">Automatisering</h3>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Konfigurera regler för automatisk godkännande av transaktioner med hög AI-säkerhet.
            </p>
            <button className="px-4 py-2 text-sm font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Konfigurera regler
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-4">Export</h3>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Exportera bokföringsdata till SIE, Fortnox eller Visma-format.
            </p>
            <button className="px-4 py-2 text-sm font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Exportinställningar
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100/50 p-6">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider mb-4">Integrationer</h3>
            <p className="text-sm text-aifm-charcoal/60 mb-4">
              Anslut till banker och andra system för automatisk import av transaktioner.
            </p>
            <button className="px-4 py-2 text-sm font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Hantera integrationer
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
