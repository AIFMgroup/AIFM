'use client';

import { useState } from 'react';
import { 
  Users, Shield, CheckCircle2, AlertCircle, Clock,
  Download, Search, ChevronRight, ChevronDown,
  Plus, Eye, Mail, Phone, Globe, Building2, User,
  FileText, AlertTriangle, XCircle
} from 'lucide-react';
import {
  getInvestorsByCompanyId, getCommitmentsByInvestor,
  formatCurrency, formatPercentage, formatDate, Investor
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Filter Tab Component
function FilterTab({ 
  label, 
  count, 
  isActive, 
  variant = 'default',
  icon: Icon,
  onClick 
}: { 
  label: string; 
  count: number; 
  isActive: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  icon: React.ElementType;
  onClick: () => void;
}) {
  const variantStyles = {
    default: {
      active: 'border-aifm-gold bg-aifm-gold/5',
      inactive: 'border-gray-100/50 bg-white hover:border-aifm-gold/30',
      iconActive: 'text-aifm-gold',
      iconInactive: 'text-aifm-charcoal/30',
      countActive: 'text-aifm-charcoal',
      countInactive: 'text-aifm-charcoal',
    },
    success: {
      active: 'border-emerald-400 bg-emerald-50',
      inactive: 'border-gray-100/50 bg-white hover:border-emerald-200',
      iconActive: 'text-emerald-500',
      iconInactive: 'text-emerald-400',
      countActive: 'text-emerald-600',
      countInactive: 'text-emerald-600',
    },
    warning: {
      active: 'border-amber-400 bg-amber-50',
      inactive: 'border-gray-100/50 bg-white hover:border-amber-200',
      iconActive: 'text-amber-500',
      iconInactive: 'text-amber-400',
      countActive: 'text-amber-600',
      countInactive: 'text-amber-600',
    },
    danger: {
      active: 'border-red-400 bg-red-50',
      inactive: 'border-gray-100/50 bg-white hover:border-red-200',
      iconActive: 'text-red-500',
      iconInactive: 'text-red-400',
      countActive: 'text-red-600',
      countInactive: 'text-red-600',
    },
  };

  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={`
        group relative p-6 rounded-2xl border-2 transition-all duration-300 text-left
        hover:shadow-lg hover:shadow-gray-100/50 hover:-translate-y-0.5
        ${isActive ? styles.active : styles.inactive}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl transition-colors duration-300 ${
          isActive ? 'bg-white/80' : 'bg-gray-50 group-hover:bg-gray-100'
        }`}>
          <Icon className={`w-5 h-5 transition-colors duration-300 ${
            isActive ? styles.iconActive : styles.iconInactive
          }`} />
        </div>
      </div>
      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider font-medium mb-2">{label}</p>
      <p className={`text-3xl font-semibold ${isActive ? styles.countActive : styles.countInactive}`}>{count}</p>
    </button>
  );
}

// Investor Row Component
function InvestorRow({ 
  investor, 
  isExpanded, 
  onToggle,
  commitments
}: { 
  investor: Investor;
  isExpanded: boolean;
  onToggle: () => void;
  commitments: ReturnType<typeof getCommitmentsByInvestor>;
}) {
  const totalCommitted = commitments.reduce((sum, c) => sum + c.committedAmount, 0);

  const getKYCStatusStyles = (status: string) => {
    switch (status) {
      case 'APPROVED': return { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircle2 };
      case 'PENDING': return { bg: 'bg-amber-50', text: 'text-amber-600', icon: Clock };
      case 'IN_PROGRESS': return { bg: 'bg-blue-50', text: 'text-blue-600', icon: Clock };
      case 'REJECTED': return { bg: 'bg-red-50', text: 'text-red-600', icon: XCircle };
      case 'EXPIRED': return { bg: 'bg-red-50', text: 'text-red-600', icon: AlertCircle };
      default: return { bg: 'bg-gray-50', text: 'text-gray-600', icon: Clock };
    }
  };

  const getRiskStyles = (rating: string) => {
    switch (rating) {
      case 'LOW': return 'bg-emerald-50 text-emerald-600';
      case 'MEDIUM': return 'bg-amber-50 text-amber-600';
      case 'HIGH': return 'bg-red-50 text-red-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getInvestorIcon = (type: string) => {
    switch (type) {
      case 'INDIVIDUAL': return User;
      case 'INSTITUTION': return Building2;
      case 'FAMILY_OFFICE': return Users;
      case 'PENSION_FUND': return Shield;
      case 'ENDOWMENT': return Building2;
      default: return User;
    }
  };

  const kycStyles = getKYCStatusStyles(investor.kycStatus);
  const KYCIcon = kycStyles.icon;
  const InvestorIcon = getInvestorIcon(investor.type);

  return (
    <div className={`
      transition-all duration-300
      ${isExpanded ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'}
    `}>
      <div 
        className="p-6 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          {/* Investor Info */}
          <div className="flex items-center gap-5">
            <div className={`
              w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
              ${isExpanded ? 'bg-aifm-gold/10' : 'bg-aifm-charcoal/5'}
            `}>
              <InvestorIcon className={`w-6 h-6 transition-colors duration-300 ${
                isExpanded ? 'text-aifm-gold' : 'text-aifm-charcoal/50'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-aifm-charcoal">{investor.name}</h3>
                {investor.pepStatus && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 uppercase">PEP</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-aifm-charcoal/50">{investor.type.replace(/_/g, ' ')}</span>
                <span className="text-aifm-charcoal/20">•</span>
                <span className="text-sm text-aifm-charcoal/50 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {investor.country}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-8">
            {/* Committed Amount */}
            <div className="text-right">
              <p className="text-lg font-semibold text-aifm-charcoal">{formatCurrency(totalCommitted, 'SEK')}</p>
              <p className="text-sm text-aifm-charcoal/40">{commitments.length} åtagande{commitments.length !== 1 ? 'n' : ''}</p>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full ${kycStyles.bg} ${kycStyles.text}`}>
                <KYCIcon className="w-3.5 h-3.5" />
                {investor.kycStatus.replace(/_/g, ' ')}
              </span>
              <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${getRiskStyles(investor.riskRating)}`}>
                {investor.riskRating === 'LOW' ? 'Låg' : investor.riskRating === 'MEDIUM' ? 'Medel' : 'Hög'}
              </span>
            </div>

            {/* Expand Icon */}
            <div className={`p-2 rounded-lg transition-all duration-300 ${
              isExpanded ? 'bg-aifm-charcoal/5' : ''
            }`}>
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-aifm-charcoal/40" />
              ) : (
                <ChevronRight className="w-5 h-5 text-aifm-charcoal/30" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="pt-6 border-t border-gray-100">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Contact Info */}
              <div className="bg-white rounded-xl p-6 border border-gray-100/50">
                <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-5">Kontaktinformation</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Mail className="w-4 h-4 text-aifm-charcoal/40" />
                    </div>
                    <a href={`mailto:${investor.email}`} className="text-sm text-aifm-gold hover:underline">
                      {investor.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Phone className="w-4 h-4 text-aifm-charcoal/40" />
                    </div>
                    <span className="text-sm text-aifm-charcoal">{investor.phone}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <FileText className="w-4 h-4 text-aifm-charcoal/40" />
                    </div>
                    <span className="text-sm text-aifm-charcoal">Tax ID: {investor.taxId}</span>
                  </div>
                </div>
              </div>

              {/* Compliance Status */}
              <div className="bg-white rounded-xl p-6 border border-gray-100/50">
                <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-5">Efterlevnadsstatus</h4>
                <div className="space-y-4">
                  {[
                    { label: 'KYC-status', value: investor.kycStatus.replace(/_/g, ' '), style: kycStyles },
                    { 
                      label: 'AML-screening', 
                      value: investor.amlStatus === 'CLEAR' ? 'Godkänd' : investor.amlStatus === 'FLAGGED' ? 'Flaggad' : 'Granskas',
                      style: { 
                        bg: investor.amlStatus === 'CLEAR' ? 'bg-emerald-50' : investor.amlStatus === 'FLAGGED' ? 'bg-red-50' : 'bg-amber-50',
                        text: investor.amlStatus === 'CLEAR' ? 'text-emerald-600' : investor.amlStatus === 'FLAGGED' ? 'text-red-600' : 'text-amber-600'
                      }
                    },
                    { 
                      label: 'Risknivå', 
                      value: investor.riskRating === 'LOW' ? 'Låg' : investor.riskRating === 'MEDIUM' ? 'Medel' : 'Hög',
                      style: { bg: getRiskStyles(investor.riskRating).split(' ')[0], text: getRiskStyles(investor.riskRating).split(' ')[1] }
                    },
                    { 
                      label: 'PEP-status', 
                      value: investor.pepStatus ? 'Ja' : 'Nej',
                      style: { bg: investor.pepStatus ? 'bg-purple-50' : 'bg-gray-50', text: investor.pepStatus ? 'text-purple-600' : 'text-gray-600' }
                    },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-aifm-charcoal/50">{item.label}</span>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${item.style.bg} ${item.style.text}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Commitments */}
            {commitments.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Fondåtaganden</h4>
                <div className="grid gap-3">
                  {commitments.map((commitment) => (
                    <div key={commitment.id} className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-100/50 hover:border-aifm-gold/20 transition-colors duration-300">
                      <div>
                        <p className="font-semibold text-aifm-charcoal">{commitment.fund?.name}</p>
                        <p className="text-sm text-aifm-charcoal/40 mt-1">Signerat: {formatDate(commitment.signedAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-aifm-charcoal">{formatCurrency(commitment.committedAmount, commitment.fund?.currency || 'SEK')}</p>
                        <p className="text-sm text-aifm-charcoal/40">{formatPercentage(commitment.ownershipPercentage)} ägande</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { icon: Eye, label: 'Visa dokument' },
                { icon: FileText, label: 'Generera utdrag' },
                { icon: Mail, label: 'Skicka meddelande' },
              ].map((action) => (
                <button 
                  key={action.label}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                             bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                             hover:text-aifm-charcoal transition-all duration-300"
                >
                  <action.icon className="w-4 h-4" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestorsPage() {
  const { selectedCompany } = useCompany();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'approved' | 'pending' | 'flagged'>('all');
  const [expandedInvestorId, setExpandedInvestorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const companyInvestors = getInvestorsByCompanyId(selectedCompany.id);

  const filteredInvestors = companyInvestors.filter(investor => {
    const matchesSearch = investor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         investor.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'approved') return matchesSearch && investor.kycStatus === 'APPROVED';
    if (selectedFilter === 'pending') return matchesSearch && (investor.kycStatus === 'PENDING' || investor.kycStatus === 'IN_PROGRESS');
    if (selectedFilter === 'flagged') return matchesSearch && (investor.amlStatus === 'FLAGGED' || investor.riskRating === 'HIGH');
    return matchesSearch;
  });

  const stats = {
    total: companyInvestors.length,
    approved: companyInvestors.filter(i => i.kycStatus === 'APPROVED').length,
    pending: companyInvestors.filter(i => i.kycStatus === 'PENDING' || i.kycStatus === 'IN_PROGRESS').length,
    flagged: companyInvestors.filter(i => i.amlStatus === 'FLAGGED' || i.riskRating === 'HIGH').length,
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Investerare</h1>
          <p className="text-aifm-charcoal/40 mt-2">Hantera investerare, KYC/AML-efterlevnad och åtaganden</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                             bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                             hover:text-aifm-charcoal transition-all duration-300">
            <Download className="w-4 h-4" />
            Exportera
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                             bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                             shadow-lg shadow-aifm-charcoal/20 transition-all duration-300">
            <Plus className="w-4 h-4" />
            Lägg till investerare
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <FilterTab 
          label="Totalt antal" 
          count={stats.total} 
          isActive={selectedFilter === 'all'} 
          variant="default"
          icon={Users}
          onClick={() => setSelectedFilter('all')} 
        />
        <FilterTab 
          label="KYC godkänd" 
          count={stats.approved} 
          isActive={selectedFilter === 'approved'} 
          variant="success"
          icon={CheckCircle2}
          onClick={() => setSelectedFilter('approved')} 
        />
        <FilterTab 
          label="Väntar granskning" 
          count={stats.pending} 
          isActive={selectedFilter === 'pending'} 
          variant="warning"
          icon={Clock}
          onClick={() => setSelectedFilter('pending')} 
        />
        <FilterTab 
          label="Flaggade" 
          count={stats.flagged} 
          isActive={selectedFilter === 'flagged'} 
          variant="danger"
          icon={AlertTriangle}
          onClick={() => setSelectedFilter('flagged')} 
        />
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Sök investerare..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3 pl-11 pr-4 bg-white border border-gray-200 rounded-xl text-sm
                       placeholder:text-aifm-charcoal/30 focus:outline-none focus:border-aifm-gold/30 
                       focus:ring-2 focus:ring-aifm-gold/10 transition-all duration-300"
          />
        </div>
      </div>

      {/* Investors List */}
      <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
        <div className="divide-y divide-gray-100/50">
          {filteredInvestors.map((investor) => (
            <InvestorRow 
              key={investor.id}
              investor={investor}
              isExpanded={expandedInvestorId === investor.id}
              onToggle={() => setExpandedInvestorId(expandedInvestorId === investor.id ? null : investor.id)}
              commitments={getCommitmentsByInvestor(investor.id)}
            />
          ))}
        </div>

        {filteredInvestors.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-aifm-charcoal/20" />
            </div>
            <p className="text-aifm-charcoal/50 font-medium">Inga investerare hittades</p>
            <p className="text-sm text-aifm-charcoal/30 mt-1">Försök med andra sökkriterier</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
