'use client';

import { useState, useCallback } from 'react';
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
  ChevronUp
} from 'lucide-react';

// Types
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
          <div className="w-16 h-16 rounded-2xl bg-aifm-gold/10 flex items-center justify-center">
            <Upload className="w-8 h-8 text-aifm-gold" />
          </div>
        )}
        
        <div>
          <p className="text-lg font-medium text-aifm-charcoal">
            {isProcessing ? 'Processerar PDF...' : 'Dra och släpp Swedbank-PDF här'}
          </p>
          <p className="text-sm text-aifm-charcoal/60 mt-1">
            {isProcessing 
              ? 'Extraherar data med AI...'
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

// Result Card
function ResultCard({ 
  result, 
  onDownloadExcel,
  onClose 
}: { 
  result: ProcessingResult;
  onDownloadExcel: () => void;
  onClose: () => void;
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
        <div className="flex items-center gap-3 mb-6">
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
            {showPositions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

// Main Page
export default function BankReconciliationPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    
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
      
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownloadExcel = () => {
    if (!result?.excelBase64) return;
    
    const blob = new Blob(
      [Buffer.from(result.excelBase64, 'base64')],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swedbank-custody-${result.report?.reportDate || 'report'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-aifm-charcoal">Bankavstämning</h1>
            <p className="text-aifm-charcoal/60">Processa Swedbank custody-rapporter</p>
          </div>
        </div>
      </div>
      
      {/* How it works */}
      <div className="mb-8 p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100">
        <h3 className="text-sm font-semibold text-aifm-charcoal mb-4">Så fungerar det</h3>
        <div className="flex items-center gap-4 text-sm">
          <Step number={1} label="Ladda upp PDF" />
          <ArrowRight className="w-4 h-4 text-gray-300" />
          <Step number={2} label="AI extraherar data" />
          <ArrowRight className="w-4 h-4 text-gray-300" />
          <Step number={3} label="Granska & ladda ner Excel" />
        </div>
      </div>
      
      {/* Upload Zone */}
      <DropZone 
        onFileSelect={handleFileSelect}
        isProcessing={isProcessing}
      />
      
      {/* Error */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
      
      {/* Result */}
      {result && (
        <div className="mt-6">
          <ResultCard 
            result={result}
            onDownloadExcel={handleDownloadExcel}
            onClose={() => setResult(null)}
          />
        </div>
      )}
      
      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Emails från Swedbank processas automatiskt om webhook är konfigurerad</li>
          <li>• Den genererade Excel-filen kan användas direkt i NAV-avstämningen</li>
          <li>• Vid låg konfidensgrad, dubbelkolla extraherade värden</li>
        </ul>
      </div>
    </div>
  );
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
