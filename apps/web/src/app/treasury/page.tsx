'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Building2, ArrowUpRight,
  RefreshCw, Download, Filter, Search, CheckCircle2,
  AlertCircle, Clock, ChevronRight, Plus, Eye,
  Wallet, FileText, Send, BookOpen
} from 'lucide-react';
import {
  mockFunds, getBankAccountsByFund, getTransactionsByAccount, getInvoicesByFund,
  formatCurrency, formatDate, Fund, BankAccount
} from '@/lib/fundData';
import { HelpTooltip, helpContent } from '@/components/HelpTooltip';
import { CustomSelect } from '@/components/CustomSelect';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function TreasuryPage() {
  const [selectedFund, setSelectedFund] = useState<Fund>(mockFunds[0]);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'invoices' | 'payments'>('accounts');
  const [refreshing, setRefreshing] = useState(false);

  const accounts = getBankAccountsByFund(selectedFund.id);
  const allTransactions = accounts.flatMap(acc => getTransactionsByAccount(acc.id));
  const invoices = getInvoicesByFund(selectedFund.id);

  // Calculate totals
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const pendingInvoices = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'APPROVED');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const unmatchedTransactions = allTransactions.filter(tx => !tx.matched);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-medium text-aifm-charcoal uppercase tracking-wider">Likviditet</h1>
            <HelpTooltip 
              {...helpContent.treasury}
              learnMoreLink="/guide#treasury"
              position="bottom"
              size="md"
            />
          </div>
          <div className="flex items-center gap-4">
            <p className="text-aifm-charcoal/60">Bankkonton, transaktioner och betalningshantering</p>
            <Link href="/guide#treasury" className="text-xs text-aifm-gold hover:underline flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              Guide
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <CustomSelect
            options={mockFunds.map((fund) => ({
              value: fund.id,
              label: fund.name,
              icon: <Wallet className="w-4 h-4 text-aifm-gold" />
            }))}
            value={selectedFund.id}
            onChange={(value) => {
              const fund = mockFunds.find(f => f.id === value);
              if (fund) {
                setSelectedFund(fund);
                setSelectedAccount(null);
              }
            }}
            className="min-w-[280px]"
            variant="gold"
            size="md"
          />
          <button 
            onClick={handleRefresh}
            className="p-2 text-aifm-charcoal/60 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn-primary text-sm py-2 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ny betalning
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-aifm-charcoal to-aifm-charcoal/90 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-white/60">Totalt saldo</span>
            <Wallet className="w-5 h-5 text-white/40" />
          </div>
          <p className="text-3xl font-medium">{formatCurrency(totalBalance, selectedFund.currency)}</p>
          <p className="text-sm text-white/60 mt-2">{accounts.length} bank account{accounts.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Väntande betalningar</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(pendingAmount, selectedFund.currency)}</p>
          <p className="text-sm text-aifm-charcoal/60 mt-2">{pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? 's' : ''} pending</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Unmatched</span>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">{unmatchedTransactions.length}</p>
          <p className="text-sm text-aifm-charcoal/60 mt-2">transactions need review</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-aifm-charcoal/60">Last Sync</span>
            <RefreshCw className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-medium text-aifm-charcoal">2h ago</p>
          <p className="text-sm text-green-600 mt-2">All accounts synced</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex -mb-px">
            {[
              { id: 'accounts', label: 'Bank Accounts', icon: Building2 },
              { id: 'transactions', label: 'Transactions', icon: ArrowUpRight },
              { id: 'invoices', label: 'Invoices', icon: FileText },
              { id: 'payments', label: 'Payments', icon: Send },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`
                  flex items-center gap-2 px-6 py-4 text-sm font-medium uppercase tracking-wide border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'text-aifm-gold border-aifm-gold'
                    : 'text-aifm-charcoal/60 border-transparent hover:text-aifm-charcoal hover:border-gray-200'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Bank Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
                  <p className="text-aifm-charcoal/60">No bank accounts configured for this fund</p>
                  <button className="btn-primary mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bank Account
                  </button>
                </div>
              ) : (
                accounts.map((account) => (
                  <div 
                    key={account.id}
                    className={`
                      p-6 rounded-xl border-2 transition-all cursor-pointer
                      ${selectedAccount?.id === account.id 
                        ? 'border-aifm-gold bg-aifm-gold/5' 
                        : 'border-gray-100 hover:border-aifm-gold/30 bg-white'
                      }
                    `}
                    onClick={() => setSelectedAccount(selectedAccount?.id === account.id ? null : account)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-aifm-charcoal/10 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-aifm-charcoal" />
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal">{account.bankName}</p>
                          <p className="text-sm text-aifm-charcoal/60">{account.iban}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-medium text-aifm-charcoal">{formatCurrency(account.balance, account.currency)}</p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            account.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {account.status}
                          </span>
                          <span className="text-xs text-aifm-charcoal/50">{account.type}</span>
                        </div>
                      </div>
                    </div>
                    
                    {selectedAccount?.id === account.id && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-aifm-charcoal/50 uppercase tracking-wider text-xs mb-1">Account Number</p>
                            <p className="font-medium text-aifm-charcoal">{account.accountNumber}</p>
                          </div>
                          <div>
                            <p className="text-aifm-charcoal/50 uppercase tracking-wider text-xs mb-1">BIC/SWIFT</p>
                            <p className="font-medium text-aifm-charcoal">{account.bic}</p>
                          </div>
                          <div>
                            <p className="text-aifm-charcoal/50 uppercase tracking-wider text-xs mb-1">Currency</p>
                            <p className="font-medium text-aifm-charcoal">{account.currency}</p>
                          </div>
                          <div>
                            <p className="text-aifm-charcoal/50 uppercase tracking-wider text-xs mb-1">Last Synced</p>
                            <p className="font-medium text-aifm-charcoal">{formatDate(account.lastSyncAt)}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-4">
                          <button className="btn-outline py-2 px-4 text-sm flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            View Transactions
                          </button>
                          <button className="btn-outline py-2 px-4 text-sm flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" />
                            Sync Now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-aifm-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Sök transaktioner..."
                      className="input py-2 pl-10 pr-4 w-64"
                    />
                  </div>
                  <button className="btn-outline py-2 px-4 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter
                  </button>
                </div>
                <button className="btn-outline py-2 px-4 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Counterparty</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Category</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Belopp</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-aifm-charcoal/60 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-sm text-aifm-charcoal">{formatDate(tx.date)}</td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-aifm-charcoal">{tx.description}</p>
                          <p className="text-xs text-aifm-charcoal/50">Ref: {tx.reference}</p>
                        </td>
                        <td className="px-4 py-4 text-sm text-aifm-charcoal">{tx.counterparty}</td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-aifm-charcoal">
                            {tx.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className={`px-4 py-4 text-sm font-medium text-right ${
                          tx.type === 'CREDIT' ? 'text-green-600' : 'text-aifm-charcoal'
                        }`}>
                          {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {tx.matched ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              <AlertCircle className="w-3 h-3" />
                              Unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-aifm-charcoal/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      placeholder="Sök fakturor..."
                      className="input py-2 pl-10 pr-4 w-64"
                    />
                  </div>
                </div>
                <button className="btn-primary py-2 px-4 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Upload Invoice
                </button>
              </div>

              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-5 rounded-xl border border-gray-100 hover:border-aifm-gold/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          invoice.status === 'PAID' ? 'bg-green-100' :
                          invoice.status === 'APPROVED' ? 'bg-blue-100' :
                          invoice.status === 'PENDING' ? 'bg-amber-100' :
                          'bg-red-100'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            invoice.status === 'PAID' ? 'text-green-600' :
                            invoice.status === 'APPROVED' ? 'text-blue-600' :
                            invoice.status === 'PENDING' ? 'text-amber-600' :
                            'text-red-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-aifm-charcoal">{invoice.vendorName}</p>
                          <p className="text-sm text-aifm-charcoal/60">{invoice.invoiceNumber} • {invoice.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-medium text-aifm-charcoal">{formatCurrency(invoice.amount, invoice.currency)}</p>
                          <p className="text-xs text-aifm-charcoal/50">Due: {formatDate(invoice.dueDate)}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          invoice.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          invoice.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                          invoice.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {invoice.status}
                        </span>
                        <button className="p-2 text-aifm-charcoal/40 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="text-center py-12">
              <Send className="w-12 h-12 text-aifm-charcoal/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-aifm-charcoal mb-2">Payment Processing</h3>
              <p className="text-aifm-charcoal/60 mb-6 max-w-md mx-auto">
                Initiate and approve payments with four-eyes principle for secure fund operations.
              </p>
              <button className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Payment
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
