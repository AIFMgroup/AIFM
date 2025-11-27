'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Users, Shield, CheckCircle2, AlertCircle, Clock,
  RefreshCw, Download, Filter, Search, ChevronRight,
  Plus, Eye, Mail, Phone, Globe, Building2, User,
  FileText, AlertTriangle, XCircle, BookOpen
} from 'lucide-react';
import {
  getInvestorsByCompanyId, getCommitmentsByInvestor,
  formatCurrency, formatPercentage, formatDate, Investor
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

export default function InvestorsPage() {
  const { selectedCompany } = useCompany();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'approved' | 'pending' | 'flagged'>('all');
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get investors for selected company
  const companyInvestors = getInvestorsByCompanyId(selectedCompany.id);

  // Filter investors
  const filteredInvestors = companyInvestors.filter(investor => {
    const matchesSearch = investor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         investor.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'approved') return matchesSearch && investor.kycStatus === 'APPROVED';
    if (selectedFilter === 'pending') return matchesSearch && (investor.kycStatus === 'PENDING' || investor.kycStatus === 'IN_PROGRESS');
    if (selectedFilter === 'flagged') return matchesSearch && (investor.amlStatus === 'FLAGGED' || investor.riskRating === 'HIGH');
    return matchesSearch;
  });

  // Stats
  const stats = {
    total: companyInvestors.length,
    approved: companyInvestors.filter(i => i.kycStatus === 'APPROVED').length,
    pending: companyInvestors.filter(i => i.kycStatus === 'PENDING' || i.kycStatus === 'IN_PROGRESS').length,
    flagged: companyInvestors.filter(i => i.amlStatus === 'FLAGGED' || i.riskRating === 'HIGH').length,
  };

  const getKYCStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'PENDING': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'IN_PROGRESS': return <RefreshCw className="w-4 h-4 text-blue-500" />;
      case 'REJECTED': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'EXPIRED': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getKYCStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      case 'EXPIRED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRiskColor = (rating: string) => {
    switch (rating) {
      case 'LOW': return 'bg-green-100 text-green-700';
      case 'MEDIUM': return 'bg-amber-100 text-amber-700';
      case 'HIGH': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getInvestorTypeIcon = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL': return <User className="w-5 h-5" />;
      case 'INSTITUTION': return <Building2 className="w-5 h-5" />;
      case 'FAMILY_OFFICE': return <Users className="w-5 h-5" />;
      case 'PENSION_FUND': return <Shield className="w-5 h-5" />;
      case 'ENDOWMENT': return <Building2 className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Investerarhantering</h1>
              <HelpTooltip 
                {...helpContent.investors}
                learnMoreLink="/guide#investors"
                position="bottom"
                size="md"
              />
            </div>
            <div className="flex items-center gap-4">
              <p className="text-aifm-charcoal/60">Hantera investerare, KYC/AML-efterlevnad och åtaganden</p>
              <Link href="/guide#investors" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Guide
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-outline py-2 px-4 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportera
            </button>
            <button className="btn-primary py-2 px-4 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Lägg till investerare
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`p-6 rounded-2xl border-2 transition-all text-left ${
            selectedFilter === 'all' 
              ? 'border-aifm-gold bg-aifm-gold/5' 
              : 'border-gray-100 bg-white hover:border-aifm-gold/30'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Totalt antal investerare</span>
            <Users className="w-5 h-5 text-aifm-charcoal/30" />
          </div>
          <p className="text-3xl font-medium text-aifm-charcoal">{stats.total}</p>
        </button>

        <button
          onClick={() => setSelectedFilter('approved')}
          className={`p-6 rounded-2xl border-2 transition-all text-left ${
            selectedFilter === 'approved' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-100 bg-white hover:border-green-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">KYC godkänd</span>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-medium text-green-600">{stats.approved}</p>
        </button>

        <button
          onClick={() => setSelectedFilter('pending')}
          className={`p-6 rounded-2xl border-2 transition-all text-left ${
            selectedFilter === 'pending' 
              ? 'border-amber-500 bg-amber-50' 
              : 'border-gray-100 bg-white hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Väntar på granskning</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-medium text-amber-600">{stats.pending}</p>
        </button>

        <button
          onClick={() => setSelectedFilter('flagged')}
          className={`p-6 rounded-2xl border-2 transition-all text-left ${
            selectedFilter === 'flagged' 
              ? 'border-red-500 bg-red-50' 
              : 'border-gray-100 bg-white hover:border-red-200'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Flaggade</span>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-medium text-red-600">{stats.flagged}</p>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-aifm-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Sök investerare..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input py-2 pl-10 pr-4 w-full"
          />
        </div>
        <button className="btn-outline py-2 px-4 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Fler filter
        </button>
      </div>

      {/* Investors List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filteredInvestors.map((investor) => {
            const commitments = getCommitmentsByInvestor(investor.id);
            const totalCommitted = commitments.reduce((sum, c) => sum + c.committedAmount, 0);
            
            return (
              <div 
                key={investor.id}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedInvestor(selectedInvestor?.id === investor.id ? null : investor)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-aifm-gold/10 rounded-xl flex items-center justify-center text-aifm-gold">
                      {getInvestorTypeIcon(investor.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-aifm-charcoal">{investor.name}</h3>
                        {investor.pepStatus && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">PEP</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-aifm-charcoal/60">{investor.type.replace('_', ' ')}</span>
                        <span className="text-sm text-aifm-charcoal/40">•</span>
                        <span className="text-sm text-aifm-charcoal/60 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {investor.country}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium text-aifm-charcoal">{formatCurrency(totalCommitted, 'SEK')}</p>
                      <p className="text-sm text-aifm-charcoal/60">{commitments.length} åtagande{commitments.length !== 1 ? 'n' : ''}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getKYCStatusColor(investor.kycStatus)}`}>
                        {getKYCStatusIcon(investor.kycStatus)}
                        {investor.kycStatus.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(investor.riskRating)}`}>
                        {investor.riskRating}
                      </span>
                    </div>

                    <ChevronRight className={`w-5 h-5 text-aifm-charcoal/30 transition-transform ${
                      selectedInvestor?.id === investor.id ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedInvestor?.id === investor.id && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Contact Info */}
                      <div>
                        <h4 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-4">Kontaktinformation</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-aifm-charcoal/40" />
                            <a href={`mailto:${investor.email}`} className="text-sm text-aifm-gold hover:underline">
                              {investor.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone className="w-4 h-4 text-aifm-charcoal/40" />
                            <span className="text-sm text-aifm-charcoal">{investor.phone}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-aifm-charcoal/40" />
                            <span className="text-sm text-aifm-charcoal">Tax ID: {investor.taxId}</span>
                          </div>
                        </div>
                      </div>

                      {/* Compliance Status */}
                      <div>
                        <h4 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-4">Efterlevnadsstatus</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-aifm-charcoal/60">KYC-status</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getKYCStatusColor(investor.kycStatus)}`}>
                              {investor.kycStatus.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-aifm-charcoal/60">AML-screening</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              investor.amlStatus === 'CLEAR' ? 'bg-green-100 text-green-700' :
                              investor.amlStatus === 'FLAGGED' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {investor.amlStatus}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-aifm-charcoal/60">Riskbetyg</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(investor.riskRating)}`}>
                              {investor.riskRating}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-aifm-charcoal/60">PEP-status</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              investor.pepStatus ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {investor.pepStatus ? 'JA' : 'NEJ'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Commitments */}
                    {commitments.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider mb-4">Fondåtaganden</h4>
                        <div className="space-y-3">
                          {commitments.map((commitment) => (
                            <div key={commitment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                              <div>
                                <p className="font-medium text-aifm-charcoal">{commitment.fund?.name}</p>
                                <p className="text-sm text-aifm-charcoal/60">Signerat: {formatDate(commitment.signedAt)}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium text-aifm-charcoal">{formatCurrency(commitment.committedAmount, commitment.fund?.currency || 'SEK')}</p>
                                <p className="text-sm text-aifm-charcoal/60">{formatPercentage(commitment.ownershipPercentage)} ägarandel</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-6 flex gap-3">
                      <button className="btn-outline py-2 px-4 text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Visa dokument
                      </button>
                      <button className="btn-outline py-2 px-4 text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Generera utdrag
                      </button>
                      <button className="btn-outline py-2 px-4 text-sm flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Skicka meddelande
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredInvestors.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
            <p className="text-aifm-charcoal/60">Inga investerare hittades som matchar dina kriterier</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
