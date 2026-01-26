'use client';


import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, FileText, Calculator,
  Lock, ChevronRight, Calendar, ArrowRight, BarChart3,
  TrendingUp, Download, Eye, RefreshCw, Play, Sparkles,
  X, CheckCheck, DollarSign, Building2
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';
import {
  PageHeader, Card, Button, Badge, Tabs, Select, Modal, StatCard
} from '@/components/ui/design-system';

interface ClosingTask {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'locked' | 'error';
  category: string;
  automatable?: boolean;
  result?: {
    amount?: number;
    voucherNumber?: string;
    details?: string;
  };
}

interface PeriodData {
  id: string;
  year: number;
  month: number;
  status: 'open' | 'closing' | 'closed';
  income: number;
  expenses: number;
  result: number;
  closedAt?: string;
  closedBy?: string;
}

interface ClosingResult {
  success: boolean;
  tasks: ClosingTask[];
  periodData: PeriodData;
  vouchers: Array<{
    date: string;
    description: string;
    rows: Array<{
      account: string;
      debit?: number;
      credit?: number;
      description?: string;
    }>;
  }>;
  reports?: {
    balanceSheet?: {
      assets: { totalAssets: number };
      equityAndLiabilities: { totalEquityAndLiabilities: number };
    };
    incomeStatement?: {
      operatingResult: number;
      resultBeforeTax: number;
      netResult: number;
    };
  };
  error?: string;
}

function getStatusIcon(status: ClosingTask['status']) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
    case 'in_progress': return <Clock className="w-5 h-5 text-[#c0a280]" />;
    case 'pending': return <AlertCircle className="w-5 h-5 text-amber-500" />;
    case 'locked': return <Lock className="w-5 h-5 text-gray-300" />;
    case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
  }).format(amount);
}

const monthNames = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
];

// Animated progress ring
function ProgressRing({ progress, size = 80 }: { progress: number; size?: number }) {
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
          className="text-gray-200"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-[#c0a280] transition-all duration-1000 ease-out"
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
        <span className="text-xl font-semibold text-gray-900">{Math.round(animatedProgress)}%</span>
      </div>
    </div>
  );
}

export default function ClosingPage() {
  const { selectedCompany: company } = useCompany();
  const [tasks, setTasks] = useState<ClosingTask[]>([]);
  const [periods, setPeriods] = useState<PeriodData[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<PeriodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [activeTab, setActiveTab] = useState('checklist');
  const [closingResult, setClosingResult] = useState<ClosingResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const fetchClosingData = useCallback(async (showRefreshIndicator = false) => {
    if (!company?.id) return;

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `/api/accounting/closing?companyId=${company.id}&year=${selectedYear}&month=${selectedMonth}`
      );
      const data = await response.json();

      if (data.success) {
        setTasks(data.tasks);
        setPeriods(data.periods);
        setCurrentPeriod(data.periodData);
      }
    } catch (error) {
      console.error('Error fetching closing data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchClosingData();
  }, [fetchClosingData]);

  const handleTaskClick = async (taskId: string) => {
    if (!company?.id) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === 'locked' || task.status === 'completed') return;

    const newStatus = task.status === 'pending' ? 'in_progress' : 'completed';
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: newStatus as ClosingTask['status'] } : t
    ));

    try {
      await fetch('/api/accounting/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          year: selectedYear,
          month: selectedMonth,
          action: 'update-task',
          taskId,
          status: newStatus,
        }),
      });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleRunAutomaticClosing = async () => {
    if (!company?.id) return;

    setRunningAutomation(true);

    try {
      const response = await fetch('/api/accounting/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          year: selectedYear,
          month: selectedMonth,
          action: 'run-closing',
        }),
      });

      const result: ClosingResult = await response.json();
      setClosingResult(result);

      if (result.success) {
        setTasks(result.tasks);
        setCurrentPeriod(result.periodData);
        setShowResultModal(true);
        fetchClosingData(false);
      }
    } catch (error) {
      console.error('Error running automatic closing:', error);
    } finally {
      setRunningAutomation(false);
    }
  };

  const handleDownloadReport = async (reportType: string) => {
    if (!company?.id) return;

    setDownloadingReport(reportType);

    try {
      const response = await fetch('/api/accounting/closing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: company.id,
          year: selectedYear,
          month: selectedMonth,
          action: reportType === 'sie' ? 'generate-sie' : `generate-${reportType}`,
          companyName: company.name,
        }),
      });

      if (reportType === 'sie') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${selectedYear}_${selectedMonth}.se`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_${selectedYear}_${selectedMonth}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
    } finally {
      setDownloadingReport(null);
    }
  };

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.filter(t => t.status !== 'locked').length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const categories = [...new Set(tasks.map(t => t.category))];

  const ytdResult = periods.filter(p => p.status === 'closed').reduce((sum, p) => sum + p.result, 0);
  const totalIncome = periods.reduce((sum, p) => sum + p.income, 0);
  const totalExpenses = periods.reduce((sum, p) => sum + p.expenses, 0);
  const closedPeriods = periods.filter(p => p.status === 'closed').length;

  // Period options for select
  const periodOptions = Array.from({ length: 12 }, (_, i) => ({
    value: `${selectedYear}-${i + 1}`,
    label: `${monthNames[i]} ${selectedYear}`,
  }));

  const tabs = [
    { key: 'checklist', label: 'Checklista', icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: 'periods', label: 'Perioder', icon: <Calendar className="w-4 h-4" /> },
    { key: 'reports', label: 'Rapporter', icon: <FileText className="w-4 h-4" /> },
  ];

  if (!company) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Välj ett bolag för att se bokslut.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-6 w-full space-y-6">
        <PageHeader
          title="Bokslut"
          description={company.name}
          icon={<Calculator className="w-5 h-5" />}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
                onClick={() => fetchClosingData(true)}
                disabled={refreshing}
              />
              <Select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(val) => {
                  const [year, month] = val.split('-');
                  setSelectedYear(parseInt(year));
                  setSelectedMonth(parseInt(month));
                }}
                options={periodOptions}
                size="md"
              />
            </div>
          }
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#c0a280]">
            <div className="p-5 flex items-center gap-4">
              {loading ? (
                <div className="w-16 h-16 border-2 border-gray-200 border-t-[#c0a280] rounded-full animate-spin" />
              ) : (
                <ProgressRing progress={progress} size={64} />
              )}
              <div>
                <div className="text-lg font-semibold text-gray-900">
                  {loading ? '-' : `${completedTasks}/${totalTasks}`}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Uppgifter klara</div>
              </div>
            </div>
          </Card>

          <StatCard
            label="Periodens resultat"
            value={loading ? '—' : formatCurrency(currentPeriod?.result || 0)}
            icon={<TrendingUp className="w-4 h-4" />}
            accentColor={(currentPeriod?.result || 0) >= 0 ? 'green' : 'red'}
          />

          <StatCard
            label="Stängda perioder"
            value={loading ? '—' : closedPeriods}
            icon={<Lock className="w-4 h-4" />}
            accentColor="blue"
          />

          <StatCard
            label="Periodstatus"
            value={loading ? '—' : currentPeriod?.status === 'closed' ? 'Stängd' : 'Öppen'}
            icon={<Calendar className="w-4 h-4" />}
            accentColor={currentPeriod?.status === 'closed' ? 'green' : 'gold'}
          />
        </div>

        {/* Tabs */}
        <Card padding="none">
          <div className="px-2 pt-2">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />
          </div>

          {/* Checklist Tab */}
          {activeTab === 'checklist' && (
            <div className="p-6">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Tasks by Category */}
                <div className="lg:col-span-2 space-y-4">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-gray-500 text-sm">Laddar bokslutsstatus...</p>
                    </div>
                  ) : (
                    categories.map(category => (
                      <div key={category} className="bg-gray-50 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-100">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category}</h3>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {tasks.filter(t => t.category === category).map(task => (
                            <button
                              key={task.id}
                              onClick={() => handleTaskClick(task.id)}
                              disabled={task.status === 'locked' || task.status === 'completed'}
                              className={`w-full px-4 py-3 flex items-center gap-4 text-left transition-colors bg-white
                                ${task.status === 'locked' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
                                ${task.status === 'completed' ? 'bg-emerald-50/50' : ''}
                                ${task.status === 'error' ? 'bg-red-50/50' : ''}
                              `}
                            >
                              {getStatusIcon(task.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'text-emerald-700 line-through' : 'text-gray-900'}`}>
                                    {task.title}
                                  </p>
                                  {task.automatable && (
                                    <span title="Automatiserbar">
                                      <Sparkles className="w-3.5 h-3.5 text-[#c0a280]" />
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</p>
                                {task.result?.details && (
                                  <p className="text-xs text-[#c0a280] mt-0.5">{task.result.details}</p>
                                )}
                                {task.result?.amount !== undefined && (
                                  <p className="text-xs text-gray-600 mt-0.5 font-medium">{formatCurrency(task.result.amount)}</p>
                                )}
                              </div>
                              {task.status !== 'locked' && task.status !== 'completed' && (
                                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="bg-[#2d2a26] rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Snabbåtgärder
                    </h3>
                    <div className="space-y-2">
                      <Button 
                        variant="accent"
                        className="w-full justify-between"
                        onClick={handleRunAutomaticClosing}
                        loading={runningAutomation}
                        icon={<Play className="w-4 h-4" />}
                      >
                        <span>Kör automatiskt bokslut</span>
                        <Sparkles className="w-4 h-4" />
                      </Button>
                      <button className="w-full flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white text-sm">
                        <span>Generera rapporter</span>
                        <FileText className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="w-full flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white text-sm">
                        <span>Beräkna avskrivningar</span>
                        <Calculator className="w-4 h-4 text-gray-400" />
                      </button>
                      <Link 
                        href="/accounting/annual-report"
                        className="w-full flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white text-sm"
                      >
                        <span>Gå till årsredovisning</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </Link>
                    </div>
                  </div>

                  {/* Summary */}
                  <Card>
                    <div className="p-5">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        Årets resultat hittills
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Intäkter</span>
                          <span className="font-medium text-gray-900">
                            {loading ? '-' : formatCurrency(totalIncome)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Kostnader</span>
                          <span className="font-medium text-gray-900">
                            {loading ? '-' : formatCurrency(-totalExpenses)}
                          </span>
                        </div>
                        <div className="border-t border-gray-100 pt-3 flex justify-between">
                          <span className="font-semibold text-gray-900">Resultat</span>
                          <span className={`font-semibold ${ytdResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {loading ? '-' : formatCurrency(ytdResult)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Periods Tab */}
          {activeTab === 'periods' && (
            <div className="p-6">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Perioder {selectedYear}</h2>
                </div>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-[#c0a280] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-gray-500 text-sm">Laddar perioder...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {periods.map((period) => {
                      const isFuture = new Date(period.year, period.month - 1, 1) > new Date();
                      const isSelected = period.month === selectedMonth;
                      
                      return (
                        <button
                          key={period.id}
                          onClick={() => setSelectedMonth(period.month)}
                          disabled={isFuture}
                          className={`w-full px-5 py-4 flex items-center justify-between transition-colors
                            ${isSelected ? 'bg-[#c0a280]/5 border-l-2 border-l-[#c0a280]' : 'hover:bg-gray-50'}
                            ${isFuture ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              period.status === 'closed' 
                                ? 'bg-emerald-100' 
                                : period.status === 'open' 
                                  ? 'bg-[#c0a280]/20' 
                                  : 'bg-gray-100'
                            }`}>
                              {period.status === 'closed' ? (
                                <Lock className="w-5 h-5 text-emerald-600" />
                              ) : period.status === 'open' ? (
                                <Clock className="w-5 h-5 text-[#c0a280]" />
                              ) : (
                                <Calendar className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            <div className="text-left">
                              <span className={`text-sm font-medium ${isSelected ? 'text-[#c0a280]' : 'text-gray-900'}`}>
                                {monthNames[period.month - 1]}
                              </span>
                              <div className="mt-0.5">
                                <Badge 
                                  variant={period.status === 'closed' ? 'success' : period.status === 'open' ? 'warning' : 'default'}
                                  size="sm"
                                >
                                  {period.status === 'closed' ? 'Stängd' : period.status === 'open' ? 'Öppen' : 'Kommande'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {(period.status === 'closed' || period.status === 'open') && (
                            <span className={`text-sm font-medium ${period.result >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatCurrency(period.result)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="p-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'balance-sheet', title: 'Balansräkning', desc: 'Tillgångar, skulder och eget kapital', icon: BarChart3 },
                  { key: 'income-statement', title: 'Resultaträkning', desc: 'Intäkter, kostnader och resultat', icon: TrendingUp },
                  { key: 'trial-balance', title: 'Huvudbok', desc: 'Alla transaktioner per konto', icon: FileText },
                  { key: 'specification', title: 'Kontospecifikation', desc: 'Detaljerad specifikation per konto', icon: FileText },
                  { key: 'vat', title: 'Momsrapport', desc: 'Momssummering för perioden', icon: Calculator, href: '/accounting/moms' },
                  { key: 'sie', title: 'SIE-export', desc: 'Export i SIE-format', icon: Download },
                ].map((report) => (
                  <div key={report.key} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-all group">
                    <div className="w-12 h-12 rounded-xl bg-[#c0a280]/10 flex items-center justify-center mb-4 group-hover:bg-[#c0a280]/20 transition-colors">
                      <report.icon className="w-6 h-6 text-[#c0a280]" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                    <p className="text-sm text-gray-500 mb-4">{report.desc}</p>
                    <div className="flex items-center gap-2">
                      {report.href ? (
                        <Link 
                          href={report.href}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Visa
                        </Link>
                      ) : (
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                          Visa
                        </button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Download className="w-3.5 h-3.5" />}
                        onClick={() => handleDownloadReport(report.key)}
                        loading={downloadingReport === report.key}
                      >
                        Ladda ner
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Success Modal */}
        <Modal
          open={showResultModal && !!closingResult}
          onClose={() => setShowResultModal(false)}
          title="Bokslut klart!"
          description={`${monthNames[selectedMonth - 1]} ${selectedYear}`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setShowResultModal(false); setActiveTab('reports'); }}>
                Visa rapporter
              </Button>
              <Button variant="accent" onClick={() => setShowResultModal(false)}>
                Stäng
              </Button>
            </>
          }
        >
          {closingResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">Resultat</span>
                  </div>
                  <p className="text-2xl font-light text-emerald-700">
                    {formatCurrency(closingResult.reports?.incomeStatement?.netResult || currentPeriod?.result || 0)}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Building2 className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase">Tillgångar</span>
                  </div>
                  <p className="text-2xl font-light text-blue-700">
                    {formatCurrency(closingResult.reports?.balanceSheet?.assets?.totalAssets || 0)}
                  </p>
                </div>
              </div>

              {/* Vouchers created */}
              {closingResult.vouchers && closingResult.vouchers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Skapade verifikationer</h3>
                  <div className="space-y-2">
                    {closingResult.vouchers.map((voucher, index) => {
                      const totalAmount = voucher.rows.reduce((sum, r) => sum + (r.debit || 0), 0);
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#c0a280]/10 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-[#c0a280]" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{voucher.description}</p>
                              <p className="text-xs text-gray-500">{voucher.date}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks completed */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Genomförda uppgifter</h3>
                <div className="space-y-1.5">
                  {closingResult.tasks
                    .filter(t => t.status === 'completed')
                    .slice(0, 6)
                    .map(task => (
                      <div key={task.id} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>{task.title}</span>
                        {task.result?.details && (
                          <span className="text-xs text-gray-400">– {task.result.details}</span>
                        )}
                      </div>
                    ))}
                  {closingResult.tasks.filter(t => t.status === 'completed').length > 6 && (
                    <p className="text-xs text-gray-400 pl-6">
                      +{closingResult.tasks.filter(t => t.status === 'completed').length - 6} till
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    
  );
}
