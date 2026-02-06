'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle,
  Download,
  Eye,
  RefreshCw,
  Building2,
  Clock,
  FileText,
  TrendingUp,
  ArrowRight,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
  Server,
  GitCompare,
  Settings,
  Zap
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SwedBankPosition {
  isin: string;
  instrumentName: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  currency: string;
}

interface SwedBankReport {
  reportDate: string;
  accountNumber: string;
  fundName: string;
  currency: string;
  positions: SwedBankPosition[];
  cashBalance: number;
  totalMarketValue: number;
  extractedAt: string;
  confidence: number;
}

interface ProcessingResult {
  success: boolean;
  report?: SwedBankReport;
  excelBase64?: string;
  processingTimeMs: number;
  warnings?: string[];
}

interface SEBConnectionStatus {
  connected: boolean;
  message: string;
  isMockClient: boolean;
  details?: {
    tokenValid: boolean;
    accountsAccessible: boolean;
    custodyAccessible: boolean;
  };
}

interface SEBPosition {
  accountId: string;
  isin: string;
  instrumentName: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  currency: string;
}

// ============================================================================
// Components
// ============================================================================

function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label,
  badge 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType; 
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-all
        ${active 
          ? 'bg-aifm-charcoal text-white shadow-md' 
          : 'text-aifm-charcoal/70 hover:bg-gray-100'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge && (
        <span className={`
          ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded
          ${active ? 'bg-white/20 text-white' : 'bg-aifm-gold/20 text-aifm-gold'}
        `}>
          {badge}
        </span>
      )}
    </button>
  );
}

// Drag and Drop Zone
function DropZone({ 
  onFileSelect, 
  isProcessing 
}: { 
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300
        ${isDragging 
          ? 'border-aifm-gold bg-aifm-gold/5 scale-[1.02]' 
          : 'border-gray-200 hover:border-aifm-gold/50 hover:bg-gray-50'
        }
        ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />
      
      <div className="flex flex-col items-center gap-4">
        {isProcessing ? (
          <Loader2 className="w-12 h-12 text-aifm-gold animate-spin" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-orange-500" />
          </div>
        )}
        
        <div>
          <p className="text-lg font-medium text-aifm-charcoal">
            {isProcessing ? 'Processerar PDF...' : 'Dra och släpp Swedbank-PDF här'}
          </p>
          <p className="text-sm text-aifm-charcoal/60 mt-1">
            {isProcessing 
              ? 'Extraherar data med Textract & Claude AI...'
              : 'eller klicka för att välja fil'
            }
          </p>
        </div>
        
        {!isProcessing && (
          <div className="flex items-center gap-4 text-xs text-aifm-charcoal/40">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              PDF-format
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Swedbank Custody
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// SEB Connection Card
function SEBConnectionCard({ 
  status, 
  onRefresh,
  isLoading 
}: { 
  status: SEBConnectionStatus | null;
  onRefresh: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            status?.connected ? 'bg-emerald-100' : 'bg-gray-100'
          }`}>
            {status?.connected ? (
              <Wifi className="w-5 h-5 text-emerald-600" />
            ) : (
              <WifiOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-aifm-charcoal">SEB API-anslutning</h3>
            <p className="text-sm text-aifm-charcoal/60">
              {status?.connected 
                ? status.isMockClient ? 'Ansluten (Demo-läge)' : 'Ansluten till SEB' 
                : 'Ej ansluten'}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {status?.details && (
        <div className="grid grid-cols-3 gap-3">
          <StatusIndicator 
            label="OAuth Token" 
            active={status.details.tokenValid} 
          />
          <StatusIndicator 
            label="Konton" 
            active={status.details.accountsAccessible} 
          />
          <StatusIndicator 
            label="Custody" 
            active={status.details.custodyAccessible} 
          />
        </div>
      )}
      
      {status?.isMockClient && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg">
          <p className="text-xs text-amber-700">
            <strong>Demo-läge:</strong> Använder mock-data. Konfigurera SEB_CLIENT_ID och SEB_CLIENT_SECRET för riktig integration.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`p-2 rounded-lg text-center ${active ? 'bg-emerald-50' : 'bg-gray-50'}`}>
      <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      <span className={`text-xs ${active ? 'text-emerald-700' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

// SEB Positions Card
function SEBPositionsCard({
  positions,
  isLoading,
  onFetchPositions
}: {
  positions: SEBPosition[];
  isLoading: boolean;
  onFetchPositions: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayPositions = expanded ? positions : positions.slice(0, 5);
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-aifm-charcoal">SEB Custody-positioner</h3>
            <p className="text-sm text-aifm-charcoal/60">
              {positions.length} positioner • {formatCurrency(totalValue)}
            </p>
          </div>
        </div>
        <button
          onClick={onFetchPositions}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 bg-aifm-charcoal text-white rounded-lg text-sm hover:bg-aifm-charcoal/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Hämta data
        </button>
      </div>
      
      {positions.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">ISIN</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Instrument</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Antal</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Kurs</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Värde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayPositions.map((pos, i) => (
                  <tr key={`${pos.isin}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{pos.isin}</td>
                    <td className="px-4 py-3 font-medium">{pos.instrumentName}</td>
                    <td className="px-4 py-3 text-right">{pos.quantity.toLocaleString('sv-SE')}</td>
                    <td className="px-4 py-3 text-right">{pos.marketPrice.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(pos.marketValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {positions.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-4 py-3 text-sm text-aifm-gold hover:bg-aifm-gold/5 flex items-center justify-center gap-2 border-t border-gray-100"
            >
              {expanded ? (
                <>Visa färre <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Visa alla {positions.length} positioner <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </>
      )}
      
      {positions.length === 0 && !isLoading && (
        <div className="p-8 text-center text-gray-500">
          <Server className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>Klicka "Hämta data" för att ladda positioner från SEB</p>
        </div>
      )}
    </div>
  );
}

// Result Card for Swedbank
function SwedBankResultCard({ 
  result, 
  onDownloadExcel,
  onClose,
  onRunReconciliation
}: { 
  result: ProcessingResult;
  onDownloadExcel: () => void;
  onClose: () => void;
  onRunReconciliation: () => void;
}) {
  const [showPositions, setShowPositions] = useState(false);
  
  if (!result.report) return null;
  
  const report = result.report;
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">PDF processerad!</h3>
            <p className="text-sm text-white/80">
              {result.processingTimeMs}ms • {(report.confidence * 100).toFixed(0)}% konfidensgrad
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <p className="text-sm text-amber-700">{result.warnings.join(', ')}</p>
        </div>
      )}
      
      {/* Content */}
      <div className="p-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard 
            label="Rapportdatum" 
            value={report.reportDate}
            icon={Clock}
          />
          <SummaryCard 
            label="Fond" 
            value={report.fundName}
            icon={Building2}
          />
          <SummaryCard 
            label="Antal positioner" 
            value={report.positions.length.toString()}
            icon={FileSpreadsheet}
          />
          <SummaryCard 
            label="Totalt värde" 
            value={formatCurrency(report.totalMarketValue)}
            icon={TrendingUp}
            highlight
          />
        </div>
        
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={onDownloadExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-charcoal text-white rounded-xl hover:bg-aifm-charcoal/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Ladda ner Excel
          </button>
          <button
            onClick={() => setShowPositions(!showPositions)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-aifm-charcoal rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {showPositions ? 'Dölj' : 'Visa'} positioner
          </button>
          <button
            onClick={onRunReconciliation}
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors"
          >
            <GitCompare className="w-4 h-4" />
            Kör avstämning
          </button>
        </div>
        
        {/* Positions Table */}
        {showPositions && (
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-500">ISIN</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Instrument</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Antal</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Kurs</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Värde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.positions.map((pos, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{pos.isin || '-'}</td>
                      <td className="px-4 py-3">{pos.instrumentName}</td>
                      <td className="px-4 py-3 text-right">{pos.quantity.toLocaleString('sv-SE')}</td>
                      <td className="px-4 py-3 text-right">{pos.marketPrice.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(pos.marketValue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-aifm-charcoal text-white">
                    <td colSpan={4} className="px-4 py-3 font-medium">Totalt</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(report.totalMarketValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ 
  label, 
  value, 
  icon: Icon,
  highlight 
}: { 
  label: string; 
  value: string; 
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-xl ${highlight ? 'bg-aifm-gold/10' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${highlight ? 'text-aifm-gold' : 'text-gray-400'}`} />
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`font-semibold ${highlight ? 'text-aifm-gold' : 'text-aifm-charcoal'}`}>
        {value}
      </p>
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

function Step({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-aifm-gold text-white text-xs font-bold flex items-center justify-center">
        {number}
      </div>
      <span className="text-aifm-charcoal/70">{label}</span>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function BankReconciliationPage() {
  const [activeTab, setActiveTab] = useState<'seb' | 'swedbank'>('seb');
  
  // Swedbank state
  const [isProcessing, setIsProcessing] = useState(false);
  const [swedbankResult, setSwedbankResult] = useState<ProcessingResult | null>(null);
  const [swedbankError, setSwedbankError] = useState<string | null>(null);
  
  // SEB state
  const [sebStatus, setSebStatus] = useState<SEBConnectionStatus | null>(null);
  const [sebPositions, setSebPositions] = useState<SEBPosition[]>([]);
  const [isSEBLoading, setIsSEBLoading] = useState(false);
  const [isFetchingPositions, setIsFetchingPositions] = useState(false);
  
  // Check SEB connection on mount
  useEffect(() => {
    checkSEBConnection();
  }, []);
  
  const checkSEBConnection = async () => {
    setIsSEBLoading(true);
    try {
      const response = await fetch('/api/bank/seb/test-connection');
      const data = await response.json();
      setSebStatus(data);
    } catch (error) {
      setSebStatus({
        connected: false,
        message: 'Failed to check connection',
        isMockClient: true,
      });
    } finally {
      setIsSEBLoading(false);
    }
  };
  
  const fetchSEBPositions = async () => {
    setIsFetchingPositions(true);
    try {
      const response = await fetch('/api/bank/seb/positions');
      const data = await response.json();
      if (data.success) {
        setSebPositions(data.positions);
      }
    } catch (error) {
      console.error('Failed to fetch SEB positions:', error);
    } finally {
      setIsFetchingPositions(false);
    }
  };
  
  const handleSwedBankFileSelect = async (file: File) => {
    setIsProcessing(true);
    setSwedbankError(null);
    setSwedbankResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/bank/swedbank/process-pdf', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }
      
      setSwedbankResult(data);
    } catch (err) {
      setSwedbankError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownloadExcel = () => {
    if (!swedbankResult?.excelBase64) return;
    
    const blob = new Blob(
      [Buffer.from(swedbankResult.excelBase64, 'base64')],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swedbank-custody-${swedbankResult.report?.reportDate || 'report'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleRunReconciliation = () => {
    // Navigate to reconciliation page with data
    window.location.href = '/nav-admin/reconciliation';
  };
  
  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
              <GitCompare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-aifm-charcoal">Bankintegration</h1>
              <p className="text-aifm-charcoal/60">Hämta custody-data från SEB och Swedbank</p>
            </div>
          </div>
          <Link
            href="/nav-admin/reconciliation"
            className="flex items-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl hover:bg-aifm-gold/90 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Kör avstämning
          </Link>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          <TabButton
            active={activeTab === 'seb'}
            onClick={() => setActiveTab('seb')}
            icon={Server}
            label="SEB API"
            badge="Live"
          />
          <TabButton
            active={activeTab === 'swedbank'}
            onClick={() => setActiveTab('swedbank')}
            icon={Upload}
            label="Swedbank PDF"
          />
        </div>
      </div>
      
      {/* SEB Tab */}
      {activeTab === 'seb' && (
        <div className="space-y-6">
          {/* Connection Status */}
          <SEBConnectionCard
            status={sebStatus}
            onRefresh={checkSEBConnection}
            isLoading={isSEBLoading}
          />
          
          {/* Positions */}
          <SEBPositionsCard
            positions={sebPositions}
            isLoading={isFetchingPositions}
            onFetchPositions={fetchSEBPositions}
          />
          
          {/* Info */}
          <div className="p-4 bg-blue-50 rounded-xl">
            <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              SEB Developer Portal Setup
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>1. Registrera på <a href="https://developer.sebgroup.com" target="_blank" rel="noopener noreferrer" className="underline">developer.sebgroup.com</a></li>
              <li>2. Skapa en applikation och begär access till Global Custody API</li>
              <li>3. Konfigurera miljövariablerna SEB_CLIENT_ID och SEB_CLIENT_SECRET</li>
              <li>4. Mappa fonderna till SEB custody-konton</li>
            </ul>
          </div>
        </div>
      )}
      
      {/* Swedbank Tab */}
      {activeTab === 'swedbank' && (
        <div className="space-y-6">
          {/* How it works */}
          <div className="p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100">
            <h3 className="text-sm font-semibold text-aifm-charcoal mb-4">Så fungerar det</h3>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <Step number={1} label="Ladda upp PDF" />
              <ArrowRight className="w-4 h-4 text-gray-300" />
              <Step number={2} label="AI extraherar data" />
              <ArrowRight className="w-4 h-4 text-gray-300" />
              <Step number={3} label="Granska & kör avstämning" />
            </div>
          </div>
          
          {/* Upload Zone */}
          <DropZone 
            onFileSelect={handleSwedBankFileSelect}
            isProcessing={isProcessing}
          />
          
          {/* Error */}
          {swedbankError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{swedbankError}</p>
              <button
                onClick={() => setSwedbankError(null)}
                className="ml-auto p-1 hover:bg-red-100 rounded"
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}
          
          {/* Result */}
          {swedbankResult && (
            <SwedBankResultCard 
              result={swedbankResult}
              onDownloadExcel={handleDownloadExcel}
              onClose={() => setSwedbankResult(null)}
              onRunReconciliation={handleRunReconciliation}
            />
          )}
          
          {/* Info */}
          <div className="p-4 bg-orange-50 rounded-xl">
            <h4 className="text-sm font-medium text-orange-900 mb-2">💡 Automatisk email-integration</h4>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• Konfigurera AWS SES för att ta emot emails från Swedbank</li>
              <li>• PDF-bilagor processas automatiskt när de anländer</li>
              <li>• Se <code className="bg-orange-100 px-1 rounded">scripts/setup-bank-integration.sh</code> för setup</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
