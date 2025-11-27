'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, FileText, Clock,
  AlertCircle, Search, Plus, ChevronRight, Zap, BookOpen
} from 'lucide-react';
import {
  mockClients, getOverallStats
} from '@/lib/clientData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'onboarding'>('all');
  
  const stats = getOverallStats();

  const filteredClients = mockClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.orgNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && client.status === 'ACTIVE') ||
                         (statusFilter === 'onboarding' && client.status === 'ONBOARDING');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-aifm-gold rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
                <span className="font-medium tracking-widest text-aifm-charcoal uppercase text-sm">AIFM</span>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/clients" className="text-sm font-medium text-aifm-gold uppercase tracking-wider">Klienter</Link>
                <Link href="/documents" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Dokument</Link>
                <Link href="/bookkeeping" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Bokföring</Link>
                <Link href="/fund" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Fonder</Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-primary py-2 px-4 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Ny Klient
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="heading-2">Klienthantering</h1>
            <HelpTooltip 
              {...helpContent.clients}
              learnMoreLink="/guide#bookkeeping"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">Hantera företag och deras bokföring med AI-stöd</p>
            <Link href="/guide#bookkeeping" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <Building2 className="w-5 h-5 text-aifm-charcoal/40" />
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                +2 denna månad
              </span>
            </div>
            <p className="text-3xl font-medium text-aifm-charcoal">{stats.totalClients}</p>
            <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Klienter</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <FileText className="w-5 h-5 text-aifm-charcoal/40" />
            </div>
            <p className="text-3xl font-medium text-aifm-charcoal">{stats.totalDocuments}</p>
            <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Dokument</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-medium text-amber-600">{stats.pendingDocuments}</p>
            <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Väntar</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-medium text-amber-600">{stats.needsReview}</p>
            <p className="text-sm text-aifm-charcoal/60 uppercase tracking-wider mt-1">Granska</p>
          </div>

          <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/80 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <Zap className="w-5 h-5 text-white/60" />
            </div>
            <p className="text-3xl font-medium">{(stats.avgConfidence * 100).toFixed(0)}%</p>
            <p className="text-sm text-white/80 uppercase tracking-wider mt-1">AI Precision</p>
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
                    : 'bg-white border border-gray-200 text-aifm-charcoal/70 hover:border-aifm-gold/30'
                }`}
              >
                {status === 'all' ? 'Alla' : status === 'active' ? 'Aktiva' : 'Onboarding'}
              </button>
            ))}
          </div>
        </div>

        {/* Client Cards */}
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Link 
              key={client.id}
              href={`/clients/${client.id}`}
              className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-aifm-gold/30 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-aifm-gold/10 rounded-xl flex items-center justify-center group-hover:bg-aifm-gold/20 transition-colors">
                    <Building2 className="w-7 h-7 text-aifm-gold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-aifm-charcoal group-hover:text-aifm-gold transition-colors">
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
                      <span>•</span>
                      <span>{client.city}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  {/* Document Stats */}
                  <div className="hidden lg:flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-lg font-medium text-aifm-charcoal">{client.monthlyDocuments}</p>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Dokument/mån</p>
                    </div>
                    <div className="text-center">
                      {client.pendingDocuments > 0 ? (
                        <>
                          <p className="text-lg font-medium text-amber-600">{client.pendingDocuments}</p>
                          <p className="text-xs text-amber-600 uppercase tracking-wider">Väntar</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium text-green-600">✓</p>
                          <p className="text-xs text-green-600 uppercase tracking-wider">Klart</p>
                        </>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-aifm-charcoal">{formatCurrency(client.balance)}</p>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider">Saldo</p>
                    </div>
                  </div>

                  {/* Last Activity */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm text-aifm-charcoal/60">Senast aktiv</p>
                    <p className="text-sm font-medium text-aifm-charcoal">{formatDate(client.lastActivity)}</p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-aifm-charcoal/30 group-hover:text-aifm-gold group-hover:translate-x-1 transition-all" />
                </div>
              </div>

              {/* Progress Bar for pending documents */}
              {client.pendingDocuments > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-aifm-charcoal/60">
                      {client.pendingDocuments} dokument väntar på bearbetning
                    </span>
                    <span className="text-aifm-charcoal/60">
                      {Math.round(((client.monthlyDocuments - client.pendingDocuments) / client.monthlyDocuments) * 100)}% klart
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div 
                      className="bg-aifm-gold rounded-full h-1.5 transition-all"
                      style={{ width: `${((client.monthlyDocuments - client.pendingDocuments) / client.monthlyDocuments) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <Building2 className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
            <p className="text-aifm-charcoal/60">Inga klienter hittades</p>
          </div>
        )}
      </main>
    </div>
  );
}

