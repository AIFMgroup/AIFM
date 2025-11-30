'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, FileText, Calculator,
  Lock, ChevronRight, Calendar, ArrowRight, BarChart3,
  TrendingUp, Download, Eye
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

interface ClosingTask {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'locked';
  category: string;
}

const closingTasks: ClosingTask[] = [
  { id: '1', title: 'Stäm av bankkonton', description: 'Verifiera att banksaldo stämmer med bokföringen', status: 'completed', category: 'Avstämningar' },
  { id: '2', title: 'Stäm av kundfordringar', description: 'Kontrollera utestående kundfordringar', status: 'completed', category: 'Avstämningar' },
  { id: '3', title: 'Stäm av leverantörsskulder', description: 'Verifiera obetalda leverantörsfakturor', status: 'in_progress', category: 'Avstämningar' },
  { id: '4', title: 'Periodisera intäkter', description: 'Fördela intäkter över rätt perioder', status: 'pending', category: 'Periodiseringar' },
  { id: '5', title: 'Periodisera kostnader', description: 'Fördela kostnader över rätt perioder', status: 'pending', category: 'Periodiseringar' },
  { id: '6', title: 'Beräkna avskrivningar', description: 'Beräkna avskrivningar på anläggningstillgångar', status: 'pending', category: 'Avskrivningar' },
  { id: '7', title: 'Bokför avskrivningar', description: 'Bokför periodens avskrivningar', status: 'locked', category: 'Avskrivningar' },
  { id: '8', title: 'Skatteavsättning', description: 'Beräkna och bokför skatteavsättning', status: 'locked', category: 'Skatt' },
  { id: '9', title: 'Generera balansrapport', description: 'Skapa balansrapport för perioden', status: 'locked', category: 'Rapporter' },
  { id: '10', title: 'Generera resultatrapport', description: 'Skapa resultatrapport för perioden', status: 'locked', category: 'Rapporter' },
  { id: '11', title: 'Lås perioden', description: 'Lås bokföringsperioden för ändringar', status: 'locked', category: 'Avslut' },
];

const periods = [
  { id: 'jan', month: 'Januari', status: 'closed', result: 125000 },
  { id: 'feb', month: 'Februari', status: 'closed', result: 98000 },
  { id: 'mar', month: 'Mars', status: 'closed', result: 145000 },
  { id: 'apr', month: 'April', status: 'closed', result: 112000 },
  { id: 'may', month: 'Maj', status: 'closed', result: 89000 },
  { id: 'jun', month: 'Juni', status: 'closed', result: 134000 },
  { id: 'jul', month: 'Juli', status: 'closed', result: 76000 },
  { id: 'aug', month: 'Augusti', status: 'closed', result: 108000 },
  { id: 'sep', month: 'September', status: 'closed', result: 156000 },
  { id: 'oct', month: 'Oktober', status: 'closed', result: 142000 },
  { id: 'nov', month: 'November', status: 'open', result: 0 },
  { id: 'dec', month: 'December', status: 'future', result: 0 },
];

function getStatusIcon(status: ClosingTask['status']) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    case 'in_progress': return <Clock className="w-5 h-5 text-aifm-gold" />;
    case 'pending': return <AlertCircle className="w-5 h-5 text-amber-500" />;
    case 'locked': return <Lock className="w-5 h-5 text-gray-300" />;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
  }).format(amount);
}

// Tab Button Component
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap ${
        active 
          ? 'text-aifm-charcoal' 
          : 'text-aifm-charcoal/50 hover:text-aifm-charcoal/70'
      }`}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aifm-gold rounded-full" />
      )}
    </button>
  );
}

// Animated progress ring
function ProgressRing({ progress, size = 100 }: { progress: number; size?: number }) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const strokeWidth = 6;
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
          className="text-white/10"
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
        <span className="text-2xl font-bold text-white">{Math.round(animatedProgress)}%</span>
      </div>
    </div>
  );
}

export default function ClosingPage() {
  useCompany(); // Context for layout
  const [tasks, setTasks] = useState<ClosingTask[]>(closingTasks);
  const [selectedPeriod, setSelectedPeriod] = useState('nov');
  const [activeTab, setActiveTab] = useState<'checklist' | 'periods' | 'reports'>('checklist');

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.filter(t => t.status !== 'locked').length;
  const progress = Math.round((completedTasks / totalTasks) * 100);

  const handleTaskClick = (taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId && task.status === 'pending') {
        return { ...task, status: 'in_progress' as const };
      }
      if (task.id === taskId && task.status === 'in_progress') {
        return { ...task, status: 'completed' as const };
      }
      return task;
    }));
  };

  const categories = [...new Set(tasks.map(t => t.category))];

  const ytdResult = periods.filter(p => p.status === 'closed').reduce((sum, p) => sum + p.result, 0);

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
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-white/40 mb-4">
            <Link href="/accounting" className="hover:text-white/60 transition-colors">Bokföring</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70">Bokslut</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Bokslut
              </h1>
              <p className="text-white/60 text-sm">
                Stäng av och verifiera bokföringsperioden
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white
                           focus:outline-none focus:ring-2 focus:ring-aifm-gold/50 transition-all"
              >
                {periods.filter(p => p.status !== 'future').map(p => (
                  <option key={p.id} value={p.id} className="text-aifm-charcoal">
                    {p.month} 2024
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hero Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div className="flex items-center gap-4">
              <ProgressRing progress={progress} size={80} />
              <div>
                <p className="text-xl sm:text-2xl font-bold text-white">{completedTasks}/{totalTasks}</p>
                <p className="text-xs text-white/50 uppercase tracking-wider">Uppgifter klara</p>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold text-emerald-400">{formatCurrency(ytdResult)}</p>
              <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Årets resultat</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold text-white">10</p>
              <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Stängda perioder</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl sm:text-3xl font-bold text-amber-400">31 dec</p>
              <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Nästa deadline</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100/50 mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-100 min-w-max">
          <TabButton active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')}>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Checklista
            </span>
          </TabButton>
          <TabButton active={activeTab === 'periods'} onClick={() => setActiveTab('periods')}>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Perioder
            </span>
          </TabButton>
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')}>
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Rapporter
            </span>
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'checklist' && (
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Main Content - Tasks by Category */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {categories.map(category => (
              <div key={category} className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-sm font-medium text-aifm-charcoal">{category}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {tasks.filter(t => t.category === category).map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      disabled={task.status === 'locked' || task.status === 'completed'}
                      className={`w-full px-5 sm:px-6 py-4 flex items-center gap-4 text-left transition-colors
                        ${task.status === 'locked' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
                        ${task.status === 'completed' ? 'bg-green-50/30' : ''}
                      `}
                    >
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-green-700 line-through' : 'text-aifm-charcoal'}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-aifm-charcoal/50 mt-0.5 truncate">{task.description}</p>
                      </div>
                      {task.status !== 'locked' && task.status !== 'completed' && (
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-aifm-charcoal rounded-xl sm:rounded-2xl p-5 sm:p-6">
              <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                Snabbåtgärder
              </h3>
              <div className="space-y-2">
                <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors">
                  <span className="text-sm">Generera rapporter</span>
                  <FileText className="w-4 h-4 text-white/50" />
                </button>
                <button className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors">
                  <span className="text-sm">Beräkna avskrivningar</span>
                  <Calculator className="w-4 h-4 text-white/50" />
                </button>
                <Link 
                  href="/accounting/annual-report"
                  className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm">Gå till årsredovisning</span>
                  <ArrowRight className="w-4 h-4 text-white/50" />
                </Link>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-5 sm:p-6">
              <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-4">
                Årets resultat hittills
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-aifm-charcoal/70">Intäkter</span>
                  <span className="text-sm font-medium text-aifm-charcoal">2 450 000 SEK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-aifm-charcoal/70">Kostnader</span>
                  <span className="text-sm font-medium text-aifm-charcoal">-1 265 000 SEK</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="text-sm font-medium text-aifm-charcoal">Resultat</span>
                  <span className="text-sm font-medium text-green-600">{formatCurrency(ytdResult)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'periods' && (
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
              Perioder 2024
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {periods.map(period => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                disabled={period.status === 'future'}
                className={`w-full px-5 sm:px-6 py-4 flex items-center justify-between transition-colors
                  ${selectedPeriod === period.id ? 'bg-aifm-gold/5' : 'hover:bg-gray-50'}
                  ${period.status === 'future' ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                  {period.status === 'closed' ? (
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-green-600" />
                    </div>
                  ) : period.status === 'open' ? (
                    <div className="w-10 h-10 rounded-xl bg-aifm-gold/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-aifm-gold" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="text-left">
                    <span className={`text-sm font-medium ${selectedPeriod === period.id ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>
                      {period.month}
                    </span>
                    <p className="text-xs text-aifm-charcoal/50 mt-0.5">
                      {period.status === 'closed' ? 'Stängd' : period.status === 'open' ? 'Öppen' : 'Kommande'}
                    </p>
                  </div>
                </div>
                {period.status === 'closed' && (
                  <span className={`text-sm font-medium ${period.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(period.result)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[
            { title: 'Balansräkning', desc: 'Tillgångar, skulder och eget kapital', icon: BarChart3 },
            { title: 'Resultaträkning', desc: 'Intäkter, kostnader och resultat', icon: TrendingUp },
            { title: 'Huvudbok', desc: 'Alla transaktioner per konto', icon: FileText },
            { title: 'Kontospecifikation', desc: 'Detaljerad specifikation per konto', icon: FileText },
            { title: 'Momsrapport', desc: 'Momssummering för perioden', icon: Calculator },
            { title: 'SIE-export', desc: 'Export i SIE-format', icon: Download },
          ].map((report, index) => (
            <div key={index} className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-5 sm:p-6 hover:shadow-lg hover:shadow-gray-200/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-aifm-gold/10 flex items-center justify-center mb-4 group-hover:bg-aifm-gold/20 transition-colors">
                <report.icon className="w-6 h-6 text-aifm-gold" />
              </div>
              <h3 className="font-medium text-aifm-charcoal mb-1">{report.title}</h3>
              <p className="text-sm text-aifm-charcoal/50 mb-4">{report.desc}</p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-xs font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  Visa
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  Ladda ner
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
