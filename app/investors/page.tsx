'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import { 
  Users, Shield, CheckCircle2, AlertCircle, Clock,
  Download, Search, Plus, Eye, Mail, Phone, Globe, Building2, User,
  FileText, AlertTriangle, XCircle, TrendingUp
} from 'lucide-react';
import {
  getInvestorsByCompanyId, getCommitmentsByInvestor,
  formatCurrency, formatPercentage, formatDate, Investor
} from '@/lib/fundData';

import { useCompany } from '@/components/CompanyContext';
import { PageHeader, PrimaryButton, SecondaryButton } from '@/components/shared/PageHeader';

type IconComponent = ComponentType<{ className?: string }>;

const KYC_STATUS_STYLES: Record<string, { bg: string; text: string; icon: IconComponent }> = {
  APPROVED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: CheckCircle2 },
  PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: Clock },
  IN_PROGRESS: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Clock },
  REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400', icon: XCircle },
  EXPIRED: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle },
  DEFAULT: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: Clock },
};

const INVESTOR_ICON_BY_TYPE: Record<string, IconComponent> = {
  INDIVIDUAL: User,
  INSTITUTION: Building2,
  FAMILY_OFFICE: Users,
  PENSION_FUND: Shield,
  ENDOWMENT: Building2,
};

function getKYCStatusStyles(status: string) {
  return KYC_STATUS_STYLES[status] || KYC_STATUS_STYLES.DEFAULT;
}

function getInvestorIcon(type: string) {
  return INVESTOR_ICON_BY_TYPE[type] || User;
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

          {/* KYC Status */}
          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full ${kycStyles.bg}`}>
            <KYCIcon className={`w-3.5 h-3.5 ${kycStyles.text}`} />
            <span className={`text-xs font-medium ${kycStyles.text}`}>
              {investor.kycStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Selected Investor Detail Panel
function InvestorDetail({ investor }: { investor: Investor }) {
  const kycStyles = getKYCStatusStyles(investor.kycStatus);
  const KYCIcon = kycStyles.icon;
  const commitments = getCommitmentsByInvestor(investor.id);

  const detailItems = [
    { label: 'Email', value: investor.email, icon: Mail },
    { label: 'Telefon', value: investor.phone, icon: Phone },
    { label: 'Land', value: investor.country, icon: Globe },
    { label: 'Typ', value: investor.type.replace(/_/g, ' '), icon: Building2 },
  ];

  const kycDetails = [
    { label: 'KYC Status', value: investor.kycStatus.replace(/_/g, ' '), status: investor.kycStatus === 'APPROVED' ? 'success' : investor.kycStatus === 'REJECTED' ? 'error' : 'pending' },
    { label: 'AML Status', value: investor.amlStatus || 'N/A', status: investor.amlStatus === 'CLEAR' ? 'success' : investor.amlStatus === 'FLAGGED' ? 'error' : 'pending' },
    { label: 'Risknivå', value: investor.riskRating || 'N/A', status: investor.riskRating === 'LOW' ? 'success' : investor.riskRating === 'HIGH' ? 'error' : 'pending' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 h-fit sticky top-4">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-aifm-charcoal">{investor.name}</h2>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${kycStyles.bg}`}>
            <KYCIcon className={`w-3.5 h-3.5 ${kycStyles.text}`} />
            <span className={`text-xs font-medium ${kycStyles.text}`}>{investor.kycStatus.replace(/_/g, ' ')}</span>
          </div>
        </div>
        {investor.pepStatus && (
          <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-purple-700 font-medium">Politiskt exponerad person (PEP)</span>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="p-5 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Kontaktinformation</h4>
          <div className="space-y-3">
            {detailItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-aifm-charcoal/5 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-aifm-charcoal/50" />
                </div>
                <div>
                  <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm text-aifm-charcoal">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KYC/AML Details */}
        <div>
          <h4 className="text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider mb-4">Compliance Status</h4>
          <div className="space-y-2">
            {kycDetails.map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
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
  const [activeTab, setActiveTab] = useState('all');
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

  const kycPercentage = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Investerare"
        description={`Hantera investerare och KYC/AML för ${selectedCompany.shortName}`}
        breadcrumbs={[
          { label: 'Kapital' },
          { label: 'Investerare' }
        ]}
        stats={[
          { 
            label: 'Totalt antal', 
            value: stats.total.toString(), 
            icon: Users 
          },
          { 
            label: 'Totalt åtagande', 
            value: formatCurrency(stats.totalCommitted, 'SEK'), 
            icon: TrendingUp 
          },
          { 
            label: 'KYC godkänd', 
            value: `${kycPercentage}%`, 
            subValue: `${stats.approved} av ${stats.total}`,
            icon: CheckCircle2 
          },
          { 
            label: 'Kräver åtgärd', 
            value: stats.flagged.toString(), 
            subValue: stats.flagged > 0 ? 'Flaggade investerare' : 'Allt i ordning',
            icon: AlertTriangle 
          },
        ]}
        tabs={{
          items: [
            { id: 'all', label: 'Alla', count: stats.total },
            { id: 'approved', label: 'Godkända', count: stats.approved },
            { id: 'pending', label: 'Väntar', count: stats.pending },
            { id: 'flagged', label: 'Flaggade', count: stats.flagged },
          ],
          activeId: activeTab,
          onChange: setActiveTab
        }}
        actions={
          <>
            <SecondaryButton icon={Download}>
              <span className="hidden sm:inline">Exportera</span>
            </SecondaryButton>
            <PrimaryButton icon={Plus}>
              <span className="hidden sm:inline">Ny investerare</span>
            </PrimaryButton>
          </>
        }
      />

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
                  onSelect={() => setSelectedInvestorId(
                    selectedInvestorId === investor.id ? null : investor.id
                  )}
                />
              ))}
            </div>
            {filteredInvestors.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-aifm-charcoal/5 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-aifm-charcoal/30" />
                </div>
                <p className="text-aifm-charcoal/50 text-sm">Inga investerare hittades</p>
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedInvestor ? (
            <InvestorDetail investor={selectedInvestor} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center h-fit">
              <div className="w-16 h-16 rounded-full bg-aifm-charcoal/5 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-aifm-charcoal/30" />
              </div>
              <p className="text-aifm-charcoal/50 text-sm">Välj en investerare för att se detaljer</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
