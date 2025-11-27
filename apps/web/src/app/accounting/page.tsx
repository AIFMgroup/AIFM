'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Upload, FileText, Calculator, FileCheck, CreditCard, 
  CheckCircle2, Clock, AlertCircle, ArrowRight, TrendingUp,
  Calendar, ChevronRight
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
  { id: '1', action: 'Faktura uppladdad', details: 'Leverantörsfaktura #2024-1847', time: '5 min sedan', type: 'upload' },
  { id: '2', action: 'Transaktion godkänd', details: 'Hyresbetalning december', time: '15 min sedan', type: 'approve' },
  { id: '3', action: 'AI-klassificering', details: '12 transaktioner klassificerade automatiskt', time: '1 timme sedan', type: 'ai' },
  { id: '4', action: 'Betalning genomförd', details: 'Skatteinbetalning Q4', time: '2 timmar sedan', type: 'payment' },
  { id: '5', action: 'Dokument skannat', details: 'Kvitto från SJ AB', time: '3 timmar sedan', type: 'scan' },
];

function getStatusColor(status: AccountingStep['status']) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'in_progress': return 'bg-aifm-gold/20 text-aifm-gold';
    case 'pending': return 'bg-amber-100 text-amber-700';
    case 'not_started': return 'bg-gray-100 text-gray-500';
  }
}

function getStatusLabel(status: AccountingStep['status']) {
  switch (status) {
    case 'completed': return 'Klart';
    case 'in_progress': return 'Pågår';
    case 'pending': return 'Väntar';
    case 'not_started': return 'Ej påbörjad';
  }
}

function getStatusIcon(status: AccountingStep['status']) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-4 h-4" />;
    case 'in_progress': return <Clock className="w-4 h-4" />;
    case 'pending': return <AlertCircle className="w-4 h-4" />;
    case 'not_started': return <Clock className="w-4 h-4" />;
  }
}

export default function AccountingOverviewPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2024');

  const completedSteps = accountingSteps.filter(s => s.status === 'completed').length;
  const totalSteps = accountingSteps.length;

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider mb-2">
              Bokföring
            </h1>
            <p className="text-aifm-charcoal/60">
              Hantera hela bokföringskedjan från underlag till årsredovisning
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-aifm-charcoal
                         focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
            >
              <option value="2024">Räkenskapsår 2024</option>
              <option value="2023">Räkenskapsår 2023</option>
              <option value="2022">Räkenskapsår 2022</option>
            </select>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-aifm-gold/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">{completedSteps}/{totalSteps}</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Steg klara</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-aifm-gold rounded-full transition-all duration-500"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">185</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Transaktioner godkända</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">30</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Väntar på granskning</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-medium text-aifm-charcoal">31 dec</p>
              <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Nästa deadline</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Steps */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                Bokföringskedjan
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {accountingSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Link 
                    key={step.id}
                    href={step.href}
                    className="block px-6 py-5 hover:bg-gray-50/50 transition-colors group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Step Number & Icon */}
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                          ${step.status === 'completed' ? 'bg-green-100' : 
                            step.status === 'in_progress' ? 'bg-aifm-gold/20' : 
                            'bg-gray-100'}`}
                        >
                          {step.status === 'completed' ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                          ) : (
                            <Icon className={`w-6 h-6 ${step.status === 'in_progress' ? 'text-aifm-gold' : 'text-gray-400'}`} />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-aifm-charcoal/40 font-medium">STEG {index + 1}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(step.status)}`}>
                                {getStatusIcon(step.status)}
                                {getStatusLabel(step.status)}
                              </span>
                            </div>
                            <h3 className="text-lg font-medium text-aifm-charcoal mt-1 group-hover:text-aifm-gold transition-colors">
                              {step.title}
                            </h3>
                            <p className="text-sm text-aifm-charcoal/60 mt-1">
                              {step.description}
                            </p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-aifm-gold transition-colors flex-shrink-0 mt-2" />
                        </div>

                        {/* Progress or Due Date */}
                        {step.progress !== undefined && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-aifm-charcoal/50">Framsteg</span>
                              <span className="text-aifm-charcoal font-medium">{step.progress}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-aifm-gold rounded-full transition-all duration-500"
                                style={{ width: `${step.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {step.tasks && (
                          <p className="text-xs text-aifm-charcoal/50 mt-2">
                            {step.tasks.completed} av {step.tasks.total} uppgifter klara
                          </p>
                        )}
                        {step.dueDate && (
                          <p className="text-xs text-aifm-charcoal/50 mt-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Deadline: {step.dueDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-aifm-charcoal rounded-2xl p-6">
            <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
              Snabbåtgärder
            </h3>
            <div className="space-y-2">
              <Link 
                href="/accounting/upload"
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-sm">Ladda upp underlag</span>
                <Upload className="w-4 h-4 text-white/50" />
              </Link>
              <Link 
                href="/accounting/bookkeeping"
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-sm">Granska transaktioner</span>
                <ArrowRight className="w-4 h-4 text-white/50" />
              </Link>
              <Link 
                href="/accounting/payments"
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-sm">Hantera betalningar</span>
                <CreditCard className="w-4 h-4 text-white/50" />
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                Senaste aktivitet
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="px-6 py-3">
                  <p className="text-sm text-aifm-charcoal font-medium">{activity.action}</p>
                  <p className="text-xs text-aifm-charcoal/50 mt-0.5">{activity.details}</p>
                  <p className="text-xs text-aifm-charcoal/30 mt-1">{activity.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

