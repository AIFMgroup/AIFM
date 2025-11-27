'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowDownRight, Plus, CheckCircle2,
  Users, DollarSign, FileText,
  Check, X, Shield, Eye, Download, BookOpen
} from 'lucide-react';
import {
  getFundByCompanyId, getDistributionsByCompanyId, getCommitmentsByFund,
  formatCurrency, formatDate, Distribution
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { CustomSelect } from '@/components/CustomSelect';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

export default function DistributionsPage() {
  const { selectedCompany } = useCompany();
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(null);
  const [showNewDistModal, setShowNewDistModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [newDistAmount, setNewDistAmount] = useState('');
  const [newDistType, setNewDistType] = useState<Distribution['type']>('PROFIT_DISTRIBUTION');

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const fundDists = getDistributionsByCompanyId(selectedCompany.id);
  const commitments = selectedFund ? getCommitmentsByFund(selectedFund.id) : [];
  const currency = selectedFund?.currency || 'SEK';
  
  // Calculate totals
  const totalDistributed = commitments.reduce((sum, c) => sum + c.distributedAmount, 0);

  const getStatusColor = (status: Distribution['status']) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-700';
      case 'APPROVED': return 'bg-blue-100 text-blue-700';
      case 'DRAFT': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: Distribution['type']) => {
    switch (type) {
      case 'DIVIDEND': return 'Utdelning';
      case 'RETURN_OF_CAPITAL': return 'Kapitalåterbäring';
      case 'PROFIT_DISTRIBUTION': return 'Vinstutdelning';
      default: return type;
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Utdelningar</h1>
            <HelpTooltip 
              {...helpContent.distributions}
              learnMoreLink="/guide#distributions"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">Hantera fondutdelningar med 4-ögon godkännande</p>
            <Link href="/guide#distributions" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNewDistModal(true)}
            className="btn-primary py-2 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ny utdelning
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Totalt utdelat</span>
            <ArrowDownRight className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(totalDistributed, currency)}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">DPI</span>
            <DollarSign className="w-5 h-5 text-aifm-charcoal/30" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{(selectedFund?.dpi || 0).toFixed(2)}x</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Utdelningar</span>
            <FileText className="w-5 h-5 text-aifm-charcoal/30" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{fundDists.length}</p>
        </div>

        <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">Väntar på godkännande</span>
            <Shield className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-2xl font-medium">{fundDists.filter(d => d.status === 'APPROVED').length}</p>
        </div>
      </div>

      {/* 4-Eyes Approval Notice */}
      <div className="bg-aifm-gold/10 border border-aifm-gold/30 rounded-2xl p-4 mb-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-aifm-gold/20 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-aifm-gold" />
        </div>
        <div>
          <p className="font-medium text-aifm-charcoal">4-ögonprincipen aktiv</p>
          <p className="text-sm text-aifm-charcoal/60">Alla utdelningar kräver godkännande från två behöriga användare före verkställande</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Distributions List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Utdelningar</h3>
            <span className="text-xs text-aifm-charcoal/50">{fundDists.length} totalt</span>
          </div>
          <div className="divide-y divide-gray-50">
            {fundDists.length === 0 ? (
              <div className="p-8 text-center">
                <ArrowDownRight className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                <p className="text-aifm-charcoal/60">Inga utdelningar ännu</p>
                <button 
                  onClick={() => setShowNewDistModal(true)}
                  className="btn-primary mt-4 py-2 px-4"
                >
                  Skapa första utdelning
                </button>
              </div>
            ) : (
              fundDists.map((dist) => (
                <div
                  key={dist.id}
                  onClick={() => setSelectedDistribution(dist)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedDistribution?.id === dist.id ? 'bg-aifm-gold/5' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-700 font-medium">#{dist.distributionNumber}</span>
                      </div>
                      <div>
                        <p className="font-medium text-aifm-charcoal">{formatCurrency(dist.totalAmount, currency)}</p>
                        <p className="text-xs text-aifm-charcoal/50">{formatDate(dist.distributionDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(dist.status)}`}>
                        {dist.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {getTypeLabel(dist.type)}
                    </span>
                    <span className="text-xs text-aifm-charcoal/50">
                      {dist.items.length} investerare
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selected Distribution Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {selectedDistribution ? (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">
                    Distribution #{selectedDistribution.distributionNumber}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedDistribution.status)}`}>
                    {selectedDistribution.status}
                  </span>
                </div>
              </div>
              
              <div className="p-6 border-b border-gray-100">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Datum</p>
                    <p className="font-medium text-aifm-charcoal">{formatDate(selectedDistribution.distributionDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Typ</p>
                    <p className="font-medium text-aifm-charcoal">{getTypeLabel(selectedDistribution.type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Totalt belopp</p>
                    <p className="font-medium text-green-600">{formatCurrency(selectedDistribution.totalAmount, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Investerare</p>
                    <p className="font-medium text-aifm-charcoal">{selectedDistribution.items.length}</p>
                  </div>
                </div>
              </div>

              {/* Investor Breakdown */}
              <div className="px-6 py-4 border-b border-gray-100">
                <h4 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-3">Utdelningsfördelning</h4>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {selectedDistribution.items.map((item) => {
                  const investor = commitments.find(c => c.investorId === item.investorId)?.investor;
                  return (
                    <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-aifm-gold/10 rounded-lg flex items-center justify-center">
                          <Users className="w-4 h-4 text-aifm-gold" />
                        </div>
                        <p className="font-medium text-aifm-charcoal text-sm">{investor?.name || 'Okänd'}</p>
                      </div>
                      <p className="font-medium text-green-600 text-sm">{formatCurrency(item.amount, currency)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Approval Section */}
              {selectedDistribution.status === 'APPROVED' && (
                <div className="p-6 bg-amber-50 border-t border-amber-100">
                  <div className="flex items-center gap-3 mb-4">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Väntar på andra godkännande</p>
                      <p className="text-sm text-amber-700">Ett godkännande mottaget. Kräver ytterligare ett för att verkställa.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowApprovalModal(true)}
                    className="w-full btn-primary py-2 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Godkänn & verkställ
                  </button>
                </div>
              )}

              {selectedDistribution.status === 'PAID' && (
                <div className="p-6 bg-green-50 border-t border-green-100">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Utdelning slutförd</p>
                      <p className="text-sm text-green-700">Alla betalningar har genomförts framgångsrikt.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-6 bg-gray-50">
                <div className="flex gap-3">
                  <button className="flex-1 btn-outline py-2 flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    Visa detaljer
                  </button>
                  <button className="flex-1 btn-outline py-2 flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Exportera
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
              <p className="text-aifm-charcoal/60">Välj en utdelning för att se detaljer</p>
            </div>
          )}
        </div>
      </div>

      {/* New Distribution Modal */}
      {showNewDistModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Ny utdelning</h3>
              <button 
                onClick={() => setShowNewDistModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-aifm-charcoal/60" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Fond
                </label>
                <p className="font-medium text-aifm-charcoal">{selectedFund?.name || selectedCompany.shortName}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Utdelningstyp
                </label>
                <CustomSelect
                  options={[
                    { value: 'PROFIT_DISTRIBUTION', label: 'Vinstutdelning' },
                    { value: 'RETURN_OF_CAPITAL', label: 'Kapitalåterbäring' },
                    { value: 'DIVIDEND', label: 'Utdelning' },
                  ]}
                  value={newDistType}
                  onChange={(value) => setNewDistType(value as Distribution['type'])}
                  className="w-full"
                  variant="default"
                  size="md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Totalt belopp ({currency})
                </label>
                <input
                  type="number"
                  value={newDistAmount}
                  onChange={(e) => setNewDistAmount(e.target.value)}
                  className="input w-full"
                  placeholder="Ange belopp"
                />
              </div>
              <div className="bg-aifm-gold/5 rounded-xl p-4">
                <p className="text-sm font-medium text-aifm-charcoal mb-2">Utdelningsförhandsgranskning</p>
                <div className="space-y-2 text-sm">
                  {commitments.slice(0, 3).map((commitment) => {
                    const allocation = newDistAmount ? 
                      (parseFloat(newDistAmount) * commitment.ownershipPercentage / 100) : 0;
                    return (
                      <div key={commitment.id} className="flex justify-between">
                        <span className="text-aifm-charcoal/60">{commitment.investor?.name}</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(allocation, currency)}
                        </span>
                      </div>
                    );
                  })}
                  {commitments.length > 3 && (
                    <p className="text-xs text-aifm-charcoal/50">+ {commitments.length - 3} fler investerare</p>
                  )}
                </div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">4-ögon krävs</p>
                  <p className="text-xs text-amber-700">Denna utdelning kräver godkännande från en annan behörig användare före verkställande.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowNewDistModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Avbryt
              </button>
              <button 
                onClick={() => {
                  alert('Utdelning skapad! Väntar på andra godkännande. (Demo)');
                  setShowNewDistModal(false);
                  setNewDistAmount('');
                }}
                className="flex-1 btn-primary py-2"
              >
                Skapa utdelning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Bekräfta godkännande</h3>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-aifm-charcoal">Andra godkännande krävs</p>
                  <p className="text-sm text-aifm-charcoal/60">Du håller på att godkänna denna utdelning</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-aifm-charcoal/60">Belopp</span>
                  <span className="font-medium text-aifm-charcoal">
                    {selectedDistribution && formatCurrency(selectedDistribution.totalAmount, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-aifm-charcoal/60">Investerare</span>
                  <span className="font-medium text-aifm-charcoal">{selectedDistribution?.items.length}</span>
                </div>
              </div>
              <p className="text-sm text-aifm-charcoal/60 mb-4">
                Genom att godkänna bekräftar du att du har granskat denna utdelning och godkänner dess verkställande.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Avbryt
              </button>
              <button 
                onClick={() => {
                  alert('Utdelning godkänd och verkställd! (Demo)');
                  setShowApprovalModal(false);
                }}
                className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Godkänn
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
