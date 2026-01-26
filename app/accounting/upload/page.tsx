'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { 
  Upload, FileText, CheckCircle2, Trash2, 
  File, FileSpreadsheet, FileImage, Sparkles,
  ArrowRight, X, Send, Edit3, Eye, ChevronDown,
  AlertTriangle, Clock, Zap, Building2, Receipt,
  CreditCard, Truck, Briefcase, MoreHorizontal, RefreshCw,
  Camera, FolderOpen, Download, Loader2, FolderInput,
  Search, Filter, CheckSquare, Square, XCircle, SortAsc, SortDesc,
  ArrowUpDown, Copy, TrendingDown
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';
import { FeedbackChat } from '@/components/accounting/FeedbackChat';
import { DocumentDetailView } from '@/components/accounting/DocumentDetailViews';

// ============ Types ============
interface LineItem {
  id: string;
  description: string;
  netAmount: number;
  vatAmount: number;
  suggestedAccount: string;
  suggestedCostCenter: string | null;
  confidence: number;
}

interface Classification {
  docType: 'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'BANK' | 'OTHER';
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  totalAmount: number;
  vatAmount: number;
  lineItems: LineItem[];
  overallConfidence: number;
}

interface AccountingJob {
  id: string;
  companyId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'queued' | 'uploading' | 'scanning' | 'ocr' | 'analyzing' | 'ready' | 'approved' | 'sent' | 'error' | 'split' | 'completed';
  createdAt: string;
  updatedAt: string;
  ocrText?: string;
  classification?: Classification;
  fortnoxVoucherId?: string;
  error?: string;
  message?: string;
  splitInfo?: {
    receiptCount: number;
    childJobIds: string[];
  };
}

// ============ Account/Cost Center Options ============
const accountOptions = [
  { value: '4010', label: '4010 – Inköp varor', category: 'Inköp' },
  { value: '5010', label: '5010 – Lokalhyra', category: 'Lokalkostnader' },
  { value: '5810', label: '5810 – Biljetter', category: 'Resekostnader' },
  { value: '6100', label: '6100 – Kontorsmaterial', category: 'Övriga kostnader' },
  { value: '6212', label: '6212 – Telefon och internet', category: 'Övriga kostnader' },
  { value: '6530', label: '6530 – Redovisningstjänster', category: 'Övriga kostnader' },
  { value: '6540', label: '6540 – IT-tjänster', category: 'Övriga kostnader' },
  { value: '6550', label: '6550 – Konsultarvoden', category: 'Övriga kostnader' },
  { value: '7010', label: '7010 – Löner', category: 'Personalkostnader' },
];

const costCenterOptions = [
  { value: '', label: 'Inget kostnadsställe' },
  { value: 'ADM', label: 'ADM – Administration' },
  { value: 'IT', label: 'IT – IT & Teknik' },
  { value: 'KONTOR', label: 'KONTOR – Kontorskostnader' },
  { value: 'RESA', label: 'RESA – Resor & Logi' },
  { value: 'REP', label: 'REP – Representation' },
  { value: 'LOKAL', label: 'LOKAL – Lokalkostnader' },
  { value: 'FUND1', label: 'FUND1 – Nordic Ventures I' },
  { value: 'FUND2', label: 'FUND2 – Nordic Ventures II' },
  { value: 'SALES', label: 'SALES – Försäljning' },
];

// ============ API Functions ============
interface IngestResult {
  jobId: string;
  status: string;
  message?: string;
  duplicate?: {
    existingJobId: string;
    existingJobDate: string;
    reason: string;
    confidence: string;
  };
}

class DuplicateError extends Error {
  duplicate: IngestResult['duplicate'];
  
  constructor(message: string, duplicate: IngestResult['duplicate']) {
    super(message);
    this.name = 'DuplicateError';
    this.duplicate = duplicate;
  }
}

async function ingestDocument(file: File, companyId: string): Promise<IngestResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);
  
  const response = await fetch('/api/accounting/ingest', {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  
  if (!response.ok) {
    // Handle duplicate (409 Conflict)
    if (response.status === 409) {
      throw new DuplicateError(
        data.message || 'Duplikat upptäckt',
        data.duplicate
      );
    }
    throw new Error(data.error || data.message || 'Uppladdning misslyckades');
  }
  
  return data;
}

async function fetchJobs(companyId: string): Promise<AccountingJob[]> {
  const response = await fetch(`/api/accounting/ingest?companyId=${companyId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch jobs');
  }
  const data = await response.json();
  return data.jobs;
}

async function fetchJob(jobId: string): Promise<AccountingJob> {
  const response = await fetch(`/api/accounting/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch job');
  }
  return response.json();
}

async function updateJob(jobId: string, lineItems: { id: string; suggestedAccount?: string; suggestedCostCenter?: string | null }[]): Promise<void> {
  const response = await fetch(`/api/accounting/jobs/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lineItems }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update job');
  }
}

async function approveJob(jobId: string, action: 'approve' | 'sendToFortnox'): Promise<{ fortnoxVoucherId?: string }> {
  const response = await fetch('/accounting/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, action }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to approve job');
  }
  
  return response.json();
}

async function deleteJob(jobId: string): Promise<void> {
  const response = await fetch(`/api/accounting/jobs/${jobId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete job');
  }
}

// ============ Batch Operations API ============
interface BatchResult {
  success: boolean;
  message: string;
  results: { jobId: string; success: boolean; error?: string; fortnoxVoucherId?: string }[];
  summary: { total: number; success: number; failed: number };
}

async function batchApprove(jobIds: string[]): Promise<BatchResult> {
  const response = await fetch('/api/accounting/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve', jobIds }),
  });
  
  if (!response.ok) {
    throw new Error('Batch-godkännande misslyckades');
  }
  
  return response.json();
}

async function batchSendToFortnox(jobIds: string[]): Promise<BatchResult> {
  const response = await fetch('/api/accounting/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sendToFortnox', jobIds }),
  });
  
  if (!response.ok) {
    throw new Error('Batch-skicka misslyckades');
  }
  
  return response.json();
}

// ============ Filter & Sort Types ============
type SortField = 'date' | 'amount' | 'supplier' | 'status';
type SortDirection = 'asc' | 'desc';

interface FilterState {
  search: string;
  docType: 'ALL' | 'INVOICE' | 'RECEIPT' | 'BANK' | 'OTHER';
  minAmount: number | null;
  maxAmount: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  confidence: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const defaultFilters: FilterState = {
  search: '',
  docType: 'ALL',
  minAmount: null,
  maxAmount: null,
  dateFrom: null,
  dateTo: null,
  confidence: 'ALL',
};

interface FortnoxImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

async function importFromFortnox(companyId: string, options?: {
  fromDate?: string;
  toDate?: string;
  includeBooked?: boolean;
}): Promise<FortnoxImportResult> {
  const params = new URLSearchParams({ companyId });
  if (options?.fromDate) params.append('fromDate', options.fromDate);
  if (options?.toDate) params.append('toDate', options.toDate);
  if (options?.includeBooked) params.append('includeBooked', 'true');
  
  const response = await fetch(`/api/accounting/import-fortnox?${params}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error('Fortnox-import misslyckades');
  }
  
  return response.json();
}

// Helper to recursively read files from dropped folders
async function getAllFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
  const items = Array.from(dataTransfer.items);
  
  const processEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      return new Promise((resolve) => {
        fileEntry.file((file) => {
          // Filter for supported file types
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'xlsx', 'xls'].includes(ext || '')) {
            files.push(file);
          }
          resolve();
        }, () => resolve());
      });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();
      
      return new Promise((resolve) => {
        const readEntries = () => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve();
              return;
            }
            
            await Promise.all(entries.map(processEntry));
            readEntries(); // Continue reading if there are more entries
          }, () => resolve());
        };
        readEntries();
      });
    }
  };
  
  const entries = items
    .filter(item => item.kind === 'file')
    .map(item => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);
  
  await Promise.all(entries.map(processEntry));
  
  return files;
}

// ============ Currency Helpers ============

const CURRENCY_INFO: Record<string, { symbol: string; flag: string; name: string }> = {
  SEK: { symbol: 'kr', flag: '🇸🇪', name: 'Svenska kronor' },
  EUR: { symbol: '€', flag: '🇪🇺', name: 'Euro' },
  USD: { symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  GBP: { symbol: '£', flag: '🇬🇧', name: 'Brittiska pund' },
  DKK: { symbol: 'kr', flag: '🇩🇰', name: 'Danska kronor' },
  NOK: { symbol: 'kr', flag: '🇳🇴', name: 'Norska kronor' },
  CHF: { symbol: 'Fr', flag: '🇨🇭', name: 'Schweiziska franc' },
};

function formatCurrency(amount: number, currency: string): string {
  const info = CURRENCY_INFO[currency];
  if (currency === 'SEK') {
    return `${amount.toLocaleString('sv-SE')} kr`;
  }
  if (info) {
    return `${info.symbol}${amount.toLocaleString('sv-SE')}`;
  }
  return `${amount.toLocaleString('sv-SE')} ${currency}`;
}

function CurrencyBadge({ currency }: { currency: string }) {
  if (currency === 'SEK') return null;
  
  const info = CURRENCY_INFO[currency];
  if (!info) return <span className="text-xs text-gray-500">{currency}</span>;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
      <span>{info.flag}</span>
      <span>{currency}</span>
    </span>
  );
}

// ============ Components ============

// Pill Tab Navigation
function PillTabs({ 
  tabs, 
  activeTab, 
  onChange 
}: { 
  tabs: { id: string; label: string; count?: number; icon?: React.ElementType }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex bg-gray-100/80 rounded-xl p-1 gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300
              flex items-center gap-2
              ${isActive 
                ? 'bg-white text-aifm-charcoal shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }
            `}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`
                px-1.5 py-0.5 text-xs rounded-full
                ${isActive ? 'bg-aifm-gold/20 text-aifm-gold' : 'bg-gray-200 text-gray-500'}
              `}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Custom Select (no standard dropdown)
function CustomSelect({ 
  value, 
  options, 
  onChange, 
  placeholder = 'Välj...',
  compact = false
}: { 
  value: string; 
  options: { value: string; label: string; category?: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const groupedOptions = options.reduce((acc, opt) => {
    const cat = opt.category || 'Övriga';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {} as Record<string, typeof options>);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 bg-white border border-gray-200 
          rounded-lg transition-all hover:border-aifm-gold/50 focus:outline-none focus:border-aifm-gold focus:ring-2 focus:ring-aifm-gold/10
          ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'}
          ${isOpen ? 'border-aifm-gold ring-2 ring-aifm-gold/10' : ''}
        `}
      >
        <span className={selectedOption ? 'text-aifm-charcoal' : 'text-gray-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto py-1">
            {Object.entries(groupedOptions).map(([category, opts]) => (
              <div key={category}>
                {Object.keys(groupedOptions).length > 1 && (
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                    {category}
                  </div>
                )}
                {opts.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full text-left px-3 py-2 text-sm transition-colors
                      ${opt.value === value 
                        ? 'bg-aifm-gold/10 text-aifm-gold' 
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Status Badge
function StatusBadge({ status, splitInfo }: { status: AccountingJob['status']; splitInfo?: AccountingJob['splitInfo'] }) {
  const configs = {
    queued: { icon: Clock, label: 'I kö...', bg: 'bg-gray-50', text: 'text-gray-600', animate: true },
    uploading: { icon: Clock, label: 'Laddar upp...', bg: 'bg-blue-50', text: 'text-blue-600', animate: true },
    scanning: { icon: Zap, label: 'Skannar...', bg: 'bg-purple-50', text: 'text-purple-600', animate: true },
    ocr: { icon: Eye, label: 'OCR...', bg: 'bg-indigo-50', text: 'text-indigo-600', animate: true },
    analyzing: { icon: Sparkles, label: 'AI analyserar...', bg: 'bg-aifm-gold/10', text: 'text-aifm-gold', animate: true },
    ready: { icon: CheckCircle2, label: 'Klar för granskning', bg: 'bg-emerald-50', text: 'text-emerald-600', animate: false },
    approved: { icon: CheckCircle2, label: 'Godkänd', bg: 'bg-green-50', text: 'text-green-600', animate: false },
    sent: { icon: Send, label: 'Skickad till Fortnox', bg: 'bg-aifm-charcoal/10', text: 'text-aifm-charcoal', animate: false },
    error: { icon: AlertTriangle, label: 'Fel', bg: 'bg-red-50', text: 'text-red-600', animate: false },
    split: { icon: Copy, label: splitInfo ? `Uppdelad (${splitInfo.receiptCount} kvitton)` : 'Uppdelad', bg: 'bg-violet-50', text: 'text-violet-600', animate: false },
    completed: { icon: CheckCircle2, label: 'Klar', bg: 'bg-green-50', text: 'text-green-600', animate: false },
  };
  
  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className={`w-3.5 h-3.5 ${config.animate ? 'animate-pulse' : ''}`} />
      {config.label}
    </span>
  );
}

// Document Type Labels
const DOC_TYPE_LABELS: Record<string, { 
  name: string; 
  numberLabel: string; 
  dateLabel: string;
  icon: React.ElementType;
  color: string;
}> = {
  INVOICE: { name: 'Faktura', numberLabel: 'Fakturanr', dateLabel: 'Fakturadatum', icon: Receipt, color: 'text-blue-500 bg-blue-50' },
  CREDIT_NOTE: { name: 'Kreditnota', numberLabel: 'Kreditnotanr', dateLabel: 'Datum', icon: TrendingDown, color: 'text-purple-600 bg-purple-50' },
  RECEIPT: { name: 'Kvitto', numberLabel: 'Kvittonr', dateLabel: 'Datum', icon: CreditCard, color: 'text-green-500 bg-green-50' },
  BANK: { name: 'Kontoutdrag', numberLabel: 'Referens', dateLabel: 'Datum', icon: Building2, color: 'text-purple-500 bg-purple-50' },
  OTHER: { name: 'Dokument', numberLabel: 'Referens', dateLabel: 'Datum', icon: FileText, color: 'text-gray-500 bg-gray-50' },
};

// ============ Search & Filter Bar ============
function SearchFilterBar({ 
  filters, 
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  resultCount,
}: { 
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  resultCount: number;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = filters.docType !== 'ALL' || filters.minAmount !== null || 
    filters.maxAmount !== null || filters.dateFrom !== null || 
    filters.dateTo !== null || filters.confidence !== 'ALL';

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      onSortChange(field, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(field, 'desc');
    }
  };

  return (
    <div className="space-y-3">
      {/* Search + Quick filters row */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Sök leverantör, belopp, fakturanummer..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/30 focus:border-aifm-gold transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Doc Type Filter */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          {['ALL', 'INVOICE', 'RECEIPT'].map((type) => (
            <button
              key={type}
              onClick={() => onFiltersChange({ ...filters, docType: type as FilterState['docType'] })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filters.docType === type
                  ? 'bg-white text-aifm-charcoal shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {type === 'ALL' ? 'Alla' : type === 'INVOICE' ? 'Fakturor' : 'Kvitton'}
            </button>
          ))}
        </div>

        {/* Toggle advanced filters */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            hasActiveFilters || showFilters
              ? 'border-aifm-gold bg-aifm-gold/10 text-aifm-gold'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filter
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-aifm-gold rounded-full" />
          )}
        </button>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => handleSortClick(sortField)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition-all"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortField === 'date' ? 'Datum' : sortField === 'amount' ? 'Belopp' : sortField === 'supplier' ? 'Leverantör' : 'Status'}
            {sortDirection === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
            {/* Amount range */}
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Min belopp</label>
              <input
                type="number"
                placeholder="0"
                value={filters.minAmount ?? ''}
                onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-2 sm:px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/30"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Max belopp</label>
              <input
                type="number"
                placeholder="∞"
                value={filters.maxAmount ?? ''}
                onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-2 sm:px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/30"
              />
            </div>

            {/* Date range */}
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Från datum</label>
              <input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || null })}
                className="w-full px-2 sm:px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/30"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-medium text-gray-500 mb-1">Till datum</label>
              <input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || null })}
                className="w-full px-2 sm:px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-aifm-gold/30"
              />
            </div>
          </div>

          {/* AI Confidence filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500">AI-säkerhet:</span>
              <div className="flex items-center gap-1 p-1 bg-white rounded-lg">
                {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => onFiltersChange({ ...filters, confidence: level })}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      filters.confidence === level
                        ? level === 'HIGH' ? 'bg-emerald-100 text-emerald-700' :
                          level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                          level === 'LOW' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {level === 'ALL' ? 'Alla' : level === 'HIGH' ? '≥90%' : level === 'MEDIUM' ? '70-89%' : '<70%'}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => onFiltersChange({ ...defaultFilters, search: filters.search })}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Rensa filter
              </button>
            )}
          </div>

          {/* Result count */}
          <div className="text-xs text-gray-400">
            Visar {resultCount} dokument
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Batch Action Bar ============
function BatchActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onApproveAll,
  onSendAll,
  isLoading,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onApproveAll: () => void;
  onSendAll: () => void;
  isLoading: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-aifm-gold/10 to-aifm-gold/5 border border-aifm-gold/20 rounded-xl backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-aifm-gold" />
          <span className="text-sm font-medium text-aifm-charcoal">
            {selectedCount} av {totalCount} valda
          </span>
        </div>
        
        <button
          onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
          className="text-sm text-aifm-gold hover:text-aifm-gold/80 font-medium"
        >
          {selectedCount === totalCount ? 'Avmarkera alla' : 'Välj alla'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onDeselectAll}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
        >
          Avbryt
        </button>
        
        <button
          onClick={onApproveAll}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Godkänn alla
        </button>
        
        <button
          onClick={onSendAll}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-aifm-charcoal text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Skicka alla till Fortnox
        </button>
      </div>
    </div>
  );
}

function getDocTypeLabel(type: string) {
  return DOC_TYPE_LABELS[type] || DOC_TYPE_LABELS.OTHER;
}

// Document Type Icon
function DocTypeIcon({ type }: { type: string }) {
  const config = getDocTypeLabel(type);
  const Icon = config.icon;

  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.color}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

// File Icon
function FileIcon({ type }: { type: string }) {
  switch (type) {
    case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
    case 'xlsx': case 'xls': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    case 'jpg': case 'png': case 'jpeg': return <FileImage className="w-5 h-5 text-blue-500" />;
    default: return <File className="w-5 h-5 text-gray-500" />;
  }
}

// Confidence Indicator
function ConfidenceIndicator({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? 'text-emerald-600 bg-emerald-50' : pct >= 70 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Sparkles className="w-3 h-3" />
      {pct}%
    </span>
  );
}

// ============ Document Thumbnail ============
function DocumentThumbnail({ 
  jobId, 
  fileType, 
  fileName 
}: { 
  jobId: string; 
  fileType: string; 
  fileName: string;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        const response = await fetch(`/api/accounting/jobs/${jobId}/thumbnail`);
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            setThumbnailUrl(data.url);
          }
        }
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Only load thumbnails for image types
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase());
    if (isImage) {
      loadThumbnail();
    } else {
      setIsLoading(false);
    }
  }, [jobId, fileType]);

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileType.toLowerCase());
  const isPdf = fileType.toLowerCase() === 'pdf';

  if (isLoading) {
    return (
      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center animate-pulse">
        <FileImage className="w-6 h-6 text-gray-300" />
      </div>
    );
  }

  if (thumbnailUrl && !error) {
    return (
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 relative">
        <img
          src={thumbnailUrl}
          alt={fileName}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  // Fallback icons
  if (isPdf) {
    return (
      <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center">
        <FileText className="w-6 h-6 text-red-500" />
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center">
        <FileImage className="w-6 h-6 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
      <File className="w-6 h-6 text-gray-400" />
    </div>
  );
}

// Document Card with checkbox and thumbnail
function DocumentCard({ 
  job, 
  isSelected, 
  isChecked,
  onSelect, 
  onCheck,
  onDelete,
  onView,
  showCheckbox = false,
}: { 
  job: AccountingJob; 
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: () => void;
  onDelete: () => void;
  onView: () => void;
  showCheckbox?: boolean;
}) {
  const isProcessing = ['queued', 'uploading', 'scanning', 'ocr', 'analyzing'].includes(job.status);
  const canBeSelected = job.status === 'ready' || job.status === 'approved';

  return (
    <div 
      onClick={onSelect}
      className={`
        group relative bg-white rounded-xl border transition-all duration-300 cursor-pointer
        ${isSelected 
          ? 'border-aifm-gold shadow-lg shadow-aifm-gold/10 ring-2 ring-aifm-gold/20' 
          : isChecked
            ? 'border-emerald-300 bg-emerald-50/30'
            : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
        }
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox for batch selection */}
          {(showCheckbox || isChecked) && canBeSelected && (
            <button
              onClick={(e) => { e.stopPropagation(); onCheck(); }}
              className="flex-shrink-0 mt-0.5"
            >
              {isChecked ? (
                <CheckSquare className="w-5 h-5 text-emerald-500" />
              ) : (
                <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
              )}
            </button>
          )}

          {/* Thumbnail / Icon */}
          <div className="flex-shrink-0">
            {job.classification ? (
              <div className="relative">
                <DocumentThumbnail 
                  jobId={job.id} 
                  fileType={job.fileType} 
                  fileName={job.fileName} 
                />
                {/* Document type badge overlay */}
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  job.classification.docType === 'RECEIPT' ? 'bg-green-500 text-white' :
                  job.classification.docType === 'INVOICE' ? 'bg-blue-500 text-white' :
                  job.classification.docType === 'CREDIT_NOTE' ? 'bg-purple-600 text-white' :
                  job.classification.docType === 'BANK' ? 'bg-purple-500 text-white' :
                  'bg-gray-500 text-white'
                }`}>
                  {job.classification.docType === 'RECEIPT' ? 'K' :
                   job.classification.docType === 'INVOICE' ? 'F' :
                   job.classification.docType === 'CREDIT_NOTE' ? 'KN' :
                   job.classification.docType === 'BANK' ? 'B' : '?'}
                </div>
              </div>
            ) : (
              <DocumentThumbnail 
                jobId={job.id} 
                fileType={job.fileType} 
                fileName={job.fileName} 
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-aifm-charcoal text-sm truncate">{job.fileName}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(job.fileSize)}</p>
              </div>
              <StatusBadge status={job.status} splitInfo={job.splitInfo} />
            </div>

            {/* Classification Preview */}
            {job.classification && !isProcessing && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      job.classification.docType === 'RECEIPT' ? 'bg-green-100 text-green-700' :
                      job.classification.docType === 'INVOICE' ? 'bg-blue-100 text-blue-700' :
                      job.classification.docType === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-700' :
                      job.classification.docType === 'BANK' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {getDocTypeLabel(job.classification.docType).name}
                    </span>
                    <span className="text-gray-500 truncate max-w-[120px]">{job.classification.supplier}</span>
                    <span className="text-gray-300">•</span>
                    <span className="font-medium text-aifm-charcoal">
                      {formatCurrency(job.classification.totalAmount, job.classification.currency)}
                    </span>
                    <CurrencyBadge currency={job.classification.currency} />
                  </div>
                  <ConfidenceIndicator value={job.classification.overallConfidence} />
                </div>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-aifm-gold to-aifm-gold/50 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}
          </div>

          {/* Actions - always visible with explicit z-index */}
          <div className="flex items-center gap-1 flex-shrink-0 relative z-10">
            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault();
                onView(); 
              }}
              className="p-2.5 text-gray-400 hover:text-aifm-gold hover:bg-aifm-gold/10 rounded-lg transition-all cursor-pointer"
              title="Visa dokument"
            >
              <Eye className="w-5 h-5 pointer-events-none" />
            </button>
            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault();
                onDelete(); 
              }}
              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
              title="Ta bort dokument"
            >
              <Trash2 className="w-5 h-5 pointer-events-none" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Detail Panel (right side)
function DetailPanel({ 
  job, 
  onClose, 
  onApprove, 
  onSendToFortnox,
  onUpdateLineItem
}: { 
  job: AccountingJob;
  onClose: () => void;
  onApprove: () => void;
  onSendToFortnox: () => void;
  onUpdateLineItem: (lineItemId: string, field: string, value: string) => void;
}) {
  const [activeSection, setActiveSection] = useState<'details' | 'ocr'>('details');
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    setIsLoading(true);
    try {
      await onSendToFortnox();
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDocument = async () => {
    try {
      const response = await fetch(`/api/accounting/jobs/${job.id}/document`);
      if (!response.ok) {
        throw new Error('Failed to get document URL');
      }
      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Failed to view document:', error);
      alert('Kunde inte öppna dokumentet');
    }
  };

  if (!job.classification) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 animate-pulse text-aifm-gold" />
          <p className="font-medium">Analyserar dokument...</p>
          <p className="text-sm mt-1">Detta kan ta några sekunder</p>
        </div>
      </div>
    );
  }

  const c = job.classification;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <DocTypeIcon type={c.docType} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-aifm-charcoal">{c.supplier}</h2>
              <CurrencyBadge currency={c.currency} />
            </div>
            <p className="text-xs text-gray-500">{getDocTypeLabel(c.docType).name} {c.invoiceNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleViewDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs font-medium text-gray-600"
          >
            <Eye className="w-3.5 h-3.5" />
            Visa dokument
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="px-5 pt-4">
        <PillTabs
          tabs={[
            { id: 'details', label: 'Kontering', icon: Edit3 },
            { id: 'ocr', label: 'OCR-text', icon: Eye },
          ]}
          activeTab={activeSection}
          onChange={(id) => setActiveSection(id as 'details' | 'ocr')}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeSection === 'details' ? (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{getDocTypeLabel(c.docType).dateLabel}</p>
                <p className="text-sm font-medium text-aifm-charcoal">{c.invoiceDate}</p>
              </div>
              {c.docType === 'INVOICE' && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Förfallodatum</p>
                <p className="text-sm font-medium text-aifm-charcoal">{c.dueDate}</p>
              </div>
              )}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Belopp exkl. moms</p>
                <p className="text-sm font-medium text-aifm-charcoal">{formatCurrency(c.totalAmount - c.vatAmount, c.currency)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Moms</p>
                <p className="text-sm font-medium text-aifm-charcoal">{formatCurrency(c.vatAmount, c.currency)}</p>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Konteringsrader</h3>
              <div className="space-y-3">
                {c.lineItems.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-aifm-charcoal">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(item.netAmount, c.currency)} + {formatCurrency(item.vatAmount, c.currency)} moms
                        </p>
                      </div>
                      <ConfidenceIndicator value={item.confidence} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Konto</label>
                        <CustomSelect
                          value={item.suggestedAccount}
                          options={accountOptions}
                          onChange={(val) => onUpdateLineItem(item.id, 'suggestedAccount', val)}
                          compact
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Kostnadsställe</label>
                        <CustomSelect
                          value={item.suggestedCostCenter || ''}
                          options={costCenterOptions}
                          onChange={(val) => onUpdateLineItem(item.id, 'suggestedCostCenter', val)}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-aifm-charcoal rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-2">
                  Totalt att bokföra
                  {c.currency !== 'SEK' && (
                    <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-medium">
                      {CURRENCY_INFO[c.currency]?.flag} {c.currency}
                    </span>
                  )}
                </p>
                <p className="text-xl font-bold text-white mt-0.5">{formatCurrency(c.totalAmount, c.currency)}</p>
              </div>
              <ConfidenceIndicator value={c.overallConfidence} />
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4">
            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
              {job.ocrText || 'Ingen OCR-text tillgänglig'}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 border-t border-gray-100 flex gap-3">
        {job.status === 'ready' && (
          <>
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-aifm-charcoal rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Godkänn
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl text-sm font-medium hover:bg-aifm-gold/90 transition-colors shadow-lg shadow-aifm-gold/30 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Skicka till Fortnox
            </button>
          </>
        )}
        {job.status === 'approved' && (
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-aifm-gold text-white rounded-xl text-sm font-medium hover:bg-aifm-gold/90 transition-colors shadow-lg shadow-aifm-gold/30 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Skicka till Fortnox
          </button>
        )}
        {job.status === 'sent' && (
          <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Skickad till Fortnox {job.fortnoxVoucherId && `(${job.fortnoxVoucherId})`}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function
function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Upload Progress Modal
interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  jobId?: string;
  error?: string;
}

function UploadProgressModal({ 
  files, 
  onClose 
}: { 
  files: UploadingFile[]; 
  onClose: () => void;
}) {
  const allDone = files.every(f => f.status === 'done' || f.status === 'error');
  const successCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={allDone ? onClose : undefined} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#c0a280] to-[#8b7355]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                {allDone ? (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-white animate-spin" />
                )}
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  {allDone ? 'Uppladdning klar' : 'Laddar upp dokument...'}
                </h3>
                <p className="text-white/70 text-sm">
                  {allDone 
                    ? `${successCount} av ${files.length} lyckades`
                    : `${files.filter(f => f.status !== 'uploading' && f.status !== 'processing').length} av ${files.length} klara`
                  }
                </p>
              </div>
            </div>
            {allDone && (
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        </div>
        
        {/* File List */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  file.status === 'done' ? 'bg-green-100' :
                  file.status === 'error' ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                  {file.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : file.status === 'error' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : file.status === 'processing' ? (
                    <Sparkles className="w-4 h-4 text-[#c0a280] animate-pulse" />
                  ) : (
                    <Upload className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {file.status === 'uploading' || file.status === 'processing' ? (
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#c0a280] to-[#8b7355] rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    ) : file.status === 'done' ? (
                      <span className="text-xs text-green-600">AI-analyserad ✓</span>
                    ) : (
                      <span className="text-xs text-red-600">{file.error || 'Fel vid uppladdning'}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        {allDone && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button 
              onClick={onClose}
              className="w-full py-2.5 bg-[#c0a280] hover:bg-[#a08260] text-white rounded-xl font-medium transition-colors"
            >
              {errorCount > 0 ? 'Stäng' : 'Visa dokument'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Full Page Drop Overlay
function FullPageDropOverlay({ isFolder }: { isFolder?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 bg-[#c0a280]/10 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center animate-in zoom-in-95 duration-200 border-4 border-dashed border-[#c0a280]">
          <div className="w-20 h-20 bg-gradient-to-br from-[#c0a280] to-[#8b7355] rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce">
            {isFolder ? <FolderInput className="w-10 h-10 text-white" /> : <Upload className="w-10 h-10 text-white" />}
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {isFolder ? 'Släpp mapp här' : 'Släpp filer här'}
          </h2>
          <p className="text-gray-500">
            {isFolder ? 'Alla PDF, bilder och Excel-filer i mappen importeras' : 'PDF, bilder eller Excel-filer'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Camera Capture Modal
function CameraCaptureModal({ 
  onCapture, 
  onClose 
}: { 
  onCapture: (file: File) => void; 
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError('Kunde inte starta kameran. Kontrollera att du har gett tillstånd.');
        console.error('Camera error:', err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setIsCaptured(true);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setIsCaptured(false);
  };

  const handleSave = () => {
    if (!capturedImage) return;

    // Convert base64 to File
    const byteString = atob(capturedImage.split(',')[1]);
    const mimeType = 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeType });
    const fileName = `kvitto_${new Date().toISOString().split('T')[0]}_${Date.now()}.jpg`;
    // Use proper File constructor typing
    const FileConstructor = globalThis.File;
    const file = new FileConstructor([blob], fileName, { type: mimeType });

    onCapture(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {error ? (
        <div className="text-center text-white p-8">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <p className="text-lg">{error}</p>
          <button 
            onClick={onClose}
            className="mt-6 px-6 py-3 bg-white text-gray-900 rounded-xl font-medium"
          >
            Stäng
          </button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col">
          {/* Camera/Preview */}
          <div className="flex-1 relative overflow-hidden">
            {isCaptured && capturedImage ? (
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-contain"
              />
            ) : (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay guide */}
            {!isCaptured && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[80%] max-w-md aspect-[3/4] border-2 border-white/50 rounded-2xl">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white text-sm">
                    Placera kvittot inom ramen
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
            {isCaptured ? (
              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={handleRetake}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors"
                >
                  Ta om
                </button>
                <button 
                  onClick={handleSave}
                  className="px-8 py-3 bg-[#c0a280] hover:bg-[#a08260] text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Använd bild
                </button>
              </div>
            ) : (
              <button 
                onClick={handleCapture}
                className="w-20 h-20 mx-auto block bg-white rounded-full border-4 border-[#c0a280] shadow-lg hover:scale-105 transition-transform"
              >
                <span className="sr-only">Ta bild</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Fortnox Import Modal
function FortnoxImportModal({ 
  companyId,
  onImport, 
  onClose 
}: { 
  companyId: string;
  onImport: () => void;
  onClose: () => void;
}) {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [includeBooked, setIncludeBooked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FortnoxImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await importFromFortnox(companyId, { fromDate, toDate, includeBooked });
      setResult(res);
      if (res.imported > 0) {
        onImport();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import misslyckades');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Importera från Fortnox</h3>
              <p className="text-white/70 text-sm">Hämta leverantörsfakturor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {result ? (
            <div className="text-center py-4">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                result.imported > 0 ? 'bg-green-100' : 'bg-amber-100'
              }`}>
                {result.imported > 0 ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-amber-600" />
                )}
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                {result.imported > 0 ? 'Import klar!' : 'Inga nya fakturor'}
              </h4>
              <p className="text-gray-500 mb-4">
                {result.imported} importerade, {result.skipped} överhoppade
              </p>
              {result.errors.length > 0 && (
                <div className="text-left bg-red-50 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-red-700 mb-1">Fel:</p>
                  {result.errors.slice(0, 3).map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 transition-colors"
              >
                Stäng
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg text-red-700 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Från datum</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Till datum</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                    />
                  </div>
                </div>
                
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeBooked}
                    onChange={(e) => setIncludeBooked(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Inkludera bokförda</p>
                    <p className="text-xs text-gray-500">Importera även fakturor som redan är bokförda</p>
                  </div>
                </label>
              </div>
              
              <div className="mt-6 flex gap-3">
                <button 
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium text-gray-700 transition-colors"
                >
                  Avbryt
                </button>
                <button 
                  onClick={handleImport}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importerar...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Importera
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Main Page ============
export default function AccountingUploadPage() {
  const { selectedCompany } = useCompany();
  const [jobs, setJobs] = useState<AccountingJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showFortnoxImportModal, setShowFortnoxImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);
  
  // New: Search, Filter, Sort & Batch state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [checkedJobIds, setCheckedJobIds] = useState<Set<string>>(new Set());
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;
  const isLoading = uploadingFiles.some(f => f.status === 'uploading' || f.status === 'processing');

  // Load jobs on mount and poll for updates
  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchJobs(selectedCompany.id);
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  }, [selectedCompany.id]);

  useEffect(() => {
    loadJobs();
    
    // Poll for updates every 2 seconds
    pollIntervalRef.current = setInterval(loadJobs, 2000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadJobs]);

  // Filter jobs by tab
  const tabFilteredJobs = useMemo(() => {
    return jobs.filter(j => {
      if (activeTab === 'pending') return ['queued', 'uploading', 'scanning', 'ocr', 'analyzing', 'ready'].includes(j.status);
      if (activeTab === 'approved') return j.status === 'approved';
      if (activeTab === 'sent') return j.status === 'sent';
      return true;
    });
  }, [jobs, activeTab]);

  // Apply search & filters
  const filteredJobs = useMemo(() => {
    return tabFilteredJobs.filter(job => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch = 
          job.fileName.toLowerCase().includes(search) ||
          (job.classification?.supplier?.toLowerCase().includes(search)) ||
          (job.classification?.invoiceNumber?.toLowerCase().includes(search)) ||
          (job.classification?.totalAmount?.toString().includes(search));
        if (!matchesSearch) return false;
      }

      // Doc type filter
      if (filters.docType !== 'ALL') {
        if (job.classification?.docType !== filters.docType) return false;
      }

      // Amount filters
      if (filters.minAmount !== null) {
        if (!job.classification || job.classification.totalAmount < filters.minAmount) return false;
      }
      if (filters.maxAmount !== null) {
        if (!job.classification || job.classification.totalAmount > filters.maxAmount) return false;
      }

      // Date filters
      if (filters.dateFrom) {
        const jobDate = job.classification?.invoiceDate || job.createdAt;
        if (jobDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const jobDate = job.classification?.invoiceDate || job.createdAt;
        if (jobDate > filters.dateTo) return false;
      }

      // Confidence filter
      if (filters.confidence !== 'ALL' && job.classification) {
        const conf = job.classification.overallConfidence;
        if (filters.confidence === 'HIGH' && conf < 0.9) return false;
        if (filters.confidence === 'MEDIUM' && (conf < 0.7 || conf >= 0.9)) return false;
        if (filters.confidence === 'LOW' && conf >= 0.7) return false;
      }

      return true;
    });
  }, [tabFilteredJobs, filters]);

  // Sort jobs
  const sortedJobs = useMemo(() => {
    const sorted = [...filteredJobs];
    sorted.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'date':
          aVal = a.classification?.invoiceDate || a.createdAt;
          bVal = b.classification?.invoiceDate || b.createdAt;
          break;
        case 'amount':
          aVal = a.classification?.totalAmount || 0;
          bVal = b.classification?.totalAmount || 0;
          break;
        case 'supplier':
          aVal = a.classification?.supplier?.toLowerCase() || '';
          bVal = b.classification?.supplier?.toLowerCase() || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredJobs, sortField, sortDirection]);

  // Jobs that can be batch-selected (ready or approved)
  const selectableJobs = sortedJobs.filter(j => j.status === 'ready' || j.status === 'approved');

  // Batch handlers
  const handleToggleCheck = (jobId: string) => {
    setCheckedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setCheckedJobIds(new Set(selectableJobs.map(j => j.id)));
  };

  const handleDeselectAll = () => {
    setCheckedJobIds(new Set());
  };

  const handleBatchApprove = async () => {
    if (checkedJobIds.size === 0) return;
    setIsBatchLoading(true);
    try {
      const result = await batchApprove(Array.from(checkedJobIds));
      console.log('Batch approve result:', result);
      await loadJobs();
      setCheckedJobIds(new Set());
    } catch (error) {
      console.error('Batch approve error:', error);
    } finally {
      setIsBatchLoading(false);
    }
  };

  const handleBatchSendToFortnox = async () => {
    if (checkedJobIds.size === 0) return;
    setIsBatchLoading(true);
    try {
      const result = await batchSendToFortnox(Array.from(checkedJobIds));
      console.log('Batch send result:', result);
      await loadJobs();
      setCheckedJobIds(new Set());
    } catch (error) {
      console.error('Batch send error:', error);
    } finally {
      setIsBatchLoading(false);
    }
  };

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  const counts = {
    pending: jobs.filter(j => ['queued', 'uploading', 'scanning', 'ocr', 'analyzing', 'ready'].includes(j.status)).length,
    approved: jobs.filter(j => j.status === 'approved').length,
    sent: jobs.filter(j => j.status === 'sent').length,
  };

  // Global drag handlers for full-page drop zone (files AND folders)
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
        
        // Check if it's a folder being dragged
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
          const item = items[0];
          if (item.webkitGetAsEntry) {
            const entry = item.webkitGetAsEntry();
            if (entry?.isDirectory) {
              setIsDraggingFolder(true);
            }
          }
        }
      }
    };
    
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
        setIsDraggingFolder(false);
      }
    };
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    
    const handleDropGlobal = async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      setIsDraggingFolder(false);
      
      if (e.dataTransfer) {
        // Check if any items are directories (folders)
        const items = Array.from(e.dataTransfer.items);
        const hasDirectory = items.some(item => {
          const entry = item.webkitGetAsEntry?.();
          return entry?.isDirectory;
        });
        
        if (hasDirectory) {
          // Use recursive folder reading
          const files = await getAllFilesFromDataTransfer(e.dataTransfer);
          if (files.length > 0) {
            handleFiles(files);
          }
        } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFiles(Array.from(e.dataTransfer.files));
        }
      }
    };
    
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDropGlobal);
    
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDropGlobal);
    };
  }, [selectedCompany.id]);

  // Handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    // Create upload entries for each file
    const newUploads: UploadingFile[] = files.map((file, i) => ({
      id: `upload-${Date.now()}-${i}`,
      name: file.name,
      size: file.size,
      status: 'uploading' as const,
      progress: 0,
    }));
    
    setUploadingFiles(newUploads);
    setShowUploadModal(true);
    
    // Upload all files in parallel
    const uploadPromises = files.map(async (file, index) => {
      const uploadId = newUploads[index].id;
      
      try {
        // Update progress to show uploading
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadId ? { ...f, progress: 30 } : f
        ));
        
        const result = await ingestDocument(file, selectedCompany.id);
        
        // Update to processing
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadId ? { ...f, status: 'processing', progress: 60, jobId: result.jobId } : f
        ));
        
        // Poll for completion
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max
        
        while (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1000));
          attempts++;
          
          const jobsData = await fetchJobs(selectedCompany.id);
          const job = jobsData.find(j => j.id === result.jobId);
          
          if (job) {
            const progressMap: Record<string, number> = {
              'queued': 40,
              'uploading': 50,
              'scanning': 60,
              'ocr': 70,
              'analyzing': 85,
              'ready': 100,
              'approved': 100,
              'error': 100,
            };
            
            setUploadingFiles(prev => prev.map(f => 
              f.id === uploadId ? { ...f, progress: progressMap[job.status] || 50 } : f
            ));
            
            if (['ready', 'approved', 'sent'].includes(job.status)) {
              setUploadingFiles(prev => prev.map(f => 
                f.id === uploadId ? { ...f, status: 'done', progress: 100 } : f
              ));
              break;
            }
            
            if (job.status === 'error') {
              setUploadingFiles(prev => prev.map(f => 
                f.id === uploadId ? { ...f, status: 'error', error: job.error || 'Bearbetning misslyckades' } : f
              ));
              break;
            }
          }
        }
        
        // Timeout
        if (attempts >= maxAttempts) {
          setUploadingFiles(prev => prev.map(f => 
            f.id === uploadId && f.status === 'processing' 
              ? { ...f, status: 'done', progress: 100 } // Assume done if timeout
              : f
          ));
        }
        
      } catch (error) {
        console.error('Upload error:', error);
        
        let errorMessage = 'Uppladdning misslyckades';
        
        if (error instanceof DuplicateError) {
          errorMessage = `⚠️ Duplikat: ${error.duplicate?.reason || 'Filen finns redan'}`;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadId ? { 
            ...f, 
            status: 'error', 
            error: errorMessage
          } : f
        ));
      }
    });
    
    // Wait for all uploads and refresh jobs
    await Promise.allSettled(uploadPromises);
    await loadJobs();
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJobId === jobId) setSelectedJobId(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleViewDocument = async (jobId: string) => {
    try {
      const response = await fetch(`/api/accounting/jobs/${jobId}/document`);
      if (!response.ok) {
        throw new Error('Failed to get document URL');
      }
      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Failed to view document:', error);
      alert('Kunde inte öppna dokumentet');
    }
  };

  const handleApprove = async (jobId: string) => {
    await approveJob(jobId, 'approve');
    await loadJobs();
  };

  const handleSendToFortnox = async (jobId: string) => {
    await approveJob(jobId, 'sendToFortnox');
    await loadJobs();
  };

  const handleUpdateLineItem = async (jobId: string, lineItemId: string, field: string, value: string) => {
    // Update locally first for responsiveness
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId || !j.classification) return j;
      return {
        ...j,
        classification: {
          ...j.classification,
          lineItems: j.classification.lineItems.map(li => 
            li.id === lineItemId ? { ...li, [field]: value } : li
          )
        }
      };
    }));

    // Then update on server
    try {
      await updateJob(jobId, [{ id: lineItemId, [field]: value }]);
    } catch (error) {
      console.error('Update error:', error);
      // Reload to get correct state
      await loadJobs();
    }
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadingFiles([]);
  };

  return (
    <>
      {/* Full Page Drop Overlay */}
      {isDragging && <FullPageDropOverlay isFolder={isDraggingFolder} />}
      
      {/* Upload Progress Modal */}
      {showUploadModal && uploadingFiles.length > 0 && (
        <UploadProgressModal 
          files={uploadingFiles} 
          onClose={handleCloseUploadModal}
        />
      )}
      
      {/* Camera Capture Modal */}
      {showCameraModal && (
        <CameraCaptureModal
          onCapture={(file) => handleFiles([file])}
          onClose={() => setShowCameraModal(false)}
        />
      )}
      
      {/* Fortnox Import Modal */}
      {showFortnoxImportModal && (
        <FortnoxImportModal
          companyId={selectedCompany.id}
          onImport={loadJobs}
          onClose={() => setShowFortnoxImportModal(false)}
        />
      )}
      
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold text-aifm-charcoal">Bokföringsunderlag</h1>
              <p className="text-sm text-gray-500 mt-1">Ladda upp och granska underlag för {selectedCompany.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* AI Assistant Button */}
              <FeedbackChat 
                currentJobId={selectedJob?.id}
                currentDocumentName={selectedJob?.fileName}
                currentClassification={selectedJob?.classification ? {
                  supplier: selectedJob.classification.supplier,
                  account: selectedJob.classification.lineItems?.[0]?.suggestedAccount || '',
                  amount: selectedJob.classification.totalAmount,
                } : undefined}
                variant="inline"
              />
              
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">
                <Building2 className="w-3.5 h-3.5" />
                Fortnox kopplad
              </div>
            </div>
          </div>

          {/* Tabs */}
          <PillTabs
            tabs={[
              { id: 'pending', label: 'Att granska', count: counts.pending, icon: Clock },
              { id: 'approved', label: 'Godkända', count: counts.approved, icon: CheckCircle2 },
              { id: 'sent', label: 'Skickade', count: counts.sent, icon: Send },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 min-h-0">
          {/* Left: Upload + List */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Upload Zone */}
            {activeTab === 'pending' && (
              <div className="flex-shrink-0 mb-4 space-y-3">
                {/* Main Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer border-gray-200 bg-gradient-to-br from-white to-gray-50 hover:border-[#c0a280] hover:from-[#c0a280]/5 hover:to-white group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleFiles(Array.from(e.target.files));
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                  {/* Hidden folder input */}
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore - non-standard directory upload attribute (webkitdirectory)
                    webkitdirectory=""
                    // @ts-ignore - non-standard directory upload attribute (directory)
                    directory=""
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        // Filter supported files
                        const files = Array.from(e.target.files).filter(f => {
                          const ext = f.name.split('.').pop()?.toLowerCase();
                          return ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'xlsx', 'xls'].includes(ext || '');
                        });
                        if (files.length > 0) {
                          handleFiles(files);
                        }
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                  <div className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 bg-gray-100 group-hover:bg-[#c0a280]/20 transition-all group-hover:scale-110">
                      <Upload className="w-7 h-7 text-gray-400 group-hover:text-[#c0a280] transition-colors" />
                    </div>
                    <p className="text-base font-medium text-gray-800 mb-1">
                      Dra filer eller mappar hit, eller klicka för att välja
                    </p>
                    <p className="text-sm text-gray-400">
                      PDF, bilder (JPG, PNG) eller Excel • Batch-uppladdning (50+ dokument)
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI-klassificering
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        Auto-kontering
                      </span>
                      <span className="flex items-center gap-1">
                        <FolderInput className="w-3.5 h-3.5" />
                        Mapp-support
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {/* Folder Upload */}
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-lg sm:rounded-xl hover:border-[#c0a280] hover:bg-[#c0a280]/5 transition-all group"
                  >
                    <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#c0a280]" />
                    <span className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-900">Välj mapp</span>
                  </button>

                  {/* Camera */}
                  <button
                    onClick={() => setShowCameraModal(true)}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-lg sm:rounded-xl hover:border-[#c0a280] hover:bg-[#c0a280]/5 transition-all group"
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-[#c0a280]" />
                    <span className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-900">Fota kvitto</span>
                  </button>

                  {/* Fortnox Import */}
                  <button
                    onClick={() => setShowFortnoxImportModal(true)}
                    className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-lg sm:rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                  >
                    <Download className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-green-600" />
                    <span className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-gray-900">Fortnox-import</span>
                  </button>
                </div>
              </div>
            )}

            {/* Search & Filter Bar */}
            <div className="flex-shrink-0 mb-4">
              <SearchFilterBar
                filters={filters}
                onFiltersChange={setFilters}
                sortField={sortField}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                resultCount={sortedJobs.length}
              />
            </div>

            {/* Batch Action Bar */}
            {activeTab === 'pending' && (
              <div className="flex-shrink-0 mb-3">
                <BatchActionBar
                  selectedCount={checkedJobIds.size}
                  totalCount={selectableJobs.length}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onApproveAll={handleBatchApprove}
                  onSendAll={handleBatchSendToFortnox}
                  isLoading={isBatchLoading}
                />
              </div>
            )}

            {/* Document List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sortedJobs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">Inga dokument</p>
                    <p className="text-sm mt-1">
                      {filters.search || filters.docType !== 'ALL' 
                        ? 'Inga träffar med valda filter'
                        : activeTab === 'pending' 
                          ? 'Ladda upp filer för att börja' 
                          : 'Inga dokument i denna kategori'}
                    </p>
                  </div>
                </div>
              ) : (
                sortedJobs.map((job) => (
                  <DocumentCard
                    key={job.id}
                    job={job}
                    isSelected={selectedJobId === job.id}
                    isChecked={checkedJobIds.has(job.id)}
                    onSelect={() => setSelectedJobId(job.id)}
                    onCheck={() => handleToggleCheck(job.id)}
                    onDelete={() => handleDelete(job.id)}
                    onView={() => handleViewDocument(job.id)}
                    showCheckbox={activeTab === 'pending' && checkedJobIds.size > 0}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <div className={`
            w-[440px] flex-shrink-0 bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all duration-300
            ${selectedJob ? 'opacity-100' : 'opacity-50'}
          `}>
            {selectedJob ? (
              <DocumentDetailView
                job={selectedJob}
                onClose={() => setSelectedJobId(null)}
                onApprove={async () => { await handleApprove(selectedJob.id); }}
                onSendToFortnox={async () => { await handleSendToFortnox(selectedJob.id); }}
                onUpdateLineItem={(lineItemId, field, value) => handleUpdateLineItem(selectedJob.id, lineItemId, field, value)}
                onViewDocument={() => handleViewDocument(selectedJob.id)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MoreHorizontal className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">Välj ett dokument</p>
                  <p className="text-sm mt-1">Klicka på ett dokument för att granska</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
{/* FeedbackChat moved to header - inline variant */}
    </>
  );
}
