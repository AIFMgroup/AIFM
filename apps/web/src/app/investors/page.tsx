'use client';

import { useState } from 'react';
import { 
  Users, Shield, CheckCircle2, AlertCircle, Clock,
  Download, Search, Plus, Eye, Mail, Phone, Globe, Building2, User,
  FileText, AlertTriangle, XCircle, TrendingUp, Home
} from 'lucide-react';
import {
  getInvestorsByCompanyId, getCommitmentsByInvestor,
  formatCurrency, formatPercentage, formatDate, Investor
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Tab Button Component
function TabButton({ 
  label, 
  isActive, 
  onClick,
  count
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
        isActive
          ? 'bg-white text-aifm-charcoal shadow-sm'
          : 'text-white/70 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`ml-2 ${isActive ? 'text-aifm-charcoal/50' : 'text-white/50'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Hero Metric Card
function HeroMetric({ 
  label, 
  value, 
  subValue,
  icon: Icon
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white/10 rounded-lg">
          <Icon className="w-4 h-4 text-white/70" />
        </div>
        <p className="text-xs text-white/50 uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {subValue && <p className="text-sm text-white/60 mt-1">{subValue}</p>}
    </div>
  );
}

// Investor Row Component
function InvestorRow({ 
  investor, 
  isSelected,
  onSelect
}: { 
  investor: Investor;
  isSelected: boolean;
  onSelect: () => void;
}) {
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
      transition-all duration-300 cursor-pointer
      ${isSelected ? 'bg-aifm-gold/5 border-l-2 border-aifm-gold' : 'hover:bg-gray-50/50 border-l-2 border-transparent'}
    `} onClick={onSelect}>
      <div className="p-4 lg:p-5">
        <div className="flex items-center gap-4">
          {/* Investor Info */}
          <div className={`
            w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center transition-all duration-300
            ${isSelected ? 'bg-aifm-gold/10' : 'bg-aifm-charcoal/5'}
          `}>
            <InvestorIcon className={`w-5 h-5 lg:w-6 lg:h-6 transition-colors duration-300 ${
              isSelected ? 'text-aifm-gold' : 'text-aifm-charcoal/50'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-aifm-charcoal text-sm lg:text-base truncate">{investor.name}</h3>
              {investor.pepStatus && (
                <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-purple-100 text-purple-700 uppercase hidden sm:inline">PEP</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs lg:text-sm text-aifm-charcoal/50 truncate">{investor.type.replace(/_/g, ' ')}</span>
              <span className="text-aifm-charcoal/20 hidden sm:inline">•</span>
              <span className="text-xs lg:text-sm text-aifm-charcoal/50 hidden sm:flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {investor.country}
              </span>
            </div>
          </div>

          {/* Status Badge - Mobile only shows icon */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${kycStyles.bg} ${kycStyles.text}`}>
              <KYCIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{investor.kycStatus.replace(/_/g, ' ')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Investor Detail Panel
function InvestorDetailPanel({ 
  investor, 
  commitments,
  onClose
}: { 
  investor: Investor;
  commitments: ReturnType<typeof getCommitmentsByInvestor>;
  onClose: () => void;
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

  const kycStyles = getKYCStatusStyles(investor.kycStatus);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90">
        <div className="flex items-start justify-between mb-4">
          <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-white" />
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-white/60 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <h2 className="text-xl font-semibold text-white mb-1">{investor.name}</h2>
        <p className="text-white/60 text-sm">{investor.type.replace(/_/g, ' ')}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${kycStyles.bg} ${kycStyles.text}`}>
            {investor.kycStatus.replace(/_/g, ' ')}
          </span>
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getRiskStyles(investor.riskRating)}`}>
            {investor.riskRating === 'LOW' ? 'Låg risk' : investor.riskRating === 'MEDIUM' ? 'Medel risk' : 'Hög risk'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Totalt åtagande</p>
            <p className="text-xl font-semibold text-aifm-charcoal">{formatCurrency(totalCommitted, 'SEK')}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Antal fonder</p>
            <p className="text-xl font-semibold text-aifm-charcoal">{commitments.length}</p>
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Kontaktinformation</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Mail className="w-4 h-4 text-aifm-charcoal/40" />
              <a href={`mailto:${investor.email}`} className="text-sm text-aifm-gold hover:underline">
                {investor.email}
              </a>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Phone className="w-4 h-4 text-aifm-charcoal/40" />
              <span className="text-sm text-aifm-charcoal">{investor.phone}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <Globe className="w-4 h-4 text-aifm-charcoal/40" />
              <span className="text-sm text-aifm-charcoal">{investor.country}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <FileText className="w-4 h-4 text-aifm-charcoal/40" />
              <span className="text-sm text-aifm-charcoal">Tax ID: {investor.taxId}</span>
            </div>
          </div>
        </div>

        {/* Compliance Status */}
        <div>
          <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Efterlevnadsstatus</h4>
          <div className="space-y-3">
            {[
              { 
                label: 'AML-screening', 
                value: investor.amlStatus === 'CLEAR' ? 'Godkänd' : investor.amlStatus === 'FLAGGED' ? 'Flaggad' : 'Granskas',
                status: investor.amlStatus === 'CLEAR' ? 'success' : investor.amlStatus === 'FLAGGED' ? 'error' : 'warning'
              },
              { 
                label: 'PEP-status', 
                value: investor.pepStatus ? 'Ja' : 'Nej',
                status: investor.pepStatus ? 'warning' : 'success'
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-aifm-charcoal/70">{item.label}</span>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  item.status === 'success' ? 'bg-emerald-50 text-emerald-600' :
                  item.status === 'error' ? 'bg-red-50 text-red-600' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Commitments */}
        {commitments.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Fondåtaganden</h4>
            <div className="space-y-3">
              {commitments.map((commitment) => (
                <div key={commitment.id} className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-aifm-charcoal text-sm">{commitment.fund?.name}</p>
                    <p className="font-semibold text-aifm-charcoal">{formatCurrency(commitment.committedAmount, commitment.fund?.currency || 'SEK')}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-aifm-charcoal/50">
                    <span>Signerat: {formatDate(commitment.signedAt)}</span>
                    <span>{formatPercentage(commitment.ownershipPercentage)} ägande</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                           bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
          <Eye className="w-4 h-4" />
          Dokument
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white 
                           bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all">
          <Mail className="w-4 h-4" />
          Kontakta
        </button>
      </div>
    </div>
  );
}

export default function InvestorsPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'all' | 'approved' | 'pending' | 'flagged'>('all');
  const [selectedInvestorId, setSelectedInvestorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const companyInvestors = getInvestorsByCompanyId(selectedCompany.id);

  const filteredInvestors = companyInvestors.filter(investor => {
    const matchesSearch = investor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         investor.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'approved') return matchesSearch && investor.kycStatus === 'APPROVED';
    if (activeTab === 'pending') return matchesSearch && (investor.kycStatus === 'PENDING' || investor.kycStatus === 'IN_PROGRESS');
    if (activeTab === 'flagged') return matchesSearch && (investor.amlStatus === 'FLAGGED' || investor.riskRating === 'HIGH');
    return matchesSearch;
  });

  const selectedInvestor = selectedInvestorId 
    ? companyInvestors.find(i => i.id === selectedInvestorId) 
    : null;

  const stats = {
    total: companyInvestors.length,
    approved: companyInvestors.filter(i => i.kycStatus === 'APPROVED').length,
    pending: companyInvestors.filter(i => i.kycStatus === 'PENDING' || i.kycStatus === 'IN_PROGRESS').length,
    flagged: companyInvestors.filter(i => i.amlStatus === 'FLAGGED' || i.riskRating === 'HIGH').length,
    totalCommitted: companyInvestors.reduce((sum, inv) => {
      const commitments = getCommitmentsByInvestor(inv.id);
      return sum + commitments.reduce((s, c) => s + c.committedAmount, 0);
    }, 0),
  };

  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 px-4 sm:px-6 pt-6 pb-6 mb-8 rounded-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Home className="w-4 h-4" />
          <span>/</span>
          <span>Kapital</span>
          <span>/</span>
          <span className="text-white">Investerare</span>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight mb-2">
              Investerare
            </h1>
            <p className="text-white/50 text-sm lg:text-base">
              Hantera investerare och KYC/AML för {selectedCompany.shortName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white/70 
                               bg-white/10 border border-white/10 rounded-xl hover:bg-white/20 transition-all">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportera</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal 
                               bg-white rounded-xl hover:bg-gray-100 shadow-lg transition-all">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ny investerare</span>
            </button>
          </div>
        </div>

        {/* Hero Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <HeroMetric 
            label="Totalt antal"
            value={stats.total.toString()}
            icon={Users}
          />
          <HeroMetric 
            label="Totalt åtagande"
            value={formatCurrency(stats.totalCommitted, 'SEK')}
            icon={TrendingUp}
          />
          <HeroMetric 
            label="KYC godkänd"
            value={`${Math.round((stats.approved / stats.total) * 100)}%`}
            subValue={`${stats.approved} av ${stats.total}`}
            icon={CheckCircle2}
          />
          <HeroMetric 
            label="Kräver åtgärd"
            value={stats.flagged.toString()}
            subValue={stats.flagged > 0 ? 'Flaggade investerare' : 'Allt i ordning'}
            icon={AlertTriangle}
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1.5 w-fit">
          <TabButton 
            label="Alla" 
            isActive={activeTab === 'all'} 
            onClick={() => setActiveTab('all')}
            count={stats.total}
          />
          <TabButton 
            label="Godkända" 
            isActive={activeTab === 'approved'} 
            onClick={() => setActiveTab('approved')}
            count={stats.approved}
          />
          <TabButton 
            label="Väntar" 
            isActive={activeTab === 'pending'} 
            onClick={() => setActiveTab('pending')}
            count={stats.pending}
          />
          <TabButton 
            label="Flaggade" 
            isActive={activeTab === 'flagged'} 
            onClick={() => setActiveTab('flagged')}
            count={stats.flagged}
          />
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
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

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Investor List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {filteredInvestors.map((investor) => (
                <InvestorRow 
                  key={investor.id}
                  investor={investor}
                  isSelected={selectedInvestorId === investor.id}
                  onSelect={() => setSelectedInvestorId(investor.id)}
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
        </div>

        {/* Detail Panel */}
        <div className="hidden lg:block">
          {selectedInvestor ? (
            <InvestorDetailPanel 
              investor={selectedInvestor}
              commitments={getCommitmentsByInvestor(selectedInvestor.id)}
              onClose={() => setSelectedInvestorId(null)}
            />
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center h-full flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-aifm-charcoal/50 font-medium">Välj en investerare</p>
              <p className="text-sm text-aifm-charcoal/30 mt-1">Klicka på en investerare för att se detaljer</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Detail Modal */}
      {selectedInvestor && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
            <InvestorDetailPanel 
              investor={selectedInvestor}
              commitments={getCommitmentsByInvestor(selectedInvestor.id)}
              onClose={() => setSelectedInvestorId(null)}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
