'use client';

import { useState, useEffect } from 'react';
import {
  Receipt, FileText, Building2, CreditCard, Calendar, Clock,
  Banknote, Hash, Percent, ChevronDown, CheckCircle2, AlertTriangle,
  Sparkles, Edit3, Eye, Send, RefreshCw, MapPin, Phone, Globe,
  Copy, ExternalLink, Store, Utensils, Coffee, ShoppingBag, Fuel,
  Truck, Wifi, Zap, Users, X
} from 'lucide-react';

// ============ Types ============

// Flexibla typer som matchar befintliga i projektet
export interface LineItem {
  id: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  netAmount: number;
  vatRate?: number;
  vatAmount?: number;
  suggestedAccount: string;
  suggestedAccountName?: string;
  suggestedCostCenter: string | null;
  confidence: number;
  suggestionSource?: string;
  suggestionReasoning?: string;
  suggestionAlternatives?: Array<{
    account: string;
    accountName?: string;
    confidence?: number;
    source?: string;
  }>;
}

export interface Classification {
  docType: string; // Flexibel för att matcha 'INVOICE' | 'RECEIPT' | 'BANK' | 'OTHER' etc.
  supplier: string;
  supplierOrgNumber?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  totalAmount: number;
  netAmount?: number;
  vatAmount: number;
  vatRate?: number;
  // FX metadata (if converted to SEK)
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  exchangeRateDate?: string;
  exchangeRateSource?: string;
  // Policy evaluation
  policy?: {
    appliedAt: string;
    requiresApproval?: boolean;
    summary?: string;
    violations?: Array<{
      code: string;
      field: string;
      message: string;
      severity: 'warning' | 'error';
    }>;
  };
  paymentMethod?: 'card' | 'cash' | 'swish' | 'invoice' | 'other';
  cardLastFour?: string;
  bankgiro?: string;
  plusgiro?: string;
  paymentReference?: string;
  lineItems: LineItem[];
  overallConfidence: number;
  rawTextSummary?: string;
}

export interface AccountingJob {
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
  fortnoxInvoiceId?: string;
  fortnoxInvoiceStatus?: {
    booked?: boolean;
    cancelled?: boolean;
    credit?: boolean;
    balance?: number;
    lastSyncedAt?: string;
  };
  error?: string;
  message?: string;
  splitInfo?: {
    receiptCount: number;
    childJobIds: string[];
  };
}

// ============ Account Options ============

const accountOptions = [
  // Varuinköp
  { value: '4010', label: '4010 – Inköp varor', category: 'Inköp' },
  { value: '4400', label: '4400 – Förbrukningsmaterial', category: 'Inköp' },
  // Lokalkostnader
  { value: '5010', label: '5010 – Lokalhyra', category: 'Lokalkostnader' },
  { value: '5060', label: '5060 – Städning', category: 'Lokalkostnader' },
  { value: '5120', label: '5120 – El', category: 'Lokalkostnader' },
  // Förbrukningsinventarier
  { value: '5410', label: '5410 – Förbrukningsinventarier', category: 'Inventarier' },
  { value: '5420', label: '5420 – Programvaror', category: 'Inventarier' },
  // Resor
  { value: '5800', label: '5800 – Resekostnader', category: 'Resekostnader' },
  { value: '5810', label: '5810 – Biljetter', category: 'Resekostnader' },
  { value: '5820', label: '5820 – Hyrbil', category: 'Resekostnader' },
  { value: '5830', label: '5830 – Kost och logi', category: 'Resekostnader' },
  { value: '5860', label: '5860 – Representation', category: 'Representation' },
  // Bil
  { value: '5611', label: '5611 – Drivmedel', category: 'Bilkostnader' },
  { value: '5615', label: '5615 – Leasing bil', category: 'Bilkostnader' },
  // Kontor
  { value: '6010', label: '6010 – Kontorsmaterial', category: 'Kontorskostnader' },
  { value: '6070', label: '6070 – Representation', category: 'Kontorskostnader' },
  // Tele
  { value: '6200', label: '6200 – Telefon/data', category: 'Telekommunikation' },
  { value: '6212', label: '6212 – Mobiltelefon', category: 'Telekommunikation' },
  { value: '6214', label: '6214 – Internet', category: 'Telekommunikation' },
  { value: '6250', label: '6250 – IT-tjänster', category: 'IT' },
  // Försäkring
  { value: '6300', label: '6300 – Försäkringar', category: 'Försäkringar' },
  // Tjänster
  { value: '6530', label: '6530 – Redovisningstjänster', category: 'Köpta tjänster' },
  { value: '6540', label: '6540 – IT-tjänster', category: 'Köpta tjänster' },
  { value: '6550', label: '6550 – Konsultarvoden', category: 'Köpta tjänster' },
  { value: '6570', label: '6570 – Banktjänster', category: 'Köpta tjänster' },
  { value: '6580', label: '6580 – Juridiska tjänster', category: 'Köpta tjänster' },
  // Marknadsföring
  { value: '5900', label: '5900 – Reklam och PR', category: 'Marknadsföring' },
  { value: '5910', label: '5910 – Annonsering', category: 'Marknadsföring' },
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

// ============ Currency Helpers ============

const CURRENCY_INFO: Record<string, { symbol: string; flag: string; name: string }> = {
  SEK: { symbol: 'kr', flag: '🇸🇪', name: 'Svenska kronor' },
  EUR: { symbol: '€', flag: '🇪🇺', name: 'Euro' },
  USD: { symbol: '$', flag: '🇺🇸', name: 'US Dollar' },
  GBP: { symbol: '£', flag: '🇬🇧', name: 'Brittiska pund' },
  DKK: { symbol: 'kr', flag: '🇩🇰', name: 'Danska kronor' },
  NOK: { symbol: 'kr', flag: '🇳🇴', name: 'Norska kronor' },
};

function formatCurrency(amount: number, currency: string): string {
  const info = CURRENCY_INFO[currency];
  if (currency === 'SEK') {
    return `${amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} kr`;
  }
  if (info) {
    return `${info.symbol}${amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} ${currency}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============ Receipt Category Detection ============

function detectReceiptCategory(supplier: string, rawText?: string): {
  category: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
} {
  const s = (supplier + ' ' + (rawText || '')).toLowerCase();
  
  if (s.match(/restaurang|restaurant|kök|bistro|trattoria|pizzeria|ristorante|sushi|wok|thai|krog|grill|brasserie/)) {
    return { category: 'Restaurang', icon: Utensils, color: 'text-orange-600', bgColor: 'bg-orange-50' };
  }
  if (s.match(/café|cafe|fika|espresso|starbucks|wayne|barista|kaffe|coffee/)) {
    return { category: 'Café', icon: Coffee, color: 'text-amber-700', bgColor: 'bg-amber-50' };
  }
  if (s.match(/bensin|diesel|circle k|preem|okq8|st1|shell|ingo|tank|fuel/)) {
    return { category: 'Drivmedel', icon: Fuel, color: 'text-red-600', bgColor: 'bg-red-50' };
  }
  if (s.match(/ica|coop|willys|hemköp|mathem|livsmedel|dagligvaror/)) {
    return { category: 'Livsmedel', icon: ShoppingBag, color: 'text-green-600', bgColor: 'bg-green-50' };
  }
  if (s.match(/elgiganten|mediamarkt|netonnet|inet|komplett|dustin|teknik|elektronik/)) {
    return { category: 'Elektronik', icon: Wifi, color: 'text-blue-600', bgColor: 'bg-blue-50' };
  }
  if (s.match(/taxi|uber|bolt|transport|parkering|sl|västtrafik/)) {
    return { category: 'Transport', icon: Truck, color: 'text-purple-600', bgColor: 'bg-purple-50' };
  }
  
  return { category: 'Övrigt', icon: Store, color: 'text-gray-600', bgColor: 'bg-gray-50' };
}

// ============ Components ============

function ConfidenceBadge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const pct = Math.round(value * 100);
  const isHigh = pct >= 85;
  const isMedium = pct >= 70 && pct < 85;
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  };
  
  const iconSize = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span className={`
      inline-flex items-center rounded-full font-medium
      ${sizeClasses[size]}
      ${isHigh ? 'bg-emerald-50 text-emerald-700' : isMedium ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}
    `}>
      <Sparkles className={iconSize[size]} />
      {pct}%
    </span>
  );
}

function CustomSelect({ 
  value, 
  options, 
  onChange, 
  placeholder = 'Välj...',
  size = 'md'
}: { 
  value: string; 
  options: { value: string; label: string; category?: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);
  const groupedOptions = options.reduce((acc, opt) => {
    const cat = opt.category || 'Övriga';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(opt);
    return acc;
  }, {} as Record<string, typeof options>);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={`
          w-full flex items-center justify-between gap-2 bg-white border border-gray-200 
          rounded-lg transition-all hover:border-[#c0a280]/50 focus:outline-none focus:border-[#c0a280] focus:ring-2 focus:ring-[#c0a280]/10
          ${size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}
          ${isOpen ? 'border-[#c0a280] ring-2 ring-[#c0a280]/10' : ''}
        `}
      >
        <span className={selectedOption ? 'text-gray-900 truncate' : 'text-gray-400'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-h-64 overflow-y-auto py-1">
            {Object.entries(groupedOptions).map(([category, opts]) => (
              <div key={category}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
                  {category}
                </div>
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
                        ? 'bg-[#c0a280]/10 text-[#c0a280]' 
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

function InfoField({ label, value, icon: Icon, mono = false }: { 
  label: string; 
  value: string | React.ReactNode; 
  icon?: React.ElementType;
  mono?: boolean;
}) {
  return (
    <div className="bg-gray-50/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-3 h-3 text-gray-400" />}
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className={`text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}

// ============ INVOICE VIEW ============

export function InvoiceDetailView({
  job,
  onApprove,
  onSendToFortnox,
  onUpdateLineItem,
  onUpdateClassification,
  onViewDocument,
  onClose,
}: {
  job: AccountingJob;
  onApprove: () => Promise<void>;
  onSendToFortnox: () => Promise<void>;
  onUpdateLineItem: (lineItemId: string, field: string, value: string) => void;
  onUpdateClassification?: (updates: Partial<Classification>) => Promise<void>;
  onViewDocument: () => void;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'kontering' | 'ocr'>('kontering');
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const c = job.classification!;
  const [editSupplier, setEditSupplier] = useState(c.supplier);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState(c.invoiceNumber);
  const [editInvoiceDate, setEditInvoiceDate] = useState(c.invoiceDate);
  const [editDueDate, setEditDueDate] = useState(c.dueDate || '');
  
  // Beräkna förfallodagar
  const daysUntilDue = c.dueDate 
    ? Math.ceil((new Date(c.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleApprove = async () => {
    setIsLoading(true);
    try { await onApprove(); } finally { setIsLoading(false); }
  };

  const handleSend = async () => {
    setIsLoading(true);
    try { await onSendToFortnox(); } finally { setIsLoading(false); }
  };

  const copyPaymentRef = () => {
    if (c.paymentReference) {
      navigator.clipboard.writeText(c.paymentReference);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header - Invoice specific */}
      <div className="flex-shrink-0 border-b border-gray-100">
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    c.docType === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {c.docType === 'CREDIT_NOTE' ? 'Kreditnota' : 'Faktura'}
                  </span>
                  <ConfidenceBadge value={c.overallConfidence} size="sm" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{c.supplier}</h2>
                {c.supplierOrgNumber && (
                  <p className="text-xs text-gray-500">Org.nr: {c.supplierOrgNumber}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={onViewDocument}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs font-medium text-gray-600"
              >
                <Eye className="w-3.5 h-3.5" />
                Visa
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Invoice Quick Info */}
          <div className="grid grid-cols-3 gap-3">
            <InfoField label="Fakturanr" value={c.invoiceNumber} icon={Hash} mono />
            <InfoField label="Fakturadatum" value={formatDate(c.invoiceDate)} icon={Calendar} />
            <div className="bg-gray-50/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Förfallodatum</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{formatDate(c.dueDate || '')}</span>
                {daysUntilDue !== null && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                    daysUntilDue < 0 ? 'bg-red-100 text-red-700' :
                    daysUntilDue <= 7 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d försenad` : 
                     daysUntilDue === 0 ? 'Idag' :
                     `${daysUntilDue}d kvar`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Explanation / guardrails */}
          {(c.policy?.summary || (c.originalCurrency && c.originalCurrency !== 'SEK')) && (
            <div className="mt-4 space-y-2">
              {c.policy?.summary && (
                <div className={`rounded-xl border px-4 py-3 ${
                  c.policy.violations?.some(v => v.severity === 'error')
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="text-xs font-semibold text-gray-700">Bokföringspolicy</div>
                  <div className="text-sm text-gray-800 mt-0.5">{c.policy.summary}</div>
                  {!!c.policy.violations?.length && (
                    <ul className="mt-2 space-y-1">
                      {c.policy.violations.slice(0, 4).map((v, idx) => (
                        <li key={idx} className="text-xs text-gray-700">
                          - {v.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {c.originalCurrency && c.originalCurrency !== 'SEK' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="text-xs font-semibold text-gray-700">Valuta (underlag)</div>
                  <div className="text-sm text-gray-800 mt-0.5">
                    Original: {c.originalAmount?.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} {c.originalCurrency} ·
                    Kurs: {c.exchangeRate?.toFixed(6)} ·
                    Datum: {c.exchangeRateDate || '—'} ·
                    Källa: {c.exchangeRateSource || '—'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick corrections */}
          {onUpdateClassification && (
            <div className="mt-4">
              <button
                onClick={() => setIsEditingMeta(v => !v)}
                className="text-xs font-medium text-gray-700 hover:text-gray-900 inline-flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Snabbkorrigering
              </button>

              {isEditingMeta && (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Leverantör</label>
                      <input
                        value={editSupplier}
                        onChange={(e) => setEditSupplier(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Fakturanr</label>
                      <input
                        value={editInvoiceNumber}
                        onChange={(e) => setEditInvoiceNumber(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Fakturadatum</label>
                      <input
                        type="date"
                        value={editInvoiceDate}
                        onChange={(e) => setEditInvoiceDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Förfallodatum</label>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsEditingMeta(false)}
                      className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await onUpdateClassification({
                            supplier: editSupplier,
                            invoiceNumber: editInvoiceNumber,
                            invoiceDate: editInvoiceDate,
                            dueDate: editDueDate,
                          });
                          setIsEditingMeta(false);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                      className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      Spara
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-5 flex gap-1">
          <button
            onClick={() => setActiveTab('kontering')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'kontering' 
                ? 'bg-white text-gray-900 border-t border-x border-gray-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" />
              Kontering
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'ocr' 
                ? 'bg-white text-gray-900 border-t border-x border-gray-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              OCR-text
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'kontering' ? (
          <div className="space-y-5">
            {/* Payment Info */}
            {(c.bankgiro || c.plusgiro || c.paymentReference) && (
              <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Betalningsinformation</h4>
                <div className="grid grid-cols-2 gap-3">
                  {c.bankgiro && (
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase">Bankgiro</span>
                      <p className="font-mono text-sm font-medium text-gray-900">{c.bankgiro}</p>
                    </div>
                  )}
                  {c.plusgiro && (
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase">Plusgiro</span>
                      <p className="font-mono text-sm font-medium text-gray-900">{c.plusgiro}</p>
                    </div>
                  )}
                  {c.paymentReference && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-gray-500 uppercase">OCR/Referens</span>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-medium text-gray-900">{c.paymentReference}</p>
                        <button onClick={copyPaymentRef} className="p-1 hover:bg-gray-200 rounded transition-colors">
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Amount Summary */}
            <div className="grid grid-cols-3 gap-3">
              <InfoField 
                label="Netto" 
                value={formatCurrency(c.netAmount || (c.totalAmount - c.vatAmount), c.currency)} 
                icon={Banknote}
              />
              <InfoField 
                label={`Moms ${c.vatRate ? `(${c.vatRate}%)` : ''}`}
                value={formatCurrency(c.vatAmount, c.currency)} 
                icon={Percent}
              />
              <div className="bg-[#2d2d2d] rounded-lg p-3">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total</div>
                <div className="text-lg font-bold text-white">{formatCurrency(c.totalAmount, c.currency)}</div>
              </div>
            </div>

            {/* Line Items / Kontering */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#c0a280]" />
                Konteringsrader
              </h4>
              <div className="space-y-3">
                {c.lineItems.map((item, idx) => (
                  <div key={item.id || idx} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatCurrency(item.netAmount, c.currency)} netto
                          {item.vatAmount ? ` + ${formatCurrency(item.vatAmount, c.currency)} moms` : ''}
                        </p>
                        {(item.suggestionSource || item.suggestionReasoning) && (
                          <p className="text-[11px] text-gray-500 mt-1">
                            Förslag: <span className="font-medium text-gray-700">{item.suggestionSource || '—'}</span>
                            {item.suggestionReasoning ? ` · ${item.suggestionReasoning}` : ''}
                          </p>
                        )}
                      </div>
                      <ConfidenceBadge value={item.confidence} size="sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Konto</label>
                        <CustomSelect
                          value={item.suggestedAccount}
                          options={accountOptions}
                          onChange={(val) => onUpdateLineItem(item.id, 'suggestedAccount', val)}
                          size="sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Kostnadsställe</label>
                        <CustomSelect
                          value={item.suggestedCostCenter || ''}
                          options={costCenterOptions}
                          onChange={(val) => onUpdateLineItem(item.id, 'suggestedCostCenter', val)}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fortnox Preview */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                  <Send className="w-3.5 h-3.5 text-green-600" />
                </div>
                <h4 className="text-sm font-semibold text-green-800">
                  {c.docType === 'INVOICE' || c.docType === 'CREDIT_NOTE' ? 'Fortnox leverantörsfaktura' : 'Fortnox-verifikation'}
                </h4>
              </div>
              <div className="text-xs text-green-700 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Verifikationsdatum:</span>
                  <span>{c.invoiceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Verifikationstext:</span>
                  <span className="truncate max-w-[180px]">{c.supplier} - {c.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Serie:</span>
                  <span>{c.docType === 'INVOICE' || c.docType === 'CREDIT_NOTE' ? 'SupplierInvoice' : 'A'}</span>
                </div>
                {(c.docType === 'INVOICE' || c.docType === 'CREDIT_NOTE') && job.fortnoxInvoiceId && (
                  <div className="flex justify-between">
                    <span>GivenNumber:</span>
                    <span>{job.fortnoxInvoiceId}</span>
                  </div>
                )}
              </div>
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
      <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-gray-50/50">
        {job.status === 'ready' && (
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Godkänn
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Skicka till Fortnox
            </button>
          </div>
        )}
        {job.status === 'approved' && (
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Skicka till Fortnox
          </button>
        )}
        {job.status === 'sent' && (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Skickad till Fortnox {job.fortnoxInvoiceId ? `(${job.fortnoxInvoiceId})` : job.fortnoxVoucherId ? `(${job.fortnoxVoucherId})` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ RECEIPT VIEW ============

export function ReceiptDetailView({
  job,
  onApprove,
  onSendToFortnox,
  onUpdateLineItem,
  onUpdateClassification,
  onViewDocument,
  onClose,
}: {
  job: AccountingJob;
  onApprove: () => Promise<void>;
  onSendToFortnox: () => Promise<void>;
  onUpdateLineItem: (lineItemId: string, field: string, value: string) => void;
  onUpdateClassification?: (updates: Partial<Classification>) => Promise<void>;
  onViewDocument: () => void;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'kontering' | 'ocr'>('kontering');
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const c = job.classification!;
  const [editSupplier, setEditSupplier] = useState(c.supplier);
  const [editDate, setEditDate] = useState(c.invoiceDate);
  
  const category = detectReceiptCategory(c.supplier, c.rawTextSummary);
  const CategoryIcon = category.icon;

  const handleApprove = async () => {
    setIsLoading(true);
    try { await onApprove(); } finally { setIsLoading(false); }
  };

  const handleSend = async () => {
    setIsLoading(true);
    try { await onSendToFortnox(); } finally { setIsLoading(false); }
  };

  // Payment method display
  const paymentMethodDisplay = {
    card: { label: 'Kortbetalning', icon: CreditCard },
    cash: { label: 'Kontant', icon: Banknote },
    swish: { label: 'Swish', icon: Phone },
    invoice: { label: 'Faktura', icon: FileText },
    other: { label: 'Övrigt', icon: Receipt },
  };
  
  const pm = c.paymentMethod && paymentMethodDisplay[c.paymentMethod] 
    ? paymentMethodDisplay[c.paymentMethod] 
    : paymentMethodDisplay.other;
  const PaymentIcon = pm.icon;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header - Receipt specific with category styling */}
      <div className="flex-shrink-0 border-b border-gray-100">
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${category.bgColor} flex items-center justify-center`}>
                <CategoryIcon className={`w-6 h-6 ${category.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${category.bgColor} ${category.color}`}>
                    {category.category}
                  </span>
                  <ConfidenceBadge value={c.overallConfidence} size="sm" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mt-0.5">{c.supplier}</h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={onViewDocument}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs font-medium text-gray-600"
              >
                <Eye className="w-3.5 h-3.5" />
                Visa
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Receipt Quick Info - Different layout than invoice */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Datum</span>
                <p className="text-sm font-medium text-gray-900">{formatDate(c.invoiceDate)}</p>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Betalning</span>
                <div className="flex items-center gap-1.5">
                  <PaymentIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">{pm.label}</span>
                  {c.cardLastFour && <span className="text-xs text-gray-500">•••• {c.cardLastFour}</span>}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total</span>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(c.totalAmount, c.currency)}</p>
            </div>
          </div>

          {/* Explanation / guardrails */}
          {(c.policy?.summary || (c.originalCurrency && c.originalCurrency !== 'SEK')) && (
            <div className="mt-4 space-y-2">
              {c.policy?.summary && (
                <div className={`rounded-xl border px-4 py-3 ${
                  c.policy.violations?.some(v => v.severity === 'error')
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="text-xs font-semibold text-gray-700">Bokföringspolicy</div>
                  <div className="text-sm text-gray-800 mt-0.5">{c.policy.summary}</div>
                </div>
              )}
              {c.originalCurrency && c.originalCurrency !== 'SEK' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <div className="text-xs font-semibold text-gray-700">Valuta (underlag)</div>
                  <div className="text-sm text-gray-800 mt-0.5">
                    Original: {c.originalAmount?.toLocaleString('sv-SE', { minimumFractionDigits: 2 })} {c.originalCurrency} ·
                    Kurs: {c.exchangeRate?.toFixed(6)} ·
                    Datum: {c.exchangeRateDate || '—'} ·
                    Källa: {c.exchangeRateSource || '—'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick corrections */}
          {onUpdateClassification && (
            <div className="mt-4">
              <button
                onClick={() => setIsEditingMeta(v => !v)}
                className="text-xs font-medium text-gray-700 hover:text-gray-900 inline-flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Snabbkorrigering
              </button>
              {isEditingMeta && (
                <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Leverantör</label>
                      <input
                        value={editSupplier}
                        onChange={(e) => setEditSupplier(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Datum</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setIsEditingMeta(false)}
                      className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={async () => {
                        setIsLoading(true);
                        try {
                          await onUpdateClassification({ supplier: editSupplier, invoiceDate: editDate });
                          setIsEditingMeta(false);
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                      className="px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      Spara
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-5 flex gap-1">
          <button
            onClick={() => setActiveTab('kontering')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'kontering' 
                ? 'bg-white text-gray-900 border-t border-x border-gray-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Edit3 className="w-4 h-4" />
              Kontering
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ocr')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === 'ocr' 
                ? 'bg-white text-gray-900 border-t border-x border-gray-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              OCR-text
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'kontering' ? (
          <div className="space-y-5">
            {/* Amount Breakdown - Simplified for receipts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50/70 rounded-lg p-3">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Netto</span>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(c.netAmount || (c.totalAmount - c.vatAmount), c.currency)}</p>
              </div>
              <div className="bg-gray-50/70 rounded-lg p-3">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                  Moms {c.vatRate ? `(${c.vatRate}%)` : ''}
                </span>
                <p className="text-sm font-medium text-gray-900">{formatCurrency(c.vatAmount, c.currency)}</p>
              </div>
            </div>

            {/* Line Items - Receipt style (often just one item) */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#c0a280]" />
                Kontering
              </h4>
              
              {c.lineItems.length === 0 || (c.lineItems.length === 1 && c.lineItems[0].description === 'Enligt underlag') ? (
                // Simple single-item receipt view
                <div className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">{c.rawTextSummary || 'Kvitto från ' + c.supplier}</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(c.totalAmount, c.currency)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Konto</label>
                      <CustomSelect
                        value={c.lineItems[0]?.suggestedAccount || '5860'}
                        options={accountOptions}
                        onChange={(val) => onUpdateLineItem(c.lineItems[0]?.id || 'main', 'suggestedAccount', val)}
                        size="sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Kostnadsställe</label>
                      <CustomSelect
                        value={c.lineItems[0]?.suggestedCostCenter || ''}
                        options={costCenterOptions}
                        onChange={(val) => onUpdateLineItem(c.lineItems[0]?.id || 'main', 'suggestedCostCenter', val)}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // Multiple line items
                <div className="space-y-3">
                  {c.lineItems.map((item, idx) => (
                    <div key={item.id || idx} className="bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-medium text-gray-900">{item.description}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatCurrency(item.netAmount, c.currency)}
                          </p>
                        </div>
                        <ConfidenceBadge value={item.confidence} size="sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Konto</label>
                          <CustomSelect
                            value={item.suggestedAccount}
                            options={accountOptions}
                            onChange={(val) => onUpdateLineItem(item.id, 'suggestedAccount', val)}
                            size="sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1.5">Kostnadsställe</label>
                          <CustomSelect
                            value={item.suggestedCostCenter || ''}
                            options={costCenterOptions}
                            onChange={(val) => onUpdateLineItem(item.id, 'suggestedCostCenter', val)}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Receipt-specific hint about representation */}
            {category.category === 'Restaurang' || category.category === 'Café' ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-800">Representation?</h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Om detta är intern representation (personalfika) eller extern representation (kundmöte), 
                      glöm inte att ange deltagare och syfte vid bokföring i Fortnox.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
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
      <div className="flex-shrink-0 p-5 border-t border-gray-100 bg-gray-50/50">
        {job.status === 'ready' && (
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Godkänn
            </button>
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c0a280] text-white rounded-xl text-sm font-medium hover:bg-[#a08260] transition-colors shadow-lg shadow-[#c0a280]/20 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Skicka till Fortnox
            </button>
          </div>
        )}
        {job.status === 'approved' && (
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#c0a280] text-white rounded-xl text-sm font-medium hover:bg-[#a08260] transition-colors shadow-lg shadow-[#c0a280]/20 disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Skicka till Fortnox
          </button>
        )}
        {job.status === 'sent' && (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Skickad till Fortnox {job.fortnoxVoucherId && `(${job.fortnoxVoucherId})`}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Main Switcher Component ============

export function DocumentDetailView({
  job,
  onApprove,
  onSendToFortnox,
  onUpdateLineItem,
  onUpdateClassification,
  onViewDocument,
  onClose,
}: {
  job: AccountingJob;
  onApprove: () => Promise<void>;
  onSendToFortnox: () => Promise<void>;
  onUpdateLineItem: (lineItemId: string, field: string, value: string) => void;
  onUpdateClassification?: (updates: Partial<Classification>) => Promise<void>;
  onViewDocument: () => void;
  onClose: () => void;
}) {
  if (!job.classification) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 bg-white">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 animate-pulse text-[#c0a280]" />
          <p className="font-medium">Analyserar dokument...</p>
          <p className="text-sm mt-1">AI klassificerar och extraherar data</p>
        </div>
      </div>
    );
  }

  const docType = job.classification.docType;

  // Use specialized view based on document type
  if (docType === 'INVOICE' || docType === 'CREDIT_NOTE') {
    return (
      <InvoiceDetailView
        job={job}
        onApprove={onApprove}
        onSendToFortnox={onSendToFortnox}
        onUpdateLineItem={onUpdateLineItem}
        onUpdateClassification={onUpdateClassification}
        onViewDocument={onViewDocument}
        onClose={onClose}
      />
    );
  }

  if (docType === 'RECEIPT') {
    return (
      <ReceiptDetailView
        job={job}
        onApprove={onApprove}
        onSendToFortnox={onSendToFortnox}
        onUpdateLineItem={onUpdateLineItem}
        onUpdateClassification={onUpdateClassification}
        onViewDocument={onViewDocument}
        onClose={onClose}
      />
    );
  }

  // Fallback to invoice view for other types
  return (
    <InvoiceDetailView
      job={job}
      onApprove={onApprove}
      onSendToFortnox={onSendToFortnox}
      onUpdateLineItem={onUpdateLineItem}
      onUpdateClassification={onUpdateClassification}
      onViewDocument={onViewDocument}
      onClose={onClose}
    />
  );
}

