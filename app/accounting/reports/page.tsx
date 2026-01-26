'use client';


import { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  RefreshCw, AlertTriangle, CheckCircle2, Building2, Receipt,
  TrendingUp, PieChart, BarChart3, FileSpreadsheet, Percent
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';

// ============ Types ============
interface MonthlyReport {
  period: string;
  periodName: string;
  generatedAt: string;
  summary: {
    totalDocuments: number;
    totalAmount: number;
    totalVat: number;
    autoApprovedCount: number;
    manualApprovedCount: number;
    rejectedCount: number;
  };
  byDocumentType: { type: string; count: number; amount: number; vatAmount: number }[];
  byAccount: { account: string; accountName: string; debit: number; credit: number; count: number }[];
  byCostCenter: { costCenter: string; amount: number; count: number }[];
  bySupplier: { supplier: string; invoiceCount: number; totalAmount: number; averageAmount: number }[];
  anomalies: {
    count: number;
    bySeverity: { severity: string; count: number }[];
    topTypes: { type: string; count: number }[];
  };
}

interface VATReport {
  period: string;
  periodType: string;
  generatedAt: string;
  companyInfo: { name: string; orgNumber: string };
  salesVAT: {
    salesSweden25: number;
    salesSweden12: number;
    salesSweden6: number;
    salesExempt: number;
    salesEU: number;
    salesExport: number;
  };
  purchaseVAT: {
    purchasesSweden25: number;
    purchasesSweden12: number;
    purchasesSweden6: number;
    purchasesEU: number;
    purchasesImport: number;
  };
  calculations: {
    outputVAT: number;
    inputVAT: number;
    vatToPay: number;
  };
  details: {
    invoices: {
      supplier: string;
      invoiceNumber: string;
      date: string;
      netAmount: number;
      vatAmount: number;
      vatRate: number;
      account: string;
    }[];
    receipts: {
      supplier: string;
      date: string;
      netAmount: number;
      vatAmount: number;
      vatRate: number;
    }[];
  };
  skvFormat: Record<string, number>;
}

// ============ Helpers ============
const SWEDISH_MONTHS = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', { 
    style: 'currency', 
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(value);
}

// ============ Components ============

function MonthSelector({ 
  year, 
  month, 
  onYearChange, 
  onMonthChange 
}: { 
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
      {/* Year selector */}
      <div className="relative">
        <select
          value={year}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="appearance-none bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 pr-8 sm:pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-aifm-gold/30"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Month selector with arrows */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={() => {
            if (month === 1) {
              onYearChange(year - 1);
              onMonthChange(12);
            } else {
              onMonthChange(month - 1);
            }
          }}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
        </button>
        
        <div className="relative">
          <select
            value={month}
            onChange={(e) => onMonthChange(parseInt(e.target.value))}
            className="appearance-none bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 pr-8 sm:pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-aifm-gold/30 min-w-[100px] sm:min-w-[140px]"
          >
            {SWEDISH_MONTHS.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        
        <button
          onClick={() => {
            if (month === 12) {
              onYearChange(year + 1);
              onMonthChange(1);
            } else {
              onMonthChange(month + 1);
            }
          }}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
}

function MonthlyReportView({ report }: { report: MonthlyReport }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <span className="text-xs sm:text-sm text-gray-500">Dokument</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{report.summary.totalDocuments}</p>
        </div>
        
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <span className="text-xs sm:text-sm text-gray-500 truncate">Totalt belopp</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(report.summary.totalAmount)}</p>
        </div>
        
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <span className="text-xs sm:text-sm text-gray-500">Total moms</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(report.summary.totalVat)}</p>
        </div>
        
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 p-3 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-aifm-gold/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-aifm-gold" />
            </div>
            <span className="text-xs sm:text-sm text-gray-500">Auto-godkända</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{report.summary.autoApprovedCount}</p>
          <p className="text-[10px] sm:text-xs text-gray-400">{report.summary.manualApprovedCount} manuellt</p>
        </div>
      </div>

      {/* Per Account Table */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Per konto</h3>
          <p className="text-xs sm:text-sm text-gray-500">Bokförda belopp per BAS-konto</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Konto</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Namn</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Debet</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Antal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.byAccount.slice(0, 15).map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-mono text-gray-900">{row.account}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{row.accountName}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                    {formatCurrency(row.debit)}
                  </td>
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-500">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per Supplier Table */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Per leverantör</h3>
          <p className="text-xs sm:text-sm text-gray-500">Top 20 leverantörer efter belopp</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Leverantör</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Fakturor</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Totalt</th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Snitt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.bySupplier.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 truncate max-w-[150px] sm:max-w-none">{row.supplier}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-500">{row.invoiceCount}</td>
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                    {formatCurrency(row.totalAmount)}
                  </td>
                  <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-right text-gray-500">
                    {formatCurrency(row.averageAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomalies */}
      {report.anomalies.count > 0 && (
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Anomalier under perioden</h3>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
            {report.anomalies.count} dokument flaggades med avvikelser
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {report.anomalies.bySeverity.map((s, i) => (
              <span 
                key={i}
                className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                  s.severity === 'HIGH' || s.severity === 'CRITICAL' 
                    ? 'bg-red-100 text-red-700' 
                    : s.severity === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {s.severity}: {s.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VATReportView({ report }: { report: VATReport }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Momsrapport</h2>
            <p className="text-purple-200 mt-1">{report.companyInfo.name} ({report.companyInfo.orgNumber})</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">
              {report.calculations.vatToPay >= 0 
                ? formatCurrency(report.calculations.vatToPay)
                : formatCurrency(Math.abs(report.calculations.vatToPay))
              }
            </p>
            <p className="text-purple-200">
              {report.calculations.vatToPay >= 0 ? 'Att betala' : 'Att få tillbaka'}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Utgående moms</h4>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.calculations.outputVAT)}</p>
          <p className="text-xs text-gray-400 mt-1">Från försäljning</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Ingående moms</h4>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(report.calculations.inputVAT)}</p>
          <p className="text-xs text-gray-400 mt-1">Från inköp (avdragsgill)</p>
        </div>
        <div className={`rounded-xl border p-5 ${
          report.calculations.vatToPay >= 0 
            ? 'bg-red-50 border-red-100' 
            : 'bg-emerald-50 border-emerald-100'
        }`}>
          <h4 className="text-sm font-medium text-gray-500 mb-3">Netto</h4>
          <p className={`text-2xl font-bold ${
            report.calculations.vatToPay >= 0 ? 'text-red-600' : 'text-emerald-600'
          }`}>
            {report.calculations.vatToPay >= 0 ? '+' : '-'}{formatCurrency(Math.abs(report.calculations.vatToPay))}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {report.calculations.vatToPay >= 0 ? 'Moms att betala' : 'Moms att få tillbaka'}
          </p>
        </div>
      </div>

      {/* Ingående moms per momssats */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Ingående moms per momssats</h3>
          <p className="text-sm text-gray-500">Beskattningsunderlag</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">25% moms</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(report.purchaseVAT.purchasesSweden25)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Moms: {formatCurrency(report.purchaseVAT.purchasesSweden25 * 0.25)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">12% moms</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(report.purchaseVAT.purchasesSweden12)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Moms: {formatCurrency(report.purchaseVAT.purchasesSweden12 * 0.12)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-1">6% moms</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(report.purchaseVAT.purchasesSweden6)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Moms: {formatCurrency(report.purchaseVAT.purchasesSweden6 * 0.06)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SKV Format Preview */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">SKV-format</h3>
            <p className="text-sm text-gray-500">Förberett för Skatteverkets momsdeklaration</p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            Förhandsvisning
          </span>
        </div>
        <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(report.skvFormat)
            .filter(([_, value]) => value !== 0)
            .map(([field, value]) => (
              <div key={field} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 font-mono">Ruta {field.replace('field', '')}</p>
                <p className="text-sm font-medium text-gray-900">{formatNumber(value)}</p>
              </div>
            ))
          }
        </div>
      </div>

      {/* Detail Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Fakturor</h3>
            <p className="text-sm text-gray-500">{report.details.invoices.length} st</p>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Leverantör</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Netto</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Moms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.details.invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900 truncate max-w-[150px]">{inv.supplier}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(inv.netAmount)}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(inv.vatAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Receipts */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Kvitton</h3>
            <p className="text-sm text-gray-500">{report.details.receipts.length} st</p>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Leverantör</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Netto</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Moms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.details.receipts.map((rec, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900 truncate max-w-[150px]">{rec.supplier}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(rec.netAmount)}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(rec.vatAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Main Component ============

export default function AccountingReportsPage() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'monthly' | 'vat'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [vatReport, setVatReport] = useState<VATReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'monthly') {
        const response = await fetch(
          `/api/accounting/reports?companyId=${selectedCompany.id}&type=monthly&year=${year}&month=${month}`
        );
        if (!response.ok) throw new Error('Failed to load report');
        const data = await response.json();
        setMonthlyReport(data.report);
      } else {
        const response = await fetch(
          `/api/accounting/reports?companyId=${selectedCompany.id}&type=vat&year=${year}&month=${month}&companyName=${encodeURIComponent(selectedCompany.name)}&orgNumber=${selectedCompany.orgNumber || '556xxx-xxxx'}`
        );
        if (!response.ok) throw new Error('Failed to load report');
        const data = await response.json();
        setVatReport(data.report);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedCompany.id, activeTab, year, month]);

  const downloadCSV = () => {
    const url = `/api/accounting/reports?companyId=${selectedCompany.id}&type=${activeTab}&year=${year}&month=${month}&format=csv`;
    window.open(url, '_blank');
  };

  const downloadFinancialPdf = (type: 'balanceSheet' | 'incomeStatement') => {
    const url = `/api/accounting/reports?companyId=${selectedCompany.id}&type=${type}&year=${year}&month=${month}&format=pdf&companyName=${encodeURIComponent(selectedCompany.name)}`;
    window.open(url, '_blank');
  };

  return (
    
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Rapporter</h1>
            <p className="text-sm text-gray-500 mt-1">
              Månadsrapporter och momsunderlag för {selectedCompany.name}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <MonthSelector
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            
            <button
              onClick={loadReport}
              disabled={isLoading}
              className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={downloadCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl text-sm font-medium hover:bg-aifm-gold/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportera CSV
            </button>

            <button
              onClick={() => downloadFinancialPdf('balanceSheet')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              title="Balansräkning (PDF)"
            >
              <FileText className="w-4 h-4" />
              Balans PDF
            </button>

            <button
              onClick={() => downloadFinancialPdf('incomeStatement')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              title="Resultaträkning (PDF)"
            >
              <FileText className="w-4 h-4" />
              Resultat PDF
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Månadsrapport
          </button>
          <button
            onClick={() => setActiveTab('vat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'vat'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Percent className="w-4 h-4" />
            Momsrapport
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-aifm-gold animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Genererar rapport...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">{error}</p>
              <button 
                onClick={loadReport}
                className="mt-4 px-4 py-2 bg-aifm-gold text-white rounded-lg hover:bg-aifm-gold/90"
              >
                Försök igen
              </button>
            </div>
          </div>
        ) : activeTab === 'monthly' && monthlyReport ? (
          <MonthlyReportView report={monthlyReport} />
        ) : activeTab === 'vat' && vatReport ? (
          <VATReportView report={vatReport} />
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500">Ingen data tillgänglig för vald period</p>
          </div>
        )}
      </div>
    
  );
}








