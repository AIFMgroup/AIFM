'use client';

// Force dynamic rendering to avoid SSR issues
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Download, Eye, Edit3,
  Send, Sparkles, AlertCircle, X,
  FileText, Calendar, Users, Clock, BarChart3,
  Save, Printer, Mail, RefreshCw, Loader2
} from 'lucide-react';

import { useCompany } from '@/components/CompanyContext';

interface ReportSection {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'not_started';
  lastEdited?: string;
  aiGenerated?: boolean;
  content?: string;
}

interface FinancialSummary {
  income: number;
  expenses: number;
  result: number;
}

// Fallback static data for when API has no data
const defaultReportSections: ReportSection[] = [
  { 
    id: '1', 
    title: 'Förvaltningsberättelse', 
    description: 'Beskrivning av verksamheten och väsentliga händelser', 
    status: 'completed', 
    lastEdited: '2024-11-20', 
    aiGenerated: true,
    content: `**Verksamheten**

Nordic Ventures I AB är ett riskkapitalbolag med fokus på investeringar i nordiska tillväxtbolag inom tech-sektorn.

**Väsentliga händelser under räkenskapsåret**

• Fonden har under året genomfört 3 nya investeringar till ett sammanlagt värde av 45 MSEK
• Portföljbolaget TechCorp AB noterades på Nasdaq First North i september
• Fondens NAV ökade med 12,4% under året till 128,5 MSEK

**Framtidsutsikter**

Styrelsen bedömer att marknadsutsikterna är fortsatt goda för fondens investeringsstrategi.`
  },
  { 
    id: '2', 
    title: 'Resultaträkning', 
    description: 'Intäkter, kostnader och årets resultat', 
    status: 'completed', 
    lastEdited: '2024-11-22',
    content: `**Resultaträkning 2024**

Rörelseintäkter
  Nettoomsättning: 0 SEK
  Övriga rörelseintäkter: 2 450 000 SEK
  
Rörelsekostnader
  Förvaltningskostnader: -1 850 000 SEK
  Övriga externa kostnader: -320 000 SEK
  
Rörelseresultat: 280 000 SEK

Finansiella poster
  Orealiserade värdeförändringar: 15 200 000 SEK
  Realiserade värdeförändringar: 3 400 000 SEK
  
Resultat före skatt: 18 880 000 SEK`
  },
  { 
    id: '3', 
    title: 'Balansräkning', 
    description: 'Tillgångar, skulder och eget kapital', 
    status: 'completed', 
    lastEdited: '2024-11-22',
    content: `**Balansräkning per 2024-12-31**

TILLGÅNGAR
Anläggningstillgångar
  Portföljinvesteringar: 118 500 000 SEK
  
Omsättningstillgångar
  Likvida medel: 10 000 000 SEK
  
SUMMA TILLGÅNGAR: 128 500 000 SEK

SKULDER OCH EGET KAPITAL
Eget kapital: 126 200 000 SEK
Kortfristiga skulder: 2 300 000 SEK

SUMMA SKULDER OCH EGET KAPITAL: 128 500 000 SEK`
  },
  { 
    id: '4', 
    title: 'Kassaflödesanalys', 
    description: 'In- och utbetalningar under året', 
    status: 'in_progress', 
    lastEdited: '2024-11-25',
    content: `**Kassaflödesanalys 2024**

Den löpande verksamheten
  Erhållna utdelningar: 2 100 000 SEK
  Betalda rörelsekostnader: -2 170 000 SEK
  
Kassaflöde från löpande verksamhet: -70 000 SEK

Investeringsverksamheten
  Förvärv av portföljbolag: -45 000 000 SEK
  Avyttring av portföljbolag: 12 500 000 SEK
  
[ARBETE PÅGÅR - Slutförs innan bokslut]`
  },
  { 
    id: '5', 
    title: 'Noter', 
    description: 'Förklaringar och specifikationer', 
    status: 'in_progress', 
    aiGenerated: true,
    content: `**Noter till årsredovisningen**

Not 1 - Redovisningsprinciper
Årsredovisningen har upprättats enligt årsredovisningslagen och BFNAR 2012:1.

Not 2 - Portföljinvesteringar
Specifikation av portföljbolag:
• TechCorp AB - 35 MSEK (28%)
• DataFlow Nordic - 28 MSEK (22%)
• AI Solutions AB - 25 MSEK (20%)
• Övriga (9 bolag) - 30,5 MSEK (30%)

[AI genererar ytterligare noter...]`
  },
  { id: '6', title: 'Revisionsberättelse', description: 'Revisorns granskning', status: 'pending' },
  { id: '7', title: 'Underskrifter', description: 'Signering av styrelse och VD', status: 'not_started' },
];

const timeline = [
  { date: '2024-12-31', event: 'Räkenskapsårets slut', status: 'upcoming', icon: Calendar },
  { date: '2025-02-28', event: 'Utkast till årsredovisning klart', status: 'upcoming', icon: FileText },
  { date: '2025-03-15', event: 'Revision genomförd', status: 'upcoming', icon: CheckCircle2 },
  { date: '2025-04-30', event: 'Styrelsemöte för godkännande', status: 'upcoming', icon: Users },
  { date: '2025-05-31', event: 'Årsstämma', status: 'upcoming', icon: Users },
  { date: '2025-06-30', event: 'Inlämning till Bolagsverket', status: 'upcoming', icon: Send },
];

function getStatusBadge(status: ReportSection['status']) {
  switch (status) {
    case 'completed':
      return <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">Klar</span>;
    case 'in_progress':
      return <span className="px-2 py-0.5 rounded-full bg-[#c0a280]/20 text-[#c0a280] text-xs font-medium">Pågår</span>;
    case 'pending':
      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Väntar</span>;
    case 'not_started':
      return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">Ej påbörjad</span>;
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

// Preview Modal
function PreviewModal({ section, onClose }: { section: ReportSection; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#c0a280]/10 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#c0a280]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{section.title}</h2>
              <p className="text-xs text-gray-500">Förhandsgranskning</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {section.content ? (
            <div className="prose prose-sm max-w-none">
              {section.content.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <h3 key={i} className="text-lg font-semibold text-gray-900 mt-4 mb-2">{line.replace(/\*\*/g, '')}</h3>;
                }
                if (line.startsWith('•')) {
                  return <li key={i} className="text-sm text-gray-700 ml-4">{line.substring(1).trim()}</li>;
                }
                if (line.trim() === '') {
                  return <br key={i} />;
                }
                return <p key={i} className="text-sm text-gray-700 mb-1">{line}</p>;
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Inget innehåll tillgängligt ännu</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {section.lastEdited && <span>Senast redigerad: {section.lastEdited}</span>}
            {section.aiGenerated && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-[#c0a280]/10 rounded text-[#c0a280]">
                <Sparkles className="w-3 h-3" />
                AI-genererad
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Skriv ut
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Edit Modal
function EditModal({ section, onClose, onSave }: { section: ReportSection; onClose: () => void; onSave: (content: string) => void }) {
  const [content, setContent] = useState(section.content || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSave(content);
      setIsSaving(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#c0a280]/10 rounded-lg flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-[#c0a280]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{section.title}</h2>
              <p className="text-xs text-gray-500">Redigera innehåll</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-3">
            <button className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#c0a280]" />
              Generera med AI
            </button>
            <span className="text-xs text-gray-400">Använd Markdown för formatering</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-[400px] p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900
                       font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#c0a280]/20 focus:border-[#c0a280]"
            placeholder="Skriv innehållet här..."
          />
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Avbryt
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-[#c0a280] text-white text-sm font-medium rounded-lg 
                       hover:bg-[#a08260] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Spara ändringar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast Notification
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info'; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl ${
        type === 'success' ? 'bg-emerald-600' : 'bg-gray-900'
      } text-white`}>
        {type === 'success' ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Mail className="w-5 h-5" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 p-1 hover:bg-white/10 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function AnnualReportPage() {
  const { selectedCompany: company } = useCompany();
  const [sections, setSections] = useState<ReportSection[]>(defaultReportSections);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<'content' | 'timeline' | 'export'>('content');
  const [previewSection, setPreviewSection] = useState<ReportSection | null>(null);
  const [editSection, setEditSection] = useState<ReportSection | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Fetch annual report data from API
  const fetchReportData = useCallback(async (showRefreshIndicator = false) => {
    if (!company?.id) return;

    if (showRefreshIndicator) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        companyId: company.id,
        companyName: company.name,
        year: selectedYear,
      });
      if (company.orgNumber) {
        params.append('orgNumber', company.orgNumber);
      }

      const response = await fetch(`/api/accounting/annual-report?${params}`);
      const data = await response.json();

      if (data.success && data.report) {
        // If API returns real data, use it
        if (data.report.sections && data.report.sections.length > 0) {
          setSections(data.report.sections);
        }
        setFinancialSummary(data.report.financialSummary);
      }
    } catch (error) {
      console.error('Error fetching annual report:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id, company?.name, company?.orgNumber, selectedYear]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const completedSections = sections.filter(s => s.status === 'completed').length;
  const inProgressSections = sections.filter(s => s.status === 'in_progress').length;
  const totalSections = sections.length;
  const progress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const showToast = (message: string, type: 'success' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaveSection = (sectionId: string, content: string) => {
    setSections(prev => prev.map(s => 
      s.id === sectionId 
        ? { ...s, content, lastEdited: new Date().toISOString().split('T')[0] }
        : s
    ));
    showToast('Ändringar sparade', 'success');
  };

  const handleSendToAuditor = () => {
    showToast('Årsredovisningen skickad till revisor', 'info');
  };

  const handlePreviewAll = () => {
    showToast('Förhandsgranskning öppnas...', 'info');
  };

  const handleExportWord = () => {
    showToast('Word-dokument laddas ner...', 'success');
  };

  const handleDownload = (format: string) => {
    showToast(`${format} laddas ner...`, 'success');
  };

  const handleGenerateAI = () => {
    showToast('AI genererar innehåll...', 'info');
  };

  if (!company) {
    return (
      
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">Välj ett bolag för att se årsredovisning.</p>
        </div>
      
    );
  }

  return (
    
      <div className="p-6 w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gray-900 tracking-tight">
              Årsredovisning
            </h1>
            <p className="text-gray-500 mt-1">
              {company.name}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchReportData(true)}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Uppdatera"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value={new Date().getFullYear().toString()}>Räkenskapsår {new Date().getFullYear()}</option>
              <option value={(new Date().getFullYear() - 1).toString()}>Räkenskapsår {new Date().getFullYear() - 1}</option>
            </select>
            <button 
              onClick={() => handleDownload('PDF')}
              className="px-4 py-2 text-sm bg-[#c0a280] hover:bg-[#a08260] text-white rounded-lg flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exportera PDF
            </button>
          </div>
        </div>

        {/* Financial Summary from API */}
        {financialSummary && (
          <Card className="bg-gradient-to-r from-gray-900 to-gray-800 border-gray-800">
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Årets resultat (från bokföring)</p>
                  <p className={`text-2xl font-light ${financialSummary.result >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(financialSummary.result)}
                  </p>
                </div>
                <div className="flex gap-8 text-sm">
                  <div>
                    <p className="text-gray-400">Intäkter</p>
                    <p className="text-white font-medium">
                      {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(financialSummary.income)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Kostnader</p>
                    <p className="text-white font-medium">
                      {new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0 }).format(financialSummary.expenses)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-[#c0a280]">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Framsteg</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-2xl font-light text-gray-900">{progress}%</div>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#c0a280] rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Klara</span>
              </div>
              <div className="text-2xl font-light text-gray-900">{completedSections}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Pågår</span>
              </div>
              <div className="text-2xl font-light text-gray-900">{inProgressSections}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-gray-400">
            <CardContent>
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Totalt</span>
              </div>
              <div className="text-2xl font-light text-gray-900">{totalSections}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            <div className="flex border-b border-gray-100">
              {[
                { key: 'content', label: 'Innehåll', icon: FileText },
                { key: 'timeline', label: 'Tidsplan', icon: Calendar },
                { key: 'export', label: 'Export', icon: Download },
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
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c0a280] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tab Content */}
        {activeTab === 'content' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Report Sections */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Innehåll</CardTitle>
                  <button 
                    onClick={handleGenerateAI}
                    className="text-sm text-[#c0a280] hover:text-[#a08260] flex items-center gap-1 px-3 py-1.5 bg-[#c0a280]/10 rounded-lg transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generera med AI
                  </button>
                </CardHeader>
                <div className="divide-y divide-gray-50">
                  {sections.map((section, index) => (
                    <div key={section.id} className="px-4 py-4 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                          ${section.status === 'completed' ? 'bg-green-100' : 
                            section.status === 'in_progress' ? 'bg-[#c0a280]/20' : 
                            'bg-gray-100'}`}
                        >
                          {section.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium text-gray-900">{section.title}</h3>
                            {getStatusBadge(section.status)}
                            {section.aiGenerated && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#c0a280]/10 rounded text-xs text-[#c0a280]">
                                <Sparkles className="w-3 h-3" />
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{section.description}</p>
                          {section.lastEdited && (
                            <p className="text-xs text-gray-400 mt-1">Senast redigerad: {section.lastEdited}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button 
                            onClick={() => setPreviewSection(section)}
                            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" 
                            title="Förhandsgranska"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setEditSection(section)}
                            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" 
                            title="Redigera"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800">
                <div className="p-4">
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                    Åtgärder
                  </h3>
                  <div className="space-y-2">
                    <button 
                      onClick={handlePreviewAll}
                      className="w-full flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm text-white">Förhandsgranska hela</span>
                      <Eye className="w-4 h-4 text-gray-400" />
                    </button>
                    <button 
                      onClick={handleExportWord}
                      className="w-full flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm text-white">Exportera till Word</span>
                      <Download className="w-4 h-4 text-gray-400" />
                    </button>
                    <button 
                      onClick={handleSendToAuditor}
                      className="w-full flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <span className="text-sm text-white">Skicka till revisor</span>
                      <Send className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent>
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Observera</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Kassaflödesanalysen behöver slutföras innan årsredovisningen kan färdigställas.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <Card>
            <CardHeader>
              <CardTitle>Tidsplan för årsredovisning {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-gray-200" />
                
                <div className="space-y-6">
                  {timeline.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <div key={index} className="flex gap-6 relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 flex-shrink-0
                          ${item.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'}`}
                        >
                          <Icon className={`w-5 h-5 ${item.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900">{item.event}</p>
                              <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md">{item.date}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {item.status === 'completed' ? (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Klart
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  Kommande
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === 'export' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'PDF-format', desc: 'Komplett årsredovisning i PDF-format', icon: FileText, primary: true },
              { title: 'Word-format', desc: 'Redigerbart Word-dokument', icon: FileText },
              { title: 'Excel-bilaga', desc: 'Sifferunderlag och specifikationer', icon: BarChart3 },
              { title: 'Enskilda delar', desc: 'Exportera enskilda avsnitt', icon: FileText },
              { title: 'Revisorspaket', desc: 'Komplett paket för revisor', icon: Users },
              { title: 'Bolagsverket', desc: 'Format för inlämning till Bolagsverket', icon: Send },
            ].map((item, index) => (
              <Card key={index} className={`transition-all hover:shadow-lg
                ${item.primary ? 'bg-gray-900 border-gray-900' : ''}`}
              >
                <CardContent>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4
                    ${item.primary ? 'bg-white/10' : 'bg-[#c0a280]/10'}`}
                  >
                    <item.icon className={`w-6 h-6 ${item.primary ? 'text-white' : 'text-[#c0a280]'}`} />
                  </div>
                  <h3 className={`font-medium mb-1 ${item.primary ? 'text-white' : 'text-gray-900'}`}>
                    {item.title}
                  </h3>
                  <p className={`text-sm mb-4 ${item.primary ? 'text-white/60' : 'text-gray-500'}`}>
                    {item.desc}
                  </p>
                  <button 
                    onClick={() => handleDownload(item.title)}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${item.primary 
                      ? 'bg-[#c0a280] text-white hover:bg-[#a08260]' 
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                  >
                    <Download className="w-4 h-4" />
                    Ladda ner
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modals */}
        {previewSection && (
          <PreviewModal section={previewSection} onClose={() => setPreviewSection(null)} />
        )}
        
        {editSection && (
          <EditModal 
            section={editSection} 
            onClose={() => setEditSection(null)} 
            onSave={(content) => handleSaveSection(editSection.id, content)}
          />
        )}

        {/* Toast */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    
  );
}
