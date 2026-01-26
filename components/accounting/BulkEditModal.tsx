'use client';

import { useState } from 'react';
import { X, Save, AlertTriangle, Edit3, Building2, FolderOpen, Check } from 'lucide-react';
import { allaKonton, sokKonto } from '@/lib/accounting/basKontoplan';

interface BulkEditModalProps {
  selectedCount: number;
  onClose: () => void;
  onApply: (changes: BulkChanges) => Promise<void>;
}

export interface BulkChanges {
  account?: string;
  costCenter?: string;
  vatRate?: number;
}

const COST_CENTERS = [
  { value: '', label: 'Ingen ändring' },
  { value: 'ADM', label: 'ADM - Administration' },
  { value: 'IT', label: 'IT - IT-avdelningen' },
  { value: 'MARK', label: 'MARK - Marknadsföring' },
  { value: 'PROJ', label: 'PROJ - Projekt' },
  { value: 'REP', label: 'REP - Representation' },
];

const VAT_RATES = [
  { value: -1, label: 'Ingen ändring' },
  { value: 25, label: '25% - Standard' },
  { value: 12, label: '12% - Livsmedel, hotell' },
  { value: 6, label: '6% - Böcker, tidningar' },
  { value: 0, label: '0% - Momsfritt' },
];

export function BulkEditModal({ selectedCount, onClose, onApply }: BulkEditModalProps) {
  const [changes, setChanges] = useState<BulkChanges>({});
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountList, setShowAccountList] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = changes.account || changes.costCenter || (changes.vatRate !== undefined && changes.vatRate >= 0);
  
  const filteredAccounts = accountSearch 
    ? sokKonto(accountSearch).slice(0, 10)
    : allaKonton.slice(0, 10);

  const handleApply = async () => {
    if (!hasChanges) return;
    
    setIsApplying(true);
    setError(null);
    
    try {
      const cleanChanges: BulkChanges = {};
      if (changes.account) cleanChanges.account = changes.account;
      if (changes.costCenter) cleanChanges.costCenter = changes.costCenter;
      if (changes.vatRate !== undefined && changes.vatRate >= 0) cleanChanges.vatRate = changes.vatRate;
      
      await onApply(cleanChanges);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Massredigera</h2>
                <p className="text-sm text-gray-500">{selectedCount} dokument valda</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Account selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FolderOpen className="w-4 h-4 inline mr-2" />
                Ändra konto
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={accountSearch}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setShowAccountList(true);
                  }}
                  onFocus={() => setShowAccountList(true)}
                  placeholder="Sök konto..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold"
                />
                {changes.account && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-sm text-gray-500">{changes.account}</span>
                    <button
                      onClick={() => {
                        setChanges(prev => ({ ...prev, account: undefined }));
                        setAccountSearch('');
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                )}
                
                {/* Account dropdown */}
                {showAccountList && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto z-10">
                    <div 
                      className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-gray-400"
                      onClick={() => {
                        setChanges(prev => ({ ...prev, account: undefined }));
                        setAccountSearch('');
                        setShowAccountList(false);
                      }}
                    >
                      Ingen ändring
                    </div>
                    {filteredAccounts.map((account) => (
                      <div
                        key={account.konto}
                        className={`px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                          changes.account === account.konto ? 'bg-aifm-gold/10' : ''
                        }`}
                        onClick={() => {
                          setChanges(prev => ({ ...prev, account: account.konto }));
                          setAccountSearch(`${account.konto} - ${account.namn}`);
                          setShowAccountList(false);
                        }}
                      >
                        <div>
                          <span className="font-mono text-sm text-gray-900">{account.konto}</span>
                          <span className="text-sm text-gray-600 ml-2">{account.namn}</span>
                        </div>
                        {changes.account === account.konto && (
                          <Check className="w-4 h-4 text-aifm-gold" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cost center selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-2" />
                Ändra kostnadsställe
              </label>
              <select
                value={changes.costCenter || ''}
                onChange={(e) => setChanges(prev => ({ 
                  ...prev, 
                  costCenter: e.target.value || undefined 
                }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold bg-white"
              >
                {COST_CENTERS.map((cc) => (
                  <option key={cc.value} value={cc.value}>{cc.label}</option>
                ))}
              </select>
            </div>

            {/* VAT rate selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ändra momssats
              </label>
              <div className="grid grid-cols-5 gap-2">
                {VAT_RATES.map((rate) => (
                  <button
                    key={rate.value}
                    onClick={() => setChanges(prev => ({ 
                      ...prev, 
                      vatRate: rate.value 
                    }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      changes.vatRate === rate.value
                        ? 'bg-aifm-gold text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {rate.value < 0 ? '—' : `${rate.value}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning */}
            {hasChanges && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Bekräfta ändringar</p>
                  <p className="mt-1">
                    Dessa ändringar kommer att tillämpas på alla {selectedCount} valda dokument.
                    Denna åtgärd kan inte ångras automatiskt.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Avbryt
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanges || isApplying}
              className="flex items-center gap-2 px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Tillämpar...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Tillämpa på {selectedCount} dokument
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

