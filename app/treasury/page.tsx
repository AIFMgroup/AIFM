'use client';

import { useState } from 'react';
import { 
  Building2, ArrowUpRight, ArrowDownRight,
  RefreshCw, Download, Search, CheckCircle2,
  AlertCircle, Clock, ChevronRight, Plus, Eye,
  Wallet, FileText, Send, CreditCard
} from 'lucide-react';
import {
  getFundByCompanyId, getBankAccountsByCompanyId, getTransactionsByAccount, getInvoicesByCompanyId,
  formatCurrency, formatDate, BankAccount
} from '@/lib/fundData';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';

// Metric Card
function MetricCard({ 
  label, 
  value, 
  subValue,
  icon: Icon,
  variant = 'default',
  iconColor
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
  variant?: 'default' | 'primary';
  iconColor?: string;
}) {
  const isPrimary = variant === 'primary';

  return (
    <div className={`
      group relative rounded-2xl p-6 transition-all duration-500 hover:-translate-y-0.5
      ${isPrimary 
        ? 'bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 text-white shadow-xl shadow-aifm-charcoal/20' 
        : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20'
      }
    `}>
      {!isPrimary && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aifm-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      )}
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl transition-colors duration-300 ${
            isPrimary ? 'bg-white/10' : 'bg-aifm-charcoal/5 group-hover:bg-aifm-gold/10'
          }`}>
            <Icon className={`w-5 h-5 ${iconColor || (isPrimary ? 'text-white/60' : 'text-aifm-charcoal/50 group-hover:text-aifm-gold')} transition-colors duration-300`} />
          </div>
        </div>
        <p className={`text-xs uppercase tracking-wider font-medium mb-2 ${isPrimary ? 'text-white/50' : 'text-aifm-charcoal/50'}`}>
          {label}
        </p>
        <p className={`text-2xl font-semibold tracking-tight ${isPrimary ? 'text-white' : 'text-aifm-charcoal'}`}>
          {value}
        </p>
        {subValue && (
          <p className={`text-sm mt-2 ${isPrimary ? 'text-white/60' : 'text-aifm-charcoal/40'}`}>{subValue}</p>
        )}
      </div>
    </div>
  );
}

// Bank Account Card
function BankAccountCard({ 
  account, 
  isSelected, 
  onClick 
}: { 
  account: BankAccount; 
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div 
      className={`
        rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
        ${isSelected 
          ? 'bg-aifm-gold/5 border-2 border-aifm-gold/30 shadow-lg shadow-aifm-gold/10' 
          : 'bg-white border border-gray-100/50 hover:shadow-xl hover:shadow-gray-200/50 hover:border-aifm-gold/20'
        }
      `}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`
              w-14 h-14 rounded-xl flex items-center justify-center transition-colors duration-300
              ${isSelected ? 'bg-aifm-gold/20' : 'bg-aifm-charcoal/5'}
            `}>
              <Building2 className={`w-7 h-7 ${isSelected ? 'text-aifm-gold' : 'text-aifm-charcoal/50'}`} />
            </div>
            <div>
              <p className="font-semibold text-aifm-charcoal text-lg">{account.bankName}</p>
              <p className="text-sm text-aifm-charcoal/40 font-mono">{account.iban}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-aifm-charcoal">{formatCurrency(account.balance, account.currency)}</p>
            <div className="flex items-center gap-2 justify-end mt-2">
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                account.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {account.status === 'ACTIVE' ? 'Aktiv' : account.status}
              </span>
              <span className="text-xs text-aifm-charcoal/40">{account.type}</span>
            </div>
          </div>
        </div>
      </div>
      
      {isSelected && (
        <div className="px-6 pb-6">
          <div className="pt-5 border-t border-aifm-gold/10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Kontonummer', value: account.accountNumber },
                { label: 'BIC/SWIFT', value: account.bic },
                { label: 'Valuta', value: account.currency },
                { label: 'Senast synkat', value: formatDate(account.lastSyncAt) },
              ].map((item) => (
                <div key={item.label} className="bg-white/80 rounded-xl p-3">
                  <p className="text-[10px] text-aifm-charcoal/40 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="font-medium text-aifm-charcoal text-sm">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                                 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                                 hover:text-aifm-charcoal transition-all duration-300">
                <Eye className="w-4 h-4" />
                Visa transaktioner
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                                 bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 
                                 hover:text-aifm-charcoal transition-all duration-300">
                <RefreshCw className="w-4 h-4" />
                Synka nu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tab Button
function TabButton({ 
  label, 
  icon: Icon, 
  isActive, 
  onClick 
}: { 
  label: string; 
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all duration-300 relative
        ${isActive
          ? 'text-aifm-charcoal'
          : 'text-aifm-charcoal/40 hover:text-aifm-charcoal/70'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aifm-gold rounded-full" />
      )}
    </button>
  );
}

export default function TreasuryPage() {
  const { selectedCompany } = useCompany();
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [activeTab, setActiveTab] = useState<'accounts' | 'transactions' | 'invoices' | 'payments'>('accounts');
  const [refreshing, setRefreshing] = useState(false);

  const selectedFund = getFundByCompanyId(selectedCompany.id);
  const accounts = getBankAccountsByCompanyId(selectedCompany.id);
  const allTransactions = accounts.flatMap(acc => getTransactionsByAccount(acc.id));
  const invoices = getInvoicesByCompanyId(selectedCompany.id);
  const currency = selectedFund?.currency || 'SEK';

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-semibold text-aifm-charcoal tracking-tight">Likviditet</h1>
          <p className="text-aifm-charcoal/40 mt-2">Bankkonton, transaktioner och betalningshantering</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            className="p-3 text-aifm-charcoal/50 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-xl transition-all duration-300"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-white 
                             bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 
                             shadow-lg shadow-aifm-charcoal/20 transition-all duration-300">
            <Plus className="w-4 h-4" />
            Ny betalning
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard 
          label="Totalt saldo" 
          value={formatCurrency(totalBalance, currency)}
          subValue={`${accounts.length} bankkonto${accounts.length !== 1 ? 'n' : ''}`}
          icon={Wallet}
          variant="primary"
        />
        <MetricCard 
          label="Väntande betalningar" 
          value={formatCurrency(pendingAmount, currency)}
          subValue={`${pendingInvoices.length} faktura${pendingInvoices.length !== 1 ? 'or' : ''}`}
          icon={Clock}
          iconColor="text-amber-500"
        />
        <MetricCard 
          label="Omatchade" 
          value={unmatchedTransactions.length.toString()}
          subValue="behöver granskas"
          icon={AlertCircle}
          iconColor="text-amber-500"
        />
        <MetricCard 
          label="Senast synkat" 
          value="2h sedan"
          subValue="Alla konton synkade"
          icon={CheckCircle2}
          iconColor="text-emerald-500"
        />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500">
        {/* Tabs */}
        <div className="border-b border-gray-100 flex">
          <TabButton 
            label="Bankkonton" 
            icon={Building2} 
            isActive={activeTab === 'accounts'} 
            onClick={() => setActiveTab('accounts')} 
          />
          <TabButton 
            label="Transaktioner" 
            icon={ArrowUpRight} 
            isActive={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')} 
          />
          <TabButton 
            label="Fakturor" 
            icon={FileText} 
            isActive={activeTab === 'invoices'} 
            onClick={() => setActiveTab('invoices')} 
          />
          <TabButton 
            label="Betalningar" 
            icon={Send} 
            isActive={activeTab === 'payments'} 
            onClick={() => setActiveTab('payments')} 
          />
        </div>

        <div className="p-6 lg:p-8">
          {/* Bank Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {accounts.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Building2 className="w-10 h-10 text-aifm-charcoal/20" />
                  </div>
                  <p className="text-aifm-charcoal/50 font-medium text-lg">Inga bankkonton</p>
                  <p className="text-sm text-aifm-charcoal/30 mt-2 mb-6">Lägg till ett bankkonto för att komma igång</p>
                  <button className="px-5 py-2.5 bg-aifm-charcoal text-white rounded-xl text-sm font-medium hover:bg-aifm-charcoal/90 transition-colors">
                    <Plus className="w-4 h-4 inline mr-2" />
                    Lägg till bankkonto
                  </button>
                </div>
              ) : (
                accounts.map((account) => (
                  <BankAccountCard 
                    key={account.id}
                    account={account}
                    isSelected={selectedAccount?.id === account.id}
                    onClick={() => setSelectedAccount(selectedAccount?.id === account.id ? null : account)}
                  />
                ))
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="relative">
                  <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Sök transaktioner..."
                    className="w-full sm:w-80 py-3 pl-11 pr-4 bg-gray-50 border-0 rounded-xl text-sm
                               placeholder:text-aifm-charcoal/30 focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-aifm-charcoal/70 
                                   bg-white border border-gray-200 rounded-xl hover:border-aifm-gold/30 transition-all">
                  <Download className="w-4 h-4" />
                  Exportera
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Datum</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Beskrivning</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Motpart</th>
                      <th className="text-left px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Kategori</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Belopp</th>
                      <th className="text-center px-5 py-4 text-xs font-semibold text-aifm-charcoal/50 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-sm text-aifm-charcoal">{formatDate(tx.date)}</td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-aifm-charcoal">{tx.description}</p>
                          <p className="text-xs text-aifm-charcoal/40 font-mono">Ref: {tx.reference}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-aifm-charcoal/70">{tx.counterparty}</td>
                        <td className="px-5 py-4">
                          <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-aifm-charcoal/70">
                            {tx.category.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className={`text-sm font-semibold flex items-center justify-end gap-1 ${
                            tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-aifm-charcoal'
                          }`}>
                            {tx.type === 'CREDIT' ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {tx.matched ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                              Matchad
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-amber-50 text-amber-600">
                              <AlertCircle className="w-3 h-3" />
                              Omatchad
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="relative">
                  <Search className="w-4 h-4 text-aifm-charcoal/30 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Sök fakturor..."
                    className="w-full sm:w-80 py-3 pl-11 pr-4 bg-gray-50 border-0 rounded-xl text-sm
                               placeholder:text-aifm-charcoal/30 focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 transition-all"
                  />
                </div>
                <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white 
                                   bg-aifm-charcoal rounded-xl hover:bg-aifm-charcoal/90 transition-all">
                  <Plus className="w-4 h-4" />
                  Ladda upp faktura
                </button>
              </div>

              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="p-5 rounded-xl bg-gray-50/50 border border-gray-100/50 hover:border-aifm-gold/20 
                               hover:shadow-lg hover:shadow-gray-100/50 transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          invoice.status === 'PAID' ? 'bg-emerald-100 group-hover:bg-emerald-200' :
                          invoice.status === 'APPROVED' ? 'bg-blue-100 group-hover:bg-blue-200' :
                          invoice.status === 'PENDING' ? 'bg-amber-100 group-hover:bg-amber-200' :
                          'bg-red-100 group-hover:bg-red-200'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            invoice.status === 'PAID' ? 'text-emerald-600' :
                            invoice.status === 'APPROVED' ? 'text-blue-600' :
                            invoice.status === 'PENDING' ? 'text-amber-600' :
                            'text-red-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-aifm-charcoal">{invoice.vendorName}</p>
                          <p className="text-sm text-aifm-charcoal/40">{invoice.invoiceNumber} • {invoice.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-lg font-semibold text-aifm-charcoal">{formatCurrency(invoice.amount, invoice.currency)}</p>
                          <p className="text-xs text-aifm-charcoal/40">Förfaller: {formatDate(invoice.dueDate)}</p>
                        </div>
                        <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${
                          invoice.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' :
                          invoice.status === 'APPROVED' ? 'bg-blue-50 text-blue-600' :
                          invoice.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {invoice.status === 'PAID' ? 'Betald' :
                           invoice.status === 'APPROVED' ? 'Godkänd' :
                           invoice.status === 'PENDING' ? 'Väntar' : 'Förfallen'}
                        </span>
                        <button className="p-2 text-aifm-charcoal/30 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-all">
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
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-aifm-charcoal/10 to-aifm-charcoal/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CreditCard className="w-10 h-10 text-aifm-charcoal/30" />
              </div>
              <h3 className="text-xl font-semibold text-aifm-charcoal mb-3">Betalningshantering</h3>
              <p className="text-aifm-charcoal/50 mb-8 max-w-md mx-auto">
                Initiera och godkänn betalningar med 4-ögonprincipen för säkra fondoperationer.
              </p>
              <button className="px-6 py-3 bg-aifm-charcoal text-white rounded-xl text-sm font-medium 
                                 hover:bg-aifm-charcoal/90 shadow-lg shadow-aifm-charcoal/20 transition-all">
                <Plus className="w-4 h-4 inline mr-2" />
                Skapa betalning
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
