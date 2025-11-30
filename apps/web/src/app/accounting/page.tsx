'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Upload, FileText, Calculator, FileCheck, CreditCard, 
  CheckCircle2, Clock, AlertCircle, ArrowRight, TrendingUp,
  Calendar, ChevronRight, Sparkles, Zap, BarChart3
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

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
        <span className="text-3xl font-bold text-aifm-charcoal">{Math.round(animatedProgress)}%</span>
        <span className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Klart</span>
      </div>
    </div>
  );
}

// Metric Card
function MetricCard({ 
  label, 
  value, 
  icon: Icon,
  color = 'gold',
  trend
}: { 
  label: string; 
  value: string; 
  icon: React.ElementType;
  color?: 'gold' | 'green' | 'amber' | 'blue';
  trend?: { value: string; positive: boolean };
}) {
  const colors = {
    gold: 'bg-aifm-gold/10 text-aifm-gold',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
  };

  return (
    <div className="group bg-white rounded-2xl p-6 border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20 hover:-translate-y-0.5 transition-all duration-500">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className={`w-12 h-12 rounded-xl ${colors[color]} flex items-center justify-center mb-4`}>
            <Icon className="w-6 h-6" />
          </div>
          <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider font-medium mb-1">{label}</p>
          <p className="text-2xl font-semibold text-aifm-charcoal">{value}</p>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            <TrendingUp className={`w-3 h-3 ${!trend.positive && 'rotate-180'}`} />
            {trend.value}
          </div>
        )}
      </div>
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
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl ${styles.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
              {step.status === 'completed' ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              ) : (
                <Icon className={`w-7 h-7 ${styles.icon}`} />
              )}
            </div>
            <div>
              <span className="text-xs text-aifm-charcoal/40 font-medium uppercase tracking-wider">Steg {index + 1}</span>
              <h3 className="text-lg font-semibold text-aifm-charcoal mt-0.5 group-hover:text-aifm-gold transition-colors">
                {step.title}
              </h3>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${styles.badge}`}>
            {step.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {step.status === 'in_progress' && <Clock className="w-3.5 h-3.5" />}
            {step.status === 'pending' && <AlertCircle className="w-3.5 h-3.5" />}
            {styles.label}
          </span>
        </div>
        
        {/* Description */}
        <p className="text-sm text-aifm-charcoal/60 mb-4">{step.description}</p>

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
      <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100/50 flex items-center justify-between">
        <span className="text-xs text-aifm-charcoal/40">Klicka för att öppna</span>
        <ChevronRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}

export default function AccountingOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2024');

  const completedSteps = accountingSteps.filter(s => s.status === 'completed').length;
  const totalSteps = accountingSteps.length;
  const overallProgress = Math.round((completedSteps / totalSteps) * 100 + 
    accountingSteps.filter(s => s.status === 'in_progress' && s.progress).reduce((sum, s) => sum + (s.progress || 0) / totalSteps / 2, 0));

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-aifm-charcoal tracking-tight">Bokföring</h1>
          <p className="text-aifm-charcoal/40 mt-1 sm:mt-2 text-sm">Hantera hela bokföringskedjan från underlag till årsredovisning</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-aifm-charcoal
                       focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold transition-all"
          >
            <option value="2024">Räkenskapsår 2024</option>
            <option value="2023">Räkenskapsår 2023</option>
            <option value="2022">Räkenskapsår 2022</option>
          </select>
          <Link 
            href="/accounting/upload"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white 
                       bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                       shadow-lg shadow-aifm-charcoal/20 transition-all"
          >
            <Upload className="w-4 h-4" />
            Ladda upp
          </Link>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-8 mb-6 sm:mb-10">
        {/* Main Progress */}
        <div className="bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-8 text-white shadow-xl shadow-aifm-charcoal/20">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider">Årets framsteg</h2>
              <p className="text-white/70 text-sm mt-1">{selectedPeriod}</p>
            </div>
            <div className="p-2 bg-white/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white/60" />
            </div>
          </div>
          <div className="flex items-center gap-8">
            <ProgressRing progress={overallProgress} />
            <div className="space-y-3">
              <div>
                <span className="text-3xl font-bold">{completedSteps}</span>
                <span className="text-white/50 text-lg">/{totalSteps}</span>
                <p className="text-xs text-white/50 uppercase tracking-wider mt-1">Steg klara</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Zap className="w-4 h-4 text-aifm-gold" />
                AI-assisterad bokföring
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-6">
          <MetricCard 
            label="Transaktioner godkända" 
            value="185"
            icon={CheckCircle2}
            color="green"
            trend={{ value: '+12%', positive: true }}
          />
          <MetricCard 
            label="Väntar på granskning" 
            value="30"
            icon={Clock}
            color="amber"
          />
          <MetricCard 
            label="AI-klassificerade" 
            value="156"
            icon={Sparkles}
            color="gold"
            trend={{ value: '+23%', positive: true }}
          />
          <MetricCard 
            label="Nästa deadline" 
            value="31 dec"
            icon={Calendar}
            color="blue"
          />
        </div>
      </div>

      {/* Accounting Steps */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Bokföringskedjan</h2>
          <span className="text-xs text-aifm-charcoal/40">{completedSteps} av {totalSteps} steg klara</span>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {accountingSteps.map((step, index) => (
            <StepCard key={step.id} step={step} index={index} />
          ))}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Snabbåtgärder</h3>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: 'Ladda upp underlag', href: '/accounting/upload', icon: Upload },
              { label: 'Granska transaktioner', href: '/accounting/bookkeeping', icon: CheckCircle2 },
              { label: 'Hantera betalningar', href: '/accounting/payments', icon: CreditCard },
              { label: 'Visa rapporter', href: '/accounting/closing', icon: FileText },
            ].map((action) => (
              <Link 
                key={action.href}
                href={action.href}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-aifm-gold/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-aifm-charcoal/5 rounded-lg flex items-center justify-center group-hover:bg-aifm-gold/10 transition-colors">
                    <action.icon className="w-5 h-5 text-aifm-charcoal/50 group-hover:text-aifm-gold transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">{action.label}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-aifm-charcoal uppercase tracking-wider">Senaste aktivitet</h3>
            <Link href="/accounting/bookkeeping" className="text-xs text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1">
              Visa alla <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
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
      </div>
    </DashboardLayout>
  );
}
