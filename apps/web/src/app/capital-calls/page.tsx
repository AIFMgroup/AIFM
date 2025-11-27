'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowUpRight, Plus, CheckCircle2, Clock,
  Send, Download, DollarSign, FileText, Bell, X, BookOpen
} from 'lucide-react';
import {
  getFundByCompanyId, getCapitalCallsByCompanyId, getCommitmentsByFund,
  formatCurrency, formatDate, formatPercentage, CapitalCall
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

export default function CapitalCallsPage() {
  const { selectedCompany } = useCompany();
  const [selectedCall, setSelectedCall] = useState<CapitalCall | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [newCallAmount, setNewCallAmount] = useState('');
  const [newCallPurpose, setNewCallPurpose] = useState('');

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const fundCalls = getCapitalCallsByCompanyId(selectedCompany.id);
  const commitments = selectedFund ? getCommitmentsByFund(selectedFund.id) : [];
  const currency = selectedFund?.currency || 'SEK';
  const fundName = selectedFund?.name || selectedCompany.shortName;
  
  // Calculate totals
  const totalCommitted = commitments.reduce((sum, c) => sum + c.committedAmount, 0);
  const totalCalled = commitments.reduce((sum, c) => sum + c.calledAmount, 0);
  const remainingToCall = totalCommitted - totalCalled;
  const callPercentage = (totalCalled / totalCommitted) * 100;

  const getStatusColor = (status: CapitalCall['status']) => {
    switch (status) {
      case 'FULLY_PAID': return 'bg-green-100 text-green-700';
      case 'PARTIALLY_PAID': return 'bg-blue-100 text-blue-700';
      case 'SENT': return 'bg-amber-100 text-amber-700';
      case 'DRAFT': return 'bg-gray-100 text-gray-700';
      case 'OVERDUE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: CapitalCall['status']) => {
    switch (status) {
      case 'FULLY_PAID': return 'Betald';
      case 'PARTIALLY_PAID': return 'Delvis betald';
      case 'SENT': return 'Skickad';
      case 'DRAFT': return 'Utkast';
      case 'OVERDUE': return 'Förfallen';
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Kapitalanrop</h1>
            <HelpTooltip 
              {...helpContent.capitalCalls}
              learnMoreLink="/guide#capital-calls"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">Hantera kapitalanrop och spåra investerares inbetalningar</p>
            <Link href="/guide#capital-calls" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowNewCallModal(true)}
            className="btn-primary py-2 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nytt kapitalanrop
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Totalt åtagande</span>
            <DollarSign className="w-5 h-5 text-aifm-charcoal/30" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(totalCommitted, currency)}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Inropat hittills</span>
            <ArrowUpRight className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(totalCalled, currency)}</p>
          <p className="text-sm text-aifm-charcoal/60 mt-1">{formatPercentage(callPercentage)} av åtagande</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Återstående</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(remainingToCall, currency)}</p>
        </div>

        <div className="bg-gradient-to-br from-aifm-gold to-aifm-gold/80 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium uppercase tracking-wider text-white/70">Aktiva anrop</span>
            <Bell className="w-5 h-5 text-white/50" />
          </div>
          <p className="text-2xl font-medium">{fundCalls.filter(c => c.status === 'SENT').length}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Kapitalanropsförlopp</span>
          <span className="text-sm text-aifm-charcoal/60">{formatPercentage(callPercentage)} inropat</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div 
            className="bg-aifm-gold rounded-full h-3 transition-all"
            style={{ width: `${callPercentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-aifm-charcoal/50">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Capital Calls List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">Kapitalanrop</h3>
            <span className="text-xs text-aifm-charcoal/50">{fundCalls.length} totalt</span>
          </div>
          <div className="divide-y divide-gray-50">
            {fundCalls.length === 0 ? (
              <div className="p-8 text-center">
                <ArrowUpRight className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                <p className="text-aifm-charcoal/60">Inga kapitalanrop ännu</p>
                <button 
                  onClick={() => setShowNewCallModal(true)}
                  className="btn-primary mt-4 py-2 px-4"
                >
                  Skapa första anrop
                </button>
              </div>
            ) : (
              fundCalls.map((call) => {
                const paidAmount = call.items.reduce((sum, item) => sum + item.paidAmount, 0);
                const paidPercentage = (paidAmount / call.totalAmount) * 100;
                
                return (
                  <div
                    key={call.id}
                    onClick={() => setSelectedCall(call)}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedCall?.id === call.id ? 'bg-aifm-gold/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center">
                          <span className="text-aifm-gold font-medium">#{call.callNumber}</span>
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal">{formatCurrency(call.totalAmount, currency)}</p>
                          <p className="text-xs text-aifm-charcoal/50">Förfaller: {formatDate(call.dueDate)}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(call.status)}`}>
                        {getStatusLabel(call.status)}
                      </span>
                    </div>
                    <p className="text-sm text-aifm-charcoal/60 mb-2">{call.purpose}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-aifm-charcoal/50">
                        {call.items.filter(i => i.status === 'PAID').length}/{call.items.length} investerare betalat
                      </span>
                      <span className="text-aifm-charcoal/50">{formatPercentage(paidPercentage)} mottaget</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-green-500 rounded-full h-1.5 transition-all"
                        style={{ width: `${paidPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Call Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {selectedCall ? (
            <>
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-aifm-charcoal uppercase tracking-wider">
                    Capital Call #{selectedCall.callNumber}
                  </h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedCall.status)}`}>
                    {getStatusLabel(selectedCall.status)}
                  </span>
                </div>
              </div>
              
              <div className="p-6 border-b border-gray-100">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Anropsdatum</p>
                    <p className="font-medium text-aifm-charcoal">{formatDate(selectedCall.callDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Förfallodatum</p>
                    <p className="font-medium text-aifm-charcoal">{formatDate(selectedCall.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Totalt belopp</p>
                    <p className="font-medium text-aifm-charcoal">{formatCurrency(selectedCall.totalAmount, currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Mottaget</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(selectedCall.items.reduce((sum, i) => sum + i.paidAmount, 0), currency)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-aifm-charcoal/50 uppercase tracking-wider mb-1">Syfte</p>
                  <p className="text-aifm-charcoal">{selectedCall.purpose}</p>
                </div>
              </div>

              {/* Investor Breakdown */}
              <div className="px-6 py-4 border-b border-gray-100">
                <h4 className="text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider mb-3">Investerarbetalningar</h4>
              </div>
              <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
                {selectedCall.items.map((item) => {
                  const investor = commitments.find(c => c.investorId === item.investorId)?.investor;
                  return (
                    <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.status === 'PAID' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : item.status === 'PARTIAL' ? (
                          <Clock className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <p className="font-medium text-aifm-charcoal text-sm">{investor?.name || 'Okänd'}</p>
                          <p className="text-xs text-aifm-charcoal/50">
                            {item.paidAt ? `Betalt ${formatDate(item.paidAt)}` : 'Väntar'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-aifm-charcoal text-sm">{formatCurrency(item.amount, currency)}</p>
                        {item.paidAmount > 0 && item.paidAmount < item.amount && (
                          <p className="text-xs text-blue-600">
                            {formatCurrency(item.paidAmount, currency)} betalt
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="p-6 bg-gray-50">
                <div className="flex gap-3">
                  <button className="flex-1 btn-outline py-2 flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Skicka påminnelse
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
              <p className="text-aifm-charcoal/60">Välj ett kapitalanrop för att se detaljer</p>
            </div>
          )}
        </div>
      </div>

      {/* New Capital Call Modal */}
      {showNewCallModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium text-aifm-charcoal uppercase tracking-wider">Nytt kapitalanrop</h3>
              <button 
                onClick={() => setShowNewCallModal(false)}
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
                <p className="font-medium text-aifm-charcoal">{fundName}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Anropsbelopp ({currency})
                </label>
                <input
                  type="number"
                  value={newCallAmount}
                  onChange={(e) => setNewCallAmount(e.target.value)}
                  className="input w-full"
                  placeholder="Ange belopp"
                />
                <p className="text-xs text-aifm-charcoal/50 mt-1">
                  Återstående ej inropat: {formatCurrency(remainingToCall, currency)}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-aifm-charcoal/70 mb-2 uppercase tracking-wider">
                  Syfte
                </label>
                <textarea
                  value={newCallPurpose}
                  onChange={(e) => setNewCallPurpose(e.target.value)}
                  className="input w-full h-24 resize-none"
                  placeholder="T.ex. ny investering i Bolag X"
                />
              </div>
              <div className="bg-aifm-gold/5 rounded-xl p-4">
                <p className="text-sm font-medium text-aifm-charcoal mb-2">Fördelningsförhandsgranskning</p>
                <div className="space-y-2 text-sm">
                  {commitments.slice(0, 3).map((commitment) => {
                    const allocation = newCallAmount ? 
                      (parseFloat(newCallAmount) * commitment.ownershipPercentage / 100) : 0;
                    return (
                      <div key={commitment.id} className="flex justify-between">
                        <span className="text-aifm-charcoal/60">{commitment.investor?.name}</span>
                        <span className="font-medium text-aifm-charcoal">
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
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowNewCallModal(false)}
                className="flex-1 btn-outline py-2"
              >
                Avbryt
              </button>
              <button 
                onClick={() => {
                  alert('Kapitalanrop skapat! (Demo)');
                  setShowNewCallModal(false);
                  setNewCallAmount('');
                  setNewCallPurpose('');
                }}
                className="flex-1 btn-primary py-2"
              >
                Skapa anrop
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
