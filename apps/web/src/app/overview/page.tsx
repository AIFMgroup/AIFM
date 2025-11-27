'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, Briefcase, CheckSquare, FolderLock,
  Users, DollarSign, ArrowUpRight, ArrowDownRight,
  FileText, Settings, HelpCircle, LogOut, Building2,
  TrendingUp, Calendar, ChevronRight, Bell,
  Wallet, Shield, BookOpen
} from 'lucide-react';
import {
  mockCompanies, getCompanyDashboard, formatCurrencyCompact,
  Company
} from '@/lib/companyData';

// Navigation items - Swedish
const navItems = [
  { id: 'overview', label: 'Översikt', icon: LayoutDashboard, href: '/overview' },
  { id: 'portfolio', label: 'Portfölj', icon: Briefcase, href: '/portfolio' },
  { id: 'tasks', label: 'Uppgifter', icon: CheckSquare, href: '/approvals' },
  { id: 'dataroom', label: 'Datarum', icon: FolderLock, href: '/data-rooms' },
  { id: 'divider1', type: 'divider' },
  { id: 'investors', label: 'Investerare', icon: Users, href: '/investors' },
  { id: 'capital', label: 'Kapitalanrop', icon: ArrowUpRight, href: '/capital-calls' },
  { id: 'distributions', label: 'Utdelningar', icon: ArrowDownRight, href: '/distributions' },
  { id: 'treasury', label: 'Likviditet', icon: Wallet, href: '/treasury' },
  { id: 'divider2', type: 'divider' },
  { id: 'documents', label: 'Bokföring', icon: FileText, href: '/clients' },
  { id: 'compliance', label: 'Compliance', icon: Shield, href: '/approvals' },
];

const bottomNavItems = [
  { id: 'guide', label: 'Guide', icon: BookOpen, href: '/guide' },
  { id: 'settings', label: 'Inställningar', icon: Settings, href: '/settings' },
  { id: 'help', label: 'Hjälp', icon: HelpCircle, href: '/guide' },
];

export default function OverviewPage() {
  const [selectedCompany, setSelectedCompany] = useState<Company>(mockCompanies[0]);
  const [sidebarCollapsed] = useState(false);
  
  const dashboard = getCompanyDashboard(selectedCompany.id);

  if (!dashboard) {
    return <div>Laddar...</div>;
  }

  const { portfolio, transactions, tasks, kpiData, metrics } = dashboard;

  // Calculate total portfolio value
  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + item.value, 0);

  // Transaction type translations
  const getTransactionTypeLabel = (type: string) => {
    switch(type) {
      case 'INVESTMENT': return 'Investering';
      case 'INCOME': return 'Intäkt';
      case 'DISTRIBUTION': return 'Utdelning';
      case 'EXPENSE': return 'Utgift';
      default: return type;
    }
  };

  // Priority translations
  const getPriorityLabel = (priority: string) => {
    switch(priority) {
      case 'HIGH': return 'Hög';
      case 'MEDIUM': return 'Medel';
      case 'LOW': return 'Låg';
      default: return priority;
    }
  };

  const handleLogout = () => {
    // Clear cookie and redirect to login
    document.cookie = 'password-gate-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/password-gate';
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-aifm-charcoal flex flex-col transition-all duration-300 fixed left-0 top-0 bottom-0 z-40`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aifm-gold rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            {!sidebarCollapsed && (
              <span className="text-white font-medium tracking-widest uppercase">AIFM</span>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              if (item.type === 'divider') {
                return <li key={item.id} className="my-3 border-t border-white/10" />;
              }
              const Icon = item.icon!;
              const isActive = item.id === 'overview';
              return (
                <li key={item.id}>
                  <Link
                    href={item.href!}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-aifm-gold text-white' 
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-white/10 py-4 px-2">
          <ul className="space-y-1">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="text-sm">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
            <li>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/50 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm">Logga ut</span>
                )}
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen ml-64">
        {/* Top Company Selector Bar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-6 py-3">
            {/* Company Tabs */}
            <div className="flex items-center justify-center gap-1 mb-2">
              {mockCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => setSelectedCompany(company)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    selectedCompany.id === company.id
                      ? 'bg-aifm-gold text-white shadow-md'
                      : 'text-aifm-charcoal/60 hover:bg-gray-100 hover:text-aifm-charcoal'
                  }`}
                >
                  {company.shortName}
                </button>
              ))}
            </div>
            
            {/* Company Info Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: selectedCompany.color + '20' }}
                >
                  <Building2 className="w-4 h-4" style={{ color: selectedCompany.color }} />
                </div>
                <div>
                  <h1 className="font-medium text-aifm-charcoal">{selectedCompany.name}</h1>
                  <p className="text-xs text-aifm-charcoal/50">Org.nr: {selectedCompany.orgNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-aifm-charcoal/50 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg">
                  <Bell className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 p-6 bg-gray-50 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {/* Section Title */}
            <div className="mb-6">
              <h2 className="text-xl font-medium text-aifm-charcoal uppercase tracking-wider">Översikt</h2>
            </div>

            {/* Dashboard Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column - 2/3 width */}
              <div className="lg:col-span-2 space-y-6">
                {/* Portfolio Overview */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Portföljöversikt</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-8">
                      {/* Pie Chart */}
                      <div className="relative w-40 h-40 flex-shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          {portfolio.map((item, index) => {
                            const offset = portfolio.slice(0, index).reduce((sum, i) => sum + i.percentage, 0);
                            const circumference = 2 * Math.PI * 35;
                            const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                            const strokeDashoffset = -((offset / 100) * circumference);
                            return (
                              <circle
                                key={item.name}
                                cx="50"
                                cy="50"
                                r="35"
                                fill="none"
                                stroke={item.color}
                                strokeWidth="20"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-aifm-charcoal">
                              {formatCurrencyCompact(totalPortfolioValue)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex-1 space-y-3">
                        {portfolio.map((item) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-sm text-aifm-charcoal">{item.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-medium text-aifm-charcoal">{item.percentage}%</span>
                              <span className="text-xs text-aifm-charcoal/50 ml-2">
                                {formatCurrencyCompact(item.value)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Transaktioner</h3>
                    <Link href="/treasury" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
                      Visa alla <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.type === 'INVESTMENT' ? 'bg-blue-100' :
                            tx.type === 'INCOME' ? 'bg-green-100' :
                            tx.type === 'DISTRIBUTION' ? 'bg-purple-100' :
                            'bg-amber-100'
                          }`}>
                            {tx.type === 'INVESTMENT' && <ArrowUpRight className="w-5 h-5 text-blue-600" />}
                            {tx.type === 'INCOME' && <TrendingUp className="w-5 h-5 text-green-600" />}
                            {tx.type === 'DISTRIBUTION' && <ArrowDownRight className="w-5 h-5 text-purple-600" />}
                            {tx.type === 'EXPENSE' && <DollarSign className="w-5 h-5 text-amber-600" />}
                          </div>
                          <div>
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded uppercase mr-2 ${
                              tx.type === 'INVESTMENT' ? 'bg-blue-100 text-blue-700' :
                              tx.type === 'INCOME' ? 'bg-green-100 text-green-700' :
                              tx.type === 'DISTRIBUTION' ? 'bg-purple-100 text-purple-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {getTransactionTypeLabel(tx.type)}
                            </span>
                            <p className="text-sm text-aifm-charcoal">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? 'text-green-600' : 'text-aifm-charcoal'
                          }`}>
                            {tx.type === 'INCOME' || tx.type === 'DISTRIBUTION' ? '+' : '-'}
                            {formatCurrencyCompact(tx.amount, tx.currency)}
                          </p>
                          <p className="text-xs text-aifm-charcoal/50">{tx.date.toLocaleDateString('sv-SE')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tasks */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Uppgifter</h3>
                    <Link href="/approvals" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
                      Visa alla <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="p-4 space-y-3">
                    {tasks.map((task) => (
                      <div 
                        key={task.id} 
                        className={`p-4 rounded-xl border ${
                          task.status === 'DONE' 
                            ? 'bg-gray-50 border-gray-100' 
                            : 'bg-white border-gray-200 hover:border-aifm-gold/30'
                        } transition-colors`}
                      >
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            checked={task.status === 'DONE'}
                            readOnly
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-aifm-gold focus:ring-aifm-gold"
                          />
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
                              {task.assignee && (
                                <span className="text-xs text-aifm-charcoal/50">{task.assignee}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                task.priority === 'HIGH' ? 'bg-red-100 text-red-700' :
                                task.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
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

              {/* Right Column - 1/3 width */}
              <div className="space-y-6">
                {/* KPI Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Nyckeltal</h3>
                    <select className="text-xs border-0 bg-gray-100 rounded-lg px-2 py-1 text-aifm-charcoal">
                      <option>NAV</option>
                      <option>IRR</option>
                      <option>MOIC</option>
                    </select>
                  </div>
                  <div className="p-6">
                    {/* Mini Line Chart */}
                    <div className="h-40 flex items-end justify-between gap-1">
                      {kpiData.map((data) => {
                        const maxValue = Math.max(...kpiData.map(d => Math.max(d.value1, d.value2)));
                        const height1 = (data.value1 / maxValue) * 100;
                        const height2 = (data.value2 / maxValue) * 100;
                        return (
                          <div key={data.month} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full h-32 flex items-end justify-center gap-0.5">
                              <div 
                                className="w-2 bg-aifm-gold rounded-t transition-all"
                                style={{ height: `${height1}%` }}
                              />
                              <div 
                                className="w-2 bg-gray-300 rounded-t transition-all"
                                style={{ height: `${height2}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-aifm-charcoal/50">{data.month}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-aifm-gold" />
                        <span className="text-xs text-aifm-charcoal/60">GP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300" />
                        <span className="text-xs text-aifm-charcoal/60">LP</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MOIC & IRR Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider mb-1">MOIC</p>
                    <p className="text-3xl font-bold text-aifm-charcoal">{metrics.moic.toFixed(2)}x</p>
                    <p className="text-xs text-green-600 mt-1">↑ Multipel på investerat</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-medium text-aifm-charcoal/50 uppercase tracking-wider mb-1">IRR</p>
                    <p className="text-3xl font-bold text-aifm-charcoal">{metrics.irr.toFixed(2)}%</p>
                    <p className="text-xs text-green-600 mt-1">↑ Internränta</p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Sammanfattning</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-aifm-charcoal/60">NAV</span>
                      <span className="font-medium text-aifm-charcoal">{formatCurrencyCompact(metrics.nav)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-aifm-charcoal/60">Totalt investerat</span>
                      <span className="font-medium text-aifm-charcoal">{formatCurrencyCompact(metrics.totalInvested)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-aifm-charcoal/60">Utdelat</span>
                      <span className="font-medium text-aifm-charcoal">{formatCurrencyCompact(metrics.totalDistributed)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-aifm-charcoal/60">Orealiserad vinst</span>
                      <span className="font-medium text-green-600">+{formatCurrencyCompact(metrics.unrealizedGain)}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-5 text-white">
                  <h3 className="text-sm font-medium uppercase tracking-wider mb-4">Snabbåtgärder</h3>
                  <div className="space-y-2">
                    <Link href="/capital-calls" className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                      <span className="text-sm">Nytt kapitalanrop</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                    <Link href="/distributions" className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                      <span className="text-sm">Ny utdelning</span>
                      <ArrowDownRight className="w-4 h-4" />
                    </Link>
                    <Link href="/data-rooms" className="flex items-center justify-between p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                      <span className="text-sm">Öppna datarum</span>
                      <FolderLock className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
