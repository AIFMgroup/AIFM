'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Building2,
  FileSpreadsheet,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Calendar,
  Loader2
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PositionComparison {
  isin: string;
  instrumentName: string;
  secura: { quantity: number; price: number; value: number } | null;
  bank: { quantity: number; price: number; value: number; source: string } | null;
  differences: {
    quantityDiff: number;
    quantityDiffPercent: number;
    priceDiff: number;
    priceDiffPercent: number;
    valueDiff: number;
    valueDiffPercent: number;
  };
  status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'MISSING_SECURA' | 'MISSING_BANK';
  flags: string[];
}

interface ReconciliationResult {
  fundId: string;
  fundName: string;
  reconciliationDate: string;
  generatedAt: string;
  summary: {
    totalPositions: number;
    matchingPositions: number;
    minorDifferences: number;
    majorDifferences: number;
    missingInSecura: number;
    missingInBank: number;
    securaTotalValue: number;
    bankTotalValue: number;
    totalValueDifference: number;
    totalValueDifferencePercent: number;
    overallStatus: 'APPROVED' | 'REVIEW_REQUIRED' | 'FAILED';
  };
  cashComparison: {
    currency: string;
    securaBalance: number;
    bankBalance: number;
    difference: number;
    differencePercent: number;
    status: string;
    flags: string[];
  };
  positions: PositionComparison[];
  flags: { level: string; message: string; details?: string }[];
  sources: {
    secura: { timestamp: string; dataPoints: number };
    bank: { source: string; timestamp: string; dataPoints: number };
  };
}

// ============================================================================
// Mock Data (ersätts med API-anrop)
// ============================================================================

const MOCK_RECONCILIATION: ReconciliationResult = {
  fundId: 'FUND001',
  fundName: 'AUAG Essential Metals',
  reconciliationDate: new Date().toISOString().split('T')[0],
  generatedAt: new Date().toISOString(),
  summary: {
    totalPositions: 12,
    matchingPositions: 9,
    minorDifferences: 2,
    majorDifferences: 1,
    missingInSecura: 0,
    missingInBank: 0,
    securaTotalValue: 245678901,
    bankTotalValue: 245123456,
    totalValueDifference: 555445,
    totalValueDifferencePercent: 0.23,
    overallStatus: 'REVIEW_REQUIRED',
  },
  cashComparison: {
    currency: 'SEK',
    securaBalance: 15234567,
    bankBalance: 15234567,
    difference: 0,
    differencePercent: 0,
    status: 'MATCH',
    flags: [],
  },
  positions: [
    {
      isin: 'SE0017832488',
      instrumentName: 'Boliden AB',
      secura: { quantity: 50000, price: 285.50, value: 14275000 },
      bank: { quantity: 50000, price: 285.50, value: 14275000, source: 'SEB' },
      differences: { quantityDiff: 0, quantityDiffPercent: 0, priceDiff: 0, priceDiffPercent: 0, valueDiff: 0, valueDiffPercent: 0 },
      status: 'MATCH',
      flags: [],
    },
    {
      isin: 'CA0679011084',
      instrumentName: 'Barrick Gold Corp',
      secura: { quantity: 25000, price: 180.25, value: 4506250 },
      bank: { quantity: 25000, price: 178.25, value: 4456250, source: 'SEB' },
      differences: { quantityDiff: 0, quantityDiffPercent: 0, priceDiff: 2.0, priceDiffPercent: 1.12, valueDiff: 50000, valueDiffPercent: 1.12 },
      status: 'MINOR_DIFF',
      flags: ['Kurs avviker 1.12%'],
    },
    {
      isin: 'US8336351056',
      instrumentName: 'SilverCrest Metals Inc',
      secura: { quantity: 100000, price: 68.40, value: 6840000 },
      bank: { quantity: 98500, price: 65.40, value: 6441900, source: 'SEB' },
      differences: { quantityDiff: 1500, quantityDiffPercent: 1.52, priceDiff: 3.0, priceDiffPercent: 4.59, valueDiff: 398100, valueDiffPercent: 6.18 },
      status: 'MAJOR_DIFF',
      flags: ['Antal avviker 1.52%', 'Kurs avviker 4.59%'],
    },
  ],
  flags: [
    { level: 'WARNING', message: '1 position har stora avvikelser', details: 'SilverCrest Metals Inc' },
    { level: 'INFO', message: 'Kassasaldo matchar', details: 'Ingen differens i kassasaldo' },
  ],
  sources: {
    secura: { timestamp: new Date().toISOString(), dataPoints: 13 },
    bank: { source: 'SEB', timestamp: new Date().toISOString(), dataPoints: 12 },
  },
};

// ============================================================================
// Components
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config = {
    'APPROVED': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Godkänd' },
    'REVIEW_REQUIRED': { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Granskning krävs' },
    'FAILED': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Misslyckad' },
    'MATCH': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, label: 'Matchar' },
    'MINOR_DIFF': { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle, label: 'Mindre avvikelse' },
    'MAJOR_DIFF': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'Stor avvikelse' },
    'MISSING_SECURA': { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle, label: 'Saknas i Secura' },
    'MISSING_BANK': { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle, label: 'Saknas i bank' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: AlertTriangle, label: status };
  
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function SummaryCard({ 
  label, 
  value, 
  subValue,
  icon: Icon,
  trend,
  highlight
}: { 
  label: string;
  value: string;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-aifm-gold/5 border-aifm-gold/20' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${highlight ? 'text-aifm-gold' : 'text-gray-400'}`} />
        {trend && (
          trend === 'up' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
          trend === 'down' ? <TrendingDown className="w-4 h-4 text-red-500" /> :
          null
        )}
      </div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-semibold ${highlight ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  );
}

function PositionsTable({ positions, expanded, onToggle }: { 
  positions: PositionComparison[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const displayPositions = expanded ? positions : positions.slice(0, 5);
  
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-aifm-charcoal">Positionsavstämning</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{positions.length} positioner</span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-500">ISIN</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Instrument</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Secura</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Bank</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Differens</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayPositions.map((pos, i) => (
              <tr key={pos.isin} className={`hover:bg-gray-50 ${pos.status === 'MAJOR_DIFF' ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{pos.isin}</td>
                <td className="px-4 py-3 font-medium">{pos.instrumentName}</td>
                <td className="px-4 py-3 text-right">
                  {pos.secura ? formatCurrency(pos.secura.value) : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  {pos.bank ? formatCurrency(pos.bank.value) : '-'}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  pos.differences.valueDiff > 0 ? 'text-emerald-600' : 
                  pos.differences.valueDiff < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {pos.differences.valueDiff !== 0 ? (
                    <>
                      {pos.differences.valueDiff > 0 ? '+' : ''}{formatCurrency(pos.differences.valueDiff)}
                      <span className="text-xs text-gray-400 ml-1">
                        ({pos.differences.valueDiffPercent.toFixed(2)}%)
                      </span>
                    </>
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={pos.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {positions.length > 5 && (
        <button
          onClick={onToggle}
          className="w-full px-4 py-3 text-sm text-aifm-gold hover:bg-aifm-gold/5 flex items-center justify-center gap-2 border-t border-gray-100"
        >
          {expanded ? (
            <>Visa färre <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Visa alla {positions.length} positioner <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}

function FlagsList({ flags }: { flags: ReconciliationResult['flags'] }) {
  if (flags.length === 0) return null;
  
  return (
    <div className="space-y-2">
      {flags.map((flag, i) => (
        <div 
          key={i}
          className={`p-3 rounded-lg flex items-start gap-3 ${
            flag.level === 'ERROR' ? 'bg-red-50 text-red-700' :
            flag.level === 'WARNING' ? 'bg-amber-50 text-amber-700' :
            'bg-blue-50 text-blue-700'
          }`}
        >
          {flag.level === 'ERROR' ? <XCircle className="w-5 h-5 flex-shrink-0" /> :
           flag.level === 'WARNING' ? <AlertTriangle className="w-5 h-5 flex-shrink-0" /> :
           <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          <div>
            <p className="font-medium">{flag.message}</p>
            {flag.details && <p className="text-sm opacity-75 mt-0.5">{flag.details}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// Main Page
// ============================================================================

export default function ReconciliationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(MOCK_RECONCILIATION);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedPositions, setExpandedPositions] = useState(false);
  const [selectedFund, setSelectedFund] = useState('FUND001');
  
  const runReconciliation = async () => {
    setIsLoading(true);
    try {
      // TODO: Anropa API
      // const response = await fetch(`/api/bank/reconciliation?fundId=${selectedFund}&date=${selectedDate}`);
      // const data = await response.json();
      // setReconciliation(data);
      
      // Simulera API-anrop
      await new Promise(resolve => setTimeout(resolve, 2000));
      setReconciliation(MOCK_RECONCILIATION);
    } catch (error) {
      console.error('Reconciliation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Bankavstämning</h1>
            <p className="text-aifm-charcoal/60 mt-1">Jämför NAV-data från Secura med bankdata</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href="/nav-admin/bank-reconciliation"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-aifm-charcoal rounded-xl hover:bg-gray-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-sm font-medium">Ladda upp PDF</span>
            </Link>
            <button
              onClick={runReconciliation}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="text-sm font-medium">Kör avstämning</span>
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select 
              value={selectedFund}
              onChange={(e) => setSelectedFund(e.target.value)}
              className="text-sm bg-transparent border-none focus:outline-none"
            >
              <option value="FUND001">AUAG Essential Metals</option>
              <option value="FUND002">AuAg Gold Rush</option>
              <option value="FUND003">AuAg Silver Bullet</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent border-none focus:outline-none"
            />
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="text-sm bg-transparent border-none focus:outline-none">
              <option>Alla banker</option>
              <option>SEB</option>
              <option>Swedbank</option>
            </select>
          </div>
        </div>
      </div>
      
      {reconciliation ? (
        <>
          {/* Overall Status */}
          <div className={`p-6 rounded-2xl mb-6 ${
            reconciliation.summary.overallStatus === 'APPROVED' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
            reconciliation.summary.overallStatus === 'REVIEW_REQUIRED' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
            'bg-gradient-to-r from-red-500 to-red-600'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  {reconciliation.summary.overallStatus === 'APPROVED' ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : reconciliation.summary.overallStatus === 'REVIEW_REQUIRED' ? (
                    <AlertTriangle className="w-6 h-6 text-white" />
                  ) : (
                    <XCircle className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{reconciliation.fundName}</h2>
                  <p className="text-white/80 text-sm">
                    Avstämning {reconciliation.reconciliationDate} • {reconciliation.sources.bank.source}
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-white/80 text-sm">Total differens</p>
                <p className="text-2xl font-bold text-white">
                  {reconciliation.summary.totalValueDifference >= 0 ? '+' : ''}
                  {formatCurrency(reconciliation.summary.totalValueDifference)}
                </p>
                <p className="text-white/60 text-sm">
                  ({reconciliation.summary.totalValueDifferencePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          </div>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              label="Secura totalt"
              value={formatCurrency(reconciliation.summary.securaTotalValue)}
              icon={FileSpreadsheet}
              highlight
            />
            <SummaryCard
              label="Bank totalt"
              value={formatCurrency(reconciliation.summary.bankTotalValue)}
              subValue={reconciliation.sources.bank.source}
              icon={Building2}
            />
            <SummaryCard
              label="Matchande"
              value={`${reconciliation.summary.matchingPositions}/${reconciliation.summary.totalPositions}`}
              subValue={`${((reconciliation.summary.matchingPositions / reconciliation.summary.totalPositions) * 100).toFixed(0)}% matchar`}
              icon={CheckCircle2}
            />
            <SummaryCard
              label="Avvikelser"
              value={(reconciliation.summary.minorDifferences + reconciliation.summary.majorDifferences).toString()}
              subValue={`${reconciliation.summary.majorDifferences} allvarliga`}
              icon={AlertTriangle}
              trend={reconciliation.summary.majorDifferences > 0 ? 'down' : 'neutral'}
            />
          </div>
          
          {/* Flags */}
          {reconciliation.flags.length > 0 && (
            <div className="mb-6">
              <FlagsList flags={reconciliation.flags} />
            </div>
          )}
          
          {/* Cash Comparison */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
            <h3 className="font-semibold text-aifm-charcoal mb-4">Kassaavstämning</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Secura</p>
                <p className="text-xl font-semibold">{formatCurrency(reconciliation.cashComparison.securaBalance)}</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-gray-300" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bank</p>
                <p className="text-xl font-semibold">{formatCurrency(reconciliation.cashComparison.bankBalance)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">Differens</span>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-semibold ${
                  reconciliation.cashComparison.difference === 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {formatCurrency(reconciliation.cashComparison.difference)}
                </span>
                <StatusBadge status={reconciliation.cashComparison.status} />
              </div>
            </div>
          </div>
          
          {/* Positions Table */}
          <PositionsTable
            positions={reconciliation.positions}
            expanded={expandedPositions}
            onToggle={() => setExpandedPositions(!expandedPositions)}
          />
          
          {/* Footer */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Genererad: {new Date(reconciliation.generatedAt).toLocaleString('sv-SE')}
              </span>
            </div>
            <button className="flex items-center gap-2 text-aifm-gold hover:underline">
              <Download className="w-4 h-4" />
              Exportera rapport
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Välj fond och datum, sedan klicka "Kör avstämning"</p>
        </div>
      )}
    </div>
  );
}
