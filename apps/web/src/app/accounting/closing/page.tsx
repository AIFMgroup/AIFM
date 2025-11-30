'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, FileText, Calculator,
  Lock, ChevronRight, Calendar, ArrowRight
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

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

export default function ClosingPage() {
  const [tasks, setTasks] = useState<ClosingTask[]>(closingTasks);
  const [selectedPeriod, setSelectedPeriod] = useState('nov');

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.filter(t => t.status !== 'locked').length;

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

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-aifm-charcoal/40 mb-2">
          <Link href="/accounting" className="hover:text-aifm-gold transition-colors">Bokföring</Link>
          <span>/</span>
          <span className="text-aifm-charcoal">Bokslut</span>
        </div>
        <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
          Bokslut
        </h1>
        <p className="text-aifm-charcoal/60">
          Förbered och stäng av bokföringsperioden
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                Framsteg för November 2024
              </h2>
              <span className="text-sm text-aifm-charcoal font-medium">{completedTasks}/{totalTasks} uppgifter</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-aifm-gold rounded-full transition-all duration-500"
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
          </div>

          {/* Tasks by Category */}
          {categories.map(category => (
            <div key={category} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-medium text-aifm-charcoal">{category}</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {tasks.filter(t => t.category === category).map(task => (
                  <button
                    key={task.id}
                    onClick={() => handleTaskClick(task.id)}
                    disabled={task.status === 'locked' || task.status === 'completed'}
                    className={`w-full px-6 py-4 flex items-center gap-4 text-left transition-colors
                      ${task.status === 'locked' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
                      ${task.status === 'completed' ? 'bg-green-50/30' : ''}
                    `}
                  >
                    {getStatusIcon(task.status)}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-green-700 line-through' : 'text-aifm-charcoal'}`}>
                        {task.title}
                      </p>
                      <p className="text-xs text-aifm-charcoal/50 mt-0.5">{task.description}</p>
                    </div>
                    {task.status !== 'locked' && task.status !== 'completed' && (
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Period Selector */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                Perioder 2024
              </h3>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {periods.map(period => (
                <button
                  key={period.id}
                  onClick={() => setSelectedPeriod(period.id)}
                  disabled={period.status === 'future'}
                  className={`w-full px-4 py-3 rounded-lg flex items-center justify-between transition-colors
                    ${selectedPeriod === period.id ? 'bg-aifm-gold/10' : 'hover:bg-gray-50'}
                    ${period.status === 'future' ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {period.status === 'closed' ? (
                      <Lock className="w-4 h-4 text-green-600" />
                    ) : period.status === 'open' ? (
                      <Clock className="w-4 h-4 text-aifm-gold" />
                    ) : (
                      <Calendar className="w-4 h-4 text-gray-300" />
                    )}
                    <span className={`text-sm ${selectedPeriod === period.id ? 'text-aifm-gold font-medium' : 'text-aifm-charcoal'}`}>
                      {period.month}
                    </span>
                  </div>
                  {period.status === 'closed' && (
                    <span className={`text-xs ${period.result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(period.result)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-aifm-charcoal rounded-xl p-6">
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
          <div className="bg-white rounded-xl border border-gray-100 p-6">
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
                <span className="text-sm font-medium text-green-600">1 185 000 SEK</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


