'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, FileText, Clock,
  AlertCircle, Search, Plus, ChevronRight, Zap, BookOpen,
  Users, FolderOpen, Calculator, Briefcase, Upload, Eye, Download,
  CheckCircle2, Filter, ArrowUpRight
} from 'lucide-react';
import {
  mockClients, getOverallStats
} from '@/lib/clientData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { DashboardLayout } from '@/components/DashboardLayout';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type TabType = 'clients' | 'documents' | 'bookkeeping' | 'funds';

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'onboarding'>('all');
  const [activeTab, setActiveTab] = useState<TabType>('clients');
  
  const stats = getOverallStats();

  const filteredClients = mockClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.orgNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && client.status === 'ACTIVE') ||
                         (statusFilter === 'onboarding' && client.status === 'ONBOARDING');
    return matchesSearch && matchesStatus;
  });

  const tabs = [
    { id: 'clients' as TabType, label: 'Klienter', icon: Users, count: stats.totalClients },
    { id: 'documents' as TabType, label: 'Dokument', icon: FolderOpen, count: stats.totalDocuments },
    { id: 'bookkeeping' as TabType, label: 'Bokföring', icon: Calculator, count: stats.pendingDocuments },
    { id: 'funds' as TabType, label: 'Fonder', icon: Briefcase },
  ];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Bokföring & Administration</h1>
              <HelpTooltip 
                {...helpContent.clients}
                learnMoreLink="/guide#bookkeeping"
                position="bottom"
                size="md"
              />
            </div>
            <div className="flex items-center gap-4">
              <p className="text-aifm-charcoal/60">Hantera klienter, dokument och bokföring med AI-stöd</p>
              <Link href="/guide#bookkeeping" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Guide
              </Link>
            </div>
          </div>
          <button className="btn-primary py-2.5 px-5 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ny klient
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8">
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'text-aifm-gold border-aifm-gold'
                    : 'text-aifm-charcoal/50 border-transparent hover:text-aifm-charcoal'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-aifm-gold/10 text-aifm-gold' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Clients Tab */}
          {activeTab === 'clients' && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Building2 className="w-5 h-5 text-aifm-charcoal/40" />
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      +2
                    </span>
                  </div>
                  <p className="text-2xl font-medium text-aifm-charcoal">{stats.totalClients}</p>
                  <p className="text-xs text-aifm-charcoal/60 uppercase tracking-wider mt-1">Klienter</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <FileText className="w-5 h-5 text-aifm-charcoal/40" />
                  </div>
                  <p className="text-2xl font-medium text-aifm-charcoal">{stats.totalDocuments}</p>
                  <p className="text-xs text-aifm-charcoal/60 uppercase tracking-wider mt-1">Dokument</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-2xl font-medium text-amber-600">{stats.pendingDocuments}</p>
                  <p className="text-xs text-aifm-charcoal/60 uppercase tracking-wider mt-1">Väntar</p>
                </div>

                <div className="bg-gray-50 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-2xl font-medium text-amber-600">{stats.needsReview}</p>
                  <p className="text-xs text-aifm-charcoal/60 uppercase tracking-wider mt-1">Granska</p>
                </div>

                <div className="bg-aifm-gold rounded-xl p-5 text-white">
                  <div className="flex items-center justify-between mb-3">
                    <Zap className="w-5 h-5 text-white/60" />
                  </div>
                  <p className="text-2xl font-medium">{(stats.avgConfidence * 100).toFixed(0)}%</p>
                  <p className="text-xs text-white/80 uppercase tracking-wider mt-1">AI Precision</p>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-aifm-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Sök klient eller org.nummer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  {(['all', 'active', 'onboarding'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        statusFilter === status
                          ? 'bg-aifm-charcoal text-white'
                          : 'bg-gray-50 text-aifm-charcoal/70 hover:bg-gray-100'
                      }`}
                    >
                      {status === 'all' ? 'Alla' : status === 'active' ? 'Aktiva' : 'Onboarding'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Client List */}
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <Link 
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="block bg-gray-50 rounded-xl p-5 hover:bg-gray-100 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-aifm-gold/10 rounded-xl flex items-center justify-center group-hover:bg-aifm-gold/20 transition-colors">
                          <Building2 className="w-6 h-6 text-aifm-gold" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">
                              {client.name}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              client.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                              client.status === 'ONBOARDING' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {client.status === 'ACTIVE' ? 'Aktiv' : 'Onboarding'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-aifm-charcoal/60">
                            <span>{client.orgNumber}</span>
                            <span>•</span>
                            <span>{client.industry}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="hidden lg:flex items-center gap-6">
                          <div className="text-center">
                            <p className="font-medium text-aifm-charcoal">{client.monthlyDocuments}</p>
                            <p className="text-xs text-aifm-charcoal/50">Dok/mån</p>
                          </div>
                          {client.pendingDocuments > 0 ? (
                            <div className="text-center">
                              <p className="font-medium text-amber-600">{client.pendingDocuments}</p>
                              <p className="text-xs text-amber-600">Väntar</p>
                            </div>
                          ) : (
                            <div className="text-center">
                              <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                              <p className="text-xs text-green-600">Klart</p>
                            </div>
                          )}
                          <div className="text-center">
                            <p className="font-medium text-aifm-charcoal">{formatCurrency(client.balance)}</p>
                            <p className="text-xs text-aifm-charcoal/50">Saldo</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Link>
                ))}

                {filteredClients.length === 0 && (
                  <div className="text-center py-12">
                    <Building2 className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                    <p className="text-aifm-charcoal/60">Inga klienter hittades</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-aifm-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Sök dokument..."
                      className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/20 outline-none transition-all w-64"
                    />
                  </div>
                  <button className="btn-outline py-2.5 px-4 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtrera
                  </button>
                </div>
                <button className="btn-primary py-2.5 px-4 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Ladda upp dokument
                </button>
              </div>

              {/* Document upload area */}
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center mb-6 hover:border-aifm-gold/50 transition-colors cursor-pointer">
                <Upload className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                <p className="text-aifm-charcoal font-medium mb-2">Släpp filer här eller klicka för att ladda upp</p>
                <p className="text-sm text-aifm-charcoal/50">Stödjer PDF, bilder och kontoutdrag</p>
              </div>

              {/* Recent documents */}
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-4">Senaste dokument</h3>
              <div className="space-y-2">
                {[
                  { name: 'Faktura_2024_001.pdf', client: 'Nordisk Fastighet AB', date: '2024-11-27', status: 'processed' },
                  { name: 'Kontoutdrag_Nov.pdf', client: 'Startup Tech AB', date: '2024-11-26', status: 'pending' },
                  { name: 'Kvitto_Amazon.pdf', client: 'Nordisk Fastighet AB', date: '2024-11-25', status: 'review' },
                ].map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-aifm-gold" />
                      <div>
                        <p className="font-medium text-aifm-charcoal">{doc.name}</p>
                        <p className="text-sm text-aifm-charcoal/50">{doc.client} • {doc.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        doc.status === 'processed' ? 'bg-green-100 text-green-700' :
                        doc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {doc.status === 'processed' ? 'Bearbetad' : doc.status === 'pending' ? 'Väntar' : 'Granska'}
                      </span>
                      <button className="p-2 hover:bg-gray-200 rounded-lg">
                        <Eye className="w-4 h-4 text-aifm-charcoal/50" />
                      </button>
                      <button className="p-2 hover:bg-gray-200 rounded-lg">
                        <Download className="w-4 h-4 text-aifm-charcoal/50" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bookkeeping Tab */}
          {activeTab === 'bookkeeping' && (
            <div>
              <div className="grid lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
                  <ArrowUpRight className="w-8 h-8 text-white/60 mb-4" />
                  <p className="text-3xl font-medium mb-1">{formatCurrency(2450000)}</p>
                  <p className="text-white/80">Intäkter denna månad</p>
                </div>
                <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
                  <Calculator className="w-8 h-8 text-white/60 mb-4" />
                  <p className="text-3xl font-medium mb-1">{stats.pendingDocuments}</p>
                  <p className="text-white/80">Väntar på kontering</p>
                </div>
                <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/80 rounded-2xl p-6 text-white">
                  <CheckCircle2 className="w-8 h-8 text-white/60 mb-4" />
                  <p className="text-3xl font-medium mb-1">{(stats.avgConfidence * 100).toFixed(0)}%</p>
                  <p className="text-white/80">Automatisk kontering</p>
                </div>
              </div>

              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-4">Senaste konteringar</h3>
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Beskrivning</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Konto</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Belopp</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { date: '2024-11-27', desc: 'Faktura #2024-001', account: '3010 Försäljning', amount: 125000, status: 'verified' },
                      { date: '2024-11-26', desc: 'Banktransaktion', account: '1920 Bank', amount: -45000, status: 'pending' },
                      { date: '2024-11-25', desc: 'Amazon inköp', account: '5410 Förbrukningsmat.', amount: -2500, status: 'review' },
                    ].map((entry, i) => (
                      <tr key={i} className="hover:bg-gray-100">
                        <td className="px-6 py-4 text-sm text-aifm-charcoal">{entry.date}</td>
                        <td className="px-6 py-4 text-sm font-medium text-aifm-charcoal">{entry.desc}</td>
                        <td className="px-6 py-4 text-sm text-aifm-charcoal/70">{entry.account}</td>
                        <td className={`px-6 py-4 text-sm font-medium text-right ${entry.amount >= 0 ? 'text-green-600' : 'text-aifm-charcoal'}`}>
                          {formatCurrency(entry.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            entry.status === 'verified' ? 'bg-green-100 text-green-700' :
                            entry.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.status === 'verified' ? 'Verifierad' : entry.status === 'pending' ? 'Väntar' : 'Granska'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Funds Tab */}
          {activeTab === 'funds' && (
            <div>
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 text-aifm-charcoal/20 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-aifm-charcoal mb-2">Fondöversikt</h3>
                <p className="text-aifm-charcoal/60 mb-6 max-w-md mx-auto">
                  Se och hantera alla fonder kopplade till dina klienter. Navigera till huvudsidan för fondhantering för fullständig funktionalitet.
                </p>
                <Link href="/portfolio" className="btn-primary py-2.5 px-5 inline-flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Gå till fondhantering
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
