'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, Download, Eye, Edit3,
  Send, Sparkles, AlertCircle, ChevronRight, X,
  FileText, Calendar, Users, Clock, BarChart3,
  Save, Printer, Mail
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useCompany } from '@/components/CompanyContext';
import { MinimalSelect } from '@/components/MinimalSelect';

interface ReportSection {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending' | 'not_started';
  lastEdited?: string;
  aiGenerated?: boolean;
  content?: string;
}

const reportSections: ReportSection[] = [
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
      return <span className="px-2 py-0.5 rounded-full bg-aifm-gold/20 text-aifm-gold text-xs font-medium">Pågår</span>;
    case 'pending':
      return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Väntar</span>;
    case 'not_started':
      return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">Ej påbörjad</span>;
  }
}

// Tab Button Component
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-all relative whitespace-nowrap ${
        active 
          ? 'text-aifm-charcoal' 
          : 'text-aifm-charcoal/50 hover:text-aifm-charcoal/70'
      }`}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-aifm-gold rounded-full" />
      )}
    </button>
  );
}

// Hero Metric
function HeroMetric({ label, value, color = 'white' }: { label: string; value: string; color?: 'white' | 'green' | 'amber' }) {
  const textColors = {
    white: 'text-white',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
  };
  
  return (
    <div className="text-center">
      <p className={`text-2xl sm:text-3xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-xs text-white/50 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

// Preview Modal
function PreviewModal({ section, onClose }: { section: ReportSection; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <h2 className="font-semibold text-aifm-charcoal">{section.title}</h2>
              <p className="text-xs text-aifm-charcoal/50">Förhandsgranskning</p>
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
                  return <h3 key={i} className="text-lg font-semibold text-aifm-charcoal mt-4 mb-2">{line.replace(/\*\*/g, '')}</h3>;
                }
                if (line.startsWith('•')) {
                  return <li key={i} className="text-sm text-aifm-charcoal/70 ml-4">{line.substring(1).trim()}</li>;
                }
                if (line.trim() === '') {
                  return <br key={i} />;
                }
                return <p key={i} className="text-sm text-aifm-charcoal/70 mb-1">{line}</p>;
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-aifm-charcoal/50">Inget innehåll tillgängligt ännu</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-aifm-charcoal/50">
            {section.lastEdited && <span>Senast redigerad: {section.lastEdited}</span>}
            {section.aiGenerated && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-aifm-gold/10 rounded text-aifm-gold">
                <Sparkles className="w-3 h-3" />
                AI-genererad
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm text-aifm-charcoal/60 hover:text-aifm-charcoal transition-colors flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Skriv ut
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-aifm-charcoal text-white text-sm font-medium rounded-lg hover:bg-aifm-charcoal/90 transition-colors"
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
            <div className="w-10 h-10 bg-aifm-gold/10 rounded-lg flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-aifm-gold" />
            </div>
            <div>
              <h2 className="font-semibold text-aifm-charcoal">{section.title}</h2>
              <p className="text-xs text-aifm-charcoal/50">Redigera innehåll</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-3">
            <button className="px-3 py-1.5 text-xs font-medium text-aifm-charcoal bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-aifm-gold" />
              Generera med AI
            </button>
            <span className="text-xs text-aifm-charcoal/40">Använd Markdown för formatering</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-[400px] p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-aifm-charcoal
                       font-mono resize-none focus:outline-none focus:ring-2 focus:ring-aifm-gold/20 focus:border-aifm-gold"
            placeholder="Skriv innehållet här..."
          />
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-aifm-charcoal/60 hover:text-aifm-charcoal transition-colors"
          >
            Avbryt
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 bg-aifm-gold text-aifm-charcoal text-sm font-medium rounded-lg 
                       hover:bg-aifm-gold/90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-aifm-charcoal/30 border-t-aifm-charcoal rounded-full animate-spin" />
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
        type === 'success' ? 'bg-emerald-600' : 'bg-aifm-charcoal'
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
  useCompany();
  const [sections, setSections] = useState<ReportSection[]>(reportSections);
  const [selectedYear, setSelectedYear] = useState('2024');
  const [activeTab, setActiveTab] = useState<'content' | 'timeline' | 'export'>('content');
  const [previewSection, setPreviewSection] = useState<ReportSection | null>(null);
  const [editSection, setEditSection] = useState<ReportSection | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const completedSections = sections.filter(s => s.status === 'completed').length;
  const inProgressSections = sections.filter(s => s.status === 'in_progress').length;
  const totalSections = sections.length;
  const progress = Math.round((completedSections / totalSections) * 100);

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

  const yearOptions = [
    { value: '2024', label: 'Räkenskapsår 2024' },
    { value: '2023', label: 'Räkenskapsår 2023' },
  ];

  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-aifm-charcoal via-aifm-charcoal to-aifm-charcoal/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
        </div>
        
        <div className="relative">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-white/40 mb-4">
            <Link href="/accounting" className="hover:text-white/60 transition-colors">Bokföring</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white/70">Årsredovisning</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Årsredovisning
              </h1>
              <p className="text-white/60 text-sm">
                Generera och granska årsredovisningen för räkenskapsåret {selectedYear}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <MinimalSelect
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />
              <button 
                onClick={() => handleDownload('PDF')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-aifm-charcoal 
                         bg-aifm-gold rounded-xl hover:bg-aifm-gold/90 
                         shadow-lg shadow-aifm-gold/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportera PDF</span>
              </button>
            </div>
          </div>

          {/* Hero Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/50 uppercase tracking-wider">Framsteg</span>
                <span className="text-xl font-bold text-white">{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-aifm-gold rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <HeroMetric label="Klara" value={completedSections.toString()} color="green" />
            <HeroMetric label="Pågår" value={inProgressSections.toString()} color="amber" />
            <HeroMetric label="Totalt" value={totalSections.toString()} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100/50 mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-100 min-w-max">
          <TabButton active={activeTab === 'content'} onClick={() => setActiveTab('content')}>
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Innehåll
            </span>
          </TabButton>
          <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Tidsplan
            </span>
          </TabButton>
          <TabButton active={activeTab === 'export'} onClick={() => setActiveTab('export')}>
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </span>
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'content' && (
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Report Sections */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
                  Innehåll
                </h2>
                <button 
                  onClick={handleGenerateAI}
                  className="text-sm text-aifm-gold hover:text-aifm-gold/80 flex items-center gap-1 px-3 py-1.5 bg-aifm-gold/10 rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Generera med AI</span>
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {sections.map((section, index) => (
                  <div key={section.id} className="px-5 sm:px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0
                        ${section.status === 'completed' ? 'bg-green-100' : 
                          section.status === 'in_progress' ? 'bg-aifm-gold/20' : 
                          'bg-gray-100'}`}
                      >
                        {section.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                        ) : (
                          <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-aifm-charcoal">{section.title}</h3>
                          {getStatusBadge(section.status)}
                          {section.aiGenerated && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-aifm-gold/10 rounded text-xs text-aifm-gold">
                              <Sparkles className="w-3 h-3" />
                              AI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-aifm-charcoal/50">{section.description}</p>
                        {section.lastEdited && (
                          <p className="text-xs text-aifm-charcoal/40 mt-1">Senast redigerad: {section.lastEdited}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button 
                          onClick={() => setPreviewSection(section)}
                          className="p-2 text-gray-400 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors" 
                          title="Förhandsgranska"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setEditSection(section)}
                          className="p-2 text-gray-400 hover:text-aifm-charcoal hover:bg-gray-100 rounded-lg transition-colors" 
                          title="Redigera"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-aifm-charcoal rounded-xl sm:rounded-2xl p-5 sm:p-6">
              <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-4">
                Åtgärder
              </h3>
              <div className="space-y-2">
                <button 
                  onClick={handlePreviewAll}
                  className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm">Förhandsgranska hela</span>
                  <Eye className="w-4 h-4 text-white/50" />
                </button>
                <button 
                  onClick={handleExportWord}
                  className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm">Exportera till Word</span>
                  <Download className="w-4 h-4 text-white/50" />
                </button>
                <button 
                  onClick={handleSendToAuditor}
                  className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  <span className="text-sm">Skicka till revisor</span>
                  <Send className="w-4 h-4 text-white/50" />
                </button>
              </div>
            </div>

            {/* Alerts */}
            <div className="bg-amber-50 rounded-xl sm:rounded-2xl border border-amber-200 p-4 sm:p-5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Observera</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Kassaflödesanalysen behöver slutföras innan årsredovisningen kan färdigställas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-aifm-charcoal/60 uppercase tracking-wider">
              Tidsplan för årsredovisning {selectedYear}
            </h2>
          </div>
          <div className="p-5 sm:p-8">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 sm:left-6 top-6 bottom-6 w-0.5 bg-gray-200" />
              
              <div className="space-y-6 sm:space-y-8">
                {timeline.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex gap-4 sm:gap-6 relative">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center z-10 flex-shrink-0
                        ${item.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'}`}
                      >
                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${item.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 pb-6 sm:pb-0">
                        <div className="bg-gray-50 rounded-xl p-4 sm:p-5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-aifm-charcoal">{item.event}</p>
                            <span className="text-xs text-aifm-charcoal/50 bg-white px-2 py-1 rounded-md self-start">{item.date}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {item.status === 'completed' ? (
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 className="w-3 h-3" />
                                Klart
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-aifm-charcoal/50">
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
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[
            { title: 'PDF-format', desc: 'Komplett årsredovisning i PDF-format', icon: FileText, primary: true },
            { title: 'Word-format', desc: 'Redigerbart Word-dokument', icon: FileText },
            { title: 'Excel-bilaga', desc: 'Sifferunderlag och specifikationer', icon: BarChart3 },
            { title: 'Enskilda delar', desc: 'Exportera enskilda avsnitt', icon: FileText },
            { title: 'Revisorspaket', desc: 'Komplett paket för revisor', icon: Users },
            { title: 'Bolagsverket', desc: 'Format för inlämning till Bolagsverket', icon: Send },
          ].map((item, index) => (
            <div key={index} className={`rounded-xl sm:rounded-2xl border p-5 sm:p-6 transition-all hover:shadow-lg
              ${item.primary ? 'bg-aifm-charcoal border-aifm-charcoal text-white' : 'bg-white border-gray-100'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4
                ${item.primary ? 'bg-white/10' : 'bg-aifm-gold/10'}`}
              >
                <item.icon className={`w-6 h-6 ${item.primary ? 'text-white' : 'text-aifm-gold'}`} />
              </div>
              <h3 className={`font-medium mb-1 ${item.primary ? 'text-white' : 'text-aifm-charcoal'}`}>
                {item.title}
              </h3>
              <p className={`text-sm mb-4 ${item.primary ? 'text-white/60' : 'text-aifm-charcoal/50'}`}>
                {item.desc}
              </p>
              <button 
                onClick={() => handleDownload(item.title)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${item.primary 
                  ? 'bg-aifm-gold text-aifm-charcoal hover:bg-aifm-gold/90' 
                  : 'bg-gray-100 text-aifm-charcoal hover:bg-gray-200'}`}
              >
                <Download className="w-4 h-4" />
                Ladda ner
              </button>
            </div>
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
    </DashboardLayout>
  );
}
