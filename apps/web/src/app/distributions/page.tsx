'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowDownRight, Plus, CheckCircle2,
  Users, DollarSign, FileText,
  Check, X, Shield, Eye, Download, BookOpen
} from 'lucide-react';
import {
  mockFunds, mockDistributions, getCommitmentsByFund,
  formatCurrency, formatDate, Fund, Distribution
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';

export default function DistributionsPage() {
  const [selectedFund, setSelectedFund] = useState<Fund>(mockFunds[0]);
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(null);
  const [showNewDistModal, setShowNewDistModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [newDistAmount, setNewDistAmount] = useState('');
  const [newDistType, setNewDistType] = useState<Distribution['type']>('PROFIT_DISTRIBUTION');

  const fundDists = mockDistributions.filter(d => d.fundId === selectedFund.id);
  const commitments = getCommitmentsByFund(selectedFund.id);
  
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
                <Link href="/fund" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Fonder</Link>
                <Link href="/capital-calls" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Kapitalanrop</Link>
                <Link href="/distributions" className="text-sm font-medium text-aifm-gold uppercase tracking-wider">Utdelningar</Link>
                <Link href="/investors" className="text-sm font-medium text-aifm-charcoal/60 hover:text-aifm-gold uppercase tracking-wider">Investerare</Link>
              </nav>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="heading-2">Utdelningar</h1>
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
          
          <select
            value={selectedFund.id}
            onChange={(e) => {
              const fund = mockFunds.find(f => f.id === e.target.value);
              if (fund) {
                setSelectedFund(fund);
                setSelectedDistribution(null);
              }
            }}
            className="input py-2 px-4 pr-10 min-w-[250px]"
          >
            {mockFunds.map((fund) => (
              <option key={fund.id} value={fund.id}>{fund.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Total Distributed</span>
              <ArrowDownRight className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(totalDistributed, selectedFund.currency)}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">DPI</span>
              <DollarSign className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal">{selectedFund.dpi.toFixed(2)}x</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Distributions</span>
              <FileText className="w-5 h-5 text-aifm-charcoal/30" />
            </div>
            <p className="text-2xl font-medium text-aifm-charcoal">{fundDists.length}</p>
          </div>

          <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-white/70">Pending Approval</span>
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
            <p className="font-medium text-aifm-charcoal">4-Eyes Principle Active</p>
            <p className="text-sm text-aifm-charcoal/60">All distributions require approval from two authorized users before execution</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Distributions List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Distributions</h3>
              <span className="text-xs text-aifm-charcoal/50">{fundDists.length} total</span>
            </div>
            <div className="divide-y divide-gray-50">
              {fundDists.length === 0 ? (
                <div className="p-8 text-center">
                  <ArrowDownRight className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                  <p className="text-aifm-charcoal/60">No distributions yet</p>
                  <button 
                    onClick={() => setShowNewDistModal(true)}
                    className="btn-primary mt-4 py-2 px-4"
                  >
                    Create First Distribution
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
                          <p className="font-medium text-aifm-charcoal">{formatCurrency(dist.totalAmount, selectedFund.currency)}</p>
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
                        {dist.items.length} investors
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
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Date</p>
                      <p className="font-medium text-aifm-charcoal">{formatDate(selectedDistribution.distributionDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Type</p>
                      <p className="font-medium text-aifm-charcoal">{getTypeLabel(selectedDistribution.type)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Total Amount</p>
                      <p className="font-medium text-green-600">{formatCurrency(selectedDistribution.totalAmount, selectedFund.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Investors</p>
                      <p className="font-medium text-aifm-charcoal">{selectedDistribution.items.length}</p>
                    </div>
                  </div>
                </div>

                {/* Investor Breakdown */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <h4 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-3">Distribution Breakdown</h4>
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
                          <p className="font-medium text-aifm-charcoal text-sm">{investor?.name || 'Unknown'}</p>
                        </div>
                        <p className="font-medium text-green-600 text-sm">{formatCurrency(item.amount, selectedFund.currency)}</p>
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
                        <p className="font-medium text-amber-800">Awaiting Second Approval</p>
                        <p className="text-sm text-amber-700">One approval received. Requires one more to execute.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowApprovalModal(true)}
                      className="w-full btn-primary py-2 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Approve & Execute
                    </button>
                  </div>
                )}

                {selectedDistribution.status === 'PAID' && (
                  <div className="p-6 bg-green-50 border-t border-green-100">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Distribution Completed</p>
                        <p className="text-sm text-green-700">All payments have been executed successfully.</p>
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
                      Export
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
      </main>

      {/* New Distribution Modal */}
      {showNewDistModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">New Distribution</h3>
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
                  Fund
                </label>
                <p className="font-medium text-aifm-charcoal">{selectedFund.name}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Distribution Type
                </label>
                <select
                  value={newDistType}
                  onChange={(e) => setNewDistType(e.target.value as Distribution['type'])}
                  className="input w-full"
                >
                  <option value="PROFIT_DISTRIBUTION">Profit Distribution</option>
                  <option value="RETURN_OF_CAPITAL">Return of Capital</option>
                  <option value="DIVIDEND">Dividend</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Total Amount ({selectedFund.currency})
                </label>
                <input
                  type="number"
                  value={newDistAmount}
                  onChange={(e) => setNewDistAmount(e.target.value)}
                  className="input w-full"
                  placeholder="Enter amount"
                />
              </div>
              <div className="bg-aifm-gold/5 rounded-xl p-4">
                <p className="text-sm font-medium text-aifm-charcoal mb-2">Distribution Preview</p>
                <div className="space-y-2 text-sm">
                  {commitments.slice(0, 3).map((commitment) => {
                    const allocation = newDistAmount ? 
                      (parseFloat(newDistAmount) * commitment.ownershipPercentage / 100) : 0;
                    return (
                      <div key={commitment.id} className="flex justify-between">
                        <span className="text-aifm-charcoal/60">{commitment.investor?.name}</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(allocation, selectedFund.currency)}
                        </span>
                      </div>
                    );
                  })}
                  {commitments.length > 3 && (
                    <p className="text-xs text-aifm-charcoal/50">+ {commitments.length - 3} more investors</p>
                  )}
                </div>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">4-Eyes Required</p>
                  <p className="text-xs text-amber-700">This distribution will require approval from another authorized user before execution.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowNewDistModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert('Distribution created! Awaiting second approval. (Demo)');
                  setShowNewDistModal(false);
                  setNewDistAmount('');
                }}
                className="flex-1 btn-primary py-2"
              >
                Create Distribution
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
                  <p className="font-medium text-aifm-charcoal">Second Approval Required</p>
                  <p className="text-sm text-aifm-charcoal/60">You are about to approve this distribution</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-aifm-charcoal/60">Amount</span>
                  <span className="font-medium text-aifm-charcoal">
                    {selectedDistribution && formatCurrency(selectedDistribution.totalAmount, selectedFund.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-aifm-charcoal/60">Investors</span>
                  <span className="font-medium text-aifm-charcoal">{selectedDistribution?.items.length}</span>
                </div>
              </div>
              <p className="text-sm text-aifm-charcoal/60 mb-4">
                By approving, you confirm that you have reviewed this distribution and authorize its execution.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowApprovalModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  alert('Distribution approved and executed! (Demo)');
                  setShowApprovalModal(false);
                }}
                className="flex-1 btn-primary py-2 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

