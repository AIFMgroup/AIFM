'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

import { useCompany } from '@/components/CompanyContext';
import { 
  Building2, ArrowLeftRight, Upload, Download, Search, 
  CheckCircle2, XCircle, AlertCircle, Clock, FileText,
  ChevronDown, Filter, MoreVertical, Loader2, RefreshCw,
  Banknote, TrendingUp, TrendingDown, Users, Link2,
  Play, Pause, Settings, HelpCircle, Eye
} from 'lucide-react';

interface BankTransaction {
  id: string;
  transactionDate: string;
  amount: number;
  description: string;
  counterpartyName?: string;
  reference?: string;
  status: 'PENDING' | 'MATCHED' | 'MANUALLY_MATCHED' | 'IGNORED';
  matchedJobId?: string;
  matchConfidence?: number;
}

interface MatchCandidate {
  jobId: string;
  supplier: string;
  invoiceNumber?: string;
  amount: number;
  dueDate?: string;
  matchScore: number;
  matchReasons: string[];
}

interface ReconciliationSummary {
  period: string;
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  ignoredCount: number;
  totalIncoming: number;
  totalOutgoing: number;
}

export default function BankReconciliationPage() {
  const { selectedCompany } = useCompany();
  // State
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isRunningAuto, setIsRunningAuto] = useState(false);
  const [autoMatchResults, setAutoMatchResults] = useState<{ matched: number; suggested: number; unmatched: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState('');
  const [bankFormat, setBankFormat] = useState<'NORDEA' | 'SEB' | 'SWEDBANK' | 'HANDELSBANKEN' | 'GENERIC'>('GENERIC');
  const [isImporting, setIsImporting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    try {
      const [summaryRes, transactionsRes] = await Promise.all([
        fetch(`/api/accounting/bank-reconciliation?action=summary&companyId=${selectedCompany.id}`),
        fetch(`/api/accounting/bank-reconciliation?action=pending&companyId=${selectedCompany.id}`),
      ]);
      
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data.summary);
      }
      
      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setIsLoading(false);
  }, [selectedCompany]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  // Import CSV
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvContent) return;
    if (!selectedCompany) return;
    
    setIsImporting(true);
    try {
      const response = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-csv',
          companyId: selectedCompany.id,
          csvContent,
          format: bankFormat,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Importerat: ${result.imported} transaktioner (${result.duplicates} dubletter hoppade över)`);
        setShowImportModal(false);
        setCsvContent('');
        fetchData();
      }
    } catch (error) {
      console.error('Import error:', error);
    }
    setIsImporting(false);
  };

  // Run auto reconciliation
  const handleRunAutoReconciliation = async () => {
    if (!selectedCompany) return;
    setIsRunningAuto(true);
    try {
      // Start session
      const sessionRes = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start-session',
          companyId: selectedCompany.id,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
        }),
      });
      
      if (sessionRes.ok) {
        const { session } = await sessionRes.json();
        
        // Run auto matching
        const matchRes = await fetch('/api/accounting/bank-reconciliation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'run-auto-reconciliation',
            companyId: selectedCompany.id,
            sessionId: session.id,
          }),
        });
        
        if (matchRes.ok) {
          const result = await matchRes.json();
          setAutoMatchResults({
            matched: result.matched,
            suggested: result.suggested,
            unmatched: result.unmatched,
          });
          fetchData();
        }
      }
    } catch (error) {
      console.error('Auto reconciliation error:', error);
    }
    setIsRunningAuto(false);
  };

  // Match transaction
  const handleMatch = async (transactionId: string, jobId: string) => {
    if (!selectedCompany) return;
    try {
      const response = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'match',
          companyId: selectedCompany.id,
          transactionId,
          jobId,
          isManual: true,
        }),
      });
      
      if (response.ok) {
        setSelectedTransaction(null);
        fetchData();
      }
    } catch (error) {
      console.error('Match error:', error);
    }
  };

  // Ignore transaction
  const handleIgnore = async (transactionId: string) => {
    const reason = prompt('Anledning till att ignorera (t.ex. intern överföring):');
    if (!reason) return;
    if (!selectedCompany) return;
    
    try {
      await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ignore',
          companyId: selectedCompany.id,
          transactionId,
          reason,
        }),
      });
      
      fetchData();
    } catch (error) {
      console.error('Ignore error:', error);
    }
  };

  // Format helpers
  const formatAmount = (amount: number) => {
    const formatter = new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(amount);
  };

  const getStatusBadge = (status: BankTransaction['status']) => {
    const badges = {
      PENDING: { bg: 'bg-amber-50', text: 'text-amber-600', icon: Clock, label: 'Väntar' },
      MATCHED: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircle2, label: 'Matchad' },
      MANUALLY_MATCHED: { bg: 'bg-blue-50', text: 'text-blue-600', icon: Link2, label: 'Manuellt matchad' },
      IGNORED: { bg: 'bg-gray-50', text: 'text-gray-500', icon: XCircle, label: 'Ignorerad' },
    };
    const badge = badges[status];
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-aifm-charcoal tracking-tight">Bankavstämning</h1>
            <p className="text-sm text-aifm-charcoal/50 mt-1">
              Matcha banktransaktioner automatiskt mot fakturor och kvitton
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRunAutoReconciliation}
              disabled={isRunningAuto}
              className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors disabled:opacity-50"
            >
              {isRunningAuto ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kör automatisk matchning...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Kör automatisk matchning
                </>
              )}
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-aifm-charcoal rounded-xl text-sm font-medium hover:border-aifm-charcoal/30 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importera CSV
            </button>
          </div>
        </div>

        {/* Auto match results */}
        {autoMatchResults && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <div className="flex-1">
              <p className="font-medium text-emerald-800">Automatisk matchning slutförd</p>
              <p className="text-sm text-emerald-600">
                {autoMatchResults.matched} matchade · {autoMatchResults.suggested} förslag · {autoMatchResults.unmatched} omatchade
              </p>
            </div>
            <button 
              onClick={() => setAutoMatchResults(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 text-aifm-charcoal/50 mb-2">
                <Banknote className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Totalt</span>
              </div>
              <p className="text-2xl font-bold text-aifm-charcoal">{summary.totalTransactions}</p>
              <p className="text-xs text-aifm-charcoal/40 mt-1">transaktioner</p>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Matchade</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{summary.matchedCount}</p>
              <p className="text-xs text-aifm-charcoal/40 mt-1">
                {summary.totalTransactions > 0 
                  ? Math.round((summary.matchedCount / summary.totalTransactions) * 100) 
                  : 0}%
              </p>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Väntar</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{summary.unmatchedCount}</p>
              <p className="text-xs text-aifm-charcoal/40 mt-1">kräver åtgärd</p>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Inkommande</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{formatAmount(summary.totalIncoming)}</p>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium uppercase">Utgående</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatAmount(summary.totalOutgoing)}</p>
            </div>
          </div>
        )}

        {/* Transactions list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-aifm-charcoal">Banktransaktioner</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Sök transaktion..."
                  className="pl-9 pr-4 py-2 bg-gray-50 border-0 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-aifm-gold/20"
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Filter className="w-4 h-4 text-aifm-charcoal/40" />
              </button>
              <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <RefreshCw className="w-4 h-4 text-aifm-charcoal/40" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-aifm-gold animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Banknote className="w-8 h-8 text-aifm-charcoal/20" />
              </div>
              <p className="text-aifm-charcoal/50 font-medium">Inga väntande transaktioner</p>
              <p className="text-sm text-aifm-charcoal/30 mt-1">Importera banktransaktioner för att starta avstämningen</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Datum</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Beskrivning</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Belopp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-aifm-charcoal">
                        {new Date(tx.transactionDate).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-md">
                          <p className="text-sm font-medium text-aifm-charcoal truncate">
                            {tx.counterpartyName || tx.description}
                          </p>
                          {tx.reference && (
                            <p className="text-xs text-aifm-charcoal/40 mt-0.5">Ref: {tx.reference}</p>
                          )}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${
                        tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {formatAmount(tx.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(tx.status)}
                        {tx.matchConfidence && tx.matchConfidence < 1 && (
                          <span className="ml-2 text-xs text-aifm-charcoal/40">
                            {Math.round(tx.matchConfidence * 100)}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {tx.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => setSelectedTransaction(tx)}
                                className="p-2 hover:bg-aifm-gold/10 rounded-lg transition-colors text-aifm-charcoal/40 hover:text-aifm-gold"
                                title="Matcha manuellt"
                              >
                                <Link2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleIgnore(tx.id)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-aifm-charcoal/40 hover:text-gray-600"
                                title="Ignorera"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {(tx.status === 'MATCHED' || tx.status === 'MANUALLY_MATCHED') && (
                            <button
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-aifm-charcoal/40"
                              title="Visa matchning"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-aifm-charcoal">Importera banktransaktioner</h3>
              <button 
                onClick={() => setShowImportModal(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <XCircle className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  Bank
                </label>
                <select
                  value={bankFormat}
                  onChange={(e) => setBankFormat(e.target.value as typeof bankFormat)}
                  className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-aifm-gold/30"
                >
                  <option value="GENERIC">Automatisk igenkänning</option>
                  <option value="NORDEA">Nordea</option>
                  <option value="SEB">SEB</option>
                  <option value="SWEDBANK">Swedbank</option>
                  <option value="HANDELSBANKEN">Handelsbanken</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-aifm-charcoal/50 mb-2 uppercase tracking-wider">
                  CSV-fil
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-aifm-gold/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-aifm-charcoal/30 mx-auto mb-3" />
                  <p className="text-sm text-aifm-charcoal/70">Klicka eller dra och släpp din CSV-fil här</p>
                  {csvContent && (
                    <p className="text-sm text-emerald-600 mt-2">
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Fil laddad ({csvContent.split('\n').length - 1} rader)
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={handleImport}
                disabled={!csvContent || isImporting}
                className="flex-1 py-3 px-4 text-sm font-medium text-white bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importerar...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importera
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Match Modal - Would show when selectedTransaction is set */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-aifm-charcoal">Matcha transaktion</h3>
                <p className="text-sm text-aifm-charcoal/40 mt-0.5">
                  {formatAmount(selectedTransaction.amount)} · {selectedTransaction.description}
                </p>
              </div>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <XCircle className="w-5 h-5 text-aifm-charcoal/50" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm text-aifm-charcoal/50 mb-4">Välj en faktura att matcha mot denna transaktion:</p>
              
              {/* Would load match candidates here */}
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 text-center text-aifm-charcoal/40">
                  <p>Söker efter matchande fakturor...</p>
                  <p className="text-xs mt-1">Baserat på belopp, datum och leverantör</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="flex-1 py-3 px-4 text-sm font-medium text-aifm-charcoal/70 bg-white border border-gray-200 rounded-xl hover:border-aifm-charcoal/30 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => handleIgnore(selectedTransaction.id)}
                className="py-3 px-4 text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all"
              >
                Ignorera
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
