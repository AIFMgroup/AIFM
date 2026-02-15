'use client';

import { useState, useMemo } from 'react';
import { 
  Download, FileText, Users, Building2, Calculator, FolderOpen,
  Calendar, CheckCircle2, Circle, ChevronDown, FileSpreadsheet,
  FileArchive, File, Clock, Shield, BarChart3, Wallet, Scale,
  AlertCircle, Loader2, Check, X, ArrowRight, Filter, Info
} from 'lucide-react';
import { useCompany } from '@/components/CompanyContext';

// ============================================================================
// Types
// ============================================================================

interface ExportCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  sections: ExportSection[];
}

interface ExportSection {
  id: string;
  name: string;
  description: string;
  estimatedSize?: string;
  format: ('pdf' | 'xlsx' | 'csv' | 'json')[];
  requiresDateRange?: boolean;
  premium?: boolean;
}

interface ExportSelection {
  sectionId: string;
  format: string;
  dateRange?: { from: string; to: string };
}

// ============================================================================
// Export Categories Data
// ============================================================================

const exportCategories: ExportCategory[] = [
  {
    id: 'financial',
    name: 'Ekonomi & Bokföring',
    description: 'Finansiella rapporter, transaktioner och bokslut',
    icon: Calculator,
    color: 'from-aifm-charcoal to-aifm-charcoal/80',
    sections: [
      { 
        id: 'general_ledger', 
        name: 'Huvudbok', 
        description: 'Alla bokföringstransaktioner',
        estimatedSize: '~2.5 MB',
        format: ['xlsx', 'pdf', 'csv'],
        requiresDateRange: true
      },
      { 
        id: 'trial_balance', 
        name: 'Råbalans', 
        description: 'Saldon per konto',
        estimatedSize: '~150 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'income_statement', 
        name: 'Resultaträkning', 
        description: 'Intäkter och kostnader',
        estimatedSize: '~100 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'balance_sheet', 
        name: 'Balansräkning', 
        description: 'Tillgångar, skulder och eget kapital',
        estimatedSize: '~120 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'invoices', 
        name: 'Fakturor', 
        description: 'Alla leverantörsfakturor med bilagor',
        estimatedSize: '~15 MB',
        format: ['xlsx', 'pdf', 'json'],
        requiresDateRange: true
      },
      { 
        id: 'vat_report', 
        name: 'Momsrapport', 
        description: 'Momsunderlag och deklaration',
        estimatedSize: '~80 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'annual_report', 
        name: 'Årsredovisning', 
        description: 'Komplett årsredovisning',
        estimatedSize: '~5 MB',
        format: ['pdf'],
        requiresDateRange: true
      },
      { 
        id: 'sie_export', 
        name: 'SIE-fil', 
        description: 'Standard Interchange Format',
        estimatedSize: '~500 KB',
        format: ['csv'],
        requiresDateRange: true
      },
    ]
  },
  {
    id: 'fund',
    name: 'Fond & NAV',
    description: 'Fonddata, värderingar och NAV-beräkningar',
    icon: BarChart3,
    color: 'from-aifm-gold to-aifm-gold/80',
    sections: [
      { 
        id: 'nav_history', 
        name: 'NAV-historik', 
        description: 'Historiska NAV-värden',
        estimatedSize: '~200 KB',
        format: ['xlsx', 'csv', 'json'],
        requiresDateRange: true
      },
      { 
        id: 'portfolio', 
        name: 'Portföljinnehav', 
        description: 'Alla tillgångar och värderingar',
        estimatedSize: '~1 MB',
        format: ['xlsx', 'pdf', 'json']
      },
      { 
        id: 'performance', 
        name: 'Avkastningsrapport', 
        description: 'Performance och benchmark',
        estimatedSize: '~300 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'fund_factsheet', 
        name: 'Fondblad', 
        description: 'Sammanfattande fondrapport',
        estimatedSize: '~2 MB',
        format: ['pdf']
      },
    ]
  },
  {
    id: 'investors',
    name: 'Investerare & Kapital',
    description: 'Investerardata, kapitalanrop och utdelningar',
    icon: Users,
    color: 'from-aifm-charcoal/90 to-aifm-charcoal/70',
    sections: [
      { 
        id: 'investor_list', 
        name: 'Investerarregister', 
        description: 'Alla investerare med kontaktuppgifter',
        estimatedSize: '~500 KB',
        format: ['xlsx', 'csv', 'json']
      },
      { 
        id: 'commitments', 
        name: 'Åtaganden', 
        description: 'Kapitalåtaganden per investerare',
        estimatedSize: '~150 KB',
        format: ['xlsx', 'pdf']
      },
      { 
        id: 'capital_calls', 
        name: 'Kapitalanrop', 
        description: 'Historik över kapitalanrop',
        estimatedSize: '~300 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'distributions', 
        name: 'Utdelningar', 
        description: 'Alla utdelningar till investerare',
        estimatedSize: '~250 KB',
        format: ['xlsx', 'pdf'],
        requiresDateRange: true
      },
      { 
        id: 'investor_statements', 
        name: 'Investerarrapporter', 
        description: 'Individuella kontoutdrag',
        estimatedSize: '~10 MB',
        format: ['pdf'],
        premium: true
      },
    ]
  },
  {
    id: 'documents',
    name: 'Dokument & Datarum',
    description: 'Alla uppladdade dokument och avtal',
    icon: FolderOpen,
    color: 'from-aifm-gold/90 to-aifm-gold/70',
    sections: [
      { 
        id: 'all_documents', 
        name: 'Alla dokument', 
        description: 'Komplett dokumentarkiv',
        estimatedSize: '~500 MB',
        format: ['pdf']
      },
      { 
        id: 'contracts', 
        name: 'Avtal', 
        description: 'Alla avtal och kontrakt',
        estimatedSize: '~50 MB',
        format: ['pdf']
      },
      { 
        id: 'dataroom_export', 
        name: 'Datarum', 
        description: 'Specifikt datarum med struktur',
        estimatedSize: 'Varierar',
        format: ['pdf']
      },
      { 
        id: 'document_index', 
        name: 'Dokumentförteckning', 
        description: 'Lista över alla dokument',
        estimatedSize: '~100 KB',
        format: ['xlsx', 'csv']
      },
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance & Audit',
    description: 'Regulatoriska rapporter och granskningsunderlag',
    icon: Shield,
    color: 'from-aifm-charcoal/80 to-aifm-charcoal/60',
    sections: [
      { 
        id: 'kyc_records', 
        name: 'KYC-dokumentation', 
        description: 'Kundkännedom per investerare',
        estimatedSize: '~20 MB',
        format: ['pdf', 'xlsx']
      },
      { 
        id: 'aml_report', 
        name: 'AML-rapport', 
        description: 'Penningtvättsöversikt',
        estimatedSize: '~500 KB',
        format: ['pdf'],
        requiresDateRange: true
      },
      { 
        id: 'audit_trail', 
        name: 'Granskningslogg', 
        description: 'Alla systemhändelser',
        estimatedSize: '~5 MB',
        format: ['xlsx', 'csv', 'json'],
        requiresDateRange: true
      },
      { 
        id: 'fi_reports', 
        name: 'FI-rapporter', 
        description: 'Rapporter till Finansinspektionen',
        estimatedSize: '~2 MB',
        format: ['pdf', 'xlsx'],
        requiresDateRange: true
      },
    ]
  },
  {
    id: 'crm',
    name: 'CRM & Kontakter',
    description: 'Kundregister och aktivitetshistorik',
    icon: Building2,
    color: 'from-aifm-gold/80 to-aifm-gold/60',
    sections: [
      { 
        id: 'contacts', 
        name: 'Kontakter', 
        description: 'Alla kontakter med detaljer',
        estimatedSize: '~300 KB',
        format: ['xlsx', 'csv', 'json']
      },
      { 
        id: 'companies', 
        name: 'Företag', 
        description: 'Företagsregister',
        estimatedSize: '~200 KB',
        format: ['xlsx', 'csv', 'json']
      },
      { 
        id: 'activities', 
        name: 'Aktiviteter', 
        description: 'Möten, samtal och noteringar',
        estimatedSize: '~1 MB',
        format: ['xlsx', 'csv'],
        requiresDateRange: true
      },
      { 
        id: 'pipeline', 
        name: 'Pipeline', 
        description: 'Affärsmöjligheter och status',
        estimatedSize: '~150 KB',
        format: ['xlsx', 'csv']
      },
    ]
  },
];

// ============================================================================
// Format Icons
// ============================================================================

const formatIcons: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  pdf: { icon: FileText, label: 'PDF', color: 'text-red-500 bg-red-50' },
  xlsx: { icon: FileSpreadsheet, label: 'Excel', color: 'text-aifm-charcoal/70 bg-aifm-charcoal/[0.06]' },
  csv: { icon: File, label: 'CSV', color: 'text-aifm-gold bg-aifm-gold/10' },
  json: { icon: FileArchive, label: 'JSON', color: 'text-aifm-charcoal/50 bg-aifm-charcoal/[0.04]' },
};

// ============================================================================
// Components
// ============================================================================

function CategoryCard({ 
  category, 
  isExpanded, 
  onToggle,
  selections,
  onSelectionChange 
}: { 
  category: ExportCategory;
  isExpanded: boolean;
  onToggle: () => void;
  selections: ExportSelection[];
  onSelectionChange: (sectionId: string, format: string | null) => void;
}) {
  const Icon = category.icon;
  const selectedCount = selections.filter(s => 
    category.sections.some(sec => sec.id === s.sectionId)
  ).length;

  return (
    <div className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${
      isExpanded ? 'border-aifm-gold/30 shadow-lg shadow-aifm-gold/5' : 'border-gray-100 hover:border-gray-200'
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center gap-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} 
                        flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-aifm-charcoal">{category.name}</h3>
            {selectedCount > 0 && (
              <span className="px-2 py-0.5 bg-aifm-gold/10 text-aifm-gold text-xs font-medium rounded-full">
                {selectedCount} vald{selectedCount > 1 ? 'a' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-aifm-charcoal/50">{category.description}</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-aifm-charcoal/40 transition-transform duration-300 ${
          isExpanded ? 'rotate-180' : ''
        }`} />
      </button>

      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-[1000px]' : 'max-h-0'} overflow-hidden`}>
        <div className="px-5 pb-5 space-y-2">
          {category.sections.map((section) => {
            const selection = selections.find(s => s.sectionId === section.id);
            const isSelected = !!selection;

            return (
              <div
                key={section.id}
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isSelected 
                    ? 'bg-aifm-gold/5 border-aifm-gold/30' 
                    : 'bg-gray-50 border-transparent hover:border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onSelectionChange(section.id, isSelected ? null : section.format[0])}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                               transition-all ${
                                 isSelected 
                                   ? 'bg-aifm-gold border-aifm-gold' 
                                   : 'border-gray-300 hover:border-aifm-gold'
                               }`}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-aifm-charcoal">{section.name}</p>
                      {section.premium && (
                        <span className="px-1.5 py-0.5 bg-aifm-gold/15 text-aifm-charcoal text-[10px] font-semibold rounded-full">
                          PREMIUM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-aifm-charcoal/50 mt-0.5">{section.description}</p>
                    
                    {/* Format selector */}
                    {isSelected && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-aifm-charcoal/40">Format:</span>
                        {section.format.map((fmt) => {
                          const fmtConfig = formatIcons[fmt];
                          const FmtIcon = fmtConfig.icon;
                          const isSelectedFormat = selection?.format === fmt;
                          
                          return (
                            <button
                              key={fmt}
                              onClick={() => onSelectionChange(section.id, fmt)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                         transition-all ${
                                           isSelectedFormat 
                                             ? 'bg-aifm-charcoal text-white' 
                                             : `${fmtConfig.color} hover:opacity-80`
                                         }`}
                            >
                              <FmtIcon className="w-3.5 h-3.5" />
                              {fmtConfig.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {section.estimatedSize && (
                    <span className="text-xs text-aifm-charcoal/30 flex-shrink-0">
                      {section.estimatedSize}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExportSummary({ 
  selections, 
  categories,
  onRemove,
  onExport,
  isExporting
}: { 
  selections: ExportSelection[];
  categories: ExportCategory[];
  onRemove: (sectionId: string) => void;
  onExport: () => void;
  isExporting: boolean;
}) {
  const totalItems = selections.length;
  
  // Calculate estimated total size
  const estimatedSize = useMemo(() => {
    let totalMB = 0;
    selections.forEach(sel => {
      categories.forEach(cat => {
        const section = cat.sections.find(s => s.id === sel.sectionId);
        if (section?.estimatedSize) {
          const match = section.estimatedSize.match(/~?([\d.]+)\s*(MB|KB)/i);
          if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2].toUpperCase();
            totalMB += unit === 'MB' ? value : value / 1024;
          }
        }
      });
    });
    return totalMB > 1 ? `~${totalMB.toFixed(1)} MB` : `~${(totalMB * 1024).toFixed(0)} KB`;
  }, [selections, categories]);

  if (totalItems === 0) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
        <Download className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-aifm-charcoal/60 font-medium">Ingen data vald</p>
        <p className="text-sm text-aifm-charcoal/40 mt-1">
          Välj data från kategorierna till vänster
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-aifm-charcoal">Exportsammanfattning</h3>
            <p className="text-sm text-aifm-charcoal/50">{totalItems} objekt • {estimatedSize}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-aifm-gold/10 flex items-center justify-center">
            <FileArchive className="w-6 h-6 text-aifm-gold" />
          </div>
        </div>
      </div>

      <div className="p-5 space-y-2 max-h-[400px] overflow-y-auto">
        {selections.map((sel) => {
          let sectionName = '';
          let categoryName = '';
          categories.forEach(cat => {
            const section = cat.sections.find(s => s.id === sel.sectionId);
            if (section) {
              sectionName = section.name;
              categoryName = cat.name;
            }
          });
          
          const fmtConfig = formatIcons[sel.format];
          const FmtIcon = fmtConfig?.icon || File;

          return (
            <div 
              key={sel.sectionId}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group"
            >
              <div className={`w-8 h-8 rounded-lg ${fmtConfig?.color || 'bg-gray-100'} 
                            flex items-center justify-center`}>
                <FmtIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-aifm-charcoal truncate">{sectionName}</p>
                <p className="text-xs text-aifm-charcoal/40">{categoryName}</p>
              </div>
              <span className="text-xs text-aifm-charcoal/30 uppercase">{sel.format}</span>
              <button
                onClick={() => onRemove(sel.sectionId)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 
                          text-red-500 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-5 border-t border-gray-100 bg-gray-50">
        <button
          onClick={onExport}
          disabled={isExporting || totalItems === 0}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-aifm-charcoal 
                    text-white rounded-full font-medium hover:bg-aifm-charcoal/90 transition-all shadow-sm
                    disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Förbereder export...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Ladda ner ({totalItems} filer)
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ExportPage() {
  const { selectedCompany } = useCompany();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['financial']);
  const [selections, setSelections] = useState<ExportSelection[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSelectionChange = (sectionId: string, format: string | null) => {
    setSelections(prev => {
      if (format === null) {
        return prev.filter(s => s.sectionId !== sectionId);
      }
      
      const existing = prev.find(s => s.sectionId === sectionId);
      if (existing) {
        return prev.map(s => s.sectionId === sectionId ? { ...s, format } : s);
      }
      
      return [...prev, { sectionId, format, dateRange }];
    });
  };

  const handleRemove = (sectionId: string) => {
    setSelections(prev => prev.filter(s => s.sectionId !== sectionId));
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In production, this would call the API and download files
    alert(`Export av ${selections.length} filer startad!`);
    
    setIsExporting(false);
  };

  const selectAll = (categoryId: string) => {
    const category = exportCategories.find(c => c.id === categoryId);
    if (!category) return;
    
    const newSelections = [...selections];
    category.sections.forEach(section => {
      if (!newSelections.find(s => s.sectionId === section.id)) {
        newSelections.push({
          sectionId: section.id,
          format: section.format[0],
          dateRange
        });
      }
    });
    setSelections(newSelections);
  };

  const deselectAll = (categoryId: string) => {
    const category = exportCategories.find(c => c.id === categoryId);
    if (!category) return;
    
    const sectionIds = category.sections.map(s => s.id);
    setSelections(prev => prev.filter(s => !sectionIds.includes(s.sectionId)));
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-aifm-charcoal tracking-tight">Exportera data</h1>
            <p className="text-sm text-aifm-charcoal/40">
              {selectedCompany?.name || 'Välj företag'} • Välj vad du vill ladda ner
            </p>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-2">
            <Calendar className="w-4 h-4 text-aifm-charcoal/40 ml-2" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-2 py-1.5 text-sm bg-transparent border-0 focus:outline-none focus:ring-0"
            />
            <ArrowRight className="w-4 h-4 text-aifm-charcoal/30" />
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-2 py-1.5 text-sm bg-transparent border-0 focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-aifm-gold/[0.06] rounded-2xl border border-aifm-gold/20 p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-aifm-gold flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-aifm-charcoal/70">
            Välj de datakategorier du vill exportera. Alla filer paketeras i en ZIP-fil för enkel nedladdning.
            Data som kräver tidsperiod använder det valda datumintervallet ovan.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Categories */}
        <div className="lg:col-span-2 space-y-4">
          {exportCategories.map((category) => (
            <div key={category.id}>
              {/* Quick actions */}
              {expandedCategories.includes(category.id) && (
                <div className="flex justify-end gap-2 mb-2">
                  <button
                    onClick={() => selectAll(category.id)}
                    className="text-xs text-aifm-gold hover:underline"
                  >
                    Välj alla
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => deselectAll(category.id)}
                    className="text-xs text-aifm-charcoal/40 hover:text-aifm-charcoal"
                  >
                    Avmarkera
                  </button>
                </div>
              )}
              <CategoryCard
                category={category}
                isExpanded={expandedCategories.includes(category.id)}
                onToggle={() => toggleCategory(category.id)}
                selections={selections}
                onSelectionChange={handleSelectionChange}
              />
            </div>
          ))}
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <ExportSummary
              selections={selections}
              categories={exportCategories}
              onRemove={handleRemove}
              onExport={handleExport}
              isExporting={isExporting}
            />

            {/* Export Tips */}
            <div className="mt-4 bg-gray-50 rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-aifm-charcoal mb-3">Tips</h4>
              <ul className="space-y-2 text-xs text-aifm-charcoal/60">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-aifm-gold flex-shrink-0 mt-0.5" />
                  PDF för dokument som ska delas externt
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-aifm-gold flex-shrink-0 mt-0.5" />
                  Excel för data som ska bearbetas vidare
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-aifm-gold flex-shrink-0 mt-0.5" />
                  JSON för systemintegration
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-aifm-gold flex-shrink-0 mt-0.5" />
                  SIE för import till bokföringssystem
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


