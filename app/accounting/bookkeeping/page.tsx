'use client';


import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Clock, AlertCircle, Search,
  ArrowUpRight, ArrowDownRight, Eye, Check, X,
  FileText, Sparkles, Download, Filter, BarChart3,
  RefreshCw, Loader2, Upload
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';

interface LineItem {
  id: string;
  description: string;
  netAmount: number;
  vatAmount: number;
  suggestedAccount: string;
  suggestedCostCenter: string | null;
  confidence: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  account: string;
  category: string;
  status: 'approved' | 'pending' | 'needs_review';
  source: string;
  aiConfidence?: number;
  document?: string;
  s3Key?: string;
  vatAmount?: number;
  lineItems?: LineItem[];
}

interface JobSummary {
  total: number;
  queued: number;
  processing: number;
  ready: number;
  approved: number;
  sent: number;
  error: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusBadge(status: Transaction['status']) {
  switch (status) {
    case 'approved':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Godkänd
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <Clock className="w-3 h-3" />
          Väntar
        </span>
      );
    case 'needs_review':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          Granska
        </span>
      );
  }
}

// Simple Card components
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

const CardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 border-b border-gray-50 ${className}`}>{children}</div>
);

const CardTitle = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <h3 className={`font-medium text-gray-900 ${className}`}>{children}</h3>
);

const CardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

export default function BookkeepingPage() {
  const { selectedCompany: company } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<JobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'needs_review' | 'approved'>('all');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);

  // Fetch transactions from API
  const fetchTransactions = useCallback(async (showRefreshIndicator = false) => {
    if (!company?.id) return;
    
    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const response = await fetch(`/api/accounting/jobs?companyId=${company.id}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      setTransactions(data.transactions?.filter((t: Transaction | null) => t !== null) || []);
      setSummary(data.summary);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-refresh every 10 seconds for processing jobs
  useEffect(() => {
    if (summary?.processing && summary.processing > 0) {
      const interval = setInterval(() => {
        fetchTransactions(true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [summary?.processing, fetchTransactions]);

  const getFilteredTransactions = () => {
    let filtered = transactions;
    
    if (searchQuery) {
      filtered = filtered.filter(tx => 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (activeTab !== 'all') {
      filtered = filtered.filter(tx => tx.status === activeTab);
    }
    
    return filtered;
  };

  const filteredTransactions = getFilteredTransactions();

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/accounting/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to approve');
      }
      
      // Update local state
      setTransactions(prev => 
        prev.map(tx => tx.id === id ? { ...tx, status: 'approved' as const } : tx)
      );
    } catch (err) {
      console.error('Error approving transaction:', err);
    }
  };

  const handleBulkApprove = async () => {
    for (const id of selectedTransactions) {
      await handleApprove(id);
    }
    setSelectedTransactions([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    const selectableIds = filteredTransactions.filter(tx => tx.status !== 'approved').map(tx => tx.id);
    if (selectedTransactions.length === selectableIds.length && selectableIds.length > 0) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(selectableIds);
    }
  };

  const approvedCount = transactions.filter(tx => tx.status === 'approved').length;
  const pendingCount = transactions.filter(tx => tx.status === 'pending').length;
  const needsReviewCount = transactions.filter(tx => tx.status === 'needs_review').length;

  const totalIncome = transactions.filter(tx => tx.type === 'income' && tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'expense' && tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0);

  if (!company) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Välj ett bolag för att se bokföring.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-6 w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">
              Löpande bokföring
            </h1>
            <p className="text-gray-500 mt-1">
              {company.name}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchTransactions(true)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Uppdatera"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {selectedTransactions.length > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Godkänn {selectedTransactions.length} valda
              </button>
            )}
            <Link
              href="/accounting/upload"
              className="px-4 py-2 text-sm bg-[#c0a280] hover:bg-[#a88f6d] text-white rounded-lg flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Ladda upp
            </Link>
            <button className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Exportera
            </button>
          </div>
        </div>

        {/* Processing indicator */}
        {summary?.processing && summary.processing > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">
                  {summary.processing} dokument bearbetas just nu...
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <Card className="bg-red-50 border-red-200">
            <CardContent>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-gray-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Totalt</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {loading ? '-' : transactions.length}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Godkända</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {loading ? '-' : approvedCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Väntar</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {loading ? '-' : pendingCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm">Granska</span>
              </div>
              <div className="text-2xl font-light text-gray-900">
                {loading ? '-' : needsReviewCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Net Result Card */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Nettoresultat (godkända):</span>
                <span className={`text-xl font-medium ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {loading ? '-' : formatCurrency(totalIncome - totalExpense)}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                  <span className="text-gray-600">Intäkter:</span>
                  <span className="font-medium text-green-600">
                    {loading ? '-' : formatCurrency(totalIncome)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Kostnader:</span>
                  <span className="font-medium text-gray-900">
                    {loading ? '-' : formatCurrency(totalExpense)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            <div className="flex border-b border-gray-100">
              {[
                { key: 'all', label: 'Alla', count: transactions.length, icon: BarChart3 },
                { key: 'pending', label: 'Väntar', count: pendingCount, icon: Clock },
                { key: 'needs_review', label: 'Granska', count: needsReviewCount, icon: AlertCircle },
                { key: 'approved', label: 'Godkända', count: approvedCount, icon: CheckCircle2 },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-6 py-3 text-sm font-medium transition-all relative flex items-center gap-2 ${
                    activeTab === tab.key
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.key ? 'bg-[#c0a280]/20 text-[#c0a280]' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {loading ? '-' : tab.count}
                  </span>
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Sök transaktion..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-0 rounded-lg text-sm
                             focus:bg-white focus:ring-2 focus:ring-[#c0a280]/10 transition-all"
                />
              </div>
              <button className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          {loading ? (
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#c0a280] animate-spin mb-4" />
                <p className="text-gray-500">Laddar transaktioner...</p>
              </div>
            </CardContent>
          ) : transactions.length === 0 ? (
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mb-4" />
                <p className="text-gray-500 mb-4">Inga transaktioner ännu</p>
                <Link
                  href="/accounting/upload"
                  className="px-4 py-2 text-sm bg-[#c0a280] hover:bg-[#a88f6d] text-white rounded-lg flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Ladda upp ditt första dokument
                </Link>
              </div>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.length === filteredTransactions.filter(tx => tx.status !== 'approved').length && selectedTransactions.length > 0}
                        onChange={toggleAllSelection}
                        className="rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beskrivning</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Belopp</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">AI</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className={`hover:bg-gray-50/50 transition-colors ${tx.status === 'needs_review' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        {tx.status !== 'approved' && (
                          <input
                            type="checkbox"
                            checked={selectedTransactions.includes(tx.id)}
                            onChange={() => toggleSelection(tx.id)}
                            className="rounded border-gray-300 text-[#c0a280] focus:ring-[#c0a280]"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{tx.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          <div>
                            <p className="text-sm text-gray-900 font-medium">{tx.description}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">{tx.source}</span>
                              {tx.document && (
                                <span className="text-xs text-[#c0a280] flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900">{tx.account}</p>
                        <p className="text-xs text-gray-500">{tx.category}</p>
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium text-right ${tx.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tx.aiConfidence !== undefined && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            tx.aiConfidence >= 90 ? 'bg-green-100 text-green-700' :
                            tx.aiConfidence >= 70 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            <Sparkles className="w-3 h-3" />
                            {tx.aiConfidence}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tx.status !== 'approved' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleApprove(tx.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Godkänn"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <Link
                              href={`/accounting/jobs/${tx.id}`}
                              className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Granska"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              title="Avvisa"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Info about AI */}
        <Card className="bg-[#c0a280]/10 border-[#c0a280]/20">
          <CardContent>
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#c0a280] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900 font-medium">AI-klassificering med AWS Bedrock</p>
                <p className="text-xs text-gray-700 mt-1">
                  Transaktioner klassificeras automatiskt av Claude Sonnet 4.5 via AWS Bedrock. 
                  Grön indikerar hög säkerhet (90%+), gul medel (70-90%), och röd låg (&lt;70%).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    
  );
}
